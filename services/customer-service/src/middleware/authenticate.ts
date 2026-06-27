import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { JwtPayload } from '@pos/shared-types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      isInternalService?: boolean;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  if (req.headers['x-internal-service'] === 'customer-service') {
    req.isInternalService = true;
    next();
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Missing authentication token' });
    return;
  }
  try {
    req.user = jwt.verify(authHeader.slice(7), config.JWT_SECRET) as JwtPayload;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token' });
  }
}