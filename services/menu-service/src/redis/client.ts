import { createClient } from 'redis';
import { config } from '../config';

export const redisClient = createClient({ url: config.REDIS_URL });
redisClient.on('error', (err) => console.error('Redis error (menu-service):', err));

export async function connectRedis(): Promise<void> {
  await redisClient.connect();
  console.info('Redis connected (menu-service)');
}