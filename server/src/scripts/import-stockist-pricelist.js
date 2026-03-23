import process from 'node:process'
import xlsx from 'xlsx'
import { query } from '../lib/db.js'

const DEFAULT_PARTNER = 'Imported Catalogue'

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    throw new Error('Usage: node src/scripts/import-stockist-pricelist.js <xlsx-path>')
  }

  const workbook = xlsx.readFile(filePath)
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' })

  const partnerId = await ensureImportedPartner()
  let updated = 0
  let inserted = 0

  for (const row of rows) {
    const itemName = clean(row.ITEM)
    if (!itemName) continue

    const skuCode = deriveSkuCode(itemName)
    const metadata = buildMetadata(row)
    const existing = await findProduct(itemName, skuCode)

    if (existing) {
      await query(
        `
          UPDATE products
          SET internal_barcode_value = COALESCE(NULLIF(internal_barcode_value, ''), $2),
              product_aliases = (
                SELECT ARRAY(
                  SELECT DISTINCT value
                  FROM unnest(COALESCE(product_aliases, ARRAY[]::TEXT[]) || $3::TEXT[]) AS value
                  WHERE value IS NOT NULL AND value <> ''
                )
              ),
              base_uom_label = COALESCE(NULLIF($4, ''), base_uom_label, 'ctn'),
              alt_uom_label = COALESCE(NULLIF($5, ''), alt_uom_label),
              units_per_pack = COALESCE($6, units_per_pack, 1),
              is_vatable = COALESCE($7, is_vatable),
              updated_at = NOW()
          WHERE id = $1
        `,
        [
          existing.id,
          metadata.internalBarcode,
          metadata.aliases,
          metadata.baseUom,
          metadata.altUom,
          metadata.unitsPerPack,
          metadata.isVatable,
        ],
      )
      updated += 1
      continue
    }

    await query(
      `
        INSERT INTO products (
          brand_partner_id,
          sku_code,
          internal_barcode_value,
          product_aliases,
          base_uom_label,
          alt_uom_label,
          units_per_pack,
          is_vatable,
          name,
          category,
          sku_class,
          unit_type,
          allows_fractions,
          reorder_threshold,
          expiry_alert_days,
          is_active
        )
        VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8, $9, 'Imported', 'regular', 'carton', true, 0, 30, true)
      `,
      [
        partnerId,
        skuCode,
        metadata.internalBarcode,
        metadata.aliases,
        metadata.baseUom,
        metadata.altUom,
        metadata.unitsPerPack,
        metadata.isVatable,
        itemName,
      ],
    )
    inserted += 1
  }

  console.log(`Imported price list metadata. Updated: ${updated}. Inserted: ${inserted}.`)
}

async function ensureImportedPartner() {
  const existing = await query(`SELECT id FROM brand_partners WHERE name = $1`, [DEFAULT_PARTNER])
  if (existing.rows[0]) return existing.rows[0].id

  const inserted = await query(
    `
      INSERT INTO brand_partners (name, contact_name, contact_email, contact_phone, is_active)
      VALUES ($1, 'System import', NULL, NULL, true)
      RETURNING id
    `,
    [DEFAULT_PARTNER],
  )
  return inserted.rows[0].id
}

async function findProduct(itemName, skuCode) {
  const { rows } = await query(
    `
      SELECT id, sku_code, name
      FROM products
      WHERE UPPER(sku_code) = UPPER($1)
         OR LOWER(name) = LOWER($2)
      LIMIT 1
    `,
    [skuCode, itemName],
  )
  return rows[0] || null
}

function buildMetadata(row) {
  const itemName = clean(row.ITEM)
  const baseUom = clean(row.UOM || 'ctn').toLowerCase()
  const altUom = clean(row['ALT UOM']).toLowerCase()
  const unitsPerPack = Number(row.Conversion || 1) || 1
  const aliases = buildAliases(itemName)
  const skuCode = deriveSkuCode(itemName)
  return {
    baseUom,
    altUom,
    unitsPerPack,
    isVatable: clean(row.Vatable).toLowerCase() === 'yes',
    aliases,
    internalBarcode: `DALA-${skuCode.replace(/[^A-Z0-9]+/g, '-')}`,
  }
}

function buildAliases(itemName) {
  const aliases = new Set()
  const cleanName = clean(itemName)
  if (!cleanName) return []
  aliases.add(cleanName)
  aliases.add(cleanName.replace(/\s*\(\d+x\)\s*$/i, '').trim())
  aliases.add(cleanName.replace(/^[A-Z0-9]+-\s*/i, '').trim())
  aliases.add(cleanName.replace(/\s+/g, ' ').trim())
  return [...aliases].filter(Boolean)
}

function deriveSkuCode(itemName) {
  const cleanName = clean(itemName).toUpperCase()
  const prefixMatch = cleanName.match(/^([A-Z0-9]+-\s*[A-Z0-9]+)/)
  if (prefixMatch) {
    return prefixMatch[1].replace(/\s+/g, '')
  }
  return cleanName.replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
