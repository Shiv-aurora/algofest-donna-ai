const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
const WEEK_MS = 7 * DAY_MS

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function toIsoOrNull(ts) {
  if (!Number.isFinite(ts)) return null
  return new Date(ts).toISOString()
}

function ensureArray(value) {
  return Array.isArray(value) ? value : []
}

function computeSnapshotFromEvents({ userEvents, ipEvents, limits, now = Date.now() }) {
  const dayCutoff = now - DAY_MS
  const weekCutoff = now - WEEK_MS
  const hourCutoff = now - HOUR_MS

  const safeUserEvents = ensureArray(userEvents)
    .map((item) => ({
      at: toNumber(item?.at, 0),
      tokens: Math.max(0, toNumber(item?.tokens, 0))
    }))
    .filter((item) => item.at >= weekCutoff)
    .sort((a, b) => a.at - b.at)
  const safeIpEvents = ensureArray(ipEvents)
    .map((ts) => toNumber(ts, 0))
    .filter((ts) => ts >= hourCutoff)
    .sort((a, b) => a - b)

  const dailyEvents = safeUserEvents.filter((item) => item.at >= dayCutoff)
  const weeklyTokens = safeUserEvents.reduce((sum, item) => sum + Math.max(0, item.tokens), 0)
  const hourlyEvents = safeIpEvents.filter((ts) => ts >= hourCutoff)

  const userDailyResetTs = dailyEvents.length > 0 ? dailyEvents[0].at + DAY_MS : null
  const userWeeklyResetTs = safeUserEvents.length > 0 ? safeUserEvents[0].at + WEEK_MS : null
  const ipHourlyResetTs = hourlyEvents.length > 0 ? hourlyEvents[0] + HOUR_MS : null

  return {
    limits: {
      ipHourlyRequests: limits.freeIpHourlyLimit,
      userDailyMessages: limits.freeUserDailyMessages,
      userWeeklyTokens: limits.freeUserWeeklyTokens
    },
    usage: {
      ipHourlyRequests: hourlyEvents.length,
      userDailyMessages: dailyEvents.length,
      userWeeklyTokens: weeklyTokens
    },
    remaining: {
      ipHourlyRequests: Math.max(0, limits.freeIpHourlyLimit - hourlyEvents.length),
      userDailyMessages: Math.max(0, limits.freeUserDailyMessages - dailyEvents.length),
      userWeeklyTokens: Math.max(0, limits.freeUserWeeklyTokens - weeklyTokens)
    },
    resetsAt: {
      ipHourly: toIsoOrNull(ipHourlyResetTs),
      userDailyMessages: toIsoOrNull(userDailyResetTs),
      userWeeklyTokens: toIsoOrNull(userWeeklyResetTs)
    }
  }
}

export function createUsageLimitStore(filePath, postgresStore = null) {
  const usePostgres = Boolean(postgresStore?.enabled)
  void filePath
  let persistenceEnabled = true
  let state = {
    userEvents: {},
    ipEvents: {}
  }

  function disablePersistence() {
    persistenceEnabled = false
  }

  function ensureDir() {
    if (!persistenceEnabled) return
  }

  function load() {
    state = {
      userEvents: {},
      ipEvents: {}
    }
  }

  function persist() {
    if (!persistenceEnabled) return
    try {
      ensureDir()
    } catch (error) {
      const code = String(error?.code || '')
      if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') {
        disablePersistence()
      }
    }
  }

  function prune(now = Date.now()) {
    const weeklyCutoff = now - WEEK_MS
    const hourlyCutoff = now - HOUR_MS

    for (const [userId, events] of Object.entries(state.userEvents)) {
      const filtered = ensureArray(events)
        .map((item) => ({
          at: toNumber(item?.at, 0),
          tokens: Math.max(0, toNumber(item?.tokens, 0))
        }))
        .filter((item) => item.at >= weeklyCutoff)
        .sort((a, b) => a.at - b.at)

      if (filtered.length > 0) state.userEvents[userId] = filtered
      else delete state.userEvents[userId]
    }

    for (const [ipHash, events] of Object.entries(state.ipEvents)) {
      const filtered = ensureArray(events)
        .map((ts) => toNumber(ts, 0))
        .filter((ts) => ts >= hourlyCutoff)
        .sort((a, b) => a - b)

      if (filtered.length > 0) state.ipEvents[ipHash] = filtered
      else delete state.ipEvents[ipHash]
    }
  }

  function computeSnapshotFromFile({ userId, ipHash, limits, now = Date.now() }) {
    prune(now)
    return computeSnapshotFromEvents({
      userEvents: state.userEvents[userId] || [],
      ipEvents: state.ipEvents[ipHash] || [],
      limits,
      now
    })
  }

  function recordFreeUsageFile({ userId, ipHash, tokens = 0, at = Date.now() }) {
    const safeTs = toNumber(at, Date.now())
    const safeTokens = Math.max(0, toNumber(tokens, 0))

    const userEvents = ensureArray(state.userEvents[userId])
    userEvents.push({ at: safeTs, tokens: safeTokens })
    state.userEvents[userId] = userEvents

    const ipEvents = ensureArray(state.ipEvents[ipHash])
    ipEvents.push(safeTs)
    state.ipEvents[ipHash] = ipEvents

    prune(safeTs)
    persist()
  }

  async function getUsageSnapshotDb({ userId, ipHash, limits, now = Date.now() }) {
    const hourAgo = new Date(now - HOUR_MS).toISOString()
    const weekAgo = new Date(now - WEEK_MS).toISOString()

    const [userRows, ipRows] = await Promise.all([
      postgresStore.query(
        `SELECT created_at, tokens FROM usage_events
         WHERE user_id = $1 AND created_at >= $2
         ORDER BY created_at ASC`,
        [userId, weekAgo]
      ),
      postgresStore.query(
        `SELECT created_at FROM usage_events
         WHERE ip_hash = $1 AND created_at >= $2
         ORDER BY created_at ASC`,
        [ipHash, hourAgo]
      )
    ])

    const userEvents = userRows.rows.map((row) => ({
      at: new Date(row.created_at).getTime(),
      tokens: toNumber(row.tokens, 0)
    }))
    const ipEvents = ipRows.rows.map((row) => new Date(row.created_at).getTime())
    return computeSnapshotFromEvents({ userEvents, ipEvents, limits, now })
  }

  async function recordFreeUsageDb({ userId, ipHash, tokens = 0, at = Date.now() }) {
    const createdAt = new Date(toNumber(at, Date.now())).toISOString()
    await postgresStore.query(
      `INSERT INTO usage_events (user_id, ip_hash, tokens, created_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, ipHash, Math.max(0, toNumber(tokens, 0)), createdAt]
    )
  }

  if (!usePostgres) {
    load()
  }

  return {
    async getUsageSnapshot(payload) {
      if (usePostgres) return getUsageSnapshotDb(payload)
      return computeSnapshotFromFile(payload)
    },
    async recordFreeUsage(payload) {
      if (usePostgres) return recordFreeUsageDb(payload)
      return recordFreeUsageFile(payload)
    }
  }
}
