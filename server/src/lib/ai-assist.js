function round(value, digits = 2) {
  return Number(Number(value || 0).toFixed(digits))
}

export function scoreDispatchAnomalies(lines, statsRows) {
  const statsByProduct = new Map(statsRows.map((row) => [row.product_id, row]))

  return lines.flatMap((line) => {
    const requestedQty = round(Number(line.quantity) * Number(line.unitFraction || 1))
    const stats = statsByProduct.get(line.productId)
    if (!stats || requestedQty <= 0) return []

    const averageQty = round(stats.avg_qty)
    const highestQty = round(stats.max_qty)
    const dispatchCount = Number(stats.dispatch_count || 0)
    const ratioToAverage = averageQty > 0 ? requestedQty / averageQty : 0
    const ratioToHighest = highestQty > 0 ? requestedQty / highestQty : 0
    const minimumHistoryCount = Number(stats.minimum_history_count || 3)
    if (dispatchCount < minimumHistoryCount) return []

    const averageHigh = Number(stats.average_multiplier_high || 3)
    const averageMedium = Number(stats.average_multiplier_medium || 2)
    const averageLow = Number(stats.average_multiplier_low || 1.5)
    const highestHigh = Number(stats.highest_multiplier_high || 1.4)
    const highestMedium = Number(stats.highest_multiplier_medium || 1.15)

    let severity = null
    if (ratioToAverage >= averageHigh || ratioToHighest >= highestHigh) severity = 'high'
    else if (ratioToAverage >= averageMedium || ratioToHighest >= highestMedium) severity = 'medium'
    else if (ratioToAverage >= averageLow) severity = 'low'
    if (!severity) return []

    return [{
      productId: line.productId,
      productName: stats.product_name,
      skuCode: stats.sku_code,
      skuClass: stats.sku_class || 'regular',
      requestedQty,
      averageQty,
      highestQty,
      dispatchCount,
      severity,
      message: `${stats.product_name} is being dispatched at ${requestedQty}. Typical dispatch is ${averageQty} and the highest recent dispatch is ${highestQty}.`,
    }]
  })
}

