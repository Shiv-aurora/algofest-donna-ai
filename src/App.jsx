import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './layouts/AppLayout'
import PublicLayout from './layouts/PublicLayout'

const LandingScreen = lazy(() => import('./screens/LandingScreen'))
const AssignmentsScreen = lazy(() => import('./screens/AssignmentsScreen'))
const CalendarScreen = lazy(() => import('./screens/CalendarScreen'))
const GoalsScreen = lazy(() => import('./screens/GoalsScreen'))
const OverviewScreen = lazy(() => import('./screens/OverviewScreen'))
const SettingsScreen = lazy(() => import('./screens/SettingsScreen'))

function RouteFallback() {
  return <div className="min-h-screen bg-surface" />
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<LandingScreen />} />
        </Route>

        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<OverviewScreen />} />
          <Route path="/overview" element={<Navigate to="/dashboard" replace />} />
          <Route path="/today" element={<Navigate to="/dashboard" replace />} />
          <Route path="/assignments" element={<AssignmentsScreen />} />
          <Route path="/calendar" element={<CalendarScreen />} />
          <Route path="/goals" element={<GoalsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
