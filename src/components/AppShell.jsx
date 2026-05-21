import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'

const ROUTE_CLASSES = {
  overview: 'bg-surface text-on-surface antialiased',
  today: 'bg-surface text-on-surface selection:bg-primary-container selection:text-on-primary-container',
  assignments: 'bg-surface text-on-surface flex h-screen overflow-hidden',
  calendar: 'bg-surface text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container'
}

function AppShell({ activeRoute, html }) {
  const containerRef = useRef(null)
  const navigate = useNavigate()
  const className = ROUTE_CLASSES[activeRoute] ?? ROUTE_CLASSES.overview

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    const routeForLabel = (labelText) => {
      if (labelText.includes('overview')) return '/overview'
      if (labelText.includes('today')) return '/today'
      if (labelText.includes('assignment') || labelText.includes('tasks')) return '/assignments'
      if (labelText.includes('calendar') || labelText.includes('plan')) return '/calendar'
      return null
    }

    const onClick = (event) => {
      const link = event.target.closest('a')
      if (!link || !root.contains(link)) return
      if (link.getAttribute('href') !== '#') return

      const labelText = (link.textContent ?? '').toLowerCase()
      const route = routeForLabel(labelText)
      if (!route) return

      event.preventDefault()
      navigate(route)
    }

    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [navigate])

  return (
    <div
      ref={containerRef}
      className={className}
      data-active-route={activeRoute}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

export default AppShell
