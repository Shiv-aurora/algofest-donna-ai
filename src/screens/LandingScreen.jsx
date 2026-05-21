import { Link } from 'react-router-dom'
import LandingFooter from '../features/landing/LandingFooter'
import LandingHeader from '../features/landing/LandingHeader'
import { NexusOrbVisual, RhythmEngineVisual } from '../features/landing/LandingVisuals'
import '../features/landing/landing.css'

const PHILOSOPHY_FEATURES = ['Prioritized Workflows', 'Clear Next Actions']

const OVERVIEW_FEATURES = ['Assignment + Calendar Visibility', 'One-Click Replanning']

const NEXUS_FEATURES = [
  {
    icon: 'lan',
    title: 'LMS + Calendar Sync',
    copy: 'Connect Google Calendar and academic systems so Donna can plan around real deadlines.'
  },
  {
    icon: 'auto_awesome',
    title: 'Actionable AI',
    copy: 'Propose concrete study blocks, then execute with approval and full action history.'
  }
]

const ATTENTION_METRICS = [
  {
    value: 'LIVE',
    label: 'Connected Context',
    copy: 'Donna reads upcoming events and deadlines before suggesting your next block.'
  },
  {
    value: 'SAFE',
    label: 'Approval First',
    copy: 'Calendar writes happen only after explicit approval, with status tracking.'
  },
  {
    value: 'CLEAR',
    label: 'Action Logs',
    copy: 'Every proposed and executed study action is visible for reliable demo and review.'
  }
]

function SectionEyebrow({ children, className = '' }) {
  return (
    <span className={`block text-[10px] font-medium uppercase tracking-[0.4em] text-[#78909C] ${className}`}>
      {children}
    </span>
  )
}

