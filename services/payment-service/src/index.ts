import 'dotenv/config';
import { app } from './app';
import { connectDb } from './db/client';
import { config } from './config';

async function bootstrap(): Promise<void> {
  await connectDb();
  app.listen(config.PORT, () => {
    console.info(`Payment service running on port ${config.PORT} [${config.NODE_ENV}]`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start payment-service:', err);
  process.exit(1);
});