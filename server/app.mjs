import crypto from 'node:crypto'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'

import { createActionStore } from './actions/action-store.mjs'
import { createAlgoClient } from './algo/algo-client.mjs'
import { createV2Router } from './algo/v2-router.mjs'
import { createUsageLimitStore } from './actions/usage-limit-store.mjs'
import { requireAuth } from './auth/middleware.mjs'
import { createSessionMiddleware } from './auth/session.mjs'
import { createPostgresStore } from './db/postgres.mjs'
import { createGoogleCalendarService } from './google/google-calendar-service.mjs'
import { createGoogleOAuthService } from './google/google-oauth-service.mjs'
import { createGroqService } from './groq/groq-service.mjs'
import { createOllamaService } from './llm/ollama-service.mjs'
import { createLmsSyncService } from './lms/lms-sync-service.mjs'
import { createCsrfProtection, ensureCsrfToken } from './lib/csrf.mjs'
import { loadEnv } from './lib/env.mjs'
import { HttpError, toErrorResponse } from './lib/http.mjs'
import { createObservability } from './lib/observability.mjs'
import { schemas, validate } from './lib/validation.mjs'

const config = loadEnv()
const app = express()
const observability = createObservability({
  identitySalt: config.sessionSecret
})

const googleOAuth = createGoogleOAuthService(config)
const groqService = createGroqService(config)
const ollamaService = createOllamaService(config)
const calendarService = createGoogleCalendarService()
const lmsSyncService = createLmsSyncService({ observability })
const postgresStore = await createPostgresStore(config, observability)
const actionStore = createActionStore(config.files.actionStoreFile, postgresStore)
const usageLimitStore = createUsageLimitStore(config.files.usageStoreFile, postgresStore)
const authGuard = requireAuth(config)
const algoClient = createAlgoClient(config)
const GOOGLE_IDENTITY_SCOPES = ['openid', 'email', 'profile']

if (config.trustProxy) {
  const trust = config.trustProxy === 'true' ? true : config.trustProxy
  app.set('trust proxy', trust)
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === config.frontendOrigin) return callback(null, true)
      return callback(new Error(`Origin ${origin} is not allowed by CORS`), false)
    },
    credentials: true
  })
)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        connectSrc: ["'self'", config.frontendOrigin],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
    referrerPolicy: { policy: 'no-referrer' }
  })
)
app.use(observability.requestContext)
app.use(express.json({ limit: '100kb' }))
const { middleware: sessionMiddleware } = await createSessionMiddleware(config)
app.use(sessionMiddleware)
app.use(createCsrfProtection(config))
app.use(
  '/api/v2',
  createV2Router({
    config,
    observability,
    authGuard,
    groqService,
    ollamaService,
    algoClient,
    postgresStore
  })
)

const providerStore = new Map()
const demoCalendarEventStore = new Map()

function createDefaultProviders() {
  return {
    canvas: {
      provider: 'canvas',
      connected: false,
      lastSyncAt: null,
      status: 'idle',
      errorMessage: '',
      institutionDomain: '',
      mode: 'ics_link',
      sourceUrl: '',
      courseHint: '',
      importedTasks: 0,
      importedEvents: 0,
      lastError: ''
    },
    blackboard: {
      provider: 'blackboard',
      connected: false,
      lastSyncAt: null,
      status: 'idle',
      errorMessage: '',
      institutionDomain: '',
      mode: 'ics_link',
      sourceUrl: '',
      courseHint: '',
      importedTasks: 0,
      importedEvents: 0,
      lastError: ''
    },
    googleCalendar: {
      provider: 'googleCalendar',
      connected: false,
      lastSyncAt: null,
      status: 'idle',
      errorMessage: '',
      institutionDomain: ''
    }
  }
}

function normalizeProvider(raw) {
  if (raw === 'google_calendar') return 'googleCalendar'
  return raw
}

function getUserId(req) {
  return req.session?.user?.sub || null
}

function getUserMode(req) {
  return String(req.session?.user?.mode || '')
}

function isDemoUser(req) {
  return getUserMode(req) === 'demo'
}

function getAuthStateCode(req) {
  if (req.session?.user?.sub) return 'authenticated'
  return 'unauthenticated'
}

function getAuthReasonCode(req) {
  const state = getAuthStateCode(req)
  if (state === 'authenticated') {
    const mode = getUserMode(req)
    if (mode === 'google') return 'google_session'
    if (mode === 'guest') return 'guest_session'
    if (mode === 'demo') return 'demo_session'
    return 'session_authenticated'
  }
  return 'auth_required'
}

function getAuthLoginUrl(req) {
  const returnTo = pickQueryString(req.query.returnTo, '')
  if (!returnTo) return `${config.frontendOrigin}/login`
  return `${config.frontendOrigin}/login?returnTo=${encodeURIComponent(returnTo)}`
}

function withQuery(baseUrl, params = {}) {
  const target = new URL(baseUrl, config.frontendOrigin)
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue
    target.searchParams.set(key, String(value))
  }
  return target.toString()
}

function getProviderState(authenticated, provider) {
  if (!authenticated) {
    return { stateCode: 'unauthenticated', reasonCode: 'auth_required' }
  }
  if (!provider?.connected) {
    return { stateCode: 'authenticated_unconnected', reasonCode: 'provider_not_connected' }
  }
  if (provider?.status === 'syncing') {
    return { stateCode: 'connection_pending', reasonCode: 'provider_syncing' }
  }
  if (provider?.errorMessage) {
    return { stateCode: 'provider_error', reasonCode: 'provider_error' }
  }
  return { stateCode: 'connected_ready', reasonCode: 'ready' }
}

function makeDemoEvent(id, summary, description, offsetMinutes, durationMinutes, daysOffset = 0) {
  const base = new Date()
  base.setDate(base.getDate() + daysOffset)
  base.setHours(0, 0, 0, 0)
  const start = new Date(base.getTime() + offsetMinutes * 60 * 1000)
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000)
  return {
    id,
    summary,
    description,
    htmlLink: '',
    status: 'confirmed',
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() }
  }
}

