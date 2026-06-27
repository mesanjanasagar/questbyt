import { Pool } from 'pg';
import { config } from '../config';

const pool = new Pool({ connectionString: config.RESERVATION_DB_URL });

async function migrate(): Promise<void> {
  const client = await pool.connect();
  try {
    console.info('[Migration] Starting...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS restaurant_tables (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL,
        table_number VARCHAR(20) NOT NULL,
        capacity INTEGER NOT NULL,
        location VARCHAR(50),
        status VARCHAR(20) NOT NULL DEFAULT 'available'
          CHECK (status IN ('available', 'reserved', 'occupied', 'cleaning')),
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (store_id, table_number)
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tables_store_status ON restaurant_tables (store_id, status);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reservations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL,
        customer_id UUID,
        table_id UUID REFERENCES restaurant_tables(id),
        customer_name VARCHAR(100) NOT NULL,
        customer_phone VARCHAR(30),
        customer_email VARCHAR(150),
        party_size INTEGER NOT NULL,
        reserved_date DATE NOT NULL,
        reserved_time TIME NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
          CHECK (status IN ('confirmed', 'arrived', 'seated', 'completed', 'cancelled', 'no_show')),
        notes TEXT,
        order_id UUID,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reservations_store_date ON reservations (store_id, reserved_date, status);
      CREATE INDEX IF NOT EXISTS idx_reservations_customer ON reservations (customer_id, store_id);
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS walk_in_checkins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID NOT NULL,
        table_id UUID REFERENCES restaurant_tables(id),
        party_size INTEGER NOT NULL,
        checked_in_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        seated_at TIMESTAMPTZ,
        left_at TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reservation_cancellations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
        reason TEXT,
        cancelled_by VARCHAR(50) NOT NULL CHECK (cancelled_by IN ('customer', 'staff', 'system')),
        refund_amount NUMERIC(10,2),
        cancelled_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
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