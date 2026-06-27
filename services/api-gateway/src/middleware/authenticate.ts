import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload } from '@pos/shared-types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      correlationId?: string;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const correlationId = req.headers['x-correlation-id'] as string || generateCorrelationId();

  req.correlationId = correlationId;

  // Service-to-service call bypass
  if (req.headers['x-internal-service']) {
    next();
    return;
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Missing or invalid token' });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Invalid token' });
  }
}

export function generateCorrelationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const correlationId = req.headers['x-correlation-id'] as string || generateCorrelationId();

  req.correlationId = correlationId;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
      req.user = payload;
    } catch {
      // Silently continue without auth
    }
  }

  next();
}