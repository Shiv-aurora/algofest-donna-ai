import { fetchJson, HttpError } from '../lib/http.mjs'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'

export function createGoogleOAuthService(config) {
  function isConfigured() {
    return Boolean(config.google?.clientId && config.google?.clientSecret)
  }

  function buildAuthUrl(redirectUri, state) {
    const scopes = Array.isArray(config.google.calendarScopes)
      ? config.google.calendarScopes
      : [
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.events'
        ]

    const params = new URLSearchParams({
      client_id: config.google.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      state
    })

    return `${GOOGLE_AUTH_URL}?${params.toString()}`
  }

  async function exchangeCode(code, redirectUri) {
    const payload = await fetchJson(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    })

    if (!payload?.access_token) {
      throw new HttpError('Google OAuth did not return an access token.', 502, payload)
    }

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || null,
      expiresIn: Number(payload.expires_in || 3600),
      scope: payload.scope || '',
      tokenType: payload.token_type || 'Bearer'
    }
  }

  async function refreshAccessToken(refreshToken) {
    if (!refreshToken) {
      throw new HttpError('No Google refresh token available. Please reconnect Google Calendar.', 401)
    }

    const payload = await fetchJson(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        grant_type: 'refresh_token'
      }).toString()
    })

    if (!payload?.access_token) {
      throw new HttpError('Google token refresh failed. Please reconnect Google Calendar.', 401, payload)
    }

    return {
      accessToken: payload.access_token,
      expiresIn: Number(payload.expires_in || 3600),
      scope: payload.scope || ''
    }
  }

  function saveGoogleTokens(session, tokens) {
    const expiresAt = Math.floor(Date.now() / 1000) + (tokens.expiresIn || 3600)
    session.googleTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken || session.googleTokens?.refreshToken || null,
      expiresAt,
      scope: tokens.scope || ''
    }
  }

  async function getValidAccessToken(session) {
    const stored = session.googleTokens
    if (!stored?.accessToken) {
      throw new HttpError('Google Calendar not connected. Please connect in Settings.', 401)
    }

    const nowEpoch = Math.floor(Date.now() / 1000)
    // Refresh if token expires within 60 seconds
    if (Number(stored.expiresAt || 0) > nowEpoch + 60) {
      return stored.accessToken
    }

    const refreshed = await refreshAccessToken(stored.refreshToken)
    saveGoogleTokens(session, { ...refreshed, refreshToken: stored.refreshToken })
    return refreshed.accessToken
  }

  function clearGoogleTokens(session) {
    delete session.googleTokens
  }

  function isGoogleConnected(session) {
    return Boolean(session.googleTokens?.accessToken)
  }

  return {
    isConfigured,
    buildAuthUrl,
    exchangeCode,
    saveGoogleTokens,
    getValidAccessToken,
    clearGoogleTokens,
    isGoogleConnected
  }
}