function buildDemoCalendarEvents() {
  const now = new Date()
  const todayMinutes = now.getHours() * 60 + now.getMinutes()

  return [
    // Today
    makeDemoEvent('demo-1', 'Systems Programming Lecture', 'CSE 220 — Virtual memory and process scheduling', 9 * 60, 75, 0),
    makeDemoEvent('demo-2', 'Office Hours — Prof. Chen', 'Drop-in for midterm questions', 11 * 60, 60, 0),
    makeDemoEvent('demo-3', 'Organic Chemistry Lab', 'Lab 6: Distillation and purification', 14 * 60, 180, 0),
    makeDemoEvent('demo-4', 'Study Block: Exam Prep', 'Donna scheduled — Review chapters 5–7', 20 * 60, 90, 0),

    // Tomorrow
    makeDemoEvent('demo-5', 'Calculus III Lecture', 'Triple integrals and change of variables', 8 * 60, 75, 1),
    makeDemoEvent('demo-6', 'CS Study Group', 'Algorithms problem set with Raj and Mia', 13 * 60, 90, 1),
    makeDemoEvent('demo-7', 'Advising Appointment', 'Fall semester course planning', 15 * 60, 30, 1),
    makeDemoEvent('demo-8', 'Study Block: Orgo Lab Report', 'Donna scheduled — Pre-lab write-up deadline', 21 * 60, 60, 1),

    // Day after tomorrow
    makeDemoEvent('demo-9', 'Systems Programming Lecture', 'CSE 220 — File systems and I/O', 9 * 60, 75, 2),
    makeDemoEvent('demo-10', 'Organic Chemistry Lecture', 'Stereochemistry and chirality', 11 * 60, 75, 2),
    makeDemoEvent('demo-11', 'Gym — Workout', 'Upper body + cardio', 17 * 60, 60, 2),
    makeDemoEvent('demo-12', 'Study Block: Systems Midterm', 'Donna scheduled — Past exams review', 19 * 60, 120, 2),

    // Day 4
    makeDemoEvent('demo-13', 'CS Peer Review Session', 'Code review for project 3', 10 * 60, 60, 3),
    makeDemoEvent('demo-14', 'Calculus III Lecture', 'Vector fields and line integrals', 14 * 60, 75, 3),
    makeDemoEvent('demo-15', 'Systems Programming MIDTERM', 'CSE 220 Midterm Exam — Room 204', 18 * 60, 120, 3),

    // Day 5
    makeDemoEvent('demo-16', 'Recovery & Review', 'Post-midterm debrief with study group', 11 * 60, 60, 4),
    makeDemoEvent('demo-17', 'Organic Chemistry Lecture', 'Reaction mechanisms overview', 13 * 60, 75, 4),
    makeDemoEvent('demo-18', 'Study Block: Calc Problem Set', 'Donna scheduled — HW due Friday', 20 * 60, 90, 4)
  ]
}

function getDemoEvents(userId) {
  if (!demoCalendarEventStore.has(userId)) {
    demoCalendarEventStore.set(userId, buildDemoCalendarEvents())
  }
  return demoCalendarEventStore.get(userId)
}

function getProvidersForUser(userId) {
  if (!userId) return createDefaultProviders()
  if (!providerStore.has(userId)) {
    providerStore.set(userId, createDefaultProviders())
  }
  return providerStore.get(userId)
}

function providerOr404(req, res) {
  const key = normalizeProvider(req.params.provider)
  const providers = getProvidersForUser(getUserId(req))
  const provider = providers[key]
  if (!provider) {
    res.status(404).json({ error: 'Unknown provider' })
    return null
  }
  return { provider, key, providers }
}

function updateProvider(providers, key, patch) {
  providers[key] = {
    ...providers[key],
    ...patch
  }
  return providers[key]
}

function getClientIp(req) {
  return String(req.ip || req.socket?.remoteAddress || '').trim()
}

function hashIp(ip) {
  const normalized = String(ip || '')
    .replace(/^::ffff:/, '')
    .trim()
  return crypto
    .createHash('sha256')
    .update(`${config.limits.ipSalt}:${normalized}`)
    .digest('hex')
}

async function getPlannerUsageSnapshot(req) {
  const userId = getUserId(req)
  const ipHash = hashIp(getClientIp(req))
  if (!userId) return null
  return usageLimitStore.getUsageSnapshot({
    userId,
    ipHash,
    limits: config.limits
  })
}

function plannerEligibility(req) {
  const mode = getUserMode(req)
  const freeTierEligible = mode === 'google' || mode === 'demo'
  const serverGroqConfigured = groqService.isConfigured()
  return {
    mode,
    freeTierEligible,
    serverGroqConfigured,
    ollamaConfigured: Boolean(config.ollama?.baseUrl),
    requiresByok: !serverGroqConfigured || !freeTierEligible
  }
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

function regenerateSession(req) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

function isPendingFlowFresh(flow, maxAgeMs = 10 * 60 * 1000) {
  const createdAt = Number(flow?.createdAt || 0)
  if (!Number.isFinite(createdAt) || createdAt <= 0) return false
  return Date.now() - createdAt <= maxAgeMs
}

function pickQueryString(value, fallback) {
  if (Array.isArray(value)) {
    const filtered = value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
    if (filtered.length > 0) return filtered[filtered.length - 1]
    return fallback
  }
  const single = String(value || '').trim()
  return single || fallback
}

function resolveReturnTo(value, fallback = `${config.frontendOrigin}/dashboard`) {
  const candidate = pickQueryString(value, fallback)
  try {
    const target = new URL(candidate, config.frontendOrigin)
    if (target.origin !== config.frontendOrigin) return fallback
    return target.toString()
  } catch {
    return fallback
  }
}

function logAudit(event, details = {}) {
  const { req, ...rest } = details
  const sanitized = { ...rest }

  const piiKeys = ['userId', 'userSub', 'providerSub', 'email']
  for (const key of piiKeys) {
    const value = sanitized[key]
    if (!value) continue
    sanitized[`${key}Hash`] = crypto
      .createHash('sha256')
      .update(`${config.sessionSecret}:${String(value)}`)
      .digest('hex')
    delete sanitized[key]
  }

  observability.logEvent(event, req || null, sanitized)
}

function toCalendarContext(events) {
  const normalized = events
    .map((event) => {
      const start = event.start?.dateTime || event.start?.date || null
      const end = event.end?.dateTime || event.end?.date || null
      return {
        id: event.id,
        title: event.summary || '(untitled)',
        start,
        end,
        status: event.status
      }
    })
    .filter((event) => event.start)

  normalized.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())

  const now = Date.now()
  const upcoming = normalized.filter((event) => new Date(event.start).getTime() >= now)
  const nextEvent = upcoming[0] || null

  const freeWindows = []
  let cursor = now
  for (const event of upcoming.slice(0, 8)) {
    const startTs = new Date(event.start).getTime()
    if (startTs - cursor >= 30 * 60 * 1000) {
      freeWindows.push({
        start: new Date(cursor).toISOString(),
        end: new Date(startTs).toISOString(),
        minutes: Math.round((startTs - cursor) / 60000)
      })
    }
    const eventEnd = event.end ? new Date(event.end).getTime() : startTs
    cursor = Math.max(cursor, eventEnd)
  }

  return {
    eventCount: upcoming.length,
    nextEvent,
    freeWindows: freeWindows.slice(0, 5)
  }
}

