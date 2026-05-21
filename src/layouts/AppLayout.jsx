import { Outlet } from 'react-router-dom'
import DonnaChatWidget from '../components/DonnaChatWidget'
import { DashboardProvider } from '../state/DashboardProvider'

function AppLayout() {
  return (
    <DashboardProvider>
      <Outlet />
      <DonnaChatWidget />
    </DashboardProvider>
  )
}

export default AppLayout
