import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const repositoryMocks = vi.hoisted(() => ({
  getCurrentStock: vi.fn(),
  getDashboardData: vi.fn(),
  getExpiryAlerts: vi.fn(),
  getMovements: vi.fn(),
  getMoveFirstBatchAlerts: vi.fn(),
  getOpsSummary: vi.fn(),
  getReorderAlerts: vi.fn(),
  listAvailableBatches: vi.fn(),
  refreshBatchStatuses: vi.fn(),
}))

const serviceMocks = vi.hoisted(() => ({
  deliverOpsSummaryToUser: vi.fn(),
  getOpsSummaryDeliveryState: vi.fn(),
  saveOpsSummaryPreferences: vi.fn(),
}))

vi.mock('../repositories/inventory-repository.js', () => repositoryMocks)
vi.mock('../services/ops-summary-service.js', () => serviceMocks)

describe('inventory routes', () => {
  let inventoryRouter
  let signAuthToken
  let errorHandler

  beforeEach(async () => {
    vi.resetModules()
    Object.values(repositoryMocks).forEach((mock) => mock.mockReset())
    Object.values(serviceMocks).forEach((mock) => mock.mockReset())
    ;({ inventoryRouter } = await import('./inventory.js'))
    ;({ signAuthToken } = await import('../lib/auth.js'))
    ;({ errorHandler } = await import('../middleware/error-handler.js'))
  })

  it('returns ops summary preference state for the signed-in user', async () => {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/api/inventory', inventoryRouter)
    app.use(errorHandler)

    serviceMocks.getOpsSummaryDeliveryState.mockResolvedValue({
      preferences: { user_id: 'user-1', in_app_enabled: true, email_enabled: false },
      deliveries: [],
    })

    const token = signAuthToken({
      id: 'user-1',
      email: 'ops@dala.ng',
      full_name: 'Ops User',
      role: 'operations',
      is_active: true,
    })

    const response = await request(app)
      .get('/api/inventory/ops-summary/preferences')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(200)
    expect(response.body.preferences.user_id).toBe('user-1')
  })

  it('allows an operator to trigger the daily summary immediately', async () => {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/api/inventory', inventoryRouter)
    app.use(errorHandler)

    serviceMocks.deliverOpsSummaryToUser.mockResolvedValue({
      delivered: true,
      deliveries: [{ channel: 'in_app', delivery_status: 'sent' }],
    })

    const token = signAuthToken({
      id: 'user-1',
      email: 'ops@dala.ng',
      full_name: 'Ops User',
      role: 'operations',
      is_active: true,
    })

    const response = await request(app)
      .post('/api/inventory/ops-summary/send-now')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(response.status).toBe(200)
    expect(response.body.delivered).toBe(true)
    expect(serviceMocks.deliverOpsSummaryToUser).toHaveBeenCalledWith('user-1')
  })
})
