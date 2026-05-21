const { useState, useEffect, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "day",
  "hue": "default",
  "headline": "editorial",
  "showFloats": true
}/*EDITMODE-END*/;

// ---------- Icon helpers ----------
const Arrow = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Play = ({ size = 12 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M7 5l12 7-12 7V5z" /></svg>
);
const Check = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const X = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
  </svg>
);
const Dot = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="4" /></svg>
);

// ---------- Nav ----------
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="container nav-row">
        <a href="#" className="brand">
          <span className="brand-mark"></span>
          <span>Donna</span>
        </a>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#preview">Product</a>
          <a href="#trust">Trust</a>
        </div>
        <div className="nav-cta">
          <a href="#" className="nav-signin">Sign in</a>
          <a href="#cta" className="btn btn-primary">Start with Donna <Arrow /></a>
        </div>
      </div>
    </nav>
  );
}

// ---------- Hero ----------
function Hero({ tweaks }) {
  const headlines = {
    editorial: <>Your academic <em>chief of staff.</em></>,
    direct: <>Plan today. <em>Execute it.</em></>,
    intent: <>Less juggling. <em>More finished work.</em></>,
  };
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div data-reveal>
          <div className="eyebrow">
            <span className="dot"></span>
            <span>Approval-first AI for student workflows</span>
          </div>
          <h1>{headlines[tweaks.headline] || headlines.editorial}</h1>
          <p className="hero-sub">
            Donna reads your calendar and coursework, then drafts your day. You approve. She schedules.
          </p>
          <div className="hero-ctas">
            <a href="#cta" className="btn btn-primary">
              Start with Donna
              <span className="btn-arrow"><Arrow size={12} /></span>
            </a>
            <a href="#preview" className="btn btn-ghost">
              <Play /> See a planned day
            </a>
          </div>
          <div className="hero-meta">
            <span><Dot /> Google & Apple Calendar</span>
            <span><Dot /> Free for students</span>
          </div>
        </div>

        <div style={{ position: 'relative' }} data-reveal>
          {tweaks.showFloats && (
            <>
              <div className="float-card float-1">
                <div className="k">Today · focused time</div>
                <div className="v">3h 40m</div>
              </div>
              <div className="float-card float-2">
                <div className="k">Goal · CHEM 142 final</div>
                <div className="v">62% ready</div>
              </div>
            </>
          )}
          <HeroProduct />
        </div>
      </div>
    </section>
  );
}

