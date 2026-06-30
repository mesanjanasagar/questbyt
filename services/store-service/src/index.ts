import 'dotenv/config';
import { app } from './app';
import { config } from './config';
import { db } from './db/client';
import { connectProducer, disconnectProducer } from './events/producer';

async function start(): Promise<void> {
  await db.query('SELECT 1');
  console.info('[store-service] DB connection verified');

  // Connect to Kafka in the background — publishEvent handles producer === null gracefully
  connectProducer().catch((err: Error) =>
    console.warn('[store-service] Kafka producer unavailable, events will be skipped:', err.message),
  );

  const server = app.listen(config.PORT, () => {
    console.info(`[store-service] Listening on port ${config.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectProducer();
    await db.end();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start().catch((err) => {
  console.error('[store-service] Failed to start:', err);
  process.exit(1);
});