function toIsoOrNull(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString()
}

function addMinutesToIso(iso, minutes) {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  parsed.setMinutes(parsed.getMinutes() + minutes)
  return parsed.toISOString()
}

async function getGoogleAccessTokenForUser(req) {
  if (googleOAuth.isGoogleConnected(req.session)) {
    return googleOAuth.getValidAccessToken(req.session)
  }

  throw new HttpError(
    'Google Calendar not connected. Please connect in Settings.',
    400,
    { reasonCode: 'connect_provider_required' }
  )
}

function isGoogleCalendarConnected(req) {
  if (isDemoUser(req)) return true
  return googleOAuth.isGoogleConnected(req.session)
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/auth/csrf', (req, res) => {
  const token = ensureCsrfToken(req)
  res.json({ ok: true, csrfToken: token })
})

app.get('/api/auth/login', (req, res, next) => {
  try {
    const query = validate(schemas.authReturnToQuery, req.query, 'invalid_return_to')
    const returnTo = resolveReturnTo(query.returnTo, `${config.frontendOrigin}/dashboard`)
    res.redirect(`${config.frontendOrigin}/login?returnTo=${encodeURIComponent(returnTo)}`)
  } catch (error) {
    observability.logError('auth.login.redirect.failed', req, error)
    next(error)
  }
})

app.get('/api/auth/google/start', async (req, res, next) => {
  try {
    const query = validate(schemas.authReturnToQuery, req.query, 'invalid_return_to')
    const returnTo = resolveReturnTo(query.returnTo, `${config.frontendOrigin}/dashboard`)
    if (!googleOAuth.isConfigured()) {
      observability.incrementCounter('auth_google_start_failed_total', { reasonCode: 'misconfigured' })
      return res.redirect(
        withQuery(returnTo, {
          auth: 'failed',
          reason: 'misconfigured',
          message: 'Google sign-in is not configured on the backend.'
        })
      )
    }

    const state = crypto.randomUUID()
    const redirectUri = `${config.serverBaseUrl}/api/auth/google/callback`
    req.session.authFlow = {
      strategy: 'google',
      state,
      redirectUri,
      returnTo,
      createdAt: Date.now()
    }
    await saveSession(req)

    const redirectUrl = googleOAuth.buildAuthUrl(redirectUri, state, {
      scopes: GOOGLE_IDENTITY_SCOPES,
      prompt: 'select_account',
      includeGrantedScopes: true
    })

    logAudit('auth.google.start', { req, returnTo })
    res.redirect(redirectUrl)
  } catch (error) {
    observability.logError('auth.google.start.failed', req, error)
    next(error)
  }
})

app.get('/api/auth/google/callback', async (req, res, next) => {
  try {
    validate(schemas.googleCallbackQuery, req.query, 'invalid_google_callback_query')
    const pending = req.session?.authFlow
    const returnTo = resolveReturnTo(pending?.returnTo || req.query.returnTo, `${config.frontendOrigin}/dashboard`)

    if (!pending || pending.strategy !== 'google') {
      observability.incrementCounter('auth_google_callback_failed_total', { reasonCode: 'missing_auth_state' })
      return res.redirect(
        withQuery(returnTo, {
          auth: 'failed',
          reason: 'missing_auth_state'
        })
      )
    }

    if (!isPendingFlowFresh(pending)) {
      observability.incrementCounter('auth_google_callback_failed_total', { reasonCode: 'expired_auth_state' })
      delete req.session.authFlow
      await saveSession(req)
      return res.redirect(
        withQuery(returnTo, {
          auth: 'failed',
          reason: 'expired_auth_state'
        })
      )
    }

    const callbackError = String(req.query.error || '')
    if (callbackError) {
      observability.incrementCounter('auth_google_callback_failed_total', { reasonCode: 'google_auth_error' })
      delete req.session.authFlow
      await saveSession(req)
      return res.redirect(
        withQuery(returnTo, {
          auth: 'failed',
          reason: 'google_auth_error'
        })
      )
    }

    const state = String(req.query.state || '')
    if (state !== pending.state) {
      observability.incrementCounter('auth_google_callback_failed_total', { reasonCode: 'state_mismatch' })
      delete req.session.authFlow
      await saveSession(req)
      return res.redirect(
        withQuery(returnTo, {
          auth: 'failed',
          reason: 'state_mismatch'
        })
      )
    }

    const code = String(req.query.code || '')
    if (!code) {
      observability.incrementCounter('auth_google_callback_failed_total', { reasonCode: 'code_missing' })
      delete req.session.authFlow
      await saveSession(req)
      return res.redirect(
        withQuery(returnTo, {
          auth: 'failed',
          reason: 'code_missing'
        })
      )
    }

    const tokens = await googleOAuth.exchangeCode(code, pending.redirectUri)
    const identity = await googleOAuth.fetchUserProfile(tokens.accessToken)

    await regenerateSession(req)
    req.session.user = {
      sub: `google|${identity.sub}`,
      providerSub: identity.sub,
      email: identity.email,
      name: identity.name,
      picture: identity.picture,
      mode: 'google'
    }

    ensureCsrfToken(req)
    await saveSession(req)

    logAudit('auth.google.success', { req, userSub: req.session.user.sub })
    res.redirect(returnTo)
  } catch (error) {
    observability.logError('auth.google.callback.failed', req, error)
    const pending = req.session?.authFlow
    const returnTo = resolveReturnTo(pending?.returnTo, `${config.frontendOrigin}/dashboard`)
    return res.redirect(
      withQuery(returnTo, {
        auth: 'failed',
        reason: 'google_callback_failed'
      })
    )
  }
})

app.get('/api/auth/callback', (req, res) => {
  const requestedReturnTo = resolveReturnTo(req.query.returnTo, `${config.frontendOrigin}/dashboard`)
  observability.incrementCounter('auth_legacy_callback_total', { reasonCode: 'legacy_callback_unsupported' })
  res.redirect(
    withQuery(requestedReturnTo, {
      auth: 'failed',
      reason: 'legacy_callback_unsupported'
    })
  )
})

