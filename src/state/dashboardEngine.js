const CLAMP_MIN = 0
const CLAMP_MAX = 100

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeekMonday(baseDate = new Date()) {
  const date = new Date(baseDate)
  const day = date.getDay()
  const diff = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diff)
  date.setHours(0, 0, 0, 0)
  return date
}

function toDateKey(date) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export const STORAGE_KEYS = {
  profile: 'donna.profile',
  onboarding: 'donna.onboarding',
  dashboard: 'donna.dashboardState',
  chat: 'donna.chatHistory',
  focusHistory: 'donna.focusHistory',
  apiKey: 'donna.apiKey',
  providerMode: 'donna.providerMode',
  localModel: 'donna.localModel',
  aspirations: 'donna.aspirations',
  aspirationsArchive: 'donna.aspirationsArchive',
  settings: 'donna.settings',
  insightDesk: 'donna.insightDesk',
  connectivityStatus: 'donna.connectivityStatus',
  calendarEvents: 'donna.calendarEvents',
  assignments: 'donna.assignments',
  exams: 'donna.exams',
  examStudySessions: 'donna.examStudySessions',
  aspirationSessions: 'donna.aspirationSessions'
}

export const DEFAULT_PROFILE = {
  name: 'Elena Vance',
  email: 'elena@donna.demo',
  role: 'Premium Student',
  avatar: '/images/overview-profile.jpg'
}

export const DEFAULT_DASHBOARD_STATE = {
  session: {
    task: 'Systems Homework',
    remainingSeconds: 42 * 60 + 18,
    isPaused: false
  },
  suggestion: {
    text: 'Work on your systems homework now. It is the highest-impact task before your 4 PM event.',
    visible: true,
    acknowledgedAt: null
  },
  priorities: [
    {
      id: 'p1',
      title: 'Submit Lab Report',
      meta: 'Biology 201 • 11:59 PM',
      impact: 95,
      urgency: 92,
      completed: false
    },
    {
      id: 'p2',
      title: 'Peer Review Session',
      meta: 'Design Studio • 2:30 PM',
      impact: 76,
      urgency: 74,
      completed: false
    },
    {
      id: 'p3',
      title: 'Econ Flashcards',
      meta: '15 mins • Knowledge Check',
      impact: 66,
      urgency: 60,
      completed: false
    }
  ],
  timeline: [
    {
      id: 't1',
      time: '09:00 AM',
      title: 'Modern Economics Class',
      detail: 'Lecture Hall B4',
      status: 'Live now'
    },
    {
      id: 't2',
      time: '11:00 AM',
      title: 'Deep Work: Econ Reading',
      detail: 'Library Sanctuary • 90 mins',
      status: ''
    },
    {
      id: 't3',
      time: '01:30 PM',
      title: 'Lunch Break',
      detail: 'Downtown Commons',
      status: ''
    }
  ],
  focusAssignments: {
    title: 'Econ Essay: Market Forces',
    due: 'Due in 3 days',
    note:
      'Based on your current research velocity and the 2,500 word requirement, you are trending toward a 12-hour delay. Consider starting the outline this afternoon.'
  },
  metrics: {
    contextSwitches: 1,
    replanCount: 0,
    optimizeCount: 0,
    acknowledgeCount: 0
  },
  ai: {
    lastRoute: 'local',
    lastConfidence: 0.6,
    lastReason: 'Initial baseline planning state.'
  },
  focus: {
    score: 92,
    reason: 'Strong progress and low context switching. Keep deep work blocks intact.'
  }
}

export const DEFAULT_CHAT_MESSAGES = [
  {
    id: 'm-welcome',
    role: 'assistant',
    text: 'I am Donna AI. I can optimize your day, explain score changes, and rebalance your priorities.',
    ts: Date.now()
  },
  {
    id: 'm-init-suggestion',
    role: 'assistant',
    text: 'Work on your systems homework first. It is the highest-impact task before 4 PM.',
    ts: Date.now() + 1
  }
]

