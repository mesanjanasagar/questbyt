import { Pool } from 'pg';
import { config } from '../config';

const db = new Pool({ connectionString: config.CUSTOMER_DB_URL });

const migrations = `
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    loyalty_points INT NOT NULL DEFAULT 0,
    loyalty_tier VARCHAR(20) NOT NULL DEFAULT 'silver'
      CHECK (loyalty_tier IN ('silver','gold','platinum')),
    segment VARCHAR(20) NOT NULL DEFAULT 'new'
      CHECK (segment IN ('new','active','at_risk','churned','vip','lapsed')),
    total_orders INT NOT NULL DEFAULT 0,
    total_spend DECIMAL(12,2) NOT NULL DEFAULT 0,
    last_order_at TIMESTAMPTZ,
    first_order_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (store_id, phone),
    UNIQUE (store_id, email)
  );

  CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id);
  CREATE INDEX IF NOT EXISTS idx_customers_segment ON customers(store_id, segment);
  CREATE INDEX IF NOT EXISTS idx_customers_last_order ON customers(store_id, last_order_at DESC NULLS LAST);
  CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email) WHERE email IS NOT NULL;

  CREATE TABLE IF NOT EXISTS loyalty_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    store_id UUID NOT NULL,
    order_id UUID NOT NULL,
    points_earned INT NOT NULL DEFAULT 0,
    points_redeemed INT NOT NULL DEFAULT 0,
    balance INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (order_id, customer_id)
  );

  CREATE INDEX IF NOT EXISTS idx_ledger_customer ON loyalty_ledger(customer_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_ledger_order ON loyalty_ledger(order_id);
`;

async function runMigrations(): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(migrations);
    await client.query('COMMIT');
    console.info('Customer service migrations complete');
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