function LandingScreen() {
  return (
    <div className="bg-[#FDFDFD] text-[#1A1C1E] selection:bg-[#78909C]/20">
      <LandingHeader />

      <main>
        <section className="landing-page__cinematic-gradient relative flex min-h-screen items-center justify-center overflow-hidden px-8 pt-28">
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute left-[-10%] top-[-10%] h-[60%] w-[60%] rounded-full bg-[#78909C]/5 blur-[160px]" />
            <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] rounded-full bg-sky-100/20 blur-[160px]" />
          </div>

          <div className="relative z-10 w-full max-w-6xl text-center">
            <SectionEyebrow className="mb-12 opacity-80">AI Planner for Academic Workflows</SectionEyebrow>
            <h1 className="mb-16 font-headline text-6xl font-extralight leading-[0.95] tracking-[-0.01em] text-[#1A1C1E] md:text-[7.5rem]">
              The Silent Architecture <br />
              of Academic Excellence.
            </h1>

            <div className="flex flex-col items-center justify-center gap-12 md:flex-row">
              <p className="max-w-sm border-l border-black/10 pl-8 text-left text-lg font-light leading-relaxed text-[#44474E]">
                Plan assignments, schedule focus blocks, and keep your calendar aligned with real deadlines.
              </p>
              <div className="flex gap-6">
                <Link
                  to="/dashboard"
                  className="rounded-full bg-[#1A1C1E] px-10 py-5 text-[10px] uppercase tracking-[0.2em] text-[#FDFDFD] transition-all hover:bg-[#1A1C1E]/90"
                >
                  Open Dashboard
                </Link>
              </div>
            </div>
          </div>

          <div className="landing-page__scroll-hint absolute bottom-12 left-1/2 -translate-x-1/2 text-[#78909C] opacity-40">
            <span className="material-symbols-outlined !text-4xl">expand_more</span>
          </div>
        </section>

        <section id="philosophy" className="bg-white px-8 py-40 md:px-24">
          <div className="landing-page__grid mx-auto max-w-7xl">
            <div className="col-span-12 mb-20 md:col-span-5 md:mb-0">
              <SectionEyebrow className="mb-8">The Philosophy</SectionEyebrow>
              <h2 className="mb-8 font-headline text-4xl font-light leading-tight md:text-5xl">
                Cognitive Sovereignty <br />
                in a World of Noise.
              </h2>
              <p className="mb-12 text-lg font-light leading-relaxed text-[#44474E]">
                Donna is built to remove planning friction. It turns your workload, dates, and calendar context into practical next actions.
              </p>

              <div className="space-y-8">
                {PHILOSOPHY_FEATURES.map((feature) => (
                  <div key={feature} className="group cursor-default">
                    <h3 className="mb-2 text-sm font-medium transition-colors group-hover:text-[#78909C]">{feature}</h3>
                    <div className="relative h-px w-full overflow-hidden bg-black/10">
                      <div className="absolute inset-y-0 left-0 w-0 bg-[#78909C] transition-all duration-700 group-hover:w-full" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative col-span-12 md:col-start-7 md:col-span-6">
              <div className="overflow-hidden rounded-xl bg-[#F8FAFB] shadow-2xl">
                <img
                  alt="Quiet minimalist study space"
                  className="landing-page__image-reveal h-full w-full object-cover grayscale opacity-80"
                  src="/images/landing/philosophy-study.jpg"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-10 -left-10 hidden max-w-xs rounded-lg bg-white p-8 shadow-xl md:block">
                <p className="text-xs font-light leading-relaxed text-[#44474E]">
                  Donna combines dashboard planning, assessments, goals, and calendar actions in one workflow.
                </p>
                <div className="mt-4 text-[10px] font-semibold uppercase tracking-[0.3em]">Built for Student Ops</div>
              </div>
            </div>
          </div>
        </section>

        <section id="interface" className="relative bg-[#F8FAFB] px-8 py-40 md:px-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-32 text-center">
              <SectionEyebrow className="mb-4">The Interface</SectionEyebrow>
              <h2 className="font-headline text-5xl font-light tracking-tight md:text-6xl">The Digital Atelier</h2>
            </div>

            <div className="landing-page__grid mb-40 items-center">
              <div className="col-span-12 lg:col-span-7">
                <div className="overflow-hidden rounded-2xl shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] ring-1 ring-black/5">
                  <img
                    alt="The Overview Mockup"
                    className="w-full"
                    src="/images/landing/overview-mockup.jpg"
                    loading="lazy"
                  />
                </div>
              </div>

              <div className="col-span-12 mt-12 lg:col-start-9 lg:col-span-4 lg:mt-0">
                <h3 className="mb-6 font-headline text-3xl font-light">The Overview</h3>
                <p className="mb-8 font-light leading-relaxed text-[#44474E]">
                  Track today&apos;s priorities, focus assignments, and AI recommendations in one place.
                </p>
                <ul className="space-y-4">
                  {OVERVIEW_FEATURES.map((feature, index) => (
                    <li key={feature} className="flex items-center gap-3 text-xs tracking-wide text-[#1A1C1E]">
                      <span className={`h-1.5 w-1.5 rounded-full ${index === 0 ? 'bg-[#78909C]' : 'bg-[#78909C]/40'}`} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="landing-page__grid items-center">
              <div className="col-span-12 mb-12 lg:col-span-4 lg:mb-0">
                <h3 className="mb-6 font-headline text-3xl font-light">Today's Rhythm</h3>
                <p className="mb-8 font-light leading-relaxed text-[#44474E]">
                  Ask Donna to optimize your day, propose a study block, and push approved plans into your calendar.
                </p>
                <Link
                  to="/dashboard"
                  className="border-b border-[#78909C]/40 pb-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#1A1C1E]"
                >
                  View Planner Flow
                </Link>
              </div>

              <div className="col-span-12 lg:col-start-6 lg:col-span-7">
                <RhythmEngineVisual />
              </div>
            </div>
          </div>
        </section>

        <section id="nexus" className="relative overflow-hidden bg-[#1A1C1E] px-8 py-40 text-[#FDFDFD]">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/2 opacity-10">
            <svg className="h-full w-full" viewBox="0 0 400 400" aria-hidden="true">
              <circle cx="200" cy="200" r="150" fill="none" stroke="white" strokeDasharray="2 4" strokeWidth="0.5" />
              <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeDasharray="1 3" strokeWidth="0.5" />
            </svg>
          </div>

          <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-24 lg:grid-cols-2">
            <div>
              <SectionEyebrow className="mb-6 text-[#78909C]/80">The Engine of Intelligence</SectionEyebrow>
              <h2 className="mb-12 font-headline text-5xl font-extralight tracking-[-0.01em] md:text-7xl">Nexus Core</h2>
              <p className="mb-12 text-xl font-light leading-relaxed text-white/60">
                This is the integration layer that powers Donna actions with real provider context and execution logs.
              </p>

              <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
                {NEXUS_FEATURES.map((feature) => (
                  <div
                    key={feature.title}
                    className="group rounded-xl border border-white/10 p-8 transition-colors hover:bg-white/5"
                  >
                    <span className="material-symbols-outlined mb-4 block text-[#78909C] transition-transform group-hover:scale-110">
                      {feature.icon}
                    </span>
                    <h3 className="mb-2 text-sm uppercase tracking-[0.3em]">{feature.title}</h3>
                    <p className="text-xs leading-relaxed text-white/40">{feature.copy}</p>
                  </div>
                ))}
              </div>
            </div>

            <NexusOrbVisual />
          </div>
        </section>

        <section id="attention" className="border-b border-black/5 bg-white px-8 py-40">
          <div className="mx-auto max-w-5xl">
            <div className="mb-24 text-center">
              <span className="mb-4 block text-[10px] uppercase tracking-[0.3em] text-black/40">Scientific Foundation</span>
              <h2 className="font-headline text-4xl font-light">Operational Reliability</h2>
            </div>

            <div className="grid grid-cols-1 gap-20 md:grid-cols-3">
              {ATTENTION_METRICS.map((metric) => (
                <div key={metric.label} className="text-center">
                  <div className="mb-4 text-4xl font-extralight text-[#78909C]">{metric.value}</div>
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-black/60">{metric.label}</p>
                  <p className="text-[13px] font-light leading-relaxed text-[#44474E]">{metric.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#FDFDFD] px-8 py-60 text-center">
          <div className="absolute left-1/2 top-0 h-px w-full -translate-x-1/2 bg-gradient-to-r from-transparent via-[#78909C]/20 to-transparent" />
          <div className="relative z-10 mx-auto max-w-4xl">
            <h2 className="mb-12 font-headline text-5xl font-extralight tracking-[-0.01em] md:text-7xl">Return to Clarity.</h2>
            <p className="mx-auto mb-16 max-w-2xl text-xl font-light text-[#44474E]">
              Start with your dashboard, connect calendar when ready, and let Donna handle execution-grade study planning.
            </p>
            <Link to="/dashboard" className="group relative inline-flex items-center justify-center">
              <div className="absolute inset-0 scale-110 rounded-full bg-[#78909C]/20 opacity-0 blur-xl transition-all duration-700 group-hover:scale-125 group-hover:opacity-100" />
              <div className="relative rounded-full bg-[#1A1C1E] px-16 py-6 text-xs uppercase tracking-[0.2em] text-[#FDFDFD] transition-all hover:bg-[#1A1C1E]/90">
                Launch Donna
              </div>
            </Link>
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  )
}

export default LandingScreen
