import compression from 'compression'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { authRouter } from './routes/auth.js'
import { adminRouter } from './routes/admin.js'
import { casualtiesRouter } from './routes/casualties.js'
import { countsRouter } from './routes/counts.js'
import { dispatchesRouter } from './routes/dispatches.js'
import { grnsRouter } from './routes/grns.js'
import { healthRouter } from './routes/health.js'
import { inventoryRouter } from './routes/inventory.js'
import { partnersRouter } from './routes/partners.js'
import { productsRouter } from './routes/products.js'
import { reportsRouter } from './routes/reports.js'
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
        inventory: '/api/inventory',
        trends: '/api/inventory/trends',
        moveFirst: '/api/inventory/move-first',
        opsSummary: '/api/inventory/ops-summary',
        opsSummaryPreferences: '/api/inventory/ops-summary/preferences',
        grns: '/api/grns',
        grnDocumentSuggestions: '/api/grns/document-suggestions',
        dispatches: '/api/dispatches',
        dispatchAnalyze: '/api/dispatches/analyze',
        casualties: '/api/casualties',
        counts: '/api/count-sessions',
        countInsights: '/api/count-sessions/:id/insights',
        reports: '/api/reports/:id',
        adminAudit: '/api/admin/audit-logs',
      },
    })
  })

  app.use('/health', healthRouter)
  app.use('/auth', authRouter)
  app.use('/api/users', usersRouter)
  app.use('/api/partners', partnersRouter)
  app.use('/api/products', productsRouter)
  app.use('/api/inventory', inventoryRouter)
  app.use('/api/grns', grnsRouter)
  app.use('/api/dispatches', dispatchesRouter)
  app.use('/api/casualties', casualtiesRouter)
  app.use('/api/count-sessions', countsRouter)
  app.use('/api/reports', reportsRouter)
  app.use('/api/admin', adminRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
