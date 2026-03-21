import { withTransaction, query } from '../lib/db.js'
import { createHttpError } from '../lib/http.js'

function mapCurrentStockRow(row) {
  return {
    product_id: row.product_id,
    sku_code: row.sku_code,
    product_name: row.product_name,
    category: row.category,
    unit_type: row.unit_type,
    brand_partner: row.brand_partner,
    reorder_threshold: Number(row.reorder_threshold || 0),
    total_stock: Number(row.total_stock || 0),
    active_batches: Number(row.active_batches || 0),
    near_expiry_batches: Number(row.near_expiry_batches || 0),
    expired_batches: Number(row.expired_batches || 0),
    earliest_expiry: row.earliest_expiry,
  }
}

export async function refreshBatchStatuses(executor = query) {
  await executor(
    `
      UPDATE stock_batches
      SET status = 'expired',
          updated_at = NOW()
      WHERE expiry_date IS NOT NULL
        AND expiry_date < CURRENT_DATE
        AND quantity_remaining > 0
        AND status NOT IN ('depleted', 'written_off', 'expired')
    `,
  )

  await executor(
    `
      UPDATE stock_batches AS sb
      SET status = 'near_expiry',
          updated_at = NOW()
      FROM products AS p
      WHERE sb.product_id = p.id
        AND sb.expiry_date IS NOT NULL
        AND sb.expiry_date >= CURRENT_DATE
        AND sb.expiry_date <= CURRENT_DATE + make_interval(days => p.expiry_alert_days)
        AND sb.quantity_remaining > 0
        AND sb.status = 'active'
    `,
  )

  await executor(
    `
      UPDATE stock_batches
      SET status = 'active',
          updated_at = NOW()
      WHERE quantity_remaining > 0
        AND status = 'near_expiry'
        AND expiry_date IS NOT NULL
        AND expiry_date > CURRENT_DATE
        AND id NOT IN (
          SELECT sb.id
          FROM stock_batches sb
          JOIN products p ON p.id = sb.product_id
          WHERE sb.expiry_date <= CURRENT_DATE + make_interval(days => p.expiry_alert_days)
        )
    `,
  )
}

export async function getCurrentStock() {
  await refreshBatchStatuses()
  const { rows } = await query(
    `
      SELECT
        p.id AS product_id,
        p.sku_code,
        p.name AS product_name,
        p.category,
        p.unit_type,
        bp.name AS brand_partner,
        p.reorder_threshold,
        COALESCE(SUM(sb.quantity_remaining), 0) AS total_stock,
        COUNT(CASE WHEN sb.status = 'active' THEN 1 END) AS active_batches,
        COUNT(CASE WHEN sb.status = 'near_expiry' THEN 1 END) AS near_expiry_batches,
        COUNT(CASE WHEN sb.status = 'expired' THEN 1 END) AS expired_batches,
        MIN(CASE WHEN sb.status IN ('active', 'near_expiry') THEN sb.expiry_date END) AS earliest_expiry
      FROM products p
      JOIN brand_partners bp ON bp.id = p.brand_partner_id
      LEFT JOIN stock_batches sb
        ON sb.product_id = p.id
       AND sb.status NOT IN ('depleted', 'written_off')
       AND sb.quantity_remaining > 0
      WHERE p.is_active = true
      GROUP BY p.id, p.sku_code, p.name, p.category, p.unit_type, bp.name, p.reorder_threshold
      ORDER BY bp.name ASC, p.name ASC
    `,
  )
  return rows.map(mapCurrentStockRow)
}

export async function getReorderAlerts() {
  const rows = await getCurrentStock()
  return rows
    .filter((row) => row.reorder_threshold > 0 && row.total_stock <= row.reorder_threshold)
    .map((row) => ({
      ...row,
      shortfall: Number((row.reorder_threshold - row.total_stock).toFixed(2)),
      alert_level: row.total_stock === 0 ? 'out_of_stock' : 'low_stock',
    }))
    .sort((a, b) => a.total_stock - b.total_stock)
}

