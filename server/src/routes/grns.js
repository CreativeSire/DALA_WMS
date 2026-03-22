import { Router } from 'express'
import { z } from 'zod'
import { asyncHandler } from '../lib/http.js'
import { suggestGrnFromDocument } from '../lib/document-capture.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createGrn, listGrns } from '../repositories/inventory-repository.js'
import { listPartners } from '../repositories/partners-repository.js'
import { listProducts } from '../repositories/products-repository.js'

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

const documentSuggestionSchema = z.object({
  documentText: z.string().optional().default(''),
  fileData: z.string().optional().default(''),
  mimeType: z.string().optional().default(''),
  fileName: z.string().optional().default(''),
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
  '/document-suggestions',
  requireRole('admin', 'warehouse_manager'),
  asyncHandler(async (req, res) => {
    const payload = documentSuggestionSchema.parse(req.body)
    const [products, partners] = await Promise.all([listProducts(), listPartners()])
    const suggestions = await suggestGrnFromDocument({
      ...payload,
      products: products.filter((product) => product.is_active),
      partners: partners.filter((partner) => partner.is_active),
    })
    res.json(suggestions)
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
