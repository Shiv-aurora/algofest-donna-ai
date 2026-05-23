import React from 'react'
import PromptInputBox from './ai-prompt-box'
import DashboardClockBackground from '../../background'

function DashboardClockAi({ onAskDonna, isLoading = false }) {
  return (
    <DashboardClockBackground className="w-full min-h-[510px] rounded-xl border border-white/50 px-8 py-14 md:px-14 md:py-20 shadow-[0_16px_50px_rgba(43,52,55,0.12)]">
      <div className="mx-auto w-full max-w-5xl space-y-6 md:space-y-7">
        <div className="text-center">
          <h3 className="text-3xl md:text-5xl font-light tracking-tight text-slate-900/85">Ask Donna What To Focus On Next</h3>
          <p className="text-sm md:text-base text-slate-700/70 mt-3">Optimize your work session with one prompt.</p>
        </div>
        <PromptInputBox
          isLoading={isLoading}
          className="!bg-[#1F2023]"
          placeholder="Ask Donna to optimize this session..."
          onSend={(message) => {
            if (typeof onAskDonna === 'function') onAskDonna(message)
          }}
        />
      </div>
    </DashboardClockBackground>
  )
}

export default DashboardClockAi