export async function getExpiryAlerts() {
  await refreshBatchStatuses()
  const { rows } = await query(
    `
      SELECT
        sb.id AS batch_id,
        sb.batch_number,
        sb.expiry_date,
        sb.quantity_remaining,
        sb.status AS batch_status,
        sb.location,
        sb.received_at,
        p.id AS product_id,
        p.name AS product_name,
        p.sku_code,
        p.expiry_alert_days,
        bp.name AS brand_partner,
        (sb.expiry_date - CURRENT_DATE) AS days_until_expiry,
        CASE
          WHEN sb.expiry_date < CURRENT_DATE THEN 'expired'
          WHEN sb.expiry_date <= CURRENT_DATE + make_interval(days => p.expiry_alert_days) THEN 'near_expiry'
          ELSE 'ok'
        END AS alert_level
      FROM stock_batches sb
      JOIN products p ON p.id = sb.product_id
      JOIN brand_partners bp ON bp.id = p.brand_partner_id
      WHERE sb.expiry_date IS NOT NULL
        AND sb.quantity_remaining > 0
        AND sb.status NOT IN ('depleted', 'written_off')
      ORDER BY sb.expiry_date ASC
    `,
  )
  return rows.map((row) => ({
    ...row,
    quantity_remaining: Number(row.quantity_remaining || 0),
    expiry_alert_days: Number(row.expiry_alert_days || 0),
    days_until_expiry: Number(row.days_until_expiry),
  }))
}

export async function getMovements({ limit = 200, from, to }) {
  const params = []
  const where = []
  if (from) {
    params.push(`${from}T00:00:00Z`)
    where.push(`sm.created_at >= $${params.length}`)
  }
  if (to) {
    params.push(`${to}T23:59:59Z`)
    where.push(`sm.created_at <= $${params.length}`)
  }
  params.push(limit)

  const { rows } = await query(
    `
      SELECT
        sm.*,
        p.name AS product_name,
        p.sku_code,
        u.full_name AS user_full_name,
        sb.batch_number,
        sb.expiry_date
      FROM stock_movements sm
      JOIN products p ON p.id = sm.product_id
      LEFT JOIN app_users u ON u.id = sm.created_by
      LEFT JOIN stock_batches sb ON sb.id = sm.batch_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY sm.created_at DESC
      LIMIT $${params.length}
    `,
    params,
  )

  return rows.map((row) => ({
    ...row,
    quantity: Number(row.quantity),
    balance_after: Number(row.balance_after),
    unit_fraction: Number(row.unit_fraction),
    products: { name: row.product_name, sku_code: row.sku_code },
    profiles: { full_name: row.user_full_name },
    stock_batches: { batch_number: row.batch_number, expiry_date: row.expiry_date },
  }))
}

export async function getPendingCasualtyCount() {
  const { rows } = await query(`SELECT COUNT(*)::int AS count FROM casualties WHERE status = 'pending'`)
  return rows[0]?.count || 0
}

export async function getDashboardData() {
  const [stock, reorderAlerts, expiryAlerts, pendingCasualties, recentMovements] = await Promise.all([
    getCurrentStock(),
    getReorderAlerts(),
    getExpiryAlerts(),
    getPendingCasualtyCount(),
    getMovements({ limit: 8 }),
  ])

  return {
    totalProducts: stock.length,
    lowStock: reorderAlerts.filter((row) => row.alert_level === 'low_stock').length,
    outOfStock: reorderAlerts.filter((row) => row.alert_level === 'out_of_stock').length,
    nearExpiry: expiryAlerts.filter((row) => row.alert_level === 'near_expiry').length,
    expired: expiryAlerts.filter((row) => row.alert_level === 'expired').length,
    pendingCasualties,
    recentMovements,
    stockAlerts: reorderAlerts,
    expiryAlerts: expiryAlerts.filter((row) => row.alert_level !== 'ok').slice(0, 6),
  }
}

export async function generateReference(sequenceName, prefix, digits) {
  const { rows } = await query(`SELECT nextval($1::regclass) AS seq`, [sequenceName])
  const seq = String(rows[0].seq).padStart(digits, '0')
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `${prefix}-${stamp}-${seq}`
}

function isUniqueReferenceConflict(error, columnName) {
  return error?.code === '23505' && typeof error?.detail === 'string' && error.detail.includes(`(${columnName})=`)
}

