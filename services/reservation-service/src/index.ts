import 'dotenv/config';
import { app } from './app';
import { connectDb, disconnectDb } from './db/client';
import { config } from './config';

async function bootstrap(): Promise<void> {
  await connectDb();

  const server = app.listen(config.PORT, () => {
    console.info(`[Reservation Service] running on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  const shutdown = async (): Promise<void> => {
    console.info('[Reservation Service] Shutting down...');
    server.close(async () => {
      await disconnectDb();
      console.info('[Reservation Service] Disconnected');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Reservation Service] Force shutdown');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Reservation Service] Failed to start:', err);
  process.exit(1);
});