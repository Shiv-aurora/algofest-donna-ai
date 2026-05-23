import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_ASPIRATIONS,
  DEFAULT_ASPIRATION_SESSIONS,
  DEFAULT_ASSIGNMENTS,
  DEFAULT_CALENDAR_EVENTS,
  DEFAULT_CHAT_MESSAGES,
  DEFAULT_CONNECTIVITY_STATUS,
  DEFAULT_DASHBOARD_STATE,
  DEFAULT_EXAMS,
  DEFAULT_EXAM_STUDY_SESSIONS,
  DEFAULT_INSIGHT_DESK,
  DEFAULT_PROFILE,
  DEFAULT_SETTINGS_STATE,
  STORAGE_KEYS,
  getModeDefaults,
  applyPlannerResult,
  buildPlannerRequest,
  chooseModelRoute,
  hydrateState,
  recomputeFocusState,
  runLocalPlanner
} from './dashboardEngine'
import {
  benchmarkMetricsV2,
  ConnectivityApiError,
  approveDonnaAction,
  connectLmsApi,
  connectProviderApi,
  disconnectLmsApi,
  disconnectProviderApi,
  feasibilityPlanV2,
  fetchProviders,
  getAuthMe,
  getDonnaCalendarContext,
  getDonnaPlannerUsage,
  listDonnaActions,
  logWorkEventV2,
  logoutAuth,
  notifyDecisionV2,
  proposeStudyBlock,
  runDonnaPlannerApi,
  solvePlanV2,
  syncLmsApi,
  syncProviderApi
} from './connectivityApi'

const DashboardContext = createContext(null)

function uid(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
}

function shallowClone(value, fallback) {
  if (!value || typeof value !== 'object') return fallback
  return { ...fallback, ...value }
}

function normalizeSettings(value) {
  const merged = shallowClone(value, DEFAULT_SETTINGS_STATE)
  return {
    ...merged,
    alerts: { ...DEFAULT_SETTINGS_STATE.alerts, ...(value?.alerts || {}) },
    aiPersonalization: {
      ...DEFAULT_SETTINGS_STATE.aiPersonalization,
      ...(value?.aiPersonalization || {})
    },
    contextualLayers: {
      ...DEFAULT_SETTINGS_STATE.contextualLayers,
      ...(value?.contextualLayers || {})
    }
  }
}

function normalizeConnectivity(value) {
  const merged = shallowClone(value, DEFAULT_CONNECTIVITY_STATUS)
  return {
    ...merged,
    canvas: { ...DEFAULT_CONNECTIVITY_STATUS.canvas, ...(value?.canvas || {}) },
    blackboard: { ...DEFAULT_CONNECTIVITY_STATUS.blackboard, ...(value?.blackboard || {}) },
    googleCalendar: {
      ...DEFAULT_CONNECTIVITY_STATUS.googleCalendar,
      ...(value?.googleCalendar || {})
    }
  }
}

