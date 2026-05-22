import { PROMPTS } from '../algo/prompts.mjs'
import { HttpError, fetchJson } from '../lib/http.mjs'

function safeParse(value, fallback = null) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function extractJson(content) {
  if (!content) return null
  const trimmed = String(content).trim()
  if (!trimmed) return null

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return safeParse(trimmed, null)
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start >= 0 && end > start) {
    return safeParse(trimmed.slice(start, end + 1), null)
  }

  return null
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function createOllamaService(config) {
  const baseUrl = String(config.ollama?.baseUrl || '').trim().replace(/\/$/, '')
  const defaultModel = String(config.ollama?.model || 'gemma3:4b').trim()
  const timeoutMs = Number(config.ollama?.timeoutMs || 12000)

  async function callJson({ modelRoute = 'small', localModel = '', systemPrompt, userPayload }) {
    const model = String(localModel || defaultModel).trim() || defaultModel
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetchJson(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model,
          stream: false,
          format: 'json',
          options: {
            temperature: 0.2
          },
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: JSON.stringify({ ...userPayload, modelRoute }) }
          ]
        }),
        signal: controller.signal
      })

      const content = response?.message?.content ?? ''
      const parsed = extractJson(content)
      if (!parsed) {
        throw new HttpError('Ollama response was not valid JSON.', 502, { reasonCode: 'provider_error' })
      }

      return {
        data: parsed,
        model,
        usage: {
          promptTokens: toNumber(response?.prompt_eval_count, 0),
          completionTokens: toNumber(response?.eval_count, 0),
          totalTokens: toNumber(response?.prompt_eval_count, 0) + toNumber(response?.eval_count, 0)
        }
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new HttpError('Local Ollama request timed out.', 504, { reasonCode: 'provider_timeout' })
      }
      throw error
    } finally {
      clearTimeout(timer)
    }
  }

  async function plan({ request, route = 'small', source = 'chat', localModel = '' }) {
    const result = await callJson({
      localModel,
      modelRoute: route,
      systemPrompt:
        'You are Donna AI planner. Return JSON only with keys: assistantMessage, confidence (0..1), suggestion, priorityOrder (array of priority titles), timelineUpdates (array of {time,title,detail,status}), reason.',
      userPayload: {
        source,
        request
      }
    })

    const parsed = result.data
    return {
      route,
      assistantMessage: parsed.assistantMessage || 'I optimized the plan and updated your dashboard.',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : route === 'strong' ? 0.8 : 0.68,
      suggestion: parsed.suggestion,
      priorityOrder: parsed.priorityOrder,
      timelineUpdates: parsed.timelineUpdates,
      reason: parsed.reason || `Ollama ${result.model} planner`,
      usage: result.usage
    }
  }

  async function parseIntent({ message, context = {}, route = 'small', localModel = '' }) {
    const result = await callJson({
      localModel,
      modelRoute: route,
      systemPrompt: PROMPTS.intent,
      userPayload: { message, context }
    })
    return {
      ...result.data,
      route,
      usage: result.usage
    }
  }

  async function explainSchedule({ route = 'small', intent = {}, schedule = {}, localModel = '' }) {
    const result = await callJson({
      localModel,
      modelRoute: route,
      systemPrompt: PROMPTS.explanation,
      userPayload: { intent, schedule }
    })
    return {
      ...result.data,
      route,
      usage: result.usage
    }
  }

  async function extractSyllabusCandidates({ syllabusText = '', route = 'small', context = {}, localModel = '' }) {
    const result = await callJson({
      localModel,
      modelRoute: route,
      systemPrompt: PROMPTS.syllabus,
      userPayload: { syllabus_text: syllabusText, context }
    })
    return {
      candidates: Array.isArray(result.data?.candidates) ? result.data.candidates : [],
      route,
      usage: result.usage
    }
  }

  return {
    plan,
    parseIntent,
    explainSchedule,
    extractSyllabusCandidates
  }
}
