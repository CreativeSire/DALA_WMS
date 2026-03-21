export function getAvailableQuantity(batches) {
  return (batches || []).reduce((sum, batch) => sum + Number(batch.quantity_remaining || 0), 0)
}

export function allocateFIFOFromBatches(batches, totalQty) {
  const allocations = []
  let remaining = Number(totalQty || 0)

  for (const batch of batches || []) {
    if (remaining <= 0) break
    const available = Number(batch.quantity_remaining || 0)
    if (available <= 0) continue

    const take = Math.min(remaining, available)
    allocations.push({ batchId: batch.id, quantity: take })
    remaining -= take
  }

  return { allocations, shortfall: remaining }
}

export function planCountAdjustment(line, batches = []) {
  if (line.counted_quantity === null || line.counted_quantity === undefined || line.variance === 0) {
    return { type: 'none' }
  }

  if (batches.length > 0) {
    const batch = batches[0]
    return {
      type: 'existing-batch',
      batch,
      newQty: Math.max(0, Number(batch.quantity_remaining || 0) + Number(line.variance || 0)),
      movementNote: `Physical count adjustment: ${line.variance_note || 'Count reconciliation'}`,
    }
  }

  if (line.variance > 0) {
    return {
      type: 'new-batch',
      batchNumber: `COUNT-${line.session_ref}`,
      quantity: Number(line.variance),
      movementNote: `Physical count surplus: ${line.variance_note || 'Count reconciliation'}`,
      batchNote: `Created from physical count surplus in ${line.session_ref}`,
    }
  }

  throw new Error(`Cannot apply negative variance for ${line.product_name} because no active batch is available.`)
}
