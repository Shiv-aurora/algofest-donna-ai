import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AppSidebar from '../components/AppSidebar'
import { useDashboard } from '../state/DashboardProvider'

const MotionDiv = motion.div

const SORT_MODE = {
  all: 'all',
  class: 'class',
  due: 'due',
  priority: 'priority'
}

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

function formatWeekRange(start) {
  const end = addDays(start, 6)
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startLabel} - ${endLabel}`
}

function parseDate(value) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function eventKindClass(kind) {
  if (kind === 'ai') return 'bg-primary-container/30 border border-primary/10'
  if (kind === 'deep') return 'bg-tertiary-container/20 border border-tertiary/10'
  return 'bg-surface-container-lowest border border-outline-variant/15'
}

function priorityPillClass(priority) {
  if (priority === 'High') return 'text-error bg-error-container/20'
  if (priority === 'Low') return 'text-secondary bg-secondary-fixed/40'
  return 'text-primary bg-primary-container/40'
}

function assignmentStatus(item) {
  const due = parseDate(item.dueAt)
  if (!due) return 'upcoming'

  const now = new Date()
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)

  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)

  if (due < startOfToday) return 'overdue'
  if (due <= endOfToday) return 'today'
  return 'upcoming'
}

function readinessFromSessions(exam, sessions) {
  const examDate = parseDate(exam.date)
  const now = new Date()
  const daysUntil = examDate ? Math.max(0, Math.ceil((examDate - now) / (1000 * 60 * 60 * 24))) : 14
  const minutes = sessions.reduce((sum, item) => sum + Number(item.minutes || 0), 0)
  const readiness = Math.max(5, Math.min(98, Math.round((minutes / 240) * 60 + Math.max(0, 12 - daysUntil) * 3)))
  return {
    readiness,
    minutes,
    daysUntil
  }
}

function EventModal({ open, draft, setDraft, onClose, onSave, onDelete }) {
  return (
    <AnimatePresence>
      {open && (
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-slate-900/30 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <MotionDiv
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-xl rounded-2xl bg-surface-container-lowest ghost-border p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-headline font-light text-on-surface mb-5">{draft.id ? 'Edit Event' : 'Create Event'}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20"
                placeholder="Event title"
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
              <input
                className="rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20"
                type="date"
                value={draft.date}
                onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
              />
              <input
                className="rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20"
                type="time"
                value={draft.startTime}
                onChange={(event) => setDraft((prev) => ({ ...prev, startTime: event.target.value }))}
              />
              <input
                className="rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20"
                type="time"
                value={draft.endTime}
                onChange={(event) => setDraft((prev) => ({ ...prev, endTime: event.target.value }))}
              />
              <select
                className="rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20"
                value={draft.kind}
                onChange={(event) => setDraft((prev) => ({ ...prev, kind: event.target.value }))}
              >
                <option value="class">Class</option>
                <option value="deep">Deep Work</option>
                <option value="ai">AI Suggested</option>
              </select>
            </div>
            <div className="mt-6 flex items-center justify-between">
              <button
                className={`px-4 py-2 rounded-full text-xs ${draft.id ? 'text-error' : 'text-on-surface-variant opacity-0 pointer-events-none'}`}
                onClick={() => {
                  if (draft.id) onDelete(draft.id)
                }}
              >
                Delete
              </button>
              <div className="flex items-center gap-2">
                <button className="px-4 py-2 rounded-full text-xs text-on-surface-variant" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="px-4 py-2 rounded-full text-xs bg-on-surface text-surface"
                  onClick={onSave}
                >
                  Save Event
                </button>
              </div>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  )
}

function StudyLogModal({ open, draft, setDraft, onClose, onSave, title = 'Log Study Session' }) {
  return (
    <AnimatePresence>
      {open && (
        <MotionDiv
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-slate-900/30 backdrop-blur-[2px] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <MotionDiv
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-md rounded-2xl bg-surface-container-lowest ghost-border p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-headline font-light text-on-surface mb-5">{title}</h3>
            <input
              className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20"
              type="number"
              min={5}
              max={300}
              placeholder="Minutes"
              value={draft.minutes}
              onChange={(event) => setDraft((prev) => ({ ...prev, minutes: event.target.value }))}
            />
            <textarea
              className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20 mt-3 min-h-[90px]"
              placeholder="Optional note"
              value={draft.note}
              onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button className="px-4 py-2 rounded-full text-xs text-on-surface-variant" onClick={onClose}>
                Cancel
              </button>
              <button className="px-4 py-2 rounded-full text-xs bg-on-surface text-surface" onClick={onSave}>
                Save
              </button>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  )
}

function MergedPlannerScreen() {
  const {
    calendarEvents,
    assignments,
    exams,
    examStudySessions,
    createCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    logExamStudySession,
    askDonnaSchedule,
    markAllInsightsRead,
    unreadInsightCount
  } = useDashboard()

  const [weekOffset, setWeekOffset] = useState(0)
  const [sortMode, setSortMode] = useState(SORT_MODE.all)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [eventDraft, setEventDraft] = useState({
    id: '',
    title: '',
    date: toDateKey(new Date()),
    startTime: '09:00',
    endTime: '10:00',
    kind: 'class'
  })
  const [studyModalOpen, setStudyModalOpen] = useState(false)
  const [studyDraft, setStudyDraft] = useState({ examId: '', minutes: '35', note: '' })

  const weekStart = useMemo(() => addDays(startOfWeekMonday(new Date()), weekOffset * 7), [weekOffset])
  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, idx) => addDays(weekStart, idx)), [weekStart])

  const eventsByDay = useMemo(() => {
    const map = new Map(weekDays.map((day) => [toDateKey(day), []]))
    for (const item of calendarEvents) {
      if (!map.has(item.date)) continue
      map.get(item.date).push(item)
    }
    for (const entries of map.values()) {
      entries.sort((a, b) => a.startTime.localeCompare(b.startTime))
    }
    return map
  }, [calendarEvents, weekDays])

  const sortedAssignments = useMemo(() => {
    const rows = [...assignments]
    if (sortMode === SORT_MODE.class) {
      rows.sort((a, b) => a.course.localeCompare(b.course) || new Date(a.dueAt) - new Date(b.dueAt))
      return rows
    }
    if (sortMode === SORT_MODE.due) {
      rows.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
      return rows
    }
    if (sortMode === SORT_MODE.priority) {
      const rank = { High: 0, Medium: 1, Low: 2 }
      rows.sort((a, b) => (rank[a.priority] ?? 10) - (rank[b.priority] ?? 10) || new Date(a.dueAt) - new Date(b.dueAt))
      return rows
    }
    rows.sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt))
    return rows
  }, [assignments, sortMode])

  const groupedAssignments = useMemo(() => {
    const overdue = []
    const today = []
    const upcoming = []

    for (const item of sortedAssignments) {
      const status = assignmentStatus(item)
      if (status === 'overdue') overdue.push(item)
      else if (status === 'today') today.push(item)
      else upcoming.push(item)
    }

    return { overdue, today, upcoming }
  }, [sortedAssignments])

  const examsByWindow = useMemo(() => {
    const endOfWeek = addDays(weekStart, 6)
    const currentWeek = []
    const future = []

    for (const exam of exams) {
      const when = parseDate(exam.date)
      if (!when) continue
      if (when >= weekStart && when <= endOfWeek) currentWeek.push(exam)
      else if (when > endOfWeek) future.push(exam)
    }

    currentWeek.sort((a, b) => new Date(a.date) - new Date(b.date))
    future.sort((a, b) => new Date(a.date) - new Date(b.date))
    return { currentWeek, future }
  }, [exams, weekStart])

  const handleOpenCreate = () => {
    setEventDraft({
      id: '',
      title: '',
      date: toDateKey(new Date()),
      startTime: '09:00',
      endTime: '10:00',
      kind: 'class'
    })
    setEventModalOpen(true)
  }

  const handleOpenEdit = (item) => {
    setEventDraft({ ...item })
    setEventModalOpen(true)
  }

  const saveEvent = () => {
    if (!eventDraft.title.trim() || !eventDraft.date) return
    if (eventDraft.id) updateCalendarEvent(eventDraft.id, eventDraft)
    else createCalendarEvent(eventDraft)
    setEventModalOpen(false)
  }

  const deleteEvent = (eventId) => {
    deleteCalendarEvent(eventId)
    setEventModalOpen(false)
  }

  const openExamLog = (examId) => {
    setStudyDraft({ examId, minutes: '35', note: '' })
    setStudyModalOpen(true)
  }

  const saveExamLog = () => {
    if (!studyDraft.examId) return
    logExamStudySession(studyDraft.examId, {
      minutes: Number(studyDraft.minutes),
      note: studyDraft.note
    })
    setStudyModalOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">
      <AppSidebar />

      <main className="flex-1 min-h-screen overflow-y-auto">
        <header className="sticky top-0 z-30 px-8 h-16 flex items-center justify-between bg-white/80 backdrop-blur-xl shadow-[0px_20px_40px_rgba(43,52,55,0.02)]">
          <div className="flex items-center gap-8">
            <button className="text-slate-900 font-medium border-b border-slate-400 text-sm tracking-tight font-headline py-1">
              Weekly View
            </button>
          </div>
          <button
            className="material-symbols-outlined text-slate-500 hover:text-slate-700 transition-colors relative"
            onClick={markAllInsightsRead}
          >
            notifications
            {unreadInsightCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
        </header>

        <div className="px-8 py-6 space-y-8">
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] gap-8">
            <section className="min-w-0">
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="font-headline text-3xl font-light text-on-surface tracking-tight">Academic Week</h2>
                  <p className="text-sm text-on-surface-variant font-label mt-1">{formatWeekRange(weekStart)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 p-1 bg-surface-container-low rounded-full">
                    <button
                      className="p-2 hover:bg-surface-container-lowest rounded-full transition-colors"
                      onClick={() => setWeekOffset((value) => value - 1)}
                    >
                      <span className="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <button
                      className="px-4 text-xs font-label font-medium uppercase tracking-widest"
                      onClick={() => setWeekOffset(0)}
                    >
                      Today
                    </button>
                    <button
                      className="p-2 hover:bg-surface-container-lowest rounded-full transition-colors"
                      onClick={() => setWeekOffset((value) => value + 1)}
                    >
                      <span className="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                  </div>
                  <button
                    className="rounded-full bg-gradient-to-br from-primary to-primary-dim text-on-primary px-3 py-2 text-xs flex items-center gap-1"
                    onClick={handleOpenCreate}
                  >
                    <span className="material-symbols-outlined text-[16px]">add</span>
                    Event
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-1 min-h-[560px]">
                {weekDays.map((day) => (
                  <div key={`h-${toDateKey(day)}`} className="text-center pb-4">
                    <p
                      className={`text-[0.6875rem] font-label uppercase tracking-widest ${
                        isSameDay(day, new Date()) ? 'text-primary font-semibold' : 'text-outline'
                      }`}
                    >
                      {day.toLocaleDateString(undefined, { weekday: 'short' })} {day.getDate()}
                    </p>
                  </div>
                ))}

                {weekDays.map((day) => {
                  const key = toDateKey(day)
                  const dayEvents = eventsByDay.get(key) || []
                  const isToday = isSameDay(day, new Date())
                  return (
                    <div
                      key={key}
                      className={`space-y-3 p-2 rounded-xl ${isToday ? 'bg-primary-fixed/10' : 'bg-surface-container-low/30'}`}
                    >
                      {dayEvents.length === 0 && <div className="h-8" />}
                      {dayEvents.map((item) => (
                        <button
                          key={item.id}
                          className={`w-full text-left p-3 rounded-xl shadow-[0px_20px_40px_rgba(43,52,55,0.04)] hover:opacity-90 transition-opacity ${eventKindClass(item.kind)}`}
                          onClick={() => handleOpenEdit(item)}
                        >
                          <span className="text-[0.625rem] font-label text-outline uppercase tracking-tighter">
                            {item.startTime} - {item.endTime}
                          </span>
                          <h4 className="text-xs font-medium text-on-surface mt-1">{item.title}</h4>
                          {item.kind === 'ai' && (
                            <p className="text-[10px] text-primary uppercase tracking-wider mt-1">AI Suggested</p>
                          )}
                          {item.kind === 'deep' && (
                            <p className="text-[10px] text-tertiary uppercase tracking-wider mt-1">Deep Work</p>
                          )}
                        </button>
                      ))}
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <button
                  className={`px-4 py-1.5 rounded-full text-xs font-medium ${sortMode === SORT_MODE.all ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  onClick={() => setSortMode(SORT_MODE.all)}
                >
                  All
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs font-medium ${sortMode === SORT_MODE.class ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  onClick={() => setSortMode(SORT_MODE.class)}
                >
                  By Class
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs font-medium ${sortMode === SORT_MODE.due ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  onClick={() => setSortMode(SORT_MODE.due)}
                >
                  Due Date
                </button>
                <button
                  className={`px-4 py-1.5 rounded-full text-xs font-medium ${sortMode === SORT_MODE.priority ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                  onClick={() => setSortMode(SORT_MODE.priority)}
                >
                  Priority
                </button>
              </div>

              {[{ key: 'overdue', label: 'Overdue' }, { key: 'today', label: 'Due Today' }, { key: 'upcoming', label: 'Upcoming' }].map(
                (group) => {
                  const rows = groupedAssignments[group.key]
                  if (!rows.length) return null
                  return (
                    <section key={group.key}>
                      <h3 className="text-xs font-label tracking-[0.1em] text-on-surface-variant uppercase mb-3">{group.label}</h3>
                      <div className="space-y-3">
                        {rows.map((item) => {
                          const due = parseDate(item.dueAt)
                          return (
                            <div key={item.id} className="bg-surface-container-lowest rounded-xl p-4 ghost-border">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <h4 className="text-sm font-medium text-slate-900">{item.title}</h4>
                                  <div className="flex items-center gap-3 mt-2 text-[11px] text-on-surface-variant">
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                        school
                                      </span>
                                      {item.course}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>
                                        schedule
                                      </span>
                                      {item.estimatedHours}h Est.
                                    </span>
                                    <span className="inline-block rounded-full px-2 py-0.5 text-[10px] bg-surface-container-highest text-on-surface">
                                      {String(item.source || 'manual').toUpperCase()}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right space-y-2">
                                  <p className="text-[11px] text-on-surface-variant">
                                    {due
                                      ? due.toLocaleString(undefined, {
                                          month: 'short',
                                          day: 'numeric',
                                          hour: 'numeric',
                                          minute: '2-digit'
                                        })
                                      : 'No due date'}
                                  </p>
                                  <span className={`inline-block text-[10px] px-2 py-1 rounded-full ${priorityPillClass(item.priority)}`}>
                                    {item.priority} Priority
                                  </span>
                                </div>
                              </div>
                              <div className="mt-3 flex justify-end">
                                <button
                                  className="px-3 py-1.5 rounded-full text-[11px] bg-surface-container-low text-on-surface-variant"
                                  onClick={() =>
                                    askDonnaSchedule({
                                      title: item.title,
                                      context: `Assignment for ${item.course}`,
                                      targetLabel: 'Schedule it for today'
                                    })
                                  }
                                >
                                  Ask Donna to schedule today
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )
                }
              )}
            </section>
          </div>

          <section className="bg-surface-container-low rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-headline font-light">Exams & Planner</h3>
              <button
                className="px-4 py-2 rounded-full text-xs bg-on-surface text-surface"
                onClick={() =>
                  askDonnaSchedule({
                    title: 'Exam preparation strategy',
                    context: 'Plan early study blocks for upcoming exams and quizzes',
                    targetLabel: 'This week and next week'
                  })
                }
              >
                Ask Donna to plan exams
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-surface-container-lowest rounded-xl p-4 ghost-border">
                <h4 className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">This Week's Exams</h4>
                <div className="space-y-3">
                  {examsByWindow.currentWeek.length === 0 && (
                    <p className="text-xs text-on-surface-variant">No exams this week.</p>
                  )}
                  {examsByWindow.currentWeek.map((exam) => {
                    const sessions = examStudySessions.filter((item) => item.examId === exam.id)
                    const metrics = readinessFromSessions(exam, sessions)
                    return (
                      <div key={exam.id} className="bg-surface-container-low rounded-xl p-3">
                        <p className="text-sm font-medium">{exam.title}</p>
                        <p className="text-xs text-on-surface-variant mt-1">{exam.course}</p>
                        <p className="text-[11px] text-on-surface-variant mt-1">
                          {new Date(exam.date).toLocaleDateString()} · {metrics.daysUntil} days left
                        </p>
                        <div className="mt-2 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${metrics.readiness}%` }} />
                        </div>
                        <p className="text-[11px] mt-1 text-on-surface-variant">Readiness: {metrics.readiness}%</p>
                        <div className="mt-3 flex justify-between items-center">
                          <span className="text-[11px] text-on-surface-variant">Prev effort: {exam.previousEffortHours}h</span>
                          <button
                            className="text-[11px] px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant"
                            onClick={() => openExamLog(exam.id)}
                          >
                            Log Study
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-4 ghost-border">
                <h4 className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">Future Exams</h4>
                <div className="space-y-3">
                  {examsByWindow.future.map((exam) => {
                    const sessions = examStudySessions.filter((item) => item.examId === exam.id)
                    const metrics = readinessFromSessions(exam, sessions)
                    return (
                      <div key={exam.id} className="bg-surface-container-low rounded-xl p-3">
                        <p className="text-sm font-medium">{exam.title}</p>
                        <p className="text-xs text-on-surface-variant mt-1">{exam.course}</p>
                        <p className="text-[11px] text-on-surface-variant mt-1">
                          {new Date(exam.date).toLocaleDateString()} · {metrics.daysUntil} days out
                        </p>
                        <p className="text-[11px] text-on-surface-variant mt-2">
                          Study logged: {Math.round(metrics.minutes / 60)}h total
                        </p>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-4 ghost-border">
                <h4 className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">Exam Planner</h4>
                <div className="space-y-3">
                  {exams.slice(0, 3).map((exam) => {
                    const sessions = examStudySessions.filter((item) => item.examId === exam.id)
                    const metrics = readinessFromSessions(exam, sessions)
                    return (
                      <div key={`plan-${exam.id}`} className="bg-surface-container-low rounded-xl p-3">
                        <p className="text-sm font-medium">{exam.title}</p>
                        <p className="text-[11px] text-on-surface-variant mt-1">
                          {metrics.readiness < 45 ? 'Not clocked and ready yet.' : 'On track with current pace.'}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <button
                            className="text-[11px] px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant"
                            onClick={() =>
                              askDonnaSchedule({
                                title: `Study plan for ${exam.title}`,
                                context: `${exam.course} ${exam.type} preparation`,
                                targetLabel: 'This week'
                              })
                            }
                          >
                            Ask Donna
                          </button>
                          <button
                            className="text-[11px] px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant"
                            onClick={() => openExamLog(exam.id)}
                          >
                            Log Study
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <EventModal
        open={eventModalOpen}
        draft={eventDraft}
        setDraft={setEventDraft}
        onClose={() => setEventModalOpen(false)}
        onSave={saveEvent}
        onDelete={deleteEvent}
      />

      <StudyLogModal
        open={studyModalOpen}
        draft={studyDraft}
        setDraft={setStudyDraft}
        onClose={() => setStudyModalOpen(false)}
        onSave={saveExamLog}
      />
    </div>
  )
}

export default MergedPlannerScreen
