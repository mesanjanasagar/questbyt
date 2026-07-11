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

-- ── v2: shift / cash-register reconciliation ─────────────────────────────────
-- Attribution needed to know which register a payment belongs to when
-- reconciling a shift — payments previously had no link back to the
-- terminal or cashier that took them.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS device_id UUID;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS cashier_id UUID;
CREATE INDEX IF NOT EXISTS idx_payments_device ON payments(device_id, created_at);

CREATE TABLE IF NOT EXISTS register_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL,
  device_id UUID NOT NULL,
  cashier_id UUID NOT NULL,
  opening_balance DECIMAL(10,2) NOT NULL,
  opening_notes TEXT,
  closing_balance DECIMAL(10,2),
  expected_cash DECIMAL(10,2),
  variance DECIMAL(10,2),
  closing_notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_register_shifts_device_status ON register_shifts(device_id, status);
CREATE INDEX IF NOT EXISTS idx_register_shifts_store ON register_shifts(store_id, opened_at DESC);

CREATE TABLE IF NOT EXISTS cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES register_shifts(id) ON DELETE CASCADE,
  store_id UUID NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('cash_in','cash_out')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  reason VARCHAR(255) NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_movements_shift ON cash_movements(shift_id);
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