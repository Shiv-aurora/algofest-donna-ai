import { Link } from 'react-router-dom'
import { LANDING_ROUTES } from './landingLinks'

function LandingFooter() {
  return (
    <footer className="border-t border-black/10 bg-[#FDFDFD] px-8 py-8 md:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p className="text-[13px] text-[#1A1C1E]">Donna · hybrid neuro-symbolic academic planner</p>
          <div className="flex items-center gap-5 text-[13px]">
            <Link to={LANDING_ROUTES.app} className="text-[#44474E] transition-colors hover:text-[#1A1C1E]">
              Live app
            </Link>
            <a href={LANDING_ROUTES.github} target="_blank" rel="noreferrer" className="text-[#44474E] transition-colors hover:text-[#1A1C1E]">
              GitHub
            </a>
          </div>
        </div>
        <div className="mt-4 border-t border-black/10 pt-3 text-[11px] uppercase tracking-[0.16em] text-black/40">
          © 2026 · built for algorithmic planning systems
        </div>
      </div>
    </footer>
  )
}

export default LandingFooter
