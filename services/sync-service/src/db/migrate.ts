import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({
  connectionString: config.SYNC_DB_URL,
});

async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    console.info('[Migration] Starting...');

    // Offline Queue
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID NOT NULL,
        store_id UUID NOT NULL,
        operation_type VARCHAR(50) NOT NULL CHECK (operation_type IN ('order_create', 'order_update', 'order_cancel', 'payment')),
        resource_type VARCHAR(50) NOT NULL,
        resource_id UUID NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        synced_at TIMESTAMPTZ,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'syncing', 'synced', 'failed')),
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        INDEX ON (device_id, status, created_at),
        INDEX ON (store_id, synced_at)
      );
    `);

    // Reconciliation Log
    await client.query(`
      CREATE TABLE IF NOT EXISTS reconciliation_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID NOT NULL,
        store_id UUID NOT NULL,
        sync_queue_id UUID NOT NULL REFERENCES sync_queue(id) ON DELETE CASCADE,
        reconciliation_type VARCHAR(50) NOT NULL,
        local_state JSONB NOT NULL,
        remote_state JSONB NOT NULL,
        resolved_state JSONB,
        resolution_strategy VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        resolved_at TIMESTAMPTZ,
        INDEX ON (device_id, store_id, created_at)
      );
    `);

    // Conflict Resolutions
    await client.query(`
      CREATE TABLE IF NOT EXISTS conflict_resolutions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reconciliation_log_id UUID NOT NULL REFERENCES reconciliation_logs(id) ON DELETE CASCADE,
        conflict_type VARCHAR(50) NOT NULL,
        field_name VARCHAR(100),
        local_value JSONB,
        remote_value JSONB,
        resolved_value JSONB NOT NULL,
        resolution_method VARCHAR(50) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        INDEX ON (reconciliation_log_id, conflict_type)
      );
    `);

    // Deduplication Table (idempotency)
    await client.query(`
      CREATE TABLE IF NOT EXISTS sync_idempotency (
        idempotency_key VARCHAR(255) PRIMARY KEY,
        response JSONB NOT NULL,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        INDEX ON (created_at)
      );
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