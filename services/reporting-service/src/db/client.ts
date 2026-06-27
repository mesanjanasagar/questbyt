1   import { Pool } from 'pg';
2   import { config } from '../config';
3   
4   export const db = new Pool({ connectionString: config.REPORTING_DB_URL });
5   
6   export async function connectDb(): Promise<void> {
7     const client = await db.connect();
8     client.release();
9     console.info('Reporting service DB connected');
10  }
11