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
  applyPlannerResult,
  buildFocusReason,
  buildPlannerRequest,
  chooseModelRoute,
  hydrateState,
  recomputeFocusState,
  runLocalPlanner,
  runOpenAIPlanner
} from './dashboardEngine'
import {
  ConnectivityApiError,
  approveDonnaAction,
  connectProviderApi,
  disconnectProviderApi,
  fetchProviders,
  getDonnaCalendarContext,
  getAuthMe,
  listDonnaActions,
  logoutAuth,
  proposeStudyBlock,
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
    kind: String(raw.kind || fallback?.kind || 'class')
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
    priority: String(raw.priority || fallback?.priority || 'Medium')
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
  const backendReason = String(error?.details?.reason || error?.details?.details?.reason || '').trim()
  if (!message) return { state: 'provider_error', reason: 'provider_error', message: 'Unable to complete request.' }

  if (error instanceof ConnectivityApiError) {
    if (backendReason === 'connect_provider_required') {
      return {
        state: 'authenticated_unconnected',
        reason: 'connect_provider_required',
        message: 'Google Calendar is not connected.'
      }
    }
    if (backendReason === 'execution_failed') {
      return { state: 'provider_error', reason: 'execution_failed', message: 'Calendar execution failed.' }
    }
    if (error.code === 'AUTH_REQUIRED' || error.status === 401) {
      return { state: 'unauthenticated', reason: 'login_required', message: 'Sign in required.' }
    }
    if (error.status === 409) {
      return { state: 'provider_error', reason: 'execution_failed', message: 'Action is no longer approvable.' }
    }
    if (error.status === 502) {
      return { state: 'provider_error', reason: 'execution_failed', message: 'Calendar execution failed.' }
    }
    if (error.status === 0 || message.includes('Failed to fetch')) {
      return { state: 'backend_unavailable', reason: 'backend_unavailable', message: 'Backend unavailable.' }
    }
    if (error.status >= 500 || message.includes('Google Calendar integration is not configured')) {
      return { state: 'misconfigured', reason: 'misconfigured', message: 'Calendar backend misconfigured.' }
    }
  }

  if (message.includes('Provider is not connected')) {
    return {
      state: 'authenticated_unconnected',
      reason: 'connect_provider_required',
      message: 'Google Calendar is not connected.'
    }
  }

  return { state: 'provider_error', reason: 'provider_error', message }
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

export function DashboardProvider({ children }) {
  const apiKeyRef = useRef('')

  const hydrated = useMemo(
    () =>
      hydrateState({
        profileRaw: localStorage.getItem(STORAGE_KEYS.profile),
        dashboardRaw: localStorage.getItem(STORAGE_KEYS.dashboard),
        chatRaw: localStorage.getItem(STORAGE_KEYS.chat),
        focusHistoryRaw: localStorage.getItem(STORAGE_KEYS.focusHistory),
        apiKeyRaw: localStorage.getItem(STORAGE_KEYS.apiKey),
        aspirationsRaw: localStorage.getItem(STORAGE_KEYS.aspirations),
        aspirationsArchiveRaw: localStorage.getItem(STORAGE_KEYS.aspirationsArchive),
        aspirationSessionsRaw: localStorage.getItem(STORAGE_KEYS.aspirationSessions),
        settingsRaw: localStorage.getItem(STORAGE_KEYS.settings),
        insightDeskRaw: localStorage.getItem(STORAGE_KEYS.insightDesk),
        connectivityStatusRaw: localStorage.getItem(STORAGE_KEYS.connectivityStatus),
        calendarEventsRaw: localStorage.getItem(STORAGE_KEYS.calendarEvents),
        assignmentsRaw: localStorage.getItem(STORAGE_KEYS.assignments),
        examsRaw: localStorage.getItem(STORAGE_KEYS.exams),
        examStudySessionsRaw: localStorage.getItem(STORAGE_KEYS.examStudySessions)
      }),
    []
  )

  const [profile, setProfile] = useState(hydrated.profile || DEFAULT_PROFILE)
  const [dashboard, setDashboard] = useState(hydrated.dashboard || DEFAULT_DASHBOARD_STATE)
  const [chatMessages, setChatMessages] = useState(hydrated.chat || DEFAULT_CHAT_MESSAGES)
  const [focusHistory, setFocusHistory] = useState(hydrated.focusHistory || [])
  const [apiKey, setApiKey] = useState(hydrated.apiKey || '')
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
    loginUrl: '/api/auth/login',
    logoutUrl: '/api/auth/logout'
  })
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

  useEffect(() => {
    apiKeyRef.current = apiKey
    localStorage.setItem(STORAGE_KEYS.apiKey, apiKey)
  }, [apiKey])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(profile))
  }, [profile])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.dashboard, JSON.stringify(dashboard))
  }, [dashboard])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.chat, JSON.stringify(chatMessages))
  }, [chatMessages])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.focusHistory, JSON.stringify(focusHistory))
  }, [focusHistory])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.aspirations, JSON.stringify(aspirations))
  }, [aspirations])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.aspirationsArchive, JSON.stringify(aspirationsArchive))
  }, [aspirationsArchive])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.aspirationSessions, JSON.stringify(aspirationSessions))
  }, [aspirationSessions])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.insightDesk, JSON.stringify(insightDesk))
  }, [insightDesk])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.connectivityStatus, JSON.stringify(connectivityStatus))
  }, [connectivityStatus])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.calendarEvents, JSON.stringify(calendarEvents))
  }, [calendarEvents])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.assignments, JSON.stringify(assignments))
  }, [assignments])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.exams, JSON.stringify(exams))
  }, [exams])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.examStudySessions, JSON.stringify(examStudySessions))
  }, [examStudySessions])

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
          const scored = recomputeFocusState(next, buildFocusReason(next, next.focus.score))
          setFocusHistory((history) => [...history.slice(-49), { ts: Date.now(), score: scored.focus.score }])
          return scored
        }

        return next
      })
    }, 1000)

    return () => window.clearInterval(interval)
  }, [])

  const refreshAuthConnectivity = useCallback(async ({ silent = false } = {}) => {
    setAuthConnectivityRefreshing(true)
    if (!silent) setAuthConnectivityLoading(true)

    try {
      const authData = await getAuthMe()
      const authSnapshot = {
        authenticated: Boolean(authData?.authenticated),
        user: authData?.user || null,
        loginUrl: String(authData?.loginUrl || '/api/auth/login'),
        logoutUrl: String(authData?.logoutUrl || '/api/auth/logout')
      }

      setAuthState(authSnapshot)

      let providerData = null
      if (authSnapshot.authenticated) {
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
  }, [clearExternalRuntimeState])

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
      const next = applyPlannerResult(prev, result, source)
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
        'Suggestion acknowledged; cognitive load reduced.'
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
          : 'Session paused; focus trend temporarily reduced.'
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
      return recomputeFocusState(next)
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

      return recomputeFocusState({ ...prev, priorities: ordered })
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
        loginUrl: authState.loginUrl || '/api/auth/login'
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
      const response = await connectProviderApi(provider, payload)
      if (response?.redirectUrl) {
        window.location.assign(response.redirectUrl)
        return true
      }
      if (response?.provider) {
        setConnectivityStatus((prev) => ({ ...prev, [key]: { ...prev[key], ...response.provider } }))
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
      const response = await disconnectProviderApi(provider)
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
      const response = await syncProviderApi(provider)
      if (response?.provider) {
        setConnectivityStatus((prev) => ({ ...prev, [key]: { ...prev[key], ...response.provider } }))
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

  const runPlanner = async (message, source = 'chat') => {
    const trimmed = String(message || '').trim()
    if (!trimmed || sending) return

    pushUserMessage(trimmed)
    setSending(true)

    const routeDecision = chooseModelRoute({
      message: trimmed,
      state: dashboard,
      hasApiKey: Boolean(apiKeyRef.current)
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

    try {
      let plannerResult
      if (routeDecision.route === 'local') {
        plannerResult = runLocalPlanner(dashboard, trimmed, source)
      } else {
        plannerResult = await runOpenAIPlanner({
          apiKey: apiKeyRef.current,
          request: plannerRequest,
          route: routeDecision.route,
          source
        })
      }

      applyResult(plannerResult, source === 'chat' ? 'replan' : source)
      pushAssistantMessage(plannerResult.assistantMessage, plannerResult.route)
    } catch {
      const fallback = runLocalPlanner(dashboard, trimmed, source)
      fallback.assistantMessage =
        'I switched to local planning for reliability and updated your plan. Add or refresh your BYOK key for cloud reasoning.'
      applyResult(fallback, source === 'chat' ? 'replan' : source)
      pushAssistantMessage(fallback.assistantMessage, 'local')
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

  const resetLocalData = () => {
    localStorage.removeItem(STORAGE_KEYS.profile)
    localStorage.removeItem(STORAGE_KEYS.dashboard)
    localStorage.removeItem(STORAGE_KEYS.chat)
    localStorage.removeItem(STORAGE_KEYS.focusHistory)
    localStorage.removeItem(STORAGE_KEYS.apiKey)
    localStorage.removeItem(STORAGE_KEYS.aspirations)
    localStorage.removeItem(STORAGE_KEYS.aspirationsArchive)
    localStorage.removeItem(STORAGE_KEYS.aspirationSessions)
    localStorage.removeItem(STORAGE_KEYS.settings)
    localStorage.removeItem(STORAGE_KEYS.insightDesk)
    localStorage.removeItem(STORAGE_KEYS.connectivityStatus)
    localStorage.removeItem(STORAGE_KEYS.calendarEvents)
    localStorage.removeItem(STORAGE_KEYS.assignments)
    localStorage.removeItem(STORAGE_KEYS.exams)
    localStorage.removeItem(STORAGE_KEYS.examStudySessions)

    setProfile(DEFAULT_PROFILE)
    setDashboard(DEFAULT_DASHBOARD_STATE)
    setChatMessages(DEFAULT_CHAT_MESSAGES)
    setFocusHistory([])
    setApiKey('')
    setAspirations(DEFAULT_ASPIRATIONS)
    setAspirationsArchive([])
    setAspirationSessions(DEFAULT_ASPIRATION_SESSIONS)
    setSettings(DEFAULT_SETTINGS_STATE)
    setInsightDesk(DEFAULT_INSIGHT_DESK)
    setConnectivityStatus(DEFAULT_CONNECTIVITY_STATUS)
    setAuthConnectivityError(null)
    setDonnaActions([])
    setDonnaActionsLoading(false)
    setDonnaActionsError(null)
    setDonnaActionExecution({ inFlight: false, actionId: '', lastResult: null })
    setCalendarEvents(DEFAULT_CALENDAR_EVENTS)
    setAssignments(DEFAULT_ASSIGNMENTS)
    setExams(DEFAULT_EXAMS)
    setExamStudySessions(DEFAULT_EXAM_STUDY_SESSIONS)
    setAccountMenuOpen(false)
  }

  const setApiKeySession = (value) => {
    setApiKey(String(value || '').trim())
  }

  const startLogin = (returnTo = window.location.href) => {
    const base = authState.loginUrl || '/api/auth/login'
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
    optimizePriorities,
    acknowledgeSuggestion,
    toggleSessionPause,
    markPriorityComplete,
    reorderPriorities,
    runPlanner,
    resetLocalData,
    setApiKeySession,
    clearApiKey: () => setApiKey(''),
    authState,
    authConnectivity,
    refreshAuthConnectivity,
    startLogin,
    logoutSession,
    setProfile,
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
