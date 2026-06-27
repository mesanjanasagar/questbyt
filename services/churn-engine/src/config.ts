import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(Number(process.env.CHURN_SERVICE_PORT ?? process.env.PORT ?? 3009)),
  CHURN_DB_URL: z.string().min(1),
  KAFKA_BROKER_URL: z.string().default('localhost:9092'),
  JWT_SECRET: z.string().min(32),
  CUSTOMER_SERVICE_URL: z.string().default('http://localhost:3008'),
  ORDER_SERVICE_URL: z.string().default('http://localhost:3001'),
  MARKETING_SERVICE_URL: z.string().default('http://localhost:3009'),
  SCORING_SCHEDULE: z.string().default('0 2 * * *'), // 2 AM daily
  CHURN_SCORE_THRESHOLD: z.coerce.number().default(0.7),
  RISK_SCORE_THRESHOLD: z.coerce.number().default(0.5),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;