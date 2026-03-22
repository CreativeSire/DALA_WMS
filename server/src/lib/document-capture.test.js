import { describe, expect, it } from 'vitest'
import { suggestGrnFromDocument } from './document-capture.js'

describe('document capture fallback', () => {
  it('matches partner and SKU from pasted text', async () => {
    const result = await suggestGrnFromDocument({
      documentText: 'Supplier: Honeywell Flour. Item HON-FLOUR-25KG quantity 40.',
      products: [
        { id: 'p1', sku_code: 'HON-FLOUR-25KG', name: 'Honeywell Flour 25kg' },
      ],
      partners: [
        { id: 'bp1', name: 'Honeywell Flour' },
      ],
    })

    expect(result.partnerId).toBe('bp1')
    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].productId).toBe('p1')
    expect(result.lines[0].quantity).toBe(40)
  })
})
