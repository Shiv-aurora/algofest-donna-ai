import { useEffect } from 'react'
import LandingFooter from '../features/landing/LandingFooter'
import LandingHeader from '../features/landing/LandingHeader'
import {
  LandingFeaturesSection,
  LandingFinalCtaSection,
  LandingHeroSection,
  LandingHowSection,
  LandingPreviewSection,
  LandingProblemSolutionSection,
  LandingTrustSection
} from '../features/landing/LandingSections'
import '../features/landing/landing.css'

function LandingScreen() {
  useEffect(() => {
    const revealed = new Set()
    const nodes = Array.from(document.querySelectorAll('.landing-page [data-reveal]'))
    if (!nodes.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !revealed.has(entry.target)) {
            revealed.add(entry.target)
            entry.target.classList.add('in')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -50px 0px' }
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [])

  return (
    <div className="landing-page bg-[#F4F7F8] text-[#1A1C1E]">
      <LandingHeader />

      <main>
        <LandingHeroSection />
        <LandingProblemSolutionSection />
        <LandingFeaturesSection />
        <LandingHowSection />
        <LandingPreviewSection />
        <LandingTrustSection />
        <LandingFinalCtaSection />
      </main>

      <LandingFooter />
    </div>
  )
}

export default LandingScreen
