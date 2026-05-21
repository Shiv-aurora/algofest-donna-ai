import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDashboard } from '../state/DashboardProvider'
import DashboardClockAi from './ui/dashboard-clock-ai'

const ROUTE_CLASSES = {
  dashboard: 'bg-surface text-on-surface antialiased',
  today: 'bg-surface text-on-surface selection:bg-primary-container selection:text-on-primary-container',
  assignments: 'bg-surface text-on-surface flex h-screen overflow-hidden',
  calendar: 'bg-surface text-on-surface font-body selection:bg-primary-container selection:text-on-primary-container',
  goals: 'bg-surface text-on-surface',
  settings: 'bg-surface text-on-surface'
}

function AppShell({ activeRoute, html }) {
  const containerRef = useRef(null)
  const mountedHtmlRef = useRef('')
  const runPlannerRef = useRef(() => {})
  const [aiClockSlot, setAiClockSlot] = useState(null)
  const navigate = useNavigate()
  const location = useLocation()
  const {
    dashboard,
    proposeStudyBlockAction,
    profile,
    userMode,
    accountMenuOpen,
    setAccountMenuOpen,
    setApiKeyEditorOpen,
    setChatOpen,
    sending,
    toggleSessionPause,
    reorderPriorities,
    runPlanner,
    logoutSession
  } = useDashboard()

  const className = ROUTE_CLASSES[activeRoute] ?? ROUTE_CLASSES.dashboard

  useEffect(() => {
    runPlannerRef.current = runPlanner
  }, [runPlanner])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    if (mountedHtmlRef.current !== html) {
      root.innerHTML = html
      mountedHtmlRef.current = html
    }

    const nextAiClockSlot =
      activeRoute === 'dashboard' ? root.querySelector('[data-ai-clock-slot]') : null
    const frame = window.requestAnimationFrame(() => {
      setAiClockSlot((current) => (current === nextAiClockSlot ? current : nextAiClockSlot))
    })

    return () => window.cancelAnimationFrame(frame)
  }, [activeRoute, html])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    const accountName = root.querySelector('[data-account-name]')
    if (accountName) accountName.textContent = profile.name

    const greetingName = (() => {
      if (userMode === 'guest') return 'Guest'
      if (userMode === 'demo') return 'Demo'
      const first = String(profile.name || '').trim().split(/\s+/)[0]
      return first || 'there'
    })()
    const greeting = root.querySelector('[data-greeting-heading]')
    if (greeting) greeting.textContent = `Good morning, ${greetingName}.`

    const accountMenu = root.querySelector('[data-account-menu]')
    if (accountMenu) accountMenu.classList.toggle('hidden', !accountMenuOpen)

    if (activeRoute !== 'dashboard') return undefined

    const pauseButton = root.querySelector('[data-action="pause-session"]')
    if (pauseButton) {
      pauseButton.innerHTML = dashboard.session.isPaused
        ? '<span class="material-symbols-outlined" data-icon="play_arrow">play_arrow</span>Resume Session'
        : '<span class="material-symbols-outlined" data-icon="pause">pause</span>Pause Session'
    }

    const priorityItems = [...root.querySelectorAll('[data-priority-item]')]
    priorityItems.forEach((item, index) => {
      const priority = dashboard.priorities[index]
      if (!priority) {
        item.classList.add('hidden')
        return
      }

      item.classList.remove('hidden')
      item.dataset.priorityId = priority.id

      const rankBadge = item.querySelector('.marker-gradient-1, .marker-gradient-2, .marker-gradient-3')
      if (rankBadge) rankBadge.textContent = String(index + 1)

      const title = item.querySelector('h5')
      if (title) {
        title.textContent = priority.title
        title.classList.toggle('line-through', priority.completed)
        title.classList.toggle('opacity-60', priority.completed)
      }

      const meta = item.querySelector('p')
      if (meta) meta.textContent = priority.meta
    })

    const timelineItems = [...root.querySelectorAll('[data-timeline-item]')]
    timelineItems.forEach((item, index) => {
      const timeline = dashboard.timeline[index]
      if (!timeline) return

      const time = item.querySelector('[data-timeline-time]')
      const title = item.querySelector('[data-timeline-title]')
      const detail = item.querySelector('[data-timeline-detail]')
      const status = item.querySelector('[data-timeline-status]')

      if (time) time.textContent = timeline.time
      if (title) title.textContent = timeline.title
      if (detail) detail.textContent = timeline.detail
      if (status) {
        status.textContent = timeline.status || ''
        status.classList.toggle('hidden', !timeline.status)
      }
    })

    const score = root.querySelector('[data-focus-score]')
    if (score) score.textContent = String(dashboard.focus.score)

    const readingPct = Math.max(0, Math.min(100, Number(dashboard.focus.score || 0) - 12))
    const readingValue = root.querySelector('[data-focus-reading-value]')
    if (readingValue) readingValue.textContent = `${readingPct}%`
    const readingBar = root.querySelector('[data-focus-reading-bar]')
    if (readingBar) readingBar.style.width = `${readingPct}%`

    const reason = root.querySelector('[data-focus-reason]')
    if (reason) reason.textContent = `"${dashboard.focus.reason}"`

    const assignmentTitle = root.querySelector('[data-focus-assignment-title]')
    if (assignmentTitle) assignmentTitle.textContent = dashboard.focusAssignments.title

    const assignmentDue = root.querySelector('[data-focus-assignment-due]')
    if (assignmentDue) assignmentDue.textContent = dashboard.focusAssignments.due

    const assignmentNote = root.querySelector('[data-focus-assignment-note]')
    if (assignmentNote) assignmentNote.textContent = dashboard.focusAssignments.note

    return undefined
  }, [activeRoute, dashboard, profile, accountMenuOpen, userMode])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    let toastTimer = null

    const showToast = (message) => {
      let toast = root.querySelector('[data-toast]')
      if (!toast) {
        toast = document.createElement('div')
        toast.setAttribute('data-toast', 'true')
        toast.className =
          'fixed bottom-5 right-5 bg-surface-container-lowest ghost-border rounded-full px-4 py-2 text-xs text-on-surface-variant z-[100] opacity-0 transition-opacity'
        root.appendChild(toast)
      }

      toast.textContent = message
      toast.classList.remove('opacity-0')
      toast.classList.add('opacity-100')

      if (toastTimer) clearTimeout(toastTimer)
      toastTimer = setTimeout(() => {
        toast.classList.remove('opacity-100')
        toast.classList.add('opacity-0')
      }, 1500)
    }

    const routeForLabel = (labelText) => {
      if (labelText.includes('dashboard') || labelText.includes('overview') || labelText.includes('today')) return '/dashboard'
      if (labelText.includes('assessment') || labelText.includes('assignment') || labelText.includes('tasks')) return '/assignments'
      if (labelText.includes('calendar') || labelText.includes('plan')) return '/assignments'
      if (labelText.includes('goal')) return '/goals'
      if (labelText.includes('setting')) return '/settings'
      return null
    }

    const priorityList = root.querySelector('[data-priority-list]')
    if (priorityList && !priorityList.dataset.dndReady) {
      priorityList.dataset.dndReady = 'true'
      let draggedItem = null

      const items = [...priorityList.querySelectorAll('[data-priority-item]')]
      items.forEach((item) => {
        item.setAttribute('draggable', 'true')
        item.addEventListener('dragstart', () => {
          draggedItem = item
          item.classList.add('opacity-70', 'is-dragging')
        })
        item.addEventListener('dragend', () => {
          item.classList.remove('opacity-70', 'is-dragging')
          const orderedIds = [...priorityList.querySelectorAll('[data-priority-item]')]
            .map((entry) => entry.dataset.priorityId)
            .filter(Boolean)
          reorderPriorities(orderedIds)
          draggedItem = null
          showToast('Priority order updated')
        })
      })

      priorityList.addEventListener('dragover', (event) => {
        event.preventDefault()
        if (!draggedItem) return

        const siblings = [...priorityList.querySelectorAll('[data-priority-item]:not(.is-dragging)')]
        const target = siblings.find((entry) => {
          const rect = entry.getBoundingClientRect()
          return event.clientY <= rect.top + rect.height / 2
        })

        if (!target) priorityList.appendChild(draggedItem)
        else priorityList.insertBefore(draggedItem, target)
      })
    }

    const onClick = async (event) => {
      const link = event.target.closest('a')
      if (link && root.contains(link) && link.getAttribute('href') === '#') {
        event.preventDefault()
        const route = routeForLabel((link.textContent || '').toLowerCase())
        if (route && route !== location.pathname) navigate(route)
        return
      }

      const button = event.target.closest('button')
      if (!button || !root.contains(button)) return

      const action = button.dataset.action
      if (!action) return

      if (action === 'show-notifications') {
        showToast('Notifications are up to date')
        return
      }

      if (action === 'toggle-account-menu') {
        setAccountMenuOpen((value) => !value)
        return
      }

      if (action === 'account-profile') {
        showToast('Profile panel is available in this workspace')
        setAccountMenuOpen(false)
        return
      }

      if (action === 'account-api-key') {
        setApiKeyEditorOpen(true)
        setChatOpen(true)
        setAccountMenuOpen(false)
        showToast('OpenAI BYOK editor opened')
        return
      }

      if (action === 'account-logout') {
        const confirmed = window.confirm('Log out of Donna?')
        if (!confirmed) return
        setAccountMenuOpen(false)
        await logoutSession(`${window.location.origin}/login`)
        showToast('Logged out')
        return
      }

      if (action === 'optimize-priorities') {
        setChatOpen(true)
        await runPlanner('Optimize this plan for today', 'optimize')
        const now = new Date()
        const start = new Date(now)
        start.setHours(20, 0, 0, 0)
        if (start.getTime() <= now.getTime()) {
          start.setDate(start.getDate() + 1)
        }
        const end = new Date(start)
        end.setMinutes(end.getMinutes() + 60)
        const focusTitle = String(dashboard.focusAssignments?.title || 'Priority Study Block').trim()
        const proposalResult = await proposeStudyBlockAction({
          title: `Study Block: ${focusTitle}`,
          start: start.toISOString(),
          end: end.toISOString(),
          description: 'Donna-generated study block from dashboard optimization flow.',
          metadata: { trigger: 'dashboard_optimize' }
        })
        if (proposalResult?.ok && proposalResult?.action?.status === 'proposed') {
          showToast('Study block proposed. Review in Donna chat.')
          return
        }
        if (!proposalResult?.ok) {
          showToast(proposalResult?.message || 'Study block suggestion unavailable')
          return
        }
        showToast('Plan optimized with Donna')
        return
      }

      if (action === 'pause-session') {
        toggleSessionPause()
        return
      }

      if (action === 'replan-session') {
        setChatOpen(true)
        await runPlanner('Replan this schedule with minimal context switching and highest impact first.', 'replan')
        showToast('Replan complete')
        return
      }

      if (action === 'view-draft-timeline') {
        setChatOpen(true)
        await runPlanner('Create a draft outline and timeline for my current focus assignment.', 'replan')
        showToast('Draft and timeline prepared in Donna chat')
      }
    }

    const onInput = (event) => {
      const input = event.target.closest('[data-priority-search]')
      if (!input) return

      const query = input.value.trim().toLowerCase()
      const items = [...root.querySelectorAll('[data-priority-item]')]
      items.forEach((item) => {
        const text = item.textContent?.toLowerCase() || ''
        item.classList.toggle('hidden', query.length > 0 && !text.includes(query))
      })
    }

    root.addEventListener('click', onClick)
    root.addEventListener('input', onInput)

    return () => {
      root.removeEventListener('click', onClick)
      root.removeEventListener('input', onInput)
      if (toastTimer) clearTimeout(toastTimer)
    }
  }, [
    activeRoute,
    dashboard,
    html,
    location.pathname,
    navigate,
    reorderPriorities,
    toggleSessionPause,
    setAccountMenuOpen,
    setApiKeyEditorOpen,
    setChatOpen,
    proposeStudyBlockAction,
    runPlanner,
    logoutSession,
    userMode
  ])

  return (
    <>
      <div ref={containerRef} className={className} data-active-route={activeRoute} />
      {activeRoute === 'dashboard' &&
        aiClockSlot &&
        createPortal(
          <DashboardClockAi
            isLoading={sending}
            onAskDonna={(message) => {
              const text = String(message || '').trim()
              if (!text) return
              setChatOpen(true)
              runPlannerRef.current(text, 'chat')
            }}
          />,
          aiClockSlot
        )}
    </>
  )
}

export default AppShell
