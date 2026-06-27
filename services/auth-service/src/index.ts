import 'dotenv/config';
import { app } from './app';
import { connectDb } from './db/client';
import { connectRedis } from './redis/client';
import { config } from './config';

async function bootstrap(): Promise<void> {
  await connectDb();
  await connectRedis();

  app.listen(config.PORT, () => {
    console.info(`Auth service running on port ${config.PORT} [${config.NODE_ENV}]`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start auth-service:', err);
  process.exit(1);
});