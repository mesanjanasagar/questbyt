import 'dotenv/config';
import { app } from './app';
import { connectDb, disconnectDb } from './db/client';
import { startForecastJob, stopForecastJob } from './jobs/forecast.job';
import { config } from './config';

async function bootstrap(): Promise<void> {
  await connectDb();
  await startForecastJob();

  const server = app.listen(config.PORT, () => {
    console.info(`[Staff Optimization] running on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  const shutdown = async (): Promise<void> => {
    console.info('[Staff Optimization] Shutting down...');
    await stopForecastJob();

    server.close(async () => {
      await disconnectDb();
      console.info('[Staff Optimization] Disconnected');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Staff Optimization] Force shutdown');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Staff Optimization] Failed to start:', err);
  process.exit(1);
});