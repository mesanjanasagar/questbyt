import type { Request, Response, NextFunction } from 'express';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from '@pos/shared-utils';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: err.message });
    return;
  }
  if (err instanceof UnauthorizedError) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: err.message });
    return;
  }
  if (err instanceof ForbiddenError) {
    res.status(403).json({ success: false, error: 'FORBIDDEN', message: err.message });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ success: false, error: 'NOT_FOUND', message: err.message });
    return;
  }
  if (err instanceof ConflictError) {
    res.status(409).json({ success: false, error: 'CONFLICT', message: err.message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}