import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createGrn, listGrns } from '../repositories/inventory-repository.js'

const lineSchema = z.object({
  productId: z.string().uuid(),
  batchNumber: z.string().optional().default(''),
  expiryDate: z.string().optional().default(''),
  quantity: z.coerce.number().positive(),
  unitFraction: z.coerce.number().positive().default(1),
  unitCost: z.union([z.coerce.number().nonnegative(), z.literal(''), z.null()]).optional(),
})

const grnSchema = z.object({
  partnerId: z.string().uuid(),
  deliveryRef: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  lines: z.array(lineSchema).min(1),
})

export const grnsRouter = Router()

grnsRouter.use(requireAuth)

grnsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const grns = await listGrns()
    res.json({ grns })
  }),
)

grnsRouter.post(
  '/',
  requireRole('admin', 'warehouse_manager'),
  asyncHandler(async (req, res) => {
    const payload = grnSchema.parse(req.body)
    const result = await createGrn({
      userId: req.user.sub,
      ...payload,
    })
    res.status(201).json({
      message: `GRN ${result.grnNumber} created successfully.`,
      grn: result.grn,
      grnNumber: result.grnNumber,
    })
  }),
)
