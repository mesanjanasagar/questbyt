import { db } from './client';

const migrations = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin','manager','cashier','kitchen','waiter')),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_store ON users(store_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Device registrations
CREATE TABLE IF NOT EXISTS device_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL,
    device_name VARCHAR(255),
    device_type VARCHAR(50) NOT NULL CHECK (device_type IN ('pos_terminal','kds','mobile','kiosk','dashboard')),
    user_id UUID REFERENCES users(id),
    device_token VARCHAR(512) UNIQUE,
    fcm_token VARCHAR(512),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive','revoked')),
    last_heartbeat TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_store ON device_registrations(store_id);
CREATE INDEX IF NOT EXISTS idx_devices_token ON device_registrations(device_token);
CREATE INDEX IF NOT EXISTS idx_devices_user ON device_registrations(user_id);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash VARCHAR(512) UNIQUE NOT NULL,
    device_id UUID NOT NULL REFERENCES device_registrations(id),
    user_id UUID NOT NULL REFERENCES users(id),
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    is_revoked BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_device ON refresh_tokens(device_id);
`;

async function runMigrations(): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(migrations);
    await client.query('COMMIT');
    console.info('Auth service migrations complete');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

runMigrations()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));