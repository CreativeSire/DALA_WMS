import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, createHttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { confirmDispatch, createDispatch, listDispatches } from '../repositories/inventory-repository.js'

const lineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.coerce.number().positive(),
  unitFraction: z.coerce.number().positive().default(1),
})

const dispatchSchema = z.object({
  retailerName: z.string().min(2),
  retailerAddress: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  lines: z.array(lineSchema).min(1),
})

export const dispatchesRouter = Router()

dispatchesRouter.use(requireAuth)

dispatchesRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const dispatches = await listDispatches()
    res.json({ dispatches })
  }),
)

dispatchesRouter.post(
  '/',
  requireRole('admin', 'operations', 'warehouse_manager'),
  asyncHandler(async (req, res) => {
    const payload = dispatchSchema.parse(req.body)
    const result = await createDispatch({
      userId: req.user.sub,
      retailerName: payload.retailerName,
      retailerAddress: payload.retailerAddress,
      notes: payload.notes,
      lines: payload.lines,
    })
    res.status(201).json({
      message: `Dispatch ${result.dispatchNumber} created.`,
      dispatch: result.dispatch,
      dispatchNumber: result.dispatchNumber,
    })
  }),
)

dispatchesRouter.post(
  '/:id/confirm',
  requireRole('admin', 'security', 'operations'),
  asyncHandler(async (req, res) => {
    const dispatch = await confirmDispatch(req.params.id, req.user.sub)
    if (!dispatch) throw createHttpError(404, 'Dispatch not found.')
    res.json({ message: `Dispatch ${dispatch.dispatch_number} confirmed.`, dispatch })
  }),
)
