import { query } from '../lib/db.js'

export async function listProducts() {
  const { rows } = await query(`
    SELECT
      p.id,
      p.brand_partner_id,
      p.sku_code,
      p.barcode_value,
      p.name,
      p.category,
      p.sku_class,
      p.unit_type,
      p.allows_fractions,
      p.reorder_threshold,
      p.expiry_alert_days,
      p.is_active,
      p.created_at,
      p.updated_at,
      bp.name AS brand_partner_name
    FROM products p
    JOIN brand_partners bp ON bp.id = p.brand_partner_id
    ORDER BY p.name ASC
  `)
  return rows
}

export async function createProduct(input) {
  const { rows } = await query(
    `
      INSERT INTO products (
        brand_partner_id,
        sku_code,
        barcode_value,
        name,
        category,
        sku_class,
        unit_type,
        allows_fractions,
        reorder_threshold,
        expiry_alert_days,
        is_active
      )
      VALUES ($1, UPPER($2), NULLIF($3, ''), $4, NULLIF($5, ''), $6, $7, $8, $9, $10, COALESCE($11, true))
      RETURNING *
    `,
    [
      input.brand_partner_id,
      input.sku_code,
      input.barcode_value,
      input.name,
      input.category,
      input.sku_class,
      input.unit_type,
      input.allows_fractions,
      input.reorder_threshold,
      input.expiry_alert_days,
      input.is_active,
    ],
  )
  return rows[0]
}

export async function updateProduct(id, input) {
  const { rows } = await query(
    `
      UPDATE products
      SET brand_partner_id = $2,
          sku_code = UPPER($3),
          barcode_value = NULLIF($4, ''),
          name = $5,
          category = NULLIF($6, ''),
          sku_class = $7,
          unit_type = $8,
          allows_fractions = $9,
          reorder_threshold = $10,
          expiry_alert_days = $11,
          is_active = COALESCE($12, is_active),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      input.brand_partner_id,
      input.sku_code,
      input.barcode_value,
      input.name,
      input.category,
      input.sku_class,
      input.unit_type,
      input.allows_fractions,
      input.reorder_threshold,
      input.expiry_alert_days,
      input.is_active,
    ],
  )
  return rows[0] || null
}

export async function listSkuClassSettings() {
  const { rows } = await query(
    `
      SELECT *
      FROM ai_sku_class_settings
      ORDER BY sku_class ASC
    `,
  )
  return rows.map((row) => ({
    ...row,
    average_multiplier_high: Number(row.average_multiplier_high),
    average_multiplier_medium: Number(row.average_multiplier_medium),
    average_multiplier_low: Number(row.average_multiplier_low),
    highest_multiplier_high: Number(row.highest_multiplier_high),
    highest_multiplier_medium: Number(row.highest_multiplier_medium),
    minimum_history_count: Number(row.minimum_history_count),
  }))
}

export async function updateSkuClassSetting(skuClass, input) {
  const { rows } = await query(
    `
      UPDATE ai_sku_class_settings
      SET average_multiplier_high = $2,
          average_multiplier_medium = $3,
          average_multiplier_low = $4,
          highest_multiplier_high = $5,
          highest_multiplier_medium = $6,
          minimum_history_count = $7,
          updated_at = NOW()
      WHERE sku_class = $1
      RETURNING *
    `,
    [
      skuClass,
      input.average_multiplier_high,
      input.average_multiplier_medium,
      input.average_multiplier_low,
      input.highest_multiplier_high,
      input.highest_multiplier_medium,
      input.minimum_history_count,
    ],
  )
  return rows[0] || null
}
