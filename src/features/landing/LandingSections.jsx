import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts'
import { LANDING_ROUTES } from './landingLinks'

const ALGORITHM_CARDS = [
  {
    id: '01',
    title: 'CP-SAT Mixed Integer Program',
    hook: 'min Σ w_k·penalty_k(x)',
    description: 'Schedules tasks into slots with hard and soft constraints.',
    line: 'OR-Tools CP-SAT · tabu warm-restart at n>100',
    depth: {
      title: 'CP-SAT full formulation',
      content:
        'Objective: min energy mismatch + context switching + overflow penalties + urgency misses. Constraints: task-hour coverage, slot exclusivity, blocked windows, deadline consistency, binary assignment variables, non-negative overflow. Includes warm-start strategy and bounded-time re-solves.'
    }
  },
  {
    id: '02',
    title: 'Hierarchical Bayesian Gibbs Sampler',
    hook: 'log(hours) ~ N(μ_u + α_t + β_c + γᵀx, σ²)',
    description: 'Learns personalized task duration quantiles from completion history.',
    line: 'Quantile outputs: P25 / P50 / P75 / P90',
    depth: {
      title: 'Bayesian estimator derivation',
      content:
        'Model uses hierarchical priors for users/tasks/classes with conjugate updates. Gibbs sampling iterates user effects, task effects, and variance terms. Posterior predictive distribution yields quantile bands used by scheduler constraints rather than single-point duration guesses.'
    }
  },
  {
    id: '03',
    title: 'Irreducible Inconsistent Subset extraction',
    hook: 'Output: minimal_conflict_set',
    description: 'Returns minimal conflicting constraints causing schedule infeasibility.',
    line: 'Constraint deletion loop for IIS recovery',
    depth: {
      title: 'IIS extraction details',
      content:
        'When infeasible, system removes constraints iteratively to isolate the smallest unsatisfiable subset. Returns only conflicts whose removal restores feasibility, enabling targeted user edits instead of generic failure messages.'
    }
  },
  {
    id: '04',
    title: 'Large Neighborhood Search (anytime)',
    hook: 'Destroy 10–20% neighborhood, repair with CP-SAT',
    description: 'Repairs local schedule neighborhoods after user-requested changes.',
    line: 'Anytime improvement under fixed latency budget',
    depth: {
      title: 'LNS formulation',
      content:
        'Reoptimization keeps most assignments fixed, selectively releases a local neighborhood, then repairs with CP-SAT. Accepts non-worsening candidates and continues until timeout, returning first feasible quickly while improving objective over remaining budget.'
    }
  },
  {
    id: '05',
    title: 'Cox Proportional Hazards model',
    hook: 'h(t|x) = h₀(t)·exp(βᵀx)',
    description: 'Predicts task start probability to surface procrastination risk.',
    line: 'Triggers nudges when predicted start probability is low',
    depth: {
      title: 'Cox PH details',
      content:
        'Survival model estimates hazard of starting a task based on context features. Baseline hazard is non-parametric while covariates scale risk multiplicatively. Low near-term start probability flags intervention opportunities.'
    }
  },
  {
    id: '06',
    title: 'Thompson Sampling contextual bandit',
    hook: 'Regret bound: O(√(KT log T))',
    description: 'Learns best notification times from response behavior online.',
    line: '504 arms · Beta posterior sampling updates',
    depth: {
      title: 'Thompson sampling details',
      content:
        'Arms are (hour × day × urgency) combinations. For each arm, sample from Beta posterior, pull best sample, observe binary response reward, and update alpha/beta counts online. Balances exploration and exploitation across engagement contexts.'
    }
  },
  {
    id: '07',
    title: 'Heterogeneous Autoregression (HAR)',
    hook: 'load_{t+1} = β_d·d + β_w·w + β_m·m + ε',
    description: 'Forecasts workload spikes using daily, weekly, monthly lags.',
    line: 'Daily + weekly + monthly lag aggregation',
    depth: {
      title: 'HAR forecast details',
      content:
        'Forecast combines short, medium, and long memory terms to estimate upcoming workload. Output drives proactive warning states and informs planner slack allocation before likely crunch windows.'
    }
  },
  {
    id: '08',
    title: 'Linear-Chain Conditional Random Field',
    hook: 'P(y|x) ∝ exp(Σ λ_k f_k(y_{t-1}, y_t, x, t))',
    description: 'Verifies syllabus extraction spans before planning actions trigger.',
    line: 'Viterbi decoding on sequence tag lattice',
    depth: {
      title: 'CRF formulation details',
      content:
        'Sequence model scores tag transitions and token-level features jointly, then decodes highest-probability tag path with Viterbi. Disagreement checks against LLM extraction trigger user review before downstream scheduling.'
    }
  }
]

