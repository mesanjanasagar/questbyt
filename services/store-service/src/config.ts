import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3011),
  STORE_DB_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  CORS_ORIGIN: z.string().default('*'),
  INTERNAL_SERVICE_SECRET: z.string().default('internal-secret-change-in-prod'),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;