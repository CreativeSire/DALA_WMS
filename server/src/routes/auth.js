import { Router } from 'express'
import { z } from 'zod'
import { clearAuthCookie, hashInviteToken, hashPassword, sanitizeUser, setAuthCookie, signAuthToken, verifyPassword } from '../lib/auth.js'
import { asyncHandler, createHttpError } from '../lib/http.js'
import { requireAuth } from '../middleware/auth.js'
import { completeInvite, findInviteByTokenHash, findUserByEmail, findUserById } from '../repositories/users-repository.js'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

const completeInviteSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
})

export const authRouter = Router()

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const payload = loginSchema.parse(req.body)
    const user = await findUserByEmail(payload.email)

    if (!user || !(await verifyPassword(payload.password, user.password_hash))) {
      throw createHttpError(401, 'Invalid email or password.')
    }

    if (!user.is_active) {
      throw createHttpError(403, 'This account is inactive.')
    }

    const token = signAuthToken(user)
    setAuthCookie(res, token)

    res.json({
      user: sanitizeUser(user),
      token,
    })
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await findUserById(req.user.sub)

    if (!user || !user.is_active) {
      throw createHttpError(401, 'Session is no longer valid.')
    }

    res.json({ user: sanitizeUser(user) })
  }),
)

authRouter.post(
  '/complete-invite',
  asyncHandler(async (req, res) => {
    const payload = completeInviteSchema.parse(req.body)
    const invite = await findInviteByTokenHash(hashInviteToken(payload.token))

    if (!invite) {
      throw createHttpError(400, 'Invite is invalid, expired, or already used.')
    }

    const user = await completeInvite(invite, await hashPassword(payload.password))
    const token = signAuthToken(user)
    setAuthCookie(res, token)

    res.status(201).json({
      message: 'Invite completed successfully.',
      user: sanitizeUser(user),
      token,
    })
  }),
)

authRouter.post('/logout', (_req, res) => {
  clearAuthCookie(res)
  res.status(204).send()
})
