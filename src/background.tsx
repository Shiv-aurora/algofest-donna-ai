import React from 'react'

export default function DashboardClockBackground({ className = '', children }) {
  return (
    <div
      className={`relative overflow-hidden bg-[radial-gradient(circle_at_18%_22%,rgba(130,192,236,0.45),transparent_40%),radial-gradient(circle_at_82%_8%,rgba(121,158,214,0.38),transparent_35%),linear-gradient(180deg,#f6fbff_0%,#e8f2fa_100%)] ${className}`.trim()}
    >
      <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-primary/35 blur-3xl animate-float" />
      <div className="pointer-events-none absolute -right-16 top-10 h-64 w-64 rounded-full bg-secondary/35 blur-3xl animate-glow" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-tertiary/30 blur-3xl animate-pulse-soft" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.62),transparent_42%,rgba(70,98,112,0.15))]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)] [background-size:200%_100%] animate-pulse-soft" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
