import nodemailer from 'nodemailer'
import { env } from '../config/env.js'

let transport

function hasEmailConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM_EMAIL)
}

function getTransport() {
  if (!hasEmailConfig()) return null
  if (transport) return transport

  transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  })

  return transport
}

function fromAddress() {
  if (!env.SMTP_FROM_EMAIL) return undefined
  return env.SMTP_FROM_NAME ? `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>` : env.SMTP_FROM_EMAIL
}

export async function sendEmail({ to, subject, html, text }) {
  const emailTransport = getTransport()
  if (!emailTransport) {
    return { status: 'disabled', message: 'SMTP is not configured.' }
  }

  const info = await emailTransport.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  })

  return {
    status: 'sent',
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  }
}

export function emailConfigured() {
  return hasEmailConfig()
}