function HeroProduct() {
  return (
    <div className="product">
      <div className="product-bar">
        <span className="dot" style={{ background: '#e08a7a' }}></span>
        <span className="dot" style={{ background: '#e0b87a' }}></span>
        <span className="dot" style={{ background: '#a3c89c' }}></span>
        <span className="title">donna · today, tuesday april 28</span>
      </div>
      <div className="product-body">
        <div className="donna-row">
          <div className="donna-avatar">D</div>
          <div className="donna-bubble">
            Three deadlines this week. I'd protect <b>2 hours for CHEM 142</b> before your seminar. Schedule it?
          </div>
        </div>
        <div className="blocks">
          <div className="block deep">
            <span className="time">10:30 — 12:30</span>
            <span className="label">CHEM 142 · problem set 7<small>Suttle Library</small></span>
            <span className="tag">deep work</span>
          </div>
          <div className="block">
            <span className="time">14:00 — 14:45</span>
            <span className="label">PHIL 220 readings<small>18 pages</small></span>
            <span className="tag">review</span>
          </div>
          <div className="block">
            <span className="time">19:30 — 20:15</span>
            <span className="label">Orgo flashcards<small>40 cards</small></span>
            <span className="tag">light</span>
          </div>
        </div>
        <div className="approve-row">
          <span className="pulse"><span className="d"></span>3 blocks awaiting approval</span>
          <span className="approve-actions">
            <button className="mini-btn">Edit</button>
            <button className="mini-btn primary">Approve all</button>
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------- Problem to Solution ----------
function ProblemSolution() {
  return (
    <section className="ps" data-reveal>
      <div className="container">
        <div className="kicker">The honest version</div>
        <h2 className="serif" style={{ fontSize: 'clamp(36px, 5vw, 56px)', lineHeight: 1.05, maxWidth: '20ch', letterSpacing: '-0.03em', fontWeight: 800 }}>
          Small decisions, made <em>tired</em>, in the dark.
        </h2>
        <div className="ps-grid">
          <div className="ps-col">
            <h3>Without Donna</h3>
            <ul>
              <li>
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>
                <div><b>Six tabs, one Notes file.</b><span>Assignments, calendar, and priorities live in different places.</span></div>
              </li>
              <li>
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>
                <div><b>Plans built at 1 AM.</b><span>You guess what tomorrow looks like, then re-guess at 8.</span></div>
              </li>
              <li>
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /></svg>
                <div><b>To-do lists that grow.</b><span>Tasks roll forward all week. Nothing gets blocked off.</span></div>
              </li>
            </ul>
          </div>
          <div className="ps-col solution">
            <h3>With <em>Donna</em></h3>
            <ul>
              <li>
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <div><b>One command center.</b><span>Assignments, calendar, priorities — ready by morning.</span></div>
              </li>
              <li>
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <div><b>A plan, drafted before you wake up.</b><span>Today's blocks, shaped around your real schedule.</span></div>
              </li>
              <li>
                <svg className="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5 9-11" strokeLinecap="round" strokeLinejoin="round" /></svg>
                <div><b>Focused blocks, not lists.</b><span>Approved sessions become real calendar events.</span></div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Features ----------
function Features() {
  return (
    <section id="features" className="section-pad">
      <div className="container">
        <div className="section-head" data-reveal>
          <div>
            <div className="kicker">Capabilities</div>
            <h2 className="h2 serif">Built for <em>execution.</em></h2>
          </div>
          <p className="section-blurb">
            What Donna does, every day, so you don't have to think about it.
          </p>
        </div>

        <div className="features">
          <div className="feat feat-1" data-reveal>
            <span className="feat-num">01</span>
            <h3>A planned day, before you open your laptop.</h3>
            <p>Priorities reordered around your fixed events. Focus windows protected.</p>
            <div className="feat-art">
              <div className="mini-cal">
                <div className="h"></div>
                <div className="h">M</div><div className="h">T</div><div className="h">W</div><div className="h">T</div><div className="h">F</div>
                <div className="row-time">9</div>
                <div className="cell class merge2"></div>
                <div className="cell donna"></div>
                <div className="cell"></div>
                <div className="cell class"></div>
                <div className="cell donna"></div>
                <div className="row-time">10</div>
                <div className="cell donna merge2"></div>
                <div className="cell donna merge3"></div>
                <div className="cell"></div>
                <div className="cell donna"></div>
                <div className="row-time">11</div>
                <div className="cell"></div>
                <div className="cell"></div>
                <div className="cell class merge2"></div>
                <div className="row-time">12</div>
                <div className="cell"></div>
                <div className="cell"></div>
                <div className="cell"></div>
                <div className="cell"></div>
                <div className="cell"></div>
              </div>
            </div>
          </div>

          <div className="feat feat-2" data-reveal>
            <span className="feat-num">02</span>
            <h3>Approval-first.</h3>
            <p>Nothing on your calendar until you say yes.</p>
            <div className="feat-art">
              <div className="approve-mini">
                <div className="req"><span className="d"></span> Add 2h CHEM block · Wed 10:00</div>
                <div className="actions">
                  <button className="no">Edit</button>
                  <button className="ok">Approve</button>
                </div>
              </div>
            </div>
          </div>

          <div className="feat feat-3" data-reveal>
            <span className="feat-num">03</span>
            <h3>Goals you actually move.</h3>
            <p>Track finals, theses, and applications by sessions logged.</p>
            <div className="feat-art">
              <div className="goals">
                <div className="goal-row">
                  <div className="top"><b>CHEM 142 · final exam</b><span className="pct">62%</span></div>
                  <div className="goal-bar"><div className="fill accent" style={{ width: '62%' }}></div></div>
                </div>
                <div className="goal-row">
                  <div className="top"><b>Honors thesis · ch. 2</b><span className="pct">38%</span></div>
                  <div className="goal-bar"><div className="fill" style={{ width: '38%' }}></div></div>
                </div>
                <div className="goal-row">
                  <div className="top"><b>Med school apps</b><span className="pct">21%</span></div>
                  <div className="goal-bar"><div className="fill" style={{ width: '21%' }}></div></div>
                </div>
              </div>
            </div>
          </div>

          <div className="feat feat-4" data-reveal>
            <span className="feat-num">04</span>
            <h3>A receipt for every action.</h3>
            <p>Every proposal, approval, and write — logged and reversible.</p>
            <div className="feat-art">
              <div className="hist">
                <div className="hist-row"><span className="t">8:02</span><span>Block · PHIL 220 reading</span><span className="s ok">executed</span></div>
                <div className="hist-row"><span className="t">8:01</span><span>Block · CHEM 142 deep work</span><span className="s ok">executed</span></div>
                <div className="hist-row"><span className="t">7:58</span><span>Plan · Tuesday Apr 28</span><span className="s app">approved</span></div>
                <div className="hist-row"><span className="t">7:55</span><span>Proposal · 3 blocks</span><span className="s">drafted</span></div>
              </div>
            </div>
          </div>

          <div className="feat feat-5" data-reveal>
            <span className="feat-num">05</span>
            <h3>Quiet, useful nudges.</h3>
            <p>One sentence, only when something needs your attention.</p>
            <div className="feat-art">
              <div className="nudge">
                <div className="from">Donna · 2:14 pm</div>
                <div>Seminar shifted by 30m. I moved your CHEM block to 4pm and kept the gym slot intact. Approve?</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- How it works ----------
function HowItWorks() {
  return (
    <section id="how" className="section-pad" style={{ paddingTop: 0 }}>
      <div className="container">
        <div className="section-head" data-reveal>
          <div>
            <div className="kicker">How it works</div>
            <h2 className="h2 serif">Three steps. <em>One approval</em> away.</h2>
          </div>
        </div>
        <div className="steps" data-reveal>
          <div className="step">
            <div className="step-num">i.</div>
            <h3>Connect.</h3>
            <p>Link your calendar and class schedule.</p>
          </div>
          <div className="step" style={{ paddingLeft: 32 }}>
            <div className="step-num">ii.</div>
            <h3>Propose.</h3>
            <p>Donna drafts your day around your real schedule.</p>
          </div>
          <div className="step" style={{ paddingLeft: 32 }}>
            <div className="step-num">iii.</div>
            <h3>Approve.</h3>
            <p>Approved blocks become real events. Reversible, always.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Product preview ----------
function PreviewSection() {
  const [tab, setTab] = useState('today');
  const [items, setItems] = useState([
    { id: 1, when: '08:00', what: 'Morning review', sub: 'CHEM 142 · 20 cards', kind: 'donna', tag: 'review', done: true },
    { id: 2, when: '09:30', what: 'Linguistics 101', sub: 'Hagey Hall, Rm 218', kind: 'class', tag: 'class' },
    { id: 3, when: '10:30', what: 'CHEM 142 · problem set 7', sub: '2h focus · Suttle Library', kind: 'donna', tag: 'deep' },
    { id: 4, when: '13:00', what: 'Lunch + walk', sub: 'Donna paused alerts', kind: 'class', tag: 'rest' },
    { id: 5, when: '14:00', what: 'PHIL 220 readings', sub: 'Skim · 18 pages', kind: 'donna', tag: 'review' },
    { id: 6, when: '15:00', what: 'Seminar · ENG 305', sub: 'Hawking Building', kind: 'class', tag: 'class' },
    { id: 7, when: '19:30', what: 'Orgo flashcards', sub: '40 cards · spaced recall', kind: 'donna', tag: 'light' },
  ]);
  const [proposalState, setProposalState] = useState('open'); // open | accepted | rejected

  return (
    <section id="preview" className="preview">
      <div className="container">
        <div className="section-head" data-reveal>
          <div>
            <div className="kicker">Product</div>
            <h2 className="h2 serif">A workspace built around <em>doing</em> the work.</h2>
          </div>
          <p className="section-blurb">
            What's due, what's next, and what Donna recommends — in one place.
          </p>
        </div>

        <div className="preview-frame" data-reveal>
          <div className="pf-bar">
            <div className="dots"><span></span><span></span><span></span></div>
            <div className="pf-tabs">
              <button className={`pf-tab ${tab === 'today' ? 'active' : ''}`} onClick={() => setTab('today')}>Today</button>
              <button className={`pf-tab ${tab === 'week' ? 'active' : ''}`} onClick={() => setTab('week')}>Week</button>
              <button className={`pf-tab ${tab === 'goals' ? 'active' : ''}`} onClick={() => setTab('goals')}>Goals</button>
              <button className={`pf-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
            </div>
            <div style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 11 }}>donna.app · personal</div>
          </div>

          <div className="pf-body">
            <aside className="pf-side">
              <div className="label">Workspace</div>
              <div className="item active"><span className="b">◐</span> Today<span className="count">7</span></div>
              <div className="item"><span className="b">▤</span> Week<span className="count">23</span></div>
              <div className="item"><span className="b">◇</span> Goals<span className="count">5</span></div>
              <div className="item"><span className="b">↻</span> History</div>

              <div className="label">Courses</div>
              <div className="item"><span className="b">·</span> CHEM 142<span className="count">3</span></div>
              <div className="item"><span className="b">·</span> PHIL 220<span className="count">2</span></div>
              <div className="item"><span className="b">·</span> ENG 305<span className="count">1</span></div>
              <div className="item"><span className="b">·</span> LIN 101<span className="count">1</span></div>

              <div className="label">Connected</div>
              <div className="item"><span className="b">G</span> Google Calendar</div>
              <div className="item"><span className="b">@</span> Canvas</div>
            </aside>

            <main className="pf-main">
              {tab === 'today' && (
                <>
                  <h4>Tuesday, April 28</h4>
                  <div className="sub">7 events · 3h 40m of focused time · 2 deadlines this week</div>
                  <div className="day-list">
                    {items.map(it => (
                      <div
                        key={it.id}
                        className={`day-item ${it.kind} ${it.done ? 'done' : ''}`}
                        onClick={() => setItems(prev => prev.map(p => p.id === it.id ? { ...p, done: p.kind === 'donna' ? !p.done : p.done } : p))}
                      >
                        <span className="when">{it.when}</span>
                        <span className="what">{it.what}<small>{it.sub}</small></span>
                        <span className="badge">{it.tag}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === 'week' && (
                <>
                  <h4>This week</h4>
                  <div className="sub">Apr 28 — May 4 · 2 deadlines, 14 sessions planned</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 8, marginTop: 16 }}>
                    {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d, i) => (
                      <div key={d} style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 10, padding: 12, minHeight: 220, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-3)' }}>{d}<br/>{28 + i > 30 ? `May ${28 + i - 30}` : `Apr ${28 + i}`}</div>
                        {i === 1 && <><div style={{ fontSize: 11, padding: '4px 6px', background: 'var(--accent-soft)', borderLeft: '2px solid var(--accent)', borderRadius: 4 }}>CHEM ps7 · 2h</div><div style={{ fontSize: 11, padding: '4px 6px', background: 'var(--bg-deep)', borderRadius: 4 }}>Seminar</div></>}
                        {i === 2 && <><div style={{ fontSize: 11, padding: '4px 6px', background: 'var(--accent-soft)', borderLeft: '2px solid var(--accent)', borderRadius: 4 }}>Thesis ch.2 · 90m</div></>}
                        {i === 3 && <><div style={{ fontSize: 11, padding: '4px 6px', background: 'var(--bg-deep)', borderRadius: 4 }}>PHIL due</div><div style={{ fontSize: 11, padding: '4px 6px', background: 'var(--accent-soft)', borderLeft: '2px solid var(--accent)', borderRadius: 4 }}>Orgo · 45m</div></>}
                        {i === 4 && <><div style={{ fontSize: 11, padding: '4px 6px', background: 'var(--accent-soft)', borderLeft: '2px solid var(--accent)', borderRadius: 4 }}>CHEM review</div></>}
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === 'goals' && (
                <>
                  <h4>Goals</h4>
                  <div className="sub">5 active aspirations · sessions logged this week: 12</div>
                  <div className="goals" style={{ marginTop: 20, gap: 18 }}>
                    {[
                      ['CHEM 142 final exam', 62, 'Apr 30 · 4 days', true],
                      ['Honors thesis · chapter 2', 38, 'May 12 · 16 days', true],
                      ['Med school applications', 21, 'Jun 1 · 36 days', false],
                      ['PHIL 220 final paper', 55, 'May 6 · 10 days', true],
                      ['LIN 101 vocab fluency', 73, 'ongoing', false],
                    ].map(([n, p, d, accent]) => (
                      <div key={n} className="goal-row" style={{ fontSize: 13, gap: 8 }}>
                        <div className="top" style={{ fontSize: 13 }}><b>{n}</b><span className="pct">{p}% · {d}</span></div>
                        <div className="goal-bar" style={{ height: 6 }}><div className={`fill ${accent ? 'accent' : ''}`} style={{ width: `${p}%` }}></div></div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === 'history' && (
                <>
                  <h4>Action history</h4>
                  <div className="sub">Last 24 hours · everything Donna did, considered, or proposed</div>
                  <div className="hist" style={{ marginTop: 20, fontSize: 12 }}>
                    {[
                      ['08:02', 'Created event · PHIL 220 reading', 'executed', 'ok'],
                      ['08:01', 'Created event · CHEM 142 deep work', 'executed', 'ok'],
                      ['07:58', 'Plan approved · Tuesday Apr 28', 'approved', 'app'],
                      ['07:55', 'Proposal · 3 study blocks drafted', 'drafted', ''],
                      ['07:54', 'Read calendar · 4 fixed events', 'read', ''],
                      ['07:54', 'Read assignments · 6 upcoming', 'read', ''],
                      ['Yesterday', 'Reverted · evening orgo block', 'undone', ''],
                      ['Yesterday', 'Plan approved · Monday Apr 27', 'approved', 'app'],
                    ].map(([t, label, s, cls], i) => (
                      <div key={i} className="hist-row" style={{ padding: '8px 12px' }}>
                        <span className="t">{t}</span><span>{label}</span><span className={`s ${cls}`}>{s}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </main>

            <aside className="pf-right">
              <div className="donna-head">
                <div className="av">D</div>
                <div className="who">Donna<small>online · learning your week</small></div>
              </div>

              <div className="pf-msg">
                <div className="from">Morning brief</div>
                Two big rocks today: CHEM problem set and the PHIL reading. Your seminar at 3 means your real deep-work window is the morning. I built around that.
              </div>

              <div className="pf-prop">
                {proposalState === 'open' && <>
                  <span className="tag">proposal · awaiting approval</span>
                  <div><b>Add a 45m orgo review tonight</b></div>
                  <div className="when">Tue · 19:30 — 20:15 · slots between dinner and your usual wind-down</div>
                  <div className="acts">
                    <button className="n" onClick={() => setProposalState('rejected')}>Not today</button>
                    <button className="y" onClick={() => setProposalState('accepted')}>Approve</button>
                  </div>
                </>}
                {proposalState === 'accepted' && <>
                  <span className="tag" style={{ background: 'color-mix(in oklab, var(--good) 18%, transparent)', color: 'var(--good)' }}>scheduled</span>
                  <div><b>Orgo review on the calendar</b></div>
                  <div className="when">Tue · 19:30 — 20:15 · added to Google Calendar · reversible from history</div>
                  <div className="acts">
                    <button className="n" onClick={() => setProposalState('open')}>Undo</button>
                  </div>
                </>}
                {proposalState === 'rejected' && <>
                  <span className="tag" style={{ background: 'var(--bg-deep)', color: 'var(--ink-3)' }}>declined</span>
                  <div><b>Held off — noted for tomorrow</b></div>
                  <div className="when">I'll re-propose during your morning brief if it still fits.</div>
                  <div className="acts">
                    <button className="n" onClick={() => setProposalState('open')}>Reopen</button>
                  </div>
                </>}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </section>
  );
}

// ---------- Trust ----------
function Trust() {
  const items = [
    ['No.', 'Approval-first, always', 'Donna proposes. You approve. Nothing happens otherwise.'],
    ['No.', 'Every action is logged', 'A complete trail of proposals, approvals, and events. Reverse anything.'],
    ['No.', 'Edit before commit', 'Move it, shorten it, rewrite it before it is a real event.'],
    ['No.', 'Your data, your scope', 'Donna reads only what you connect, only what is relevant.'],
    ['No.', 'Pause anywhere', 'One toggle disables proposals. Your existing calendar is untouched.'],
    ['No.', 'No fake urgency', 'No gamified deadlines. Just concise, actionable nudges.'],
  ];
  return (
    <section id="trust" className="section-pad">
      <div className="container">
        <div className="section-head" data-reveal>
          <div>
            <div className="kicker">Trust & control</div>
            <h2 className="h2 serif">An agent that asks <em>before</em> it acts.</h2>
          </div>
          <p className="section-blurb">
            One rule: nothing on your calendar without your approval.
          </p>
        </div>
        <div className="trust-grid" data-reveal>
          {items.map((it, i) => (
            <div className="trust-item" key={i}>
              <div className="trust-num">{it[0]} {String(i + 1).padStart(2, '0')}</div>
              <h3>{it[1]}</h3>
              <p>{it[2]}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Final CTA ----------
function FinalCTA() {
  return (
    <section id="cta" className="final" data-reveal>
      <div className="kicker" style={{ color: '#faf8f399', justifyContent: 'center', display: 'flex' }}>
        <span style={{ background: '#faf8f366' }}></span> Free for students
      </div>
      <h2 className="h2 serif" style={{ marginTop: 24 }}>
        Stop planning at midnight. <em>Start tomorrow finished.</em>
      </h2>
      <p>Connect your calendar in under a minute. Donna drafts your first plan tonight.</p>
      <div className="ctas">
        <a href="#" className="btn btn-primary">Start with Donna <Arrow size={12} /></a>
        <a href="#preview" className="btn btn-ghost"><Play /> See a planned day</a>
      </div>
    </section>
  );
}

// ---------- Footer ----------
function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="foot-row">
          <div className="foot-col">
            <a href="#" className="brand">
              <span className="brand-mark"></span>
              <span>Donna</span>
            </a>
            <p className="foot-tag">An academic planning agent for students.</p>
          </div>
          <div className="foot-col">
            <h5>Product</h5>
            <ul>
              <li><a href="#features">Features</a></li>
              <li><a href="#preview">Product tour</a></li>
              <li><a href="#how">How it works</a></li>
              <li><a href="#">Changelog</a></li>
            </ul>
          </div>
          <div className="foot-col">
            <h5>For students</h5>
            <ul>
              <li><a href="#">Free plan</a></li>
              <li><a href="#">Calendar setup</a></li>
              <li><a href="#">Canvas integration</a></li>
              <li><a href="#">Campus ambassadors</a></li>
            </ul>
          </div>
          <div className="foot-col">
            <h5>Company</h5>
            <ul>
              <li><a href="#trust">Trust & control</a></li>
              <li><a href="#">Privacy</a></li>
              <li><a href="#">Terms</a></li>
              <li><a href="#">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2026 Donna labs</span>
          <span>Made for the semester, not the sprint.</span>
        </div>
      </div>
    </footer>
  );
}

// ---------- Tweaks ----------
function Tweaks({ tweaks, setTweak }) {
  const { TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakSelect } = window;
  if (!TweaksPanel) return null;
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection title="Theme">
        <TweakRadio
          label="Mode"
          value={tweaks.theme}
          onChange={(v) => setTweak('theme', v)}
          options={[{ label: 'Day', value: 'day' }, { label: 'Night', value: 'night' }]}
        />
        <TweakSelect
          label="Accent hue"
          value={tweaks.hue}
          onChange={(v) => setTweak('hue', v)}
          options={[
            { label: 'Default — blue-grey', value: 'default' },
            { label: 'Deep ink', value: 'deep' },
            { label: 'Tertiary violet', value: 'tertiary' },
            { label: 'Warm error', value: 'warm' },
          ]}
        />
      </TweakSection>
      <TweakSection title="Hero">
        <TweakSelect
          label="Headline"
          value={tweaks.headline}
          onChange={(v) => setTweak('headline', v)}
          options={[
            { label: 'Editorial — chief of staff', value: 'editorial' },
            { label: 'Direct — Plan today.', value: 'direct' },
            { label: 'Outcome — Less juggling.', value: 'intent' },
          ]}
        />
        <TweakToggle
          label="Floating product cards"
          value={tweaks.showFloats}
          onChange={(v) => setTweak('showFloats', v)}
        />
      </TweakSection>
    </TweaksPanel>
  );
}

// ---------- App ----------
function App() {
  const useTweaks = window.useTweaks;
  const [tweaks, setTweak] = useTweaks ? useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  // Theme classes
  useEffect(() => {
    document.body.classList.toggle('theme-night', tweaks.theme === 'night');
    document.body.classList.remove('hue-default', 'hue-deep', 'hue-tertiary', 'hue-warm');
    document.body.classList.add(`hue-${tweaks.hue || 'default'}`);
  }, [tweaks.theme, tweaks.hue]);

  // Reveal-on-scroll
  useEffect(() => {
    const els = document.querySelectorAll('[data-reveal]');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  });

  return (
    <>
      <Nav />
      <Hero tweaks={tweaks} />
      <ProblemSolution />
      <Features />
      <HowItWorks />
      <PreviewSection />
      <Trust />
      <FinalCTA />
      <Footer />
      <Tweaks tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
