import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { config } from '../config';
import { db } from '../db/client';
import { generateSecureToken, generateId } from '@pos/shared-utils';
import type { JwtPayload, UserRole } from '@pos/shared-types';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.JWT_SECRET) as JwtPayload;
}

export async function issueTokenPair(
  userId: string,
  storeId: string,
  deviceId: string,
  role: UserRole,
  permissions: string[],
): Promise<TokenPair> {
  const accessToken = signAccessToken({ sub: userId, storeId, deviceId, role, permissions });
  const refreshToken = generateSecureToken(48);
  const tokenHash = createHash('sha256').update(refreshToken).digest('hex');

  // Store hashed refresh token with 7d expiry
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    `INSERT INTO refresh_tokens (id, token_hash, device_id, user_id, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [generateId(), tokenHash, deviceId, userId, expiresAt],
  );

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(
  oldRefreshToken: string,
  deviceId: string,
): Promise<{ userId: string; storeId: string; role: UserRole; tokenPair: TokenPair } | null> {
  const tokenHash = createHash('sha256').update(oldRefreshToken).digest('hex');
  const result = await db.query(
    `SELECT rt.*, u.store_id, u.role FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.device_id = $2
      AND rt.is_revoked = FALSE AND rt.expires_at > NOW()`,
    [tokenHash, deviceId],
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0];

  // Revoke old token
  await db.query(`UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE token_hash = $1`, [
    tokenHash,
  ]);

  // Load permissions
  const permissions = getRolePermissions(row.role as UserRole);
  const tokenPair = await issueTokenPair(row.user_id, row.store_id, deviceId, row.role, permissions);
  return { userId: row.user_id, storeId: row.store_id, role: row.role, tokenPair };
}

export async function revokeAllDeviceTokens(deviceId: string): Promise<void> {
  await db.query(
    `UPDATE refresh_tokens SET is_revoked = TRUE, revoked_at = NOW() WHERE device_id = $1`,
    [deviceId],
  );
}

// RBAC permission map
const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['all:*'],
  manager: [
    'order:view_all', 'inventory:manage', 'device:manage',
    'reports:view', 'user:create', 'user:edit', 'refund:approve', 'promo:manage',
  ],
  cashier: ['order:create', 'order:view_own', 'order:close', 'payment:process', 'refund:request'],
  kitchen: ['order:view', 'order:status_update', 'inventory:view'],
  waiter: ['order:create', 'order:view', 'customer:manage'],
};

export function getRolePermissions(role: UserRole): string[] {
  return ROLE_PERMISSIONS[role] ?? [];
}