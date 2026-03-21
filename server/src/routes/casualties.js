import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, createHttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { approveCasualty, createCasualty, listCasualties, rejectCasualty } from '../repositories/inventory-repository.js'

const casualtySchema = z.object({
  batchId: z.string().uuid(),
  productId: z.string().uuid(),
  reason: z.enum(['damaged', 'expired', 'lost', 'theft', 'other']),
  quantity: z.coerce.number().positive(),
  description: z.string().optional().default(''),
})

const rejectionSchema = z.object({
  rejectionReason: z.string().min(3),
})

export const casualtiesRouter = Router()

casualtiesRouter.use(requireAuth)

casualtiesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const casualties = await listCasualties()
    res.json({ casualties })
  }),
)

casualtiesRouter.post(
  '/',
  requireRole('admin', 'warehouse_manager'),
  asyncHandler(async (req, res) => {
    const payload = casualtySchema.parse(req.body)
    const casualty = await createCasualty({ userId: req.user.sub, ...payload })
    res.status(201).json({ message: 'Casualty logged. Awaiting approval.', casualty })
  }),
)

casualtiesRouter.post(
  '/:id/approve',
  requireRole('admin', 'operations'),
  asyncHandler(async (req, res) => {
    const casualty = await approveCasualty(req.params.id, req.user.sub)
    if (!casualty) throw createHttpError(404, 'Casualty not found.')
    res.json({ message: 'Casualty approved.', casualty })
  }),
)

casualtiesRouter.post(
  '/:id/reject',
  requireRole('admin', 'operations'),
  asyncHandler(async (req, res) => {
    const payload = rejectionSchema.parse(req.body)
    const casualty = await rejectCasualty(req.params.id, req.user.sub, payload.rejectionReason)
    if (!casualty) throw createHttpError(404, 'Casualty not found.')
    res.json({ message: 'Casualty rejected.', casualty })
  }),
)
