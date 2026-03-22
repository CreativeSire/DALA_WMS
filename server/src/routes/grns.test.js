import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const inventoryMocks = vi.hoisted(() => ({
  createGrn: vi.fn(),
  listGrns: vi.fn(),
}))

const partnerMocks = vi.hoisted(() => ({
  listPartners: vi.fn(),
}))

const productMocks = vi.hoisted(() => ({
  listProducts: vi.fn(),
}))

const captureMocks = vi.hoisted(() => ({
  suggestGrnFromDocument: vi.fn(),
}))

vi.mock('../repositories/inventory-repository.js', () => inventoryMocks)
vi.mock('../repositories/partners-repository.js', () => partnerMocks)
vi.mock('../repositories/products-repository.js', () => productMocks)
vi.mock('../lib/document-capture.js', () => captureMocks)

describe('grn routes', () => {
  let grnsRouter
  let signAuthToken
  let errorHandler

  beforeEach(async () => {
    vi.resetModules()
    Object.values(inventoryMocks).forEach((mock) => mock.mockReset())
    Object.values(partnerMocks).forEach((mock) => mock.mockReset())
    Object.values(productMocks).forEach((mock) => mock.mockReset())
    Object.values(captureMocks).forEach((mock) => mock.mockReset())
    ;({ grnsRouter } = await import('./grns.js'))
    ;({ signAuthToken } = await import('../lib/auth.js'))
    ;({ errorHandler } = await import('../middleware/error-handler.js'))
  })

  it('returns document suggestions for a warehouse manager', async () => {
    const app = express()
    app.use(express.json({ limit: '1mb' }))
    app.use(cookieParser())
    app.use('/api/grns', grnsRouter)
    app.use(errorHandler)

    productMocks.listProducts.mockResolvedValue([{ id: 'p1', is_active: true }])
    partnerMocks.listPartners.mockResolvedValue([{ id: 'bp1', is_active: true }])
    captureMocks.suggestGrnFromDocument.mockResolvedValue({
      provider: 'fallback',
      partnerId: 'bp1',
      lines: [{ productId: 'p1', quantity: 12 }],
      notes: [],
    })

    const token = signAuthToken({
      id: 'user-1',
      email: 'warehouse@dala.ng',
      full_name: 'Warehouse Lead',
      role: 'warehouse_manager',
      is_active: true,
    })

    const response = await request(app)
      .post('/api/grns/document-suggestions')
      .set('Authorization', `Bearer ${token}`)
      .send({ documentText: 'Supplier note' })

    expect(response.status).toBe(200)
    expect(response.body.partnerId).toBe('bp1')
    expect(captureMocks.suggestGrnFromDocument).toHaveBeenCalled()
  })
})
