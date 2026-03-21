import { ZodError } from 'zod'

export function notFoundHandler(_req, _res, next) {
  const error = new Error('Route not found.')
  error.status = 404
  next(error)
}

export function errorHandler(error, _req, res, _next) {
  let status = error.status || 500
  const body = {
    error: error.message || 'Unexpected error.',
  }

  if (error instanceof ZodError) {
    status = 400
    body.error = 'Validation failed.'
    body.details = error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }))
  } else if (error.code === '23505') {
    status = 409
    body.error = 'A record with the same unique value already exists.'
    body.details = error.detail
  } else if (error.code === '23503') {
    status = 400
    body.error = 'A referenced record does not exist.'
    body.details = error.detail
  }

  if (error.details) {
    body.details = error.details
  }

  if (status >= 500 && process.env.NODE_ENV !== 'production' && error.stack) {
    body.stack = error.stack
  }

  res.status(status).json(body)
}