export function rankMoveFirstBatches(batchRows, limit = 8) {
  return batchRows
    .map((row) => {
      const daysUntilExpiry = row.days_until_expiry == null ? null : Number(row.days_until_expiry)
      const daysInStock = Number(row.days_in_stock || 0)
      let score = 0
      const reasons = []

      if (daysUntilExpiry != null) {
        if (daysUntilExpiry < 0) {
          score += 120
          reasons.push('already expired')
        } else if (daysUntilExpiry <= 2) {
          score += 100
          reasons.push('expires in 2 days or less')
        } else if (daysUntilExpiry <= 7) {
          score += 80
          reasons.push('expires within the week')
        } else if (daysUntilExpiry <= 14) {
          score += 55
          reasons.push('expires soon')
        }
      }

      if (daysInStock >= 90) {
        score += 28
        reasons.push('has stayed in stock for over 90 days')
      } else if (daysInStock >= 45) {
        score += 14
        reasons.push('has stayed in stock for over 45 days')
      }

      if (Number(row.quantity_remaining || 0) >= 10) {
        score += 8
      }

      return {
        batchId: row.batch_id,
        batchNumber: row.batch_number,
        productId: row.product_id,
        productName: row.product_name,
        skuCode: row.sku_code,
        brandPartner: row.brand_partner,
        quantityRemaining: round(row.quantity_remaining),
        daysUntilExpiry,
        daysInStock,
        score,
        reason: reasons.join(', ') || 'older stock should move first',
      }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.daysUntilExpiry - b.daysUntilExpiry || b.daysInStock - a.daysInStock)
    .slice(0, limit)
}

export function buildCountVarianceInsights(lines, batchFamilyRows = []) {
  const varianceLines = lines.filter((line) => Number(line.variance || 0) !== 0)
  if (!varianceLines.length) return []

  const insights = []
  const partnerCounts = new Map()
  for (const line of varianceLines) {
    const partner = line.brand_partner || 'Unknown partner'
    partnerCounts.set(partner, (partnerCounts.get(partner) || 0) + 1)
  }

  for (const [partner, count] of partnerCounts.entries()) {
    if (count >= 2) {
      insights.push({
        type: 'partner_cluster',
        severity: count >= 3 ? 'high' : 'medium',
        title: `${count} variance lines are tied to ${partner}`,
        detail: 'This count session shows repeated differences on products from the same partner. Check receiving quality, storage handling, or dispatch discipline for that partner group.',
      })
    }
  }

  const batchFamilyCounts = new Map()
  for (const row of batchFamilyRows) {
    const family = row.batch_family
    if (!family) continue
    batchFamilyCounts.set(family, (batchFamilyCounts.get(family) || 0) + 1)
  }

  for (const [family, count] of batchFamilyCounts.entries()) {
    if (count >= 2) {
      insights.push({
        type: 'batch_family_cluster',
        severity: count >= 3 ? 'high' : 'medium',
        title: `${count} variance lines share batch family ${family}`,
        detail: 'The affected products point back to similar live batches. Check whether one receiving run, pallet area, or storage block is driving the variance.',
      })
    }
  }

  const totalAbsoluteVariance = round(varianceLines.reduce((sum, line) => sum + Math.abs(Number(line.variance || 0)), 0))
  if (totalAbsoluteVariance > 0) {
    insights.push({
      type: 'variance_total',
      severity: totalAbsoluteVariance >= 20 ? 'high' : 'medium',
      title: `Total variance in this session is ${totalAbsoluteVariance}`,
      detail: 'Review the largest differences first before closing the session. Large combined variance usually means one process issue is affecting multiple items.',
    })
  }

  return insights
}

export function buildDailyOpsSummary({ dashboard, moveFirstBatches, unusualDispatches, pendingDispatches, submittedCountSessions }) {
  const attentionCount = Number(dashboard.lowStock || 0) + Number(dashboard.outOfStock || 0) + Number(dashboard.nearExpiry || 0) + Number(dashboard.expired || 0) + Number(dashboard.pendingCasualties || 0)

  const priorities = []
  if (dashboard.outOfStock > 0) priorities.push({ title: 'Out-of-stock items', detail: `${dashboard.outOfStock} products are already out of stock.`, page: 'reorder' })
  if (dashboard.nearExpiry + dashboard.expired > 0) priorities.push({ title: 'Expiry risk', detail: `${dashboard.nearExpiry + dashboard.expired} batches need expiry attention.`, page: 'expiry' })
  if (pendingDispatches > 0) priorities.push({ title: 'Dispatches awaiting gate confirmation', detail: `${pendingDispatches} dispatches are still pending confirmation.`, page: 'dispatch' })
  if (submittedCountSessions > 0) priorities.push({ title: 'Counts awaiting approval', detail: `${submittedCountSessions} count sessions are waiting for approval.`, page: 'count' })
  if (dashboard.pendingCasualties > 0) priorities.push({ title: 'Write-offs awaiting review', detail: `${dashboard.pendingCasualties} casualties are still pending.`, page: 'casualties' })
  if (unusualDispatches.length > 0) priorities.push({ title: 'Unusual dispatch warning', detail: `${unusualDispatches.length} dispatch lines look larger than normal history.`, page: 'dispatch' })

  const summaryLines = []
  if (attentionCount === 0) summaryLines.push('Stock risk is stable right now.')
  else summaryLines.push(`${attentionCount} stock-risk items need attention today.`)
  if (moveFirstBatches.length) summaryLines.push(`${moveFirstBatches[0].productName} should move first because it ${moveFirstBatches[0].reason}.`)
  if (unusualDispatches.length) summaryLines.push(`${unusualDispatches.length} dispatch lines look unusually large against normal history.`)
  if (submittedCountSessions > 0) summaryLines.push(`There ${submittedCountSessions === 1 ? 'is' : 'are'} ${submittedCountSessions} count session${submittedCountSessions === 1 ? '' : 's'} waiting for approval.`)

  return {
    generatedAt: new Date().toISOString(),
    headline: attentionCount > 0 ? 'Warehouse attention required today.' : 'Warehouse looks stable today.',
    priorities,
    unusualDispatches,
    moveFirstBatches: moveFirstBatches.slice(0, 5),
    pendingApprovals: {
      dispatches: pendingDispatches,
      countSessions: submittedCountSessions,
      casualties: Number(dashboard.pendingCasualties || 0),
    },
    taskWarnings: priorities.slice(0, 6),
    summaryLines,
  }
}
