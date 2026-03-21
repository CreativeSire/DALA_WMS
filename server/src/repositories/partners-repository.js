import { query } from '../lib/db.js'

export async function listPartners() {
  const { rows } = await query(`
    SELECT id, name, contact_name, contact_email, contact_phone, is_active, created_at, updated_at
    FROM brand_partners
    ORDER BY name ASC
  `)
  return rows
}

export async function createPartner(input) {
  const { rows } = await query(
    `
      INSERT INTO brand_partners (name, contact_name, contact_email, contact_phone, is_active)
      VALUES ($1, NULLIF($2, ''), NULLIF(LOWER($3), ''), NULLIF($4, ''), COALESCE($5, true))
      RETURNING *
    `,
    [input.name, input.contact_name, input.contact_email, input.contact_phone, input.is_active],
  )
  return rows[0]
}

export async function updatePartner(id, input) {
  const { rows } = await query(
    `
      UPDATE brand_partners
      SET name = $2,
          contact_name = NULLIF($3, ''),
          contact_email = NULLIF(LOWER($4), ''),
          contact_phone = NULLIF($5, ''),
          is_active = COALESCE($6, is_active),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [id, input.name, input.contact_name, input.contact_email, input.contact_phone, input.is_active],
  )
  return rows[0] || null
}
