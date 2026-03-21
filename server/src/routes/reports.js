import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { getReport } from '../repositories/inventory-repository.js'

const reportParamsSchema = z.object({
  id: z.enum([
    'stock_summary',
    'abc',
    'stock_ageing',
    'movement_log',
    'dispatch_report',
    'grn_report',
    'casualty_report',
    'variance_report',
  ]),
})

const reportQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
})

export const reportsRouter = Router()

reportsRouter.use(requireAuth, requireRole('admin', 'warehouse_manager', 'operations', 'finance'))

reportsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const params = reportParamsSchema.parse(req.params)
    const filters = reportQuerySchema.parse(req.query)
    const rows = await getReport(params.id, filters)
    res.json({ rows })
  }),
)
