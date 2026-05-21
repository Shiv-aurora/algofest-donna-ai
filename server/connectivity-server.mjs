import crypto from 'node:crypto'
import cors from 'cors'
import express from 'express'

import { createActionStore } from './actions/action-store.mjs'
import { requireAuth } from './auth/middleware.mjs'
import { createSessionMiddleware } from './auth/session.mjs'
import { createGoogleCalendarService } from './google/google-calendar-service.mjs'
import { createGoogleOAuthService } from './google/google-oauth-service.mjs'
import { loadEnv } from './lib/env.mjs'
import { HttpError, toErrorResponse } from './lib/http.mjs'

const config = loadEnv()
const app = express()

const googleOAuth = createGoogleOAuthService(config)
const calendarService = createGoogleCalendarService()
const actionStore = createActionStore(config.files.actionStoreFile)
const authGuard = requireAuth(config)

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || origin === config.frontendOrigin) return callback(null, true)
      return callback(new Error(`Origin ${origin} is not allowed by CORS`), false)
    },
    credentials: true
  })
)
app.use(express.json())
app.use(createSessionMiddleware(config))

const providerStore = new Map()
const demoCalendarEventStore = new Map()
const LOCAL_USER = {
  sub: 'local|student',
  email: 'local@donna.app',
  name: 'Donna Local User',
  picture: ''
}

function createDefaultProviders() {
  const demoConnected = Boolean(config.demoMode)
  return {
    canvas: {
      provider: 'canvas',
      connected: false,
      lastSyncAt: null,
      status: 'idle',
      errorMessage: '',
      institutionDomain: ''
    },
    blackboard: {
      provider: 'blackboard',
      connected: false,
      lastSyncAt: null,
      status: 'idle',
      errorMessage: '',
      institutionDomain: ''
    },
    googleCalendar: {
      provider: 'googleCalendar',
      connected: demoConnected,
      lastSyncAt: demoConnected ? new Date().toISOString() : null,
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

function ensureLocalUser(req) {
  if (!req.session?.user?.sub) {
    req.session.user = { ...LOCAL_USER }
  }
}

function getAuthStateCode(req) {
  ensureLocalUser(req)
  if (req.session?.user?.sub) return 'authenticated'
  return 'unauthenticated'
}

function getAuthReasonCode(req) {
  const state = getAuthStateCode(req)
  if (state === 'authenticated') return 'local_session'
  return 'auth_required'
}

function getAuthLoginUrl(req) {
  const returnTo = pickQueryString(req.query.returnTo, '')
  if (!returnTo) return `${config.serverBaseUrl}/api/auth/login`
  return `${config.serverBaseUrl}/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`
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

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
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

function logAudit(event, details = {}) {
  const payload = {
    event,
    at: new Date().toISOString(),
    ...details
  }
  console.log('[AUDIT]', JSON.stringify(payload))
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
  ensureLocalUser(req)

  if (googleOAuth.isGoogleConnected(req.session)) {
    return googleOAuth.getValidAccessToken(req.session)
  }

  throw new HttpError(
    'Google Calendar not connected. Please connect in Settings.',
    400,
    { reason: 'connect_provider_required' }
  )
}

function isGoogleCalendarConnected(req) {
  if (config.demoMode) return true
  return googleOAuth.isGoogleConnected(req.session)
}

app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/auth/login', (req, res, next) => {
  try {
    ensureLocalUser(req)
    const returnTo = pickQueryString(req.query.returnTo, `${config.frontendOrigin}/dashboard`)
    res.redirect(withQuery(returnTo, { auth: 'local' }))
  } catch (error) {
    next(error)
  }
})

app.get('/api/auth/callback', (req, res) => {
  const requestedReturnTo = pickQueryString(req.query.returnTo, `${config.frontendOrigin}/dashboard`)
  res.redirect(
    withQuery(requestedReturnTo, {
      auth: 'failed',
      reason: 'auth_disabled',
      message: 'External auth is disabled. Use direct Google connect from Settings.'
    })
  )
})

app.get('/api/auth/me', (req, res) => {
  ensureLocalUser(req)
  const authStateCode = getAuthStateCode(req)
  const authenticated = authStateCode === 'authenticated'
  res.json({
    authenticated,
    user: authenticated ? req.session?.user || null : null,
    loginUrl: getAuthLoginUrl(req),
    logoutUrl: '/api/auth/logout',
    authStateCode,
    reasonCode: getAuthReasonCode(req)
  })
})

app.post('/api/auth/logout', (req, res, next) => {
  try {
    const returnTo = String(req.body?.returnTo || `${config.frontendOrigin}/dashboard`)
    googleOAuth.clearGoogleTokens(req.session)
    delete req.session.user
    req.session.destroy((error) => {
      if (error) return next(error)
      res.json({ ok: true, logoutUrl: returnTo, authStateCode: 'unauthenticated', reasonCode: 'logged_out' })
    })
  } catch (error) {
    next(error)
  }
})

app.get('/api/connectivity/providers', async (req, res, next) => {
  try {
    ensureLocalUser(req)
    const userId = getUserId(req)
    const providers = getProvidersForUser(userId)
    const authStateCode = getAuthStateCode(req)
    const authenticated = authStateCode === 'authenticated'

    if (authenticated && userId && !config.demoMode) {
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
        loginUrl: '/api/auth/login',
        authStateCode,
        reasonCode: getAuthReasonCode(req)
      }
    })
  } catch (error) {
    next(error)
  }
})

