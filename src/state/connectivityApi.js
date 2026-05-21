const API_BASE = import.meta.env.VITE_CONNECTIVITY_API_BASE || 'http://localhost:8787'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = data?.error || `Request failed (${response.status})`
    throw new Error(message)
  }

  return data
}

export function fetchProviders() {
  return request('/api/connectivity/providers')
}

export function connectProviderApi(provider, payload = {}) {
  return request(`/api/connectivity/${provider}/connect`, {
    method: 'POST',
    body: JSON.stringify(payload)
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

