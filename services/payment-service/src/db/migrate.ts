import { Pool } from 'pg';
import { config } from '../config';

const db = new Pool({ connectionString: config.PAYMENT_DB_URL });

const migrations = `
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL,
  store_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL
    CHECK (payment_method IN ('cash','card','online','wallet')),
  transaction_id VARCHAR(255),
  status VARCHAR(50) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','success','failed','refunded')),
  idempotency_key VARCHAR(255) UNIQUE,
  cash_tendered DECIMAL(10,2),
  change_due DECIMAL(10,2),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_store ON payments(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);

CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id),
  amount DECIMAL(10,2) NOT NULL,
  reason VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'success'
    CHECK (status IN ('pending','success','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_payment ON refunds(payment_id);
`;

async function runMigrations(): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(migrations);
    await client.query('COMMIT');
    console.info('Payment service migrations complete');
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