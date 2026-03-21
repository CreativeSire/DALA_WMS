import { describe, expect, it } from 'vitest'
import { clearAuthCookie, hashInviteToken, hashPassword, sanitizeUser, setAuthCookie, verifyPassword } from './auth.js'

describe('auth helpers', () => {
  it('hashes and verifies passwords', async () => {
    const hash = await hashPassword('ChangeMe123!')
    await expect(verifyPassword('ChangeMe123!', hash)).resolves.toBe(true)
    await expect(verifyPassword('wrong-password', hash)).resolves.toBe(false)
  })

  it('sanitizes user objects', () => {
    const user = sanitizeUser({
      id: '1',
      email: 'admin@dala.ng',
      full_name: 'Admin User',
      role: 'admin',
      is_active: true,
      created_at: 'now',
      updated_at: 'now',
      password_hash: 'secret',
    })

    expect(user).not.toHaveProperty('password_hash')
    expect(user.email).toBe('admin@dala.ng')
  })

  it('produces stable invite hashes', () => {
    expect(hashInviteToken('token-value')).toBe(hashInviteToken('token-value'))
  })

  it('sets and clears auth cookies', () => {
    const cookies = []
    const response = {
      cookie(name, value, options) {
        cookies.push({ type: 'set', name, value, options })
      },
      clearCookie(name, options) {
        cookies.push({ type: 'clear', name, options })
      },
    }

    setAuthCookie(response, 'jwt-token')
    clearAuthCookie(response)

    expect(cookies[0]).toMatchObject({ type: 'set', name: 'dala_wms_token', value: 'jwt-token' })
    expect(cookies[1]).toMatchObject({ type: 'clear', name: 'dala_wms_token' })
  })
})
