import 'dotenv/config'
import crypto from 'node:crypto'
import path from 'node:path'

function parseNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseList(value, fallback) {
  if (!value) return fallback
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function sanitizeBaseUrl(value, fallback) {
  const candidate = String(value || fallback || '').trim()
  try {
    const parsed = new URL(candidate)
    return parsed.origin
  } catch {
    return candidate
  }
}

function validateConfig(config) {
  const errors = []
  const isProduction = config.nodeEnv === 'production'

  if (!config.sessionSecret) {
    errors.push('SESSION_SECRET is required.')
  } else if (isProduction && config.sessionSecret.length < 32) {
    errors.push('SESSION_SECRET must be at least 32 characters in production.')
  }

  try {
    const frontend = new URL(config.frontendOrigin)
    if (!['http:', 'https:'].includes(frontend.protocol)) {
      errors.push('FRONTEND_ORIGIN must use http or https.')
    }
  } catch {
    errors.push('FRONTEND_ORIGIN must be a valid absolute URL.')
  }

  try {
    const server = new URL(config.serverBaseUrl)
    if (!['http:', 'https:'].includes(server.protocol)) {
      errors.push('SERVER_BASE_URL must use http or https.')
    }
  } catch {
    errors.push('SERVER_BASE_URL must be a valid absolute URL.')
  }

  if (Boolean(config.google.clientId) !== Boolean(config.google.clientSecret)) {
    errors.push('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must both be set together.')
  }

  if (isProduction && (!config.google.clientId || !config.google.clientSecret)) {
    errors.push('Google OAuth must be configured in production.')
  }

  if (isProduction && !config.redisUrl) {
    errors.push('REDIS_URL is required in production.')
  }

  if (config.ops?.metricsKey && config.ops.metricsKey.length < 24) {
    errors.push('OPS_METRICS_KEY must be at least 24 characters when set.')
  }

  if (config.limits.freeIpHourlyLimit <= 0) {
    errors.push('FREE_GROQ_IP_HOURLY_LIMIT must be greater than 0.')
  }
  if (config.limits.freeUserDailyMessages <= 0) {
    errors.push('FREE_GROQ_USER_DAILY_MESSAGES must be greater than 0.')
  }
  if (config.limits.freeUserWeeklyTokens <= 0) {
    errors.push('FREE_GROQ_USER_WEEKLY_TOKENS must be greater than 0.')
  }

  if (errors.length > 0) {
    throw new Error(`Invalid server configuration:\n- ${errors.join('\n- ')}`)
  }
}

export function loadEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'
  const port = parseNumber(process.env.CONNECTIVITY_PORT, 8787)
  const frontendOrigin = sanitizeBaseUrl(process.env.FRONTEND_ORIGIN, 'http://localhost:5173')
  const serverBaseUrl = sanitizeBaseUrl(process.env.SERVER_BASE_URL, `http://localhost:${port}`)
  const googleCalendarScopes = parseList(process.env.GOOGLE_CALENDAR_SCOPES, [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ])
  const actionStoreFile =
    process.env.DONNA_ACTION_STORE_FILE || path.resolve(process.cwd(), 'server/data/action-log.json')
  const usageStoreFile =
    process.env.DONNA_USAGE_STORE_FILE || path.resolve(process.cwd(), 'server/data/usage-limits.json')
  const freeIpHourlyLimit = parseNumber(process.env.FREE_GROQ_IP_HOURLY_LIMIT, 50)
  const freeUserDailyMessages = parseNumber(process.env.FREE_GROQ_USER_DAILY_MESSAGES, 10)
  const freeUserWeeklyTokens = parseNumber(process.env.FREE_GROQ_USER_WEEKLY_TOKENS, 75000)
  const sessionSecret = String(
    process.env.SESSION_SECRET || (isProduction ? '' : `donna-dev-${crypto.randomUUID()}-${Date.now()}`)
  )
  const redisUrl = String(process.env.REDIS_URL || '').trim()
  const trustProxy = String(process.env.TRUST_PROXY || '').trim()
  const opsMetricsKey = String(process.env.OPS_METRICS_KEY || '').trim()

  const groqModel = String(process.env.GROQ_MODEL || 'llama-3.1-8b-instant').trim()
  const groqStrongModel = String(process.env.GROQ_STRONG_MODEL || groqModel).trim()

  const config = {
    nodeEnv,
    isProduction,
    port,
    frontendOrigin,
    serverBaseUrl,
    sessionSecret,
    redisUrl,
    trustProxy,
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      calendarScopes: googleCalendarScopes
    },
    groq: {
      apiKey: String(process.env.GROQ_API_KEY || '').trim(),
      model: groqModel,
      strongModel: groqStrongModel
    },
    limits: {
      freeIpHourlyLimit,
      freeUserDailyMessages,
      freeUserWeeklyTokens,
      ipSalt: process.env.RATE_LIMIT_IP_SALT || process.env.SESSION_SECRET || 'donna-rate-limit-salt'
    },
    files: {
      actionStoreFile,
      usageStoreFile
    },
    ops: {
      metricsKey: opsMetricsKey
    }
  }

  validateConfig(config)
  return config
}
