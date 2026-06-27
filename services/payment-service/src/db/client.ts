import { Pool } from 'pg';
import { config } from '../config';

export const db = new Pool({ connectionString: config.PAYMENT_DB_URL });

export async function connectDb(): Promise<void> {
  const client = await db.connect();
  client.release();
  console.info('Payment service DB connected');
}