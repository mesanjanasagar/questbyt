import { Pool, PoolClient } from 'pg';
import { config } from '../config';

const pool = new Pool({
  connectionString: config.RESERVATION_DB_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('[DB Pool Error]', err));

export async function connectDb(): Promise<void> {
  const client = await pool.connect();
  await client.query('SELECT NOW()');
  client.release();
  console.info('[DB] Connected to pos_reservations database');
}

export async function executeQuery<T = unknown>(query: string, params?: unknown[]): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(query, params);
    return result.rows;
  } finally {
    client.release();
  }
}

export async function executeQuerySingle<T = unknown>(query: string, params?: unknown[]): Promise<T | null> {
  const results = await executeQuery<T>(query, params);
  return results[0] ?? null;
}

export async function executeTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function disconnectDb(): Promise<void> {
  await pool.end();
  console.info('[DB] Disconnected');
}