export const DEFAULT_ASPIRATIONS = [
  {
    id: 'asp-thesis',
    title: 'Finish thesis chapter on AI governance',
    subtext: 'Draft and revise Chapter 4 with final citations and argument flow.',
    status: 'active',
    progress: 68,
    targetLabel: 'By end of May',
    startedAt: Date.now() - 1000 * 60 * 60 * 24 * 26,
    lastWorkedAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
    workSessionCount: 9,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    completedAt: null
  },
  {
    id: 'asp-intern',
    title: 'Get stronger at LeetCode graph problems',
    subtext: 'Solve graph traversal and shortest-path sets with weekly review.',
    status: 'active',
    progress: 34,
    targetLabel: 'By May 31',
    startedAt: Date.now() - 1000 * 60 * 60 * 24 * 18,
    lastWorkedAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    workSessionCount: 4,
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    completedAt: null
  },
  {
    id: 'asp-leetcode',
    title: 'Secure summer research internship',
    subtext: 'Refine portfolio, send outreach, and complete target lab follow-ups.',
    status: 'active',
    progress: 42,
    targetLabel: 'By June 15',
    startedAt: Date.now() - 1000 * 60 * 60 * 24 * 20,
    lastWorkedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
    workSessionCount: 5,
    createdAt: Date.now() - 1000 * 60 * 60 * 24,
    completedAt: null
  }
]

const DEFAULT_WEEK_START = startOfWeekMonday(new Date())

export const DEFAULT_CALENDAR_EVENTS = [
  {
    id: 'ev-1',
    title: 'Cognitive Psych',
    date: toDateKey(addDays(DEFAULT_WEEK_START, 0)),
    startTime: '09:00',
    endTime: '10:30',
    kind: 'class'
  },
  {
    id: 'ev-2',
    title: 'Literature Review',
    date: toDateKey(addDays(DEFAULT_WEEK_START, 0)),
    startTime: '15:00',
    endTime: '16:00',
    kind: 'ai'
  },
  {
    id: 'ev-3',
    title: 'Ethics in AI Seminar',
    date: toDateKey(addDays(DEFAULT_WEEK_START, 1)),
    startTime: '11:00',
    endTime: '13:00',
    kind: 'class'
  },
  {
    id: 'ev-4',
    title: 'Thesis Draft v2',
    date: toDateKey(addDays(DEFAULT_WEEK_START, 2)),
    startTime: '13:00',
    endTime: '15:00',
    kind: 'deep'
  },
  {
    id: 'ev-5',
    title: 'Macroeconomics',
    date: toDateKey(addDays(DEFAULT_WEEK_START, 3)),
    startTime: '14:00',
    endTime: '15:30',
    kind: 'class'
  },
  {
    id: 'ev-6',
    title: 'Weekly Reflection',
    date: toDateKey(addDays(DEFAULT_WEEK_START, 4)),
    startTime: '17:00',
    endTime: '17:45',
    kind: 'ai'
  }
]

export const DEFAULT_ASSIGNMENTS = [
  {
    id: 'as-1',
    title: 'Final Literature Analysis: Modernism',
    course: 'Eng 402',
    dueAt: `${toDateKey(addDays(new Date(), -1))}T23:59:00`,
    estimatedHours: 4,
    priority: 'High'
  },
  {
    id: 'as-2',
    title: 'Calculus III Problem Set 8',
    course: 'Math 250',
    dueAt: `${toDateKey(addDays(new Date(), 0))}T20:00:00`,
    estimatedHours: 2,
    priority: 'High'
  },
  {
    id: 'as-3',
    title: 'Microeconomics Market Simulation',
    course: 'Econ 101',
    dueAt: `${toDateKey(addDays(new Date(), 1))}T23:59:00`,
    estimatedHours: 1.5,
    priority: 'Medium'
  },
  {
    id: 'as-4',
    title: 'Organic Chem Lab Prep',
    course: 'Chem 301',
    dueAt: `${toDateKey(addDays(new Date(), 4))}T18:00:00`,
    estimatedHours: 1,
    priority: 'Low'
  },
  {
    id: 'as-5',
    title: 'Intro to Psychology Quiz Brief',
    course: 'Psych 101',
    dueAt: `${toDateKey(addDays(new Date(), 6))}T17:00:00`,
    estimatedHours: 1,
    priority: 'Medium'
  }
]

