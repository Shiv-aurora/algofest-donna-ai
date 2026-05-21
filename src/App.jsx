import { Navigate, Route, Routes } from 'react-router-dom'
import AssignmentsScreen from './screens/AssignmentsScreen'
import CalendarScreen from './screens/CalendarScreen'
import OverviewScreen from './screens/OverviewScreen'
import TodayScreen from './screens/TodayScreen'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/overview" replace />} />
      <Route path="/overview" element={<OverviewScreen />} />
      <Route path="/today" element={<TodayScreen />} />
      <Route path="/assignments" element={<AssignmentsScreen />} />
      <Route path="/calendar" element={<CalendarScreen />} />
      <Route path="*" element={<Navigate to="/overview" replace />} />
    </Routes>
  )
}

export default App
