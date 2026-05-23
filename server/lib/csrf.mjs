import crypto from 'node:crypto'

import { HttpError } from './http.mjs'

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const EXCLUDED_PATHS = new Set(['/health'])
const CSRF_COOKIE = 'donna.csrf'

function createToken() {
  return crypto.randomBytes(32).toString('hex')
}

function parseCookies(header = '') {
  const cookies = {}
  for (const part of String(header || '').split(';')) {
    const [rawName, ...rawValue] = part.trim().split('=')
    if (!rawName || rawValue.length === 0) continue
    cookies[rawName] = decodeURIComponent(rawValue.join('='))
  }
  return cookies
}

function signToken(token, secret) {
  return crypto.createHmac('sha256', secret).update(token).digest('base64url')
}

function verifySignedToken(value, secret) {
  const [token, signature] = String(value || '').split('.')
  if (!token || !signature) return ''
  const expected = signToken(token, secret)
  const receivedBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (receivedBuffer.length !== expectedBuffer.length) return ''
  if (!crypto.timingSafeEqual(receivedBuffer, expectedBuffer)) return ''
  return token
}

function getCookieToken(req, config) {
  const cookies = parseCookies(req.headers?.cookie)
  return verifySignedToken(cookies[CSRF_COOKIE], config.sessionSecret)
}

function setCookieToken(res, token, config) {
  res.cookie(CSRF_COOKIE, `${token}.${signToken(token, config.sessionSecret)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000
  })
}

function getHeaderToken(req) {
  const direct = req.get('x-csrf-token')
  if (direct) return String(direct).trim()
  const alt = req.get('x-donna-csrf')
  if (alt) return String(alt).trim()
  return ''
}

export function ensureCsrfToken(req, res, config) {
  const cookieToken = config ? getCookieToken(req, config) : ''
  if (!req.session.csrfToken && cookieToken) {
    req.session.csrfToken = cookieToken
  }
  if (!req.session.csrfToken) {
    req.session.csrfToken = createToken()
  }
  if (res && config) {
    setCookieToken(res, req.session.csrfToken, config)
  }
  return req.session.csrfToken
}

export function createCsrfProtection(config) {
  return (req, _res, next) => {
    if (!req.path.startsWith('/api/')) return next()
    if (EXCLUDED_PATHS.has(req.path) || SAFE_METHODS.has(req.method)) return next()

    const origin = String(req.get('origin') || '').trim()
    const referer = String(req.get('referer') || '').trim()
    const allowed = Array.isArray(config.allowedOrigins) ? config.allowedOrigins : [config.frontendOrigin]
    if (origin && !allowed.includes(origin)) {
      return next(new HttpError('CSRF validation failed.', 403, { reasonCode: 'csrf_invalid_origin' }))
    }
    if (!origin && referer) {
      try {
        const refererOrigin = new URL(referer).origin
        if (!allowed.includes(refererOrigin)) {
          return next(new HttpError('CSRF validation failed.', 403, { reasonCode: 'csrf_invalid_origin' }))
        }
      } catch {
        return next(new HttpError('CSRF validation failed.', 403, { reasonCode: 'csrf_invalid_origin' }))
      }
    }

    const expected = req.session?.csrfToken || getCookieToken(req, config)
    const received = getHeaderToken(req)
    if (!received || received !== expected) {
      return next(new HttpError('CSRF token missing or invalid.', 403, { reasonCode: 'csrf_invalid_token' }))
    }
    return next()
  }
}
