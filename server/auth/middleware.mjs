export function requireAuth(config) {
  return (req, res, next) => {
    if (!req.session?.user?.sub) {
      const fallbackReturnTo = `${config.frontendOrigin}/login`
      const requestedReturnTo =
        String(req.get('x-return-to') || req.query?.returnTo || req.body?.returnTo || '').trim() ||
        fallbackReturnTo
      const loginUrl = `${config.frontendOrigin}/login?returnTo=${encodeURIComponent(requestedReturnTo)}`
      return res.status(401).json({
        error: 'Authentication required.',
        code: 'AUTH_REQUIRED',
        reason: 'login_required',
        reasonCode: 'login_required',
        loginUrl
      })
    }

    return next()
  }
}
