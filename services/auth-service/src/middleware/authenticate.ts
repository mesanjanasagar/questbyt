import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/token.service';
import { getDeviceSession } from '../redis/client';
import type { JwtPayload } from '@pos/shared-types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing authentication token' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);

    // Optionally verify device session is still active in Redis
    const deviceId = req.headers['x-device-id'] as string;
    if (deviceId && deviceId !== payload.deviceId) {
      res.status(401).json({ success: false, error: 'Device ID mismatch' });
      return;
    }

    req.user = payload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return;
    }

    const hasPermission =
      user.permissions.includes('all:*') || user.permissions.includes(permission);

    if (!hasPermission) {
      res.status(403).json({ success: false, error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}