import 'dotenv/config';
import { app } from './app';
import { connectDb, disconnectDb } from './db/client';
import { startScoringJob, stopScoringJob } from './jobs/scoring.job';
import { config } from './config';

async function bootstrap(): Promise<void> {
  await connectDb();
  await startScoringJob();

  const server = app.listen(config.PORT, () => {
    console.info(`[Churn Engine] running on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  const shutdown = async (): Promise<void> => {
    console.info('[Churn Engine] Shutting down...');
    await stopScoringJob();
    server.close(async () => {
      await disconnectDb();
      console.info('[Churn Engine] Disconnected');
      process.exit(0);
    });

    setTimeout(() => {
      console.error('[Churn Engine] Force shutdown');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[Churn Engine] Failed to start:', err);
  process.exit(1);
});