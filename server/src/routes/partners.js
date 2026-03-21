import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler, createHttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createPartner, listPartners, updatePartner } from '../repositories/partners-repository.js'
import { getPartnerDetail, listPartnerSummaries } from '../repositories/inventory-repository.js'

const partnerSchema = z.object({
  name: z.string().min(2),
  contact_name: z.string().optional().default(''),
  contact_email: z.string().email().optional().or(z.literal('')).default(''),
  contact_phone: z.string().optional().default(''),
  is_active: z.boolean().optional(),
})

export const partnersRouter = Router()

partnersRouter.use(requireAuth)

partnersRouter.get(
  '/summary',
  requireRole('admin', 'operations', 'finance'),
  asyncHandler(async (_req, res) => {
    const partners = await listPartnerSummaries()
    res.json({ partners })
  }),
)

partnersRouter.get(
  '/:id/detail',
  requireRole('admin', 'operations', 'finance'),
  asyncHandler(async (req, res) => {
    const detail = await getPartnerDetail(req.params.id)
    res.json(detail)
  }),
)

partnersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const partners = await listPartners()
    res.json({ partners })
  }),
)

partnersRouter.post(
  '/',
  requireRole('admin', 'operations'),
  asyncHandler(async (req, res) => {
    const payload = partnerSchema.parse(req.body)
    const partner = await createPartner(payload)
    res.status(201).json({ partner })
  }),
)

partnersRouter.patch(
  '/:id',
  requireRole('admin', 'operations'),
  asyncHandler(async (req, res) => {
    const payload = partnerSchema.parse(req.body)
    const partner = await updatePartner(req.params.id, payload)

    if (!partner) {
      throw createHttpError(404, 'Brand partner not found.')
    }

    res.json({ partner })
  }),
)
