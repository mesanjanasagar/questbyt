import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(Number(process.env.CUSTOMER_SERVICE_PORT ?? process.env.PORT ?? 3012)),
  CUSTOMER_DB_URL: z.string().min(1),
  KAFKA_BROKER_URL: z.string().default('localhost:9092'),
  JWT_SECRET: z.string().min(32),
  // Loyalty: points earned per AED spent (default: 1 pt per AED 10)
  POINTS_PER_AED: z.coerce.number().default(0.1),
  // Tier thresholds (lifetime points)
  TIER_GOLD_THRESHOLD: z.coerce.number().default(500),
  TIER_PLATINUM_THRESHOLD: z.coerce.number().default(2000),
  // Segment thresholds (days since last order)
  SEGMENT_ACTIVE_DAYS: z.coerce.number().default(7),
  SEGMENT_AT_RISK_DAYS: z.coerce.number().default(14),
  SEGMENT_CHURNED_DAYS: z.coerce.number().default(30),
  // VIP: top spend percentile threshold (AED)
  VIP_SPEND_THRESHOLD: z.coerce.number().default(5000),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;