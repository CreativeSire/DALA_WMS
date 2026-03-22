import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, createHttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import {
  approveCountSession,
  createCountSession,
  getCountSessionDetail,
  listCountSessions,
  submitCountSession,
  updateCountLine,
} from '../repositories/inventory-repository.js'

const createSessionSchema = z.object({
  notes: z.string().optional().default(''),
})

const updateLineSchema = z.object({
  countedQuantity: z.union([z.coerce.number().nonnegative(), z.null()]).optional(),
  varianceNote: z.string().optional(),
})

export const countsRouter = Router()

countsRouter.use(requireAuth)

countsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const sessions = await listCountSessions()
    res.json({ sessions })
  }),
)

countsRouter.post(
  '/',
  requireRole('admin', 'warehouse_manager', 'operations'),
  asyncHandler(async (req, res) => {
    const payload = createSessionSchema.parse(req.body)
    const result = await createCountSession({ userId: req.user.sub, notes: payload.notes })
    res.status(201).json({
      message: `Count session ${result.sessionRef} opened with ${result.lineCount} SKUs.`,
      session: result.session,
      sessionRef: result.sessionRef,
    })
  }),
)

countsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const detail = await getCountSessionDetail(req.params.id)
    res.json(detail)
  }),
)

countsRouter.get(
  '/:id/insights',
  asyncHandler(async (req, res) => {
    const detail = await getCountSessionDetail(req.params.id)
    res.json({ insights: detail.insights || [] })
  }),
)

countsRouter.patch(
  '/lines/:id',
  requireRole('admin', 'warehouse_manager', 'operations'),
  asyncHandler(async (req, res) => {
    const payload = updateLineSchema.parse(req.body)
    const line = await updateCountLine(req.params.id, {
      countedQuantity: payload.countedQuantity,
      varianceNote: payload.varianceNote,
      userId: req.user.sub,
    })
    if (!line) throw createHttpError(404, 'Count line not found.')
    res.json({ line })
  }),
)

countsRouter.post(
  '/:id/submit',
  requireRole('admin', 'warehouse_manager', 'operations'),
  asyncHandler(async (req, res) => {
    const session = await submitCountSession(req.params.id, req.user.sub)
    if (!session) throw createHttpError(404, 'Count session not found.')
    res.json({ message: 'Count session submitted for approval.', session })
  }),
)

countsRouter.post(
  '/:id/approve',
  requireRole('admin', 'operations'),
  asyncHandler(async (req, res) => {
    const result = await approveCountSession(req.params.id, req.user.sub)
    res.json({
      message: `Session approved. ${result.appliedAdjustments} adjustments applied to ledger.`,
    })
  }),
)
