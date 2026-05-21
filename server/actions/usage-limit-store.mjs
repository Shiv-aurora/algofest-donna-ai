import fs from 'node:fs'
import path from 'node:path'

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

export function createUsageLimitStore(filePath) {
  const resolvedPath = path.resolve(filePath)
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
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true })
  }

  function load() {
    try {
      if (fs.existsSync(resolvedPath)) {
        const raw = fs.readFileSync(resolvedPath, 'utf8')
        const parsed = JSON.parse(raw)
        state = {
          userEvents: parsed?.userEvents && typeof parsed.userEvents === 'object' ? parsed.userEvents : {},
          ipEvents: parsed?.ipEvents && typeof parsed.ipEvents === 'object' ? parsed.ipEvents : {}
        }
      }
    } catch {
      state = {
        userEvents: {},
        ipEvents: {}
      }
    }
  }

  function persist() {
    if (!persistenceEnabled) return
    try {
      ensureDir()
      fs.writeFileSync(resolvedPath, JSON.stringify(state, null, 2), 'utf8')
    } catch (error) {
      const code = String(error?.code || '')
      if (code === 'EROFS' || code === 'EACCES' || code === 'EPERM') {
        disablePersistence()
        return
      }
      throw error
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

  function computeSnapshot({ userId, ipHash, limits, now = Date.now() }) {
    prune(now)
    const dayCutoff = now - DAY_MS
    const weekCutoff = now - WEEK_MS
    const hourCutoff = now - HOUR_MS

    const userEvents = ensureArray(state.userEvents[userId])
      .map((item) => ({
        at: toNumber(item?.at, 0),
        tokens: Math.max(0, toNumber(item?.tokens, 0))
      }))
      .filter((item) => item.at >= weekCutoff)
      .sort((a, b) => a.at - b.at)

    const ipEvents = ensureArray(state.ipEvents[ipHash])
      .map((ts) => toNumber(ts, 0))
      .filter((ts) => ts >= hourCutoff)
      .sort((a, b) => a - b)

    const dailyEvents = userEvents.filter((item) => item.at >= dayCutoff)
    const weeklyTokens = userEvents.reduce((sum, item) => sum + Math.max(0, item.tokens), 0)

    const userDailyResetTs = dailyEvents.length > 0 ? dailyEvents[0].at + DAY_MS : null
    const userWeeklyResetTs = userEvents.length > 0 ? userEvents[0].at + WEEK_MS : null
    const ipHourlyResetTs = ipEvents.length > 0 ? ipEvents[0] + HOUR_MS : null

    return {
      limits: {
        ipHourlyRequests: limits.freeIpHourlyLimit,
        userDailyMessages: limits.freeUserDailyMessages,
        userWeeklyTokens: limits.freeUserWeeklyTokens
      },
      usage: {
        ipHourlyRequests: ipEvents.length,
        userDailyMessages: dailyEvents.length,
        userWeeklyTokens: weeklyTokens
      },
      remaining: {
        ipHourlyRequests: Math.max(0, limits.freeIpHourlyLimit - ipEvents.length),
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

  function recordFreeUsage({ userId, ipHash, tokens = 0, at = Date.now() }) {
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

  load()

  return {
    getUsageSnapshot: computeSnapshot,
    recordFreeUsage
  }
}