app.post('/api/auth/guest-login', async (req, res, next) => {
  try {
    const body = validate(schemas.guestOrDemoLoginBody, req.body || {}, 'invalid_guest_login_request')
    const returnTo = resolveReturnTo(body.returnTo, `${config.frontendOrigin}/dashboard`)
    await regenerateSession(req)
    req.session.user = {
      sub: `guest|${crypto.randomUUID()}`,
      email: '',
      name: 'Guest User',
      picture: '',
      mode: 'guest'
    }
    delete req.session.authFlow
    delete req.session.googleConnect
    googleOAuth.clearGoogleTokens(req.session)
    ensureCsrfToken(req)
    await saveSession(req)
    logAudit('auth.guest.success', { req, userSub: req.session.user.sub })
    res.status(201).json({ ok: true, redirectTo: returnTo })
  } catch (error) {
    observability.logError('auth.guest.failed', req, error)
    next(error)
  }
})

app.post('/api/auth/demo-login', async (req, res, next) => {
  try {
    const body = validate(schemas.guestOrDemoLoginBody, req.body || {}, 'invalid_demo_login_request')
    const returnTo = resolveReturnTo(body.returnTo, `${config.frontendOrigin}/dashboard`)
    await regenerateSession(req)
    req.session.user = {
      sub: 'demo|student',
      email: 'demo@donna.app',
      name: 'Donna Demo User',
      picture: '',
      mode: 'demo'
    }
    delete req.session.authFlow
    delete req.session.googleConnect
    googleOAuth.clearGoogleTokens(req.session)
    ensureCsrfToken(req)
    await saveSession(req)
    logAudit('auth.demo.success', { req, userSub: req.session.user.sub })
    res.status(201).json({ ok: true, redirectTo: returnTo })
  } catch (error) {
    observability.logError('auth.demo.failed', req, error)
    next(error)
  }
})

app.get('/api/auth/me', (req, res) => {
  const authStateCode = getAuthStateCode(req)
  const authenticated = authStateCode === 'authenticated'
  const user = authenticated ? req.session?.user || null : null
  res.json({
    authenticated,
    user,
    loginUrl: getAuthLoginUrl(req),
    logoutUrl: '/api/auth/logout',
    authStateCode,
    reasonCode: getAuthReasonCode(req)
  })
})

app.post('/api/auth/logout', (req, res, next) => {
  try {
    const body = validate(schemas.logoutBody, req.body || {}, 'invalid_logout_request')
    const returnTo = resolveReturnTo(body.returnTo, `${config.frontendOrigin}/login`)
    googleOAuth.clearGoogleTokens(req.session)
    delete req.session.authFlow
    delete req.session.googleConnect
    delete req.session.user
    req.session.destroy((error) => {
      if (error) return next(error)
      res.clearCookie('donna.sid', {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.isProduction
      })
      observability.incrementCounter('auth_logout_total', { reasonCode: 'logged_out' })
      res.json({ ok: true, logoutUrl: returnTo, authStateCode: 'unauthenticated', reasonCode: 'logged_out' })
    })
  } catch (error) {
    observability.logError('auth.logout.failed', req, error)
    next(error)
  }
})

app.get('/api/connectivity/providers', async (req, res, next) => {
  try {
    const userId = getUserId(req)
    const providers = getProvidersForUser(userId)
    const authStateCode = getAuthStateCode(req)
    const authenticated = authStateCode === 'authenticated'

    if (authenticated && userId && !isDemoUser(req)) {
      const googleConnected = googleOAuth.isGoogleConnected(req.session)
      updateProvider(providers, 'googleCalendar', {
        connected: googleConnected,
        status: providers.googleCalendar.status === 'syncing' ? 'syncing' : 'idle',
        errorMessage: googleConnected ? '' : providers.googleCalendar.errorMessage
      })
    }

    if (!authenticated) {
      updateProvider(providers, 'googleCalendar', {
        connected: false,
        status: 'idle',
        errorMessage: ''
      })
    }

    const providerState = getProviderState(authenticated, providers.googleCalendar)
    updateProvider(providers, 'googleCalendar', {
      reasonCode: providerState.reasonCode
    })

    res.json({
      providers,
      stateCode: providerState.stateCode,
      reasonCode: providerState.reasonCode,
      auth: {
        authenticated,
        user: authenticated ? req.session?.user || null : null,
        loginUrl: getAuthLoginUrl(req),
        authStateCode,
        reasonCode: getAuthReasonCode(req)
      }
    })
  } catch (error) {
    next(error)
  }
})

app.post('/api/connectivity/lms/connect', authGuard, async (req, res, next) => {
  try {
    const body = validate(schemas.lmsConnectBody, req.body || {}, 'invalid_lms_connect_request')
    const userId = getUserId(req)
    const providers = getProvidersForUser(userId)
    const result = await lmsSyncService.connect({
      userId,
      provider: body.provider,
      mode: body.mode,
      sourceUrl: body.sourceUrl,
      courseHint: body.courseHint || '',
      testOnly: Boolean(body.testOnly)
    })

    if (body.testOnly) {
      return res.json({
        ok: true,
        message: 'LMS link validated.',
        provider: result.provider
      })
    }

    updateProvider(providers, body.provider, {
      connected: true,
      status: 'idle',
      errorMessage: '',
      mode: result.provider.mode,
      sourceUrl: result.provider.sourceUrl,
      courseHint: result.provider.courseHint || '',
      lastError: ''
    })

    return res.json({
      ok: true,
      provider: providers[body.provider]
    })
  } catch (error) {
    observability.logError('connectivity.lms.connect.failed', req, error)
    next(error)
  }
})

app.post('/api/connectivity/lms/sync', authGuard, async (req, res, next) => {
  try {
    const body = validate(schemas.lmsSyncBody, req.body || {}, 'invalid_lms_sync_request')
    const userId = getUserId(req)
    const providers = getProvidersForUser(userId)
    const result = await lmsSyncService.sync({
      userId,
      provider: body.provider,
      force: Boolean(body.force)
    })

    updateProvider(providers, body.provider, {
      connected: true,
      status: 'idle',
      errorMessage: '',
      lastSyncAt: new Date().toISOString(),
      importedTasks: result.tasks.length,
      importedEvents: result.events.length,
      lastError: ''
    })

    return res.json({
      ok: true,
      provider: providers[body.provider],
      syncResult: {
        ok: true,
        imported: result.imported,
        updated: result.updated,
        removed: result.removed,
        skipped: result.skipped,
        warnings: result.warnings
      },
      tasks: result.tasks,
      events: result.events,
      conflicts: result.conflicts,
      routeDecision: { route: 'trivial', tokenUsage: 0, reason: 'manual_lms_sync' },
      scheduler: { reoptimizeTriggered: true }
    })
  } catch (error) {
    observability.logError('connectivity.lms.sync.failed', req, error)
    next(error)
  }
})

