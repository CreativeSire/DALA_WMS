import { pool, query, withTransaction } from '../lib/db.js'
import { hashPassword } from '../lib/auth.js'
import { refreshBatchStatuses } from '../repositories/inventory-repository.js'

async function ensureUser({ email, fullName, role, password }) {
  const passwordHash = await hashPassword(password)
  const { rows } = await query(
    `
      INSERT INTO app_users (email, password_hash, full_name, role, is_active)
      VALUES (LOWER($1), $2, $3, $4, true)
      ON CONFLICT (email) DO UPDATE
      SET password_hash = EXCLUDED.password_hash,
          full_name = EXCLUDED.full_name,
          role = EXCLUDED.role,
          is_active = true,
          updated_at = NOW()
      RETURNING *
    `,
    [email, passwordHash, fullName, role],
  )
  return rows[0]
}

async function ensurePartner(partner) {
  const { rows } = await query(
    `
      INSERT INTO brand_partners (name, contact_name, contact_email, contact_phone, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (name) DO UPDATE
      SET contact_name = EXCLUDED.contact_name,
          contact_email = EXCLUDED.contact_email,
          contact_phone = EXCLUDED.contact_phone,
          is_active = true,
          updated_at = NOW()
      RETURNING *
    `,
    [partner.name, partner.contact_name, partner.contact_email, partner.contact_phone],
  )
  return rows[0]
}

