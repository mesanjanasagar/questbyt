import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({ connectionString: config.STAFF_DB_URL });

async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    console.info('[Migration] Starting...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS forecast_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL,
        model_version VARCHAR(20) NOT NULL,
        model_type VARCHAR(50) NOT NULL DEFAULT 'moving_average',
        accuracy NUMERIC(5,2),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (store_id, model_version)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS daily_forecasts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL,
        forecast_date DATE NOT NULL,
        hour_of_day INTEGER NOT NULL,
        predicted_orders INTEGER NOT NULL,
        predicted_revenue NUMERIC(10,2),
        confidence NUMERIC(10,2),
        actual_orders INTEGER,
        accuracy_deviation NUMERIC(5,2),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (store_id, forecast_date, hour_of_day)
      );
      CREATE INDEX IF NOT EXISTS idx_daily_forecasts_store
        ON daily_forecasts(store_id, forecast_date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS shift_recommendations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL,
        recommendation_date DATE NOT NULL,
        shift_type VARCHAR(20) NOT NULL CHECK (shift_type IN ('morning', 'afternoon', 'evening', 'night')),
        recommended_staff_count INTEGER NOT NULL,
        confidence NUMERIC(3,2),
        rationale TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_shift_recommendations_store_date
        ON shift_recommendations(store_id, recommendation_date);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS staffing_alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL,
        alert_date DATE NOT NULL,
        alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('understaffing_risk', 'overstaffing_risk', 'peak_demand')),
        message TEXT NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
        acknowledged BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_staffing_alerts_store_date_severity
        ON staffing_alerts(store_id, alert_date, severity);
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