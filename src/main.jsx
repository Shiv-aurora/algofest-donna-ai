import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'
import { DashboardProvider } from './state/DashboardProvider'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DashboardProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </DashboardProvider>
  </StrictMode>
)
