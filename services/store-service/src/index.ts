import 'dotenv/config';
import { app } from './app';
import { config } from './config';
import { db } from './db/client';

async function start(): Promise<void> {
  // Verify DB connectivity before accepting traffic
  await db.query('SELECT 1');
  console.info('[store-service] DB connection verified');

  app.listen(config.PORT, () => {
    console.info(`[store-service] Listening on port ${config.PORT}`);
  });
}

start().catch((err) => {
  console.error('[store-service] Failed to start:', err);
  process.exit(1);
});