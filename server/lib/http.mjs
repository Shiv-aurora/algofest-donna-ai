export class HttpError extends Error {
  constructor(message, status = 500, details = null) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

function normalizeErrorMessage(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'object') {
    if (typeof value.message === 'string' && value.message.trim()) return value.message
    if (typeof value.error === 'string' && value.error.trim()) return value.error
    if (typeof value.type === 'string' && value.type.trim()) return value.type
    try {
      return JSON.stringify(value)
    } catch {
      return '[upstream_error_object]'
    }
  }
  return String(value)
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json().catch(() => ({})) : await response.text().catch(() => '')

  if (!response.ok) {
    const raw =
      (isJson && (payload?.error_description || payload?.error || payload?.message || payload)) || payload
    const message = normalizeErrorMessage(raw) || `Request failed: ${response.status}`
    throw new HttpError(message, response.status, payload)
  }

  return payload
}

export function toErrorResponse(error) {
  if (error instanceof HttpError) {
    const reasonCode =
      error.details?.reasonCode || error.details?.reason || (error.status >= 500 ? 'server_error' : 'request_error')
    const code = error.details?.code || undefined
    const loginUrl = error.details?.loginUrl || undefined
    return {
      status: error.status,
      body: {
        error: error.message,
        reasonCode,
        code,
        ...(loginUrl ? { loginUrl } : {})
      }
    }
  }

  return {
    status: 500,
    body: {
      error: error?.message || 'Unexpected server error'
    }
  }
}