export const DEFAULT_EXAMS = [
  {
    id: 'ex-1',
    title: 'Economics Midterm',
    course: 'Econ 101',
    date: `${toDateKey(addDays(new Date(), 2))}T10:00:00`,
    type: 'Exam',
    previousEffortHours: 6.5
  },
  {
    id: 'ex-2',
    title: 'Psychology Quiz 3',
    course: 'Psych 101',
    date: `${toDateKey(addDays(new Date(), 5))}T09:30:00`,
    type: 'Quiz',
    previousEffortHours: 3.25
  },
  {
    id: 'ex-3',
    title: 'Algorithms Assessment',
    course: 'CS 220',
    date: `${toDateKey(addDays(new Date(), 12))}T14:00:00`,
    type: 'Exam',
    previousEffortHours: 7
  },
  {
    id: 'ex-4',
    title: 'Organic Chemistry Checkpoint',
    course: 'Chem 301',
    date: `${toDateKey(addDays(new Date(), 18))}T11:00:00`,
    type: 'Quiz',
    previousEffortHours: 4
  }
]

export const DEFAULT_EXAM_STUDY_SESSIONS = [
  {
    id: 'ex-s-1',
    examId: 'ex-1',
    minutes: 45,
    note: 'Reviewed inflation and policy models.',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2
  },
  {
    id: 'ex-s-2',
    examId: 'ex-1',
    minutes: 30,
    note: 'Solved timed practice set.',
    createdAt: Date.now() - 1000 * 60 * 60 * 24
  }
]

export const DEFAULT_ASPIRATION_SESSIONS = [
  {
    id: 'asp-s-1',
    aspirationId: 'asp-thesis',
    minutes: 60,
    note: 'Completed subsection draft and references.',
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2
  },
  {
    id: 'asp-s-2',
    aspirationId: 'asp-intern',
    minutes: 45,
    note: 'Solved graph traversal challenges.',
    createdAt: Date.now() - 1000 * 60 * 60 * 24
  }
]

export const DEFAULT_SETTINGS_STATE = {
  alerts: {
    deadlineReminders: true,
    aiInsightsPrepared: true,
    systemUpdates: false
  },
  aiPersonalization: {
    tone: 'Socratic & Encouraging',
    depth: 60,
    memoryEnabled: true
  },
  contextualLayers: {
    deadlinePressure: true,
    inactivitySignals: true,
    completionStreaks: true,
    layerWeight: 60
  }
}

export const DEFAULT_INSIGHT_DESK = [
  {
    id: 'insight-seed',
    source: 'rule',
    title: 'Aspirations are active',
    detail: 'Track completions and use Donna optimizations to maintain momentum.',
    severity: 'info',
    read: false,
    createdAt: Date.now()
  }
]

