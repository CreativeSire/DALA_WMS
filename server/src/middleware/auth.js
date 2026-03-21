import { AUTH_COOKIE_NAME, verifyAuthToken } from '../lib/auth.js'
import { createHttpError } from '../lib/http.js'

export function requireAuth(req, _res, next) {
  const authHeader = req.get('authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const token = req.cookies[AUTH_COOKIE_NAME] || bearerToken

  if (!token) {
    return next(createHttpError(401, 'Authentication required.'))
  }

  try {
    const payload = verifyAuthToken(token)
    req.user = payload
    return next()
  } catch (_error) {
    return next(createHttpError(401, 'Invalid or expired session.'))
  }
}

export function requireRole(...roles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) {
      return next(createHttpError(401, 'Authentication required.'))
    }

    if (!roles.includes(req.user.role)) {
      return next(createHttpError(403, 'You do not have permission to perform this action.'))
    }

    return next()
  }
}