app.get('/api/connectivity/lms/status', authGuard, async (req, res, next) => {
  try {
    const query = validate(schemas.lmsStatusQuery, req.query || {}, 'invalid_lms_status_query')
    const userId = getUserId(req)
    const status = lmsSyncService.getStatus(userId)
    if (query.provider) {
      return res.json({ ok: true, provider: status[query.provider] })
    }
    return res.json({ ok: true, providers: status })
  } catch (error) {
    observability.logError('connectivity.lms.status.failed', req, error)
    next(error)
  }
})

app.delete('/api/connectivity/lms/connect', authGuard, async (req, res, next) => {
  try {
    const body = validate(schemas.lmsSyncBody, req.body || {}, 'invalid_lms_disconnect_request')
    const userId = getUserId(req)
    const providers = getProvidersForUser(userId)
    const result = lmsSyncService.disconnect({ userId, provider: body.provider })
    updateProvider(providers, body.provider, {
      connected: false,
      status: 'idle',
      errorMessage: '',
      lastSyncAt: null,
      mode: 'ics_link',
      sourceUrl: '',
      courseHint: '',
      importedTasks: 0,
      importedEvents: 0,
      lastError: ''
    })
    return res.json({ ok: true, provider: { ...providers[body.provider], ...result.provider } })
  } catch (error) {
    observability.logError('connectivity.lms.disconnect.failed', req, error)
    next(error)
  }
})

if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/session', (req, res) => {
    const authStateCode = getAuthStateCode(req)
    res.json({
      ok: true,
      authenticated: authStateCode === 'authenticated',
      authStateCode,
      reasonCode: getAuthReasonCode(req),
      hasSession: Boolean(req.session),
      hasUser: Boolean(req.session?.user?.sub),
      user: req.session?.user || null,
      hasPendingAuthFlow: Boolean(req.session?.authFlow),
      hasPendingGoogleConnect: Boolean(req.session?.googleConnect)
    })
  })
}

app.get('/api/ops/metrics', authGuard, (_req, res) => {
  const configuredKey = String(config.ops?.metricsKey || '')
  if (!configuredKey) {
    return res.status(404).json({
      ok: false,
      reasonCode: 'ops_metrics_disabled',
      error: 'Ops metrics endpoint is disabled.'
    })
  }

  const headerKey = String(_req.get('x-ops-key') || '').trim()
  const expected = Buffer.from(configuredKey)
  const provided = Buffer.from(headerKey)
  const authorized =
    provided.length === expected.length && crypto.timingSafeEqual(provided, expected)

  if (!authorized) {
    observability.incrementCounter('ops_metrics_access_denied_total', { reasonCode: 'invalid_ops_key' })
    return res.status(403).json({
      ok: false,
      reasonCode: 'invalid_ops_key',
      error: 'Ops metrics access denied.'
    })
  }

  res.json({
    ok: true,
    counters: observability.metricsSnapshot()
  })
})

app.post('/api/connectivity/:provider/connect', authGuard, async (req, res, next) => {
  try {
    validate(schemas.providerParam, req.params, 'invalid_provider')
    const body = validate(schemas.connectProviderBody, req.body || {}, 'invalid_connect_request')
    const resolved = providerOr404(req, res)
    if (!resolved) return

    const { provider, key, providers } = resolved
    const institutionDomain = String(body.institutionDomain || '').trim()
    const returnTo = resolveReturnTo(
      req.get('x-return-to') || body.returnTo,
      `${config.frontendOrigin}/settings`
    )

    if (provider.provider === 'blackboard' && !institutionDomain) {
      throw new HttpError('Institution domain required for Blackboard.', 400, {
        reasonCode: 'institution_domain_required'
      })
    }

    if (key === 'googleCalendar') {
      if (isDemoUser(req)) {
        updateProvider(providers, key, {
          connected: true,
          status: 'idle',
          errorMessage: '',
          lastSyncAt: new Date().toISOString()
        })
        return res.json({
          provider: providers.googleCalendar,
          redirectUrl: withQuery(returnTo, {
            provider: 'google_calendar',
            status: 'connected',
            reason: 'demo_mode'
          })
        })
      }

      if (!googleOAuth.isConfigured()) {
        observability.incrementCounter('connectivity_connect_failed_total', {
          provider: 'googleCalendar',
          reasonCode: 'misconfigured'
        })
        throw new HttpError(
          'Google Calendar integration is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
          501,
          { reasonCode: 'misconfigured' }
        )
      }

      const state = crypto.randomUUID()
      const redirectUri = `${config.serverBaseUrl}/api/oauth/google_calendar/callback`
      req.session.googleConnect = { state, redirectUri, returnTo, createdAt: Date.now(), direct: true }
      await saveSession(req)
      logAudit('connectivity.google.connect.started', { req, userId: getUserId(req), strategy: 'google_direct' })
      return res.json({ provider: providers.googleCalendar, redirectUrl: googleOAuth.buildAuthUrl(redirectUri, state) })
    }

    updateProvider(providers, key, {
      connected: true,
      status: 'idle',
      errorMessage: '',
      lastSyncAt: new Date().toISOString(),
      institutionDomain: institutionDomain || provider.institutionDomain || ''
    })

    logAudit('connectivity.provider.connected', {
      req,
      userId: getUserId(req),
      provider: key
    })

    res.json({ provider: providers[key] })
  } catch (error) {
    observability.logError('connectivity.provider.connect.failed', req, error)
    next(error)
  }
})

