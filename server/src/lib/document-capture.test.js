import { describe, expect, it } from 'vitest'
import { suggestGrnFromDocument } from './document-capture.js'

describe('document capture fallback', () => {
  it('matches partner and SKU from pasted text', async () => {
    const result = await suggestGrnFromDocument({
      documentText: 'Supplier: Honeywell Flour. Item HON-FLOUR-25KG quantity 40.',
      products: [
        { id: 'p1', sku_code: 'HON-FLOUR-25KG', name: 'Honeywell Flour 25kg', product_aliases: [] },
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

  it('matches alias text from document variations', async () => {
    const result = await suggestGrnFromDocument({
      documentText: 'Description of Goods: ZLS 500ml Low Fat Sweet Greek Yoghurt shipped 6.',
      products: [
        {
          id: 'p2',
          sku_code: 'ZY-ZLS-500',
          internal_barcode_value: 'DALA-ZY-ZLS-500',
          barcode_value: '6151100000000',
          name: 'ZY- ZLS 500ml Low Fat Sweetend Greek Yoghurt (12x)',
          product_aliases: ['ZLS 500ml Low Fat Sweet Greek Yoghurt'],
        },
      ],
      partners: [],
    })

    expect(result.lines).toHaveLength(1)
    expect(result.lines[0].productId).toBe('p2')
    expect(result.lines[0].quantity).toBe(6)
  })
})
