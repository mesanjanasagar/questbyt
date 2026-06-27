import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(Number(process.env.SYNC_SERVICE_PORT ?? process.env.PORT ?? 3006)),
  SYNC_DB_URL: z.string().min(1),
  KAFKA_BROKER_URL: z.string().default('localhost:9092'),
  JWT_SECRET: z.string().min(32),
  ORDER_SERVICE_URL: z.string().default('http://localhost:3001'),
  INVENTORY_SERVICE_URL: z.string().default('http://localhost:3002'),
  RECONCILIATION_BATCH_SIZE: z.coerce.number().default(50),
  RECONCILIATION_TIMEOUT_MS: z.coerce.number().default(30000),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;