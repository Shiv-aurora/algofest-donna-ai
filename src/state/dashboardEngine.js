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
  dashboard: 'donna.dashboardState',
  chat: 'donna.chatHistory',
  focusHistory: 'donna.focusHistory',
  apiKey: 'donna.apiKey',
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
  name: 'Shivam Arora',
  email: 'shivam@donna.local',
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
    connected: false,
    lastSyncAt: null,
    status: 'idle',
    errorMessage: '',
    institutionDomain: ''
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

export function computeFocusTarget(state) {
  const priorities = state.priorities
  const completed = priorities.filter((item) => item.completed).length
  const pending = priorities.length - completed
  const overduePressure = state.focusAssignments.title ? 1 : 0
  const pausePenalty = state.session.isPaused ? 6 : 0

  const value =
    72 +
    completed * 9 -
    pending * 2 -
    state.metrics.contextSwitches * 2 -
    overduePressure * 3 -
    pausePenalty +
    Math.max(0, 4 - state.metrics.replanCount)

  return clamp(Math.round(value))
}

export function buildFocusReason(state, targetScore) {
  const reasons = []
  const completed = state.priorities.filter((item) => item.completed).length

  if (completed > 0) reasons.push('completed priority tasks')
  if (state.metrics.contextSwitches <= 2) reasons.push('limited context switching')
  if (state.session.isPaused) reasons.push('session is paused')
  if (state.metrics.replanCount > 3) reasons.push('frequent replanning overhead')

  if (reasons.length === 0) reasons.push('steady study cadence')

  return `Score ${targetScore}: ${reasons.join(', ')}.`
}

export function smoothFocusScore(previous, target) {
  return clamp(Math.round(previous * 0.75 + target * 0.25))
}

export function recomputeFocusState(state, reasonHint = '') {
  const target = computeFocusTarget(state)
  const score = smoothFocusScore(state.focus.score, target)
  const reason = reasonHint || buildFocusReason(state, score)

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

export function chooseModelRoute({ message, state, hasApiKey }) {
  if (!hasApiKey) {
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

function extractJson(content) {
  if (!content) return null
  const trimmed = content.trim()

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

export async function runOpenAIPlanner({ apiKey, request, route, source }) {
  const model = route === 'strong' ? 'gpt-4.1' : 'gpt-4.1-mini'
  const systemPrompt =
    'You are Donna AI planner. Return JSON only with keys: assistantMessage, confidence (0..1), suggestion, priorityOrder (array of priority titles), timelineUpdates (array of {time,title,detail,status}), reason.'

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Planning source: ${source}\n${JSON.stringify(request)}`
        }
      ]
    })
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`OpenAI error ${response.status}: ${text.slice(0, 180)}`)
  }

  const json = await response.json()
  const content = json?.choices?.[0]?.message?.content ?? ''
  const parsed = extractJson(content)

  if (!parsed) {
    throw new Error('Planner response was not valid JSON.')
  }

  return {
    route,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : route === 'strong' ? 0.83 : 0.72,
    reason: parsed.reason || `OpenAI ${model} planner`,
    assistantMessage: parsed.assistantMessage || 'I optimized the plan and updated your dashboard.',
    suggestion: parsed.suggestion,
    priorityOrder: parsed.priorityOrder,
    timelineUpdates: parsed.timelineUpdates
  }
}

export function hydrateState({
  profileRaw,
  dashboardRaw,
  chatRaw,
  focusHistoryRaw,
  apiKeyRaw,
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