app.get('/api/oauth/google_calendar/callback', async (req, res, next) => {
  try {
    validate(schemas.googleCallbackQuery, req.query, 'invalid_google_callback_query')
    const userId = getUserId(req)
    const pending = req.session.googleConnect
    const connectReturnTo = resolveReturnTo(pending?.returnTo, `${config.frontendOrigin}/settings`)

    if (!userId) {
      observability.incrementCounter('connectivity_google_callback_failed_total', { reasonCode: 'auth_required' })
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'auth_required' })
      )
    }

    const providers = getProvidersForUser(userId)

    if (isDemoUser(req)) {
      updateProvider(providers, 'googleCalendar', {
        connected: true, status: 'idle', errorMessage: '', lastSyncAt: new Date().toISOString()
      })
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'connected', reason: 'demo_mode' })
      )
    }

    const callbackError = String(req.query.error || '')
    if (callbackError) {
      updateProvider(providers, 'googleCalendar', {
        connected: false, status: 'error', errorMessage: String(req.query.error_description || callbackError)
      })
      delete req.session.googleConnect
      await saveSession(req)
      observability.incrementCounter('connectivity_google_callback_failed_total', { reasonCode: 'google_provider_error' })
      logAudit('connectivity.google.connect.failed', {
        req,
        userId,
        reasonCode: 'google_provider_error',
        message: callbackError
      })
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'google_provider_error' })
      )
    }

    if (!pending?.state) {
      observability.incrementCounter('connectivity_google_callback_failed_total', { reasonCode: 'missing_pending_state' })
      logAudit('connectivity.google.connect.failed', { req, userId, reasonCode: 'missing_pending_state' })
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'missing_pending_state' })
      )
    }

    if (!isPendingFlowFresh(pending)) {
      delete req.session.googleConnect
      await saveSession(req)
      observability.incrementCounter('connectivity_google_callback_failed_total', { reasonCode: 'expired_auth_state' })
      logAudit('connectivity.google.connect.failed', { req, userId, reasonCode: 'expired_auth_state' })
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'expired_auth_state' })
      )
    }

    const state = String(req.query.state || '')
    if (state !== pending.state) {
      delete req.session.googleConnect
      await saveSession(req)
      observability.incrementCounter('connectivity_google_callback_failed_total', { reasonCode: 'state_mismatch' })
      logAudit('connectivity.google.connect.failed', { req, userId, reasonCode: 'state_mismatch' })
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'state_mismatch' })
      )
    }

    const code = String(req.query.code || '')
    if (!code) {
      delete req.session.googleConnect
      await saveSession(req)
      observability.incrementCounter('connectivity_google_callback_failed_total', { reasonCode: 'code_missing' })
      logAudit('connectivity.google.connect.failed', { req, userId, reasonCode: 'code_missing' })
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'code_missing' })
      )
    }

    let connected = false

    if (pending?.direct && googleOAuth.isConfigured()) {
      const tokens = await googleOAuth.exchangeCode(code, pending.redirectUri)
      googleOAuth.saveGoogleTokens(req.session, tokens)
      connected = true
    } else {
      observability.incrementCounter('connectivity_google_callback_failed_total', { reasonCode: 'invalid_direct_oauth_state' })
      logAudit('connectivity.google.connect.failed', { req, userId, reasonCode: 'invalid_direct_oauth_state' })
    }

    updateProvider(providers, 'googleCalendar', {
      connected, status: 'idle',
      errorMessage: connected ? '' : 'Connection could not be completed.',
      lastSyncAt: connected ? new Date().toISOString() : providers.googleCalendar.lastSyncAt
    })

    delete req.session.googleConnect
    await saveSession(req)

    const status = connected ? 'connected' : 'failed'
    const reason = connected ? 'connected' : 'incomplete'
    logAudit('connectivity.google.connect.completed', { req, userId, connected })
    res.redirect(withQuery(connectReturnTo, { provider: 'google_calendar', status, reason }))
  } catch (error) {
    const pending = req.session?.googleConnect
    const connectReturnTo = String(pending?.returnTo || `${config.frontendOrigin}/settings`)
    observability.logError('connectivity.google.callback.failed', req, error)
    logAudit('connectivity.google.connect.failed', {
      req,
      userId: getUserId(req),
      reasonCode: 'connect_callback_failed',
      message: error?.message || 'unknown'
    })
    res.redirect(
      withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'connect_callback_failed' })
    )
  }
})

app.post('/api/connectivity/:provider/disconnect', authGuard, async (req, res, next) => {
  try {
    validate(schemas.providerParam, req.params, 'invalid_provider')
    const resolved = providerOr404(req, res)
    if (!resolved) return

    const { key, providers } = resolved
    const userId = getUserId(req)

    if (key === 'googleCalendar') {
      googleOAuth.clearGoogleTokens(req.session)
      await saveSession(req)
    }

    updateProvider(providers, key, {
      connected: false,
      status: 'idle',
      errorMessage: '',
      lastSyncAt: null
    })

    logAudit('connectivity.provider.disconnected', {
      req,
      userId,
      provider: key
    })

    res.json({ provider: providers[key] })
  } catch (error) {
    observability.logError('connectivity.provider.disconnect.failed', req, error)
    next(error)
  }
})

app.post('/api/connectivity/:provider/sync', authGuard, async (req, res, next) => {
  try {
    validate(schemas.providerParam, req.params, 'invalid_provider')
    const resolved = providerOr404(req, res)
    if (!resolved) return

    const { key, providers } = resolved
    const userId = getUserId(req)

    if (!providers[key].connected) {
      throw new HttpError('Provider is not connected.', 400, { reasonCode: 'connect_provider_required' })
    }

    if (key === 'googleCalendar') {
      const events = isDemoUser(req)
        ? getDemoEvents(userId)
        : await (async () => {
            const googleToken = await getGoogleAccessTokenForUser(req)
            return calendarService.listUpcomingEvents(googleToken, {
              timeMin: new Date().toISOString(),
              maxResults: 10
            })
          })()

      updateProvider(providers, key, {
        status: 'idle',
        errorMessage: '',
        lastSyncAt: new Date().toISOString()
      })

      logAudit('connectivity.google.sync.success', {
        req,
        userId,
        events: events.length
      })

      return res.json({
        provider: providers[key],
        syncSummary: {
          eventsFetched: events.length
        }
      })
    }

    updateProvider(providers, key, {
      status: 'idle',
      errorMessage: '',
      lastSyncAt: new Date().toISOString()
    })

    logAudit('connectivity.provider.sync.success', {
      req,
      userId,
      provider: key
    })

    res.json({ provider: providers[key] })
  } catch (error) {
    observability.logError('connectivity.provider.sync.failed', req, error)
    next(error)
  }
})