if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/session', (req, res) => {
    ensureLocalUser(req)
    const authStateCode = getAuthStateCode(req)
    res.json({
      ok: true,
      demoMode: config.demoMode,
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

app.post('/api/connectivity/:provider/connect', authGuard, async (req, res, next) => {
  try {
    ensureLocalUser(req)
    const resolved = providerOr404(req, res)
    if (!resolved) return

    const { provider, key, providers } = resolved
    const institutionDomain = String(req.body?.institutionDomain || '').trim()
    const returnTo = String(req.get('x-return-to') || req.body?.returnTo || `${config.frontendOrigin}/settings`)

    if (provider.provider === 'blackboard' && !institutionDomain) {
      throw new HttpError('Institution domain required for Blackboard.', 400)
    }

    if (key === 'googleCalendar') {
      if (config.demoMode) {
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
        throw new HttpError(
          'Google Calendar integration is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
          501,
          { reason: 'misconfigured' }
        )
      }

      const state = crypto.randomUUID()
      const redirectUri = `${config.serverBaseUrl}/api/oauth/google_calendar/callback`
      req.session.googleConnect = { state, redirectUri, returnTo, createdAt: Date.now(), direct: true }
      await saveSession(req)
      logAudit('connectivity.google.connect.started', { userId: getUserId(req), strategy: 'google_direct' })
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
      userId: getUserId(req),
      provider: key
    })

    res.json({ provider: providers[key] })
  } catch (error) {
    next(error)
  }
})

app.get('/api/oauth/google_calendar/callback', async (req, res, next) => {
  try {
    ensureLocalUser(req)
    const userId = getUserId(req)
    const pending = req.session.googleConnect
    const connectReturnTo = String(pending?.returnTo || `${config.frontendOrigin}/settings`)

    if (!userId) {
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'auth_required' })
      )
    }

    const providers = getProvidersForUser(userId)

    if (config.demoMode) {
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
      logAudit('connectivity.google.connect.failed', { userId, reasonCode: 'google_provider_error', message: callbackError })
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'google_provider_error' })
      )
    }

    if (!pending?.state) {
      logAudit('connectivity.google.connect.failed', { userId, reasonCode: 'missing_pending_state' })
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'missing_pending_state' })
      )
    }

    const state = String(req.query.state || '')
    if (state !== pending.state) {
      delete req.session.googleConnect
      await saveSession(req)
      logAudit('connectivity.google.connect.failed', { userId, reasonCode: 'state_mismatch' })
      return res.redirect(
        withQuery(connectReturnTo, { provider: 'google_calendar', status: 'failed', reason: 'state_mismatch' })
      )
    }

    const code = String(req.query.code || '')
    if (!code) {
      delete req.session.googleConnect
      await saveSession(req)
      logAudit('connectivity.google.connect.failed', { userId, reasonCode: 'code_missing' })
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
      logAudit('connectivity.google.connect.failed', { userId, reasonCode: 'invalid_direct_oauth_state' })
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
    logAudit('connectivity.google.connect.completed', { userId, connected })
    res.redirect(withQuery(connectReturnTo, { provider: 'google_calendar', status, reason }))
  } catch (error) {
    const pending = req.session?.googleConnect
    const connectReturnTo = String(pending?.returnTo || `${config.frontendOrigin}/settings`)
    logAudit('connectivity.google.connect.failed', {
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
      userId,
      provider: key
    })

    res.json({ provider: providers[key] })
  } catch (error) {
    next(error)
  }
})

