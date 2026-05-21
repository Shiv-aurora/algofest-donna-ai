import { Navigate, Outlet, useLocation } from 'react-router-dom'
import DonnaChatWidget from '../components/DonnaChatWidget'
import { DashboardProvider } from '../state/DashboardProvider'
import { useDashboard } from '../state/DashboardProvider'

function AppLayoutInner() {
  const location = useLocation()
  const { authConnectivity, onboardingCompleted, userMode } = useDashboard()
  const isOnboardingRoute = location.pathname === '/onboarding'

  if (authConnectivity.loading) {
    return <div className="min-h-screen bg-surface" />
  }

  if (!authConnectivity.auth?.authenticated) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    const target = `/login?returnTo=${encodeURIComponent(returnTo)}`
    return <Navigate to={target} replace />
  }

  if (userMode !== 'demo' && !onboardingCompleted && !isOnboardingRoute) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    return <Navigate to={`/onboarding?returnTo=${encodeURIComponent(returnTo)}`} replace />
  }

  if (userMode !== 'demo' && onboardingCompleted && isOnboardingRoute) {
    const query = new URLSearchParams(location.search)
    const returnTo = String(query.get('returnTo') || '/dashboard')
    return <Navigate to={returnTo} replace />
  }

  return (
    <>
      <Outlet />
      {!isOnboardingRoute && <DonnaChatWidget />}
    </>
  )
}

function AppLayout() {
  return (
    <DashboardProvider>
      <AppLayoutInner />
    </DashboardProvider>
  )
}

export default AppLayout