export const DEFAULT_CONNECTIVITY_STATUS = {
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

export const MINIMAL_PROFILE = {
  name: 'Student Workspace',
  email: '',
  role: 'Guest',
  avatar: '/images/overview-profile.jpg'
}

export const MINIMAL_DASHBOARD_STATE = {
  session: {
    task: 'Set your first focus session',
    remainingSeconds: 25 * 60,
    isPaused: true
  },
  suggestion: {
    text: 'Add assignments or connect Google Calendar to generate a personalized plan.',
    visible: false,
    acknowledgedAt: null
  },
  priorities: [
    {
      id: 'starter-priority-1',
      title: 'Add your first assignment',
      meta: 'Assessments workspace',
      impact: 65,
      urgency: 48,
      completed: false
    },
    {
      id: 'starter-priority-2',
      title: 'Connect Google Calendar',
      meta: 'Settings > Connectivity',
      impact: 60,
      urgency: 40,
      completed: false
    },
    {
      id: 'starter-priority-3',
      title: 'Ask Donna to propose today’s block',
      meta: 'Use the Donna widget',
      impact: 58,
      urgency: 38,
      completed: false
    }
  ],
  timeline: [
    {
      id: 'starter-timeline-1',
      time: '09:00 AM',
      title: 'No fixed events yet',
      detail: 'Connect calendar to sync your schedule.',
      status: ''
    },
    {
      id: 'starter-timeline-2',
      time: '12:00 PM',
      title: 'Build your first study plan',
      detail: 'Add priorities in the dashboard.',
      status: ''
    },
    {
      id: 'starter-timeline-3',
      time: '05:00 PM',
      title: 'Propose a study block',
      detail: 'Donna will draft it for your approval.',
      status: ''
    }
  ],
  focusAssignments: {
    title: 'No active focus assignment yet',
    due: 'Add assignments to prioritize',
    note: 'Donna will surface risk and readiness after you add real coursework.'
  },
  metrics: {
    contextSwitches: 0,
    replanCount: 0,
    optimizeCount: 0,
    acknowledgeCount: 0
  },
  ai: {
    lastRoute: 'local',
    lastConfidence: 0.5,
    lastReason: 'Starter workspace created.'
  },
  focus: {
    score: 68,
    reason: 'Starter mode active. Score will adapt once real tasks and sessions are added.'
  }
}

export const MINIMAL_CHAT_MESSAGES = [
  {
    id: 'm-starter-welcome',
    role: 'assistant',
    text: 'Welcome to Donna. Add an assignment or connect your calendar, then I can propose a focused study block.',
    ts: Date.now()
  }
]

export const MINIMAL_ASPIRATIONS = [
  {
    id: 'asp-starter',
    title: 'Define your first aspiration',
    subtext: 'Add a concrete academic objective and log progress sessions over time.',
    status: 'active',
    progress: 0,
    targetLabel: 'No target set',
    startedAt: Date.now(),
    lastWorkedAt: null,
    workSessionCount: 0,
    createdAt: Date.now(),
    completedAt: null
  }
]

export const MINIMAL_CALENDAR_EVENTS = []

export const MINIMAL_ASSIGNMENTS = [
  {
    id: 'as-starter-1',
    title: 'Add your first assignment',
    course: 'Starter',
    dueAt: `${toDateKey(addDays(new Date(), 2))}T20:00:00`,
    estimatedHours: 1,
    priority: 'Medium'
  }
]

export const MINIMAL_EXAMS = []
export const MINIMAL_EXAM_STUDY_SESSIONS = []
export const MINIMAL_ASPIRATION_SESSIONS = []
export const MINIMAL_INSIGHT_DESK = []

export function getModeDefaults(mode = 'demo') {
  if (mode === 'demo') {
    return {
      profile: DEFAULT_PROFILE,
      onboardingCompleted: true,
      dashboard: DEFAULT_DASHBOARD_STATE,
      chat: DEFAULT_CHAT_MESSAGES,
      focusHistory: [],
      apiKey: '',
      providerMode: 'groq',
      localModel: '',
      aspirations: DEFAULT_ASPIRATIONS,
      aspirationsArchive: [],
      aspirationSessions: DEFAULT_ASPIRATION_SESSIONS,
      settings: DEFAULT_SETTINGS_STATE,
      insightDesk: DEFAULT_INSIGHT_DESK,
      connectivityStatus: DEFAULT_CONNECTIVITY_STATUS,
      calendarEvents: DEFAULT_CALENDAR_EVENTS,
      assignments: DEFAULT_ASSIGNMENTS,
      exams: DEFAULT_EXAMS,
      examStudySessions: DEFAULT_EXAM_STUDY_SESSIONS
    }
  }

  return {
    profile: MINIMAL_PROFILE,
    onboardingCompleted: false,
    dashboard: MINIMAL_DASHBOARD_STATE,
    chat: MINIMAL_CHAT_MESSAGES,
    focusHistory: [],
    apiKey: '',
    providerMode: 'groq',
    localModel: '',
    aspirations: MINIMAL_ASPIRATIONS,
    aspirationsArchive: [],
    aspirationSessions: MINIMAL_ASPIRATION_SESSIONS,
    settings: DEFAULT_SETTINGS_STATE,
    insightDesk: MINIMAL_INSIGHT_DESK,
    connectivityStatus: DEFAULT_CONNECTIVITY_STATUS,
    calendarEvents: MINIMAL_CALENDAR_EVENTS,
    assignments: MINIMAL_ASSIGNMENTS,
    exams: MINIMAL_EXAMS,
    examStudySessions: MINIMAL_EXAM_STUDY_SESSIONS
  }
}

export function safeParse(value, fallback) {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function clamp(value, min = CLAMP_MIN, max = CLAMP_MAX) {
  return Math.max(min, Math.min(max, value))
}

function rankValue(priority) {
  const completionPenalty = priority.completed ? -100 : 0
  return priority.impact * 0.65 + priority.urgency * 0.35 + completionPenalty
}

function toFiniteNumber(value, fallback = 0) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function daysUntil(isoLike) {
  const timestamp = Date.parse(String(isoLike || ''))
  if (!Number.isFinite(timestamp)) return null
  return (timestamp - Date.now()) / (1000 * 60 * 60 * 24)
}

function rollingAverage(values = []) {
  if (!Array.isArray(values) || values.length === 0) return null
  const finite = values.map((value) => toFiniteNumber(value, NaN)).filter((value) => Number.isFinite(value))
  if (finite.length === 0) return null
  return finite.reduce((sum, value) => sum + value, 0) / finite.length
}

function buildFocusFeatures(state, context = {}) {
  const priorities = Array.isArray(state.priorities) ? state.priorities : []
  const completed = priorities.filter((item) => item.completed).length
  const completionRatio = priorities.length > 0 ? completed / priorities.length : 0.5

  const assignments = Array.isArray(context.assignments) ? context.assignments : []
  const exams = Array.isArray(context.exams) ? context.exams : []
  const calendarEvents = Array.isArray(context.calendarEvents) ? context.calendarEvents : []
  const focusHistory = Array.isArray(context.focusHistory) ? context.focusHistory : []

  let nearTermHours = 0
  let overdueHours = 0
  for (const assignment of assignments) {
    const dueInDays = daysUntil(assignment?.dueAt)
    const hours = Math.max(0, toFiniteNumber(assignment?.estimatedHours, 1))
    if (dueInDays === null) continue
    if (dueInDays < 0) overdueHours += hours
    if (dueInDays <= 2) nearTermHours += hours
  }

  let examPressure = 0
  for (const exam of exams) {
    const dueInDays = daysUntil(exam?.date)
    if (dueInDays === null) continue
    if (dueInDays <= 3) examPressure += 1
  }

  const dailyEventLoad = Math.min(calendarEvents.length / 8, 1)
  const sessionMinutes = Math.max(0, Math.ceil(toFiniteNumber(state.session?.remainingSeconds, 0) / 60))
  const pausedPenalty = state.session?.isPaused ? 1 : 0
  const contextSwitchLoad = Math.min(toFiniteNumber(state.metrics?.contextSwitches, 0) / 8, 1)
  const replanLoad = Math.min(toFiniteNumber(state.metrics?.replanCount, 0) / 8, 1)
  const overdueLoad = Math.min(overdueHours / 6, 1)
  const nearTermLoad = Math.min(nearTermHours / 8, 1)
  const examLoad = Math.min(examPressure / 3, 1)

  const recentScores = focusHistory.slice(-10).map((entry) => toFiniteNumber(entry?.score, NaN))
  const baselineAverage = rollingAverage(recentScores)
  const trend =
    recentScores.length >= 2
      ? Math.max(-1, Math.min(1, (recentScores[recentScores.length - 1] - recentScores[0]) / 20))
      : 0

  return {
    completionRatio,
    dailyEventLoad,
    sessionMinutes,
    pausedPenalty,
    contextSwitchLoad,
    replanLoad,
    overdueLoad,
    nearTermLoad,
    examLoad,
    baselineAverage,
    trend
  }
}

export function computeFocusTarget(state, context = {}) {
  const features = buildFocusFeatures(state, context)
  const momentumBoost = features.sessionMinutes > 0 && !features.pausedPenalty ? 0.06 : 0

  const normalized =
    0.52 +
    features.completionRatio * 0.28 +
    momentumBoost +
    features.trend * 0.1 -
    features.overdueLoad * 0.23 -
    features.nearTermLoad * 0.16 -
    features.examLoad * 0.08 -
    features.dailyEventLoad * 0.1 -
    features.contextSwitchLoad * 0.1 -
    features.replanLoad * 0.08 -
    features.pausedPenalty * 0.1

  const calibrated = clamp(Math.round(normalized * 100))
  if (features.baselineAverage === null) return calibrated
  return clamp(Math.round(calibrated * 0.7 + features.baselineAverage * 0.3))
}

export function buildFocusReason(state, targetScore, context = {}) {
  const features = buildFocusFeatures(state, context)
  const reasons = []
  if (features.completionRatio >= 0.6) reasons.push('strong completion ratio')
  if (features.overdueLoad > 0.2) reasons.push('overdue workload pressure')
  if (features.nearTermLoad > 0.35) reasons.push('heavy 48-hour deadline load')
  if (features.contextSwitchLoad <= 0.25) reasons.push('low context switching')
  if (features.replanLoad > 0.5) reasons.push('frequent replanning overhead')
  if (features.pausedPenalty) reasons.push('active session is paused')
  if (Math.abs(features.trend) > 0.15) reasons.push(features.trend > 0 ? 'upward focus trend' : 'focus trend slipping')
  if (reasons.length === 0) reasons.push('balanced workload cadence')

  return `Score ${targetScore}: ${reasons.join(', ')}.`
}

export function smoothFocusScore(previous, target) {
  return clamp(Math.round(previous * 0.75 + target * 0.25))
}

export function recomputeFocusState(state, reasonHint = '', context = {}) {
  const target = computeFocusTarget(state, context)
  const score = smoothFocusScore(state.focus.score, target)
  const reason = reasonHint || buildFocusReason(state, score, context)

  return {
    ...state,
    focus: {
      score,
      reason
    }
  }
}

function titleMap(items) {
  return new Map(items.map((item) => [item.title.toLowerCase(), item]))
}

function reorderPrioritiesByTitles(state, titles = []) {
  if (!Array.isArray(titles) || titles.length === 0) return state

  const map = titleMap(state.priorities)
  const used = new Set()
  const reordered = []

  for (const title of titles) {
    const item = map.get(String(title).toLowerCase())
    if (item && !used.has(item.id)) {
      reordered.push(item)
      used.add(item.id)
    }
  }

  for (const item of state.priorities) {
    if (!used.has(item.id)) reordered.push(item)
  }

  return {
    ...state,
    priorities: reordered
  }
}

function applyTimelineUpdates(state, updates = []) {
  if (!Array.isArray(updates) || updates.length === 0) return state

  const nextTimeline = state.timeline.map((item, index) => {
    const update = updates[index]
    if (!update) return item

    return {
      ...item,
      time: update.time || item.time,
      title: update.title || item.title,
      detail: update.detail || item.detail,
      status: update.status ?? item.status
    }
  })

  return {
    ...state,
    timeline: nextTimeline
  }
}

export function applyPlannerResult(state, result, source = 'planner') {
  let nextState = state

  if (result.priorityOrder) {
    nextState = reorderPrioritiesByTitles(nextState, result.priorityOrder)
  }

  if (result.timelineUpdates) {
    nextState = applyTimelineUpdates(nextState, result.timelineUpdates)
  }

  if (result.suggestion) {
    nextState = {
      ...nextState,
      suggestion: {
        ...nextState.suggestion,
        text: result.suggestion,
        visible: true
      }
    }
  }

  nextState = {
    ...nextState,
    metrics: {
      ...nextState.metrics,
      replanCount: nextState.metrics.replanCount + (source === 'replan' ? 1 : 0),
      optimizeCount: nextState.metrics.optimizeCount + (source === 'optimize' ? 1 : 0)
    },
    ai: {
      ...nextState.ai,
      lastConfidence: result.confidence ?? nextState.ai.lastConfidence,
      lastReason: result.reason ?? nextState.ai.lastReason,
      lastRoute: result.route ?? nextState.ai.lastRoute
    }
  }

  return recomputeFocusState(nextState)
}

export function buildPlannerRequest(state, userMessage) {
  return {
    message: userMessage,
    session: {
      task: state.session.task,
      remainingMinutes: Math.ceil(state.session.remainingSeconds / 60),
      paused: state.session.isPaused
    },
    priorities: state.priorities.map((item) => ({
      title: item.title,
      meta: item.meta,
      completed: item.completed,
      impact: item.impact,
      urgency: item.urgency
    })),
    timeline: state.timeline.map((item) => ({
      time: item.time,
      title: item.title,
      detail: item.detail,
      status: item.status
    })),
    focusScore: state.focus.score,
    suggestion: state.suggestion.text,
    metrics: state.metrics
  }
}

export function chooseModelRoute({ message, state, hasApiKey, hasServerPlanner = true }) {
  if (!hasApiKey && !hasServerPlanner) {
    return { route: 'local', reason: 'No BYOK key present.' }
  }

  const text = String(message || '').toLowerCase()
  const complexityTokens = ['conflict', 'reschedule', 'deadline', 'multi', 'balance', 'tradeoff', 'optimize']
  const complexHits = complexityTokens.filter((token) => text.includes(token)).length
  const longPrompt = text.length > 180
  const lowConfidence = state.ai.lastConfidence < 0.55

  if (complexHits >= 3 || (longPrompt && lowConfidence)) {
    return { route: 'strong', reason: 'High complexity or low confidence carryover.' }
  }

  if (complexHits >= 1 || longPrompt) {
    return { route: 'small', reason: 'Moderate complexity task.' }
  }

  return { route: 'local', reason: 'Simple request handled locally.' }
}

export function runLocalPlanner(state, message, source = 'chat') {
  const priorities = [...state.priorities].sort((a, b) => rankValue(b) - rankValue(a))
  const top = priorities[0]

  const timelineUpdates = [
    {
      time: state.timeline[0].time,
      title: `${top.title} Sprint`,
      detail: 'High-focus block • 45 mins',
      status: 'Recommended'
    },
    {
      time: state.timeline[1].time,
      title: state.timeline[1].title,
      detail: `${state.timeline[1].detail} • Buffer added`,
      status: ''
    }
  ]

  const suggestion = `Focus on ${top.title.toLowerCase()} first, then protect a single uninterrupted block before your afternoon events.`

  return {
    route: 'local',
    confidence: 0.62,
    reason: 'Deterministic local planner',
    assistantMessage:
      source === 'optimize'
        ? `I optimized your plan locally: ${top.title} is now top priority with a protected deep-work block.`
        : `I rebalanced your day locally. Start with ${top.title}, then continue with your scheduled study block.`,
    suggestion,
    priorityOrder: priorities.map((item) => item.title),
    timelineUpdates
  }
}

export function hydrateState({
  profileRaw,
  dashboardRaw,
  chatRaw,
  focusHistoryRaw,
  apiKeyRaw,
  providerModeRaw,
  localModelRaw,
  aspirationsRaw,
  aspirationsArchiveRaw,
  aspirationSessionsRaw,
  settingsRaw,
  insightDeskRaw,
  connectivityStatusRaw,
  calendarEventsRaw,
  assignmentsRaw,
  examsRaw,
  examStudySessionsRaw
}) {
  const profile = { ...DEFAULT_PROFILE, ...safeParse(profileRaw, {}) }
  const dashboard = { ...DEFAULT_DASHBOARD_STATE, ...safeParse(dashboardRaw, {}) }
  const chat = safeParse(chatRaw, DEFAULT_CHAT_MESSAGES)
  const focusHistory = safeParse(focusHistoryRaw, [])
  const apiKey = String(apiKeyRaw || '').trim()
  const providerMode = String(providerModeRaw || 'groq').trim() === 'local_ollama' ? 'local_ollama' : 'groq'
  const localModel = String(localModelRaw || '').trim()
  const aspirations = safeParse(aspirationsRaw, DEFAULT_ASPIRATIONS)
  const aspirationsArchive = safeParse(aspirationsArchiveRaw, [])
  const aspirationSessions = safeParse(aspirationSessionsRaw, DEFAULT_ASPIRATION_SESSIONS)
  const settings = { ...DEFAULT_SETTINGS_STATE, ...safeParse(settingsRaw, {}) }
  const insightDesk = safeParse(insightDeskRaw, DEFAULT_INSIGHT_DESK)
  const connectivityStatus = {
    ...DEFAULT_CONNECTIVITY_STATUS,
    ...safeParse(connectivityStatusRaw, {})
  }
  const calendarEvents = safeParse(calendarEventsRaw, DEFAULT_CALENDAR_EVENTS)
  const assignments = safeParse(assignmentsRaw, DEFAULT_ASSIGNMENTS)
  const exams = safeParse(examsRaw, DEFAULT_EXAMS)
  const examStudySessions = safeParse(examStudySessionsRaw, DEFAULT_EXAM_STUDY_SESSIONS)

  return {
    profile,
    dashboard,
    chat: Array.isArray(chat) && chat.length > 0 ? chat : DEFAULT_CHAT_MESSAGES,
    focusHistory: Array.isArray(focusHistory) ? focusHistory : [],
    apiKey,
    providerMode,
    localModel,
    aspirations: Array.isArray(aspirations) ? aspirations : DEFAULT_ASPIRATIONS,
    aspirationsArchive: Array.isArray(aspirationsArchive) ? aspirationsArchive : [],
    aspirationSessions: Array.isArray(aspirationSessions) ? aspirationSessions : DEFAULT_ASPIRATION_SESSIONS,
    settings,
    insightDesk: Array.isArray(insightDesk) ? insightDesk : DEFAULT_INSIGHT_DESK,
    connectivityStatus,
    calendarEvents: Array.isArray(calendarEvents) ? calendarEvents : DEFAULT_CALENDAR_EVENTS,
    assignments: Array.isArray(assignments) ? assignments : DEFAULT_ASSIGNMENTS,
    exams: Array.isArray(exams) ? exams : DEFAULT_EXAMS,
    examStudySessions: Array.isArray(examStudySessions) ? examStudySessions : DEFAULT_EXAM_STUDY_SESSIONS
  }
}