app.get('/api/donna/calendar/context', authGuard, async (req, res, next) => {
  try {
    const userId = getUserId(req)
    if (!isGoogleCalendarConnected(req)) {
      throw new HttpError('Provider is not connected.', 400, { reasonCode: 'connect_provider_required' })
    }
    const events = isDemoUser(req)
      ? getDemoEvents(userId)
      : await (async () => {
          const googleToken = await getGoogleAccessTokenForUser(req)
          return calendarService.listUpcomingEvents(googleToken, {
            timeMin: new Date().toISOString(),
            maxResults: 25
          })
        })()

    if (userId) {
      const providers = getProvidersForUser(userId)
      updateProvider(providers, 'googleCalendar', {
        connected: true, status: 'idle', errorMessage: '', lastSyncAt: new Date().toISOString()
      })
    }

    res.json({
      events,
      context: toCalendarContext(events)
    })
  } catch (error) {
    observability.logError('donna.calendar.context.failed', req, error)
    next(error)
  }
})

app.get('/api/donna/planner/usage', authGuard, async (req, res) => {
  try {
    const usage = await getPlannerUsageSnapshot(req)
    const eligibility = plannerEligibility(req)
    res.json({
      ok: true,
      eligibility,
      limits: usage?.limits || {
        ipHourlyRequests: config.limits.freeIpHourlyLimit,
        userDailyMessages: config.limits.freeUserDailyMessages,
        userWeeklyTokens: config.limits.freeUserWeeklyTokens
      },
      usage: usage?.usage || {
        ipHourlyRequests: 0,
        userDailyMessages: 0,
        userWeeklyTokens: 0
      },
      remaining: usage?.remaining || {
        ipHourlyRequests: config.limits.freeIpHourlyLimit,
        userDailyMessages: config.limits.freeUserDailyMessages,
        userWeeklyTokens: config.limits.freeUserWeeklyTokens
      },
      resetsAt: usage?.resetsAt || {
        ipHourly: null,
        userDailyMessages: null,
        userWeeklyTokens: null
      }
    })
  } catch (error) {
    observability.logError('donna.planner.usage.failed', req, error)
    res.status(503).json({ ok: false, reasonCode: 'usage_unavailable' })
  }
})

app.post('/api/donna/planner', authGuard, async (req, res) => {
  const validated = validate(schemas.plannerBody, req.body || {}, 'invalid_planner_request')
  const route = validated.route === 'strong' ? 'strong' : 'small'
  const source = String(validated.source || 'chat')
  const providerMode = validated.providerMode === 'local_ollama' ? 'local_ollama' : 'groq'
  const localModel = String(validated.localModel || '').trim()
  const requestPayload = validated.request && typeof validated.request === 'object' ? validated.request : req.body || {}
  const byokKey = String(validated.apiKey || req.get('x-user-api-key') || '').trim()
  const userId = getUserId(req)
  const ipHash = hashIp(getClientIp(req))
  const usageBefore = await getPlannerUsageSnapshot(req)
  const eligibility = plannerEligibility(req)

  const deny = (status, reasonCode, message, byokRequired = true) => {
    observability.incrementCounter('donna_planner_denied_total', { reasonCode })
    return res.status(status).json({
      ok: false,
      reasonCode,
      message,
      byokRequired,
      usage: usageBefore,
      eligibility
    })
  }

  const ensureGroqAllowed = () => {
    const useFreeTier = !byokKey
    if (!useFreeTier) return null
    if (!eligibility.freeTierEligible) {
      return deny(
        403,
        'byok_required',
        'Free cloud responses are available for Google sign-in or demo mode. Add your API key to continue.',
        true
      )
    }
    if (!eligibility.serverGroqConfigured) {
      return deny(
        503,
        'byok_required',
        'Server cloud key is not configured. Add your API key to continue.',
        true
      )
    }
    if (usageBefore.usage.ipHourlyRequests >= usageBefore.limits.ipHourlyRequests) {
      observability.incrementCounter('donna_quota_exceeded_total', { reasonCode: 'quota_exceeded_hourly_ip' })
      return deny(
        429,
        'quota_exceeded_hourly_ip',
        'Hourly free limit reached for this network. Add your API key or try again later.',
        true
      )
    }
    if (usageBefore.usage.userDailyMessages >= usageBefore.limits.userDailyMessages) {
      observability.incrementCounter('donna_quota_exceeded_total', { reasonCode: 'quota_exceeded_daily_user' })
      return deny(
        429,
        'quota_exceeded_daily_user',
        'Daily free message limit reached. Add your API key to continue.',
        true
      )
    }
    if (usageBefore.usage.userWeeklyTokens >= usageBefore.limits.userWeeklyTokens) {
      observability.incrementCounter('donna_quota_exceeded_total', { reasonCode: 'quota_exceeded_weekly_tokens' })
      return deny(
        429,
        'quota_exceeded_weekly_tokens',
        'Weekly free token limit reached. Add your API key to continue.',
        true
      )
    }
    return null
  }

  try {
    let plannerResult = null
    let providerUsed = 'groq'
    let fallback = false
    let fallbackReason = ''
    let billingMode = 'free'
    let usage = usageBefore

    if (providerMode === 'local_ollama') {
      try {
        plannerResult = await ollamaService.plan({
          request: requestPayload,
          route,
          source,
          localModel
        })
        providerUsed = 'local_ollama'
        billingMode = 'local'
        observability.incrementCounter('donna_local_provider_success_total', { provider: 'local_ollama' })
      } catch (error) {
        fallback = true
        fallbackReason = 'local_ollama_unavailable'
        observability.incrementCounter('donna_local_provider_fallback_total', { reasonCode: fallbackReason })
      }
    }

    if (!plannerResult) {
      const denyResponse = ensureGroqAllowed()
      if (denyResponse) return denyResponse

      plannerResult = await groqService.plan({
        apiKeyOverride: byokKey,
        request: requestPayload,
        route,
        source
      })
      providerUsed = 'groq'
      const useFreeTier = !byokKey
      billingMode = useFreeTier ? 'free' : 'byok'
      if (useFreeTier) {
        await usageLimitStore.recordFreeUsage({
          userId,
          ipHash,
          tokens: Number(plannerResult?.usage?.totalTokens || 0)
        })
        usage = await getPlannerUsageSnapshot(req)
      }
    }

    return res.json({
      ok: true,
      ...plannerResult,
      usage,
      eligibility,
      billingMode,
      providerUsed,
      fallback,
      fallbackReason: fallback ? fallbackReason : undefined
    })
  } catch (error) {
    const reasonCode = String(error?.details?.reasonCode || 'provider_error')
    const status = Number(error?.status || 502)
    observability.incrementCounter('donna_planner_error_total', { reasonCode })
    observability.logError('donna.planner.failed', req, error, { reasonCode })
    return res.status(status >= 400 && status < 600 ? status : 502).json({
      ok: false,
      reasonCode,
      message: String(error?.message || 'Cloud planner request failed.'),
      byokRequired: reasonCode === 'byok_required' || useFreeTier,
      usage: await getPlannerUsageSnapshot(req),
      eligibility
    })
  }
})

