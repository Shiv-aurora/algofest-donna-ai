import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import AppSidebar from '../components/AppSidebar'
import { useDashboard } from '../state/DashboardProvider'

const MotionDiv = motion.div

function formatDate(ts) {
  if (!ts) return 'Not yet'
  return new Date(ts).toLocaleString()
}

function minutesToHours(minutes) {
  return `${(Number(minutes || 0) / 60).toFixed(1)}h`
}

function AddAspirationModal({ open, draft, setDraft, onClose, onSave }) {
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
            className="w-full max-w-2xl rounded-2xl bg-surface-container-lowest ghost-border p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 className="text-xl font-headline font-light text-on-surface mb-5">Add Aspiration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                className="rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20"
                placeholder="Concrete aspiration title"
                value={draft.title}
                onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              />
              <input
                className="rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20"
                placeholder="Target (e.g. by end of May)"
                value={draft.targetLabel}
                onChange={(event) => setDraft((prev) => ({ ...prev, targetLabel: event.target.value }))}
              />
            </div>
            <textarea
              className="mt-3 w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20 min-h-[90px]"
              placeholder="What progress should look like"
              value={draft.subtext}
              onChange={(event) => setDraft((prev) => ({ ...prev, subtext: event.target.value }))}
            />
            <div className="mt-5 flex justify-end gap-2">
              <button className="px-4 py-2 rounded-full text-xs text-on-surface-variant" onClick={onClose}>
                Cancel
              </button>
              <button className="px-4 py-2 rounded-full text-xs bg-on-surface text-surface" onClick={onSave}>
                Add
              </button>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  )
}

function ProgressLogModal({ open, draft, setDraft, onClose, onSave, aspirationTitle }) {
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
            <h3 className="text-xl font-headline font-light text-on-surface mb-1">Log Progress</h3>
            <p className="text-xs text-on-surface-variant mb-5">{aspirationTitle}</p>
            <input
              className="w-full rounded-xl border-none bg-surface-container-low px-4 py-3 text-sm focus:ring-1 focus:ring-primary/20"
              type="number"
              min={5}
              max={300}
              placeholder="Minutes worked"
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
                Save Session
              </button>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  )
}

