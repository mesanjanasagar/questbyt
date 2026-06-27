import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(Number(process.env.PAYMENT_SERVICE_PORT ?? process.env.PORT ?? 3003)),
  PAYMENT_DB_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  ORDER_SERVICE_URL: z.string().default('http://localhost:3001'),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;
