const RHYTHM_NODES = [
  { id: 'a', cx: 70, cy: 120, r: 5.5 },
  { id: 'b', cx: 120, cy: 60, r: 5 },
  { id: 'c', cx: 185, cy: 38, r: 6 },
  { id: 'd', cx: 255, cy: 58, r: 5.5 },
  { id: 'e', cx: 322, cy: 112, r: 5 },
  { id: 'f', cx: 300, cy: 186, r: 5.5 },
  { id: 'g', cx: 240, cy: 235, r: 6.5 },
  { id: 'h', cx: 160, cy: 258, r: 5.5 },
  { id: 'i', cx: 98, cy: 214, r: 5 },
  { id: 'j', cx: 48, cy: 176, r: 4.5 },
  { id: 'k', cx: 210, cy: 148, r: 5 },
  { id: 'l', cx: 144, cy: 156, r: 4.5 }
]

const RHYTHM_LINKS = [
  ['a', 'b'],
  ['a', 'j'],
  ['a', 'l'],
  ['b', 'c'],
  ['b', 'l'],
  ['b', 'k'],
  ['c', 'd'],
  ['c', 'k'],
  ['d', 'e'],
  ['d', 'k'],
  ['e', 'f'],
  ['e', 'k'],
  ['f', 'g'],
  ['f', 'k'],
  ['g', 'h'],
  ['g', 'k'],
  ['h', 'i'],
  ['h', 'l'],
  ['i', 'j'],
  ['i', 'l'],
  ['j', 'l'],
  ['k', 'l'],
  ['g', 'i'],
  ['c', 'f']
]

const nodeById = Object.fromEntries(RHYTHM_NODES.map((node) => [node.id, node]))

export function RhythmEngineVisual() {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#05090d] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.35)] ring-1 ring-black/5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(49,197,255,0.22)_0%,_rgba(8,18,24,0.94)_58%,_rgba(2,5,7,1)_100%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(70,209,255,0.22)_0%,_transparent_42%)] blur-2xl" />
      <svg viewBox="0 0 370 300" className="absolute inset-0 h-full w-full">
        {RHYTHM_LINKS.map(([from, to]) => {
          const start = nodeById[from]
          const end = nodeById[to]
          return (
            <line
              key={`${from}-${to}`}
              x1={start.cx}
              y1={start.cy}
              x2={end.cx}
              y2={end.cy}
              stroke="rgba(118, 242, 255, 0.72)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          )
        })}
        {RHYTHM_NODES.map((node) => (
          <g key={node.id}>
            <circle cx={node.cx} cy={node.cy} r={node.r * 3.2} fill="rgba(96, 240, 255, 0.15)" />
            <circle cx={node.cx} cy={node.cy} r={node.r * 1.8} fill="rgba(96, 240, 255, 0.28)" />
            <circle cx={node.cx} cy={node.cy} r={node.r} fill="#8cf5ff" />
            <circle cx={node.cx} cy={node.cy} r={node.r * 0.45} fill="#f4feff" />
          </g>
        ))}
      </svg>
    </div>
  )
}

export function NexusOrbVisual() {
  return (
    <div className="flex justify-center">
      <div className="relative flex h-80 w-80 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[#78909C]/20 blur-[80px]" />
        <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 400 400" aria-hidden="true">
          <circle cx="200" cy="200" r="150" fill="none" stroke="white" strokeDasharray="2 4" strokeWidth="0.5" />
          <circle cx="200" cy="200" r="100" fill="none" stroke="white" strokeDasharray="1 3" strokeWidth="0.5" />
          <circle cx="200" cy="200" r="58" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
        </svg>
        <div className="relative flex h-48 w-48 items-center justify-center rounded-full border border-white/20">
          <div className="flex h-32 w-32 items-center justify-center rounded-full bg-[#FDFDFD] text-[#1A1C1E] shadow-[0_0_50px_rgba(120,144,156,0.3)]">
            <span className="material-symbols-outlined !text-5xl">hub</span>
          </div>
        </div>
        <div className="absolute left-1/2 top-0 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
          <span className="material-symbols-outlined !text-xs">school</span>
        </div>
        <div className="absolute bottom-12 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-md">
          <span className="material-symbols-outlined !text-xs">draw</span>
        </div>
      </div>
    </div>
  )
}
