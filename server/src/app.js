import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { authRouter } from './routes/auth.js'
import { healthRouter } from './routes/health.js'
import { partnersRouter } from './routes/partners.js'
import { productsRouter } from './routes/products.js'
import { usersRouter } from './routes/users.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'

export function createApp() {
  const app = express()

  app.use(helmet())
  app.use(
    cors({
      origin: env.FRONTEND_ORIGIN,
      credentials: true,
    }),
  )
  app.use(compression())
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  app.get('/', (_req, res) => {
    res.json({
      service: 'dala-wms-server',
      docs: {
        health: '/health',
        auth: '/auth',
        users: '/api/users',
        partners: '/api/partners',
        products: '/api/products',
      },
    })
  })

  app.use('/health', healthRouter)
  app.use('/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/partners', partnersRouter)
  app.use('/api/products', productsRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
