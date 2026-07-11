import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(Number(process.env.MARKETING_SERVICE_PORT ?? process.env.PORT ?? 3014)),
  MARKETING_DB_URL: z.string().min(1),
  KAFKA_BROKER_URL: z.string().default('localhost:9092'),
  JWT_SECRET: z.string().min(32),
  CUSTOMER_SERVICE_URL: z.string().default('http://localhost:3012'),
  // Store name injected into templates (can be per-store later)
  DEFAULT_STORE_NAME: z.string().default('Our Store'),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;