import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(Number(process.env.STAFF_SERVICE_PORT ?? process.env.PORT ?? 3015)),
  STAFF_DB_URL: z.string().min(1),
  KAFKA_BROKER_URL: z.string().default('localhost:9092'),
  JWT_SECRET: z.string().min(32),
  ORDER_SERVICE_URL: z.string().default('http://localhost:3001'),
  STORE_SERVICE_URL: z.string().default('http://localhost:3011'),
  FORECAST_SCHEDULE: z.string().default('0 1 * * *'),
  FORECAST_DAYS_AHEAD: z.coerce.number().default(7),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;