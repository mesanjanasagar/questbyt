import { createClient } from 'redis';
import { config } from '../config';

export const redisClient = createClient({ url: config.REDIS_URL });

redisClient.on('error', (err) => console.error('Redis error:', err));

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
  console.info('Redis connected (auth-service)');
}

// Session TTL: 24 hours (in seconds)
export const SESSION_TTL = 60 * 60 * 24;

export async function setDeviceSession(
  deviceId: string,
  payload: Record<string, unknown>,
): Promise<void> {
  await redisClient.setEx(
    `device_session:${deviceId}`,
    SESSION_TTL,
    JSON.stringify(payload),
  );
}

export async function getDeviceSession(deviceId: string): Promise<Record<string, unknown> | null> {
  const raw = await redisClient.get(`device_session:${deviceId}`);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
}

export async function deleteDeviceSession(deviceId: string): Promise<void> {
  await redisClient.del(`device_session:${deviceId}`);
}