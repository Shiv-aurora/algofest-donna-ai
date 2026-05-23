import { useEffect, useMemo, useState } from 'react'
import AppSidebar from '../components/AppSidebar'
import { useDashboard } from '../state/DashboardProvider'

function formatSyncLabel(provider) {
  if (provider.status === 'syncing') return 'Syncing...'
  if (provider.errorMessage) return provider.errorMessage
  if (!provider.lastSyncAt) return 'Not synced yet'
  return `Last synced: ${new Date(provider.lastSyncAt).toLocaleString()}`
}

function ProviderRow({ title, subtitle, providerKey, providerState, onConnect, onDisconnect, onSync }) {
  const connected = providerState.connected
  return (
    <div className="flex items-center p-4 bg-surface-container-low rounded-xl group hover:bg-surface-container transition-colors gap-3">
      <div className="flex-1">
        <h4 className="text-sm font-medium text-on-surface">{title}</h4>
        <p className="text-xs text-on-surface-variant">{subtitle}</p>
        <p className="text-[11px] mt-1 text-on-surface-variant">{formatSyncLabel(providerState)}</p>
      </div>
      <div className="flex items-center gap-2">
        {connected ? (
          <>
            <button
              className="px-3 py-1.5 rounded-full text-xs bg-surface-container-highest text-on-surface hover:opacity-80 transition-colors"
              onClick={() => onSync(providerKey)}
            >
              Sync Now
            </button>
            <button
              className="px-3 py-1.5 rounded-full text-xs border border-outline-variant/30 text-on-surface-variant hover:bg-white transition-colors"
              onClick={() => onDisconnect(providerKey)}
            >
              Disconnect
            </button>
          </>
        ) : (
          <button
            className="px-4 py-1.5 rounded-full text-xs font-medium border border-outline-variant/30 text-on-surface-variant hover:bg-white transition-colors"
            onClick={() => onConnect(providerKey)}
          >
            Connect
          </button>
        )}
      </div>
    </div>
  )
}