export async function listGrns() {
  const { rows } = await query(
    `
      SELECT
        gr.*,
        bp.name AS brand_partner_name,
        u.full_name AS received_by_name
      FROM grn_records gr
      JOIN brand_partners bp ON bp.id = gr.brand_partner_id
      LEFT JOIN app_users u ON u.id = gr.received_by
      ORDER BY gr.created_at DESC
      LIMIT 50
    `,
  )

  return rows.map((row) => ({
    ...row,
    brand_partners: { name: row.brand_partner_name },
    profiles: { full_name: row.received_by_name },
  }))
}

export async function createGrn({ userId, partnerId, deliveryRef, notes, lines }) {
  return withTransaction(async (client) => {
    let grn
    let grnNumber
    for (let attempt = 0; attempt < 20; attempt += 1) {
      grnNumber = await generateReference('grn_seq', 'GRN', 4)
      try {
        const grnResult = await client.query(
          `
            INSERT INTO grn_records (grn_number, brand_partner_id, received_by, delivery_note_ref, notes, total_items)
            VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), $6)
            RETURNING *
          `,
          [grnNumber, partnerId, userId, deliveryRef, notes, lines.length],
        )
        grn = grnResult.rows[0]
        break
      } catch (error) {
        if (!isUniqueReferenceConflict(error, 'grn_number') || attempt === 19) {
          throw error
        }
      }
    }

    for (const line of lines) {
      const qty = Number(line.quantity) * Number(line.unitFraction || 1)
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
            created_by
          )
          VALUES ($1, NULLIF($2, ''), $3, $3, $4, NULLIF($5, '')::date, 'Main Warehouse', $6, $7)
          RETURNING *
        `,
        [line.productId, line.batchNumber, qty, line.unitCost || null, line.expiryDate || null, grnNumber, userId],
      )
      const batch = batchResult.rows[0]

      await client.query(
        `
          INSERT INTO grn_items (
            grn_id,
            product_id,
            batch_id,
            quantity_received,
            unit_fraction,
            batch_number,
            expiry_date,
            unit_cost
          )
          VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), NULLIF($7, '')::date, $8)
        `,
        [grn.id, line.productId, batch.id, qty, Number(line.unitFraction || 1), line.batchNumber, line.expiryDate || null, line.unitCost || null],
      )

      await client.query(
        `
          INSERT INTO stock_movements (
            batch_id,
            product_id,
            movement_type,
            quantity,
            unit_fraction,
            balance_after,
            reference_number,
            created_by
          )
          VALUES ($1, $2, 'grn', $3, $4, $3, $5, $6)
        `,
        [batch.id, line.productId, qty, Number(line.unitFraction || 1), grnNumber, userId],
      )
    }

    await refreshBatchStatuses((text, params) => client.query(text, params))
    return { grn, grnNumber }
  })
}

export async function listAvailableBatches(productId) {
  await refreshBatchStatuses()
  const { rows } = await query(
    `
      SELECT *
      FROM stock_batches
      WHERE product_id = $1
        AND status NOT IN ('depleted', 'written_off')
        AND quantity_remaining > 0
      ORDER BY received_at ASC
    `,
    [productId],
  )
  return rows.map((row) => ({
    ...row,
    quantity_received: Number(row.quantity_received),
    quantity_remaining: Number(row.quantity_remaining),
    unit_cost: row.unit_cost == null ? null : Number(row.unit_cost),
  }))
}

export async function listDispatches() {
  const { rows } = await query(
    `
      SELECT
        dn.*,
        dispatched.full_name AS dispatched_by_name,
        confirmed.full_name AS confirmed_by_name
      FROM dispatch_notes dn
      LEFT JOIN app_users dispatched ON dispatched.id = dn.dispatched_by
      LEFT JOIN app_users confirmed ON confirmed.id = dn.confirmed_by
      ORDER BY dn.created_at DESC
      LIMIT 50
    `,
  )

  return rows.map((row) => ({
    ...row,
    profiles: { full_name: row.dispatched_by_name },
    confirmedBy: { full_name: row.confirmed_by_name },
  }))
}

export async function createDispatch({ userId, retailerName, retailerAddress, notes, lines }) {
  return withTransaction(async (client) => {
    await refreshBatchStatuses((text, params) => client.query(text, params))
    let dispatch
    let dispatchNumber
    for (let attempt = 0; attempt < 20; attempt += 1) {
      dispatchNumber = await generateReference('dispatch_seq', 'DSP', 4)
      try {
        const dispatchResult = await client.query(
          `
            INSERT INTO dispatch_notes (
              dispatch_number,
              retailer_name,
              retailer_address,
              dispatched_by,
              notes,
              status
            )
            VALUES ($1, $2, NULLIF($3, ''), $4, NULLIF($5, ''), 'pending')
            RETURNING *
          `,
          [dispatchNumber, retailerName, retailerAddress, userId, notes],
        )
        dispatch = dispatchResult.rows[0]
        break
      } catch (error) {
        if (!isUniqueReferenceConflict(error, 'dispatch_number') || attempt === 19) {
          throw error
        }
      }
    }

    for (const line of lines) {
      const requestedQty = Number(line.quantity) * Number(line.unitFraction || 1)
      let remaining = requestedQty
      const batchResult = await client.query(
        `
          SELECT *
          FROM stock_batches
          WHERE product_id = $1
            AND status NOT IN ('depleted', 'written_off')
            AND quantity_remaining > 0
          ORDER BY received_at ASC
          FOR UPDATE
        `,
        [line.productId],
      )

      for (const batch of batchResult.rows) {
        if (remaining <= 0) break
        const available = Number(batch.quantity_remaining)
        if (available <= 0) continue
        const allocatedQty = Math.min(available, remaining)
        const newQty = Number((available - allocatedQty).toFixed(2))
        const newStatus = newQty <= 0 ? 'depleted' : batch.status

        await client.query(
          `
            UPDATE stock_batches
            SET quantity_remaining = $2,
                status = $3,
                updated_at = NOW()
            WHERE id = $1
          `,
          [batch.id, newQty, newStatus],
        )

        await client.query(
          `
            INSERT INTO dispatch_items (dispatch_id, product_id, batch_id, quantity_dispatched, unit_fraction)
            VALUES ($1, $2, $3, $4, $5)
          `,
          [dispatch.id, line.productId, batch.id, allocatedQty, Number(line.unitFraction || 1)],
        )

        await client.query(
          `
            INSERT INTO stock_movements (
              batch_id,
              product_id,
              movement_type,
              quantity,
              unit_fraction,
              balance_after,
              reference_number,
              retailer_name,
              created_by
            )
            VALUES ($1, $2, 'dispatch', $3, $4, $5, $6, $7, $8)
          `,
          [batch.id, line.productId, -allocatedQty, Number(line.unitFraction || 1), newQty, dispatchNumber, retailerName, userId],
        )

        remaining = Number((remaining - allocatedQty).toFixed(2))
      }

      if (remaining > 0) {
        throw createHttpError(400, 'Stock allocation failed due to insufficient available stock.')
      }
    }

    await refreshBatchStatuses((text, params) => client.query(text, params))
    return { dispatch, dispatchNumber }
  })
}

export async function confirmDispatch(dispatchId, userId) {
  const { rows } = await query(
    `
      UPDATE dispatch_notes
      SET status = 'confirmed',
          confirmed_by = $2,
          confirmed_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [dispatchId, userId],
  )
  return rows[0] || null
}