app.post('/api/donna/actions/propose-study-block', authGuard, async (req, res, next) => {
  try {
    const body = validate(schemas.proposeStudyBlockBody, req.body || {}, 'invalid_study_block_request')
    const title = String(body.title || 'Study Block').trim() || 'Study Block'
    const start = toIsoOrNull(body.start)
    const durationMinutes = Math.max(15, Math.min(300, Number(body.durationMinutes || 60)))
    const end = toIsoOrNull(body.end) || (start ? addMinutesToIso(start, durationMinutes) : null)

    if (!start || !end) {
      throw new HttpError('Valid start/end datetime is required.', 400, {
        reasonCode: 'invalid_datetime_range'
      })
    }

    if (new Date(end).getTime() <= new Date(start).getTime()) {
      throw new HttpError('end must be after start.', 400, {
        reasonCode: 'invalid_datetime_range'
      })
    }

    const payload = {
      title,
      start,
      end,
      description:
        String(body.description || '').trim() ||
        `Donna study block: ${title}. Focus session scheduled by Donna.`,
      source: String(body.source || 'donna').trim(),
      metadata: {
        createdBy: 'donna',
        createdAt: new Date().toISOString(),
        ...((body.metadata && typeof body.metadata === 'object') ? body.metadata : {})
      }
    }

    const action = await actionStore.createProposedAction(getUserId(req), 'create_study_block', payload)

    logAudit('donna.action.proposed', {
      req,
      userId: getUserId(req),
      actionId: action.id,
      type: action.type
    })

    res.status(201).json({ action })
  } catch (error) {
    observability.logError('donna.action.propose.failed', req, error)
    next(error)
  }
})

app.get('/api/donna/actions', authGuard, async (req, res) => {
  const actions = await actionStore.listByUser(getUserId(req))
  res.json({ actions })
})

app.post('/api/donna/actions/:id/approve', authGuard, async (req, res, next) => {
  try {
    validate(schemas.approveActionParam, req.params, 'invalid_action_id')
    const action = await actionStore.getById(req.params.id)
    const userId = getUserId(req)
    if (!isGoogleCalendarConnected(req)) {
      throw new HttpError('Provider is not connected.', 400, { reasonCode: 'connect_provider_required' })
    }

    if (!action || action.userId !== userId) {
      throw new HttpError('Action not found.', 404, { reasonCode: 'action_not_found' })
    }

    if (action.status !== 'proposed') {
      throw new HttpError(`Action cannot be approved from status '${action.status}'.`, 409, {
        reasonCode: 'invalid_action_state'
      })
    }

    await actionStore.markApproved(action.id)

    try {
      let createdEvent
      if (isDemoUser(req)) {
        createdEvent = {
          id: `demo-created-${Date.now()}`,
          htmlLink: '',
          start: { dateTime: action.payload.start },
          end: { dateTime: action.payload.end }
        }
        const events = getDemoEvents(userId)
        events.push({
          id: createdEvent.id,
          summary: action.payload.title,
          description: action.payload.description,
          htmlLink: '',
          status: 'confirmed',
          created: new Date().toISOString(),
          updated: new Date().toISOString(),
          start: createdEvent.start,
          end: createdEvent.end
        })
      } else {
        const googleToken = await getGoogleAccessTokenForUser(req)
        const descriptionParts = [
          action.payload.description,
          '',
          `Donna metadata: source=${action.payload.source || 'donna'} action_id=${action.id}`
        ]
        createdEvent = await calendarService.createEvent(googleToken, {
          title: action.payload.title,
          start: action.payload.start,
          end: action.payload.end,
          description: descriptionParts.filter(Boolean).join('\n'),
          source: action.payload.source || 'donna',
          actionId: action.id
        })
      }

      const executed = await actionStore.markExecuted(action.id, {
        googleEventId: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
        start: createdEvent.start,
        end: createdEvent.end
      })

      logAudit('donna.action.executed', {
        req,
        userId,
        actionId: action.id,
        googleEventId: createdEvent.id
      })

      const providers = getProvidersForUser(userId)
      updateProvider(providers, 'googleCalendar', {
        connected: true,
        status: 'idle',
        errorMessage: '',
        lastSyncAt: new Date().toISOString()
      })

      return res.json({ action: executed })
    } catch (executeError) {
      const failed = await actionStore.markFailed(
        action.id,
        executeError,
        'Approved action failed during Google Calendar execution.'
      )

      observability.incrementCounter('donna_action_execution_failed_total', { reasonCode: 'execution_failed' })
      logAudit('donna.action.failed', {
        req,
        userId,
        actionId: action.id,
        reason: executeError?.message || 'unknown'
      })

      return res.status(502).json({
        action: failed,
        reason: 'execution_failed',
        reasonCode: 'execution_failed',
        error: failed?.error || 'Calendar execution failed.'
      })
    }
  } catch (error) {
    observability.logError('donna.action.approve.failed', req, error)
    next(error)
  }
})

app.use((error, req, res, _next) => {
  observability.logError('http.unhandled', req, error)
  const normalized = toErrorResponse(error)
  res.status(normalized.status).json(normalized.body)
})

const LMS_BACKGROUND_SYNC_MS = 30 * 60 * 1000
setInterval(async () => {
  const connected = lmsSyncService.listConnected()
  if (!connected.length) return
  for (const row of connected) {
    try {
      const result = await lmsSyncService.sync({
        userId: row.userId,
        provider: row.provider,
        force: false
      })
      const providers = getProvidersForUser(row.userId)
      updateProvider(providers, row.provider, {
        connected: true,
        status: 'idle',
        errorMessage: '',
        lastSyncAt: new Date().toISOString(),
        importedTasks: result.tasks.length,
        importedEvents: result.events.length,
        lastError: ''
      })
    } catch (error) {
      const providers = getProvidersForUser(row.userId)
      updateProvider(providers, row.provider, {
        status: 'error',
        errorMessage: String(error?.code || error?.message || 'sync_failed'),
        lastError: String(error?.code || error?.message || 'sync_failed')
      })
    }
  }
}, LMS_BACKGROUND_SYNC_MS)

export { app, config, observability }
