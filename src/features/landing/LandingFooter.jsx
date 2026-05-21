import { Link } from 'react-router-dom'
import { LANDING_ANCHORS, LANDING_ROUTES } from './landingLinks'

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: LANDING_ANCHORS.features },
      { label: 'Product preview', href: LANDING_ANCHORS.preview },
      { label: 'How it works', href: LANDING_ANCHORS.how }
    ]
  },
  {
    title: 'Workflow',
    links: [
      { label: 'Assignments + Calendar', href: LANDING_ANCHORS.preview },
      { label: 'Study-block approvals', href: LANDING_ANCHORS.how },
      { label: 'Action history', href: LANDING_ANCHORS.trust }
    ]
  },
  {
    title: 'Trust',
    links: [
      { label: 'Approval-first model', href: LANDING_ANCHORS.trust },
      { label: 'Connectivity states', href: LANDING_ANCHORS.trust },
      { label: 'Status visibility', href: LANDING_ANCHORS.trust }
    ]
  }
]

function LandingFooter() {
  return (
    <footer className="border-t border-black/10 bg-[#FDFDFD] px-8 py-16 md:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Link to={LANDING_ROUTES.home} className="text-[20px] font-semibold tracking-[-0.02em] text-[#1A1C1E]">
              Donna
            </Link>
            <p className="max-w-sm text-[12px] uppercase tracking-[0.18em] text-black/45">
              Academic planning agent for execution-grade student workflows.
            </p>
            <Link to={LANDING_ROUTES.app} className="landing-page__btn-primary landing-page__btn-primary--sm inline-flex">
              Enter dashboard
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {FOOTER_COLUMNS.map((column) => (
              <div key={column.title}>
                <h5 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#1A1C1E]">{column.title}</h5>
                <ul className="space-y-2">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} className="text-[12px] text-[#44474E] transition-colors hover:text-[#1A1C1E]">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 border-t border-black/10 pt-6 text-[11px] uppercase tracking-[0.2em] text-black/35">
          © 2026 Donna. Built for reliable academic execution.
        </div>
      </div>
    </footer>
  )
}

export default LandingFooter
