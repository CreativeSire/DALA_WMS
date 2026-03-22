import { env } from '../config/env.js'
import { hashPassword } from '../lib/auth.js'
import { query, pool } from '../lib/db.js'

const roleCheck = `CHECK (role IN ('admin','warehouse_manager','operations','finance','security'))`
const unitTypeCheck = `CHECK (unit_type IN ('carton','piece','bag','crate'))`
const movementTypeCheck = `CHECK (movement_type IN ('grn','dispatch','adjustment','write_off','transfer'))`
const casualtyReasonCheck = `CHECK (reason IN ('damaged','expired','lost','theft','other'))`
const casualtyStatusCheck = `CHECK (status IN ('pending','approved','rejected'))`
const batchStatusCheck = `CHECK (status IN ('active','near_expiry','expired','depleted','written_off'))`
const countStatusCheck = `CHECK (status IN ('open','submitted','approved','closed'))`
const adminAuditActionCheck = `CHECK (action IN ('user_created','invite_sent','user_activated','user_deactivated','password_reset','password_changed','email_delivery_failed','email_delivery_sent'))`
const skuClassCheck = `CHECK (sku_class IN ('fast_mover','regular','controlled','seasonal'))`
const opsSummaryChannelCheck = `CHECK (channel IN ('in_app','email'))`

