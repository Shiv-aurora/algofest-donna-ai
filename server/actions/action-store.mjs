function nowIso() {
  return new Date().toISOString()
}

function createId(prefix = 'act') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function toIsoOrNull(value) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
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

function fromDbRow(row) {
  if (!row) return null
  return sanitize({
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    payload: row.payload || {},
    result: row.result || null,
    error: row.error || null,
    createdAt: toIsoOrNull(row.created_at) || nowIso(),
    updatedAt: toIsoOrNull(row.updated_at) || nowIso(),
    approvedAt: toIsoOrNull(row.approved_at),
    executedAt: toIsoOrNull(row.executed_at),
    history: Array.isArray(row.history) ? row.history : []
  })
}

export function createActionStore(filePath, postgresStore = null) {
  const usePostgres = Boolean(postgresStore?.enabled)
  void filePath
  // When Postgres is unavailable, keep an in-memory fallback for developer mode.
  // This deliberately avoids legacy JSON persistence paths.
  let state = {
    actions: []
  }

  function load() {
    state = { actions: [] }
  }

  function persist() {
    // no-op: legacy JSON persistence removed
  }

  function appendHistory(action, status, message = '') {
    action.history = Array.isArray(action.history) ? action.history : []
    action.history.push({
      status,
      at: nowIso(),
      message
    })
  }

  function listByUserFile(userId) {
    return state.actions
      .filter((action) => action.userId === userId)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((action) => sanitize(action))
  }

  function getByIdFile(id) {
    return state.actions.find((action) => action.id === id) || null
  }

  function createProposedActionFile(userId, type, payload) {
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

  function markApprovedFile(id, message = 'Action approved by user.') {
    const action = getByIdFile(id)
    if (!action) return null
    action.status = 'approved'
    action.approvedAt = nowIso()
    action.updatedAt = nowIso()
    appendHistory(action, 'approved', message)
    persist()
    return sanitize(action)
  }

  function markExecutedFile(id, result, message = 'Action executed successfully.') {
    const action = getByIdFile(id)
    if (!action) return null
    action.status = 'executed'
    action.result = result
    action.executedAt = nowIso()
    action.updatedAt = nowIso()
    appendHistory(action, 'executed', message)
    persist()
    return sanitize(action)
  }

  function markFailedFile(id, error, message = 'Action execution failed.') {
    const action = getByIdFile(id)
    if (!action) return null
    action.status = 'failed'
    action.error = typeof error === 'string' ? error : String(error?.message || 'Unknown error')
    action.updatedAt = nowIso()
    appendHistory(action, 'failed', message)
    persist()
    return sanitize(action)
  }

  async function getByIdDb(id) {
    const result = await postgresStore.query(
      `SELECT id, user_id, type, status, payload, result, error, history, created_at, updated_at, approved_at, executed_at
       FROM legacy_actions WHERE id = $1`,
      [id]
    )
    return fromDbRow(result.rows[0] || null)
  }

  async function listByUserDb(userId) {
    const result = await postgresStore.query(
      `SELECT id, user_id, type, status, payload, result, error, history, created_at, updated_at, approved_at, executed_at
       FROM legacy_actions
       WHERE user_id = $1
       ORDER BY updated_at DESC`,
      [userId]
    )
    return result.rows.map((row) => fromDbRow(row))
  }

  async function insertDbAction(action) {
    await postgresStore.query(
      `INSERT INTO legacy_actions
       (id, user_id, type, status, payload, result, error, history, created_at, updated_at, approved_at, executed_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8::jsonb,$9,$10,$11,$12)`,
      [
        action.id,
        action.userId,
        action.type,
        action.status,
        JSON.stringify(action.payload || {}),
        action.result ? JSON.stringify(action.result) : null,
        action.error || null,
        JSON.stringify(action.history || []),
        action.createdAt,
        action.updatedAt,
        action.approvedAt,
        action.executedAt
      ]
    )
  }

  async function updateDbAction(action) {
    await postgresStore.query(
      `UPDATE legacy_actions
       SET status = $2,
           payload = $3::jsonb,
           result = $4::jsonb,
           error = $5,
           history = $6::jsonb,
           updated_at = $7,
           approved_at = $8,
           executed_at = $9
       WHERE id = $1`,
      [
        action.id,
        action.status,
        JSON.stringify(action.payload || {}),
        action.result ? JSON.stringify(action.result) : null,
        action.error || null,
        JSON.stringify(action.history || []),
        action.updatedAt,
        action.approvedAt,
        action.executedAt
      ]
    )
  }

  async function createProposedActionDb(userId, type, payload) {
    const action = {
      id: createId('action'),
      userId,
      type,
      status: 'proposed',
      payload,
      result: null,
      error: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      approvedAt: null,
      executedAt: null,
      history: []
    }
    appendHistory(action, 'proposed', 'Action proposed by Donna.')
    await insertDbAction(action)
    return sanitize(action)
  }

  async function markApprovedDb(id, message = 'Action approved by user.') {
    const action = await getByIdDb(id)
    if (!action) return null
    action.status = 'approved'
    action.approvedAt = nowIso()
    action.updatedAt = nowIso()
    appendHistory(action, 'approved', message)
    await updateDbAction(action)
    return sanitize(action)
  }

  async function markExecutedDb(id, result, message = 'Action executed successfully.') {
    const action = await getByIdDb(id)
    if (!action) return null
    action.status = 'executed'
    action.result = result
    action.executedAt = nowIso()
    action.updatedAt = nowIso()
    appendHistory(action, 'executed', message)
    await updateDbAction(action)
    return sanitize(action)
  }

  async function markFailedDb(id, error, message = 'Action execution failed.') {
    const action = await getByIdDb(id)
    if (!action) return null
    action.status = 'failed'
    action.error = typeof error === 'string' ? error : String(error?.message || 'Unknown error')
    action.updatedAt = nowIso()
    appendHistory(action, 'failed', message)
    await updateDbAction(action)
    return sanitize(action)
  }

  if (!usePostgres) load()

  return {
    async listByUser(userId) {
      if (usePostgres) return listByUserDb(userId)
      return listByUserFile(userId)
    },
    async getById(id) {
      if (usePostgres) return getByIdDb(id)
      const action = getByIdFile(id)
      return action ? sanitize(action) : null
    },
    async createProposedAction(userId, type, payload) {
      if (usePostgres) return createProposedActionDb(userId, type, payload)
      return createProposedActionFile(userId, type, payload)
    },
    async markApproved(id, message) {
      if (usePostgres) return markApprovedDb(id, message)
      return markApprovedFile(id, message)
    },
    async markExecuted(id, result, message) {
      if (usePostgres) return markExecutedDb(id, result, message)
      return markExecutedFile(id, result, message)
    },
    async markFailed(id, error, message) {
      if (usePostgres) return markFailedDb(id, error, message)
      return markFailedFile(id, error, message)
    }
  }
}
