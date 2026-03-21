import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { listAdminAuditLogs } from '../repositories/admin-audit-repository.js'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
})

export const adminRouter = Router()

adminRouter.use(requireAuth, requireRole('admin'))

adminRouter.get(
  '/audit-logs',
  asyncHandler(async (req, res) => {
    const filters = querySchema.parse(req.query)
    const logs = await listAdminAuditLogs(filters)
    res.json({ logs })
  }),
)
