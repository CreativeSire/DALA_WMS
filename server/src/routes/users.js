import { Router } from 'express'
import { z } from 'zod'
import { addDays } from '../utils/date.js'
import crypto from 'crypto'
import { generateInviteToken, hashInviteToken, hashPassword, sanitizeUser } from '../lib/auth.js'
import { asyncHandler, createHttpError } from '../lib/http.js'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { createAdminAuditLog } from '../repositories/admin-audit-repository.js'
import { sendEmail } from '../lib/mailer.js'
import { createInvite, createUser, findUserById, listUsers, updateUserPassword, updateUserStatus } from '../repositories/users-repository.js'
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

const resetPasswordSchema = z.object({
  password: z.string().min(8).optional(),
})

export const usersRouter = Router()

usersRouter.use(requireAuth, requireRole('admin'))

async function deliverEmail(action, targetEmail, job) {
  try {
    return await job()
  } catch (error) {
    const normalized = typeof error === 'object' && error !== null
      ? error
      : { error: String(error) }

    return {
      status: 'failed',
      error: normalized.message || normalized.error || 'Email delivery failed.',
      code: normalized.code || null,
      command: normalized.command || null,
      action,
      targetEmail,
    }
  }
}

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
    await createAdminAuditLog({
      actorUserId: req.user.sub,
      targetUserId: user.id,
      action: 'user_created',
      summary: `Created ${user.full_name} as ${user.role}.`,
      details: { email: user.email, role: user.role },
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
    const emailResult = await deliverEmail('invite', invite.email, () => sendEmail({
      to: invite.email,
      subject: 'You have been invited to DALA WMS',
      text: `Hello ${invite.full_name},\n\nYou have been invited to DALA WMS as ${invite.role}.\nOpen this link to set your password and start using the system:\n${inviteUrl}\n\nThis link expires in 7 days.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #102127;">
          <h2>You have been invited to DALA WMS</h2>
          <p>Hello ${invite.full_name},</p>
          <p>You have been invited to DALA WMS as <strong>${invite.role}</strong>.</p>
          <p><a href="${inviteUrl}">Open this link to set your password and start using the system</a>.</p>
          <p>This link expires in 7 days.</p>
        </div>
      `,
    }))
    await createAdminAuditLog({
      actorUserId: req.user.sub,
      targetUserId: null,
      action: emailResult.status === 'sent' ? 'email_delivery_sent' : 'email_delivery_failed',
      summary: `Invite email ${emailResult.status === 'sent' ? 'sent' : 'not sent'} for ${invite.email}.`,
      details: {
        invite_email: invite.email,
        status: emailResult.status,
        invite_url: inviteUrl,
        error: emailResult.error || null,
        code: emailResult.code || null,
        command: emailResult.command || null,
      },
    })
    await createAdminAuditLog({
      actorUserId: req.user.sub,
      targetUserId: null,
      action: 'invite_sent',
      summary: `Prepared invite for ${invite.full_name}.`,
      details: { email: invite.email, role: invite.role, invite_url: inviteUrl, email_status: emailResult.status },
    })

    res.status(201).json({
      message: emailResult.status === 'sent'
        ? `Invite prepared and emailed to ${invite.email}.`
        : `Invite prepared for ${invite.email}, but email delivery is not configured or failed.`,
      invite,
      invite_url: inviteUrl,
      token,
      email_status: emailResult.status,
      email_error: emailResult.error || null,
    })
  }),
)

usersRouter.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const payload = updateStatusSchema.parse(req.body)
    if (req.params.id === req.user.sub && payload.is_active === false) {
      throw createHttpError(400, 'You cannot deactivate your own account.')
    }

    const user = await updateUserStatus(req.params.id, payload.is_active)

    if (!user) {
      throw createHttpError(404, 'User not found.')
    }
    await createAdminAuditLog({
      actorUserId: req.user.sub,
      targetUserId: user.id,
      action: user.is_active ? 'user_activated' : 'user_deactivated',
      summary: `${user.full_name} is now ${user.is_active ? 'active' : 'inactive'}.`,
      details: { email: user.email, role: user.role },
    })

    res.json({
      message: `${user.full_name} is now ${user.is_active ? 'active' : 'inactive'}.`,
      user: sanitizeUser(user),
    })
  }),
)

usersRouter.post(
  '/:id/reset-password',
  asyncHandler(async (req, res) => {
    const payload = resetPasswordSchema.parse(req.body)
    const user = await findUserById(req.params.id)

    if (!user) {
      throw createHttpError(404, 'User not found.')
    }

    const temporaryPassword = payload.password || crypto.randomBytes(9).toString('base64url')
    const updated = await updateUserPassword(user.id, await hashPassword(temporaryPassword))
    const emailResult = await deliverEmail('password_reset', updated.email, () => sendEmail({
      to: updated.email,
      subject: 'Your DALA WMS password has been reset',
      text: `Hello ${updated.full_name},\n\nAn administrator reset your DALA WMS password.\nTemporary password: ${temporaryPassword}\nPlease sign in and change it immediately.`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #102127;">
          <h2>Your DALA WMS password has been reset</h2>
          <p>Hello ${updated.full_name},</p>
          <p>An administrator reset your DALA WMS password.</p>
          <p><strong>Temporary password:</strong> ${temporaryPassword}</p>
          <p>Please sign in and change it immediately.</p>
        </div>
      `,
    }))
    await createAdminAuditLog({
      actorUserId: req.user.sub,
      targetUserId: updated.id,
      action: 'password_reset',
      summary: `Reset password for ${updated.full_name}.`,
      details: { email: updated.email, email_status: emailResult.status },
    })
    await createAdminAuditLog({
      actorUserId: req.user.sub,
      targetUserId: updated.id,
      action: emailResult.status === 'sent' ? 'email_delivery_sent' : 'email_delivery_failed',
      summary: `Password reset email ${emailResult.status === 'sent' ? 'sent' : 'not sent'} for ${updated.email}.`,
      details: {
        email: updated.email,
        status: emailResult.status,
        error: emailResult.error || null,
        code: emailResult.code || null,
        command: emailResult.command || null,
      },
    })

    res.json({
      message: emailResult.status === 'sent'
        ? `Password reset for ${updated.full_name}. A temporary password has been emailed.`
        : `Password reset for ${updated.full_name}. Rotate it on first sign-in.`,
      user: sanitizeUser(updated),
      temporary_password: temporaryPassword,
      email_status: emailResult.status,
      email_error: emailResult.error || null,
    })
  }),
)
