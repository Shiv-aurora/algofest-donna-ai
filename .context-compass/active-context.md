---
Context from project index (Context Compass):

Detected intent: general

Bundle 1
Function: showToast
File: src/components/AppShell.jsx

Primary source:
```
(message) => {
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
```

Tunnels:
- (none)
Bundle 2
Function: AppShell
File: src/components/AppShell.jsx

Primary source:
```
function AppShell({ activeRoute, html }) {
  const containerRef = useRef(null)
  const mountedHtmlRef = useRef('')
  const aiClockMountRef = useRef(null)
  const aiClockSlotRef = useRef(null)
  const runPlannerRef = useRef(() => {})
  const navigate = useNavigate()
  const location = useLocation()
  const {
    dashboard,
    proposeStudyBlockAction,
    profile,
    accountMenuOpen,
    setAccountMenuOpen,
    setApiKeyEditorOpen,
    setChatOpen,
    sending,
    toggleSessionPause,
    reorderPriorities,
    runPlanner,
    resetLocalData
  } = useDashboard()

  const className = ROUTE_CLASSES[activeRoute] ?? ROUTE_CLASSES.dashboard

  useEffect(() => {
    runPlannerRef.current = runPlanner
  }, [runPlanner])

  const renderAiClock = useCallback(() => {
    if (!aiClockMountRef.current) return
    aiClockMountRef.current.render(
      <DashboardClockAi
        isLoading={sending}
        onAskDonna={(message) => {
          const text = String(message || '').trim()
          if (!text) return
          runPlannerRef.current(text, 'replan')
        }}
      />
    )
  }, [sending])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const unmountAiClockRoot = () => {
      if (aiClockMountRef.current) {
        aiClockMountRef.current.unmount()
        aiClockMountRef.current = null
      }
      aiClockSlotRef.current = null
    }

    if (mountedHtmlRef.current !== html) {
      unmountAiClockRoot()
      root.innerHTML = html
      mountedHtmlRef.current = html
    }

    if (activeRoute !== 'dashboard') {
      unmountAiClockRoot()
      return
    }

    const aiClockSlot = root.querySelector('[data-ai-clock-slot]')
    if (!aiClockSlot) {
      unmountAiClockRoot()
      return
    }

    if (aiClockSlotRef.current !== aiClockSlot) {
      unmountAiClockRoot()
      aiClockMountRef.current = createRoot(aiClockSlot)
      aiClockSlotRef.current = aiClockSlot
    }

    renderAiClock()
  }, [activeRoute, html, renderAiClock])

  useEffect(() => {
    if (activeRoute !== 'dashboard') return
    renderAiClock()
  }, [activeRoute, renderAiClock])

  useEffect(() => {
    return () => {
      if (aiClockMountRef.current) {
        aiClockMountRef.current.unmount()
        aiClockMountRef.current = null
        aiClockSlotRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return undefined

    const accountName = root.querySelector('[data-account-name]')
    if (accountName) accountName.textContent = profile.name

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

      if (action === 'account-reset') {
        resetLocalData()
        showToast('Local Donna data reset')
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
    resetLocalData
  ])

  return (
    <div ref={containerRef} className={className} data-active-route={activeRoute} />
  )
}
```

Tunnels:
- unmountAiClockRoot()
  relation=CALLS pmi=0.585
  calls at line 72
- AppSidebar()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- DonnaChatWidget()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- onSubmit(event)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- saveApiKey()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- statusChipClass(status)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- toLocalTimeRange(action)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- download(url, destination)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- main()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- tryOnce()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
Bundle 3
Function: AssignmentsScreen
File: src/screens/AssignmentsScreen.jsx

Primary source:
```
function AssignmentsScreen() {
  return <MergedPlannerScreen />
}
```

Tunnels:
- CalendarScreen()
  relation=CO_EDIT pmi=0.585
  co-edited in 2/3 commits, no direct structural link
- download(url, destination)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- main()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- tryOnce()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- waitForServer(timeoutMs)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- captureScreenshots(browser)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- compareScreens()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- readPng(filePath)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- App()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- OverviewScreen()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
Bundle 4
Function: CalendarScreen
File: src/screens/CalendarScreen.jsx

Primary source:
```
function CalendarScreen() {
  return <MergedPlannerScreen />
}
```

Tunnels:
- AssignmentsScreen()
  relation=CO_EDIT pmi=0.585
  co-edited in 2/3 commits, no direct structural link
- download(url, destination)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- main()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- tryOnce()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- waitForServer(timeoutMs)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- captureScreenshots(browser)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- compareScreens()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- readPng(filePath)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- App()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
- OverviewScreen()
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link
Bundle 5
Function: download
File: scripts/prepare-design-assets.mjs

Primary source:
```
function download(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    const request = https.get(url, (response) => {
      if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(destination);
        resolve(download(response.headers.location, destination));
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`Failed ${url}: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    });

    request.on('error', (error) => {
      file.close();
      reject(error);
    });
  });
}
```

Tunnels:
- main()
  relation=CALLED_BY pmi=1.585
  called by neighbor at line 83
- tryOnce()
  relation=CO_EDIT pmi=1.585
  co-edited in 1/3 commits, no direct structural link
- waitForServer(timeoutMs)
  relation=CO_EDIT pmi=1.585
  co-edited in 1/3 commits, no direct structural link
- captureScreenshots(browser)
  relation=CO_EDIT pmi=1.585
  co-edited in 1/3 commits, no direct structural link
- compareScreens()
  relation=CO_EDIT pmi=1.585
  co-edited in 1/3 commits, no direct structural link
- readPng(filePath)
  relation=CO_EDIT pmi=1.585
  co-edited in 1/3 commits, no direct structural link
- App()
  relation=CO_EDIT pmi=1.585
  co-edited in 1/3 commits, no direct structural link
- OverviewScreen()
  relation=CO_EDIT pmi=1.585
  co-edited in 1/3 commits, no direct structural link
- TodayScreen()
  relation=CO_EDIT pmi=1.585
  co-edited in 1/3 commits, no direct structural link
- AppShell(activeRoute: {, }: html)
  relation=CO_EDIT pmi=0.585
  co-edited in 1/3 commits, no direct structural link

Note: The above context is pre-computed from the project's structure and git history.
Use it to navigate directly to relevant code instead of exploring files.
---