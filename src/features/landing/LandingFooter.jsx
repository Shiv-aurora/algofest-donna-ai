import { Link } from 'react-router-dom'

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Dashboard', href: '#interface' },
      { label: 'Assessments', href: '#interface' }
    ]
  },
  {
    title: 'Integrations',
    links: [
      { label: 'Google Calendar', href: '#nexus' },
      { label: 'LMS Sync', href: '#nexus' }
    ]
  },
  {
    title: 'Workflow',
    links: [
      { label: 'Daily Planner', href: '#interface' },
      { label: 'Focus Blocks', href: '#attention' }
    ]
  },
  {
    title: 'Get Started',
    links: [
      { label: 'How It Works', href: '#philosophy' },
      { label: 'Open App', href: '#interface' }
    ]
  }
]

function LandingFooter() {
  return (
    <footer className="border-t border-black/5 bg-white px-8 py-20 md:px-16">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-12 md:flex-row md:items-center">
        <div className="space-y-4">
          <Link to="/" className="text-sm font-light uppercase tracking-[0.2em] text-[#1A1C1E]">
            Donna <span className="opacity-50">AI</span>
          </Link>
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/40">
            Academic Planning Agent for High-Output Students.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-12 md:grid-cols-4">
          {FOOTER_COLUMNS.map((column) => (
            <div key={column.title}>
              <h5 className="mb-4 text-[10px] font-bold uppercase tracking-[0.3em] text-[#1A1C1E]">
                {column.title}
              </h5>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-[10px] uppercase tracking-[0.3em] text-black/50 transition-colors hover:text-[#78909C]"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-20 max-w-7xl border-t border-black/5 pt-10 text-center text-[9px] uppercase tracking-[0.3em] text-black/30">
        © 2026 Donna AI. Built for Better Study Decisions.
      </div>
    </footer>
  )
}

export default LandingFooter
