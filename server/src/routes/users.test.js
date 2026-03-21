import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const repositoryMocks = vi.hoisted(() => ({
  createInvite: vi.fn(),
  createUser: vi.fn(),
  findUserById: vi.fn(),
  listUsers: vi.fn(),
  updateUserPassword: vi.fn(),
  updateUserStatus: vi.fn(),
}))

vi.mock('../repositories/users-repository.js', () => repositoryMocks)

describe('users routes', () => {
  let usersRouter
  let signAuthToken
  let errorHandler

  beforeEach(async () => {
    vi.resetModules()
    Object.values(repositoryMocks).forEach((mock) => mock.mockReset())
    ;({ usersRouter } = await import('./users.js'))
    ;({ signAuthToken } = await import('../lib/auth.js'))
    ;({ errorHandler } = await import('../middleware/error-handler.js'))
  })

  it('blocks an admin from deactivating their own account', async () => {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/api/users', usersRouter)
    app.use(errorHandler)

    const token = signAuthToken({
      id: 'admin-1',
      email: 'admin@dala.ng',
      full_name: 'Admin User',
      role: 'admin',
      is_active: true,
    })

    const response = await request(app)
      .patch('/api/users/admin-1/status')
      .set('Authorization', `Bearer ${token}`)
      .send({ is_active: false })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('You cannot deactivate your own account.')
  })

  it('resets a user password and returns a temporary password', async () => {
    const app = express()
    app.use(express.json())
    app.use(cookieParser())
    app.use('/api/users', usersRouter)
    app.use(errorHandler)

    repositoryMocks.findUserById.mockResolvedValue({
      id: 'user-22',
      email: 'ops@dala.ng',
      full_name: 'Ops User',
      role: 'operations',
      is_active: true,
    })
    repositoryMocks.updateUserPassword.mockResolvedValue({
      id: 'user-22',
      email: 'ops@dala.ng',
      full_name: 'Ops User',
      role: 'operations',
      is_active: true,
    })

    const token = signAuthToken({
      id: 'admin-1',
      email: 'admin@dala.ng',
      full_name: 'Admin User',
      role: 'admin',
      is_active: true,
    })

    const response = await request(app)
      .post('/api/users/user-22/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({})

    expect(response.status).toBe(200)
    expect(response.body.temporary_password).toBeTruthy()
    expect(repositoryMocks.updateUserPassword).toHaveBeenCalled()
  })
})
