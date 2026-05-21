import { Navigate, Route, Routes } from 'react-router-dom'
import AssignmentsScreen from './screens/AssignmentsScreen'
import CalendarScreen from './screens/CalendarScreen'
import DonnaChatWidget from './components/DonnaChatWidget'
import GoalsScreen from './screens/GoalsScreen'
import OverviewScreen from './screens/OverviewScreen'
import SettingsScreen from './screens/SettingsScreen'

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<OverviewScreen />} />
        <Route path="/overview" element={<Navigate to="/dashboard" replace />} />
        <Route path="/today" element={<Navigate to="/dashboard" replace />} />
        <Route path="/assignments" element={<AssignmentsScreen />} />
        <Route path="/calendar" element={<CalendarScreen />} />
        <Route path="/goals" element={<GoalsScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <DonnaChatWidget />
    </>
  )
}

export default App
