const API_BASE = import.meta.env.VITE_CONNECTIVITY_API_BASE || 'http://localhost:8787'

export class ConnectivityApiError extends Error {
  constructor(message, status = 500, details = {}) {
    super(message)
    this.name = 'ConnectivityApiError'
    this.status = status
    this.details = details
    this.loginUrl = details?.loginUrl || null
    this.code = details?.code || null
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    credentials: 'include',
    ...options
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status})`
    throw new ConnectivityApiError(message, response.status, data)
  }

  return data
}

export function fetchProviders() {
  return request('/api/connectivity/providers')
}

export function connectProviderApi(provider, payload = {}) {
  const returnTo = typeof window !== 'undefined' ? window.location.href : ''
  return request(`/api/connectivity/${provider}/connect`, {
    method: 'POST',
    headers: returnTo ? { 'x-return-to': returnTo } : undefined,
    body: JSON.stringify({
      ...payload,
      ...(returnTo ? { returnTo } : {})
    })
  })
}

export function disconnectProviderApi(provider) {
  return request(`/api/connectivity/${provider}/disconnect`, {
    method: 'POST'
  })
}

export function syncProviderApi(provider) {
  return request(`/api/connectivity/${provider}/sync`, {
    method: 'POST'
  })
}

export function getAuthMe() {
  return request('/api/auth/me')
}

export function logoutAuth(payload = {}) {
  return request('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getDonnaCalendarContext() {
  return request('/api/donna/calendar/context')
}

export function listDonnaActions() {
  return request('/api/donna/actions')
}

export function proposeStudyBlock(payload) {
  return request('/api/donna/actions/propose-study-block', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function approveDonnaAction(actionId) {
  return request(`/api/donna/actions/${actionId}/approve`, {
    method: 'POST'
  })
}
