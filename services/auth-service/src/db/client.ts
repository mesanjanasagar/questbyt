import { Pool } from 'pg';
import { config } from '../config';

export const db = new Pool({
  connectionString: config.AUTH_DB_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

db.on('error', (err) => {
  console.error('Unexpected DB pool error', err);
});

export async function connectDb(): Promise<void> {
  const client = await db.connect();
  client.release();
  console.info('PostgreSQL connected (auth-service)');
}