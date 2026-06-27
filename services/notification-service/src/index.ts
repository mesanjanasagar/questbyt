import 'dotenv/config';
import { app } from './app';
import { connectConsumer, disconnectConsumer } from './events/consumer';
import { config } from './config';

async function bootstrap(): Promise<void> {
  try {
    await connectConsumer();
  } catch (err) {
    console.error('Failed to connect Kafka consumer:', err);
    process.exit(1);
  }

  const server = app.listen(config.PORT, () => {
    console.info(`Notification service running on port ${config.PORT} [${config.NODE_ENV}]`);
    console.info('notification-service: listening to Kafka events for delivery');
  });

  const shutdown = async (): Promise<void> => {
    console.info('Shutting down notification-service...');
    server.close();
    await disconnectConsumer();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start notification-service:', err);
  process.exit(1);
});