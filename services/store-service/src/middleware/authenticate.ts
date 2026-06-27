import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface AuthenticatedRequest extends Request {
  storeId?: string;
  userId?: string;
  role?: string;
}

export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  // Internal service-to-service calls bypass JWT
  if (req.headers['x-internal-service'] === config.INTERNAL_SERVICE_SECRET) {
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or malformed Authorization header' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as {
      storeId: string;
      userId: string;
      role: string;
    };

    req.storeId = payload.storeId;
    req.userId = payload.userId;
    req.role = payload.role;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Restrict route to admin / owner roles only */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (req.role !== 'admin' && req.role !== 'owner') {
    res.status(403).json({ error: 'Insufficient permissions' });
    return;
  }

  next();
}