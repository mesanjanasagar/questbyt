import 'dotenv/config';
import { app } from './app';
import { config } from './config';

async function bootstrap(): Promise<void> {
  const server = app.listen(config.PORT, () => {
    console.info(`[API Gateway] running on port ${config.PORT} [${config.NODE_ENV}]`);
  });

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.info('[API Gateway] Shutting down...');
    server.close(() => {
      console.info('[API Gateway] Server closed');
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error('[API Gateway] Force shutdown');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('[API Gateway] Failed to start:', err);
  process.exit(1);
});