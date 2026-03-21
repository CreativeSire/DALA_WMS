import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const isTest = process.env.NODE_ENV === 'test'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(8080),
  DATABASE_URL: isTest
    ? z.string().default('postgresql://test:test@localhost:5432/dala_wms_test')
    : z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: isTest
    ? z.string().default('test-secret-key-that-is-long-enough')
    : z.string().min(24, 'JWT_SECRET must be at least 24 characters'),
  FRONTEND_ORIGIN: z.string().url().default('http://localhost:5173'),
  INITIAL_ADMIN_EMAIL: z.string().email().optional(),
  INITIAL_ADMIN_PASSWORD: z.string().min(8).optional(),
  INITIAL_ADMIN_FULL_NAME: z.string().min(1).optional(),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM_EMAIL: z.string().email().optional(),
  RESEND_FROM_NAME: z.string().optional(),
  RESEND_REPLY_TO: z.string().email().optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_SECURE: z.union([z.literal('true'), z.literal('false')]).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_EMAIL: z.string().email().optional(),
  SMTP_FROM_NAME: z.string().optional(),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n')
  throw new Error(`Invalid server environment:\n${issues}`)
}

export const env = parsed.data
