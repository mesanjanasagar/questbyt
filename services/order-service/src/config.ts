import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(Number(process.env.ORDER_SERVICE_PORT ?? process.env.PORT ?? 3001)),
  ORDER_DB_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  KAFKA_BROKER_URL: z.string().default('localhost:9092'),
  JWT_SECRET: z.string().min(32),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;