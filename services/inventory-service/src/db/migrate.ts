import { Pool } from 'pg';
import { config } from '../config';

const db = new Pool({ connectionString: config.INVENTORY_DB_URL });

const migrations = `
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  sku VARCHAR(100),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category_id UUID,
  unit_type VARCHAR(20) NOT NULL
    CHECK (unit_type IN ('piece','kg','liter','box')),
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (store_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(store_id, status);

CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL UNIQUE REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL,
  current_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  reserved_stock DECIMAL(12,2) NOT NULL DEFAULT 0,
  reorder_level DECIMAL(12,2),
  reorder_quantity DECIMAL(12,2),
  last_counted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_store ON inventory(store_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  store_id UUID NOT NULL,
  movement_type VARCHAR(50) NOT NULL
    CHECK (movement_type IN ('purchase','sale','adjustment','waste','return')),
  quantity DECIMAL(12,2) NOT NULL,
  reference_id VARCHAR(255),
  reference_type VARCHAR(50),
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_movements_store ON stock_movements(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_movements_reference ON stock_movements(reference_id) WHERE reference_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS low_stock_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alert_level DECIMAL(12,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','acknowledged','resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_active
  ON low_stock_alerts(product_id, status) WHERE status IN ('pending','acknowledged');
CREATE INDEX IF NOT EXISTS idx_alerts_store ON low_stock_alerts(store_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_product ON low_stock_alerts(product_id);
`;

async function runMigrations(): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(migrations);
    await client.query('COMMIT');
    console.info('inventory service migrations complete');
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