function SettingsScreen() {
  const {
    profile,
    userMode,
    settings,
    saveSettingsAndProfile,
    connectivityStatus,
    connectProvider,
    disconnectProvider,
    syncProvider,
    logoutSession,
    authConnectivity,
    refreshAuthConnectivity
  } = useDashboard()

  const [draftProfile, setDraftProfile] = useState({ name: profile.name, email: profile.email })
  const [draftSettings, setDraftSettings] = useState(settings)
  const [canvasLink, setCanvasLink] = useState(connectivityStatus.canvas?.sourceUrl || '')
  const [blackboardLink, setBlackboardLink] = useState(connectivityStatus.blackboard?.sourceUrl || '')
  const [canvasCourseHint, setCanvasCourseHint] = useState(connectivityStatus.canvas?.courseHint || '')
  const [blackboardCourseHint, setBlackboardCourseHint] = useState(connectivityStatus.blackboard?.courseHint || '')
  const [statusMessage, setStatusMessage] = useState('')
  const sessionLabel =
    userMode === 'google' ? 'Google Account' : userMode === 'guest' ? 'Guest Session' : 'Demo Session'
  const normalizeProviderLabel = (provider) => {
    if (provider === 'google_calendar') return 'Google Calendar'
    if (provider === 'blackboard') return 'Blackboard'
    if (provider === 'canvas') return 'Canvas'
    return provider
  }

  useEffect(() => {
    setDraftProfile({ name: profile.name, email: profile.email })
  }, [profile.email, profile.name])

  useEffect(() => {
    setDraftSettings(settings)
  }, [settings])

  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const provider = query.get('provider')
    const status = query.get('status')
    const reason = query.get('reason')

    if (provider && status) {
      const label = normalizeProviderLabel(provider)
      if (status === 'connected') {
        setStatusMessage(`${label} connected successfully.`)
        refreshAuthConnectivity({ silent: true })
      } else if (status === 'failed') {
        setStatusMessage(`${label} connection failed${reason ? `: ${reason}` : '.'}`)
        refreshAuthConnectivity({ silent: true })
      } else if (status === 'pending') {
        setStatusMessage(`${label} connection is pending verification.`)
        refreshAuthConnectivity({ silent: true })
      }

      query.delete('provider')
      query.delete('status')
      query.delete('reason')
      const nextSearch = query.toString()
      const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`
      window.history.replaceState({}, '', nextUrl)
    }
  }, [refreshAuthConnectivity])

  useEffect(() => {
    if (!statusMessage && authConnectivity?.message) {
      setStatusMessage(authConnectivity.message)
    }
  }, [authConnectivity, statusMessage])

  const connectivity = useMemo(
    () => ({
      canvas: connectivityStatus.canvas,
      blackboard: connectivityStatus.blackboard,
      googleCalendar: connectivityStatus.googleCalendar
    }),
    [connectivityStatus]
  )

  const save = () => {
    saveSettingsAndProfile({
      nextProfile: {
        name: draftProfile.name,
        email: draftProfile.email
      },
      nextSettings: draftSettings
    })
    setStatusMessage('Configuration saved.')
  }

  const discard = () => {
    setDraftProfile({ name: profile.name, email: profile.email })
    setDraftSettings(settings)
    setStatusMessage('Changes discarded.')
  }

  const connectHandler = async (provider) => {
    const payload =
      provider === 'canvas'
        ? { mode: 'ics_link', sourceUrl: canvasLink, courseHint: canvasCourseHint }
        : provider === 'blackboard'
        ? { mode: 'ics_link', sourceUrl: blackboardLink, courseHint: blackboardCourseHint }
        : {}
    const ok = await connectProvider(provider, payload)
    const label = normalizeProviderLabel(provider)
    setStatusMessage(ok ? `${label} connected.` : `${label} connection failed.`)
  }

  const testLmsLink = async (provider) => {
    const payload =
      provider === 'canvas'
        ? { mode: 'ics_link', sourceUrl: canvasLink, courseHint: canvasCourseHint, testOnly: true }
        : { mode: 'ics_link', sourceUrl: blackboardLink, courseHint: blackboardCourseHint, testOnly: true }
    const ok = await connectProvider(provider, payload)
    const label = normalizeProviderLabel(provider)
    setStatusMessage(ok ? `${label} link looks valid.` : `${label} link validation failed.`)
  }

  const disconnectHandler = async (provider) => {
    const ok = await disconnectProvider(provider)
    const label = normalizeProviderLabel(provider)
    setStatusMessage(ok ? `${label} disconnected.` : `${label} disconnect failed.`)
  }

  const syncHandler = async (provider) => {
    const ok = await syncProvider(provider)
    const label = normalizeProviderLabel(provider)
    setStatusMessage(ok ? `${label} synced.` : `${label} sync failed.`)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-surface text-on-surface">
      <AppSidebar />

      <main className="flex-1 min-h-screen overflow-y-auto">
        <header className="h-16 w-full flex items-center sticky top-0 z-30 px-8 justify-between bg-white/80 backdrop-blur-xl shadow-[0px_20px_40px_rgba(43,52,55,0.02)]">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative w-full max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/50">
                search
              </span>
              <input
                className="w-full bg-surface-container-low border-none rounded-full pl-10 pr-4 py-2 text-sm focus:ring-1 focus:ring-primary/20 placeholder:text-on-surface-variant/40"
                placeholder="Search settings"
                type="text"
              />
            </div>
          </div>
          <div className="w-8" />
        </header>

        <div className="max-w-5xl mx-auto px-12 py-12 pb-24">
          <div className="mb-12">
            <h2 className="text-3xl font-light tracking-tight text-on-surface mb-1">System Configuration</h2>
            <p className="text-on-surface-variant font-light">Refine your academic environment and AI interactions.</p>
          </div>

          <div className="grid grid-cols-12 gap-8">
            <section className="col-span-12 lg:col-span-4 space-y-6">
              <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0px_20px_40px_rgba(43,52,55,0.02)]">
                <div className="text-center mb-6">
                  <div className="w-24 h-24 mx-auto rounded-full bg-surface-container overflow-hidden border-4 border-surface mb-4">
                    <img className="w-full h-full object-cover" src={profile.avatar} alt="Profile" />
                  </div>
                  <h3 className="font-manrope text-lg font-medium text-on-surface">{draftProfile.name || 'Student'}</h3>
                  <p className="text-xs text-on-surface-variant uppercase tracking-widest">Student Workspace</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 block mb-1">
                      Display Name
                    </label>
                    <input
                      className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary/20"
                      type="text"
                      value={draftProfile.name}
                      onChange={(event) => setDraftProfile((prev) => ({ ...prev, name: event.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 block mb-1">
                      Email Address
                    </label>
                    <input
                      className="w-full bg-surface-container-low border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-primary/20"
                      type="email"
                      value={draftProfile.email}
                      onChange={(event) => setDraftProfile((prev) => ({ ...prev, email: event.target.value }))}
                    />
                  </div>
                  <button
                    className="w-full mt-2 rounded-lg border border-outline-variant/30 px-4 py-2 text-sm text-on-surface-variant hover:bg-surface-container transition-colors"
                    onClick={async () => {
                      const confirmed = window.confirm('Log out of Donna?')
                      if (!confirmed) return
                      await logoutSession(`${window.location.origin}/login`)
                    }}
                  >
                    Log Out
                  </button>
                </div>
              </div>

              <div className="bg-surface-container-low rounded-xl p-6 border-l-2 border-tertiary-container/30">
                <h4 className="text-sm font-medium mb-2 text-on-tertiary-container flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">auto_awesome</span>
                  Session Status
                </h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Signed in via <span className="font-semibold text-primary">{sessionLabel}</span>.
                </p>
              </div>
            </section>

            <div className="col-span-12 lg:col-span-8 space-y-8">
              <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0px_20px_40px_rgba(43,52,55,0.02)]">
                <div className="flex items-center gap-3 mb-8">
                  <span className="material-symbols-outlined text-primary">psychology</span>
                  <h3 className="font-manrope text-xl font-light">AI Personalization</h3>
                </div>
                <div className="space-y-8">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-on-surface">Cognitive Tone</h4>
                      <p className="text-xs text-on-surface-variant">Adjust how Donna structures her insights.</p>
                    </div>
                    <select
                      className="bg-surface-container-low border-none rounded-full text-xs px-4 py-2 focus:ring-1 focus:ring-primary/20 outline-none"
                      value={draftSettings.aiPersonalization.tone}
                      onChange={(event) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          aiPersonalization: { ...prev.aiPersonalization, tone: event.target.value }
                        }))
                      }
                    >
                      <option>Academic &amp; Rigorous</option>
                      <option>Socratic &amp; Encouraging</option>
                      <option>Direct &amp; Concise</option>
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-on-surface">Insight Depth</h4>
                      <p className="text-xs text-on-surface-variant">Level of complexity in generated summaries.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-on-surface-variant">Abstract</span>
                      <input
                        className="w-24 h-1 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
                        type="range"
                        min={0}
                        max={100}
                        value={draftSettings.aiPersonalization.depth}
                        onChange={(event) =>
                          setDraftSettings((prev) => ({
                            ...prev,
                            aiPersonalization: {
                              ...prev.aiPersonalization,
                              depth: Number(event.target.value)
                            }
                          }))
                        }
                      />
                      <span className="text-[10px] text-on-surface-variant">Deep</span>
                    </div>
                  </div>

                  <label className="flex items-center justify-between gap-4">
                    <div>
                      <h4 className="text-sm font-medium text-on-surface">Contextual Memory</h4>
                      <p className="text-xs text-on-surface-variant">Allow Donna to reference past assignments.</p>
                    </div>
                    <input
                      checked={draftSettings.aiPersonalization.memoryEnabled}
                      className="rounded border-outline-variant/30 text-primary focus:ring-primary/20 w-4 h-4"
                      type="checkbox"
                      onChange={(event) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          aiPersonalization: {
                            ...prev.aiPersonalization,
                            memoryEnabled: event.target.checked
                          }
                        }))
                      }
                    />
                  </label>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0px_20px_40px_rgba(43,52,55,0.02)]">
                <div className="flex items-center gap-3 mb-8">
                  <span className="material-symbols-outlined text-primary">sync_alt</span>
                  <h3 className="font-manrope text-xl font-light">Connectivity</h3>
                </div>

                <h4 className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">LMS Connectivity</h4>
                <div className="space-y-4 mb-6">
                  <div className="bg-surface-container-low rounded-xl p-4">
                    <h5 className="text-sm font-medium mb-1">Canvas via ICS Link</h5>
                    <p className="text-xs text-on-surface-variant mb-3">Paste your Canvas calendar feed link.</p>
                    <div className="flex gap-2 mb-2">
                      <input
                        className="flex-1 rounded-lg border-none bg-surface-container-lowest px-3 py-2 text-xs focus:ring-1 focus:ring-primary/20"
                        placeholder="webcal://... or https://... (Canvas feed)"
                        value={canvasLink}
                        onChange={(event) => setCanvasLink(event.target.value)}
                      />
                      <button className="px-3 py-2 rounded-lg text-xs bg-surface-container-highest" onClick={() => testLmsLink('canvas')}>
                        Test Link
                      </button>
                    </div>
                    <input
                      className="w-full rounded-lg border-none bg-surface-container-lowest px-3 py-2 text-xs focus:ring-1 focus:ring-primary/20 mb-3"
                      placeholder="Optional course label (e.g., Econ 201)"
                      value={canvasCourseHint}
                      onChange={(event) => setCanvasCourseHint(event.target.value)}
                    />
                    <ProviderRow
                      title="Canvas LMS"
                      subtitle={`Imported tasks: ${connectivity.canvas?.importedTasks || 0} · events: ${connectivity.canvas?.importedEvents || 0}`}
                      providerKey="canvas"
                      providerState={connectivity.canvas}
                      onConnect={connectHandler}
                      onDisconnect={disconnectHandler}
                      onSync={syncHandler}
                    />
                  </div>

                  <div className="bg-surface-container-low rounded-xl p-4">
                    <h5 className="text-sm font-medium mb-1">Blackboard via ICS Link</h5>
                    <p className="text-xs text-on-surface-variant mb-3">Paste your Blackboard calendar feed link.</p>
                    <div className="flex gap-2 mb-2">
                      <input
                        className="flex-1 rounded-lg border-none bg-surface-container-lowest px-3 py-2 text-xs focus:ring-1 focus:ring-primary/20"
                        placeholder="webcal://... or https://... (Blackboard feed)"
                        value={blackboardLink}
                        onChange={(event) => setBlackboardLink(event.target.value)}
                      />
                      <button className="px-3 py-2 rounded-lg text-xs bg-surface-container-highest" onClick={() => testLmsLink('blackboard')}>
                        Test Link
                      </button>
                    </div>
                    <input
                      className="w-full rounded-lg border-none bg-surface-container-lowest px-3 py-2 text-xs focus:ring-1 focus:ring-primary/20 mb-3"
                      placeholder="Optional course label (e.g., CS 220)"
                      value={blackboardCourseHint}
                      onChange={(event) => setBlackboardCourseHint(event.target.value)}
                    />
                    <ProviderRow
                      title="Blackboard LMS"
                      subtitle={`Imported tasks: ${connectivity.blackboard?.importedTasks || 0} · events: ${connectivity.blackboard?.importedEvents || 0}`}
                      providerKey="blackboard"
                      providerState={connectivity.blackboard}
                      onConnect={connectHandler}
                      onDisconnect={disconnectHandler}
                      onSync={syncHandler}
                    />
                  </div>
                </div>

                <h4 className="text-xs uppercase tracking-widest text-on-surface-variant mb-3">Calendar Connectivity</h4>
                <ProviderRow
                  title="Google Calendar"
                  subtitle="Primary calendar integration"
                  providerKey="google_calendar"
                  providerState={connectivity.googleCalendar}
                  onConnect={connectHandler}
                  onDisconnect={disconnectHandler}
                  onSync={syncHandler}
                />
              </div>

              <div className="bg-surface-container-lowest rounded-xl p-8 shadow-[0px_20px_40px_rgba(43,52,55,0.02)]">
                <h3 className="font-manrope text-lg font-light mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary text-base">notifications_active</span>
                  Alerts
                </h3>
                <div className="space-y-5">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-on-surface-variant">Deadline Reminders</span>
                    <input
                      checked={draftSettings.alerts.deadlineReminders}
                      className="rounded border-outline-variant/30 text-primary focus:ring-primary/20 w-4 h-4"
                      type="checkbox"
                      onChange={(event) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          alerts: { ...prev.alerts, deadlineReminders: event.target.checked }
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-on-surface-variant">AI Insights Prepared</span>
                    <input
                      checked={draftSettings.alerts.aiInsightsPrepared}
                      className="rounded border-outline-variant/30 text-primary focus:ring-primary/20 w-4 h-4"
                      type="checkbox"
                      onChange={(event) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          alerts: { ...prev.alerts, aiInsightsPrepared: event.target.checked }
                        }))
                      }
                    />
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-xs text-on-surface-variant">System Updates</span>
                    <input
                      checked={draftSettings.alerts.systemUpdates}
                      className="rounded border-outline-variant/30 text-primary focus:ring-primary/20 w-4 h-4"
                      type="checkbox"
                      onChange={(event) =>
                        setDraftSettings((prev) => ({
                          ...prev,
                          alerts: { ...prev.alerts, systemUpdates: event.target.checked }
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 flex items-center justify-between">
            <p className="text-xs text-on-surface-variant">
              {statusMessage ||
                (authConnectivity.loading
                  ? 'Checking secure account session...'
                  : authConnectivity.auth?.authenticated
                  ? `Signed in${
                      authConnectivity.auth?.user?.name
                        ? ` as ${authConnectivity.auth.user.name}`
                        : authConnectivity.auth?.user?.email
                        ? ` as ${authConnectivity.auth.user.email}`
                        : ''
                    }.`
                  : 'Not signed in.')}
            </p>
            <div className="flex justify-end gap-4">
              <button
                className="px-8 py-2.5 rounded-full text-sm font-medium text-on-surface-variant hover:bg-surface-container transition-colors"
                onClick={discard}
              >
                Discard changes
              </button>
              <button
                className="px-8 py-2.5 rounded-full text-sm font-medium bg-gradient-to-br from-primary to-primary-container text-on-primary shadow-sm hover:opacity-90 active:scale-95 transition-all"
                onClick={save}
              >
                Save Configuration
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default SettingsScreen
