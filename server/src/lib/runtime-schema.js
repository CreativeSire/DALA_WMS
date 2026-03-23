import { query } from './db.js'

const skuClassCheck = `CHECK (sku_class IN ('fast_mover','regular','controlled','seasonal'))`
const opsSummaryChannelCheck = `CHECK (channel IN ('in_app','email'))`

export async function ensureRuntimeSchema() {
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode_value TEXT`)
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS internal_barcode_value TEXT`)
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS product_aliases TEXT[] DEFAULT ARRAY[]::TEXT[]`)
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS base_uom_label TEXT DEFAULT 'ctn'`)
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS alt_uom_label TEXT`)
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS units_per_pack NUMERIC(14, 4) DEFAULT 1`)
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS is_vatable BOOLEAN DEFAULT false`)
  await query(`ALTER TABLE products ADD COLUMN IF NOT EXISTS sku_class TEXT`)
  await query(`
    UPDATE products
    SET internal_barcode_value = CONCAT('DALA-', UPPER(REGEXP_REPLACE(COALESCE(sku_code, ''), '[^A-Za-z0-9]+', '-', 'g')))
    WHERE internal_barcode_value IS NULL OR internal_barcode_value = ''
  `)
  await query(`UPDATE products SET product_aliases = ARRAY[]::TEXT[] WHERE product_aliases IS NULL`)
  await query(`UPDATE products SET base_uom_label = 'ctn' WHERE base_uom_label IS NULL OR base_uom_label = ''`)
  await query(`UPDATE products SET units_per_pack = 1 WHERE units_per_pack IS NULL OR units_per_pack <= 0`)
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

  await query(`CREATE INDEX IF NOT EXISTS idx_ops_summary_deliveries_user_date ON ops_summary_deliveries(user_id, summary_date DESC)`)
}
