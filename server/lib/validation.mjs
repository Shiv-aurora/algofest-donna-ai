import { z } from 'zod'

import { HttpError } from './http.mjs'

const isoDatetime = z.string().datetime({ offset: true })
const returnToUrl = z.string().url().optional()

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
    apiKey: z.string().trim().optional()
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
