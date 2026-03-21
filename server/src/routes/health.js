import { Router } from 'express'
import { asyncHandler } from '../lib/http.js'
import { query } from '../lib/db.js'

export const healthRouter = Router()

healthRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    await query('SELECT 1')
    res.json({
      ok: true,
      service: 'dala-wms-server',
      timestamp: new Date().toISOString(),
    })
  }),
)