function isSameDay(tsA, tsB) {
  const a = new Date(tsA)
  const b = new Date(tsB)
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function normalizeAspiration(item, index = 0) {
  const fallback = DEFAULT_ASPIRATIONS[index]
  const raw = item && typeof item === 'object' ? item : {}
  const progress = Number(raw.progress)

  return {
    id: String(raw.id || fallback?.id || uid('asp')),
    title: String(raw.title || fallback?.title || `Aspiration ${index + 1}`),
    subtext: String(raw.subtext || fallback?.subtext || ''),
    status: String(raw.status || 'active'),
    progress: Number.isFinite(progress) ? Math.max(0, Math.min(100, Math.round(progress))) : 0,
    targetLabel: String(raw.targetLabel || fallback?.targetLabel || 'No target date set'),
    createdAt: Number(raw.createdAt || fallback?.createdAt || Date.now()),
    startedAt: Number(raw.startedAt || fallback?.startedAt || Date.now()),
    lastWorkedAt: raw.lastWorkedAt || fallback?.lastWorkedAt || null,
    workSessionCount: Number(raw.workSessionCount || fallback?.workSessionCount || 0),
    completedAt: raw.completedAt || null
  }
}

function normalizeCalendarEvent(item, index = 0) {
  const fallback = DEFAULT_CALENDAR_EVENTS[index]
  const raw = item && typeof item === 'object' ? item : {}

  return {
    id: String(raw.id || fallback?.id || uid('ev')),
    title: String(raw.title || fallback?.title || 'Study Block'),
    date: String(raw.date || fallback?.date || ''),
    startTime: String(raw.startTime || fallback?.startTime || '09:00'),
    endTime: String(raw.endTime || fallback?.endTime || '10:00'),
    kind: String(raw.kind || fallback?.kind || 'class'),
    source: String(raw.source || 'manual'),
    source_of_truth: String(raw.source_of_truth || ''),
    subtype: String(raw.subtype || ''),
    fingerprint: String(raw.fingerprint || '')
  }
}

function normalizeAssignment(item, index = 0) {
  const fallback = DEFAULT_ASSIGNMENTS[index]
  const raw = item && typeof item === 'object' ? item : {}
  const estimated = Number(raw.estimatedHours)

  return {
    id: String(raw.id || fallback?.id || uid('as')),
    title: String(raw.title || fallback?.title || 'Assignment'),
    course: String(raw.course || fallback?.course || 'Course'),
    dueAt: String(raw.dueAt || fallback?.dueAt || new Date().toISOString()),
    estimatedHours: Number.isFinite(estimated) ? estimated : Number(fallback?.estimatedHours || 1),
    priority: String(raw.priority || fallback?.priority || 'Medium'),
    source: String(raw.source || 'manual'),
    source_of_truth: String(raw.source_of_truth || ''),
    subtype: String(raw.subtype || ''),
    fingerprint: String(raw.fingerprint || '')
  }
}

function normalizeExam(item, index = 0) {
  const fallback = DEFAULT_EXAMS[index]
  const raw = item && typeof item === 'object' ? item : {}
  const previousEffortHours = Number(raw.previousEffortHours)

  return {
    id: String(raw.id || fallback?.id || uid('ex')),
    title: String(raw.title || fallback?.title || 'Upcoming Exam'),
    course: String(raw.course || fallback?.course || 'Course'),
    date: String(raw.date || fallback?.date || new Date().toISOString()),
    type: String(raw.type || fallback?.type || 'Exam'),
    previousEffortHours: Number.isFinite(previousEffortHours)
      ? previousEffortHours
      : Number(fallback?.previousEffortHours || 0)
  }
}

function normalizeSession(item, index = 0, prefix = 'session') {
  const raw = item && typeof item === 'object' ? item : {}

  return {
    id: String(raw.id || uid(`${prefix}-${index}`)),
    aspirationId: raw.aspirationId ? String(raw.aspirationId) : undefined,
    examId: raw.examId ? String(raw.examId) : undefined,
    minutes: Math.max(1, Number(raw.minutes || 25)),
    note: String(raw.note || ''),
    createdAt: Number(raw.createdAt || Date.now())
  }
}

function aspirationProgressDelta(currentProgress, minutes) {
  const current = Math.max(0, Math.min(95, Number(currentProgress || 0)))
  const effortScale = Math.max(0.4, Math.min(2, Number(minutes || 25) / 30))
  const easing = Math.max(0.08, 1 - current / 105)
  return Math.max(1, Math.round(9 * effortScale * easing))
}

function toIsoOrNull(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function addMinutes(isoString, minutes) {
  const date = new Date(isoString)
  if (Number.isNaN(date.getTime())) return null
  date.setMinutes(date.getMinutes() + minutes)
  return date.toISOString()
}

function normalizeDonnaAction(item, index = 0) {
  const raw = item && typeof item === 'object' ? item : {}
  const payload = raw.payload && typeof raw.payload === 'object' ? raw.payload : {}
  const result = raw.result && typeof raw.result === 'object' ? raw.result : null
  return {
    id: String(raw.id || uid(`donna-action-${index}`)),
    type: String(raw.type || 'create_study_block'),
    status: String(raw.status || 'proposed'),
    payload: {
      title: String(payload.title || ''),
      start: String(payload.start || ''),
      end: String(payload.end || ''),
      description: String(payload.description || ''),
      source: String(payload.source || 'donna'),
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
    },
    result: result
      ? {
          googleEventId: String(result.googleEventId || ''),
          htmlLink: String(result.htmlLink || ''),
          start: String(result.start?.dateTime || result.start?.date || result.start || ''),
          end: String(result.end?.dateTime || result.end?.date || result.end || '')
        }
      : null,
    error: raw.error ? String(raw.error) : '',
    createdAt: String(raw.createdAt || ''),
    updatedAt: String(raw.updatedAt || ''),
    approvedAt: raw.approvedAt ? String(raw.approvedAt) : '',
    executedAt: raw.executedAt ? String(raw.executedAt) : '',
    history: Array.isArray(raw.history)
      ? raw.history.map((entry, entryIndex) => ({
          id: `${raw.id || 'action'}-h-${entryIndex}`,
          status: String(entry?.status || ''),
          at: String(entry?.at || ''),
          message: String(entry?.message || '')
        }))
      : []
  }
}

function toCanonicalFailure(code, message, extra = {}) {
  return {
    ok: false,
    reason: code,
    message,
    ...extra
  }
}

function mapConnectivityError(error) {
  const message = String(error?.message || '').trim()
  const backendReason = String(
    error?.details?.reasonCode ||
      error?.details?.reason ||
      error?.details?.details?.reasonCode ||
      error?.details?.details?.reason ||
      ''
  ).trim()
  const usage = error?.details?.usage || null
  if (!message) return { state: 'provider_error', reason: 'provider_error', message: 'Unable to complete request.' }

  if (error instanceof ConnectivityApiError) {
    if (backendReason === 'byok_required') {
      return {
        state: 'authenticated_unconnected',
        reason: 'byok_required',
        message: message || 'Free quota reached. Add your API key to continue.',
        usage
      }
    }
    if (backendReason === 'quota_exceeded_hourly_ip') {
      return {
        state: 'provider_error',
        reason: 'quota_exceeded_hourly_ip',
        message: message || 'Hourly free limit reached for this network.',
        usage
      }
    }
    if (backendReason === 'quota_exceeded_daily_user') {
      return {
        state: 'provider_error',
        reason: 'quota_exceeded_daily_user',
        message: message || 'Daily free message limit reached.',
        usage
      }
    }
    if (backendReason === 'quota_exceeded_weekly_tokens') {
      return {
        state: 'provider_error',
        reason: 'quota_exceeded_weekly_tokens',
        message: message || 'Weekly free token limit reached.',
        usage
      }
    }
    if (backendReason === 'connect_provider_required') {
      return {
        state: 'authenticated_unconnected',
        reason: 'connect_provider_required',
        message: 'Google Calendar is not connected.',
        usage
      }
    }
    if (backendReason === 'execution_failed') {
      return {
        state: 'provider_error',
        reason: 'execution_failed',
        message: 'Calendar execution failed.',
        usage
      }
    }
    if (error.code === 'AUTH_REQUIRED' || error.status === 401) {
      return { state: 'unauthenticated', reason: 'login_required', message: 'Sign in required.', usage }
    }
    if (error.status === 409) {
      return {
        state: 'provider_error',
        reason: 'execution_failed',
        message: 'Action is no longer approvable.',
        usage
      }
    }
    if (error.status === 502) {
      return {
        state: 'provider_error',
        reason: 'execution_failed',
        message: 'Calendar execution failed.',
        usage
      }
    }
    if (error.status === 0 || message.includes('Failed to fetch')) {
      return {
        state: 'backend_unavailable',
        reason: 'backend_unavailable',
        message: 'Backend unavailable.',
        usage
      }
    }
    if (error.status >= 500 || message.includes('Google Calendar integration is not configured')) {
      return {
        state: 'misconfigured',
        reason: 'misconfigured',
        message: 'Calendar backend misconfigured.',
        usage
      }
    }
  }

  if (message.includes('Provider is not connected')) {
    return {
      state: 'authenticated_unconnected',
      reason: 'connect_provider_required',
      message: 'Google Calendar is not connected.',
      usage
    }
  }

  return { state: 'provider_error', reason: 'provider_error', message, usage }
}

function deriveAuthConnectivityState({ loading, auth, connectivityStatus, lastError }) {
  if (loading) {
    return {
      state: 'connection_pending',
      reason: 'loading',
      message: 'Checking account and provider status...'
    }
  }

  if (lastError) {
    if (lastError.state === 'backend_unavailable') return lastError
    if (lastError.state === 'misconfigured') return lastError
  }

  if (!auth?.authenticated) {
    return {
      state: 'unauthenticated',
      reason: 'auth_missing',
      message: 'Sign in to connect calendar.'
    }
  }

  const google = connectivityStatus?.googleCalendar
  if (google?.status === 'syncing') {
    return {
      state: 'connection_pending',
      reason: 'provider_syncing',
      message: 'Google Calendar connection is pending.'
    }
  }

  if (google?.errorMessage) {
    return {
      state: 'provider_error',
      reason: 'provider_error',
      message: String(google.errorMessage)
    }
  }

  if (!google?.connected) {
    return {
      state: 'authenticated_unconnected',
      reason: 'google_not_connected',
      message: 'Connect Google Calendar to enable external actions.'
    }
  }

  return {
    state: 'connected_ready',
    reason: 'ready',
    message: 'Calendar actions are ready.'
  }
}

function scopedStorageKey(baseKey, scope) {
  return `${baseKey}::${scope}`
}

function readScopedStorage(baseKey, scope) {
  if (!scope) return null
  return localStorage.getItem(scopedStorageKey(baseKey, scope))
}

function readScopedSessionStorage(baseKey, scope) {
  if (!scope) return null
  try {
    return sessionStorage.getItem(scopedStorageKey(baseKey, scope))
  } catch {
    return null
  }
}

function removeScopedStorage(baseKey, scope) {
  if (!scope) return
  localStorage.removeItem(scopedStorageKey(baseKey, scope))
}

function writeScopedSessionStorage(baseKey, scope, value) {
  if (!scope) return
  try {
    sessionStorage.setItem(scopedStorageKey(baseKey, scope), value)
  } catch {
    // no-op: private mode or blocked storage
  }
}

function removeScopedSessionStorage(baseKey, scope) {
  if (!scope) return
  try {
    sessionStorage.removeItem(scopedStorageKey(baseKey, scope))
  } catch {
    // no-op: private mode or blocked storage
  }
}

function toUserMode(user) {
  const mode = String(user?.mode || '').trim().toLowerCase()
  if (mode === 'demo' || mode === 'google' || mode === 'guest') return mode
  return 'guest'
}

function sanitizeLegacyProfile(profileValue, mode = 'guest') {
  const profile = profileValue && typeof profileValue === 'object' ? profileValue : {}
  const name = String(profile.name || '').trim()
  const email = String(profile.email || '').trim()

  if (name === 'Shivam Arora' || email === 'shivam@donna.local') {
    return {
      ...profile,
      name: 'Elena Vance',
      email: mode === 'google' ? '' : 'elena@donna.demo'
    }
  }

  return profile
}

function readBooleanStorage(rawValue, fallback = false) {
  if (rawValue === null || rawValue === undefined) return fallback
  if (typeof rawValue === 'boolean') return rawValue
  const normalized = String(rawValue).trim().toLowerCase()
  if (!normalized) return fallback
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  try {
    const parsed = JSON.parse(rawValue)
    return typeof parsed === 'boolean' ? parsed : fallback
  } catch {
    return fallback
  }
}

function deriveProfileFromAuthUser(authUser, mode, currentProfile) {
  const next = { ...(currentProfile || {}) }
  const rawName = String(authUser?.name || '').trim()
  const rawEmail = String(authUser?.email || '').trim()
  const rawPicture = String(authUser?.picture || '').trim()

  if (mode === 'google') {
    const emailLocal = rawEmail.includes('@') ? rawEmail.split('@')[0] : ''
    next.name = rawName || emailLocal || 'Google User'
    next.email = rawEmail
    if (rawPicture) next.avatar = rawPicture
    next.role = 'Student'
    return next
  }

  if (mode === 'guest') {
    next.name = rawName || 'Guest User'
    next.email = rawEmail
    next.role = 'Guest'
    return next
  }

  if (mode === 'demo') {
    next.name = rawName || 'Donna Demo User'
    next.email = rawEmail || 'demo@donna.app'
    next.role = 'Demo'
    return next
  }

  return next
}

export function DashboardProvider({ children }) {
  const apiKeyRef = useRef('')
  const providerModeRef = useRef('groq')
  const localModelRef = useRef('')

  const hydrated = useMemo(() => getModeDefaults('guest'), [])

  const [profile, setProfile] = useState(hydrated.profile || DEFAULT_PROFILE)
  const [onboardingCompleted, setOnboardingCompleted] = useState(Boolean(hydrated.onboardingCompleted))
  const [dashboard, setDashboard] = useState(hydrated.dashboard || DEFAULT_DASHBOARD_STATE)
  const [chatMessages, setChatMessages] = useState(hydrated.chat || DEFAULT_CHAT_MESSAGES)
  const [focusHistory, setFocusHistory] = useState(hydrated.focusHistory || [])
  const [apiKey, setApiKey] = useState(hydrated.apiKey || '')
  const [providerMode, setProviderMode] = useState(hydrated.providerMode || 'groq')
  const [localModel, setLocalModel] = useState(hydrated.localModel || '')
  const [chatOpen, setChatOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [apiKeyEditorOpen, setApiKeyEditorOpen] = useState(false)

  const [aspirations, setAspirations] = useState(() =>
    (hydrated.aspirations || DEFAULT_ASPIRATIONS).map((item, index) => normalizeAspiration(item, index))
  )
  const [aspirationsArchive, setAspirationsArchive] = useState(() =>
    (hydrated.aspirationsArchive || []).map((item, index) => normalizeAspiration(item, index))
  )
  const [aspirationSessions, setAspirationSessions] = useState(() =>
    (hydrated.aspirationSessions || DEFAULT_ASPIRATION_SESSIONS).map((item, index) =>
      normalizeSession(item, index, 'asp')
    )
  )
  const [settings, setSettings] = useState(normalizeSettings(hydrated.settings))
  const [insightDesk, setInsightDesk] = useState(hydrated.insightDesk || DEFAULT_INSIGHT_DESK)
  const [connectivityStatus, setConnectivityStatus] = useState(
    normalizeConnectivity(hydrated.connectivityStatus)
  )
  const [authState, setAuthState] = useState({
    authenticated: false,
    user: null,
    loginUrl: '/login',
    logoutUrl: '/api/auth/logout'
  })
  const [storageScope, setStorageScope] = useState(null)
  const [userMode, setUserMode] = useState('guest')
  const [authConnectivityLoading, setAuthConnectivityLoading] = useState(true)
  const [authConnectivityRefreshing, setAuthConnectivityRefreshing] = useState(false)
  const [authConnectivityError, setAuthConnectivityError] = useState(null)
  const [donnaActions, setDonnaActions] = useState([])
  const [donnaActionsLoading, setDonnaActionsLoading] = useState(false)
  const [donnaActionsError, setDonnaActionsError] = useState(null)
  const [donnaActionExecution, setDonnaActionExecution] = useState({
    inFlight: false,
    actionId: '',
    lastResult: null
  })
  const [plannerUsage, setPlannerUsage] = useState(null)
  const [plannerUsageLoading, setPlannerUsageLoading] = useState(false)
  const [v2PlannerMeta, setV2PlannerMeta] = useState({
    route: 'local',
    latencyMs: 0,
    fallback: false,
    providerUsed: 'local_deterministic',
    fallbackReason: ''
  })
  const [v2Feasibility, setV2Feasibility] = useState(null)
  const [v2Forecast, setV2Forecast] = useState([])
  const [v2EstimateBands, setV2EstimateBands] = useState([])
  const [v2Benchmarks, setV2Benchmarks] = useState(null)
  const [v2LastRequest, setV2LastRequest] = useState(null)
  const [calendarEvents, setCalendarEvents] = useState(() =>
    (hydrated.calendarEvents || DEFAULT_CALENDAR_EVENTS).map((item, index) =>
      normalizeCalendarEvent(item, index)
    )
  )
  const [assignments, setAssignments] = useState(() =>
    (hydrated.assignments || DEFAULT_ASSIGNMENTS).map((item, index) => normalizeAssignment(item, index))
  )
  const [exams, setExams] = useState(() =>
    (hydrated.exams || DEFAULT_EXAMS).map((item, index) => normalizeExam(item, index))
  )
  const [examStudySessions, setExamStudySessions] = useState(() =>
    (hydrated.examStudySessions || DEFAULT_EXAM_STUDY_SESSIONS).map((item, index) =>
      normalizeSession(item, index, 'exam')
    )
  )
  const buildFocusContext = useCallback(
    (historyOverride = null) => ({
      assignments,
      exams,
      calendarEvents,
      focusHistory: Array.isArray(historyOverride) ? historyOverride : focusHistory
    }),
    [assignments, exams, calendarEvents, focusHistory]
  )

  const heuristicSignalRef = useRef({
    deadline: '',
    inactivity: '',
    completionStreak: ''
  })
  const proposalInFlightRef = useRef(new Set())

  const clearExternalRuntimeState = useCallback(() => {
    setConnectivityStatus(normalizeConnectivity(DEFAULT_CONNECTIVITY_STATUS))
    setDonnaActions([])
    setDonnaActionsLoading(false)
    setDonnaActionsError(null)
    setDonnaActionExecution({ inFlight: false, actionId: '', lastResult: null })
    setPlannerUsage(null)
    setPlannerUsageLoading(false)
    setV2PlannerMeta({ route: 'local', latencyMs: 0, fallback: false, providerUsed: 'local_deterministic', fallbackReason: '' })
    setV2Feasibility(null)
    setV2Forecast([])
    setV2EstimateBands([])
    setV2Benchmarks(null)
    setV2LastRequest(null)
  }, [])

  const applyHydratedState = useCallback((nextState, mode = 'guest') => {
    const fallback = getModeDefaults(mode)
    const source = nextState || fallback
    const safeProfile = sanitizeLegacyProfile(source.profile || fallback.profile, mode)
    setUserMode(mode)
    setProfile(safeProfile)
    setOnboardingCompleted(Boolean(source.onboardingCompleted ?? fallback.onboardingCompleted ?? mode === 'demo'))
    setDashboard(source.dashboard || fallback.dashboard)
    setChatMessages(Array.isArray(source.chat) && source.chat.length > 0 ? source.chat : fallback.chat)
    setFocusHistory(Array.isArray(source.focusHistory) ? source.focusHistory : fallback.focusHistory)
    setApiKey(String(source.apiKey || ''))
    setProviderMode(String(source.providerMode || 'groq') === 'local_ollama' ? 'local_ollama' : 'groq')
    setLocalModel(String(source.localModel || ''))
    setAspirations((source.aspirations || fallback.aspirations).map((item, index) => normalizeAspiration(item, index)))
    setAspirationsArchive((source.aspirationsArchive || []).map((item, index) => normalizeAspiration(item, index)))
    setAspirationSessions((source.aspirationSessions || fallback.aspirationSessions).map((item, index) =>
      normalizeSession(item, index, 'asp')
    ))
    setSettings(normalizeSettings(source.settings || fallback.settings))
    setInsightDesk(Array.isArray(source.insightDesk) ? source.insightDesk : fallback.insightDesk)
    setConnectivityStatus(normalizeConnectivity(source.connectivityStatus || fallback.connectivityStatus))
    setCalendarEvents((source.calendarEvents || fallback.calendarEvents).map((item, index) =>
      normalizeCalendarEvent(item, index)
    ))
    setAssignments((source.assignments || fallback.assignments).map((item, index) =>
      normalizeAssignment(item, index)
    ))
    setExams((source.exams || fallback.exams).map((item, index) => normalizeExam(item, index)))
    setExamStudySessions((source.examStudySessions || fallback.examStudySessions).map((item, index) =>
      normalizeSession(item, index, 'exam')
    ))
  }, [])

  const hydrateForSession = useCallback((scope, mode = 'guest') => {
    if (!scope) return getModeDefaults(mode)
    const fallback = getModeDefaults(mode)

    const hydratedState = hydrateState({
      profileRaw: readScopedStorage(STORAGE_KEYS.profile, scope),
      dashboardRaw: readScopedStorage(STORAGE_KEYS.dashboard, scope),
      chatRaw: readScopedStorage(STORAGE_KEYS.chat, scope),
      focusHistoryRaw: readScopedStorage(STORAGE_KEYS.focusHistory, scope),
      apiKeyRaw: readScopedSessionStorage(STORAGE_KEYS.apiKey, scope) || readScopedStorage(STORAGE_KEYS.apiKey, scope),
      providerModeRaw: readScopedStorage(STORAGE_KEYS.providerMode, scope),
      localModelRaw: readScopedStorage(STORAGE_KEYS.localModel, scope),
      aspirationsRaw: readScopedStorage(STORAGE_KEYS.aspirations, scope),
      aspirationsArchiveRaw: readScopedStorage(STORAGE_KEYS.aspirationsArchive, scope),
      aspirationSessionsRaw: readScopedStorage(STORAGE_KEYS.aspirationSessions, scope),
      settingsRaw: readScopedStorage(STORAGE_KEYS.settings, scope),
      insightDeskRaw: readScopedStorage(STORAGE_KEYS.insightDesk, scope),
      connectivityStatusRaw: readScopedStorage(STORAGE_KEYS.connectivityStatus, scope),
      calendarEventsRaw: readScopedStorage(STORAGE_KEYS.calendarEvents, scope),
      assignmentsRaw: readScopedStorage(STORAGE_KEYS.assignments, scope),
      examsRaw: readScopedStorage(STORAGE_KEYS.exams, scope),
      examStudySessionsRaw: readScopedStorage(STORAGE_KEYS.examStudySessions, scope)
    })
    const onboardingRaw = readScopedStorage(STORAGE_KEYS.onboarding, scope)

    const profileRaw = readScopedStorage(STORAGE_KEYS.profile, scope)
    const dashboardRaw = readScopedStorage(STORAGE_KEYS.dashboard, scope)
    const chatRaw = readScopedStorage(STORAGE_KEYS.chat, scope)
    const aspirationsRaw = readScopedStorage(STORAGE_KEYS.aspirations, scope)
    const calendarEventsRaw = readScopedStorage(STORAGE_KEYS.calendarEvents, scope)
    const assignmentsRaw = readScopedStorage(STORAGE_KEYS.assignments, scope)

    const hasAnyData = [
      profileRaw,
      dashboardRaw,
      chatRaw,
      aspirationsRaw,
      calendarEventsRaw,
      assignmentsRaw
    ].some((item) => Boolean(String(item || '').trim()))

    if (!hasAnyData) {
      return {
        ...fallback,
        onboardingCompleted: readBooleanStorage(onboardingRaw, Boolean(fallback.onboardingCompleted))
      }
    }

    return {
      ...hydratedState,
      onboardingCompleted: readBooleanStorage(onboardingRaw, Boolean(fallback.onboardingCompleted))
    }
  }, [])

  const unreadInsightCount = useMemo(
    () => insightDesk.filter((item) => !item.read).length,
    [insightDesk]
  )

  const authConnectivity = useMemo(() => {
    const summary = deriveAuthConnectivityState({
      loading: authConnectivityLoading,
      auth: authState,
      connectivityStatus,
      lastError: authConnectivityError
    })

    return {
      ...summary,
      loading: authConnectivityLoading,
      refreshing: authConnectivityRefreshing,
      auth: authState,
      providers: connectivityStatus,
      error: authConnectivityError
    }
  }, [
    authConnectivityError,
    authConnectivityLoading,
    authConnectivityRefreshing,
    authState,
    connectivityStatus
  ])

  const refreshPlannerUsage = useCallback(
    async ({ silent = false } = {}) => {
      if (!authState.authenticated) {
        setPlannerUsage(null)
        setPlannerUsageLoading(false)
        return { ok: false, reason: 'login_required' }
      }
      if (!silent) setPlannerUsageLoading(true)
      try {
        const usage = await getDonnaPlannerUsage()
        setPlannerUsage(usage)
        return { ok: true, usage }
      } catch (error) {
        const mapped = mapConnectivityError(error)
        setAuthConnectivityError(mapped)
        return { ok: false, ...mapped }
      } finally {
        setPlannerUsageLoading(false)
      }
    },
    [authState.authenticated]
  )

  useEffect(() => {
    apiKeyRef.current = apiKey
    if (!storageScope) return undefined
    writeScopedSessionStorage(STORAGE_KEYS.apiKey, storageScope, apiKey)
    // Remove any legacy persistent key copy.
    removeScopedStorage(STORAGE_KEYS.apiKey, storageScope)
    return undefined
  }, [apiKey, storageScope])

  useEffect(() => {
    providerModeRef.current = providerMode === 'local_ollama' ? 'local_ollama' : 'groq'
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.providerMode, storageScope), JSON.stringify(providerModeRef.current))
  }, [providerMode, storageScope])

  useEffect(() => {
    localModelRef.current = String(localModel || '').trim()
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.localModel, storageScope), JSON.stringify(localModelRef.current))
  }, [localModel, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.profile, storageScope), JSON.stringify(profile))
  }, [profile, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.onboarding, storageScope), JSON.stringify(onboardingCompleted))
  }, [onboardingCompleted, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.dashboard, storageScope), JSON.stringify(dashboard))
  }, [dashboard, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.chat, storageScope), JSON.stringify(chatMessages))
  }, [chatMessages, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.focusHistory, storageScope), JSON.stringify(focusHistory))
  }, [focusHistory, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.aspirations, storageScope), JSON.stringify(aspirations))
  }, [aspirations, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(
      scopedStorageKey(STORAGE_KEYS.aspirationsArchive, storageScope),
      JSON.stringify(aspirationsArchive)
    )
  }, [aspirationsArchive, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(
      scopedStorageKey(STORAGE_KEYS.aspirationSessions, storageScope),
      JSON.stringify(aspirationSessions)
    )
  }, [aspirationSessions, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.settings, storageScope), JSON.stringify(settings))
  }, [settings, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.insightDesk, storageScope), JSON.stringify(insightDesk))
  }, [insightDesk, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(
      scopedStorageKey(STORAGE_KEYS.connectivityStatus, storageScope),
      JSON.stringify(connectivityStatus)
    )
  }, [connectivityStatus, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.calendarEvents, storageScope), JSON.stringify(calendarEvents))
  }, [calendarEvents, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.assignments, storageScope), JSON.stringify(assignments))
  }, [assignments, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(scopedStorageKey(STORAGE_KEYS.exams, storageScope), JSON.stringify(exams))
  }, [exams, storageScope])

  useEffect(() => {
    if (!storageScope) return
    localStorage.setItem(
      scopedStorageKey(STORAGE_KEYS.examStudySessions, storageScope),
      JSON.stringify(examStudySessions)
    )
  }, [examStudySessions, storageScope])

  useEffect(() => {
    const interval = window.setInterval(() => {
      setDashboard((prev) => {
        if (prev.session.isPaused || prev.session.remainingSeconds <= 0) return prev

        const next = {
          ...prev,
          session: {
            ...prev.session,
            remainingSeconds: Math.max(prev.session.remainingSeconds - 1, 0)
          }
        }

        if (next.session.remainingSeconds % 60 === 0) {
          const scored = recomputeFocusState(next, '', buildFocusContext())
          setFocusHistory((history) => [...history.slice(-49), { ts: Date.now(), score: scored.focus.score }])
          return scored
        }

        return next
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [buildFocusContext])

  const refreshAuthConnectivity = useCallback(async ({ silent = false } = {}) => {
    setAuthConnectivityRefreshing(true)
    if (!silent) setAuthConnectivityLoading(true)

    try {
      const authData = await getAuthMe()
      const authSnapshot = {
        authenticated: Boolean(authData?.authenticated),
        user: authData?.user || null,
        loginUrl: String(authData?.loginUrl || '/login'),
        logoutUrl: String(authData?.logoutUrl || '/api/auth/logout')
      }

      setAuthState(authSnapshot)

      let providerData = null
      if (authSnapshot.authenticated) {
        const mode = toUserMode(authSnapshot.user)
        const scope = String(authSnapshot.user?.sub || '')
        setStorageScope(scope || null)
        const hydratedForUser = hydrateForSession(scope, mode)
        applyHydratedState(hydratedForUser, mode)
        setProfile((current) =>
          deriveProfileFromAuthUser(authSnapshot.user, mode, sanitizeLegacyProfile(current, mode))
        )

        providerData = await fetchProviders()
        if (providerData && typeof providerData.providers === 'object') {
          setConnectivityStatus((prev) =>
            normalizeConnectivity({
              ...prev,
              ...providerData.providers
            })
          )
        }
      } else {
        setStorageScope(null)
        applyHydratedState(getModeDefaults('guest'), 'guest')
        clearExternalRuntimeState()
      }

      setAuthConnectivityError(null)
      return {
        ok: true,
        state: deriveAuthConnectivityState({
          loading: false,
          auth: authSnapshot,
          connectivityStatus: providerData?.providers || DEFAULT_CONNECTIVITY_STATUS,
          lastError: null
        }).state
      }
    } catch (error) {
      const mapped = mapConnectivityError(error)
      setAuthConnectivityError(mapped)
      if (mapped.state === 'unauthenticated') {
        clearExternalRuntimeState()
      }
      return {
        ok: false,
        state: mapped.state,
        reason: mapped.reason,
        message: mapped.message,
        loginUrl: error instanceof ConnectivityApiError ? error.loginUrl || null : null
      }
    } finally {
      setAuthConnectivityLoading(false)
      setAuthConnectivityRefreshing(false)
    }
  }, [applyHydratedState, clearExternalRuntimeState, hydrateForSession])

  useEffect(() => {
    let cancelled = false
    refreshAuthConnectivity({ silent: true }).then((result) => {
      if (cancelled) return
      if (!result?.ok && result?.state === 'backend_unavailable') {
        // Keep local state functioning while backend is offline.
      }
    })

    return () => {
      cancelled = true
    }
  }, [refreshAuthConnectivity])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const query = new URLSearchParams(window.location.search)
    const provider = query.get('provider')
    const status = query.get('status')
    const reason = query.get('reason')
    const message = query.get('message')
    const auth = query.get('auth')

    if (provider && status) {
      if (status === 'connected') {
        pushInsight('donna', 'Provider connected', 'Google Calendar connected successfully.', 'success')
        setChatOpen(true)
      } else if (status === 'failed') {
        pushInsight(
          'donna',
          'Provider connection failed',
          reason ? String(reason) : 'Connection failed. Try again from Settings.',
          'warning'
        )
      } else if (status === 'pending') {
        pushInsight('donna', 'Provider pending', 'Provider connection is pending verification.', 'info')
      }

      refreshAuthConnectivity({ silent: true })

      query.delete('provider')
      query.delete('status')
      query.delete('reason')
      const next = query.toString()
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}`
      window.history.replaceState({}, '', nextUrl)
      return
    }

    if (auth === 'failed') {
      const detail = message || reason || 'Sign in failed.'
      pushInsight('donna', 'Authentication failed', String(detail), 'warning')
      query.delete('auth')
      query.delete('reason')
      query.delete('message')
      const next = query.toString()
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}`
      window.history.replaceState({}, '', nextUrl)
    }
  }, [refreshAuthConnectivity])

  const pushInsight = (source, title, detail, severity = 'info') => {
    const next = {
      id: uid('insight'),
      source,
      title,
      detail,
      severity,
      read: false,
      createdAt: Date.now()
    }
    setInsightDesk((prev) => [next, ...prev].slice(0, 120))
  }

  useEffect(() => {
    const now = Date.now()
    const signals = heuristicSignalRef.current

    if (settings.contextualLayers.deadlinePressure) {
      const topPending = [...dashboard.priorities]
        .filter((item) => !item.completed)
        .sort((a, b) => b.urgency - a.urgency)[0]

      const shouldWarn = Boolean(topPending && topPending.urgency >= 85)
      const marker = shouldWarn ? `${topPending.id}:${topPending.urgency}` : ''

      if (shouldWarn && signals.deadline !== marker) {
        signals.deadline = marker
        pushInsight(
          'rule',
          'Deadline pressure is high',
          `${topPending.title} is currently the highest urgency commitment.`,
          'warning'
        )
      } else if (!shouldWarn) {
        signals.deadline = ''
      }
    } else {
      signals.deadline = ''
    }

    if (settings.contextualLayers.inactivitySignals) {
      const stale = [...aspirations]
        .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
        .find((item) => now - Number(item.createdAt || now) > 1000 * 60 * 60 * 24 * 3)

      const recentCompletion = aspirationsArchive.some(
        (item) => Number(item.completedAt || 0) > now - 1000 * 60 * 60 * 24 * 2
      )
      const marker = stale
        ? `${stale.id}:${Math.floor((now - Number(stale.createdAt || now)) / (1000 * 60 * 60 * 24))}`
        : ''

      if (stale && !recentCompletion && signals.inactivity !== marker) {
        signals.inactivity = marker
        pushInsight(
          'rule',
          'Stale aspiration detected',
          `${stale.title} has been inactive for several days. Consider a short next step.`,
          'info'
        )
      } else if (!stale || recentCompletion) {
        signals.inactivity = ''
      }
    } else {
      signals.inactivity = ''
    }

    if (settings.contextualLayers.completionStreaks) {
      const completedToday = aspirationsArchive.filter((item) => {
        if (!item.completedAt) return false
        return isSameDay(item.completedAt, now)
      }).length
      const marker = completedToday >= 2 ? `today:${completedToday}` : ''
      if (completedToday >= 2 && signals.completionStreak !== marker) {
        signals.completionStreak = marker
        pushInsight(
          'rule',
          'Completion streak active',
          `You completed ${completedToday} aspirations today. Keep the momentum.`,
          'success'
        )
      } else if (completedToday < 2) {
        signals.completionStreak = ''
      }
    } else {
      signals.completionStreak = ''
    }
  }, [aspirations, aspirationsArchive, dashboard.priorities, settings.contextualLayers])

  const pushAssistantMessage = (text, route = 'local') => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: uid('m-assistant'),
        role: 'assistant',
        text,
        route,
        ts: Date.now()
      }
    ])

    if (settings.alerts.aiInsightsPrepared) {
      pushInsight('donna', 'Donna update', text, 'info')
    }
  }

  const pushUserMessage = (text) => {
    setChatMessages((prev) => [
      ...prev,
      {
        id: uid('m-user'),
        role: 'user',
        text,
        ts: Date.now()
      }
    ])
  }

  const applyResult = (result, source = 'chat') => {
    setDashboard((prev) => {
      const next = recomputeFocusState(applyPlannerResult(prev, result, source), '', buildFocusContext())
      setFocusHistory((history) => [...history.slice(-49), { ts: Date.now(), score: next.focus.score }])
      return next
    })
  }

  const optimizePriorities = () => {
    const result = runLocalPlanner(dashboard, 'Optimize this plan for today', 'optimize')
    applyResult(result, 'optimize')
    pushAssistantMessage(result.assistantMessage, 'local')
  }

  const acknowledgeSuggestion = () => {
    setDashboard((prev) =>
      recomputeFocusState(
        {
          ...prev,
          suggestion: {
            ...prev.suggestion,
            visible: false,
            acknowledgedAt: Date.now()
          },
          metrics: {
            ...prev.metrics,
            acknowledgeCount: prev.metrics.acknowledgeCount + 1
          }
        },
        'Suggestion acknowledged; cognitive load reduced.',
        buildFocusContext()
      )
    )
    pushAssistantMessage('Suggestion acknowledged. I will surface the next recommendation in chat only.', 'local')
  }

  const toggleSessionPause = () => {
    setDashboard((prev) =>
      recomputeFocusState(
        {
          ...prev,
          session: {
            ...prev.session,
            isPaused: !prev.session.isPaused
          }
        },
        prev.session.isPaused
          ? 'Session resumed; momentum restored.'
          : 'Session paused; focus trend temporarily reduced.',
        buildFocusContext()
      )
    )
  }

  const markPriorityComplete = (priorityId) => {
    setDashboard((prev) => {
      const next = {
        ...prev,
        priorities: prev.priorities.map((item) =>
          item.id === priorityId ? { ...item, completed: !item.completed } : item
        )
      }
      return recomputeFocusState(next, '', buildFocusContext())
    })
  }

  const reorderPriorities = (orderedIds) => {
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) return

    setDashboard((prev) => {
      const map = new Map(prev.priorities.map((item) => [item.id, item]))
      const ordered = []
      for (const id of orderedIds) {
        const item = map.get(id)
        if (item) ordered.push(item)
      }
      for (const item of prev.priorities) {
        if (!ordered.find((entry) => entry.id === item.id)) ordered.push(item)
      }

      return recomputeFocusState({ ...prev, priorities: ordered }, '', buildFocusContext())
    })
  }

  const addAspiration = ({ title, subtext, targetLabel }) => {
    const trimmedTitle = String(title || '').trim()
    const trimmedSubtext = String(subtext || '').trim()
    const trimmedTargetLabel = String(targetLabel || '').trim()
    if (!trimmedTitle) return false

    const next = normalizeAspiration({
      id: uid('asp'),
      title: trimmedTitle,
      subtext: trimmedSubtext,
      status: 'active',
      progress: 0,
      targetLabel: trimmedTargetLabel || 'No target date set',
      createdAt: Date.now(),
      startedAt: Date.now(),
      lastWorkedAt: null,
      workSessionCount: 0,
      completedAt: null
    })

    setAspirations((prev) => [next, ...prev])
    if (settings.contextualLayers.inactivitySignals) {
      pushInsight('rule', 'New aspiration added', `${trimmedTitle} was added to active aspirations.`, 'info')
    }
    return true
  }

  const logAspirationSession = (aspirationId, payload = {}) => {
    const minutes = Math.max(5, Math.min(300, Number(payload.minutes || 25)))
    const note = String(payload.note || '').trim()
    const now = Date.now()
    let changedTitle = ''
    let nextProgress = 0

    const session = {
      id: uid('asp-s'),
      aspirationId,
      minutes,
      note,
      createdAt: now
    }

    setAspirations((prev) =>
      prev.map((item) => {
        if (item.id !== aspirationId) return item
        changedTitle = item.title
        const delta = aspirationProgressDelta(item.progress, minutes)
        const after = Math.min(92, Math.round(Number(item.progress || 0) + delta))
        nextProgress = after
        return {
          ...item,
          progress: after,
          lastWorkedAt: now,
          workSessionCount: Number(item.workSessionCount || 0) + 1
        }
      })
    )

    setAspirationSessions((prev) => [session, ...prev])

    if (changedTitle) {
      pushInsight(
        'rule',
        'Aspiration session logged',
        `${changedTitle}: +${minutes} minutes logged. Progress now ${nextProgress}%.`,
        'info'
      )
    }
  }

  const makeAspirationProgress = (id, step = 25) => {
    logAspirationSession(id, { minutes: step })
  }

  const markAspirationDone = (id) => {
    let moved = null
    setAspirations((prev) => {
      const target = prev.find((item) => item.id === id)
      if (!target) return prev
      moved = normalizeAspiration({
        ...target,
        status: 'done',
        progress: 100,
        completedAt: Date.now(),
        lastWorkedAt: Date.now()
      })
      return prev.filter((item) => item.id !== id)
    })

    if (moved) {
      setAspirationsArchive((prev) => [moved, ...prev])
      if (settings.contextualLayers.completionStreaks) {
        pushInsight('rule', 'Aspiration completed', `${moved.title} moved to done archive.`, 'success')
      }
    }
  }

  const restoreAspiration = (id) => {
    let restored = null
    setAspirationsArchive((prev) => {
      const target = prev.find((item) => item.id === id)
      if (!target) return prev
      restored = normalizeAspiration({ ...target, status: 'active', completedAt: null })
      return prev.filter((item) => item.id !== id)
    })

    if (restored) {
      setAspirations((prev) => [restored, ...prev])
      pushInsight('rule', 'Aspiration restored', `${restored.title} returned to active aspirations.`, 'info')
    }
  }

  const deleteAspiration = (id, source = 'active') => {
    if (source === 'archive') {
      setAspirationsArchive((prev) => prev.filter((item) => item.id !== id))
    } else {
      setAspirations((prev) => prev.filter((item) => item.id !== id))
    }
    setAspirationSessions((prev) => prev.filter((item) => item.aspirationId !== id))
  }

  const markInsightRead = (id) => {
    setInsightDesk((prev) => prev.map((item) => (item.id === id ? { ...item, read: true } : item)))
  }

  const markAllInsightsRead = () => {
    setInsightDesk((prev) => prev.map((item) => ({ ...item, read: true })))
  }

  const getDonnaExternalReadiness = () => {
    const state = deriveAuthConnectivityState({
      loading: authConnectivityLoading,
      auth: authState,
      connectivityStatus,
      lastError: authConnectivityError
    })

    if (state.state === 'connected_ready') {
      return { ok: true, ...state }
    }

    if (state.state === 'unauthenticated') {
      return {
        ok: false,
        code: 'login_required',
        ...state,
        loginUrl: authState.loginUrl || '/login'
      }
    }

    if (state.state === 'authenticated_unconnected' || state.state === 'connection_pending') {
      return {
        ok: false,
        code: 'connect_provider_required',
        ...state
      }
    }

    if (state.state === 'misconfigured') {
      return {
        ok: false,
        code: 'misconfigured',
        ...state
      }
    }

    if (state.state === 'backend_unavailable') {
      return {
        ok: false,
        code: 'backend_unavailable',
        ...state
      }
    }

    return {
      ok: false,
      code: 'provider_error',
      ...state
    }
  }

  const connectProvider = async (provider, payload = {}) => {
    const key = provider === 'google_calendar' ? 'googleCalendar' : provider
    setConnectivityStatus((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: 'syncing', errorMessage: '' }
    }))

    try {
      const response =
        provider === 'canvas' || provider === 'blackboard'
          ? await connectLmsApi({
              provider,
              mode: String(payload.mode || 'ics_link'),
              sourceUrl: String(payload.sourceUrl || ''),
              courseHint: String(payload.courseHint || ''),
              testOnly: Boolean(payload.testOnly)
            })
          : await connectProviderApi(provider, payload)
      if (response?.redirectUrl) {
        window.location.assign(response.redirectUrl)
        return true
      }
      if (response?.provider) {
        setConnectivityStatus((prev) => ({ ...prev, [key]: { ...prev[key], ...response.provider } }))
      }
      if (payload?.testOnly) {
        pushInsight('donna', 'LMS link validated', `${key} feed URL is reachable and valid.`, 'success')
        return true
      }
      await refreshAuthConnectivity({ silent: true })
      pushInsight('donna', 'Provider connected', `${key} is now connected.`, 'success')
      return true
    } catch (error) {
      if (error instanceof ConnectivityApiError && error.loginUrl) {
        window.location.assign(
          error.loginUrl.startsWith('http')
            ? error.loginUrl
            : `${window.location.origin}${error.loginUrl}`
        )
        return false
      }
      const mapped = mapConnectivityError(error)
      setAuthConnectivityError(mapped)
      if (key === 'blackboard' && !String(payload?.institutionDomain || '').trim()) {
        setConnectivityStatus((prev) => ({
          ...prev,
          [key]: { ...prev[key], status: 'error', errorMessage: 'Institution domain required.' }
        }))
        return false
      }
      setConnectivityStatus((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          status: 'error',
          errorMessage: mapped.message
        }
      }))
      return false
    }
  }

  const disconnectProvider = async (provider) => {
    const key = provider === 'google_calendar' ? 'googleCalendar' : provider
    try {
      const response =
        provider === 'canvas' || provider === 'blackboard'
          ? await disconnectLmsApi(provider)
          : await disconnectProviderApi(provider)
      if (response?.provider) {
        setConnectivityStatus((prev) => ({ ...prev, [key]: { ...prev[key], ...response.provider } }))
      } else {
        setConnectivityStatus((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            connected: false,
            status: 'idle',
            errorMessage: '',
            lastSyncAt: null
          }
        }))
      }
      await refreshAuthConnectivity({ silent: true })
      pushInsight('donna', 'Provider disconnected', `${key} is now disconnected.`, 'info')
      return true
    } catch (error) {
      if (error instanceof ConnectivityApiError && error.loginUrl) {
        window.location.assign(
          error.loginUrl.startsWith('http')
            ? error.loginUrl
            : `${window.location.origin}${error.loginUrl}`
        )
        return false
      }
      const mapped = mapConnectivityError(error)
      setAuthConnectivityError(mapped)
      setConnectivityStatus((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          status: 'error',
          errorMessage: mapped.message
        }
      }))
      return false
    }
  }

  const syncProvider = async (provider) => {
    const key = provider === 'google_calendar' ? 'googleCalendar' : provider
    setConnectivityStatus((prev) => ({
      ...prev,
      [key]: { ...prev[key], status: 'syncing', errorMessage: '' }
    }))

    try {
      const response =
        provider === 'canvas' || provider === 'blackboard'
          ? await syncLmsApi({ provider, force: false })
          : await syncProviderApi(provider)
      if (response?.provider) {
        setConnectivityStatus((prev) => ({ ...prev, [key]: { ...prev[key], ...response.provider } }))
      }
      if (Array.isArray(response?.events) && response.events.length > 0) {
        setCalendarEvents((prev) => {
          const manual = prev.filter((item) => String(item.source || 'manual') === 'manual')
          const synced = response.events.map((item, index) => normalizeCalendarEvent(item, index))
          return [...synced, ...manual]
        })
      }
      if (Array.isArray(response?.tasks) && response.tasks.length > 0) {
        setAssignments((prev) => {
          const manual = prev.filter((item) => String(item.source || 'manual') === 'manual')
          const synced = response.tasks.map((item, index) => normalizeAssignment(item, index))
          return [...synced, ...manual]
        })
      }
      if (Array.isArray(response?.conflicts) && response.conflicts.length > 0) {
        pushInsight(
          'donna',
          'LMS conflict review',
          `${response.conflicts.length} LMS date conflicts found. Source of truth is LMS; review in planner.`,
          'warning'
        )
      } else if (provider === 'canvas' || provider === 'blackboard') {
        pushInsight('donna', 'Auto-synced from LMS', `${key} imported tasks/events and refreshed your plan context.`, 'success')
      }
      await refreshAuthConnectivity({ silent: true })
      pushInsight('donna', 'Sync complete', `${key} sync finished successfully.`, 'success')
      return true
    } catch (error) {
      if (error instanceof ConnectivityApiError && error.loginUrl) {
        window.location.assign(
          error.loginUrl.startsWith('http')
            ? error.loginUrl
            : `${window.location.origin}${error.loginUrl}`
        )
        return false
      }
      const mapped = mapConnectivityError(error)
      setAuthConnectivityError(mapped)
      setConnectivityStatus((prev) => ({
        ...prev,
        [key]: {
          ...prev[key],
          status: 'error',
          errorMessage: mapped.message
        }
      }))
      return false
    }
  }

  const buildV2SolveRequestFromState = useCallback(() => {
    const now = new Date()
    const slots = []
    for (let i = 0; i < 36; i += 1) {
      const start = new Date(now.getTime() + i * 60 * 60 * 1000)
      start.setMinutes(0, 0, 0)
      const end = new Date(start.getTime() + 60 * 60 * 1000)
      slots.push({
        id: `slot-${i}`,
        start: start.toISOString(),
        end: end.toISOString(),
        blocked: false
      })
    }

    const tasks = assignments.slice(0, 12).map((assignment, index) => {
      const due = new Date(assignment.dueAt).getTime()
      const hoursToDue = Number.isFinite(due) ? Math.max(0, (due - Date.now()) / (1000 * 60 * 60)) : 72
      const urgency = Math.max(0.2, Math.min(2, 24 / Math.max(8, hoursToDue)))
      return {
        id: String(assignment.id || `as-${index}`),
        title: String(assignment.title || `Task ${index + 1}`),
        task_type: String(assignment.priority || 'assignment').toLowerCase(),
        course_id: String(assignment.course || 'general').toLowerCase().replace(/\s+/g, '-'),
        deadline: assignment.dueAt ? new Date(assignment.dueAt).toISOString() : null,
        p75_hours: Number(assignment.estimatedHours || 1),
        urgency,
        energy_profile: index < 2 ? 'deep' : 'assignment',
        prereq_ids: []
      }
    })

    return {
      tasks,
      slots,
      blocked_slot_ids: [],
      latency_budget_ms: 500,
      preferences: {
        no_saturday_work: false,
        grace_hours: 1
      }
    }
  }, [assignments])

  const convertV2ResponseToPlannerResult = useCallback((v2Response, solveRequest, source = 'chat') => {
    const solve = v2Response?.result || {}
    const assignmentsV2 = Array.isArray(solve.assignments) ? solve.assignments : []
    const taskMap = new Map((solveRequest?.tasks || []).map((task) => [task.id, task.title]))
    const orderedUniqueTaskIds = []
    for (const assignment of assignmentsV2) {
      if (!orderedUniqueTaskIds.includes(assignment.task_id)) {
        orderedUniqueTaskIds.push(assignment.task_id)
      }
    }

    const priorityOrder = orderedUniqueTaskIds.map((taskId) => taskMap.get(taskId) || taskId)
    const timelineUpdates = assignmentsV2.slice(0, 3).map((assignment) => {
      const start = new Date(assignment.start)
      const end = new Date(assignment.end)
      return {
        time: start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        title: taskMap.get(assignment.task_id) || assignment.task_id,
        detail: `${start.toLocaleDateString()} · ${end.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`,
        status: 'Scheduled'
      }
    })

    const explanationText = v2Response?.explanation?.assistantMessage
    const fallback = Boolean(v2Response?.fallback)
    const route = String(v2Response?.routeDecision?.route || 'standard')
    const latencyMs = Number(v2Response?.latencyMs || solve.latency_ms || 0)

    const assistantMessage =
      explanationText ||
      (assignmentsV2.length > 0
        ? `I built a ${route} schedule with ${assignmentsV2.length} study blocks in ${Math.round(latencyMs)}ms.`
        : `I evaluated your constraints in ${Math.round(latencyMs)}ms and did not find strong allocations.`)

    const suggestion =
      assignmentsV2.length > 0
        ? `Start with ${(taskMap.get(assignmentsV2[0].task_id) || assignmentsV2[0].task_id).toLowerCase()} in the first scheduled block.`
        : 'Add more availability slots to increase schedule feasibility.'

    return {
      route: fallback ? 'local' : route,
      confidence: route === 'complex' ? 0.82 : route === 'standard' ? 0.75 : 0.68,
      reason: fallback ? 'Algo sidecar unavailable; local fallback.' : `Donna v2 ${route} route`,
      assistantMessage:
        source === 'optimize' ? `${assistantMessage} I optimized this around your constraints.` : assistantMessage,
      suggestion,
      priorityOrder,
      timelineUpdates
    }
  }, [])

  const runFeasibilityQuery = useCallback(
    async (queryText = 'Can I take Friday night off?') => {
      if (!v2LastRequest) {
        return { ok: false, reason: 'no_plan' }
      }

      const text = String(queryText || '').toLowerCase()
      const blocked = []
      for (const slot of v2LastRequest.slots || []) {
        const start = new Date(slot.start)
        if (Number.isNaN(start.getTime())) continue
        const isFriday = start.getDay() === 5
        const isEvening = start.getHours() >= 18 && start.getHours() <= 23
        if (text.includes('friday') && text.includes('night') && isFriday && isEvening) {
          blocked.push(slot.id)
        }
      }

      try {
        const result = await feasibilityPlanV2({
          base: v2LastRequest,
          extraBlockedSlotIds: blocked
        })
        setV2Feasibility(result?.result || null)
        return { ok: true, result: result?.result || null }
      } catch (error) {
        const mapped = mapConnectivityError(error)
        setAuthConnectivityError(mapped)
        return { ok: false, reason: mapped.reason || 'provider_error' }
      }
    },
    [v2LastRequest]
  )

  const refreshV2Benchmarks = useCallback(async () => {
    try {
      const response = await benchmarkMetricsV2()
      setV2Benchmarks(response || null)
      return response
    } catch {
      return null
    }
  }, [])

  const runPlanner = async (message, source = 'chat') => {
    const trimmed = String(message || '').trim()
    if (!trimmed || sending) return

    pushUserMessage(trimmed)
    setSending(true)

    try {
      const solveRequest = buildV2SolveRequestFromState()
      setV2LastRequest(solveRequest)
      const v2Response = await solvePlanV2({
        message: trimmed,
        request: solveRequest,
        tokenCostCents: 1.2,
        apiKey: apiKeyRef.current || undefined,
        providerMode: providerModeRef.current,
        localModel: localModelRef.current || undefined
      })

      const plannerResult = convertV2ResponseToPlannerResult(v2Response, solveRequest, source)
      setV2PlannerMeta({
        route: String(v2Response?.routeDecision?.route || plannerResult.route || 'standard'),
        latencyMs: Number(v2Response?.latencyMs || 0),
        fallback: Boolean(v2Response?.fallback || v2Response?.llmFallback),
        providerUsed: String(v2Response?.providerUsed || providerModeRef.current || 'groq'),
        fallbackReason: String(v2Response?.fallbackReason || '')
      })
      setV2EstimateBands(Array.isArray(v2Response?.estimateBands) ? v2Response.estimateBands : [])
      setV2Forecast(Array.isArray(v2Response?.workloadForecast) ? v2Response.workloadForecast : [])

      if (source === 'optimize') {
        await notifyDecisionV2({
          hourOfDay: new Date().getHours(),
          dayOfWeek: new Date().getDay(),
          urgencyBucket: 'high'
        }).catch(() => null)
      }

      applyResult(plannerResult, source === 'chat' ? 'replan' : source)
      pushAssistantMessage(plannerResult.assistantMessage, plannerResult.route || 'standard')
    } catch {
      // Fallback to existing v1 planner path when v2 is unavailable or misconfigured.
      try {
        const routeDecision = chooseModelRoute({
          message: trimmed,
          state: dashboard,
          hasApiKey: Boolean(apiKeyRef.current),
          hasServerPlanner: true
        })

        const plannerRequest = {
          ...buildPlannerRequest(dashboard, trimmed),
          aiPersonalization: settings.aiPersonalization,
          contextualLayers: settings.contextualLayers,
          aspirations: aspirations.map((item) => ({
            title: item.title,
            subtext: item.subtext,
            status: item.status,
            progress: item.progress,
            targetLabel: item.targetLabel
          }))
        }

        let plannerResult
        if (routeDecision.route === 'local') {
          plannerResult = runLocalPlanner(dashboard, trimmed, source)
        } else {
          plannerResult = await runDonnaPlannerApi({
            request: plannerRequest,
            route: routeDecision.route,
            source,
            apiKey: apiKeyRef.current || undefined,
            providerMode: providerModeRef.current,
            localModel: localModelRef.current || undefined
          })
          if (plannerResult?.usage) {
            setPlannerUsage({
              ok: true,
              eligibility: plannerResult?.eligibility || null,
              ...(plannerResult.usage || {})
            })
          }
        }

        setV2PlannerMeta({
          route: 'legacy',
          latencyMs: 0,
          fallback: Boolean(plannerResult?.fallback),
          providerUsed: String(plannerResult?.providerUsed || providerModeRef.current || 'groq'),
          fallbackReason: String(plannerResult?.fallbackReason || '')
        })
        applyResult(plannerResult, source === 'chat' ? 'replan' : source)
        pushAssistantMessage(plannerResult.assistantMessage, plannerResult.route || 'local')
      } catch (fallbackError) {
        const mapped = mapConnectivityError(fallbackError)
        if (
          mapped.reason === 'backend_unavailable' ||
          mapped.reason === 'misconfigured' ||
          mapped.reason === 'provider_error'
        ) {
          setAuthConnectivityError(mapped)
        }
        const fallback = runLocalPlanner(dashboard, trimmed, source)
        fallback.assistantMessage =
          'I switched to local planning for reliability and updated your plan. Bring the backend up to use algorithmic scheduling.'
        setV2PlannerMeta({ route: 'local', latencyMs: 0, fallback: true, providerUsed: 'local_deterministic', fallbackReason: 'backend_or_provider_unavailable' })
        applyResult(fallback, source === 'chat' ? 'replan' : source)
        pushAssistantMessage(fallback.assistantMessage, 'local')
      }
    } finally {
      setSending(false)
    }
  }

  const askDonnaSchedule = async ({ title, context = '', targetLabel = '' }) => {
    const readiness = getDonnaExternalReadiness()
    const safeTitle = String(title || 'this task').trim()
    const safeContext = String(context || '').trim()
    const safeTarget = String(targetLabel || '').trim()
    const prompt = [
      `Schedule ${safeTitle} into today's plan.`,
      safeContext ? `Context: ${safeContext}.` : '',
      safeTarget ? `Target: ${safeTarget}.` : '',
      readiness.ok
        ? 'Suggest exact time blocks and optimize around existing commitments.'
        : 'Suggest local plan blocks only (calendar execution unavailable right now).'
    ]
      .filter(Boolean)
      .join(' ')

    if (!readiness.ok && readiness.state !== 'connection_pending') {
      pushInsight('donna', 'External calendar unavailable', readiness.message, 'warning')
    }

    setChatOpen(true)
    await runPlanner(prompt, 'optimize')

    if (!readiness.ok) {
      return readiness
    }

    try {
      const contextResult = await getCalendarContextWithGuard()
      let start = null
      let end = null

      if (contextResult?.ok && Array.isArray(contextResult?.context?.freeWindows)) {
        const candidate = contextResult.context.freeWindows.find((window) => Number(window.minutes || 0) >= 45)
        if (candidate?.start && candidate?.end) {
          start = candidate.start
          const computedEnd = addMinutes(start, Math.min(90, Math.max(45, Number(candidate.minutes || 60))))
          end = computedEnd && new Date(computedEnd).getTime() < new Date(candidate.end).getTime() ? computedEnd : candidate.end
        }
      }

      if (!start || !end) {
        const fallbackStart = new Date()
        fallbackStart.setHours(20, 0, 0, 0)
        if (fallbackStart.getTime() <= Date.now()) fallbackStart.setDate(fallbackStart.getDate() + 1)
        start = fallbackStart.toISOString()
        end = addMinutes(start, 60)
      }

      const proposal = await proposeStudyBlockAction({
        title: `Study Block: ${safeTitle}`,
        start,
        end,
        description: `Donna suggestion from planning flow.${safeContext ? ` Context: ${safeContext}` : ''}`,
        metadata: {
          trigger: 'ask_donna_schedule',
          targetLabel: safeTarget
        }
      })

      if (proposal?.ok) {
        pushInsight('donna', 'Study block proposed', `${safeTitle} is ready for approval in Donna chat.`, 'info')
      }
    } catch {
      // Keep local planning flow resilient even if proposal creation fails.
    }

    return readiness
  }

  const getCalendarContextWithGuard = async () => {
    const readiness = getDonnaExternalReadiness()
    if (!readiness.ok) {
      return {
        ok: false,
        ...readiness,
        events: [],
        context: null
      }
    }

    try {
      const response = await getDonnaCalendarContext()
      await refreshAuthConnectivity({ silent: true })
      return {
        ok: true,
        state: 'connected_ready',
        events: response?.events || [],
        context: response?.context || null
      }
    } catch (error) {
      const mapped = mapConnectivityError(error)
      setAuthConnectivityError(mapped)
      return {
        ok: false,
        ...mapped,
        events: [],
        context: null
      }
    }
  }

  const fetchDonnaActions = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setDonnaActionsLoading(true)
    setDonnaActionsError(null)

    try {
      const response = await listDonnaActions()
      const normalized = Array.isArray(response?.actions)
        ? response.actions.map((item, index) => normalizeDonnaAction(item, index))
        : []
      setDonnaActions(normalized)
      return {
        ok: true,
        actions: normalized
      }
    } catch (error) {
      const mapped = mapConnectivityError(error)
      setAuthConnectivityError(mapped)
      setDonnaActionsError(mapped)
      return {
        ok: false,
        ...mapped,
        actions: []
      }
    } finally {
      setDonnaActionsLoading(false)
    }
  }, [])

  const normalizeStudyBlockProposal = (payload = {}) => {
    const title = String(payload?.title || 'Study Block').trim() || 'Study Block'
    const startIso = toIsoOrNull(payload?.start) || toIsoOrNull(payload?.startAt) || addMinutes(new Date().toISOString(), 60)
    const endIso =
      toIsoOrNull(payload?.end) ||
      toIsoOrNull(payload?.endAt) ||
      addMinutes(startIso, Math.max(15, Number(payload?.durationMinutes || 60)))

    return {
      title,
      start: startIso,
      end: endIso,
      description:
        String(payload?.description || '').trim() ||
        `Donna scheduled this focus block for ${title}.`,
      source: String(payload?.source || 'donna').trim() || 'donna',
      metadata: {
        createdBy: 'donna',
        intent: String(payload?.metadata?.intent || 'study_block'),
        ...((payload?.metadata && typeof payload.metadata === 'object') ? payload.metadata : {})
      }
    }
  }

  const studyBlockProposalHash = (payload = {}) =>
    `${String(payload.title || '').trim().toLowerCase()}|${String(payload.start || '')}|${String(
      payload.end || ''
    )}`

  const proposeStudyBlockAction = async (payload = {}) => {
    if (donnaActionExecution.inFlight) {
      return toCanonicalFailure('provider_error', 'Another study block action is in progress.', {
        state: 'connection_pending',
        action: null
      })
    }

    const readiness = getDonnaExternalReadiness()
    if (!readiness.ok) {
      if (readiness.code === 'login_required') {
        return toCanonicalFailure('login_required', readiness.message, { state: readiness.state, action: null })
      }
      if (readiness.code === 'connect_provider_required') {
        return toCanonicalFailure('connect_provider_required', readiness.message, {
          state: readiness.state,
          action: null
        })
      }
      if (readiness.code === 'misconfigured') {
        return toCanonicalFailure('misconfigured', readiness.message, { state: readiness.state, action: null })
      }
      if (readiness.code === 'backend_unavailable') {
        return toCanonicalFailure('backend_unavailable', readiness.message, {
          state: readiness.state,
          action: null
        })
      }
      return toCanonicalFailure('provider_error', readiness.message, { state: readiness.state, action: null })
    }

    const proposalPayload = normalizeStudyBlockProposal(payload)
    const payloadHash = studyBlockProposalHash(proposalPayload)
    if (proposalInFlightRef.current.has(payloadHash)) {
      return toCanonicalFailure('provider_error', 'A matching proposal is already being created.', {
        state: 'connection_pending',
        action: null
      })
    }
    const duplicateExisting = donnaActions.find((item) => {
      if (item.status !== 'proposed') return false
      return (
        String(item.payload?.title || '').trim().toLowerCase() ===
          String(proposalPayload.title || '').trim().toLowerCase() &&
        String(item.payload?.start || '') === String(proposalPayload.start || '')
      )
    })
    if (duplicateExisting) {
      return {
        ok: true,
        state: 'connected_ready',
        action: duplicateExisting
      }
    }

    if (!proposalPayload.start || !proposalPayload.end) {
      return toCanonicalFailure('execution_failed', 'Invalid date range for study block.', {
        state: 'provider_error',
        action: null
      })
    }

    try {
      proposalInFlightRef.current.add(payloadHash)
      const proposed = await proposeStudyBlock(proposalPayload)
      if (!proposed?.action?.id) {
        return toCanonicalFailure('provider_error', 'Could not create study block proposal.', {
          state: 'provider_error',
          action: null
        })
      }

      const normalized = normalizeDonnaAction(proposed.action, 0)
      setDonnaActions((prev) => [normalized, ...prev.filter((item) => item.id !== normalized.id)])
      setDonnaActionsError(null)
      pushInsight('donna', 'Study block proposed', `${normalized.payload.title} is waiting for approval.`, 'info')
      return {
        ok: true,
        state: 'connected_ready',
        action: normalized
      }
    } catch (error) {
      const mapped = mapConnectivityError(error)
      setAuthConnectivityError(mapped)
      setDonnaActionsError(mapped)
      if (mapped.reason === 'login_required') {
        return toCanonicalFailure('login_required', mapped.message, { state: mapped.state, action: null })
      }
      if (mapped.reason === 'connect_provider_required') {
        return toCanonicalFailure('connect_provider_required', mapped.message, {
          state: mapped.state,
          action: null
        })
      }
      if (mapped.reason === 'misconfigured') {
        return toCanonicalFailure('misconfigured', mapped.message, { state: mapped.state, action: null })
      }
      if (mapped.reason === 'backend_unavailable') {
        return toCanonicalFailure('backend_unavailable', mapped.message, { state: mapped.state, action: null })
      }
      return toCanonicalFailure('provider_error', mapped.message, { state: mapped.state, action: null })
    } finally {
      proposalInFlightRef.current.delete(payloadHash)
      await fetchDonnaActions({ silent: true })
    }
  }

  const approveStudyBlockAction = async (actionId) => {
    const readiness = getDonnaExternalReadiness()
    if (!readiness.ok) {
      if (readiness.code === 'login_required') {
        return toCanonicalFailure('login_required', readiness.message, { state: readiness.state, action: null })
      }
      if (readiness.code === 'connect_provider_required') {
        return toCanonicalFailure('connect_provider_required', readiness.message, {
          state: readiness.state,
          action: null
        })
      }
      if (readiness.code === 'misconfigured') {
        return toCanonicalFailure('misconfigured', readiness.message, { state: readiness.state, action: null })
      }
      if (readiness.code === 'backend_unavailable') {
        return toCanonicalFailure('backend_unavailable', readiness.message, {
          state: readiness.state,
          action: null
        })
      }
      return toCanonicalFailure('provider_error', readiness.message, { state: readiness.state, action: null })
    }

    const targetId = String(actionId || '').trim()
    if (!targetId) {
      return toCanonicalFailure('execution_failed', 'Missing action id.', { state: 'provider_error', action: null })
    }

    if (donnaActionExecution.inFlight && donnaActionExecution.actionId === targetId) {
      return toCanonicalFailure('provider_error', 'Action execution already in progress.', {
        state: 'connection_pending',
        action: null
      })
    }

    setDonnaActionExecution({
      inFlight: true,
      actionId: targetId,
      lastResult: null
    })

    try {
      const approved = await approveDonnaAction(targetId)
      const normalized = normalizeDonnaAction(approved?.action || { id: targetId }, 0)
      setDonnaActions((prev) => [normalized, ...prev.filter((item) => item.id !== normalized.id)])
      await fetchDonnaActions({ silent: true })
      await refreshAuthConnectivity({ silent: true })
      pushInsight(
        'donna',
        normalized.status === 'executed' ? 'Study block created' : 'Study block updated',
        normalized.status === 'executed'
          ? `${normalized.payload.title} was added to Google Calendar.`
          : `${normalized.payload.title} action status is ${normalized.status}.`,
        normalized.status === 'executed' ? 'success' : 'info'
      )
      setDonnaActionExecution({
        inFlight: false,
        actionId: '',
        lastResult: { ok: true, actionId: targetId, status: normalized.status }
      })
      if (normalized.status === 'executed') {
        const rawHours =
          (new Date(normalized.payload.end).getTime() - new Date(normalized.payload.start).getTime()) /
          (1000 * 60 * 60)
        const predictedHours = Number.isFinite(rawHours) && rawHours > 0 ? rawHours : 1
        await logWorkEventV2({
          taskId: normalized.id,
          slotId: normalized.result?.googleEventId || normalized.result?.start || '',
          predictedHours,
          actualHours: predictedHours,
          completionStatus: 'completed'
        }).catch(() => null)
      }
      return {
        ok: true,
        state: normalized.status === 'executed' ? 'connected_ready' : 'provider_error',
        action: normalized
      }
    } catch (error) {
      const mapped = mapConnectivityError(error)
      const failure =
        mapped.reason === 'execution_failed'
          ? mapped
          : { ...mapped, reason: 'execution_failed', message: mapped.message || 'Calendar execution failed.' }
      setAuthConnectivityError(failure)
      setDonnaActionsError(failure)
      await fetchDonnaActions({ silent: true })
      setDonnaActionExecution({
        inFlight: false,
        actionId: '',
        lastResult: { ok: false, actionId: targetId, reason: failure.reason }
      })
      pushInsight('donna', 'Study block failed', failure.message, 'warning')
      if (failure.reason === 'login_required') {
        return toCanonicalFailure('login_required', failure.message, { state: failure.state, action: null })
      }
      if (failure.reason === 'connect_provider_required') {
        return toCanonicalFailure('connect_provider_required', failure.message, {
          state: failure.state,
          action: null
        })
      }
      if (failure.reason === 'misconfigured') {
        return toCanonicalFailure('misconfigured', failure.message, { state: failure.state, action: null })
      }
      if (failure.reason === 'backend_unavailable') {
        return toCanonicalFailure('backend_unavailable', failure.message, {
          state: failure.state,
          action: null
        })
      }
      if (failure.reason === 'execution_failed') {
        return toCanonicalFailure('execution_failed', failure.message, { state: failure.state, action: null })
      }
      return toCanonicalFailure('provider_error', failure.message, { state: failure.state, action: null })
    } finally {
      await fetchDonnaActions({ silent: true })
    }
  }

  const createStudyBlockWithApproval = async (payload) => {
    if (donnaActionExecution.inFlight) {
      return {
        ok: false,
        state: 'connection_pending',
        reason: 'execution_in_flight',
        message: 'Action execution already in progress.',
        action: null
      }
    }
    const proposed = await proposeStudyBlockAction(payload)
    if (!proposed?.ok || !proposed?.action?.id) {
      return proposed
    }

    return approveStudyBlockAction(proposed.action.id)
  }

  const listDonnaActionsWithGuard = async () => {
    const readiness = getDonnaExternalReadiness()
    if (!readiness.ok && readiness.state === 'unauthenticated') {
      return { ok: false, ...readiness, actions: [] }
    }

    const response = await fetchDonnaActions()
    if (!response.ok) {
      return {
        ok: false,
        ...response,
        actions: []
      }
    }

    return {
      ok: true,
      state: readiness.ok ? readiness.state : 'authenticated_unconnected',
      actions: response.actions
    }
  }

  useEffect(() => {
    if (!authState.authenticated) {
      clearExternalRuntimeState()
      return
    }
    fetchDonnaActions({ silent: true })
  }, [authState.authenticated, clearExternalRuntimeState, fetchDonnaActions])

  useEffect(() => {
    if (!authState.authenticated) {
      setPlannerUsage(null)
      setPlannerUsageLoading(false)
      return
    }
    refreshPlannerUsage({ silent: true })
  }, [authState.authenticated, refreshPlannerUsage])

  const createCalendarEvent = (payload) => {
    const title = String(payload?.title || '').trim()
    const date = String(payload?.date || '').trim()
    if (!title || !date) return false

    const next = normalizeCalendarEvent({
      id: uid('ev'),
      title,
      date,
      startTime: String(payload?.startTime || '09:00'),
      endTime: String(payload?.endTime || '10:00'),
      kind: String(payload?.kind || 'class')
    })

    setCalendarEvents((prev) => [next, ...prev])
    return true
  }

  const updateCalendarEvent = (eventId, patch) => {
    setCalendarEvents((prev) =>
      prev.map((item) => {
        if (item.id !== eventId) return item
        return normalizeCalendarEvent({ ...item, ...patch })
      })
    )
  }

  const deleteCalendarEvent = (eventId) => {
    setCalendarEvents((prev) => prev.filter((item) => item.id !== eventId))
  }

  const logExamStudySession = (examId, payload = {}) => {
    const minutes = Math.max(5, Math.min(300, Number(payload.minutes || 30)))
    const note = String(payload.note || '').trim()
    const session = {
      id: uid('exam-s'),
      examId,
      minutes,
      note,
      createdAt: Date.now()
    }
    setExamStudySessions((prev) => [session, ...prev])
  }

  const updateSettingsDraft = (nextSettings) => {
    setSettings((prev) =>
      normalizeSettings({
        ...prev,
        ...nextSettings,
        alerts: { ...prev.alerts, ...(nextSettings?.alerts || {}) },
        aiPersonalization: { ...prev.aiPersonalization, ...(nextSettings?.aiPersonalization || {}) },
        contextualLayers: { ...prev.contextualLayers, ...(nextSettings?.contextualLayers || {}) }
      })
    )
  }

  const saveSettingsAndProfile = ({ nextProfile, nextSettings }) => {
    if (nextProfile) setProfile((prev) => ({ ...prev, ...nextProfile }))
    if (nextSettings) updateSettingsDraft(nextSettings)
    pushInsight('donna', 'Settings updated', 'Configuration changes were saved.', 'success')
  }

  const completeOnboarding = ({ name, institution, major, focus } = {}) => {
    const safeName = String(name || '').trim()
    const safeInstitution = String(institution || '').trim()
    const safeMajor = String(major || '').trim()
    const safeFocus = String(focus || '').trim()

    setProfile((prev) => ({
      ...prev,
      ...(safeName ? { name: safeName } : {}),
      ...(safeInstitution ? { institution: safeInstitution } : {}),
      ...(safeMajor ? { major: safeMajor } : {}),
      ...(safeFocus ? { focus: safeFocus } : {})
    }))
    setOnboardingCompleted(true)
    pushInsight('donna', 'Welcome to Donna', 'Onboarding complete. Your workspace is ready.', 'success')
  }

  const resetLocalData = () => {
    if (storageScope) {
      removeScopedStorage(STORAGE_KEYS.profile, storageScope)
      removeScopedStorage(STORAGE_KEYS.onboarding, storageScope)
      removeScopedStorage(STORAGE_KEYS.dashboard, storageScope)
      removeScopedStorage(STORAGE_KEYS.chat, storageScope)
      removeScopedStorage(STORAGE_KEYS.focusHistory, storageScope)
      removeScopedStorage(STORAGE_KEYS.apiKey, storageScope)
      removeScopedStorage(STORAGE_KEYS.providerMode, storageScope)
      removeScopedStorage(STORAGE_KEYS.localModel, storageScope)
      removeScopedSessionStorage(STORAGE_KEYS.apiKey, storageScope)
      removeScopedStorage(STORAGE_KEYS.aspirations, storageScope)
      removeScopedStorage(STORAGE_KEYS.aspirationsArchive, storageScope)
      removeScopedStorage(STORAGE_KEYS.aspirationSessions, storageScope)
      removeScopedStorage(STORAGE_KEYS.settings, storageScope)
      removeScopedStorage(STORAGE_KEYS.insightDesk, storageScope)
      removeScopedStorage(STORAGE_KEYS.connectivityStatus, storageScope)
      removeScopedStorage(STORAGE_KEYS.calendarEvents, storageScope)
      removeScopedStorage(STORAGE_KEYS.assignments, storageScope)
      removeScopedStorage(STORAGE_KEYS.exams, storageScope)
      removeScopedStorage(STORAGE_KEYS.examStudySessions, storageScope)
    }

    applyHydratedState(getModeDefaults(userMode), userMode)
    setAuthConnectivityError(null)
    setDonnaActions([])
    setDonnaActionsLoading(false)
    setDonnaActionsError(null)
    setDonnaActionExecution({ inFlight: false, actionId: '', lastResult: null })
    setAccountMenuOpen(false)
  }

  const setApiKeySession = (value) => {
    setApiKey(String(value || '').trim())
  }

  const setProviderModeSession = (value) => {
    setProviderMode(String(value || '').trim() === 'local_ollama' ? 'local_ollama' : 'groq')
  }

  const setLocalModelSession = (value) => {
    setLocalModel(String(value || '').trim())
  }

  const startLogin = (returnTo = window.location.href) => {
    const base = authState.loginUrl || '/login'
    const absolute = base.startsWith('http') ? base : `${window.location.origin}${base}`
    const target = new URL(absolute)
    target.searchParams.set('returnTo', returnTo)
    window.location.assign(target.toString())
  }

  const logoutSession = async (returnTo = window.location.href) => {
    try {
      const response = await logoutAuth({ returnTo })
      await refreshAuthConnectivity({ silent: true })
      if (response?.logoutUrl) {
        window.location.assign(response.logoutUrl)
        return true
      }
      return true
    } catch {
      return false
    }
  }

  const contextValue = {
    profile,
    dashboard,
    chatMessages,
    focusHistory,
    chatOpen,
    setChatOpen,
    sending,
    accountMenuOpen,
    setAccountMenuOpen,
    apiKeyEditorOpen,
    setApiKeyEditorOpen,
    hasApiKey: Boolean(apiKey),
    providerMode,
    localModel,
    optimizePriorities,
    acknowledgeSuggestion,
    toggleSessionPause,
    markPriorityComplete,
    reorderPriorities,
    runPlanner,
    resetLocalData,
    setApiKeySession,
    setProviderModeSession,
    setLocalModelSession,
    clearApiKey: () => setApiKey(''),
    authState,
    authConnectivity,
    userMode,
    onboardingCompleted,
    refreshAuthConnectivity,
    plannerUsage,
    plannerUsageLoading,
    refreshPlannerUsage,
    v2PlannerMeta,
    v2Feasibility,
    v2Forecast,
    v2EstimateBands,
    v2Benchmarks,
    runFeasibilityQuery,
    refreshV2Benchmarks,
    startLogin,
    logoutSession,
    setProfile,
    completeOnboarding,
    aspirations,
    aspirationsArchive,
    aspirationSessions,
    addAspiration,
    logAspirationSession,
    makeAspirationProgress,
    markAspirationDone,
    restoreAspiration,
    deleteAspiration,
    askDonnaSchedule,
    getCalendarContextWithGuard,
    proposeStudyBlockAction,
    approveStudyBlockAction,
    createStudyBlockWithApproval,
    fetchDonnaActions,
    listDonnaActionsWithGuard,
    donnaActions,
    donnaActionsLoading,
    donnaActionsError,
    donnaActionExecution,
    calendarEvents,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    assignments,
    setAssignments,
    exams,
    setExams,
    examStudySessions,
    logExamStudySession,
    insightDesk,
    unreadInsightCount,
    markInsightRead,
    markAllInsightsRead,
    settings,
    updateSettingsDraft,
    saveSettingsAndProfile,
    connectivityStatus,
    connectProvider,
    disconnectProvider,
    syncProvider
  }

  return <DashboardContext.Provider value={contextValue}>{children}</DashboardContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDashboard() {
  const context = useContext(DashboardContext)
  if (!context) throw new Error('useDashboard must be used within DashboardProvider')
  return context
}
