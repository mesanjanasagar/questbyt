import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({ connectionString: config.CHURN_DB_URL });

async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    console.info('[Migration] Starting...');

    // Customer Churn Scores
    await client.query(`
      CREATE TABLE IF NOT EXISTS customer_churn_scores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL,
        store_id UUID NOT NULL,
        churn_score NUMERIC(3,2) NOT NULL CHECK (churn_score >= 0 AND churn_score <= 1),
        risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
        last_order_days INTEGER,
        frequency_trend NUMERIC(3,2),
        avg_order_value_trend NUMERIC(5,2),
        calculated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (customer_id, store_id)
      );
    `);

    // Churn History
    await client.query(`
      CREATE TABLE IF NOT EXISTS churn_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL,
        store_id UUID NOT NULL,
        previous_score NUMERIC(3,2),
        new_score NUMERIC(3,2) NOT NULL,
        previous_risk_level VARCHAR(20),
        new_risk_level VARCHAR(20) NOT NULL,
        triggered_action VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_churn_history_customer
        ON churn_history(customer_id, store_id, created_at);
    `);

    // Engagement Triggers
    await client.query(`
      CREATE TABLE IF NOT EXISTS engagement_triggers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        customer_id UUID NOT NULL,
        store_id UUID NOT NULL,
        trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN ('churn_detected', 'risk_elevated', 'churned_60d')),
        campaign_id UUID,
        triggered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        campaign_sent_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_engagement_triggers_store
        ON engagement_triggers(store_id, trigger_type, triggered_at);
    `);

    console.info('[Migration] Completed successfully');
  } catch (err) {
    console.error('[Migration] Error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error('[Migration] Failed:', err);
  process.exit(1);
});