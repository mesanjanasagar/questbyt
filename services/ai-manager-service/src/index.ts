import 'dotenv/config';
import { app } from './app';
import { config } from './config';

async function bootstrap(): Promise<void> {
  const server = app.listen(config.PORT, () => {
    console.info(`AI Manager service running on port ${config.PORT} [${config.NODE_ENV}]`);
    if (!config.WHATSAPP_TOKEN) {
      console.info('AI Manager: running in MOCK mode (no WHATSAPP_TOKEN set) — messages logged to console');
    }
    console.info(`AI Manager: webhook URL → POST /webhook`);
    console.info(`AI Manager: direct query URL → POST /webhook/query`);
  });

  const shutdown = async (): Promise<void> => {
    console.info('Shutting down ai-manager-service...');
    server.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start ai-manager-service:', err);
  process.exit(1);
});