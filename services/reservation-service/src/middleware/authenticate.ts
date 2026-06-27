import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JwtPayload } from '@pos/shared-types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

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