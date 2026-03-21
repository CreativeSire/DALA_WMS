import { describe, expect, it } from 'vitest'
import { allocateFIFOFromBatches, getAvailableQuantity, planCountAdjustment } from './inventory'

describe('inventory helpers', () => {
  it('sums available quantity across batches', () => {
    expect(getAvailableQuantity([
      { quantity_remaining: 3.5 },
      { quantity_remaining: 1.25 },
      { quantity_remaining: 0 },
    ])).toBe(4.75)
  })

  it('allocates dispatch quantities in FIFO order', () => {
    const { allocations, shortfall } = allocateFIFOFromBatches([
      { id: 'b1', quantity_remaining: 2 },
      { id: 'b2', quantity_remaining: 3 },
      { id: 'b3', quantity_remaining: 5 },
    ], 4)

    expect(allocations).toEqual([
      { batchId: 'b1', quantity: 2 },
      { batchId: 'b2', quantity: 2 },
    ])
    expect(shortfall).toBe(0)
  })

  it('reports dispatch shortfall when stock is insufficient', () => {
    const { allocations, shortfall } = allocateFIFOFromBatches([
      { id: 'b1', quantity_remaining: 1 },
      { id: 'b2', quantity_remaining: 1.5 },
    ], 5)

    expect(allocations).toEqual([
      { batchId: 'b1', quantity: 1 },
      { batchId: 'b2', quantity: 1.5 },
    ])
    expect(shortfall).toBe(2.5)
  })

  it('plans count adjustments against the latest active batch when one exists', () => {
    const plan = planCountAdjustment({
      session_ref: 'CNT-20260321-101',
      product_name: 'Milo 400g',
      counted_quantity: 12,
      variance: -3,
      variance_note: 'Three cartons damaged on shelf',
    }, [
      { id: 'batch-1', quantity_remaining: 20, status: 'active' },
    ])

    expect(plan.type).toBe('existing-batch')
    expect(plan.batch.id).toBe('batch-1')
    expect(plan.newQty).toBe(17)
  })

  it('creates a reconciliation batch when a positive variance has no active batch', () => {
    const plan = planCountAdjustment({
      session_ref: 'CNT-20260321-102',
      product_name: 'Milo 400g',
      counted_quantity: 4,
      variance: 4,
      variance_note: 'Loose cartons found during sweep',
    }, [])

    expect(plan).toEqual({
      type: 'new-batch',
      batchNumber: 'COUNT-CNT-20260321-102',
      quantity: 4,
      movementNote: 'Physical count surplus: Loose cartons found during sweep',
      batchNote: 'Created from physical count surplus in CNT-20260321-102',
    })
  })

  it('fails explicitly when a negative variance has no active batch', () => {
    expect(() => planCountAdjustment({
      session_ref: 'CNT-20260321-103',
      product_name: 'Milo 400g',
      counted_quantity: 0,
      variance: -2,
      variance_note: '',
    }, [])).toThrow('Cannot apply negative variance')
  })
})
