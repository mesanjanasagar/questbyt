import { Pool } from 'pg';
import { config } from '../config';

export const db = new Pool({ connectionString: config.INVENTORY_DB_URL });

export async function connectDb(): Promise<void> {
  const client = await db.connect();
  client.release();
  console.info('Inventory service DB connected');
}