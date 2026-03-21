import request from 'supertest'
import { describe, expect, it, vi } from 'vitest'

vi.mock('./lib/db.js', () => ({
  query: vi.fn().mockResolvedValue({ rows: [{ ok: 1 }] }),
}))

describe('server app', async () => {
  const { createApp } = await import('./app.js')

  it('serves the root API document', async () => {
    const response = await request(createApp()).get('/')
    expect(response.status).toBe(200)
    expect(response.body.service).toBe('dala-wms-server')
  })

  it('serves health checks', async () => {
    const response = await request(createApp()).get('/health')
    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
  })
})
