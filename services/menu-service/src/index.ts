import 'dotenv/config';
import { app } from './app';
import { connectDb } from './db/client';
import { connectRedis } from './redis/client';
import { config } from './config';

async function bootstrap(): Promise<void> {
  await connectDb();

  // Redis is used for caching — connect in background so a slow Redis
  // doesn't block the service from starting
  connectRedis().catch((err: Error) =>
    console.warn('[menu-service] Redis unavailable at startup, will retry:', err.message),
  );

  app.listen(config.PORT, () => {
    console.info(`Menu service running on port ${config.PORT} [${config.NODE_ENV}]`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start menu-service:', err);
  process.exit(1);
});