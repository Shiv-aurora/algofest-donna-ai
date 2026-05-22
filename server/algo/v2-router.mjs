import express from 'express'

import { fallbackSolve } from './fallback-planner.mjs'
import { chooseRoute, recordRouteOutcome } from './router-policy.mjs'
import { appendWorkEvent, getWorkHistory } from './work-history-store.mjs'
import { HttpError } from '../lib/http.mjs'
import { schemas, validate } from '../lib/validation.mjs'

function safeArray(value) {
  return Array.isArray(value) ? value : []
}

function getUserId(req) {
  return req.session?.user?.sub || 'anonymous'
}

function pickRouteFromDecision(route) {
  if (route === 'strong') return 'strong'
  if (route === 'standard') return 'small'
  return 'small'
}

function normalizeSolveRequest(input = {}) {
  return {
    tasks: safeArray(input.tasks).map((task) => ({
      id: String(task.id || ''),
      title: String(task.title || task.id || 'Task'),
      task_type: String(task.task_type || task.type || 'assignment'),
      course_id: String(task.course_id || task.course || 'general'),
      deadline: task.deadline || null,
      p75_hours: Number(task.p75_hours || task.p75Hours || task.duration_hours || 1),
      urgency: Number(task.urgency || 1),
      energy_profile: String(task.energy_profile || task.task_type || 'assignment'),
      prereq_ids: safeArray(task.prereq_ids || task.prereqIds)
    })),
    slots: safeArray(input.slots).map((slot) => ({
      id: String(slot.id || ''),
      start: String(slot.start || ''),
      end: String(slot.end || ''),
      blocked: Boolean(slot.blocked)
    })),
    blocked_slot_ids: safeArray(input.blocked_slot_ids || input.blockedSlotIds),
    latency_budget_ms: Number(input.latency_budget_ms || input.latencyBudgetMs || 500),
    preferences: {
      no_saturday_work: Boolean(input.preferences?.no_saturday_work || input.preferences?.noSaturdayWork),
      max_switches:
        input.preferences?.max_switches === undefined ? null : Number(input.preferences.max_switches),
      grace_hours: Number(input.preferences?.grace_hours || input.preferences?.graceHours || 0)
    },
    warm_start: input.warm_start && typeof input.warm_start === 'object' ? input.warm_start : {}
  }
}

function toIsoWeekKey(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const first = new Date(date)
  const day = (first.getUTCDay() + 6) % 7
  first.setUTCDate(first.getUTCDate() - day)
  return first.toISOString().slice(0, 10)
}

function buildEstimatorPayload(userId, solveRequest) {
  const history = []
  const historyByType = new Map()
  for (const task of solveRequest.tasks) {
    const perType = getWorkHistory(userId, task.task_type || 'assignment')
    historyByType.set(task.task_type || 'assignment', perType)
    for (const entry of perType) {
      history.push(entry)
    }
  }

  return {
    tasks: solveRequest.tasks.map((task) => ({
      ...(function () {
        const taskType = task.task_type || 'assignment'
        const hist = historyByType.get(taskType) || []
        const meanActual = hist.length
          ? hist.reduce((sum, row) => sum + Number(row.hours || 0), 0) / hist.length
          : Number(task.p75_hours || 1)
        const refFeatures = hist[hist.length - 1]?.features || {}
        return {
          task_id: task.id,
          user_id: userId,
          task_type: taskType,
          course_id: task.course_id || 'general',
          features: {
            word_count: Number(refFeatures.word_count || 1000),
            page_count: Number(refFeatures.page_count || Math.max(1, Number(task.p75_hours || 1))),
            prior_similar_hours: Number(Math.max(0.25, meanActual)),
            day_of_week: Number(refFeatures.day_of_week ?? 2),
            hours_slept_proxy: Number(refFeatures.hours_slept_proxy || 7),
            course_difficulty_index: Number(refFeatures.course_difficulty_index || 0.45)
          }
        }
      })()
    })),
    history
  }
}

