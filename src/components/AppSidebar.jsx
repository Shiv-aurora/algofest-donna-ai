import { Link, useLocation } from 'react-router-dom'
import { useDashboard } from '../state/DashboardProvider'

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: 'dashboard', to: '/dashboard' },
  { key: 'assessments', label: 'Assessments', icon: 'assignment', to: '/assignments' },
  { key: 'goals', label: 'Goals', icon: 'ads_click', to: '/goals' },
  { key: 'settings', label: 'Settings', icon: 'settings', to: '/settings' }
]

function routeKey(pathname) {
  if (pathname.startsWith('/assignments') || pathname.startsWith('/calendar')) return 'assessments'
  if (pathname.startsWith('/goals')) return 'goals'
  if (pathname.startsWith('/settings')) return 'settings'
  return 'dashboard'
}

function AppSidebar() {
  const location = useLocation()
  const {
    profile,
    userMode,
    accountMenuOpen,
    setAccountMenuOpen,
    setApiKeyEditorOpen,
    setChatOpen,
    logoutSession
  } = useDashboard()

  const activeKey = routeKey(location.pathname)

  return (
    <aside className="hidden md:flex flex-col h-full w-64 bg-slate-100/30 border-r border-slate-200/10 p-6 space-y-2">
      <div className="flex items-center gap-3 mb-10 px-3">
        <div>
          <h1 className="font-headline font-light text-slate-900 tracking-widest text-lg">Donna</h1>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.key === activeKey
          return (
            <Link
              key={item.key}
              to={item.to}
              className={`p-3 flex items-center gap-3 transition-transform duration-200 hover:translate-x-1 ${
                isActive
                  ? 'text-slate-900 bg-white/50 rounded-xl shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="material-symbols-outlined">{item.icon}</span>
              <span className="text-sm font-label tracking-wide">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="mt-auto pt-5 border-t border-outline-variant/20">
        <button
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/50 transition-colors"
          onClick={() => setAccountMenuOpen((value) => !value)}
        >
          <img
            alt="Account avatar"
            className="w-9 h-9 rounded-full object-cover border border-white/60"
            src={profile.avatar || '/images/overview-profile.jpg'}
          />
          <div className="text-left">
            <p className="text-sm font-medium text-on-surface">{profile.name}</p>
            <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">
              {userMode === 'demo' ? 'Demo Session' : userMode === 'guest' ? 'Guest Session' : 'Google Session'}
            </p>
          </div>
          <span className="material-symbols-outlined ml-auto text-on-surface-variant text-[18px]">expand_more</span>
        </button>

        <div
          className={`mt-3 bg-surface-container-low rounded-xl p-2 space-y-1 ${
            accountMenuOpen ? '' : 'hidden'
          }`}
        >
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-lowest transition-colors"
            onClick={() => setAccountMenuOpen(false)}
          >
            Profile
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-lowest transition-colors"
            onClick={() => {
              setApiKeyEditorOpen(true)
              setChatOpen(true)
              setAccountMenuOpen(false)
            }}
          >
            API Key
          </button>
          <button
            className="w-full text-left px-3 py-2 rounded-lg text-xs text-on-surface-variant hover:bg-surface-container-lowest transition-colors"
            onClick={async () => {
              const confirmed = window.confirm('Log out of Donna?')
              if (!confirmed) return
              setAccountMenuOpen(false)
              await logoutSession(`${window.location.origin}/login`)
            }}
          >
            Log Out
          </button>
        </div>
      </div>
    </aside>
  )
}

export default AppSidebar
