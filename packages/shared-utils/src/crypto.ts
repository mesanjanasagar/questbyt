import { v4 as uuidv4 } from 'uuid';
import { createHmac, randomBytes } from 'crypto';

export function generateId(): string {
  return uuidv4();
}

export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

export function generateHmac(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('hex');
}

export function verifyHmac(secret: string, data: string, expectedHmac: string): boolean {
  const computed = generateHmac(secret, data);
  // Constant-time comparison to prevent timing attacks
  if (computed.length !== expectedHmac.length) return false;

  let result = 0;
  for (let i = 0; i < computed.length; i++) {
    result |= computed.charCodeAt(i) ^ expectedHmac.charCodeAt(i);
  }

  return result === 0;
}