export async function listCasualties() {
  const { rows } = await query(
    `
      SELECT
        c.*,
        p.name AS product_name,
        p.sku_code,
        bp.name AS brand_partner,
        sb.batch_number,
        sb.expiry_date,
        logged.full_name AS logged_by_name,
        approver.full_name AS approved_by_name
      FROM casualties c
      JOIN products p ON p.id = c.product_id
      JOIN brand_partners bp ON bp.id = p.brand_partner_id
      JOIN stock_batches sb ON sb.id = c.batch_id
      LEFT JOIN app_users logged ON logged.id = c.logged_by
      LEFT JOIN app_users approver ON approver.id = c.approved_by
      ORDER BY c.created_at DESC
    `,
  )
  return rows.map((row) => ({
    ...row,
    quantity: Number(row.quantity),
  }))
}

export async function createCasualty({ userId, batchId, productId, reason, quantity, description }) {
  const { rows } = await query(
    `
      INSERT INTO casualties (batch_id, product_id, reason, quantity, description, status, logged_by)
      VALUES ($1, $2, $3, $4, NULLIF($5, ''), 'pending', $6)
      RETURNING *
    `,
    [batchId, productId, reason, quantity, description, userId],
  )
  return rows[0]
}

export async function approveCasualty(casualtyId, userId) {
  return withTransaction(async (client) => {
    const casualtyResult = await client.query(
      `
        SELECT c.*, sb.quantity_remaining
        FROM casualties c
        JOIN stock_batches sb ON sb.id = c.batch_id
        WHERE c.id = $1
        FOR UPDATE
      `,
      [casualtyId],
    )
    const casualty = casualtyResult.rows[0]
    if (!casualty) throw createHttpError(404, 'Casualty not found.')
    if (casualty.status !== 'pending') throw createHttpError(400, 'Only pending casualties can be approved.')

    const newQty = Math.max(0, Number(casualty.quantity_remaining) - Number(casualty.quantity))
    await client.query(
      `
        UPDATE stock_batches
        SET quantity_remaining = $2,
            status = $3,
            updated_at = NOW()
        WHERE id = $1
      `,
      [casualty.batch_id, newQty, newQty <= 0 ? 'written_off' : 'active'],
    )

    await client.query(
      `
        INSERT INTO stock_movements (
          batch_id,
          product_id,
          movement_type,
          quantity,
          unit_fraction,
          balance_after,
          reference_number,
          notes,
          created_by
        )
        VALUES ($1, $2, 'write_off', $3, 1, $4, $5, $6, $7)
      `,
      [
        casualty.batch_id,
        casualty.product_id,
        -Number(casualty.quantity),
        newQty,
        `CASUALTY-${casualty.id.slice(0, 8).toUpperCase()}`,
        `${casualty.reason}: ${casualty.description || ''}`.trim(),
        userId,
      ],
    )

    const approved = await client.query(
      `
        UPDATE casualties
        SET status = 'approved',
            approved_by = $2,
            approved_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [casualtyId, userId],
    )

    return approved.rows[0]
  })
}

export async function rejectCasualty(casualtyId, userId, rejectionReason) {
  const { rows } = await query(
    `
      UPDATE casualties
      SET status = 'rejected',
          approved_by = $2,
          approved_at = NOW(),
          rejection_reason = $3
      WHERE id = $1
      RETURNING *
    `,
    [casualtyId, userId, rejectionReason],
  )
  return rows[0] || null
}

export async function listPartnerSummaries() {
  await refreshBatchStatuses()
  const { rows } = await query(
    `
      SELECT
        bp.id AS partner_id,
        bp.name AS partner_name,
        bp.contact_name,
        bp.contact_phone,
        COUNT(DISTINCT p.id) AS total_skus,
        COALESCE(SUM(sb.quantity_remaining), 0) AS total_stock_held,
        COUNT(DISTINCT CASE WHEN sb.status = 'near_expiry' THEN sb.id END) AS near_expiry_batches,
        COUNT(DISTINCT CASE WHEN sb.status = 'expired' THEN sb.id END) AS expired_batches,
        MAX(gr.created_at) AS last_grn_date,
        COUNT(DISTINCT gr.id) AS total_grns
      FROM brand_partners bp
      LEFT JOIN products p ON p.brand_partner_id = bp.id AND p.is_active = true
      LEFT JOIN stock_batches sb
        ON sb.product_id = p.id
       AND sb.status NOT IN ('depleted', 'written_off')
       AND sb.quantity_remaining > 0
      LEFT JOIN grn_records gr ON gr.brand_partner_id = bp.id
      WHERE bp.is_active = true
      GROUP BY bp.id, bp.name, bp.contact_name, bp.contact_phone
      ORDER BY bp.name ASC
    `,
  )
  return rows.map((row) => ({
    ...row,
    total_skus: Number(row.total_skus),
    total_stock_held: Number(row.total_stock_held || 0),
    near_expiry_batches: Number(row.near_expiry_batches),
    expired_batches: Number(row.expired_batches),
    total_grns: Number(row.total_grns),
  }))
}

export async function getPartnerDetail(partnerId) {
  const [summaries, currentStock, grns] = await Promise.all([
    listPartnerSummaries(),
    getCurrentStock(),
    query(
      `
        SELECT gr.*, u.full_name AS received_by_name
        FROM grn_records gr
        LEFT JOIN app_users u ON u.id = gr.received_by
        WHERE gr.brand_partner_id = $1
        ORDER BY gr.created_at DESC
        LIMIT 20
      `,
      [partnerId],
    ),
  ])

  const summary = summaries.find((row) => row.partner_id === partnerId)
  if (!summary) throw createHttpError(404, 'Brand partner not found.')

  return {
    summary,
    stock: currentStock.filter((row) => row.brand_partner === summary.partner_name),
    grns: grns.rows.map((row) => ({
      ...row,
      profiles: { full_name: row.received_by_name },
    })),
  }
}

export async function listCountSessions() {
  const { rows } = await query(
    `
      SELECT
        cs.*,
        opener.full_name AS opened_by_name,
        approver.full_name AS approved_by_name
      FROM count_sessions cs
      LEFT JOIN app_users opener ON opener.id = cs.opened_by
      LEFT JOIN app_users approver ON approver.id = cs.approved_by
      ORDER BY cs.opened_at DESC
    `,
  )

  return rows.map((row) => ({
    ...row,
    opener: { full_name: row.opened_by_name },
    approver: { full_name: row.approved_by_name },
  }))
}

export async function createCountSession({ userId, notes }) {
  return withTransaction(async (client) => {
    let session
    let sessionRef
    for (let attempt = 0; attempt < 20; attempt += 1) {
      sessionRef = await generateReference('count_seq', 'CNT', 3)
      try {
        const sessionResult = await client.query(
          `
            INSERT INTO count_sessions (session_ref, status, notes, opened_by)
            VALUES ($1, 'open', NULLIF($2, ''), $3)
            RETURNING *
          `,
          [sessionRef, notes, userId],
        )
        session = sessionResult.rows[0]
        break
      } catch (error) {
        if (!isUniqueReferenceConflict(error, 'session_ref') || attempt === 19) {
          throw error
        }
      }
    }
    const stock = await getCurrentStock()

    for (const row of stock) {
      await client.query(
        `
          INSERT INTO count_lines (session_id, product_id, system_quantity, counted_quantity)
          VALUES ($1, $2, $3, NULL)
        `,
        [session.id, row.product_id, row.total_stock],
      )
    }

    return { session, sessionRef, lineCount: stock.length }
  })
}

export async function getCountSessionDetail(sessionId) {
  const sessionRows = await query(
    `
      SELECT
        cs.*,
        opener.full_name AS opened_by_name,
        approver.full_name AS approved_by_name
      FROM count_sessions cs
      LEFT JOIN app_users opener ON opener.id = cs.opened_by
      LEFT JOIN app_users approver ON approver.id = cs.approved_by
      WHERE cs.id = $1
    `,
    [sessionId],
  )
  const session = sessionRows.rows[0]
  if (!session) throw createHttpError(404, 'Count session not found.')

  const lineRows = await query(
    `
      SELECT
        cl.id AS line_id,
        cl.session_id,
        cl.system_quantity,
        cl.counted_quantity,
        cl.variance,
        cl.variance_note,
        cl.adjustment_approved,
        cl.updated_at AS counted_at,
        cs.session_ref,
        cs.status AS session_status,
        cs.opened_at,
        p.id AS product_id,
        p.name AS product_name,
        p.sku_code,
        p.unit_type,
        bp.name AS brand_partner,
        counter.full_name AS counted_by_name
      FROM count_lines cl
      JOIN count_sessions cs ON cs.id = cl.session_id
      JOIN products p ON p.id = cl.product_id
      JOIN brand_partners bp ON bp.id = p.brand_partner_id
      LEFT JOIN app_users counter ON counter.id = cl.counted_by
      WHERE cl.session_id = $1
      ORDER BY bp.name ASC, p.name ASC
    `,
    [sessionId],
  )

  return {
    session: {
      ...session,
      opener: { full_name: session.opened_by_name },
      approver: { full_name: session.approved_by_name },
    },
    lines: lineRows.rows.map((row) => ({
      ...row,
      system_quantity: Number(row.system_quantity),
      counted_quantity: row.counted_quantity == null ? null : Number(row.counted_quantity),
      variance: row.variance == null ? null : Number(row.variance),
    })),
  }
}

export async function updateCountLine(lineId, { countedQuantity, varianceNote, userId }) {
  const values = []
  const sets = []
  if (countedQuantity !== undefined) {
    values.push(countedQuantity)
    sets.push(`counted_quantity = $${values.length}`)
    values.push(userId)
    sets.push(`counted_by = $${values.length}`)
  }
  if (varianceNote !== undefined) {
    values.push(varianceNote)
    sets.push(`variance_note = NULLIF($${values.length}, '')`)
  }
  if (!sets.length) throw createHttpError(400, 'No count-line changes supplied.')

  values.push(lineId)
  const { rows } = await query(
    `
      UPDATE count_lines
      SET ${sets.join(', ')},
          updated_at = NOW()
      WHERE id = $${values.length}
      RETURNING *
    `,
    values,
  )
  return rows[0] || null
}

export async function submitCountSession(sessionId, userId) {
  const { rows } = await query(
    `
      UPDATE count_sessions
      SET status = 'submitted',
          submitted_by = $2,
          submitted_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [sessionId, userId],
  )
  return rows[0] || null
}

export async function approveCountSession(sessionId, userId) {
  return withTransaction(async (client) => {
    const detail = await getCountSessionDetail(sessionId)
    const session = detail.session
    if (session.status !== 'submitted') throw createHttpError(400, 'Only submitted sessions can be approved.')

    for (const line of detail.lines.filter((row) => row.counted_quantity !== null && row.variance !== 0)) {
      const batchesResult = await client.query(
        `
          SELECT *
          FROM stock_batches
          WHERE product_id = $1
            AND status NOT IN ('depleted', 'written_off')
            AND quantity_remaining > 0
          ORDER BY received_at DESC
          LIMIT 1
          FOR UPDATE
        `,
        [line.product_id],
      )
      const batch = batchesResult.rows[0]

      if (batch) {
        const newQty = Math.max(0, Number(batch.quantity_remaining) + Number(line.variance))
        await client.query(
          `
            UPDATE stock_batches
            SET quantity_remaining = $2,
                status = $3,
                updated_at = NOW()
            WHERE id = $1
          `,
          [batch.id, newQty, newQty <= 0 ? 'depleted' : batch.status],
        )

        await client.query(
          `
            INSERT INTO stock_movements (
              batch_id,
              product_id,
              movement_type,
              quantity,
              unit_fraction,
              balance_after,
              reference_number,
              notes,
              created_by
            )
            VALUES ($1, $2, 'adjustment', $3, 1, $4, $5, $6, $7)
          `,
          [batch.id, line.product_id, Number(line.variance), newQty, session.session_ref, `Physical count adjustment: ${line.variance_note || 'Count reconciliation'}`, userId],
        )
      } else if (Number(line.variance) > 0) {
        const batchResult = await client.query(
          `
            INSERT INTO stock_batches (
              product_id,
              batch_number,
              quantity_received,
              quantity_remaining,
              location,
              status,
              notes,
              created_by
            )
            VALUES ($1, $2, $3, $3, 'Main Warehouse', 'active', $4, $5)
            RETURNING *
          `,
          [line.product_id, `COUNT-${session.session_ref}`, Number(line.variance), `Created from physical count surplus in ${session.session_ref}`, userId],
        )
        const newBatch = batchResult.rows[0]

        await client.query(
          `
            INSERT INTO stock_movements (
              batch_id,
              product_id,
              movement_type,
              quantity,
              unit_fraction,
              balance_after,
              reference_number,
              notes,
              created_by
            )
            VALUES ($1, $2, 'adjustment', $3, 1, $4, $5, $6, $7)
          `,
          [newBatch.id, line.product_id, Number(line.variance), Number(line.variance), session.session_ref, `Physical count surplus: ${line.variance_note || 'Count reconciliation'}`, userId],
        )
      } else {
        throw createHttpError(400, `Cannot apply negative variance for ${line.product_name} because no active batch is available.`)
      }

      await client.query(`UPDATE count_lines SET adjustment_approved = true WHERE id = $1`, [line.line_id])
    }

    await client.query(
      `
        UPDATE count_sessions
        SET status = 'closed',
            approved_by = $2,
            approved_at = NOW(),
            closed_at = NOW()
        WHERE id = $1
      `,
      [sessionId, userId],
    )

    await refreshBatchStatuses((text, params) => client.query(text, params))
    return { appliedAdjustments: detail.lines.filter((row) => row.counted_quantity !== null && row.variance !== 0).length }
  })
}

export async function getReport(reportId, { from, to }) {
  switch (reportId) {
    case 'stock_summary':
      return getCurrentStock()
    case 'abc': {
      const { rows } = await query(
        `
          SELECT
            sm.product_id,
            p.name AS product,
            p.sku_code AS sku,
            bp.name AS partner,
            SUM(ABS(sm.quantity)) AS dispatched
          FROM stock_movements sm
          JOIN products p ON p.id = sm.product_id
          JOIN brand_partners bp ON bp.id = p.brand_partner_id
          WHERE sm.movement_type = 'dispatch'
          GROUP BY sm.product_id, p.name, p.sku_code, bp.name
          ORDER BY SUM(ABS(sm.quantity)) DESC
        `,
      )
      return rows.map((row) => ({ ...row, dispatched: Number(row.dispatched) }))
    }
    case 'stock_ageing': {
      await refreshBatchStatuses()
      const { rows } = await query(
        `
          SELECT
            sb.*,
            p.name AS product_name,
            p.sku_code,
            bp.name AS brand_partner
          FROM stock_batches sb
          JOIN products p ON p.id = sb.product_id
          JOIN brand_partners bp ON bp.id = p.brand_partner_id
          WHERE sb.status NOT IN ('depleted', 'written_off')
            AND sb.quantity_remaining > 0
          ORDER BY sb.received_at ASC
        `,
      )
      return rows.map((row) => ({
        ...row,
        quantity_remaining: Number(row.quantity_remaining),
      }))
    }
    case 'movement_log':
      return getMovements({ limit: 5000, from, to })
    case 'dispatch_report': {
      const { rows } = await query(
        `
          SELECT
            dn.*,
            dispatched.full_name AS dispatched_by_name,
            di.quantity_dispatched,
            p.name AS product_name,
            p.sku_code
          FROM dispatch_notes dn
          JOIN dispatch_items di ON di.dispatch_id = dn.id
          JOIN products p ON p.id = di.product_id
          LEFT JOIN app_users dispatched ON dispatched.id = dn.dispatched_by
          WHERE dn.created_at >= $1::timestamptz
            AND dn.created_at <= $2::timestamptz
          ORDER BY dn.created_at DESC
        `,
        [`${from}T00:00:00Z`, `${to}T23:59:59Z`],
      )
      return rows
    }
    case 'grn_report': {
      const { rows } = await query(
        `
          SELECT
            gr.*,
            bp.name AS brand_partner_name,
            u.full_name AS received_by_name,
            gi.quantity_received,
            gi.unit_fraction,
            gi.expiry_date,
            p.name AS product_name,
            p.sku_code
          FROM grn_records gr
          JOIN grn_items gi ON gi.grn_id = gr.id
          JOIN products p ON p.id = gi.product_id
          JOIN brand_partners bp ON bp.id = gr.brand_partner_id
          LEFT JOIN app_users u ON u.id = gr.received_by
          WHERE gr.created_at >= $1::timestamptz
            AND gr.created_at <= $2::timestamptz
          ORDER BY gr.created_at DESC
        `,
        [`${from}T00:00:00Z`, `${to}T23:59:59Z`],
      )
      return rows
    }
    case 'casualty_report':
      return (await listCasualties()).filter((row) => {
        if (!from || !to) return true
        const createdAt = new Date(row.created_at).toISOString()
        return createdAt >= `${from}T00:00:00.000Z` && createdAt <= `${to}T23:59:59.999Z`
      })
    case 'variance_report': {
      const detail = await query(
        `
          SELECT
            cs.session_ref,
            cs.opened_at,
            cs.status AS session_status,
            p.name AS product_name,
            p.sku_code,
            bp.name AS brand_partner,
            cl.system_quantity,
            cl.counted_quantity,
            cl.variance,
            cl.variance_note
          FROM count_lines cl
          JOIN count_sessions cs ON cs.id = cl.session_id
          JOIN products p ON p.id = cl.product_id
          JOIN brand_partners bp ON bp.id = p.brand_partner_id
          WHERE cl.variance IS NOT NULL
            AND cl.variance <> 0
          ORDER BY cs.opened_at DESC, p.name ASC
        `,
      )
      return detail.rows
    }
    default:
      throw createHttpError(404, 'Unknown report.')
  }
}
