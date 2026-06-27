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