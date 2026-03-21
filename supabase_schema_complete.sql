-- ================================================================
-- DALA WMS — Complete Database Schema (Phases 1 + 2 + 3)
-- Run this ONCE in Supabase SQL Editor on a fresh project.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ────────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────────
CREATE TYPE user_role       AS ENUM ('admin','warehouse_manager','operations','finance','security');
CREATE TYPE movement_type   AS ENUM ('grn','dispatch','adjustment','write_off','transfer');
CREATE TYPE casualty_reason AS ENUM ('damaged','expired','lost','theft','other');
CREATE TYPE casualty_status AS ENUM ('pending','approved','rejected');
CREATE TYPE batch_status    AS ENUM ('active','near_expiry','expired','depleted','written_off');
CREATE TYPE count_status    AS ENUM ('open','submitted','approved','closed');

-- ────────────────────────────────────────────────────────────────
-- PROFILES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT NOT NULL,
  email       TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'warehouse_manager',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- BRAND PARTNERS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE brand_partners (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name          TEXT NOT NULL,
  contact_name  TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- PRODUCTS (SKUs)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE products (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand_partner_id   UUID NOT NULL REFERENCES brand_partners(id),
  sku_code           TEXT NOT NULL UNIQUE,
  name               TEXT NOT NULL,
  category           TEXT,
  description        TEXT,
  unit_type          TEXT NOT NULL DEFAULT 'carton',
  allows_fractions   BOOLEAN NOT NULL DEFAULT TRUE,
  reorder_threshold  NUMERIC(10,2) NOT NULL DEFAULT 0,
  expiry_alert_days  INTEGER NOT NULL DEFAULT 30,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- STOCK BATCHES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE stock_batches (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id         UUID NOT NULL REFERENCES products(id),
  batch_number       TEXT,
  quantity_received  NUMERIC(10,2) NOT NULL,
  quantity_remaining NUMERIC(10,2) NOT NULL,
  unit_cost          NUMERIC(12,2),
  expiry_date        DATE,
  manufacture_date   DATE,
  location           TEXT NOT NULL DEFAULT 'Main Warehouse',
  status             batch_status NOT NULL DEFAULT 'active',
  grn_reference      TEXT,
  notes              TEXT,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES profiles(id),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- STOCK MOVEMENTS — immutable audit ledger
-- ────────────────────────────────────────────────────────────────
CREATE TABLE stock_movements (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id         UUID NOT NULL REFERENCES stock_batches(id),
  product_id       UUID NOT NULL REFERENCES products(id),
  movement_type    movement_type NOT NULL,
  quantity         NUMERIC(10,2) NOT NULL,
  unit_fraction    NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  balance_after    NUMERIC(10,2) NOT NULL,
  reference_number TEXT,
  retailer_name    TEXT,
  notes            TEXT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- GRN RECORDS
-- ────────────────────────────────────────────────────────────────
CREATE TABLE grn_records (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_number          TEXT NOT NULL UNIQUE,
  brand_partner_id    UUID NOT NULL REFERENCES brand_partners(id),
  received_by         UUID REFERENCES profiles(id),
  delivery_note_ref   TEXT,
  notes               TEXT,
  total_items         INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE grn_items (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  grn_id           UUID NOT NULL REFERENCES grn_records(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id),
  batch_id         UUID REFERENCES stock_batches(id),
  quantity_received NUMERIC(10,2) NOT NULL,
  unit_fraction    NUMERIC(5,4) NOT NULL DEFAULT 1.0,
  batch_number     TEXT,
  expiry_date      DATE,
  unit_cost        NUMERIC(12,2)
);

-- ────────────────────────────────────────────────────────────────
-- DISPATCH NOTES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE dispatch_notes (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_number  TEXT NOT NULL UNIQUE,
  retailer_name    TEXT NOT NULL,
  retailer_address TEXT,
  dispatched_by    UUID REFERENCES profiles(id),
  confirmed_by     UUID REFERENCES profiles(id),
  confirmed_at     TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pending',
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE dispatch_items (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id         UUID NOT NULL REFERENCES dispatch_notes(id) ON DELETE CASCADE,
  product_id          UUID NOT NULL REFERENCES products(id),
  batch_id            UUID NOT NULL REFERENCES stock_batches(id),
  quantity_dispatched NUMERIC(10,2) NOT NULL,
  unit_fraction       NUMERIC(5,4) NOT NULL DEFAULT 1.0
);

-- ────────────────────────────────────────────────────────────────
-- CASUALTIES
-- ────────────────────────────────────────────────────────────────
CREATE TABLE casualties (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id         UUID NOT NULL REFERENCES stock_batches(id),
  product_id       UUID NOT NULL REFERENCES products(id),
  reason           casualty_reason NOT NULL,
  quantity         NUMERIC(10,2) NOT NULL,
  description      TEXT,
  status           casualty_status NOT NULL DEFAULT 'pending',
  logged_by        UUID REFERENCES profiles(id),
  approved_by      UUID REFERENCES profiles(id),
  approved_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────────────────────
-- PHYSICAL COUNT SESSIONS (Phase 3)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE count_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_ref   TEXT NOT NULL UNIQUE,
  status        count_status NOT NULL DEFAULT 'open',
  notes         TEXT,
  opened_by     UUID REFERENCES profiles(id),
  submitted_by  UUID REFERENCES profiles(id),
  approved_by   UUID REFERENCES profiles(id),
  opened_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at  TIMESTAMPTZ,
  approved_at   TIMESTAMPTZ,
  closed_at     TIMESTAMPTZ
);

-- Count lines — one row per SKU per session
CREATE TABLE count_lines (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id       UUID NOT NULL REFERENCES count_sessions(id) ON DELETE CASCADE,
  product_id       UUID NOT NULL REFERENCES products(id),
  system_quantity  NUMERIC(10,2) NOT NULL DEFAULT 0,
  counted_quantity NUMERIC(10,2),
  variance         NUMERIC(10,2) GENERATED ALWAYS AS (counted_quantity - system_quantity) STORED,
  variance_note    TEXT,
  adjustment_approved BOOLEAN NOT NULL DEFAULT FALSE,
  counted_by       UUID REFERENCES profiles(id),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, product_id)
);

-- ────────────────────────────────────────────────────────────────
-- SEQUENCES
-- ────────────────────────────────────────────────────────────────
CREATE SEQUENCE grn_seq      START 1000;
CREATE SEQUENCE dispatch_seq START 1000;
CREATE SEQUENCE count_seq    START 100;

-- ────────────────────────────────────────────────────────────────
-- FUNCTIONS
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION generate_grn_number() RETURNS TEXT AS $$
BEGIN RETURN 'GRN-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('grn_seq')::TEXT,4,'0'); END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_dispatch_number() RETURNS TEXT AS $$
BEGIN RETURN 'DSP-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('dispatch_seq')::TEXT,4,'0'); END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_count_ref() RETURNS TEXT AS $$
BEGIN RETURN 'CNT-' || TO_CHAR(NOW(),'YYYYMMDD') || '-' || LPAD(nextval('count_seq')::TEXT,3,'0'); END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_batch_statuses() RETURNS void AS $$
BEGIN
  UPDATE stock_batches SET status = 'expired', updated_at = NOW()
  WHERE expiry_date IS NOT NULL AND expiry_date < CURRENT_DATE
    AND status NOT IN ('depleted','written_off');

  UPDATE stock_batches sb SET status = 'near_expiry', updated_at = NOW()
  FROM products p WHERE sb.product_id = p.id
    AND sb.expiry_date IS NOT NULL AND sb.expiry_date >= CURRENT_DATE
    AND sb.expiry_date <= CURRENT_DATE + (p.expiry_alert_days || ' days')::INTERVAL
    AND sb.status = 'active';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name','New User'),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role,'warehouse_manager')
  ); RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ────────────────────────────────────────────────────────────────
-- TRIGGERS
-- ────────────────────────────────────────────────────────────────
CREATE TRIGGER profiles_updated_at    BEFORE UPDATE ON profiles    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER products_updated_at    BEFORE UPDATE ON products    FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER stock_batches_updated_at BEFORE UPDATE ON stock_batches FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER count_lines_updated_at BEFORE UPDATE ON count_lines FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
CREATE TRIGGER on_auth_user_created   AFTER INSERT  ON auth.users  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ────────────────────────────────────────────────────────────────
-- VIEWS
-- ────────────────────────────────────────────────────────────────

-- Live stock per SKU
CREATE VIEW current_stock AS
SELECT
  p.id AS product_id, p.sku_code, p.name AS product_name, p.category, p.unit_type,
  bp.name AS brand_partner, p.reorder_threshold,
  COALESCE(SUM(sb.quantity_remaining),0) AS total_stock,
  COUNT(CASE WHEN sb.status='active'      THEN 1 END) AS active_batches,
  COUNT(CASE WHEN sb.status='near_expiry' THEN 1 END) AS near_expiry_batches,
  COUNT(CASE WHEN sb.status='expired'     THEN 1 END) AS expired_batches,
  MIN(CASE WHEN sb.status IN ('active','near_expiry') THEN sb.expiry_date END) AS earliest_expiry
FROM products p
LEFT JOIN brand_partners bp ON p.brand_partner_id = bp.id
LEFT JOIN stock_batches sb  ON p.id = sb.product_id AND sb.status NOT IN ('depleted','written_off')
WHERE p.is_active = TRUE
GROUP BY p.id, p.sku_code, p.name, p.category, p.unit_type, bp.name, p.reorder_threshold;

-- Expiry alerts
CREATE VIEW expiry_alerts AS
SELECT
  sb.id AS batch_id, sb.batch_number, sb.expiry_date, sb.quantity_remaining,
  sb.status AS batch_status, sb.location, sb.received_at,
  p.id AS product_id, p.name AS product_name, p.sku_code, p.expiry_alert_days,
  bp.name AS brand_partner,
  (sb.expiry_date - CURRENT_DATE) AS days_until_expiry,
  CASE
    WHEN sb.expiry_date < CURRENT_DATE THEN 'expired'
    WHEN sb.expiry_date <= CURRENT_DATE + (p.expiry_alert_days||' days')::INTERVAL THEN 'near_expiry'
    ELSE 'ok'
  END AS alert_level
FROM stock_batches sb
JOIN products p ON p.id = sb.product_id
JOIN brand_partners bp ON bp.id = p.brand_partner_id
WHERE sb.expiry_date IS NOT NULL AND sb.status NOT IN ('depleted','written_off') AND sb.quantity_remaining > 0
ORDER BY sb.expiry_date ASC;

-- Reorder alerts
CREATE VIEW reorder_alerts AS
SELECT
  cs.product_id, cs.sku_code, cs.product_name, cs.brand_partner,
  cs.total_stock, cs.reorder_threshold, cs.unit_type,
  (cs.reorder_threshold - cs.total_stock) AS shortfall,
  CASE WHEN cs.total_stock = 0 THEN 'out_of_stock' ELSE 'low_stock' END AS alert_level
FROM current_stock cs
WHERE cs.reorder_threshold > 0 AND cs.total_stock <= cs.reorder_threshold
ORDER BY cs.total_stock ASC;

-- Casualty summary
CREATE VIEW casualty_summary AS
SELECT
  c.id, c.batch_id, c.product_id, c.reason, c.quantity, c.description,
  c.status, c.created_at, c.approved_at, c.rejection_reason,
  p.name AS product_name, p.sku_code,
  bp.name AS brand_partner,
  sb.batch_number, sb.expiry_date,
  logged.full_name   AS logged_by_name,
  approver.full_name AS approved_by_name
FROM casualties c
JOIN stock_batches sb ON sb.id = c.batch_id
JOIN products p       ON p.id  = c.product_id
JOIN brand_partners bp ON bp.id = p.brand_partner_id
LEFT JOIN profiles logged   ON logged.id   = c.logged_by
LEFT JOIN profiles approver ON approver.id = c.approved_by
ORDER BY c.created_at DESC;

-- Brand partner summary
CREATE VIEW brand_partner_summary AS
SELECT
  bp.id AS partner_id, bp.name AS partner_name, bp.contact_name, bp.contact_phone,
  COUNT(DISTINCT p.id) AS total_skus,
  COALESCE(SUM(sb.quantity_remaining),0) AS total_stock_held,
  COUNT(DISTINCT CASE WHEN sb.status='near_expiry' THEN sb.id END) AS near_expiry_batches,
  COUNT(DISTINCT CASE WHEN sb.status='expired'     THEN sb.id END) AS expired_batches,
  MAX(gr.created_at) AS last_grn_date,
  COUNT(DISTINCT gr.id) AS total_grns
FROM brand_partners bp
LEFT JOIN products p ON p.brand_partner_id = bp.id AND p.is_active = TRUE
LEFT JOIN stock_batches sb ON sb.product_id = p.id AND sb.status NOT IN ('depleted','written_off')
LEFT JOIN grn_records gr   ON gr.brand_partner_id = bp.id
WHERE bp.is_active = TRUE
GROUP BY bp.id, bp.name, bp.contact_name, bp.contact_phone;

-- Physical count detail view (Phase 3)
CREATE VIEW count_detail AS
SELECT
  cl.id AS line_id, cl.session_id, cl.system_quantity, cl.counted_quantity,
  cl.variance, cl.variance_note, cl.adjustment_approved, cl.updated_at AS counted_at,
  cs.session_ref, cs.status AS session_status, cs.opened_at,
  p.id AS product_id, p.name AS product_name, p.sku_code, p.unit_type,
  bp.name AS brand_partner,
  counter.full_name AS counted_by_name
FROM count_lines cl
JOIN count_sessions cs ON cs.id = cl.session_id
JOIN products p        ON p.id  = cl.product_id
JOIN brand_partners bp ON bp.id = p.brand_partner_id
LEFT JOIN profiles counter ON counter.id = cl.counted_by
ORDER BY cs.opened_at DESC, p.name ASC;

-- ────────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────────
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_partners   ENABLE ROW LEVEL SECURITY;
ALTER TABLE products         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements  ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_records      ENABLE ROW LEVEL SECURITY;
ALTER TABLE grn_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_notes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatch_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE casualties       ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE count_lines      ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_user_role() RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (get_user_role()='admin');
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (id=auth.uid() OR get_user_role()='admin');

-- Brand partners
CREATE POLICY "bp_select" ON brand_partners FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "bp_write"  ON brand_partners FOR ALL    TO authenticated USING (get_user_role() IN ('admin','operations'));

-- Products
CREATE POLICY "products_select" ON products FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "products_write"  ON products FOR ALL    TO authenticated USING (get_user_role() IN ('admin','operations','warehouse_manager'));

-- Stock batches
CREATE POLICY "batches_select" ON stock_batches FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "batches_write"  ON stock_batches FOR ALL    TO authenticated USING (get_user_role() IN ('admin','warehouse_manager','operations'));

-- Movements
CREATE POLICY "movements_select" ON stock_movements FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "movements_insert" ON stock_movements FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('admin','warehouse_manager','operations'));

-- GRN
CREATE POLICY "grn_select" ON grn_records FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "grn_write"  ON grn_records FOR ALL    TO authenticated USING (get_user_role() IN ('admin','warehouse_manager'));
CREATE POLICY "grni_select" ON grn_items  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "grni_write"  ON grn_items  FOR ALL    TO authenticated USING (get_user_role() IN ('admin','warehouse_manager'));

-- Dispatch
CREATE POLICY "dispatch_select" ON dispatch_notes FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "dispatch_write"  ON dispatch_notes FOR ALL    TO authenticated USING (get_user_role() IN ('admin','operations','warehouse_manager','security'));
CREATE POLICY "di_select"       ON dispatch_items FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "di_write"        ON dispatch_items FOR ALL    TO authenticated USING (get_user_role() IN ('admin','operations','warehouse_manager'));

-- Casualties
CREATE POLICY "cas_select" ON casualties FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "cas_insert" ON casualties FOR INSERT TO authenticated WITH CHECK (get_user_role() IN ('admin','warehouse_manager'));
CREATE POLICY "cas_update" ON casualties FOR UPDATE TO authenticated USING (get_user_role() IN ('admin','operations'));

-- Count sessions & lines
CREATE POLICY "cs_select" ON count_sessions FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "cs_write"  ON count_sessions FOR ALL    TO authenticated USING (get_user_role() IN ('admin','warehouse_manager','operations'));
CREATE POLICY "cl_select" ON count_lines    FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "cl_write"  ON count_lines    FOR ALL    TO authenticated USING (get_user_role() IN ('admin','warehouse_manager','operations'));

-- ────────────────────────────────────────────────────────────────
-- SEED DATA
-- ────────────────────────────────────────────────────────────────
INSERT INTO brand_partners (name, contact_name, contact_phone) VALUES
  ('Nestle Nigeria',  'Sales Team', '080-0000-0001'),
  ('Unilever Nigeria','Sales Team', '080-0000-0002'),
  ('Dangote Foods',   'Sales Team', '080-0000-0003'),
  ('Cadbury Nigeria', 'Sales Team', '080-0000-0004');

-- Run initial expiry status sweep
SELECT update_batch_statuses();
