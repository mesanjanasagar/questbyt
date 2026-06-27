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