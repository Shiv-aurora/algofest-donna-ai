import crypto from 'node:crypto'

import { HttpError } from './http.mjs'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const EXCLUDED_PATHS = new Set(['/health'])

function createToken() {
  return crypto.randomBytes(32).toString('hex')
}

function getHeaderToken(req) {
  const direct = req.get('x-csrf-token')
  if (direct) return String(direct).trim()
  const alt = req.get('x-donna-csrf')
  if (alt) return String(alt).trim()
  return ''
}

export function ensureCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = createToken()
  }
  return req.session.csrfToken
}

export function createCsrfProtection(config) {
  return (req, _res, next) => {
    if (!req.path.startsWith('/api/')) return next()
    if (EXCLUDED_PATHS.has(req.path) || SAFE_METHODS.has(req.method)) return next()

    const origin = String(req.get('origin') || '').trim()
    const referer = String(req.get('referer') || '').trim()
    const expectedOrigin = config.frontendOrigin
    if (origin && origin !== expectedOrigin) {
      return next(new HttpError('CSRF validation failed.', 403, { reasonCode: 'csrf_invalid_origin' }))
    }
    if (!origin && referer) {
      try {
        const refererOrigin = new URL(referer).origin
        if (refererOrigin !== expectedOrigin) {
          return next(new HttpError('CSRF validation failed.', 403, { reasonCode: 'csrf_invalid_origin' }))
        }
      } catch {
        return next(new HttpError('CSRF validation failed.', 403, { reasonCode: 'csrf_invalid_origin' }))
      }
    }

    const expected = ensureCsrfToken(req)
    const received = getHeaderToken(req)
    if (!received || received !== expected) {
      return next(new HttpError('CSRF token missing or invalid.', 403, { reasonCode: 'csrf_invalid_token' }))
    }
    return next()
  }
}
