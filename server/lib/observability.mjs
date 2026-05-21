import crypto from 'node:crypto'

function nowIso() {
  return new Date().toISOString()
}

function jsonLog(payload) {
  console.log(JSON.stringify(payload))
}

function labelsKey(name, labels = {}) {
  return `${name}:${Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join(',')}`
}

function hashIdentity(value, salt) {
  const input = String(value || '').trim()
  if (!input) return null
  return crypto.createHash('sha256').update(`${salt}:${input}`).digest('hex')
}

export function createObservability(options = {}) {
  const identitySalt = String(options.identitySalt || 'donna-observability')
  const counters = new Map()

  function incrementCounter(name, labels = {}) {
    const key = labelsKey(name, labels)
    const current = counters.get(key) || { name, labels, value: 0 }
    current.value += 1
    counters.set(key, current)
  }

  function requestContext(req, res, next) {
    const requestId = req.get('x-request-id') || crypto.randomUUID()
    const start = Date.now()
    req.requestId = requestId
    res.setHeader('x-request-id', requestId)

    res.on('finish', () => {
      const userMode = String(req.session?.user?.mode || 'none')
      const userId = String(req.session?.user?.sub || '')
      const userIdHash = hashIdentity(userId, identitySalt)
      const status = res.statusCode
      const durationMs = Date.now() - start
      jsonLog({
        at: nowIso(),
        level: status >= 500 ? 'error' : 'info',
        type: 'http_request',
        requestId,
        method: req.method,
        path: req.path,
        status,
        durationMs,
        userMode,
        userIdHash
      })
      if (status >= 400) {
        incrementCounter('http_error_total', {
          path: req.path,
          method: req.method,
          status
        })
      }
    })

    return next()
  }

  function logEvent(event, req, fields = {}) {
    const userId = String(req?.session?.user?.sub || '')
    jsonLog({
      at: nowIso(),
      level: 'info',
      type: 'audit_event',
      event,
      requestId: req?.requestId || null,
      userMode: req?.session?.user?.mode || 'none',
      userIdHash: hashIdentity(userId, identitySalt),
      ...fields
    })
  }

  function logError(event, req, error, fields = {}) {
    const userId = String(req?.session?.user?.sub || '')
    const reasonCode =
      String(
        error?.details?.reasonCode ||
          error?.details?.reason ||
          error?.code ||
          fields?.reasonCode ||
          'unknown_error'
      ) || 'unknown_error'
    incrementCounter('audit_error_total', { event, reasonCode })
    jsonLog({
      at: nowIso(),
      level: 'error',
      type: 'audit_error',
      event,
      requestId: req?.requestId || null,
      userMode: req?.session?.user?.mode || 'none',
      userIdHash: hashIdentity(userId, identitySalt),
      reasonCode,
      message: String(error?.message || 'Unexpected error'),
      ...fields
    })
  }

  function metricsSnapshot() {
    return Array.from(counters.values()).sort((a, b) => a.name.localeCompare(b.name))
  }

  return {
    requestContext,
    incrementCounter,
    logEvent,
    logError,
    metricsSnapshot
  }
}
