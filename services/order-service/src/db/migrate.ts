import { Pool } from 'pg';
import { config } from '../config';

const db = new Pool({ connectionString: config.ORDER_DB_URL });

const migrations = `
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  device_id UUID NOT NULL,
  cashier_id UUID NOT NULL,
  customer_id UUID,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','cooking','ready','completed','cancelled')),
  total_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  payment_status VARCHAR(50) NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','paid','refunded')),
  payment_method VARCHAR(50),
  order_type VARCHAR(50) NOT NULL DEFAULT 'dine-in'
    CHECK (order_type IN ('dine-in','takeout','delivery')),
  table_number INT,
  notes TEXT,
  platform VARCHAR(50) NOT NULL DEFAULT 'direct',
  platform_order_id VARCHAR(255),
  commission_rate DECIMAL(5,2) DEFAULT 0.00,
  commission_amount DECIMAL(10,2) DEFAULT 0.00,
  net_revenue DECIMAL(10,2),
  created_offline BOOLEAN DEFAULT FALSE,
  synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_orders_store_status ON orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_device ON orders(device_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_platform ON orders(store_id, platform, created_at DESC);

CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  modifications JSONB,
  notes TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','cooking','ready','served')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);

CREATE TABLE IF NOT EXISTS order_discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  discount_type VARCHAR(50) NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255),
  applied_by UUID NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  action VARCHAR(50) NOT NULL,
  changes JSONB,
  actor_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_audit_order ON order_audit(order_id);

-- Add order_number sequence (idempotent)
CREATE SEQUENCE IF NOT EXISTS orders_order_number_seq START 1;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number BIGINT NOT NULL DEFAULT nextval('orders_order_number_seq');

-- ── v2: dine-in workflow ─────────────────────────────────────────────────────

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending','cooking','ready','completed','cancelled','open','in_progress','bill_requested','paid','closed'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_id UUID;
CREATE INDEX IF NOT EXISTS idx_orders_table_active ON orders(table_id, status)
  WHERE table_id IS NOT NULL;

ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_status_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_status_check
  CHECK (status IN ('pending','cooking','ready','served','accepted','preparing','collected','cancelled'));

ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_name TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS kds_dispatched_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_order_items_kds_undispatched ON order_items(order_id)
  WHERE kds_dispatched_at IS NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_count INT;

-- ── v3: today's-sales reporting ─────────────────────────────────────────────
-- Set precisely at the moment payment_status flips to 'paid' (markOrderPaid),
-- distinct from updated_at which is touched by unrelated later writes.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_paid_at ON orders(store_id, paid_at) WHERE paid_at IS NOT NULL;

-- ── v4: branch scoping ───────────────────────────────────────────────────────
-- A store can span multiple physical branches, each with its own tables
-- (table_number is only unique per-branch, not per-store). Order listings
-- must filter by branch_id, not just store_id, or staff at one branch can
-- see — and appear to be serving — another branch's tables and orders.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS branch_id UUID;
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id, created_at DESC) WHERE branch_id IS NOT NULL;

-- ── v5: promo codes ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL,
  description VARCHAR(255),
  discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value DECIMAL(10,2) NOT NULL CHECK (discount_value > 0),
  first_time_customer_only BOOLEAN NOT NULL DEFAULT FALSE,
  min_order_amount DECIMAL(10,2),
  max_uses INT,
  used_count INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, code)
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_store ON promo_codes(store_id, is_active);

ALTER TABLE order_discounts ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id);
ALTER TABLE order_discounts ADD COLUMN IF NOT EXISTS promo_code VARCHAR(50);
`;

async function runMigrations(): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(migrations);
    await client.query('COMMIT');
    console.info('Order service migrations complete');
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