import { Link } from 'react-router-dom'
import { NexusOrbVisual, RhythmEngineVisual } from './LandingVisuals'

const PROBLEM_POINTS = [
  {
    title: 'Six tabs, one notes file.',
    copy: 'Assignments, calendar, and priorities end up scattered across tools.'
  },
  {
    title: 'Plans built too late.',
    copy: 'You guess tomorrow at night, then re-plan again in the morning.'
  },
  {
    title: 'To-do lists keep growing.',
    copy: 'Tasks roll over without getting blocked into real time slots.'
  }
]

const SOLUTION_POINTS = [
  {
    title: 'One command center.',
    copy: 'Dashboard, assignments, calendar, goals, and settings live in one workflow.'
  },
  {
    title: 'Proposal then approval.',
    copy: 'Donna drafts study blocks from context. You approve before execution.'
  },
  {
    title: 'Actions with history.',
    copy: 'Proposed, approved, executed, and failed transitions are kept in action logs.'
  }
]

const FEATURE_CARDS = [
  {
    id: '01',
    title: 'A planned day before you open your laptop.',
    copy: 'Priorities are ordered around fixed events and available focus windows.'
  },
  {
    id: '02',
    title: 'Approval-first calendar execution.',
    copy: 'Nothing is written to calendar until you explicitly approve the action.'
  },
  {
    id: '03',
    title: 'Aspirations and progress in one place.',
    copy: 'Track long-term goals through logged sessions and progression context.'
  },
  {
    id: '04',
    title: 'Action history for every Donna operation.',
    copy: 'Each study-block proposal and execution result remains visible and traceable.'
  },
  {
    id: '05',
    title: 'Connectivity-aware behavior.',
    copy: 'If provider is unavailable, Donna returns clear machine-readable guard states.'
  }
]

const TRUST_ITEMS = [
  'Donna proposes before acting.',
  'Approval is required for provider-backed writes.',
  'Action lifecycle is visible: proposed, approved, executed, failed.',
  'Calendar connectivity state is explicit across the app.',
  'Fallback planning works even when provider is unavailable.',
  'No fake success path: failures are surfaced with concise reasons.'
]

function SectionKicker({ children }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[#74777F]">
      <span className="inline-block h-px w-5 bg-[#74777F]/50" />
      {children}
    </div>
  )
}

