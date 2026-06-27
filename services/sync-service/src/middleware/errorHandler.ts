import { Request, Response, NextFunction } from 'express';
import {
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
} from '@pos/shared-utils';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  console.error('[Error Handler]', {
    name: err.name,
    message: err.message,
    stack: err.stack,
  });

  if (err instanceof ValidationError) {
    res.status(400).json({ success: false, error: 'VALIDATION_ERROR', message: err.message });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({ success: false, error: 'NOT_FOUND', message: err.message });
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

  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}