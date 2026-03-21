import nodemailer from 'nodemailer'
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../config/env.js'

function hasResendConfig() {
  return Boolean(env.RESEND_API_KEY && env.RESEND_FROM_EMAIL)
}

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM_EMAIL)
}

function createTransport() {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE === 'true',
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    dnsTimeout: 15000,
  })
}

function fromAddress() {
  if (!env.SMTP_FROM_EMAIL) return undefined
  return env.SMTP_FROM_NAME ? `"${env.SMTP_FROM_NAME}" <${env.SMTP_FROM_EMAIL}>` : env.SMTP_FROM_EMAIL
}

function resendFromAddress() {
  if (!env.RESEND_FROM_EMAIL) return undefined
  return env.RESEND_FROM_NAME ? `${env.RESEND_FROM_NAME} <${env.RESEND_FROM_EMAIL}>` : env.RESEND_FROM_EMAIL
}

async function sendViaResend({ to, subject, html, text }) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromAddress(),
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
        reply_to: env.RESEND_REPLY_TO || undefined,
      }),
      signal: controller.signal,
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      const error = new Error(payload?.message || payload?.error || `Resend request failed with status ${response.status}.`)
      error.code = `RESEND_${response.status}`
      throw error
    }

    return {
      status: 'sent',
      provider: 'resend',
      messageId: payload?.id || null,
      accepted: Array.isArray(to) ? to : [to],
      rejected: [],
    }
  } finally {
    clearTimeout(timeout)
  }
}

async function sendEmailViaProcess(message) {
  const currentDir = path.dirname(fileURLToPath(import.meta.url))
  const jobPath = path.resolve(currentDir, '../scripts/send-email-job.js')

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [jobPath], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
    })

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })

    child.on('error', reject)

    child.on('close', (code) => {
      if (code === 0) {
        resolve(JSON.parse(stdout))
        return
      }

      try {
        reject(JSON.parse(stderr))
      } catch {
        reject(new Error(stderr || `Email process exited with code ${code}.`))
      }
    })

    child.stdin.write(JSON.stringify(message))
    child.stdin.end()
  })
}

export async function sendEmail({ to, subject, html, text }) {
  if (hasResendConfig()) {
    return sendViaResend({ to, subject, html, text })
  }

  if (!hasSmtpConfig()) {
    return { status: 'disabled', message: 'No email provider is configured.' }
  }

  return sendEmailViaProcess({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  })
}

export function emailConfigured() {
  return hasResendConfig() || hasSmtpConfig()
}