function buildForecastPayload(solveRequest) {
  const grouped = new Map()
  for (const task of solveRequest.tasks) {
    const key = toIsoWeekKey(task.deadline)
    if (!key) continue
    grouped.set(key, (grouped.get(key) || 0) + Number(task.p75_hours || 1))
  }
  const history = [...grouped.entries()]
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .map(([date, load]) => ({ date, load: Number(load.toFixed(2)) }))

  if (history.length < 8) {
    const now = new Date()
    for (let i = history.length; i < 8; i += 1) {
      const next = new Date(now.getTime() - (8 - i) * 7 * 24 * 3600 * 1000)
      history.push({ date: next.toISOString().slice(0, 10), load: 8 + i })
    }
  }
  return { history, horizon_weeks: 4 }
}

async function persistIngestion(pg, userId, ingestionResult) {
  if (!pg?.enabled) return

  await pg.withClient(async (client) => {
    await client.query('BEGIN')
    try {
      for (const task of ingestionResult.tasks || []) {
        await client.query(
          `INSERT INTO tasks (id, user_id, title, task_type, course_id, deadline, weight, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
           ON CONFLICT (user_id, id) DO UPDATE SET
             user_id = EXCLUDED.user_id,
             title = EXCLUDED.title,
             task_type = EXCLUDED.task_type,
             course_id = EXCLUDED.course_id,
             deadline = EXCLUDED.deadline,
             weight = EXCLUDED.weight,
             metadata = EXCLUDED.metadata`,
          [
            task.id,
            userId,
            task.title,
            task.type,
            'syllabus',
            task.due_date || null,
            Number(task.weight || 1),
            JSON.stringify({ confidence: Number(task.confidence || 0.5) })
          ]
        )
      }

      await client.query('DELETE FROM prereq_edges WHERE user_id = $1', [userId])
      for (const edge of ingestionResult.prereq_edges || []) {
        await client.query(
          `INSERT INTO prereq_edges (user_id, from_task_id, to_task_id, confidence)
           VALUES ($1,$2,$3,$4)`,
          [userId, edge.from_task_id, edge.to_task_id, Number(edge.confidence || 0.5)]
        )
      }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

async function persistScheduleRun(pg, userId, routeDecision, solveRequest, solveResponse, meta = {}) {
  if (!pg?.enabled) return null

  return pg.withClient(async (client) => {
    await client.query('BEGIN')
    try {
      const runInsert = await client.query(
        `INSERT INTO schedule_runs (user_id, request, response, route, latency_ms)
         VALUES ($1,$2::jsonb,$3::jsonb,$4,$5)
         RETURNING id`,
        [
          userId,
          JSON.stringify(solveRequest),
          JSON.stringify(solveResponse),
          String(routeDecision.route || 'standard'),
          Number(solveResponse.latency_ms || 0)
        ]
      )

      const runId = runInsert.rows[0]?.id
      for (const assignment of solveResponse.assignments || []) {
        await client.query(
          `INSERT INTO slot_assignments (run_id, user_id, task_id, slot_id, start_at, end_at, minutes)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            runId,
            userId,
            assignment.task_id,
            assignment.slot_id,
            assignment.start || null,
            assignment.end || null,
            Number(assignment.minutes || 0)
          ]
        )
      }

      await client.query(
        `INSERT INTO router_decisions (user_id, route, complexity, latency_budget_ms, token_cost_cents, clarified, outcome)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
        [
          userId,
          String(routeDecision.route || 'standard'),
          Number(routeDecision.complexity || 0),
          Number(solveRequest.latency_budget_ms || 500),
          Number(meta.tokenCostCents || 0),
          false,
          JSON.stringify({ reason: routeDecision.reason || 'unknown' })
        ]
      )

      await client.query('COMMIT')
      return runId
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

export function createV2Router({ config, observability, authGuard, groqService, ollamaService, algoClient, postgresStore }) {
  const router = express.Router()

  router.post('/syllabus/ingest', authGuard, async (req, res, next) => {
    try {
      const body = validate(schemas.v2SyllabusIngestBody, req.body || {}, 'invalid_v2_syllabus_ingest')
      const userId = body.userId || getUserId(req)
      const byokKey = String(body.apiKey || req.get('x-user-api-key') || '').trim()
      const providerMode = body.providerMode === 'local_ollama' ? 'local_ollama' : 'groq'
      const localModel = String(body.localModel || '').trim()
      const canUseGroq = groqService.isConfigured() || Boolean(byokKey)

      let llmCandidates = []
      let llmUsage = null
      let providerUsed = providerMode === 'local_ollama' ? 'local_ollama' : 'groq'
      let fallback = false
      let fallbackReason = ''
      if (body.syllabusText.trim()) {
        if (providerMode === 'local_ollama') {
          try {
            const extracted = await ollamaService.extractSyllabusCandidates({
              syllabusText: body.syllabusText,
              route: body.route === 'strong' ? 'strong' : 'small',
              context: body.courseContext || {},
              localModel
            })
            llmCandidates = safeArray(extracted.candidates)
            llmUsage = extracted.usage
          } catch {
            fallback = true
            fallbackReason = 'local_ollama_unavailable'
            providerUsed = 'groq'
          }
        }
        if ((providerMode === 'groq' || fallback) && canUseGroq) {
          const extracted = await groqService.extractSyllabusCandidates({
            apiKeyOverride: byokKey,
            syllabusText: body.syllabusText,
            route: body.route === 'strong' ? 'strong' : 'small',
            context: body.courseContext || {}
          })
          llmCandidates = safeArray(extracted.candidates)
          llmUsage = extracted.usage
          providerUsed = 'groq'
        }
      }

      const ingestionResult = await algoClient.ingestSyllabus({
        syllabus_text: body.syllabusText,
        llm_candidates: llmCandidates,
        course_context: body.courseContext || {}
      })

      await persistIngestion(postgresStore, userId, ingestionResult)

      res.json({
        ok: true,
        ...ingestionResult,
        llmUsage,
        providerUsed,
        fallback,
        fallbackReason: fallback ? fallbackReason : undefined
      })
    } catch (error) {
      observability.logError('v2.syllabus.ingest.failed', req, error)
      next(error)
    }
  })

  router.post('/plan/solve', authGuard, async (req, res, next) => {
    const started = Date.now()
    try {
      const body = validate(schemas.v2PlanSolveBody, req.body || {}, 'invalid_v2_plan_solve')
      const userId = body.userId || getUserId(req)
      const byokKey = String(body.apiKey || req.get('x-user-api-key') || '').trim()
      const providerMode = body.providerMode === 'local_ollama' ? 'local_ollama' : 'groq'
      const localModel = String(body.localModel || '').trim()
      const canUseGroq = groqService.isConfigured() || Boolean(byokKey)

      const routeDecision = chooseRoute({
        text: body.message || '',
        latencyBudgetMs: Number(body.request?.latency_budget_ms || body.request?.latencyBudgetMs || 500),
        tokenCostCents: Number(body.tokenCostCents || 0),
        complexityOverride: Number.isFinite(body.complexity) ? body.complexity : null
      })

      const solveRequest = normalizeSolveRequest(body.request || {})
      let intent = null
      let intentUsage = null
      let providerUsed = providerMode === 'local_ollama' ? 'local_ollama' : 'groq'
      let llmFallback = false
      let fallbackReason = ''
      const shouldRunLlmForIntent = Boolean(body.message) && (routeDecision.route !== 'trivial' || providerMode === 'local_ollama')

      if (shouldRunLlmForIntent) {
        if (providerMode === 'local_ollama') {
          try {
            const parsed = await ollamaService.parseIntent({
              message: body.message,
              route: pickRouteFromDecision(routeDecision.route),
              context: {
                taskCount: solveRequest.tasks.length,
                slotCount: solveRequest.slots.length
              },
              localModel
            })
            intent = parsed
            intentUsage = parsed.usage
          } catch {
            llmFallback = true
            fallbackReason = 'local_ollama_unavailable'
            providerUsed = 'groq'
          }
        }
        if ((providerMode === 'groq' || llmFallback) && canUseGroq) {
          const parsed = await groqService.parseIntent({
            apiKeyOverride: byokKey,
            message: body.message,
            route: pickRouteFromDecision(routeDecision.route),
            context: {
              taskCount: solveRequest.tasks.length,
              slotCount: solveRequest.slots.length
            }
          })
          intent = parsed
          intentUsage = parsed.usage
          providerUsed = 'groq'
        }
      }

      if (!intent && shouldRunLlmForIntent) {
        // Keep token accounting non-zero for non-trivial routes when no LLM provider is reachable.
        const estimatedTokens = Math.max(1, Math.ceil(String(body.message || '').trim().split(/\s+/).length * 1.25))
        intent = { local: true, message: body.message }
        intentUsage = {
          promptTokens: estimatedTokens,
          completionTokens: 0,
          totalTokens: estimatedTokens
        }
        providerUsed = 'local_deterministic'
      }

      let solveResponse
      let fallback = false

      try {
        solveResponse = await algoClient.solveSchedule(solveRequest)
      } catch (error) {
        fallback = true
        solveResponse = fallbackSolve({
          tasks: solveRequest.tasks,
          slots: solveRequest.slots,
          blockedSlotIds: solveRequest.blocked_slot_ids
        })
        solveResponse.solver_status = 'algo_unavailable_fallback'
      }

      let explanation = null
      let explanationUsage = null
      let estimateBands = []
      let workloadForecast = []
      const shouldRunExplanation = Boolean(body.message) && (routeDecision.route === 'strong' || providerMode === 'local_ollama')
      if (shouldRunExplanation) {
        try {
          if (providerMode === 'local_ollama' && providerUsed === 'local_ollama') {
            const explained = await ollamaService.explainSchedule({
              route: 'strong',
              intent: intent || { message: body.message || '' },
              schedule: solveResponse,
              localModel
            })
            explanation = explained
            explanationUsage = explained.usage
          } else if (canUseGroq) {
            const explained = await groqService.explainSchedule({
              apiKeyOverride: byokKey,
              route: 'strong',
              intent: intent || { message: body.message || '' },
              schedule: solveResponse
            })
            explanation = explained
            explanationUsage = explained.usage
            providerUsed = 'groq'
          }
        } catch {
          if (providerMode === 'local_ollama' && canUseGroq) {
            try {
              const explained = await groqService.explainSchedule({
                apiKeyOverride: byokKey,
                route: 'strong',
                intent: intent || { message: body.message || '' },
                schedule: solveResponse
              })
              explanation = explained
              explanationUsage = explained.usage
              llmFallback = true
              fallbackReason = fallbackReason || 'local_ollama_unavailable'
              providerUsed = 'groq'
            } catch {
              explanation = null
            }
          } else {
            explanation = null
          }
        }
      }

      try {
        const estimates = await algoClient.estimateQuantiles(buildEstimatorPayload(userId, solveRequest))
        estimateBands = safeArray(estimates?.estimates)
      } catch {
        estimateBands = []
      }

      try {
        const forecast = await algoClient.forecast(buildForecastPayload(solveRequest))
        workloadForecast = safeArray(forecast?.forecast)
      } catch {
        workloadForecast = []
      }

      await persistScheduleRun(postgresStore, userId, routeDecision, solveRequest, solveResponse, {
        tokenCostCents: body.tokenCostCents || 0
      })

      recordRouteOutcome(routeDecision.route, false)

      res.json({
        ok: true,
        routeDecision,
        fallback,
        intent,
        explanation,
        usage: {
          intent: intentUsage,
          explanation: explanationUsage
        },
        providerUsed,
        llmFallback,
        fallbackReason: llmFallback ? fallbackReason : undefined,
        estimateBands,
        workloadForecast,
        latencyMs: Date.now() - started,
        result: solveResponse
      })
    } catch (error) {
      observability.logError('v2.plan.solve.failed', req, error)
      next(error)
    }
  })

  router.post('/plan/feasibility', authGuard, async (req, res, next) => {
    try {
      const body = validate(schemas.v2PlanFeasibilityBody, req.body || {}, 'invalid_v2_plan_feasibility')
      const base = normalizeSolveRequest(body.base)
      const payload = {
        base,
        extra_blocked_slot_ids: safeArray(body.extraBlockedSlotIds || body.extra_blocked_slot_ids)
      }

      const result = await algoClient.feasibility(payload)

      res.json({
        ok: true,
        result
      })
    } catch (error) {
      observability.logError('v2.plan.feasibility.failed', req, error)
      next(error)
    }
  })

  router.post('/plan/reoptimize', authGuard, async (req, res, next) => {
    try {
      const body = validate(schemas.v2PlanReoptimizeBody, req.body || {}, 'invalid_v2_plan_reoptimize')
      const payload = {
        base: normalizeSolveRequest(body.base),
        changed_task_ids: safeArray(body.changedTaskIds || body.changed_task_ids),
        prior_solution: safeArray(body.priorSolution || body.prior_solution)
      }

      const result = await algoClient.reoptimize(payload)
      res.json({ ok: true, result })
    } catch (error) {
      observability.logError('v2.plan.reoptimize.failed', req, error)
      next(error)
    }
  })

  router.post('/notify/decision', authGuard, async (req, res, next) => {
    try {
      const body = validate(schemas.v2NotifyDecisionBody, req.body || {}, 'invalid_v2_notify_decision')
      const userId = getUserId(req)

      const result = await algoClient.notifyDecision({
        user_id: userId,
        hour_of_day: body.hourOfDay,
        day_of_week: body.dayOfWeek,
        urgency_bucket: body.urgencyBucket,
        acted_within_30m: body.actedWithin30m
      })

      if (postgresStore?.enabled) {
        await postgresStore.query(
          `INSERT INTO bandit_events (user_id, arm, reward, posterior)
           VALUES ($1,$2,$3,$4::jsonb)`,
          [
            userId,
            result.selected_arm,
            body.actedWithin30m ? 1 : 0,
            JSON.stringify({
              alpha: result.posterior_alpha,
              beta: result.posterior_beta,
              expected: result.expected_reward
            })
          ]
        )
      }

      res.json({ ok: true, result })
    } catch (error) {
      observability.logError('v2.notify.decision.failed', req, error)
      next(error)
    }
  })

  router.post('/events/work', authGuard, async (req, res, next) => {
    try {
      const body = validate(schemas.v2WorkEventBody, req.body || {}, 'invalid_v2_work_event')
      const userId = body.userId || getUserId(req)
      const taskType = body.taskType || String(body.taskId || '').split('-')[0] || 'assignment'
      const courseId = body.courseId || 'general'
      if (postgresStore?.enabled) {
        await postgresStore.withClient(async (client) => {
          await client.query('BEGIN')
          try {
            await client.query(
              `INSERT INTO actual_work_events (user_id, task_id, slot_id, actual_hours, estimated_hours, completion_status)\n               VALUES ($1,$2,$3,$4,$5,$6)`,
              [userId, body.taskId, body.slotId || null, body.actualHours, body.predictedHours, body.completionStatus]
            )
            await client.query(
              `INSERT INTO estimate_events (user_id, task_id, predicted, observed_hours)\n               VALUES ($1,$2,$3::jsonb,$4)`,
              [userId, body.taskId, JSON.stringify({ predictedHours: body.predictedHours }), body.actualHours]
            )
            await client.query('COMMIT')
          } catch (error) {
            await client.query('ROLLBACK')
            throw error
          }
        })
      }

      appendWorkEvent({
        userId,
        taskType,
        courseId,
        actualHours: body.actualHours,
        features: {
          word_count: 1000,
          page_count: Math.max(1, Number(body.predictedHours || 1)),
          prior_similar_hours: Number(body.predictedHours || 1),
          day_of_week: 2,
          hours_slept_proxy: 7,
          course_difficulty_index: 0.45
        }
      })

      res.json({ ok: true })
    } catch (error) {
      observability.logError('v2.events.work.failed', req, error)
      next(error)
    }
  })

  router.get('/metrics/benchmark', authGuard, async (req, res, next) => {
    try {
      const bench = await algoClient.benchmarkMetrics()
      res.json({ ok: true, ...bench })
    } catch (error) {
      next(new HttpError('Benchmark sidecar unavailable.', 503, { reasonCode: 'algo_unavailable' }))
    }
  })

  router.get('/health', authGuard, async (_req, res) => {
    const algoReady = algoClient.isConfigured()
    const dbReady = Boolean(postgresStore?.enabled)
    res.json({ ok: true, algoReady, dbReady, frontendOrigin: config.frontendOrigin })
  })

  return router
}
