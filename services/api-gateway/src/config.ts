import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(Number(process.env.API_GATEWAY_PORT ?? process.env.PORT ?? 3000)),

  // Service URLs
  AUTH_SERVICE_URL: z.string().default('http://localhost:3004'),
  ORDER_SERVICE_URL: z.string().default('http://localhost:3001'),
  MENU_SERVICE_URL: z.string().default('http://localhost:3005'),
  INVENTORY_SERVICE_URL: z.string().default('http://localhost:3002'),
  PAYMENT_SERVICE_URL: z.string().default('http://localhost:3003'),
  CUSTOMER_SERVICE_URL: z.string().default('http://localhost:3008'),
  MARKETING_SERVICE_URL: z.string().default('http://localhost:3009'),
  REPORTING_SERVICE_URL: z.string().default('http://localhost:3008'),
  STORE_SERVICE_URL: z.string().default('http://localhost:3011'),
  NOTIFICATION_SERVICE_URL: z.string().default('http://localhost:3007'),
  SYNC_SERVICE_URL: z.string().default('http://localhost:3006'),
  CHURN_SERVICE_URL: z.string().default('http://localhost:3009'),
  RESERVATION_SERVICE_URL: z.string().default('http://localhost:3010'),
  AI_MANAGER_SERVICE_URL: z.string().default('http://localhost:3009'),

  JWT_SECRET: z.string().min(32),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  ALLOWED_ORIGINS: z.string().default('http://localhost:5173,http://localhost:5000,http://localhost:5001,http://localhost:5002,http://localhost:5003,http://localhost:5004'),

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(300),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;