const API_BASE =
  import.meta.env.VITE_CONNECTIVITY_API_BASE || (import.meta.env.DEV ? 'http://localhost:8787' : '')
let csrfToken = ''
let csrfTokenPromise = null

export class ConnectivityApiError extends Error {
  constructor(message, status = 500, details = {}) {
    super(message)
    this.name = 'ConnectivityApiError'
    this.status = status
    this.details = details
    this.loginUrl = details?.loginUrl || null
    this.code = details?.code || details?.reasonCode || null
  }
}

function isUnsafeMethod(method = 'GET') {
  const normalized = String(method || 'GET').toUpperCase()
  return !['GET', 'HEAD', 'OPTIONS'].includes(normalized)
}

function buildUrl(path) {
  if (!API_BASE) return path
  return `${API_BASE}${path}`
}

async function fetchCsrfToken() {
  let response
  try {
    response = await fetch(buildUrl('/api/auth/csrf'), {
      method: 'GET',
      credentials: 'include'
    })
  } catch (error) {
    throw new ConnectivityApiError('Backend unavailable. Start API server on localhost:8787.', 0, {
      code: 'BACKEND_UNAVAILABLE',
      reason: 'backend_unavailable',
      cause: String(error?.message || '')
    })
  }
  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.csrfToken) {
    throw new ConnectivityApiError('Unable to establish secure session. Refresh and try again.', response.status || 500, {
      reasonCode: data?.reasonCode || 'csrf_bootstrap_failed'
    })
  }
  csrfToken = String(data.csrfToken)
  return csrfToken
}

async function getCsrfToken() {
  if (csrfToken) return csrfToken
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchCsrfToken().finally(() => {
      csrfTokenPromise = null
    })
  }
  return csrfTokenPromise
}

async function request(path, options = {}, retryWithFreshCsrf = true) {
  const method = String(options.method || 'GET').toUpperCase()
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  }

  if (isUnsafeMethod(method)) {
    const token = await getCsrfToken()
    headers['x-csrf-token'] = token
  }

  let response
  try {
    response = await fetch(buildUrl(path), {
      headers,
      credentials: 'include',
      method,
      ...options
    })
  } catch (error) {
    throw new ConnectivityApiError('Backend unavailable. Start API server on localhost:8787.', 0, {
      code: 'BACKEND_UNAVAILABLE',
      reason: 'backend_unavailable',
      cause: String(error?.message || '')
    })
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (
      retryWithFreshCsrf &&
      isUnsafeMethod(method) &&
      Number(response.status) === 403 &&
      (data?.reasonCode === 'csrf_invalid_token' || data?.reasonCode === 'csrf_invalid_origin')
    ) {
      csrfToken = ''
      await getCsrfToken()
      return request(path, options, false)
    }

    const message = data?.error || data?.message || `Request failed (${response.status})`
    throw new ConnectivityApiError(message, response.status, data)
  }

  return data
}

export function fetchProviders() {
  return request('/api/connectivity/providers')
}

export async function checkBackendHealth() {
  try {
    await request('/health', { method: 'GET' })
    return true
  } catch {
    return false
  }
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

export function connectLmsApi(payload = {}) {
  return request('/api/connectivity/lms/connect', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function syncLmsApi(payload = {}) {
  return request('/api/connectivity/lms/sync', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getLmsStatusApi(provider = '') {
  const qs = provider ? `?provider=${encodeURIComponent(provider)}` : ''
  return request(`/api/connectivity/lms/status${qs}`)
}

export function disconnectLmsApi(provider) {
  return request('/api/connectivity/lms/connect', {
    method: 'DELETE',
    body: JSON.stringify({ provider })
  })
}

export function getAuthMe() {
  return request('/api/auth/me')
}

export function buildGoogleLoginUrl(returnTo = '') {
  const base = buildUrl('/api/auth/google/start')
  const target = new URL(base, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
  if (returnTo) target.searchParams.set('returnTo', returnTo)
  return target.toString()
}

export function loginGuest(payload = {}) {
  return request('/api/auth/guest-login', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function loginDemo(payload = {}) {
  return request('/api/auth/demo-login', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
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

export function runDonnaPlannerApi(payload = {}) {
  return request('/api/donna/planner', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getDonnaPlannerUsage() {
  return request('/api/donna/planner/usage')
}

export function ingestSyllabusV2(payload) {
  return request('/api/v2/syllabus/ingest', {
    method: 'POST',
    body: JSON.stringify(payload || {})
  })
}

export function solvePlanV2(payload) {
  return request('/api/v2/plan/solve', {
    method: 'POST',
    body: JSON.stringify(payload || {})
  })
}

export function feasibilityPlanV2(payload) {
  return request('/api/v2/plan/feasibility', {
    method: 'POST',
    body: JSON.stringify(payload || {})
  })
}

export function reoptimizePlanV2(payload) {
  return request('/api/v2/plan/reoptimize', {
    method: 'POST',
    body: JSON.stringify(payload || {})
  })
}

export function notifyDecisionV2(payload) {
  return request('/api/v2/notify/decision', {
    method: 'POST',
    body: JSON.stringify(payload || {})
  })
}

export function benchmarkMetricsV2() {
  return request('/api/v2/metrics/benchmark')
}

export function logWorkEventV2(payload) {
  return request('/api/v2/events/work', {
    method: 'POST',
    body: JSON.stringify(payload || {})
  })
}
