import { z } from 'zod'

import { HttpError } from './http.mjs'

const isoDatetime = z.string().datetime({ offset: true })
const returnToUrl = z.string().url().optional()
const v2Task = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  task_type: z.string().optional(),
  type: z.string().optional(),
  course_id: z.string().optional(),
  course: z.string().optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional(),
  p75_hours: z.number().positive().optional(),
  p75Hours: z.number().positive().optional(),
  duration_hours: z.number().positive().optional(),
  urgency: z.number().nonnegative().optional(),
  energy_profile: z.string().optional(),
  prereq_ids: z.array(z.string()).optional(),
  prereqIds: z.array(z.string()).optional()
})

const v2Slot = z.object({
  id: z.string().min(1),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  blocked: z.boolean().optional()
})

const v2Preferences = z.object({
  no_saturday_work: z.boolean().optional(),
  noSaturdayWork: z.boolean().optional(),
  max_switches: z.number().int().nonnegative().nullable().optional(),
  grace_hours: z.number().int().nonnegative().optional(),
  graceHours: z.number().int().nonnegative().optional()
}).optional()

const providerMode = z.enum(['groq', 'local_ollama']).optional()

const v2SolveRequest = z.object({
  tasks: z.array(v2Task).min(1),
  slots: z.array(v2Slot).min(1),
  blocked_slot_ids: z.array(z.string()).optional(),
  blockedSlotIds: z.array(z.string()).optional(),
  latency_budget_ms: z.number().int().positive().max(10000).optional(),
  latencyBudgetMs: z.number().int().positive().max(10000).optional(),
  preferences: v2Preferences,
  warm_start: z.record(z.string(), z.string()).optional()
})

export const schemas = {
  authReturnToQuery: z.object({
    returnTo: z.string().url().optional()
  }),
  guestOrDemoLoginBody: z.object({
    returnTo: returnToUrl
  }),
  logoutBody: z.object({
    returnTo: returnToUrl
  }),
  providerParam: z.object({
    provider: z.string().min(1)
  }),
  connectProviderBody: z.object({
    institutionDomain: z.string().trim().optional(),
    returnTo: returnToUrl
  }),
  lmsConnectBody: z.object({
    provider: z.enum(['canvas', 'blackboard']),
    mode: z.enum(['ics_link', 'api_token']).default('ics_link'),
    sourceUrl: z.string().url(),
    courseHint: z.string().trim().max(200).optional(),
    testOnly: z.boolean().optional()
  }),
  lmsSyncBody: z.object({
    provider: z.enum(['canvas', 'blackboard']),
    force: z.boolean().optional()
  }),
  lmsStatusQuery: z.object({
    provider: z.enum(['canvas', 'blackboard']).optional()
  }),
  proposeStudyBlockBody: z.object({
    title: z.string().trim().min(1).max(200).optional(),
    start: isoDatetime,
    end: isoDatetime.optional(),
    durationMinutes: z.number().int().min(15).max(300).optional(),
    description: z.string().max(3000).optional(),
    source: z.string().trim().max(64).optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
  }),
  approveActionParam: z.object({
    id: z.string().min(1)
  }),
  plannerBody: z.object({
    route: z.enum(['small', 'strong']).optional(),
    source: z.string().trim().max(64).optional(),
    request: z.record(z.string(), z.unknown()).optional(),
    apiKey: z.string().trim().optional(),
    providerMode,
    localModel: z.string().trim().min(1).max(120).optional()
  }),
  v2SyllabusIngestBody: z.object({
    syllabusText: z.string().min(1).max(300000),
    courseContext: z.record(z.string(), z.unknown()).optional(),
    route: z.enum(['small', 'strong']).optional(),
    apiKey: z.string().trim().optional(),
    providerMode,
    localModel: z.string().trim().min(1).max(120).optional()
  }),
  v2PlanSolveBody: z.object({
    message: z.string().max(4000).optional(),
    userId: z.string().min(1).optional(),
    request: v2SolveRequest,
    complexity: z.number().min(0).max(1).optional(),
    tokenCostCents: z.number().nonnegative().optional(),
    apiKey: z.string().trim().optional(),
    providerMode,
    localModel: z.string().trim().min(1).max(120).optional()
  }),
  v2PlanFeasibilityBody: z.object({
    base: v2SolveRequest,
    extraBlockedSlotIds: z.array(z.string()).optional(),
    extra_blocked_slot_ids: z.array(z.string()).optional()
  }),
  v2PlanReoptimizeBody: z.object({
    base: v2SolveRequest,
    changedTaskIds: z.array(z.string()).optional(),
    changed_task_ids: z.array(z.string()).optional(),
    priorSolution: z.array(z.record(z.string(), z.unknown())).optional(),
    prior_solution: z.array(z.record(z.string(), z.unknown())).optional()
  }),
  v2NotifyDecisionBody: z.object({
    hourOfDay: z.number().int().min(0).max(23),
    dayOfWeek: z.number().int().min(0).max(6),
    urgencyBucket: z.enum(['low', 'medium', 'high']).default('medium'),
    actedWithin30m: z.boolean().optional()
  }),
  v2WorkEventBody: z.object({
    taskId: z.string().min(1),
    userId: z.string().min(1).optional(),
    taskType: z.string().min(1).optional(),
    courseId: z.string().min(1).optional(),
    slotId: z.string().optional(),
    predictedHours: z.number().positive(),
    actualHours: z.number().positive(),
    completionStatus: z.enum(['completed', 'partial', 'skipped']).default('completed')
  }),
  googleCallbackQuery: z.object({
    state: z.string().optional(),
    code: z.string().optional(),
    error: z.string().optional(),
    error_description: z.string().optional(),
    returnTo: z.string().url().optional()
  })
}

export function validate(schema, payload, reasonCode = 'invalid_request') {
  const parsed = schema.safeParse(payload)
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 3).map((issue) => ({
      path: issue.path.join('.'),
      code: issue.code
    }))
    throw new HttpError('Invalid request payload.', 400, {
      reasonCode,
      issues
    })
  }
  return parsed.data
}
