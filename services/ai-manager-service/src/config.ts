import { z } from 'zod';

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(Number(process.env.AI_MANAGER_SERVICE_PORT ?? process.env.PORT ?? 3009)),
  JWT_SECRET: z.string().min(32),
  // Downstream service URLs
  REPORTING_SERVICE_URL: z.string().default('http://localhost:3008'),
  CUSTOMER_SERVICE_URL: z.string().default('http://localhost:3006'),
  MARKETING_SERVICE_URL: z.string().default('http://localhost:3014'),
  INVENTORY_SERVICE_URL: z.string().default('http://localhost:3002'),
  // WhatsApp Business API
  WHATSAPP_TOKEN: z.string().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().default('pos-verify-token'),
  WHATSAPP_API_URL: z.string().default('https://graph.facebook.com/v19.0'),
  WHATSAPP_PHONE_ID: z.string().default(''),
  // Map manager phone → storeId (JSON: {"971501234567":"<uuid>"})
  MANAGER_PHONE_MAP: z.string().default('{}'),
});

const parsed = configSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  process.exit(1);
}

export const config = parsed.data;

// Parse manager phone → store mapping
export function getStoreIdForPhone(phone: string): string | null {
  try {
    const map = JSON.parse(config.MANAGER_PHONE_MAP) as Record<string, string>;
    return map[phone] ?? null;
  } catch {
    return null;
  }
}