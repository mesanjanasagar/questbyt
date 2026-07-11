import { Pool } from 'pg';
import { config } from '../config';

const db = new Pool({ connectionString: config.STORE_DB_URL });

const migrations = `
-- ——————————————————————————————————————————
-- Core store profile
-- ——————————————————————————————————————————
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255),
    business_type VARCHAR(50) NOT NULL DEFAULT 'restaurant'
        CHECK (business_type IN ('restaurant','cafe','bakery','food_truck','cloud_kitchen','retail')),
    description TEXT,
    tagline VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    vat_number VARCHAR(100),
    currency VARCHAR(10) NOT NULL DEFAULT 'AED',
    locale VARCHAR(10) NOT NULL DEFAULT 'en',
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Dubai',
    address JSONB,
    operating_hours JSONB,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stores_active ON stores(is_active);

-- ——————————————————————————————————————————
-- Branches (physical outlets under a store)
-- ——————————————————————————————————————————
CREATE TABLE IF NOT EXISTS branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    branch_code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address JSONB,
    phone VARCHAR(50),
    email VARCHAR(255),
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Dubai',
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (store_id, branch_code)
);

CREATE INDEX IF NOT EXISTS idx_branches_store ON branches(store_id);

-- ——————————————————————————————————————————
-- Dining Areas / Floors within a branch
-- ——————————————————————————————————————————
CREATE TABLE IF NOT EXISTS dining_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    store_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    floor_number INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dining_areas_branch ON dining_areas(branch_id);
CREATE INDEX IF NOT EXISTS idx_dining_areas_store ON dining_areas(store_id);

-- ——————————————————————————————————————————
-- Tables within a dining area
-- ——————————————————————————————————————————
CREATE TABLE IF NOT EXISTS tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dining_area_id UUID NOT NULL REFERENCES dining_areas(id) ON DELETE CASCADE,
    branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    store_id UUID NOT NULL,
    table_number VARCHAR(20) NOT NULL,
    capacity INT NOT NULL DEFAULT 4,
    status VARCHAR(30) NOT NULL DEFAULT 'available'
        CHECK (status IN ('available','occupied','reserved','cleaning')),
    qr_code_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (branch_id, table_number)
);

CREATE INDEX IF NOT EXISTS idx_tables_branch ON tables(branch_id);
CREATE INDEX IF NOT EXISTS idx_tables_store ON tables(store_id);
CREATE INDEX IF NOT EXISTS idx_tables_dining_area ON tables(dining_area_id);

-- ——————————————————————————————————————————
-- Staff Profiles (links auth-service user_id → store context)
-- The auth-service owns credentials; store-service owns the profile
-- ——————————————————————————————————————————
CREATE TABLE IF NOT EXISTS staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES branches(id),
    employee_number VARCHAR(50) NOT NULL,
    position VARCHAR(100),
    pin VARCHAR(10),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (store_id, employee_number),
    UNIQUE (store_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_store ON staff_profiles(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user ON staff_profiles(user_id);

-- ——————————————————————————————————————————
-- Payment configuration per store
-- ——————————————————————————————————————————
CREATE TABLE IF NOT EXISTS payment_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    cash_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    card_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    enabled_methods JSONB NOT NULL DEFAULT '["cash","card"]',
    currency VARCHAR(10) NOT NULL DEFAULT 'AED',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ——————————————————————————————————————————
-- Notification configuration per store
-- ——————————————————————————————————————————
CREATE TABLE IF NOT EXISTS notification_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    manager_phone VARCHAR(50),
    manager_email VARCHAR(255),
    low_stock_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    order_alerts BOOLEAN NOT NULL DEFAULT TRUE,
    channels JSONB NOT NULL DEFAULT '["whatsapp"]',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ——————————————————————————————————————————
-- Onboarding state (tracks wizard progress)
-- ——————————————————————————————————————————
CREATE TABLE IF NOT EXISTS onboarding_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    current_step VARCHAR(50) NOT NULL DEFAULT 'restaurant_setup',
    completed_steps JSONB NOT NULL DEFAULT '[]',
    is_complete BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ——————————————————————————————————————————
-- Branding / white-label config (1-to-1 with store)
-- ——————————————————————————————————————————
CREATE TABLE IF NOT EXISTS store_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    -- Core identity
    logo_url TEXT,
    favicon_url TEXT,
    primary_color VARCHAR(20) NOT NULL DEFAULT '#1A73E8',
    secondary_color VARCHAR(20) NOT NULL DEFAULT '#1A1A2E',
    accent_color VARCHAR(20) NOT NULL DEFAULT '#FFD700',
    background_color VARCHAR(20) NOT NULL DEFAULT '#FFFFFF',
    text_color VARCHAR(20) NOT NULL DEFAULT '#111111',
    font_family VARCHAR(100) NOT NULL DEFAULT 'Inter',
    -- Display text
    display_name VARCHAR(255) NOT NULL,
    welcome_message TEXT,
    order_ready_message TEXT,
    pos_header_text VARCHAR(255),
    kiosk_background TEXT,
    kds_header_color VARCHAR(20),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ——————————————————————————————————————————
-- Receipt config (1-to-1 with store)
-- ——————————————————————————————————————————

CREATE TABLE IF NOT EXISTS store_receipt_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL UNIQUE REFERENCES stores(id) ON DELETE CASCADE,
    header_text TEXT,
    footer_text TEXT,
    show_logo BOOLEAN NOT NULL DEFAULT TRUE,
    show_vat_number BOOLEAN NOT NULL DEFAULT TRUE,
    show_store_address BOOLEAN NOT NULL DEFAULT TRUE,
    show_order_type BOOLEAN NOT NULL DEFAULT TRUE,
    show_cashier_name BOOLEAN NOT NULL DEFAULT FALSE,
    digital_receipt_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    digital_receipt_channel VARCHAR(20) DEFAULT 'whatsapp'
        CHECK (digital_receipt_channel IN ('email','sms','whatsapp')),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Idempotent: ensure UNIQUE index on onboarding_state.store_id so that
-- ON CONFLICT (store_id) works even if the table predates this constraint.
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_state_store_id_key
    ON onboarding_state (store_id);

-- ── v2: expanded table statuses for dine-in workflow ─────────────────────────
-- ── v3: added 'paid' — payment closes the order but the table now waits for
-- staff to mark it cleaned, instead of jumping straight to 'cleaning'.
ALTER TABLE tables DROP CONSTRAINT IF EXISTS tables_status_check;
ALTER TABLE tables ADD CONSTRAINT tables_status_check
  CHECK (status IN ('available','occupied','reserved','cleaning','food_preparing','ready_to_serve','bill_requested','paid'));

-- ── v4: POS customer-capture toggle ──────────────────────────────────────────
ALTER TABLE stores ADD COLUMN IF NOT EXISTS pos_capture_customer_details BOOLEAN NOT NULL DEFAULT TRUE;
`;

async function runMigrations(): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(migrations);
    await client.query('COMMIT');
    console.info('Store service migrations complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await db.end();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));