async function bootstrap() {
  await query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
  await query(`CREATE SEQUENCE IF NOT EXISTS grn_seq START 1000`)
  await query(`CREATE SEQUENCE IF NOT EXISTS dispatch_seq START 1000`)
  await query(`CREATE SEQUENCE IF NOT EXISTS count_seq START 100`)

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
      sku_class TEXT NOT NULL DEFAULT 'regular' ${skuClassCheck},
      unit_type TEXT NOT NULL ${unitTypeCheck},
      allows_fractions BOOLEAN NOT NULL DEFAULT true,
      reorder_threshold NUMERIC(14, 2) NOT NULL DEFAULT 0,
      expiry_alert_days INTEGER NOT NULL DEFAULT 30,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sku_class TEXT`)
  await query(`UPDATE products SET sku_class = 'regular' WHERE sku_class IS NULL OR sku_class = ''`)
  await query(`ALTER TABLE products ALTER COLUMN sku_class SET DEFAULT 'regular'`)
  await query(`ALTER TABLE products ALTER COLUMN sku_class SET NOT NULL`)

  await query(`
    CREATE TABLE IF NOT EXISTS ai_sku_class_settings (
      sku_class TEXT PRIMARY KEY ${skuClassCheck},
      average_multiplier_high NUMERIC(10, 2) NOT NULL DEFAULT 3.00,
      average_multiplier_medium NUMERIC(10, 2) NOT NULL DEFAULT 2.00,
      average_multiplier_low NUMERIC(10, 2) NOT NULL DEFAULT 1.50,
      highest_multiplier_high NUMERIC(10, 2) NOT NULL DEFAULT 1.40,
      highest_multiplier_medium NUMERIC(10, 2) NOT NULL DEFAULT 1.15,
      minimum_history_count INTEGER NOT NULL DEFAULT 3,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    INSERT INTO ai_sku_class_settings (
      sku_class,
      average_multiplier_high,
      average_multiplier_medium,
      average_multiplier_low,
      highest_multiplier_high,
      highest_multiplier_medium,
      minimum_history_count
    )
    VALUES
      ('fast_mover', 2.40, 1.80, 1.35, 1.25, 1.10, 5),
      ('regular', 3.00, 2.00, 1.50, 1.40, 1.15, 3),
      ('controlled', 1.80, 1.35, 1.15, 1.10, 1.05, 2),
      ('seasonal', 3.40, 2.30, 1.70, 1.55, 1.25, 2)
    ON CONFLICT (sku_class) DO NOTHING
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS ops_summary_preferences (
      user_id UUID PRIMARY KEY REFERENCES app_users(id) ON DELETE CASCADE,
      in_app_enabled BOOLEAN NOT NULL DEFAULT true,
      email_enabled BOOLEAN NOT NULL DEFAULT false,
      delivery_hour INTEGER NOT NULL DEFAULT 7,
      timezone TEXT NOT NULL DEFAULT 'Africa/Lagos',
      last_sent_on DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS ops_summary_deliveries (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      summary_date DATE NOT NULL,
      channel TEXT NOT NULL ${opsSummaryChannelCheck},
      summary JSONB NOT NULL,
      delivery_status TEXT NOT NULL DEFAULT 'queued',
      delivery_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      sent_at TIMESTAMPTZ,
      UNIQUE (user_id, summary_date, channel)
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS stock_batches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      batch_number TEXT,
      quantity_received NUMERIC(14, 2) NOT NULL,
      quantity_remaining NUMERIC(14, 2) NOT NULL,
      unit_cost NUMERIC(14, 2),
      expiry_date DATE,
      manufacture_date DATE,
      location TEXT NOT NULL DEFAULT 'Main Warehouse',
      status TEXT NOT NULL DEFAULT 'active' ${batchStatusCheck},
      grn_reference TEXT,
      notes TEXT,
      received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS stock_movements (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID NOT NULL REFERENCES stock_batches(id) ON DELETE RESTRICT,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      movement_type TEXT NOT NULL ${movementTypeCheck},
      quantity NUMERIC(14, 2) NOT NULL,
      unit_fraction NUMERIC(8, 4) NOT NULL DEFAULT 1,
      balance_after NUMERIC(14, 2) NOT NULL,
      reference_number TEXT,
      retailer_name TEXT,
      notes TEXT,
      created_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS grn_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      grn_number TEXT NOT NULL UNIQUE,
      brand_partner_id UUID NOT NULL REFERENCES brand_partners(id) ON DELETE RESTRICT,
      received_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      delivery_note_ref TEXT,
      notes TEXT,
      total_items INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS grn_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      grn_id UUID NOT NULL REFERENCES grn_records(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      batch_id UUID REFERENCES stock_batches(id) ON DELETE SET NULL,
      quantity_received NUMERIC(14, 2) NOT NULL,
      unit_fraction NUMERIC(8, 4) NOT NULL DEFAULT 1,
      batch_number TEXT,
      expiry_date DATE,
      unit_cost NUMERIC(14, 2)
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS dispatch_notes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dispatch_number TEXT NOT NULL UNIQUE,
      retailer_name TEXT NOT NULL,
      retailer_address TEXT,
      dispatched_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      confirmed_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      confirmed_at TIMESTAMPTZ,
      status TEXT NOT NULL DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS dispatch_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      dispatch_id UUID NOT NULL REFERENCES dispatch_notes(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      batch_id UUID NOT NULL REFERENCES stock_batches(id) ON DELETE RESTRICT,
      quantity_dispatched NUMERIC(14, 2) NOT NULL,
      unit_fraction NUMERIC(8, 4) NOT NULL DEFAULT 1
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS casualties (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      batch_id UUID NOT NULL REFERENCES stock_batches(id) ON DELETE RESTRICT,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      reason TEXT NOT NULL ${casualtyReasonCheck},
      quantity NUMERIC(14, 2) NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending' ${casualtyStatusCheck},
      logged_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      approved_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      approved_at TIMESTAMPTZ,
      rejection_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS count_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_ref TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'open' ${countStatusCheck},
      notes TEXT,
      opened_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      submitted_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      approved_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS count_lines (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID NOT NULL REFERENCES count_sessions(id) ON DELETE CASCADE,
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
      system_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0,
      counted_quantity NUMERIC(14, 2),
      variance NUMERIC(14, 2) GENERATED ALWAYS AS (
        COALESCE(counted_quantity, system_quantity) - system_quantity
      ) STORED,
      variance_note TEXT,
      adjustment_approved BOOLEAN NOT NULL DEFAULT FALSE,
      counted_by UUID REFERENCES app_users(id) ON DELETE SET NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (session_id, product_id)
    )
  `)

  await query(`
    CREATE TABLE IF NOT EXISTS admin_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      actor_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
      target_user_id UUID REFERENCES app_users(id) ON DELETE SET NULL,
      action TEXT NOT NULL ${adminAuditActionCheck},
      summary TEXT NOT NULL,
      details JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `)

  await query(`CREATE INDEX IF NOT EXISTS idx_stock_batches_product_status ON stock_batches(product_id, status, received_at)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_created_at ON stock_movements(created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_stock_movements_product_type ON stock_movements(product_id, movement_type, created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_grn_records_created_at ON grn_records(created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_dispatch_notes_created_at ON dispatch_notes(created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_casualties_created_at ON casualties(created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_count_sessions_opened_at ON count_sessions(opened_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC)`)
  await query(`CREATE INDEX IF NOT EXISTS idx_ops_summary_deliveries_user_date ON ops_summary_deliveries(user_id, summary_date DESC)`)

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
