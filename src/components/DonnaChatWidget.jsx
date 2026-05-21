import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useDashboard } from '../state/DashboardProvider'
import DashboardClockBackground from '../../background'

const MotionButton = motion.button
const MotionPanel = motion.div

function DonnaChatWidget() {
  const {
    chatMessages,
    chatOpen,
    setChatOpen,
    sending,
    hasApiKey,
    runPlanner,
    setApiKeySession,
    clearApiKey,
    apiKeyEditorOpen,
    setApiKeyEditorOpen
  } = useDashboard()

  const [draft, setDraft] = useState('')
  const [keyDraft, setKeyDraft] = useState('')

  const statusText = useMemo(() => {
    if (sending) return 'Thinking...'
    if (hasApiKey) return 'BYOK connected'
    return 'Local planner mode'
  }, [hasApiKey, sending])

  const onSubmit = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text || sending) return
    setDraft('')
    await runPlanner(text, 'chat')
  }

  const saveApiKey = () => {
    setApiKeySession(keyDraft)
    setApiKeyEditorOpen(false)
    setKeyDraft('')
  }

  return (
    <div className="fixed bottom-6 right-6 z-[95]">
      <AnimatePresence mode="wait" initial={false}>
        {!chatOpen ? (
          <MotionButton
            key="donna-launcher"
            onClick={() => setChatOpen(true)}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.94 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="group rounded-full transition-transform hover:scale-[1.01]"
          >
            <DashboardClockBackground
              variant="subtle"
              timeScale={0.28}
              className="rounded-full bg-[#a3adb8]/85 border border-white/35 px-5 py-2.5 shadow-[0_20px_40px_rgba(43,52,55,0.16)]"
            >
              <span className="flex items-center gap-3">
                <span className="text-[24px] leading-none font-light tracking-[0.04em] text-slate-800/80 lowercase">donna</span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#68727a]/80 animate-pulse" />
              </span>
            </DashboardClockBackground>
          </MotionButton>
        ) : (
          <MotionPanel
            key="donna-panel"
            style={{ transformOrigin: '100% 100%' }}
            initial={{ opacity: 0, y: 28, x: 18, scaleX: 0.78, scaleY: 0.62, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, x: 0, scaleX: 1, scaleY: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: 18, x: 12, scaleX: 0.9, scaleY: 0.82, filter: 'blur(4px)' }}
            transition={{ type: 'spring', stiffness: 350, damping: 30, mass: 0.75 }}
            className="w-[360px] max-w-[92vw] rounded-2xl bg-surface-container-lowest ghost-border shadow-[0_24px_60px_rgba(43,52,55,0.16)] overflow-hidden"
          >
          <header className="flex items-center justify-between px-4 py-3 bg-surface-container-low border-b border-outline-variant/20">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-medium text-on-surface">Donna</p>
                <p className="text-[10px] tracking-wide uppercase text-on-surface-variant">{statusText}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setApiKeyEditorOpen((value) => !value)}
                className="text-xs px-2 py-1 rounded-full bg-surface-container-high text-on-surface-variant hover:text-primary transition-colors"
              >
                API Key
              </button>
              <button
                onClick={() => setChatOpen(false)}
                className="text-on-surface-variant hover:text-on-surface material-symbols-outlined"
              >
                close
              </button>
            </div>
          </header>

          {apiKeyEditorOpen && (
            <div className="px-4 py-3 bg-surface-container-low/70 border-b border-outline-variant/20 space-y-2">
              <p className="text-[11px] text-on-surface-variant">
                BYOK key is stored locally in your profile on this device.
              </p>
              <div className="flex gap-2">
                <input
                  value={keyDraft}
                  onChange={(event) => setKeyDraft(event.target.value)}
                  type="password"
                  placeholder="sk-..."
                  className="flex-1 rounded-full border-none bg-surface-container-lowest px-3 py-2 text-xs focus:ring-1 focus:ring-primary/30"
                />
                <button
                  onClick={saveApiKey}
                  className="rounded-full bg-primary px-3 py-2 text-[11px] text-on-primary"
                >
                  Save
                </button>
                <button
                  onClick={clearApiKey}
                  className="rounded-full bg-surface-container-high px-3 py-2 text-[11px] text-on-surface-variant"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className="px-4 pt-3 pb-2">
            <button
              onClick={() => runPlanner('Optimize this plan for today', 'optimize')}
              disabled={sending}
              className="w-full rounded-full bg-gradient-to-br from-primary to-primary-dim px-4 py-2 text-xs text-on-primary disabled:opacity-50"
            >
              Optimize This Plan For Today
            </button>
          </div>

          <div className="h-[320px] overflow-y-auto px-4 pb-4 space-y-3 thin-scrollbar">
            {chatMessages.map((message) => {
              const isUser = message.role === 'user'
              return (
                <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-primary text-on-primary rounded-br-md'
                        : 'bg-surface-container-low text-on-surface rounded-bl-md'
                    }`}
                  >
                    {message.text}
                  </div>
                </div>
              )
            })}
          </div>

          <form onSubmit={onSubmit} className="border-t border-outline-variant/20 p-3 flex items-center gap-2 bg-surface-container-low/60">
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask Donna to optimize your day..."
              className="flex-1 rounded-full border-none bg-surface-container-lowest px-4 py-2 text-sm focus:ring-1 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className="rounded-full bg-on-surface px-3 py-2 text-xs text-surface disabled:opacity-50"
            >
              Send
            </button>
          </form>
          </MotionPanel>
        )}
      </AnimatePresence>
    </div>
  )
}

export default DonnaChatWidget
