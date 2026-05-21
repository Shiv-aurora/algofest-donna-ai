import { Link } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'Product', href: '#interface' },
  { label: 'Integrations', href: '#nexus' },
  { label: 'How It Works', href: '#philosophy' }
]

function LandingHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-8 py-8 mix-blend-difference md:px-16">
      <Link
        to="/"
        className="text-sm font-light uppercase tracking-[0.2em] text-white"
      >
        Donna <span className="opacity-50">AI</span>
      </Link>

      <nav className="hidden items-center space-x-12 md:flex">
        {NAV_ITEMS.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="text-[11px] uppercase tracking-[0.2em] text-white/70 transition-colors hover:text-white"
          >
            {item.label}
          </a>
        ))}
      </nav>

      <Link
        to="/dashboard"
        className="border-b border-white/30 pb-1 text-[11px] uppercase tracking-[0.2em] text-white transition-all hover:border-white"
      >
        Enter App
      </Link>
    </header>
  )
}

export default LandingHeader
