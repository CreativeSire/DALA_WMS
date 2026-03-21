import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const repositoryMocks = vi.hoisted(() => ({
  completeInvite: vi.fn(),
  findInviteByTokenHash: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
  updateUserPassword: vi.fn(),
}))

vi.mock('../repositories/users-repository.js', () => repositoryMocks)

describe('auth routes', () => {
  let authRouter
  let signAuthToken
  let errorHandler

  beforeEach(async () => {
    vi.resetModules()
    Object.values(repositoryMocks).forEach((mock) => mock.mockReset())
    ;({ authRouter } = await import('./auth.js'))
    ;({ signAuthToken } = await import('../lib/auth.js'))
    ;({ errorHandler } = await import('../middleware/error-handler.js'))
  })

  it('changes password for an authenticated user', async () => {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/auth', authRouter)
    app.use(errorHandler)

    repositoryMocks.findUserById.mockResolvedValue({
      id: 'user-1',
      email: 'admin@dala.ng',
      full_name: 'Admin User',
      role: 'admin',
      is_active: true,
      password_hash: await (await import('../lib/auth.js')).hashPassword('OldPassword123!'),
    })
    repositoryMocks.updateUserPassword.mockResolvedValue({
      id: 'user-1',
      email: 'admin@dala.ng',
      full_name: 'Admin User',
      role: 'admin',
      is_active: true,
    })

    const token = signAuthToken({
      id: 'user-1',
      email: 'admin@dala.ng',
      full_name: 'Admin User',
      role: 'admin',
      is_active: true,
    })

    const response = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword456!',
      })

    expect(response.status).toBe(200)
    expect(response.body.message).toBe('Password changed successfully.')
    expect(repositoryMocks.updateUserPassword).toHaveBeenCalled()
  })

  it('rejects incorrect current password', async () => {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/auth', authRouter)
    app.use(errorHandler)

    repositoryMocks.findUserById.mockResolvedValue({
      id: 'user-1',
      email: 'admin@dala.ng',
      full_name: 'Admin User',
      role: 'admin',
      is_active: true,
      password_hash: await (await import('../lib/auth.js')).hashPassword('OldPassword123!'),
    })

    const token = signAuthToken({
      id: 'user-1',
      email: 'admin@dala.ng',
      full_name: 'Admin User',
      role: 'admin',
      is_active: true,
    })

    const response = await request(app)
      .post('/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewPassword456!',
      })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('Current password is incorrect.')
  })
})
