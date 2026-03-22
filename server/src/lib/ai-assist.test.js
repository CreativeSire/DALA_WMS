import { describe, expect, it } from 'vitest'
import { buildCountVarianceInsights, buildDailyOpsSummary, rankMoveFirstBatches, scoreDispatchAnomalies } from './ai-assist.js'

describe('ai assist helpers', () => {
  it('flags unusually large dispatches', () => {
    const warnings = scoreDispatchAnomalies(
      [{ productId: 'p1', quantity: 30, unitFraction: 1 }],
      [{ product_id: 'p1', product_name: 'Cola', sku_code: 'COL-001', dispatch_count: 6, avg_qty: 10, max_qty: 20 }],
    )

    expect(warnings).toHaveLength(1)
    expect(warnings[0].severity).toBe('high')
    expect(warnings[0].productName).toBe('Cola')
  })

  it('ranks move-first batches by expiry and age', () => {
    const ranked = rankMoveFirstBatches([
      { batch_id: 'b1', batch_number: 'A-001', quantity_remaining: 12, product_id: 'p1', product_name: 'Milk', sku_code: 'MLK', brand_partner: 'DALA', days_in_stock: 10, days_until_expiry: 1 },
      { batch_id: 'b2', batch_number: 'B-001', quantity_remaining: 12, product_id: 'p2', product_name: 'Soap', sku_code: 'SP', brand_partner: 'DALA', days_in_stock: 95, days_until_expiry: 20 },
    ])

    expect(ranked[0].batchId).toBe('b1')
    expect(ranked[0].reason).toContain('expires')
  })

  it('groups count variances by partner and batch family', () => {
    const insights = buildCountVarianceInsights(
      [
        { product_id: 'p1', brand_partner: 'Partner A', variance: 3 },
        { product_id: 'p2', brand_partner: 'Partner A', variance: -2 },
        { product_id: 'p3', brand_partner: 'Partner B', variance: 0 },
      ],
      [
        { product_id: 'p1', batch_family: 'JAN2026' },
        { product_id: 'p2', batch_family: 'JAN2026' },
      ],
    )

    expect(insights.some((item) => item.type === 'partner_cluster')).toBe(true)
    expect(insights.some((item) => item.type === 'batch_family_cluster')).toBe(true)
  })

  it('builds a plain-language daily ops summary', () => {
    const summary = buildDailyOpsSummary({
      dashboard: { lowStock: 1, outOfStock: 0, nearExpiry: 2, expired: 0, pendingCasualties: 1 },
      moveFirstBatches: [{ productName: 'Milk', reason: 'expires within the week' }],
      unusualDispatches: [{ productName: 'Cola' }],
      pendingDispatches: 2,
      submittedCountSessions: 1,
    })

    expect(summary.priorities.length).toBeGreaterThan(0)
    expect(summary.summaryLines.join(' ')).toContain('Milk')
    expect(summary.pendingApprovals.dispatches).toBe(2)
  })
})