function AspirationDetailsModal({ open, aspiration, sessions, onClose, onAskDonna, onLogProgress }) {
  if (!aspiration) return null

  const totalMinutes = sessions.reduce((sum, item) => sum + Number(item.minutes || 0), 0)

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
            className="w-full max-w-3xl rounded-2xl bg-surface-container-lowest ghost-border p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-2xl font-headline font-light text-on-surface">{aspiration.title}</h3>
                <p className="text-sm text-on-surface-variant mt-1">{aspiration.subtext}</p>
              </div>
              <button className="material-symbols-outlined text-on-surface-variant" onClick={onClose}>
                close
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
              <div className="bg-surface-container-low rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Started</p>
                <p className="text-xs mt-1">{formatDate(aspiration.startedAt || aspiration.createdAt)}</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Last Worked</p>
                <p className="text-xs mt-1">{formatDate(aspiration.lastWorkedAt)}</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Sessions</p>
                <p className="text-xs mt-1">{aspiration.workSessionCount || 0}</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-3">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Total Time</p>
                <p className="text-xs mt-1">{minutesToHours(totalMinutes)}</p>
              </div>
            </div>

            <div className="bg-surface-container-low rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-widest text-on-surface-variant">Progress Trend</p>
                <p className="text-sm font-medium">{aspiration.progress || 0}%</p>
              </div>
              <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary-dim to-primary transition-all duration-500"
                  style={{ width: `${Math.max(0, Math.min(100, Number(aspiration.progress || 0)))}%` }}
                />
              </div>
              <p className="text-[11px] text-on-surface-variant mt-2">Target: {aspiration.targetLabel || 'No target date set'}</p>
            </div>

            <div className="bg-surface-container-low rounded-xl p-4">
              <p className="text-[11px] uppercase tracking-widest text-on-surface-variant mb-3">Activity Timeline</p>
              <div className="space-y-2 max-h-[220px] overflow-y-auto thin-scrollbar">
                {sessions.length === 0 && <p className="text-xs text-on-surface-variant">No sessions logged yet.</p>}
                {sessions.map((entry) => (
                  <div key={entry.id} className="bg-surface-container-lowest rounded-xl p-3 border border-outline-variant/20">
                    <div className="flex justify-between items-center gap-2">
                      <p className="text-xs font-medium">{entry.minutes} mins</p>
                      <p className="text-[11px] text-on-surface-variant">{new Date(entry.createdAt).toLocaleString()}</p>
                    </div>
                    {entry.note && <p className="text-xs text-on-surface-variant mt-1">{entry.note}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button className="px-4 py-2 rounded-full text-xs bg-surface-container-high text-on-surface-variant" onClick={onLogProgress}>
                Log Progress
              </button>
              <button className="px-4 py-2 rounded-full text-xs bg-on-surface text-surface" onClick={onAskDonna}>
                Ask Donna to schedule today
              </button>
            </div>
          </MotionDiv>
        </MotionDiv>
      )}
    </AnimatePresence>
  )
}

function GoalsScreen() {
  const {
    aspirations,
    aspirationsArchive,
    aspirationSessions,
    addAspiration,
    logAspirationSession,
    markAspirationDone,
    deleteAspiration,
    askDonnaSchedule,
    markAllInsightsRead,
    unreadInsightCount
  } = useDashboard()

  const [query, setQuery] = useState('')
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [detailsId, setDetailsId] = useState('')
  const [logDraft, setLogDraft] = useState({ aspirationId: '', minutes: '30', note: '' })
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [addDraft, setAddDraft] = useState({ title: '', subtext: '', targetLabel: '' })

  const filteredAspirations = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...aspirations].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    if (!q) return sorted
    return sorted.filter((item) => {
      return (
        item.title.toLowerCase().includes(q) ||
        String(item.subtext || '')
          .toLowerCase()
          .includes(q) ||
        String(item.targetLabel || '')
          .toLowerCase()
          .includes(q)
      )
    })
  }, [aspirations, query])

  const selectedAspiration = useMemo(
    () => filteredAspirations.find((item) => item.id === detailsId) || aspirations.find((item) => item.id === detailsId),
    [aspirations, detailsId, filteredAspirations]
  )

  const selectedSessions = useMemo(() => {
    if (!detailsId) return []
    return aspirationSessions
      .filter((item) => item.aspirationId === detailsId)
      .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
  }, [aspirationSessions, detailsId])

  const saveAspiration = () => {
    const created = addAspiration(addDraft)
    if (!created) return
    setAddDraft({ title: '', subtext: '', targetLabel: '' })
    setAddModalOpen(false)
  }

  const saveProgressSession = () => {
    if (!logDraft.aspirationId) return
    logAspirationSession(logDraft.aspirationId, {
      minutes: Number(logDraft.minutes),
      note: logDraft.note
    })
    setLogModalOpen(false)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">
      <AppSidebar />

      <main className="flex-1 min-h-screen overflow-y-auto">
        <header className="sticky top-0 w-full z-30 px-8 h-16 flex items-center justify-between bg-white/80 backdrop-blur-xl shadow-[0px_20px_40px_rgba(43,52,55,0.02)]">
          <div className="flex items-center bg-surface-container-low px-4 py-2 rounded-full w-96 ghost-border">
            <span className="material-symbols-outlined text-outline-variant mr-2">search</span>
            <input
              className="bg-transparent border-none focus:ring-0 text-sm tracking-tight w-full placeholder:text-outline-variant"
              placeholder="Search aspirations..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <button
            className="material-symbols-outlined text-on-surface-variant hover:opacity-70 transition-opacity relative"
            onClick={markAllInsightsRead}
          >
            notifications
            {unreadInsightCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 inline-flex h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
        </header>

        <div className="max-w-6xl mx-auto px-12 py-16">
          <div className="mb-10 flex items-start justify-between gap-6">
            <div>
              <h2 className="font-headline font-light text-[3.5rem] leading-tight text-on-surface tracking-tight">Goals</h2>
              <p className="font-body text-on-surface-variant max-w-xl mt-2 leading-relaxed">Aspirations</p>
            </div>
            <button
              type="button"
              className="mt-3 h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm flex items-center justify-center hover:opacity-90 active:scale-95 transition-all"
              aria-label="Add aspiration"
              onClick={() => setAddModalOpen(true)}
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
            </button>
          </div>

          {filteredAspirations.length === 0 ? (
            <div className="bg-surface-container-low p-8 rounded-xl text-on-surface-variant">No aspirations found.</div>
          ) : (
            <div className="grid grid-cols-12 gap-6">
              {filteredAspirations.map((item, index) => (
                <article
                  key={item.id}
                  className={`col-span-12 md:col-span-6 rounded-xl p-7 ${
                    index % 2 === 0 ? 'bg-surface-container-lowest ghost-border' : 'bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[0.6875rem] font-label uppercase tracking-widest text-primary-dim mb-2">Aspiration</p>
                      <h3 className="font-headline font-light text-2xl text-on-surface leading-tight">{item.title}</h3>
                      <p className="text-on-surface-variant mt-2 text-sm leading-relaxed">{item.subtext}</p>
                      <p className="text-[11px] uppercase tracking-widest text-on-surface-variant/70 mt-4">
                        Target: {item.targetLabel || 'No target date set'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label={`Complete ${item.title}`}
                        className="h-9 w-9 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center"
                        onClick={() => markAspirationDone(item.id)}
                      >
                        <span className="material-symbols-outlined text-[18px]">task_alt</span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${item.title}`}
                        className="h-9 w-9 rounded-full bg-surface-container-high text-on-surface-variant hover:text-error hover:bg-error-container/25 transition-colors flex items-center justify-center"
                        onClick={() => deleteAspiration(item.id)}
                      >
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] uppercase tracking-widest text-on-surface-variant/70">Progress</p>
                      <p className="text-sm font-medium text-on-surface">{item.progress || 0}%</p>
                    </div>
                    <div className="h-2 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary-dim to-primary transition-all duration-500"
                        style={{ width: `${Math.max(0, Math.min(100, Number(item.progress || 0)))}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full text-xs bg-surface-container-high text-on-surface-variant"
                      onClick={() => {
                        setLogDraft({ aspirationId: item.id, minutes: '30', note: '' })
                        setLogModalOpen(true)
                      }}
                    >
                      Log Progress
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full text-xs bg-surface-container-high text-on-surface-variant"
                      onClick={() => setDetailsId(item.id)}
                    >
                      View Details
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 rounded-full text-xs bg-on-surface text-surface"
                      onClick={() =>
                        askDonnaSchedule({
                          title: item.title,
                          context: item.subtext,
                          targetLabel: item.targetLabel
                        })
                      }
                    >
                      Ask Donna to schedule today
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <section className="mt-10 bg-surface-container-low rounded-xl p-6">
            <h3 className="font-headline font-light text-xl mb-4">Past Goals</h3>
            {aspirationsArchive.length === 0 ? (
              <p className="text-sm text-on-surface-variant">No archived goals yet.</p>
            ) : (
              <div className="space-y-3">
                {aspirationsArchive.map((item) => (
                  <div
                    key={item.id}
                    className="bg-surface-container-lowest rounded-xl p-4 border border-outline-variant/20 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-on-surface-variant">Completed: {formatDate(item.completedAt)}</p>
                    </div>
                    <span className="text-[10px] uppercase tracking-widest text-primary">Completed</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <AddAspirationModal
        open={addModalOpen}
        draft={addDraft}
        setDraft={setAddDraft}
        onClose={() => setAddModalOpen(false)}
        onSave={saveAspiration}
      />

      <ProgressLogModal
        open={logModalOpen}
        draft={logDraft}
        setDraft={setLogDraft}
        onClose={() => setLogModalOpen(false)}
        onSave={saveProgressSession}
        aspirationTitle={aspirations.find((item) => item.id === logDraft.aspirationId)?.title || 'Aspiration'}
      />

      <AspirationDetailsModal
        open={Boolean(detailsId)}
        aspiration={selectedAspiration}
        sessions={selectedSessions}
        onClose={() => setDetailsId('')}
        onLogProgress={() => {
          setLogDraft({ aspirationId: detailsId, minutes: '30', note: '' })
          setLogModalOpen(true)
        }}
        onAskDonna={() => {
          if (!selectedAspiration) return
          askDonnaSchedule({
            title: selectedAspiration.title,
            context: selectedAspiration.subtext,
            targetLabel: selectedAspiration.targetLabel
          })
        }}
      />
    </div>
  )
}

export default GoalsScreen
