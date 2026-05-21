export class HttpError extends Error {
  constructor(message, status = 500, details = null) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.details = details
  }
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  const contentType = response.headers.get('content-type') || ''
  const isJson = contentType.includes('application/json')
  const payload = isJson ? await response.json().catch(() => ({})) : await response.text().catch(() => '')

  if (!response.ok) {
    const message =
      (isJson && (payload?.error_description || payload?.error || payload?.message)) ||
      `Request failed: ${response.status}`
    throw new HttpError(message, response.status, payload)
  }

  return payload
}

export function toErrorResponse(error) {
  if (error instanceof HttpError) {
    return {
      status: error.status,
      body: {
        error: error.message,
        details: error.details || undefined
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
