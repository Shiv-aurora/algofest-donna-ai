function toMinutes(start, end) {
  const s = new Date(start).getTime()
  const e = new Date(end).getTime()
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 60
  return Math.max(15, Math.floor((e - s) / 60000))
}

export function fallbackSolve({ tasks = [], slots = [], blockedSlotIds = [] }) {
  const blocked = new Set(blockedSlotIds)
  const remaining = new Map()
  for (const task of tasks) {
    remaining.set(task.id, Math.max(30, Math.round((Number(task.p75_hours || 1) || 1) * 60)))
  }

  const assignments = []
  for (const slot of slots) {
    if (blocked.has(slot.id) || slot.blocked) continue
    const candidates = tasks
      .filter((task) => (remaining.get(task.id) || 0) > 0)
      .sort((a, b) => Number(b.urgency || 0) - Number(a.urgency || 0))
    const selected = candidates[0]
    if (!selected) continue

    const minutes = toMinutes(slot.start, slot.end)
    remaining.set(selected.id, Math.max(0, (remaining.get(selected.id) || 0) - minutes))
    assignments.push({
      task_id: selected.id,
      slot_id: slot.id,
      start: slot.start,
      end: slot.end,
      minutes
    })
  }

  const unscheduled = tasks.filter((task) => (remaining.get(task.id) || 0) > 0).map((task) => task.id)
  const overflowHours = {}
  for (const task of tasks) {
    overflowHours[task.id] = Number(((remaining.get(task.id) || 0) / 60).toFixed(2))
  }

  return {
    feasible: unscheduled.length === 0,
    assignments,
    objective_breakdown: {
      fallback: 1,
      assigned: assignments.length,
      unscheduled: unscheduled.length
    },
    overflow_hours: overflowHours,
    unscheduled_tasks: unscheduled,
    switch_count: Math.max(0, assignments.length - 1),
    route: 'fallback',
    solver_status: 'fallback',
    latency_ms: 0
  }
}