const DEMO_STEPS = [
  {
    step: 'Upload syllabus PDF',
    algo: 'CRF + LLM extraction',
    detail: 'Produces a structured task graph from syllabus text spans.'
  },
  {
    step: 'Estimate task hours',
    algo: 'Bayesian quantile inference',
    detail: 'Computes uncertainty-aware P25/P75 completion bands.'
  },
  {
    step: 'Build week',
    algo: 'CP-SAT MIP',
    detail: 'Finds a feasible schedule under hard and soft constraints.'
  },
  {
    step: 'Ask "can I take Friday off?"',
    algo: 'IIS-based feasibility',
    detail: 'Returns the minimal conflict set required to satisfy the request.'
  },
  {
    step: 'Apply',
    algo: 'Google Calendar API',
    detail: 'Writes approved blocks as real calendar events.'
  }
]

const latencyData = [
  { n: 25, latency: 482 },
  { n: 50, latency: 511 },
  { n: 100, latency: 564 },
  { n: 150, latency: 572 }
]

const tokenData = [
  { name: 'LLM-only baseline', value: 2500, fill: 'rgba(26,28,30,0.25)' },
  { name: 'Donna v2', value: 13, fill: '#1A1C1E' }
]

const costData = [
  { name: 'LLM-only', value: 0.85, fill: 'rgba(26,28,30,0.25)' },
  { name: 'Donna v2', value: 0.0052, fill: '#1A1C1E' }
]

const HERO_FLOW_STEPS = [
  {
    number: '1',
    title: 'Upload syllabus',
    icon: 'description',
    points: ['Parse coursework']
  },
  {
    number: '2',
    title: 'Sync calendar',
    icon: 'event',
    points: ['Read availability']
  },
  {
    number: '3',
    title: 'Estimate effort',
    icon: 'account_tree',
    points: ['Build feasible week']
  },
  {
    number: '4',
    title: 'Review proposals',
    icon: 'fact_check',
    points: ['Confirm actions']
  },
  {
    number: '5',
    title: 'Write events',
    icon: 'rocket_launch',
    points: ['Track progress']
  }
]

function SectionKicker({ children }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.28em] text-[#74777F]">
      <span className="inline-block h-px w-5 bg-[#74777F]/45" />
      {children}
    </div>
  )
}

function SectionDivider() {
  return <div className="mx-auto h-px w-[min(1120px,92%)] bg-black/10" aria-hidden="true" />
}

function DisclosureModal({ open, title, content, onClose }) {
  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="absolute inset-0 bg-black/45" />
      <div className="relative max-h-[85vh] w-full max-w-[500px] overflow-y-auto rounded-2xl border border-[#C4C7CF] bg-white p-5 shadow-[0_36px_72px_-32px_rgba(0,0,0,0.45)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-4">
          <h4 className="text-[18px] font-semibold text-[#1A1C1E]">{title}</h4>
          <button type="button" onClick={onClose} className="rounded-full border border-[#C4C7CF] px-2.5 py-1 text-[12px] text-[#44474E]">
            Close
          </button>
        </div>
        <p className="text-[14px] leading-relaxed text-[#44474E] whitespace-pre-line">{content}</p>
      </div>
    </div>
  )
}

