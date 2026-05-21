import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useDashboard } from '../state/DashboardProvider'

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
  const navigate = useNavigate()
  const location = useLocation()
  const {
    dashboard,
    profile,
    accountMenuOpen,
    setAccountMenuOpen,
    setApiKeyEditorOpen,
    setChatOpen,
    toggleSessionPause,
    reorderPriorities,
    runPlanner,
    resetLocalData
  } = useDashboard()

  const className = ROUTE_CLASSES[activeRoute] ?? ROUTE_CLASSES.dashboard

  useLayoutEffect(() => {
    const root = containerRef.current
    if (!root) return

    if (mountedHtmlRef.current !== html) {
      root.innerHTML = html
      mountedHtmlRef.current = html
    }
  }, [html])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    const accountName = root.querySelector('[data-account-name]')
    if (accountName) accountName.textContent = profile.name

    const accountMenu = root.querySelector('[data-account-menu]')
    if (accountMenu) accountMenu.classList.toggle('hidden', !accountMenuOpen)

    if (activeRoute !== 'dashboard') return undefined

    const timerEl = root.querySelector('[data-session-timer]')
    if (timerEl) {
      const minutes = Math.floor(dashboard.session.remainingSeconds / 60)
      const seconds = dashboard.session.remainingSeconds % 60
      timerEl.innerHTML = `${minutes}<span class="text-4xl text-slate-300 mx-2">:</span>${String(seconds).padStart(2, '0')}`
    }

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

    const reason = root.querySelector('[data-focus-reason]')
    if (reason) reason.textContent = `"${dashboard.focus.reason}"`

    const assignmentTitle = root.querySelector('[data-focus-assignment-title]')
    if (assignmentTitle) assignmentTitle.textContent = dashboard.focusAssignments.title

    const assignmentDue = root.querySelector('[data-focus-assignment-due]')
    if (assignmentDue) assignmentDue.textContent = dashboard.focusAssignments.due

    const assignmentNote = root.querySelector('[data-focus-assignment-note]')
    if (assignmentNote) assignmentNote.textContent = dashboard.focusAssignments.note

    return undefined
  }, [activeRoute, dashboard, profile, accountMenuOpen])

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
      if (labelText.includes('assignment') || labelText.includes('tasks')) return '/assignments'
      if (labelText.includes('calendar') || labelText.includes('plan')) return '/calendar'
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

      if (action === 'account-reset') {
        resetLocalData()
        showToast('Local Donna data reset')
        return
      }

      if (action === 'optimize-priorities') {
        setChatOpen(true)
        await runPlanner('Optimize this plan for today', 'optimize')
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
    html,
    location.pathname,
    navigate,
    reorderPriorities,
    toggleSessionPause,
    setAccountMenuOpen,
    setApiKeyEditorOpen,
    setChatOpen,
    runPlanner,
    resetLocalData
  ])

  return (
    <div ref={containerRef} className={className} data-active-route={activeRoute} />
  )
}

export default AppShell
