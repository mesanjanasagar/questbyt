import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { JwtPayload } from '@pos/shared-types';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

// Services that call order-service internally (unauthenticated by end-user
// JWT). customer-service needs GET /orders/:id to resolve which customer an
// order belongs to when a payment.processed event comes in — without it,
// recordOrderForCustomer never fires and loyalty points/totalOrders never
// update, even though the order really did have a customer attached.
const TRUSTED_INTERNAL_SERVICES = ['payment-service', 'customer-service'];

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Allow internal service-to-service calls
  if (TRUSTED_INTERNAL_SERVICES.includes(req.headers['x-internal-service'] as string)) {
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

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) { res.status(401).json({ success: false, error: 'Unauthenticated' }); return; }
    const hasPermission = user.permissions.includes('all:*') || user.permissions.includes(permission);
    if (!hasPermission) { res.status(403).json({ success: false, error: 'Insufficient permissions' }); return; }
    next();
  };
}