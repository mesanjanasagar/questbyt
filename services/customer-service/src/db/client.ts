import { Pool } from 'pg';
import { config } from '../config';

export const db = new Pool({ connectionString: config.CUSTOMER_DB_URL });

export async function connectDb(): Promise<void> {
  const client = await db.connect();
  client.release();
  console.info('Customer service DB connected');
}