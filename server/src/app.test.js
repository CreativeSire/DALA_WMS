import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./lib/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
}))
vi.mock('./lib/mailer.js', () => ({
  sendEmail: vi.fn(),
  emailConfigured: vi.fn().mockReturnValue(false),
}))

describe('server app', async () => {
  const { createApp } = await import('./app.js')

  it('serves the root API document', async () => {
    const response = await request(createApp()).get('/')
    expect(response.status).toBe(200)
    expect(response.body.service).toBe('dala-wms-server')
    expect(response.body.docs.adminAudit).toBe('/api/admin/audit-logs')
  })

  it('serves health checks', async () => {
    const response = await request(createApp()).get('/health')
    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
  })
})
