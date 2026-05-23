import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  buildGoogleLoginUrl,
  checkBackendHealth,
  getAuthMe,
  loginDemo,
  loginGuest
} from '../state/connectivityApi'

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

function LoginScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const query = useMemo(() => new URLSearchParams(location.search), [location.search])
  const returnPath = useMemo(() => resolveReturnPath(query.get('returnTo')), [query])
  const returnToAbsolute = `${window.location.origin}${returnPath}`

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    const authFailed = query.get('auth') === 'failed'
    const reason = query.get('reason')
    const message = query.get('message')
    if (authFailed) {
      setErrorMessage(String(message || reason || 'Authentication failed. Please try again.'))
    }
  }, [query])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const auth = await getAuthMe()
        if (!cancelled && auth?.authenticated) {
          navigate(returnPath, { replace: true })
          return
        }
      } catch {
        // Keep login screen usable even if backend is warming up.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [navigate, returnPath])

  const continueWithGoogle = async () => {
    setErrorMessage('')
    setSubmitting('google')
    const healthy = await checkBackendHealth()
    if (!healthy) {
      setSubmitting('')
      setErrorMessage('Backend is offline. Start servers with `npm run dev` and try again.')
      return
    }
    window.location.assign(buildGoogleLoginUrl(returnToAbsolute))
  }

  const continueAsGuest = async () => {
    setSubmitting('guest')
    setErrorMessage('')
    try {
      const response = await loginGuest({ returnTo: returnToAbsolute })
      window.location.assign(response?.redirectTo || returnToAbsolute)
    } catch (error) {
      setSubmitting('')
      setErrorMessage(error?.message || 'Unable to create guest session.')
    }
  }

  const continueAsDemo = async () => {
    setSubmitting('demo')
    setErrorMessage('')
    try {
      const response = await loginDemo({ returnTo: returnToAbsolute })
      window.location.assign(response?.redirectTo || returnToAbsolute)
    } catch (error) {
      setSubmitting('')
      setErrorMessage(error?.message || 'Unable to start demo session.')
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-[0_24px_60px_rgba(43,52,55,0.08)] p-7">
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">Donna</p>
          <h1 className="font-headline text-3xl font-light mt-2">Choose how to continue</h1>
          <p className="text-sm text-on-surface-variant mt-2">
            Sign in with Google, continue as guest, or explore the demo experience.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={continueAsDemo}
            disabled={loading || Boolean(submitting)}
            className="w-full rounded-2xl bg-primary-container text-on-primary-container px-4 py-4 text-base font-semibold disabled:opacity-60"
          >
            {submitting === 'demo' ? 'Opening demo...' : 'Explore Demo'}
          </button>
          <p className="-mt-2 px-2 text-xs text-on-surface-variant">Pre-seeded data</p>

          <button
            onClick={continueAsGuest}
            disabled={loading || Boolean(submitting)}
            className="w-full rounded-full bg-surface-container-low border border-outline-variant/30 text-on-surface px-4 py-3 text-sm disabled:opacity-60"
          >
            {submitting === 'guest' ? 'Starting guest session...' : 'Continue as Guest'}
          </button>
          <p className="-mt-2 px-2 text-xs text-on-surface-variant">Requires onboarding</p>

          <button
            onClick={continueWithGoogle}
            disabled={loading || Boolean(submitting)}
            className="w-full rounded-full bg-on-surface text-surface px-4 py-3 text-sm disabled:opacity-60"
          >
            {submitting === 'google' ? 'Redirecting to Google...' : 'Continue with Google'}
          </button>
          <p className="-mt-2 px-2 text-xs text-on-surface-variant">Requires onboarding</p>
        </div>

        {errorMessage && (
          <p className="mt-4 rounded-xl bg-error-container/20 px-3 py-2 text-xs text-error">{errorMessage}</p>
        )}

        <div className="mt-6 pt-4 border-t border-outline-variant/20">
          <Link className="text-xs text-on-surface-variant hover:text-on-surface transition-colors" to="/">
            Back to landing page
          </Link>
        </div>
      </div>
    </div>
  )
}

export default LoginScreen
