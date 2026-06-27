import 'dotenv/config';
import { app } from './app';
import { connectDb } from './db/client';
import { connectProducer } from './events/producer';
import { config } from './config';

async function bootstrap(): Promise<void> {
  await connectDb();

  // Kafka connection is optional in dev (graceful degradation)
  connectProducer().catch((err) =>
    console.warn('Kafka unavailable, events will be skipped:', err.message),
  );

  app.listen(config.PORT, () => {
    console.info(`Order service running on port ${config.PORT} [${config.NODE_ENV}]`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start order-service:', err);
  process.exit(1);
});