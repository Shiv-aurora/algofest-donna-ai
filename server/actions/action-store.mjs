import fs from 'node:fs'
import path from 'node:path'

function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'act') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export function createActionStore(filePath) {
  const resolvedPath = path.resolve(filePath)
  let state = {
    actions: []
  }

  function ensureDir() {
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
  }

  function load() {
    try {
      if (fs.existsSync(resolvedPath)) {
        const raw = fs.readFileSync(resolvedPath, 'utf8')
        const parsed = JSON.parse(raw)
        state = {
          actions: Array.isArray(parsed?.actions) ? parsed.actions : []
        }
      }
    } catch {
      state = { actions: [] }
    }
  }

  function persist() {
    ensureDir()
    fs.writeFileSync(resolvedPath, JSON.stringify(state, null, 2), 'utf8')
  }

  function appendHistory(action, status, message = '') {
    action.history = Array.isArray(action.history) ? action.history : []
    action.history.push({
      status,
      at: nowIso(),
      message
    })
  }

  function sanitize(action) {
    return {
      id: action.id,
      userId: action.userId,
      type: action.type,
      status: action.status,
      payload: action.payload,
      result: action.result || null,
      error: action.error || null,
      createdAt: action.createdAt,
      updatedAt: action.updatedAt,
      approvedAt: action.approvedAt || null,
      executedAt: action.executedAt || null,
      history: Array.isArray(action.history) ? action.history : []
    }
  }

  function listByUser(userId) {
    return state.actions
      .filter((action) => action.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((action) => sanitize(action))
  }

  function getById(id) {
    return state.actions.find((action) => action.id === id) || null
  }

  function createProposedAction(userId, type, payload) {
    const action = {
      id: createId('action'),
      userId,
      type,
      status: 'proposed',
      payload,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      history: []
    }

    appendHistory(action, 'proposed', 'Action proposed by Donna.')
    state.actions.push(action)
    persist()
    return sanitize(action)
  }

  function markApproved(id, message = 'Action approved by user.') {
    const action = getById(id)
    if (!action) return null
    action.status = 'approved'
    action.approvedAt = nowIso()
    action.updatedAt = nowIso()
    appendHistory(action, 'approved', message)
    persist()
    return sanitize(action)
  }

  function markExecuted(id, result, message = 'Action executed successfully.') {
    const action = getById(id)
    if (!action) return null
    action.status = 'executed'
    action.result = result
    action.executedAt = nowIso()
    action.updatedAt = nowIso()
    appendHistory(action, 'executed', message)
    persist()
    return sanitize(action)
  }

  function markFailed(id, error, message = 'Action execution failed.') {
    const action = getById(id)
    if (!action) return null
    action.status = 'failed'
    action.error = typeof error === 'string' ? error : String(error?.message || 'Unknown error')
    action.updatedAt = nowIso()
    appendHistory(action, 'failed', message)
    persist()
    return sanitize(action)
  }

  load()

  return {
    listByUser,
    getById,
    createProposedAction,
    markApproved,
    markExecuted,
    markFailed
  }
}