export function LandingHeroSection() {
  return (
    <section className="landing-page__hero-gradient relative overflow-hidden px-8 pb-24 pt-36 md:px-16 md:pt-40">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-14%] h-[52%] w-[45%] rounded-full bg-[#78909C]/10 blur-[120px]" />
        <div className="absolute bottom-[-16%] right-[-8%] h-[46%] w-[40%] rounded-full bg-[#c9e7f7]/80 blur-[110px]" />
      </div>

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.15fr_1fr]">
        <div data-reveal>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#C4C7CF] bg-white/70 px-3 py-1 text-[12px] text-[#44474E]">
            <span className="h-2 w-2 rounded-full bg-[#4d8a6e]" />
            Approval-first AI for academic planning
          </div>

          <h1 className="font-headline text-[clamp(48px,8vw,96px)] font-extrabold leading-[0.96] tracking-[-0.04em] text-[#1A1C1E]">
            Your academic <span className="text-[#466270]">chief of staff.</span>
          </h1>
          <p className="mt-7 max-w-xl text-[18px] font-light leading-relaxed text-[#44474E]">
            Donna combines assignments, calendar context, and goal signals to propose focused work blocks that you can approve and execute.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link to="/dashboard" className="landing-page__btn-primary">
              Start with Donna
              <span aria-hidden="true">↗</span>
            </Link>
            <a href="#preview" className="landing-page__btn-ghost">
              See product preview
            </a>
          </div>

          <div className="mt-8 flex flex-wrap gap-5 text-[12px] text-[#74777F]">
            <span>Assignment + calendar planning</span>
            <span>Proposal + approval flow</span>
            <span>Action history visibility</span>
          </div>
        </div>

        <div data-reveal>
          <div className="landing-page__product-card">
            <div className="landing-page__product-top">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#e08a7a]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#e0b87a]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#a3c89c]" />
              </div>
              <span className="text-[11px] text-[#74777F]">donna.app • planned day</span>
            </div>

            <div className="space-y-3 p-5">
              <div className="rounded-xl bg-[#eaeff1] p-3 text-[14px] leading-relaxed text-[#1A1C1E]">
                Three deadlines this week. I can place a 90-minute study block before your 3:00 PM seminar. Approve?
              </div>

              <div className="space-y-2">
                <div className="landing-page__agenda-row">
                  <span className="landing-page__agenda-time">10:30</span>
                  <span className="landing-page__agenda-label">CHEM 142 · problem set review</span>
                  <span className="landing-page__agenda-tag">deep</span>
                </div>
                <div className="landing-page__agenda-row">
                  <span className="landing-page__agenda-time">14:00</span>
                  <span className="landing-page__agenda-label">PHIL 220 reading sprint</span>
                  <span className="landing-page__agenda-tag">review</span>
                </div>
                <div className="landing-page__agenda-row">
                  <span className="landing-page__agenda-time">19:30</span>
                  <span className="landing-page__agenda-label">Orgo flashcards</span>
                  <span className="landing-page__agenda-tag">light</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-[#1A1C1E] px-3 py-2 text-[12px] text-white">
                <span>2 blocks awaiting approval</span>
                <Link to="/dashboard" className="rounded-md border border-white/20 px-2 py-1 text-[11px]">
                  Open app
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingProblemSolutionSection() {
  return (
    <section className="bg-[#1A1C1E] px-8 py-24 text-white md:mx-8 md:rounded-[32px] md:px-16">
      <div className="mx-auto max-w-7xl" data-reveal>
        <SectionKicker>The honest version</SectionKicker>
        <h2 className="font-headline text-[clamp(36px,5vw,56px)] font-bold leading-[1.04] tracking-[-0.03em]">
          Small decisions, made tired, in the dark.
        </h2>

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="rounded-2xl border border-white/15 bg-white/[0.02] p-6">
            <h3 className="mb-5 text-xl font-semibold">Without Donna</h3>
            <ul className="space-y-4 text-sm text-white/70">
              {PROBLEM_POINTS.map((item) => (
                <li key={item.title}>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p>{item.copy}</p>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-[#78909C]/40 bg-[#78909C]/10 p-6">
            <h3 className="mb-5 text-xl font-semibold">With Donna</h3>
            <ul className="space-y-4 text-sm text-[#d7e2e8]">
              {SOLUTION_POINTS.map((item) => (
                <li key={item.title}>
                  <p className="font-semibold text-white">{item.title}</p>
                  <p>{item.copy}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingFeaturesSection() {
  return (
    <section id="features" className="px-8 py-24 md:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6" data-reveal>
          <div>
            <SectionKicker>Capabilities</SectionKicker>
            <h2 className="font-headline text-[clamp(34px,4vw,54px)] font-bold tracking-[-0.03em]">Built for execution.</h2>
          </div>
          <p className="max-w-md text-[16px] text-[#44474E]">These are the actual behaviors in the product today, not mock controls.</p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {FEATURE_CARDS.map((card) => (
            <article
              key={card.id}
              data-reveal
              className="landing-page__feature-card rounded-2xl border border-[#C4C7CF]/80 bg-white p-6 shadow-[0_24px_40px_-30px_rgba(0,0,0,0.35)]"
            >
              <div className="mb-3 text-[12px] font-semibold tracking-[0.2em] text-[#74777F]">{card.id}</div>
              <h3 className="text-[20px] font-semibold leading-tight text-[#1A1C1E]">{card.title}</h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#44474E]">{card.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingHowSection() {
  return (
    <section id="how" className="px-8 pb-20 pt-8 md:px-16">
      <div className="mx-auto max-w-7xl" data-reveal>
        <SectionKicker>How it works</SectionKicker>
        <h2 className="font-headline text-[clamp(34px,4vw,54px)] font-bold tracking-[-0.03em]">
          Three steps. One approval away.
        </h2>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[#C4C7CF] bg-white p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#74777F]">Step 1</div>
            <h3 className="mt-2 text-xl font-semibold">Connect</h3>
            <p className="mt-2 text-sm text-[#44474E]">Connect Google Calendar and keep provider status visible in app settings.</p>
          </div>
          <div className="rounded-xl border border-[#C4C7CF] bg-white p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#74777F]">Step 2</div>
            <h3 className="mt-2 text-xl font-semibold">Propose</h3>
            <p className="mt-2 text-sm text-[#44474E]">Donna fetches context and proposes study blocks with structured payloads.</p>
          </div>
          <div className="rounded-xl border border-[#C4C7CF] bg-white p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-[#74777F]">Step 3</div>
            <h3 className="mt-2 text-xl font-semibold">Approve</h3>
            <p className="mt-2 text-sm text-[#44474E]">Approving executes creation and records status transitions in action history.</p>
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingPreviewSection() {
  return (
    <section id="preview" className="bg-white px-8 py-24 md:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-12 flex flex-wrap items-end justify-between gap-6" data-reveal>
          <div>
            <SectionKicker>Product</SectionKicker>
            <h2 className="font-headline text-[clamp(34px,4vw,54px)] font-bold tracking-[-0.03em]">A workspace built around doing the work.</h2>
          </div>
          <p className="max-w-md text-[16px] text-[#44474E]">Overview, assignments, calendar workspace, aspirations, and settings are all accessible in one app shell.</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]" data-reveal>
          <div className="overflow-hidden rounded-2xl border border-[#C4C7CF] bg-[#F8FAFB] shadow-[0_28px_50px_-30px_rgba(0,0,0,0.35)]">
            <img
              src="/images/landing/overview-mockup.jpg"
              alt="Donna dashboard preview"
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>

          <aside className="space-y-4 rounded-2xl border border-[#C4C7CF] bg-[#FDFDFD] p-5">
            <div>
              <div className="text-[12px] uppercase tracking-[0.2em] text-[#74777F]">Live behavior</div>
              <h3 className="mt-2 text-[22px] font-semibold text-[#1A1C1E]">Donna Actions</h3>
            </div>

            <div className="rounded-xl border border-[#C4C7CF] bg-white p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#74777F]">Proposed</div>
              <p className="mt-1 text-sm text-[#1A1C1E]">CHEM 142 study block • 7:00 PM - 8:30 PM</p>
            </div>
            <div className="rounded-xl border border-[#C4C7CF] bg-white p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#74777F]">Execution</div>
              <p className="mt-1 text-sm text-[#1A1C1E]">Approved actions call backend and create calendar events when connected.</p>
            </div>
            <div className="rounded-xl border border-[#C4C7CF] bg-white p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-[#74777F]">History</div>
              <p className="mt-1 text-sm text-[#1A1C1E]">Latest statuses remain visible: proposed, approved, executed, failed.</p>
            </div>

            <Link to="/dashboard" className="landing-page__btn-primary inline-flex">
              Open live app
            </Link>
          </aside>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <div data-reveal>
            <RhythmEngineVisual />
          </div>
          <div data-reveal>
            <NexusOrbVisual />
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingTrustSection() {
  return (
    <section id="trust" className="px-8 py-24 md:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6" data-reveal>
          <div>
            <SectionKicker>Trust and control</SectionKicker>
            <h2 className="font-headline text-[clamp(34px,4vw,54px)] font-bold tracking-[-0.03em]">An agent that asks before it acts.</h2>
          </div>
          <p className="max-w-md text-[16px] text-[#44474E]">Donna prioritizes explicit approval and clear operational state over hidden automation.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-reveal>
          {TRUST_ITEMS.map((item, index) => (
            <article key={item} className="rounded-xl border border-[#C4C7CF] bg-white p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#74777F]">No. {String(index + 1).padStart(2, '0')}</div>
              <p className="mt-2 text-sm leading-relaxed text-[#1A1C1E]">{item}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function LandingFinalCtaSection() {
  return (
    <section className="landing-page__final relative overflow-hidden px-8 py-28 text-center text-white md:px-16" data-reveal>
      <div className="mx-auto max-w-4xl">
        <SectionKicker>Free for students</SectionKicker>
        <h2 className="font-headline text-[clamp(40px,5vw,66px)] font-bold tracking-[-0.03em]">
          Stop planning at midnight.
          <br />
          Start tomorrow finished.
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] text-white/75">
          Open the app, review the proposed day, and approve the study blocks that should hit your calendar.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link to="/dashboard" className="landing-page__btn-primary">
            Start with Donna
          </Link>
          <a href="#preview" className="landing-page__btn-ghost landing-page__btn-ghost--dark">
            See planned-day preview
          </a>
        </div>
      </div>
    </section>
  )
}
