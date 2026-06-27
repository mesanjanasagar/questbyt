import 'dotenv/config';
import { app } from './app';
import { connectDb } from './db/client';
import { connectProducer, disconnectProducer } from './events/producer';
import { connectConsumer, disconnectConsumer } from './events/consumer';
import { config } from './config';

async function bootstrap(): Promise<void> {
  await connectDb();

  // Kafka is optional in dev (graceful degradation)
  try {
    await connectProducer();
    await connectConsumer();
  } catch (err) {
    console.warn('Kafka unavailable – running without event streaming:', (err as Error).message);
  }

  const server = app.listen(config.PORT, () => {
    console.info(`Customer service running on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  const shutdown = async (): Promise<void> => {
    console.info('Shutting down customer-service...');
    server.close();
    await disconnectConsumer();
    await disconnectProducer();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start customer-service:', err);
  process.exit(1);
});