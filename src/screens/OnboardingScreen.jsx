import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDashboard } from '../state/DashboardProvider'

function resolveReturnPath(rawReturnTo) {
  const fallback = '/dashboard'
  const raw = String(rawReturnTo || '').trim()
  if (!raw) return fallback
  try {
    const parsed = new URL(raw, window.location.origin)
    if (parsed.origin !== window.location.origin) return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || fallback
  } catch {
    return fallback
  }
}

function OnboardingScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const { profile, userMode, completeOnboarding } = useDashboard()

  const query = useMemo(() => new URLSearchParams(location.search), [location.search])
  const returnPath = useMemo(() => resolveReturnPath(query.get('returnTo')), [query])
  const defaultName =
    profile?.name && !['Student Workspace', 'Guest User'].includes(profile.name) ? profile.name : ''

  const [name, setName] = useState(defaultName)
  const [institution, setInstitution] = useState(String(profile?.institution || ''))
  const [major, setMajor] = useState(String(profile?.major || ''))
  const [focus, setFocus] = useState(String(profile?.focus || ''))

  const onSubmit = (event) => {
    event.preventDefault()
    completeOnboarding({
      name,
      institution,
      major,
      focus
    })
    navigate(returnPath, { replace: true })
  }

  const welcomeLabel = userMode === 'google' ? 'Welcome to Donna' : 'Welcome, let’s set up your workspace'

  return (
    <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center px-6">
      <div className="w-full max-w-xl rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_24px_60px_rgba(43,52,55,0.08)] p-8">
        <p className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">Onboarding</p>
        <h1 className="font-headline text-3xl font-light mt-2">{welcomeLabel}</h1>
        <p className="text-sm text-on-surface-variant mt-2">
          Share a few details so Donna can personalize your planning workflow.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1.5">Display name</label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className="w-full rounded-xl border-none bg-surface-container-low px-3 py-2 text-sm focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs text-on-surface-variant block mb-1.5">School or university</label>
            <input
              value={institution}
              onChange={(event) => setInstitution(event.target.value)}
              placeholder="e.g. NYU"
              className="w-full rounded-xl border-none bg-surface-container-low px-3 py-2 text-sm focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-on-surface-variant block mb-1.5">Major or program</label>
              <input
                value={major}
                onChange={(event) => setMajor(event.target.value)}
                placeholder="Computer Science"
                className="w-full rounded-xl border-none bg-surface-container-low px-3 py-2 text-sm focus:ring-1 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs text-on-surface-variant block mb-1.5">Current focus</label>
              <input
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                placeholder="Midterm prep"
                className="w-full rounded-xl border-none bg-surface-container-low px-3 py-2 text-sm focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-on-surface text-surface px-4 py-3 text-sm"
          >
            Continue to Dashboard
          </button>
        </form>
      </div>
    </div>
  )
}

export default OnboardingScreen

