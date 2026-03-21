import { env } from '../config/env.js'
import { hashPassword } from '../lib/auth.js'
import { query, pool } from '../lib/db.js'

const roleCheck = `CHECK (role IN ('admin','warehouse_manager','operations','finance','security'))`
const unitTypeCheck = `CHECK (unit_type IN ('carton','piece','bag','crate'))`

async function bootstrap() {
  await query('CREATE EXTENSION IF NOT EXISTS pgcrypto')

  await query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL ${roleCheck},
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS user_invitations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL ${roleCheck},
      token_hash TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      invited_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS brand_partners (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL UNIQUE,
      contact_name TEXT,
      contact_email TEXT,
      contact_phone TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS products (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      brand_partner_id UUID NOT NULL REFERENCES brand_partners(id) ON DELETE RESTRICT,
      sku_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT,
      unit_type TEXT NOT NULL ${unitTypeCheck},
      allows_fractions BOOLEAN NOT NULL DEFAULT true,
      reorder_threshold NUMERIC(14, 2) NOT NULL DEFAULT 0,
      expiry_alert_days INTEGER NOT NULL DEFAULT 30,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  if (env.INITIAL_ADMIN_EMAIL && env.INITIAL_ADMIN_PASSWORD && env.INITIAL_ADMIN_FULL_NAME) {
    const passwordHash = await hashPassword(env.INITIAL_ADMIN_PASSWORD)
    await query(
      `
        INSERT INTO app_users (email, password_hash, full_name, role, is_active)
        VALUES (LOWER($1), $2, $3, 'admin', true)
        ON CONFLICT (email) DO UPDATE
        SET password_hash = EXCLUDED.password_hash,
            full_name = EXCLUDED.full_name,
            role = 'admin',
            is_active = true,
            updated_at = NOW()
      `,
      [env.INITIAL_ADMIN_EMAIL, passwordHash, env.INITIAL_ADMIN_FULL_NAME],
    )
  }

  console.log('Bootstrap complete.')
}

bootstrap()
  .catch((error) => {
    console.error('Bootstrap failed:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await pool.end()
  })
