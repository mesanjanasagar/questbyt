import { Pool } from 'pg';
import { config } from '../config';

const db = new Pool({ connectionString: config.MARKETING_DB_URL });

const migrations = `
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    trigger VARCHAR(50) NOT NULL
        CHECK (trigger IN ('customer.created','customer.segment_changed','customer.points_earned','manual')),
    target_segment VARCHAR(20),
    from_segment VARCHAR(20),
    channel VARCHAR(20) NOT NULL
        CHECK (channel IN ('whatsapp','email','sms','push')),
    message_template TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active','paused','archived')),
    throttle_days INT NOT NULL DEFAULT 0,
    total_sent INT NOT NULL DEFAULT 0,
    total_failed INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_store ON campaigns(store_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_trigger ON campaigns(store_id, trigger, status);

CREATE TABLE IF NOT EXISTS campaign_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL,
    store_id UUID NOT NULL,
    channel VARCHAR(20) NOT NULL,
    rendered_message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued','sent','failed','skipped')),
    error_message TEXT,
    triggered_by VARCHAR(100) NOT NULL,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_executions_campaign ON campaign_executions(campaign_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_customer ON campaign_executions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_executions_store ON campaign_executions(store_id, created_at DESC);

-- Throttle check: last send per customer per campaign
CREATE INDEX IF NOT EXISTS idx_executions_throttle ON campaign_executions(campaign_id, customer_id, sent_at DESC)
    WHERE status = 'sent';

-- ── Promo / discount campaign extensions (idempotent) ───────────────────────

-- Relax channel / message_template so discount campaigns can omit them
ALTER TABLE campaigns ALTER COLUMN channel DROP NOT NULL;
ALTER TABLE campaigns ALTER COLUMN message_template DROP NOT NULL;

-- Extend status values
DO $$ BEGIN
  ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
  ALTER TABLE campaigns ADD CONSTRAINT campaigns_status_check
    CHECK (status IN ('draft','scheduled','active','paused','completed','expired','archived'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- New columns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_type    VARCHAR(50);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS coupon_code      VARCHAR(100);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS discount_type    VARCHAR(20);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS discount_value   DECIMAL(10,2);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS max_discount     DECIMAL(10,2);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS min_order_amount DECIMAL(10,2);
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS valid_from       TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS valid_until      TIMESTAMPTZ;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS max_redemptions  INT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS usage_count      INT NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS usage_per_customer INT DEFAULT 1;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS priority         INT NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS applicable_branches   JSONB NOT NULL DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS applicable_segments   JSONB NOT NULL DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS applicable_categories JSONB NOT NULL DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS applicable_items      JSONB NOT NULL DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS revenue_generated     DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS orders_count          INT NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS customers_reached     INT NOT NULL DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS roi                   DECIMAL(10,2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_coupon ON campaigns(store_id, coupon_code)
  WHERE coupon_code IS NOT NULL;
`;

async function runMigrations(): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(migrations);
    await client.query('COMMIT');
    console.info('Marketing service migrations complete');
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