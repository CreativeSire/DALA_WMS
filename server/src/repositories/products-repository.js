import { query } from '../lib/db.js'

export async function listProducts() {
  const { rows } = await query(`
    SELECT
      p.id,
      p.brand_partner_id,
      p.sku_code,
      p.name,
      p.category,
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
        name,
        category,
        unit_type,
        allows_fractions,
        reorder_threshold,
        expiry_alert_days,
        is_active
      )
      VALUES ($1, UPPER($2), $3, NULLIF($4, ''), $5, $6, $7, $8, COALESCE($9, true))
      RETURNING *
    `,
    [
      input.brand_partner_id,
      input.sku_code,
      input.name,
      input.category,
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
          name = $4,
          category = NULLIF($5, ''),
          unit_type = $6,
          allows_fractions = $7,
          reorder_threshold = $8,
          expiry_alert_days = $9,
          is_active = COALESCE($10, is_active),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [
      id,
      input.brand_partner_id,
      input.sku_code,
      input.name,
      input.category,
      input.unit_type,
      input.allows_fractions,
      input.reorder_threshold,
      input.expiry_alert_days,
      input.is_active,
    ],
  )
  return rows[0] || null
}
