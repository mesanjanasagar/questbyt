import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3008),
  REPORTING_DB_URL: z.string().min(1),
  KAFKA_BROKER_URL: z.string().default('localhost:9092'),
  JWT_SECRET: z.string().min(32),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;