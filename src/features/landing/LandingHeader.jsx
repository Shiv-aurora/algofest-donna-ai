import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const NAV_ITEMS = [
  { label: 'How it works', href: '#how' },
  { label: 'Features', href: '#features' },
  { label: 'Product', href: '#preview' },
  { label: 'Trust', href: '#trust' }
]

function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`landing-page__nav ${scrolled ? 'landing-page__nav--scrolled' : ''}`}>
      <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-8 md:px-16">
        <Link to="/" className="text-[20px] font-semibold tracking-[-0.02em] text-[#1A1C1E]">
          Donna
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_ITEMS.map((item) => (
            <a key={item.label} href={item.href} className="text-[14px] text-[#44474E] transition-colors hover:text-[#1A1C1E]">
              {item.label}
            </a>
          ))}
        </nav>

        <Link to="/dashboard" className="landing-page__btn-primary landing-page__btn-primary--sm">
          Open app
        </Link>
      </div>
    </header>
  )
}

export default LandingHeader
