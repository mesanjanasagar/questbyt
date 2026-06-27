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