app.post('/api/connectivity/:provider/sync', authGuard, async (req, res, next) => {
  try {
    ensureLocalUser(req)
    const resolved = providerOr404(req, res)
    if (!resolved) return

    const { key, providers } = resolved
    const userId = getUserId(req)

    if (!providers[key].connected) {
      throw new HttpError('Provider is not connected.', 400)
    }

    if (key === 'googleCalendar') {
      const events = config.demoMode
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
      userId,
      provider: key
    })

    res.json({ provider: providers[key] })
  } catch (error) {
    next(error)
  }
})

app.get('/api/donna/calendar/context', authGuard, async (req, res, next) => {
  try {
    ensureLocalUser(req)
    const userId = getUserId(req)
    if (!isGoogleCalendarConnected(req)) {
      throw new HttpError('Provider is not connected.', 400, { reason: 'connect_provider_required' })
    }
    const events = config.demoMode
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
    next(error)
  }
})

app.post('/api/donna/actions/propose-study-block', authGuard, (req, res, next) => {
  try {
    const title = String(req.body?.title || 'Study Block').trim() || 'Study Block'
    const start = toIsoOrNull(req.body?.start)
    const durationMinutes = Math.max(15, Math.min(300, Number(req.body?.durationMinutes || 60)))
    const end = toIsoOrNull(req.body?.end) || (start ? addMinutesToIso(start, durationMinutes) : null)

    if (!start || !end) {
      throw new HttpError('Valid start/end datetime is required.', 400)
    }

    if (new Date(end).getTime() <= new Date(start).getTime()) {
      throw new HttpError('end must be after start.', 400)
    }

    const payload = {
      title,
      start,
      end,
      description:
        String(req.body?.description || '').trim() ||
        `Donna study block: ${title}. Focus session scheduled by Donna.`,
      source: String(req.body?.source || 'donna').trim(),
      metadata: {
        createdBy: 'donna',
        createdAt: new Date().toISOString(),
        ...((req.body?.metadata && typeof req.body.metadata === 'object') ? req.body.metadata : {})
      }
    }

    const action = actionStore.createProposedAction(getUserId(req), 'create_study_block', payload)

    logAudit('donna.action.proposed', {
      userId: getUserId(req),
      actionId: action.id,
      type: action.type
    })

    res.status(201).json({ action })
  } catch (error) {
    next(error)
  }
})

app.get('/api/donna/actions', authGuard, (req, res) => {
  const actions = actionStore.listByUser(getUserId(req))
  res.json({ actions })
})

app.post('/api/donna/actions/:id/approve', authGuard, async (req, res, next) => {
  try {
    ensureLocalUser(req)
    const action = actionStore.getById(req.params.id)
    const userId = getUserId(req)
    if (!isGoogleCalendarConnected(req)) {
      throw new HttpError('Provider is not connected.', 400, { reason: 'connect_provider_required' })
    }

    if (!action || action.userId !== userId) {
      throw new HttpError('Action not found.', 404)
    }

    if (action.status !== 'proposed') {
      throw new HttpError(`Action cannot be approved from status '${action.status}'.`, 409)
    }

    actionStore.markApproved(action.id)

    try {
      let createdEvent
      if (config.demoMode) {
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

      const executed = actionStore.markExecuted(action.id, {
        googleEventId: createdEvent.id,
        htmlLink: createdEvent.htmlLink,
        start: createdEvent.start,
        end: createdEvent.end
      })

      logAudit('donna.action.executed', {
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
      const failed = actionStore.markFailed(
        action.id,
        executeError,
        'Approved action failed during Google Calendar execution.'
      )

      logAudit('donna.action.failed', {
        userId,
        actionId: action.id,
        reason: executeError?.message || 'unknown'
      })

      return res.status(502).json({
        action: failed,
        reason: 'execution_failed',
        error: failed?.error || 'Calendar execution failed.'
      })
    }
  } catch (error) {
    next(error)
  }
})

app.use((error, _req, res, _next) => {
  const normalized = toErrorResponse(error)
  res.status(normalized.status).json(normalized.body)
})

app.listen(config.port, () => {
  console.log(`Connectivity API listening on http://localhost:${config.port}`)
})
