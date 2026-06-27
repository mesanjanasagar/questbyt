import bcrypt from 'bcryptjs';
import { db } from '../db/client';
import { setDeviceSession, deleteDeviceSession } from '../redis/client';
import {
  issueTokenPair,
  rotateRefreshToken,
  revokeAllDeviceTokens,
  getRolePermissions,
} from './token.service';
import {
  UnauthorizedError,
  NotFoundError,
  generateId,
  generateSecureToken,
} from '@pos/shared-utils';
import type { LoginRequest, LoginResponse, RefreshTokenResponse, UserRole } from '@pos/shared-types';
import { config } from '../config';

export async function login(req: LoginRequest): Promise<LoginResponse> {
  // 1. Find user
  const userResult = await db.query(
    `SELECT * FROM users WHERE username = $1 AND status = 'active'`,
    [req.username],
  );

  if (userResult.rowCount === 0) {
    throw new UnauthorizedError('Invalid credentials');
  }

  const user = userResult.rows[0];

  // 2. Verify password (constant-time comparison via bcrypt)
  const valid = await bcrypt.compare(req.password, user.password_hash);
  if (!valid) {
    throw new UnauthorizedError('Invalid credentials');
  }

  // 3. Register or update device
  const deviceToken = generateSecureToken(32);
  let deviceResult = await db.query(
    `SELECT id FROM device_registrations WHERE user_id = $1 AND device_name = $2`,
    [user.id, req.deviceName],
  );

  let deviceId: string;
  if (deviceResult.rowCount === 0) {
    deviceId = generateId();
    await db.query(
      `INSERT INTO device_registrations (id, store_id, device_name, device_type, user_id, device_token, fcm_token, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')`,
      [deviceId, user.store_id, req.deviceName, req.deviceType, user.id, deviceToken, req.fcmToken ?? null],
    );
  } else {
    deviceId = deviceResult.rows[0].id;
    await db.query(
      `UPDATE device_registrations SET device_token = $1, fcm_token = $2, status = 'active', last_heartbeat = NOW()
       WHERE id = $3`,
      [deviceToken, req.fcmToken ?? null, deviceId],
    );
  }

  // 4. Update last login
  await db.query(`UPDATE users SET last_login = NOW() WHERE id = $1`, [user.id]);

  // 5. Issue tokens
  const permissions = getRolePermissions(user.role as UserRole);
  const { accessToken, refreshToken } = await issueTokenPair(
    user.id,
    user.store_id,
    deviceId,
    user.role,
    permissions,
  );

  // 6. Cache session in Redis
  await setDeviceSession(deviceId, {
    deviceId,
    userId: user.id,
    storeId: user.store_id,
    role: user.role,
    permissions,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return {
    accessToken,
    refreshToken,
    deviceId,
    user: {
      id: user.id,
      storeId: user.store_id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      lastLogin: user.last_login,
    },
    permissions,
  };
}

export async function refreshTokens(
  refreshToken: string,
  deviceId: string,
): Promise<RefreshTokenResponse> {
  const result = await rotateRefreshToken(refreshToken, deviceId);
  if (!result) {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Refresh Redis session
  await setDeviceSession(deviceId, {
    deviceId,
    userId: result.userId,
    storeId: result.storeId,
    role: result.role,
    permissions: getRolePermissions(result.role),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  });

  return result.tokenPair;
}

export async function logout(deviceId: string): Promise<void> {
  await revokeAllDeviceTokens(deviceId);
  await deleteDeviceSession(deviceId);
  await db.query(
    `UPDATE device_registrations SET status = 'inactive' WHERE id = $1`,
    [deviceId],
  );
}

export async function heartbeat(deviceId: string): Promise<void> {
  await db.query(
    `UPDATE device_registrations SET last_heartbeat = NOW() WHERE id = $1 AND status = 'active'`,
    [deviceId],
  );
}