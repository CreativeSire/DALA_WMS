import { Router } from 'express'
import { z } from 'zod'
import { query } from '../lib/db.js'
import { asyncHandler, createHttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createProduct, listProducts, updateProduct } from '../repositories/products-repository.js'

const productSchema = z.object({
  brand_partner_id: z.string().uuid(),
  sku_code: z.string().min(2),
  name: z.string().min(2),
  category: z.string().optional().default(''),
  unit_type: z.enum(['carton', 'piece', 'bag', 'crate']),
  allows_fractions: z.boolean(),
  reorder_threshold: z.coerce.number().min(0),
  expiry_alert_days: z.coerce.number().int().min(1).max(3650),
  is_active: z.boolean().optional(),
})

const thresholdSchema = z.object({
  reorder_threshold: z.coerce.number().min(0),
})

const expiryThresholdSchema = z.object({
  expiry_alert_days: z.coerce.number().int().min(1).max(3650),
})

export const productsRouter = Router()

productsRouter.use(requireAuth, requireRole('admin', 'warehouse_manager', 'operations'))

productsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const products = await listProducts()
    res.json({ products })
  }),
)

productsRouter.patch(
  '/:id/reorder-threshold',
  asyncHandler(async (req, res) => {
    const payload = thresholdSchema.parse(req.body)
    const { rows } = await query(
      `
        UPDATE products
        SET reorder_threshold = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [req.params.id, payload.reorder_threshold],
    )

    if (!rows[0]) {
      throw createHttpError(404, 'Product not found.')
    }

    res.json({ product: rows[0] })
  }),
)

productsRouter.patch(
  '/:id/expiry-alert-days',
  asyncHandler(async (req, res) => {
    const payload = expiryThresholdSchema.parse(req.body)
    const { rows } = await query(
      `
        UPDATE products
        SET expiry_alert_days = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [req.params.id, payload.expiry_alert_days],
    )

    if (!rows[0]) {
      throw createHttpError(404, 'Product not found.')
    }

    res.json({ product: rows[0] })
  }),
)

productsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = productSchema.parse(req.body)
    const product = await createProduct(payload)
    res.status(201).json({ product })
  }),
)

productsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const payload = productSchema.parse(req.body)
    const product = await updateProduct(req.params.id, payload)

    if (!product) {
      throw createHttpError(404, 'Product not found.')
    }

    res.json({ product })
  }),
)