function DisclosureTrigger({ tier = 'text', label, onClick }) {
  if (tier === 'icon') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/20 text-[11px] text-black/50 transition hover:text-black/80 hover:border-black/40"
      >
        ⓘ
      </button>
    )
  }

  return (
    <button type="button" onClick={onClick} className="text-left text-[13px] font-medium text-[#1A1C1E] underline underline-offset-4 hover:text-[#000]">
      {label}
    </button>
  )
}

function ChartCard({ title, children, caption }) {
  return (
    <article className="rounded-2xl border border-[#C4C7CF] bg-white p-4">
      <h3 className="text-[15px] font-semibold text-[#1A1C1E]">{title}</h3>
      <div className="mt-3 h-[220px]">{children}</div>
      <p className="mt-2 text-[11px] uppercase tracking-[0.12em] text-[#74777F]">{caption}</p>
    </article>
  )
}

export function LandingHeroSection() {
  return (
    <section className="landing-page__hero-gradient relative overflow-hidden px-8 pb-16 pt-2 md:px-16 md:pt-3">
      <div className="relative mx-auto flex w-full max-w-[1500px] flex-col items-center text-center" data-reveal>
        <div className="-mt-6 w-[min(90vw,1180px)] overflow-hidden md:-mt-8">
          <img
            src="/images/mascot/header-image.png?v=2"
            alt="Donna mascot studying with books, laptop, and coffee"
            className="mx-auto w-full object-contain [clip-path:inset(24%_8%_26%_8%)] scale-[0.98] md:scale-[0.96]"
            loading="eager"
          />
        </div>
        <h1 className="-mt-[240px] md:-mt-[220px] lg:-mt-[200px] bg-gradient-to-r from-[#0f1726] via-[#22334d] to-[#0f1726] bg-clip-text font-headline text-[clamp(34px,5vw,56px)] font-extrabold leading-[0.98] tracking-[-0.045em] text-transparent drop-shadow-[0_1px_0_rgba(255,255,255,0.6)]">
          Your Academic Super Agent
        </h1>
        <p className="mt-2 max-w-5xl text-[13px] leading-relaxed text-[#5E6673]">
          Plans your week, reschedules on the fly, finds time for work and hobbies, tracks your progress, learns how you work
          - every decision made by an algorithm, not a guess.
        </p>
        <div className="mt-2 h-px w-[min(300px,58vw)] bg-gradient-to-r from-transparent via-[#99A2B2] to-transparent" />
      </div>
      <div className="relative mx-auto mt-14 max-w-7xl" data-reveal>
        <div className="px-1 md:px-0">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
            {HERO_FLOW_STEPS.map((step, index) => (
              <div key={step.number} className="relative rounded-2xl bg-white/45 p-4 ring-1 ring-[#D1D6DE] backdrop-blur-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E8EDF3] text-[#1A1C1E]">
                    <span className="material-symbols-outlined !text-[18px]">{step.icon}</span>
                  </div>
                  <div className="text-[10px] font-semibold tracking-[0.16em] text-[#6C7380]">{step.number}</div>
                </div>
                <h3 className="text-[20px] font-semibold leading-[1.02] text-[#1A1C1E]">{step.title}</h3>
                <div className="mt-2 space-y-1 text-[11px] text-[#3F4753]">
                  {step.points.map((point) => (
                    <p key={point}>{point}</p>
                  ))}
                </div>
                {index < HERO_FLOW_STEPS.length - 1 ? (
                  <span className="pointer-events-none absolute -right-[12px] top-1/2 hidden -translate-y-1/2 text-[28px] text-[#5f6978] md:block">→</span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export function LandingThesisSection() {
  const [modal, setModal] = useState(null)
  return (
    <>
      <SectionDivider />
      <section className="px-8 py-28 md:px-16" id="thesis">
        <div className="mx-auto max-w-7xl" data-reveal>
          <div className="grid items-start gap-8 lg:grid-cols-[0.68fr_0.32fr]">
            <div>
              <SectionKicker>PRODUCT</SectionKicker>
              <h2 className="font-headline text-[clamp(28px,3.2vw,44px)] font-bold tracking-[-0.03em]">
                Not a LLM wrapper.
              </h2>

              <p className="mt-6 max-w-3xl text-[15px] leading-relaxed text-[#44474E]">
                I first tried building this as an all-LLM planner. The output looked smart, but it was often <strong><em>non-deterministic</em></strong>, inconsistent, and hard to trust for real deadlines. Academic work is too important to leave to a black box, so Donna was redesigned as a <strong><em>hybrid system</em></strong> where LLMs handle language and algorithms handle decisions.
              </p>
              <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-[#44474E]">
                Today it runs on <strong><em>8 algorithmic models</em></strong> to keep planning reliable, cheaper, and scalable while the UX stays simple for students. The goal is practical: help more college students stay on top of academics and still have room to enjoy college life with less stress and better consistency.
              </p>
            </div>

            <div className="mx-auto w-full max-w-[360px]">
              <div className="h-[420px] w-full overflow-hidden">
                <img
                  src="/images/mascot/donna-superman.png"
                  alt="Donna superman mascot"
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </div>
            </div>
          </div>

          <div className="mt-8 overflow-x-auto rounded-2xl border border-[#C4C7CF] bg-white">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <thead className="bg-[#F4F7F8] text-[#1A1C1E]">
                <tr>
                  <th className="border-b border-[#D6D9E0] px-4 py-2.5 font-semibold">Workflow step</th>
                  <th className="border-b border-[#D6D9E0] bg-[#f6f8fb] px-4 py-2.5 font-semibold">Without Donna</th>
                  <th className="border-b border-[#D6D9E0] bg-[#edf3f7] px-4 py-2.5 font-semibold">With Donna</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border-b border-[#ECEFF4] px-4 py-2.5 font-medium text-[#1A1C1E]">Capture coursework</td>
                  <td className="border-b border-[#ECEFF4] bg-[#f9fbfd] px-4 py-2.5 text-[#44474E]">Manual copy from PDFs and LMS pages</td>
                  <td className="border-b border-[#ECEFF4] bg-[#f1f6fa] px-4 py-2.5 font-semibold text-[#1A1C1E]">Syllabus ingestion into structured task graph</td>
                </tr>
                <tr>
                  <td className="border-b border-[#ECEFF4] px-4 py-2.5 font-medium text-[#1A1C1E]">Decide daily priorities</td>
                  <td className="border-b border-[#ECEFF4] bg-[#f9fbfd] px-4 py-2.5 text-[#44474E]">Ad-hoc to-do list ordering</td>
                  <td className="border-b border-[#ECEFF4] bg-[#f1f6fa] px-4 py-2.5 font-semibold text-[#1A1C1E]">Priority-aware plan with deadlines and effort bands</td>
                </tr>
                <tr>
                  <td className="border-b border-[#ECEFF4] px-4 py-2.5 font-medium text-[#1A1C1E]">Calendar execution</td>
                  <td className="border-b border-[#ECEFF4] bg-[#f9fbfd] px-4 py-2.5 text-[#44474E]">Manual event creation and edits</td>
                  <td className="border-b border-[#ECEFF4] bg-[#f1f6fa] px-4 py-2.5 font-semibold text-[#1A1C1E]">
                    <span className="inline-flex items-center gap-2">
                      Approval-first write to Google Calendar
                      <DisclosureTrigger
                        tier="icon"
                        label="Action lifecycle details"
                        onClick={() =>
                          setModal({
                            title: 'Calendar action lifecycle',
                            content:
                              'Every calendar write follows proposed → approved → executed states. Proposed actions remain editable, approval gates provider writes, and execution/failure is logged as immutable action history for auditability.'
                          })
                        }
                      />
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="border-b border-[#ECEFF4] px-4 py-2.5 font-medium text-[#1A1C1E]">Handle schedule changes</td>
                  <td className="border-b border-[#ECEFF4] bg-[#f9fbfd] px-4 py-2.5 text-[#44474E]">Rebuild plan manually</td>
                  <td className="border-b border-[#ECEFF4] bg-[#f1f6fa] px-4 py-2.5 font-semibold text-[#1A1C1E]">Fast re-optimization with conflict explanations</td>
                </tr>
                <tr>
                  <td className="border-b border-[#ECEFF4] px-4 py-2.5 font-medium text-[#1A1C1E]">Progress feedback loop</td>
                  <td className="border-b border-[#ECEFF4] bg-[#f9fbfd] px-4 py-2.5 text-[#44474E]">No unified learning loop</td>
                  <td className="border-b border-[#ECEFF4] bg-[#f1f6fa] px-4 py-2.5 font-semibold text-[#1A1C1E]">Adaptive estimates from completion history</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-[11px] text-[#74777F]">
            Technical architecture, algorithm catalog, and measured benchmarks follow below.
          </p>
        </div>
      </section>
      <DisclosureModal open={Boolean(modal)} title={modal?.title} content={modal?.content} onClose={() => setModal(null)} />
    </>
  )
}

export function LandingArchitectureSection() {
  const [modal, setModal] = useState(null)
  return (
    <>
      <SectionDivider />
      <section id="architecture" className="px-8 py-28 md:px-16">
        <div className="mx-auto max-w-7xl" data-reveal>
          <SectionKicker>ARCHITECTURE</SectionKicker>
          <h2 className="font-headline text-[clamp(28px,3.2vw,44px)] font-bold tracking-[-0.03em]">
            Your Academic Structure
            <span className="ml-2 align-middle">
              <DisclosureTrigger
                tier="icon"
                label="Architecture rationale"
                onClick={() =>
                  setModal({
                    title: 'Why the three-plane architecture',
                    content:
                      'Control plane handles identity, routing, and approvals. Algorithm plane runs deterministic optimization and inference workloads isolated from user-session concerns. Data plane stores telemetry/state and provider sync. Separation keeps policy logic stable while allowing independent scaling and observability.'
                  })
                }
              />
            </span>
          </h2>

          <div className="mt-8 overflow-hidden rounded-2xl p-1">
            <img
              src="/images/mascot/system-dig.png"
              alt="Donna v2 system architecture diagram"
              className="h-auto w-full rounded-xl"
              loading="lazy"
            />
          </div>

          <div className="mt-7 grid gap-4 text-[14px] text-[#44474E] md:grid-cols-3">
            <p>Control plane (Node/Express): auth, sessions, Google OAuth, action approval, routing decisions</p>
            <p>Algorithm plane (Python/FastAPI): CP-SAT solver, Bayesian inference, survival fits, bandit posteriors, HAR forecasts</p>
            <p>Data plane (Postgres + TimescaleDB): closed-loop telemetry feeds estimator, bandit, factorization</p>
          </div>
        </div>
      </section>
      <DisclosureModal open={Boolean(modal)} title={modal?.title} content={modal?.content} onClose={() => setModal(null)} />
    </>
  )
}

export function LandingAlgorithmsSection() {
  const [modal, setModal] = useState(null)
  return (
    <>
      <SectionDivider />
      <section id="algorithms" className="px-8 py-28 md:px-16">
        <div className="mx-auto max-w-7xl" data-reveal>
          <SectionKicker>ALGORITHM CATALOG</SectionKicker>
          <h2 className="font-headline text-[clamp(28px,3.2vw,44px)] font-bold tracking-[-0.03em]">
            8 Proprietary Algorithms wired together
          </h2>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            {ALGORITHM_CARDS.map((card) => (
              <article key={card.id} className="rounded-2xl border border-[#C4C7CF]/80 bg-white p-5 shadow-[0_24px_40px_-34px_rgba(0,0,0,0.35)]">
                <div className="text-[11px] font-semibold tracking-[0.2em] text-[#74777F]">{card.id}</div>
                <h3 className="mt-2 text-[20px] font-semibold leading-tight text-[#1A1C1E]">{card.title}</h3>
                <p className="mt-2.5 text-[14px] leading-relaxed text-[#1A1C1E]">{card.description}</p>
                <p className="mt-2 font-mono text-[13px] text-[#1A1C1E]">{card.hook}</p>
                <p className="mt-2 text-[13px] text-[#44474E]">{card.line}</p>
                <div className="mt-3">
                  <DisclosureTrigger tier="text" label="See full formulation →" onClick={() => setModal(card.depth)} />
                </div>
              </article>
            ))}
          </div>

          <p className="mt-3 text-[11px] text-[#74777F]">
            Three additional Groq LLM roles handle intent parsing, syllabus extraction, and schedule explanation. They never
            make scheduling decisions.
          </p>
        </div>
      </section>
      <DisclosureModal open={Boolean(modal)} title={modal?.title} content={modal?.content} onClose={() => setModal(null)} />
    </>
  )
}

export function LandingMathSection() {
  const [modal, setModal] = useState(null)
  return (
    <>
      <SectionDivider />
      <section id="math" className="bg-white px-8 py-28 md:px-16">
        <div className="mx-auto max-w-7xl" data-reveal>
          <SectionKicker>FORMULATIONS</SectionKicker>
          <h2 className="font-headline text-[clamp(28px,3.2vw,44px)] font-bold tracking-[-0.03em]">The Math.</h2>

          <div className="mt-8 grid auto-rows-fr gap-5 lg:grid-cols-3">
            <div className="rounded-2xl border border-[#C4C7CF] bg-[#f6f8fb] p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#74777F]">SCHEDULING</p>
              <pre className="h-[290px] overflow-x-auto text-[10px] leading-[1.5] text-[#1A1C1E]">
{`min   Σ w1·energy_mismatch[t,h]·x[i,s]
    + Σ w2·switch[s]
    + Σ w3·overflow[i]^2
    + Σ w4·urgency[i]·(1-y[i])

s.t.  Σ_s x[i,s]·dur[s] ≥ P75[i] - overflow[i]   ∀i
      Σ_i x[i,s] ≤ 1                              ∀s
      x[i,s] = 0  if s ∈ blocked                  ∀i,s
      x[i,s] = 0  if start[s] > deadline[i]       ∀i,s
      x, y ∈ {0,1}, overflow ≥ 0`}
              </pre>
              <DisclosureTrigger
                tier="text"
                label="See variable definitions & derivation →"
                onClick={() =>
                  setModal({
                    title: 'Scheduling variables and derivation',
                    content:
                      'x[i,s] is binary assignment of task i to slot s; overflow[i] captures unmet required duration; switch[s] penalizes fragmentation; urgency weights penalize unmet critical tasks. Derivation maps soft-preference tradeoffs into a weighted objective under hard feasibility constraints.'
                  })
                }
              />
            </div>

            <div className="rounded-2xl border border-[#C4C7CF] bg-[#f6f8fb] p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#74777F]">ESTIMATION</p>
              <pre className="h-[290px] overflow-x-auto text-[10px] leading-[1.5] text-[#1A1C1E]">
{`log(hours_i) ~ Normal(μ_u + α_t + β_c + γᵀx, σ²)

Priors:  α_u ~ N(0, τ_u²),  β_t ~ N(0, τ_t²)
Hyperpriors:  τ² ~ InverseGamma(a, b)

Posterior via Gibbs:
  μ_u | rest ~ N(weighted_mean, weighted_var)
  τ_u² | rest ~ InverseGamma(a + n/2, b + SS/2)`}
              </pre>
              <DisclosureTrigger
                tier="text"
                label="See variable definitions & derivation →"
                onClick={() =>
                  setModal({
                    title: 'Estimator variable definitions',
                    content:
                      'μ_u is user baseline, α_t task effect, β_c class/course effect, γ feature weights, and σ² residual variance. Hyperpriors regularize sparse users and cold starts. Gibbs alternates conditional updates until convergence and yields posterior quantile estimates.'
                  })
                }
              />
            </div>

            <div className="rounded-2xl border border-[#C4C7CF] bg-[#f6f8fb] p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#74777F]">NOTIFICATION TIMING</p>
              <pre className="h-[290px] overflow-x-auto text-[10px] leading-[1.5] text-[#1A1C1E]">
{`For arm a = (hour, day, urgency):
  Prior:    θ_a ~ Beta(α_a⁰, β_a⁰)
  Sample:   θ̃_a ~ Beta(α_a, β_a)
  Pull:     a* = argmax_a θ̃_a
  Reward:   r ∈ {0, 1}  (acted within 30min)
  Update:   α_a ← α_a + r,  β_a ← β_a + (1 - r)

Regret bound: R(T) = O(√(K·T·log T))`}
              </pre>
              <DisclosureTrigger
                tier="text"
                label="See variable definitions & derivation →"
                onClick={() =>
                  setModal({
                    title: 'Bandit definitions and update flow',
                    content:
                      'Each arm corresponds to a notification context. α/β track success and failure counts under Beta-Bernoulli assumptions. Sampling from each posterior estimates expected response; updates incorporate acted-within-30-min reward signals to continuously improve policy timing.'
                  })
                }
              />
            </div>
          </div>
        </div>
      </section>
      <DisclosureModal open={Boolean(modal)} title={modal?.title} content={modal?.content} onClose={() => setModal(null)} />
    </>
  )
}

export function LandingBenchmarksSection() {
  const [modal, setModal] = useState(null)
  return (
    <>
      <SectionDivider />
      <section id="benchmarks" className="px-8 py-28 md:px-16">
        <div className="mx-auto max-w-7xl" data-reveal>
          <SectionKicker>MEASURED PERFORMANCE</SectionKicker>
          <h2 className="font-headline text-[clamp(28px,3.2vw,44px)] font-bold tracking-[-0.03em]">Donna vs LLM: Efficiency gains</h2>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <ChartCard title="p50 latency (ms)" caption="n = task count">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9dfe6" />
                  <XAxis dataKey="n" tick={{ fontSize: 11, fill: '#44474E' }} label={{ value: 'task count', position: 'insideBottom', offset: -6, fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11, fill: '#44474E' }} label={{ value: 'ms', angle: -90, position: 'insideLeft', fontSize: 11 }} domain={[440, 600]} />
                  <Tooltip formatter={(value) => [`${value} ms`, 'p50']} />
                  <Line type="monotone" dataKey="latency" stroke="#1A1C1E" strokeWidth={2.2} dot={{ r: 3, fill: '#1A1C1E' }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Tokens per planning turn" caption="Measured via scripts/benchmark-tokens.py, 30 seeds × 4 task sizes">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tokenData} layout="vertical" margin={{ top: 8, right: 28, left: 18, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9dfe6" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#44474E' }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: '#44474E' }} />
                  <Tooltip formatter={(value) => [`${value}`, 'tokens']} />
                  <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                    <LabelList dataKey="value" position="right" style={{ fill: '#1A1C1E', fontSize: 11 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <article className="rounded-2xl border border-[#C4C7CF] bg-white p-4">
              <h3 className="text-[15px] font-semibold text-[#1A1C1E]">Cost per 1k turns</h3>
              <div className="mt-3 text-[40px] font-bold tracking-[-0.03em] text-[#1A1C1E]">$0.0052</div>
              <p className="mt-1 text-[13px] text-[#44474E]">vs $0.85 baseline</p>
              <div className="mt-2 h-[130px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={costData} layout="vertical" margin={{ top: 8, right: 28, left: 18, bottom: 8 }}>
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#44474E' }} domain={[0, 0.9]} />
                    <YAxis type="category" dataKey="name" width={70} tick={{ fontSize: 10, fill: '#44474E' }} />
                    <Tooltip formatter={(value) => [`$${value}`, 'cost']} />
                    <Bar dataKey="value" radius={[4, 4, 4, 4]}>
                      <LabelList dataKey="value" position="right" formatter={(v) => `$${v}`} style={{ fill: '#1A1C1E', fontSize: 10 }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-[14px] font-semibold text-[#1A1C1E]">163× cheaper</p>
              <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-[#74777F]">
                Measured via scripts/benchmark-tokens.py, 30 seeds × 4 task sizes
              </p>
            </article>
          </div>

          <p className="mt-4 text-[11px] text-[#74777F]">
            Benchmark harness: 30 seeds × 4 task sizes, executed on a single-node Docker stack. Reproducible via
            scripts/benchmark-tokens.py.
          </p>
          <div className="mt-2">
            <DisclosureTrigger
              tier="text"
              label="See benchmark methodology →"
              onClick={() =>
                setModal({
                  title: 'Benchmark methodology',
                  content:
                    'Runs use 30 random seeds across task counts n={25,50,100,150} on a single-node Docker stack. Reported figures include latency p50 and comparative token/cost totals per turn. Measurements are reproducible via scripts/benchmark-tokens.py with fixed scenario generation and unified logging pipeline.'
                })
              }
            />
          </div>
        </div>
      </section>
      <DisclosureModal open={Boolean(modal)} title={modal?.title} content={modal?.content} onClose={() => setModal(null)} />
    </>
  )
}

export function LandingDemoPathSection() {
  return (
    <>
      <SectionDivider />
      <section id="demo-path" className="bg-white px-8 py-28 md:px-16">
        <div className="mx-auto max-w-7xl" data-reveal>
          <SectionKicker>END-TO-END</SectionKicker>
          <h2 className="font-headline text-[clamp(28px,3.2vw,44px)] font-bold tracking-[-0.03em]">One request, end to end.</h2>

          <div className="mt-8 grid gap-4 lg:grid-cols-5">
            {DEMO_STEPS.map((item, index) => (
              <article key={item.step} className="rounded-xl border border-[#C4C7CF] bg-[#FDFDFD] p-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#74777F]">Step {index + 1}</div>
                <h3 className="mt-2 text-[16px] font-semibold leading-tight text-[#1A1C1E]">{item.step}</h3>
                <p className="mt-2 text-[13px] font-medium text-[#1A1C1E]">{item.algo}</p>
                <p className="mt-2 text-[13px] text-[#44474E]">{item.detail}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}

export function LandingFinalCtaSection() {
  return (
    <>
      <SectionDivider />
      <section id="cta" className="landing-page__final relative overflow-hidden px-8 py-24 text-center text-white md:px-16" data-reveal>
        <div className="mx-auto max-w-4xl">
          <SectionKicker>OPEN</SectionKicker>
          <h2 className="font-headline text-[clamp(28px,3.2vw,44px)] font-bold tracking-[-0.03em]">
            Enjoy college life while Donna handles your academic planning.
          </h2>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link to={LANDING_ROUTES.app} className="landing-page__btn-primary">
              LIVE APP
            </Link>
            <a href={LANDING_ROUTES.github} className="landing-page__btn-ghost landing-page__btn-ghost--dark" target="_blank" rel="noreferrer">
              GITHUB
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
