import 'dotenv/config'
import path from 'node:path'

function parseNumber(value, fallback) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseBoolean(value, fallback = false) {
  if (typeof value !== 'string') return fallback
  const normalized = value.trim().toLowerCase()
  if (!normalized) return fallback
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on'
}

function parseList(value, fallback) {
  if (!value) return fallback
  return value
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function loadEnv() {
  const port = parseNumber(process.env.CONNECTIVITY_PORT, 8787)
  const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173'
  const serverBaseUrl = process.env.SERVER_BASE_URL || `http://localhost:${port}`
  const googleCalendarScopes = parseList(process.env.GOOGLE_CALENDAR_SCOPES, [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events'
  ])
  const actionStoreFile =
    process.env.DONNA_ACTION_STORE_FILE || path.resolve(process.cwd(), 'server/data/action-log.json')

  return {
    port,
    frontendOrigin,
    serverBaseUrl,
    sessionSecret: process.env.SESSION_SECRET || 'donna-dev-session-secret-change-me',
    demoMode: parseBoolean(process.env.DONNA_DEMO_MODE, false),
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      calendarScopes: googleCalendarScopes
    },
    files: {
      actionStoreFile
    }
  }
}
