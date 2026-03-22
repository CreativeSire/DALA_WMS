import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import {
  getCurrentStock,
  getDashboardData,
  getExpiryAlerts,
  getMovements,
  getMoveFirstBatchAlerts,
  getOpsSummary,
  getReorderAlerts,
  listAvailableBatches,
  refreshBatchStatuses,
} from '../repositories/inventory-repository.js'

const movementQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(5000).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const inventoryRouter = Router()

inventoryRouter.use(requireAuth)

inventoryRouter.get(
  '/dashboard',
  asyncHandler(async (_req, res) => {
    const dashboard = await getDashboardData()
    res.json(dashboard)
  }),
)

inventoryRouter.get(
  '/stock/current',
  asyncHandler(async (_req, res) => {
    const stock = await getCurrentStock()
    res.json({ stock })
  }),
)

inventoryRouter.get(
  '/movements',
  asyncHandler(async (req, res) => {
    const filters = movementQuerySchema.parse(req.query)
    const movements = await getMovements(filters)
    res.json({ movements })
  }),
)

inventoryRouter.get(
  '/reorder-alerts',
  asyncHandler(async (_req, res) => {
    const alerts = await getReorderAlerts()
    res.json({ alerts })
  }),
)

inventoryRouter.get(
  '/move-first',
  asyncHandler(async (_req, res) => {
    const batches = await getMoveFirstBatchAlerts()
    res.json({ batches })
  }),
)

inventoryRouter.get(
  '/expiry-alerts',
  asyncHandler(async (_req, res) => {
    const alerts = await getExpiryAlerts()
    res.json({ alerts })
  }),
)

inventoryRouter.post(
  '/expiry-alerts/refresh',
  asyncHandler(async (_req, res) => {
    await refreshBatchStatuses()
    res.json({ message: 'Expiry statuses refreshed.' })
  }),
)

inventoryRouter.get(
  '/ops-summary',
  asyncHandler(async (_req, res) => {
    const summary = await getOpsSummary()
    res.json(summary)
  }),
)

inventoryRouter.get(
  '/products/:productId/batches/available',
  asyncHandler(async (req, res) => {
    const batches = await listAvailableBatches(req.params.productId)
    res.json({ batches })
  }),
)