async function ensureProduct(product, partnerId) {
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
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      ON CONFLICT (sku_code) DO UPDATE
      SET brand_partner_id = EXCLUDED.brand_partner_id,
          barcode_value = EXCLUDED.barcode_value,
          name = EXCLUDED.name,
          category = EXCLUDED.category,
          sku_class = EXCLUDED.sku_class,
          unit_type = EXCLUDED.unit_type,
          allows_fractions = EXCLUDED.allows_fractions,
          reorder_threshold = EXCLUDED.reorder_threshold,
          expiry_alert_days = EXCLUDED.expiry_alert_days,
          is_active = true,
          updated_at = NOW()
      RETURNING *
    `,
    [
      partnerId,
      product.sku_code,
      product.barcode_value,
      product.name,
      product.category,
      product.sku_class || 'regular',
      product.unit_type,
      product.allows_fractions ?? true,
      product.reorder_threshold,
      product.expiry_alert_days,
    ],
  )
  return rows[0]
}

async function seedDemoData() {
  const { rows: countRows } = await query(`SELECT COUNT(*)::int AS count FROM stock_movements`)
  if ((countRows[0]?.count || 0) > 0) {
    console.log('Seed skipped: stock movements already exist.')
    return
  }

  const admin = await ensureUser({
    email: 'admin@dala.ng',
    fullName: 'DALA Admin',
    role: 'admin',
    password: '3IE78z0sYFTcneQwKC',
  })
  const operations = await ensureUser({
    email: 'ops.lead@dala.ng',
    fullName: 'Amina Yusuf',
    role: 'operations',
    password: 'OpsReview2026!',
  })
  const warehouse = await ensureUser({
    email: 'warehouse.lead@dala.ng',
    fullName: 'Chinedu Okafor',
    role: 'warehouse_manager',
    password: 'Warehouse2026!',
  })

  const partners = await Promise.all([
    ensurePartner({
      name: 'Nestle Nigeria',
      contact_name: 'Chioma Eze',
      contact_email: 'chioma.eze@nestle.ng',
      contact_phone: '+2348001111001',
    }),
    ensurePartner({
      name: 'Dangote Foods',
      contact_name: 'Kunle Adebayo',
      contact_email: 'kunle.adebayo@dangote.ng',
      contact_phone: '+2348001111002',
    }),
    ensurePartner({
      name: 'Honeywell Flour',
      contact_name: 'Tosin Balogun',
      contact_email: 'tosin.balogun@honeywell.ng',
      contact_phone: '+2348001111003',
    }),
  ])

  const partnerByName = Object.fromEntries(partners.map((partner) => [partner.name, partner]))
  const products = await Promise.all([
    ensureProduct({
      sku_code: 'NES-MILO-400',
      barcode_value: '6151100123411',
      name: 'Milo 400g',
      category: 'Beverages',
      sku_class: 'fast_mover',
      unit_type: 'carton',
      reorder_threshold: 80,
      expiry_alert_days: 60,
    }, partnerByName['Nestle Nigeria'].id),
    ensureProduct({
      sku_code: 'NES-NIDO-900',
      barcode_value: '6151100456782',
      name: 'Nido 900g',
      category: 'Dairy',
      sku_class: 'regular',
      unit_type: 'carton',
      reorder_threshold: 50,
      expiry_alert_days: 75,
    }, partnerByName['Nestle Nigeria'].id),
    ensureProduct({
      sku_code: 'DAN-SPAG-500',
      barcode_value: '6152200123456',
      name: 'Dangote Spaghetti 500g',
      category: 'Pasta',
      sku_class: 'fast_mover',
      unit_type: 'carton',
      reorder_threshold: 120,
      expiry_alert_days: 45,
    }, partnerByName['Dangote Foods'].id),
    ensureProduct({
      sku_code: 'HON-SEMO-10KG',
      barcode_value: '6153300123460',
      name: 'Honeywell Semo 10kg',
      category: 'Staples',
      sku_class: 'regular',
      unit_type: 'bag',
      reorder_threshold: 35,
      expiry_alert_days: 90,
    }, partnerByName['Honeywell Flour'].id),
    ensureProduct({
      sku_code: 'HON-FLOUR-25KG',
      barcode_value: '6153300123477',
      name: 'Honeywell Flour 25kg',
      category: 'Staples',
      sku_class: 'controlled',
      unit_type: 'bag',
      reorder_threshold: 30,
      expiry_alert_days: 90,
    }, partnerByName['Honeywell Flour'].id),
  ])

  const productBySku = Object.fromEntries(products.map((product) => [product.sku_code, product]))

  await withTransaction(async (client) => {
    const grnSeed = [
      {
        grn_number: 'GRN-20260321-1001',
        partner: 'Nestle Nigeria',
        received_by: warehouse.id,
        delivery_note_ref: 'DN-NES-210326-01',
        notes: 'Weekly replenishment for drinks lane.',
        created_at: '2026-03-14T08:40:00Z',
        items: [
          { sku: 'NES-MILO-400', batch_number: 'MILO-MAR-A', qty: 140, expiry_date: '2026-11-15', unit_cost: 9125 },
          { sku: 'NES-NIDO-900', batch_number: 'NIDO-MAR-A', qty: 72, expiry_date: '2026-12-08', unit_cost: 16400 },
        ],
      },
      {
        grn_number: 'GRN-20260321-1002',
        partner: 'Dangote Foods',
        received_by: warehouse.id,
        delivery_note_ref: 'DN-DAN-180326-02',
        notes: 'Fast moving pasta replenishment.',
        created_at: '2026-03-17T09:10:00Z',
        items: [
          { sku: 'DAN-SPAG-500', batch_number: 'DANG-SPAG-B', qty: 210, expiry_date: '2026-08-28', unit_cost: 6400 },
        ],
      },
      {
        grn_number: 'GRN-20260321-1003',
        partner: 'Honeywell Flour',
        received_by: warehouse.id,
        delivery_note_ref: 'DN-HON-190326-03',
        notes: 'Staples replenishment.',
        created_at: '2026-03-19T13:35:00Z',
        items: [
          { sku: 'HON-SEMO-10KG', batch_number: 'HON-SEMO-C', qty: 48, expiry_date: '2026-10-12', unit_cost: 11800 },
          { sku: 'HON-FLOUR-25KG', batch_number: 'HON-FLOUR-C', qty: 40, expiry_date: '2026-09-02', unit_cost: 15200 },
        ],
      },
    ]

    const batchIds = {}

    for (const grnEntry of grnSeed) {
      const grnResult = await client.query(
        `
          INSERT INTO grn_records (grn_number, brand_partner_id, received_by, delivery_note_ref, notes, total_items, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING *
        `,
        [
          grnEntry.grn_number,
          partnerByName[grnEntry.partner].id,
          grnEntry.received_by,
          grnEntry.delivery_note_ref,
          grnEntry.notes,
          grnEntry.items.length,
          grnEntry.created_at,
        ],
      )
      const grn = grnResult.rows[0]

      for (const item of grnEntry.items) {
        const product = productBySku[item.sku]
        const batchResult = await client.query(
          `
            INSERT INTO stock_batches (
              product_id,
              batch_number,
              quantity_received,
              quantity_remaining,
              unit_cost,
              expiry_date,
              location,
              grn_reference,
              created_by,
              received_at
            )
            VALUES ($1, $2, $3, $3, $4, $5, 'Main Warehouse', $6, $7, $8)
            RETURNING *
          `,
          [product.id, item.batch_number, item.qty, item.unit_cost, item.expiry_date, grn.grn_number, warehouse.id, grnEntry.created_at],
        )
        const batch = batchResult.rows[0]
        batchIds[item.sku] = batch.id

        await client.query(
          `
            INSERT INTO grn_items (
              grn_id, product_id, batch_id, quantity_received, unit_fraction, batch_number, expiry_date, unit_cost
            )
            VALUES ($1, $2, $3, $4, 1, $5, $6, $7)
          `,
          [grn.id, product.id, batch.id, item.qty, item.batch_number, item.expiry_date, item.unit_cost],
        )

        await client.query(
          `
            INSERT INTO stock_movements (
              batch_id, product_id, movement_type, quantity, unit_fraction, balance_after, reference_number, created_by, created_at
            )
            VALUES ($1, $2, 'grn', $3, 1, $3, $4, $5, $6)
          `,
          [batch.id, product.id, item.qty, grn.grn_number, warehouse.id, grnEntry.created_at],
        )
      }
    }

    const dispatchResult = await client.query(
      `
        INSERT INTO dispatch_notes (
          dispatch_number, retailer_name, retailer_address, dispatched_by, confirmed_by, confirmed_at, status, notes, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'confirmed', $7, $8)
        RETURNING *
      `,
      [
        'DSP-20260321-1001',
        'Shoprite Ikeja',
        'Alausa Retail Hub',
        operations.id,
        operations.id,
        '2026-03-20T14:15:00Z',
        'Outbound replenishment for retail partner.',
        '2026-03-20T13:50:00Z',
      ],
    )
    const dispatch = dispatchResult.rows[0]

    const dispatchLines = [
      { sku: 'NES-MILO-400', qty: 36 },
      { sku: 'DAN-SPAG-500', qty: 62 },
    ]

    for (const line of dispatchLines) {
      const product = productBySku[line.sku]
      const batchId = batchIds[line.sku]
      const batchRow = await client.query(`SELECT quantity_remaining FROM stock_batches WHERE id = $1 FOR UPDATE`, [batchId])
      const available = Number(batchRow.rows[0].quantity_remaining)
      const balanceAfter = available - line.qty

      await client.query(
        `UPDATE stock_batches SET quantity_remaining = $2, updated_at = NOW() WHERE id = $1`,
        [batchId, balanceAfter],
      )
      await client.query(
        `
          INSERT INTO dispatch_items (dispatch_id, product_id, batch_id, quantity_dispatched, unit_fraction)
          VALUES ($1, $2, $3, $4, 1)
        `,
        [dispatch.id, product.id, batchId, line.qty],
      )
      await client.query(
        `
          INSERT INTO stock_movements (
            batch_id, product_id, movement_type, quantity, unit_fraction, balance_after, reference_number, retailer_name, created_by, created_at
          )
          VALUES ($1, $2, 'dispatch', $3, 1, $4, $5, $6, $7, $8)
        `,
        [batchId, product.id, -line.qty, balanceAfter, dispatch.dispatch_number, dispatch.retailer_name, operations.id, dispatch.created_at],
      )
    }

    const casualtyResult = await client.query(
      `
        INSERT INTO casualties (
          batch_id, product_id, reason, quantity, description, status, logged_by, approved_by, approved_at, created_at
        )
        VALUES ($1, $2, 'damaged', 4, $3, 'approved', $4, $5, $6, $7)
        RETURNING *
      `,
      [
        batchIds['HON-FLOUR-25KG'],
        productBySku['HON-FLOUR-25KG'].id,
        'Two bags torn during unloading.',
        warehouse.id,
        operations.id,
        '2026-03-20T18:20:00Z',
        '2026-03-20T17:05:00Z',
      ],
    )
    const casualty = casualtyResult.rows[0]

    const casualtyBatchResult = await client.query(`SELECT quantity_remaining FROM stock_batches WHERE id = $1 FOR UPDATE`, [casualty.batch_id])
    const casualtyBalance = Number(casualtyBatchResult.rows[0].quantity_remaining) - Number(casualty.quantity)
    await client.query(
      `UPDATE stock_batches SET quantity_remaining = $2, updated_at = NOW() WHERE id = $1`,
      [casualty.batch_id, casualtyBalance],
    )
    await client.query(
      `
        INSERT INTO stock_movements (
          batch_id, product_id, movement_type, quantity, unit_fraction, balance_after, reference_number, notes, created_by, created_at
        )
        VALUES ($1, $2, 'write_off', $3, 1, $4, $5, $6, $7, $8)
      `,
      [
        casualty.batch_id,
        casualty.product_id,
        -Number(casualty.quantity),
        casualtyBalance,
        'CASUALTY-DEMO-1',
        casualty.description,
        operations.id,
        casualty.approved_at,
      ],
    )

    const sessionResult = await client.query(
      `
        INSERT INTO count_sessions (
          session_ref, status, notes, opened_by, submitted_by, approved_by, opened_at, submitted_at, approved_at, closed_at
        )
        VALUES ($1, 'closed', $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        'CNT-20260321-101',
        'Cycle count on fast movers and flour lane.',
        warehouse.id,
        warehouse.id,
        operations.id,
        '2026-03-21T07:30:00Z',
        '2026-03-21T10:20:00Z',
        '2026-03-21T11:10:00Z',
        '2026-03-21T11:10:00Z',
      ],
    )
    const session = sessionResult.rows[0]

    const countLines = [
      {
        sku: 'NES-MILO-400',
        system_quantity: 104,
        counted_quantity: 102,
        variance_note: 'Two cartons damaged on shelf check.',
      },
      {
        sku: 'HON-SEMO-10KG',
        system_quantity: 48,
        counted_quantity: 49,
        variance_note: 'Found one unrecorded bag in overflow zone.',
      },
    ]

    for (const line of countLines) {
      const product = productBySku[line.sku]
      await client.query(
        `
          INSERT INTO count_lines (
            session_id, product_id, system_quantity, counted_quantity, variance_note, adjustment_approved, counted_by, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, true, $6, NOW())
        `,
        [session.id, product.id, line.system_quantity, line.counted_quantity, line.variance_note, warehouse.id],
      )
    }
  })

  await refreshBatchStatuses()
  console.log('Demo warehouse dataset seeded successfully.')
  console.log('Admin login: admin@dala.ng / 3IE78z0sYFTcneQwKC')
}

seedDemoData()
  .catch((error) => {
    console.error('Demo seed failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
