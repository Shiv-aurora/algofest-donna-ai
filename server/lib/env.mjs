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

function toAbsoluteOrigin(value) {
  const candidate = String(value || '').trim()
  if (!candidate) return ''
  try {
    return new URL(candidate).origin
  } catch {
    return ''
  }
}

function getVercelOrigin() {
  const vercelUrl = String(process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '').trim()
  if (!vercelUrl) return ''
  return toAbsoluteOrigin(vercelUrl.startsWith('http') ? vercelUrl : `https://${vercelUrl}`)
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

  if (isProduction && config.sessionSecret.length < 32) {
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

  // In production, Google OAuth and Redis are optional for hackathon/demo deployments.
  // OAuth routes and Redis-backed sessions are enabled only when those env vars are present.

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

  if (config.algo?.baseUrl) {
    try {
      const algo = new URL(config.algo.baseUrl)
      if (!['http:', 'https:'].includes(algo.protocol)) {
        errors.push('ALGO_SERVICE_BASE_URL must use http or https.')
      }
    } catch {
      errors.push('ALGO_SERVICE_BASE_URL must be a valid absolute URL.')
    }
  }

  if (config.ollama?.baseUrl) {
    try {
      const ollama = new URL(config.ollama.baseUrl)
      if (!['http:', 'https:'].includes(ollama.protocol)) {
        errors.push('OLLAMA_BASE_URL must use http or https.')
      }
    } catch {
      errors.push('OLLAMA_BASE_URL must be a valid absolute URL.')
    }
  }

  if (!Number.isFinite(config.ollama?.timeoutMs) || config.ollama.timeoutMs <= 0) {
    errors.push('OLLAMA_TIMEOUT_MS must be greater than 0.')
  }

  if (errors.length > 0) {
    throw new Error(`Invalid server configuration:\n- ${errors.join('\n- ')}`)
  }
}

export function loadEnv() {
  const nodeEnv = process.env.NODE_ENV || 'development'
  const isProduction = nodeEnv === 'production'
  const port = parseNumber(process.env.CONNECTIVITY_PORT, 8787)
  const frontendOrigins = parseList(process.env.FRONTEND_ORIGIN, [])
    .map(toAbsoluteOrigin)
    .filter(Boolean)
  const vercelOrigin = getVercelOrigin()
  const frontendOrigin = frontendOrigins[0] || vercelOrigin || 'http://localhost:5173'
  const serverBaseUrl = sanitizeBaseUrl(process.env.SERVER_BASE_URL, vercelOrigin || `http://localhost:${port}`)

  // Build the full set of allowed CORS origins.
  // Supports comma-separated values in FRONTEND_ORIGIN, and always includes
  // the server's own origin so same-domain Vercel deployments work without
  // needing a separate env var.
  const allowedOrigins = [
    ...(frontendOrigins.length > 0 ? frontendOrigins : [frontendOrigin]),
    sanitizeBaseUrl(serverBaseUrl, '')
  ].filter(Boolean).filter((o, i, arr) => arr.indexOf(o) === i)
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
  const sessionSecret = String(process.env.SESSION_SECRET || `donna-${nodeEnv}-${crypto.randomUUID()}-${Date.now()}`)
  const redisUrl = String(process.env.REDIS_URL || '').trim()
  const trustProxy = String(process.env.TRUST_PROXY || '').trim()
  const opsMetricsKey = String(process.env.OPS_METRICS_KEY || '').trim()

  const groqModel = String(process.env.GROQ_MODEL || 'llama-3.1-8b-instant').trim()
  const groqStrongModel = String(process.env.GROQ_STRONG_MODEL || groqModel).trim()
  const ollamaBaseUrl = String(process.env.OLLAMA_BASE_URL || 'http://localhost:11434').trim()
  const ollamaModel = String(process.env.OLLAMA_MODEL || 'gemma3:4b').trim()
  const ollamaTimeoutMs = parseNumber(process.env.OLLAMA_TIMEOUT_MS, 12000)
  const algoBaseUrl = String(process.env.ALGO_SERVICE_BASE_URL || 'http://localhost:8090').trim()
  const algoTimeoutMs = parseNumber(process.env.ALGO_SERVICE_TIMEOUT_MS, 1500)
  const postgresUrl = String(process.env.POSTGRES_URL || '').trim()

  const config = {
    nodeEnv,
    isProduction,
    port,
    frontendOrigin,
    allowedOrigins,
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
    ollama: {
      baseUrl: ollamaBaseUrl,
      model: ollamaModel,
      timeoutMs: ollamaTimeoutMs
    },
    algo: {
      baseUrl: algoBaseUrl,
      timeoutMs: algoTimeoutMs
    },
    postgres: {
      url: postgresUrl
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
