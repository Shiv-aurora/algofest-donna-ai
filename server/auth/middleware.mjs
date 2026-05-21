export function requireAuth(_config) {
  return (req, res, next) => {
    if (!req.session?.user?.sub) {
      req.session.user = {
        sub: 'local|student',
        email: 'local@donna.app',
        name: 'Donna Local User',
        picture: ''
      }
    }

    return next()
  }
}
