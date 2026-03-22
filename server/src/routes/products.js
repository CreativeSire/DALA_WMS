import { Router } from 'express'
import { z } from 'zod'
import { query } from '../lib/db.js'
import { asyncHandler, createHttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createProduct, listProducts, listSkuClassSettings, updateProduct, updateSkuClassSetting } from '../repositories/products-repository.js'

const skuClassEnum = z.enum(['fast_mover', 'regular', 'controlled', 'seasonal'])
const productSchema = z.object({
  brand_partner_id: z.string().uuid(),
  sku_code: z.string().min(2),
  name: z.string().min(2),
  category: z.string().optional().default(''),
  sku_class: skuClassEnum.default('regular'),
  unit_type: z.enum(['carton', 'piece', 'bag', 'crate']),
  allows_fractions: z.boolean(),
  reorder_threshold: z.coerce.number().min(0),
  expiry_alert_days: z.coerce.number().int().min(1).max(3650),
  is_active: z.boolean().optional(),
})

const skuClassSettingSchema = z.object({
  average_multiplier_high: z.coerce.number().min(1),
  average_multiplier_medium: z.coerce.number().min(1),
  average_multiplier_low: z.coerce.number().min(1),
  highest_multiplier_high: z.coerce.number().min(1),
  highest_multiplier_medium: z.coerce.number().min(1),
  minimum_history_count: z.coerce.number().int().min(1).max(90),
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

productsRouter.get(
  '/ai-classes',
  asyncHandler(async (_req, res) => {
    const classes = await listSkuClassSettings()
    res.json({ classes })
  }),
)

productsRouter.patch(
  '/ai-classes/:skuClass',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const skuClass = skuClassEnum.parse(req.params.skuClass)
    const payload = skuClassSettingSchema.parse(req.body)
    const setting = await updateSkuClassSetting(skuClass, payload)

    if (!setting) {
      throw createHttpError(404, 'SKU class settings not found.')
    }

    res.json({ setting })
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
