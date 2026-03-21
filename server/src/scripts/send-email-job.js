import nodemailer from 'nodemailer'

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = ''
    process.stdin.setEncoding('utf8')
    process.stdin.on('data', (chunk) => {
      data += chunk
    })
    process.stdin.on('end', () => resolve(data))
    process.stdin.on('error', reject)
  })
}

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 15000,
    dnsTimeout: 15000,
  })
}

async function main() {
  const raw = await readStdin()
  const payload = JSON.parse(raw)
  const transporter = createTransport()
  const info = await transporter.sendMail(payload)
  process.stdout.write(JSON.stringify({
    status: 'sent',
    messageId: info.messageId,
    accepted: info.accepted || [],
    rejected: info.rejected || [],
  }))
}

main().catch((error) => {
  process.stderr.write(JSON.stringify({
    status: 'failed',
    error: error?.message || String(error),
    code: error?.code || null,
    command: error?.command || null,
  }))
  process.exit(1)
})
