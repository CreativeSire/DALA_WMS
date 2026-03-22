import { sendEmail } from '../lib/mailer.js'
import {
  createOpsSummaryDelivery,
  getOpsSummary,
  getOpsSummaryPreferences,
  listDueOpsSummaryRecipients,
  listOpsSummaryDeliveries,
  markOpsSummarySent,
  updateOpsSummaryPreferences,
} from '../repositories/inventory-repository.js'
import { findUserById } from '../repositories/users-repository.js'

function toSummaryDate(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function buildEmailHtml(user, summary) {
  return `
    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1b1f24;">
      <h2>DALA WMS daily ops summary</h2>
      <p>Hello ${user.full_name},</p>
      <p>${summary.headline}</p>
      <ul>
        ${summary.summaryLines.map((line) => `<li>${line}</li>`).join('')}
      </ul>
      ${summary.priorities.length ? `
        <h3>Priority actions</h3>
        <ul>${summary.priorities.map((item) => `<li><strong>${item.title}:</strong> ${item.detail}</li>`).join('')}</ul>
      ` : ''}
    </div>
  `
}

function buildEmailText(user, summary) {
  return [
    `Hello ${user.full_name},`,
    '',
    summary.headline,
    '',
    ...summary.summaryLines.map((line) => `- ${line}`),
    ...(summary.priorities.length ? ['', 'Priority actions:', ...summary.priorities.map((item) => `- ${item.title}: ${item.detail}`)] : []),
  ].join('\n')
}

export async function getOpsSummaryDeliveryState(userId) {
  const [preferences, deliveries] = await Promise.all([
    getOpsSummaryPreferences(userId),
    listOpsSummaryDeliveries(userId, { limit: 8 }),
  ])

  return { preferences, deliveries }
}

export async function saveOpsSummaryPreferences(userId, input) {
  return updateOpsSummaryPreferences(userId, input)
}

export async function deliverOpsSummaryToUser(userId, { channels } = {}) {
  const [user, preferences, summary] = await Promise.all([
    findUserById(userId),
    getOpsSummaryPreferences(userId),
    getOpsSummary(),
  ])

  if (!user || !user.is_active) {
    return { delivered: false, reason: 'inactive_user' }
  }

  const summaryDate = toSummaryDate()
  const selectedChannels = channels || [
    ...(preferences.in_app_enabled ? ['in_app'] : []),
    ...(preferences.email_enabled ? ['email'] : []),
  ]

  const results = []

  if (selectedChannels.includes('in_app')) {
    const delivery = await createOpsSummaryDelivery({
      userId,
      summaryDate,
      channel: 'in_app',
      summary,
      status: 'sent',
    })
    results.push(delivery)
  }

  if (selectedChannels.includes('email')) {
    try {
      const emailResult = await sendEmail({
        to: user.email,
        subject: 'DALA WMS daily ops summary',
        text: buildEmailText(user, summary),
        html: buildEmailHtml(user, summary),
      })

      const delivery = await createOpsSummaryDelivery({
        userId,
        summaryDate,
        channel: 'email',
        summary,
        status: emailResult.status === 'sent' ? 'sent' : emailResult.status,
        error: emailResult.error || null,
      })
      results.push(delivery)
    } catch (error) {
      const delivery = await createOpsSummaryDelivery({
        userId,
        summaryDate,
        channel: 'email',
        summary,
        status: 'failed',
        error: error.message,
      })
      results.push(delivery)
    }
  }

  if (results.some((item) => item.channel === 'in_app' || item.delivery_status === 'sent')) {
    await markOpsSummarySent(userId, summaryDate)
  }

  return {
    delivered: true,
    summary,
    deliveries: results,
  }
}

export async function deliverDueOpsSummaries() {
  const recipients = await listDueOpsSummaryRecipients()
  const results = []

  for (const recipient of recipients) {
    const result = await deliverOpsSummaryToUser(recipient.user_id)
    results.push({
      userId: recipient.user_id,
      email: recipient.email,
      result,
    })
  }

  return results
}
