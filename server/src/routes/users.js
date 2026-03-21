import { Router } from 'express'
import { z } from 'zod'
import { addDays } from '../utils/date.js'
import { generateInviteToken, hashInviteToken, hashPassword, sanitizeUser } from '../lib/auth.js'
import { asyncHandler, createHttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createInvite, createUser, listUsers, updateUserStatus } from '../repositories/users-repository.js'
import { env } from '../config/env.js'

const roleEnum = z.enum(['admin', 'warehouse_manager', 'operations', 'finance', 'security'])

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
  role: roleEnum,
  is_active: z.boolean().optional(),
})

const inviteUserSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(2),
  role: roleEnum,
})

const updateStatusSchema = z.object({
  is_active: z.boolean(),
})

export const usersRouter = Router()

usersRouter.use(requireAuth, requireRole('admin'))

usersRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const users = await listUsers()
    res.json({ users })
  }),
)

usersRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const payload = createUserSchema.parse(req.body)
    const passwordHash = await hashPassword(payload.password)

    const user = await createUser({
      ...payload,
      password_hash: passwordHash,
    })

    res.status(201).json({
      message: `User ${user.full_name} created successfully.`,
      user: sanitizeUser(user),
    })
  }),
)

usersRouter.post(
  '/invite',
  asyncHandler(async (req, res) => {
    const payload = inviteUserSchema.parse(req.body)
    const token = generateInviteToken()
    const invite = await createInvite({
      ...payload,
      token_hash: hashInviteToken(token),
      expires_at: addDays(new Date(), 7),
      invited_by: req.user.sub,
    })

    const inviteUrl = `${env.FRONTEND_ORIGIN.replace(/\/$/, '')}/complete-invite?token=${token}`

    res.status(201).json({
      message: `Invite prepared for ${invite.email}.`,
      invite,
      invite_url: inviteUrl,
      token,
    })
  }),
)

usersRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const payload = updateStatusSchema.parse(req.body)
    const user = await updateUserStatus(req.params.id, payload.is_active)

    if (!user) {
      throw createHttpError(404, 'User not found.')
    }

    res.json({
      message: `${user.full_name} is now ${user.is_active ? 'active' : 'inactive'}.`,
      user: sanitizeUser(user),
    })
  }),
)
