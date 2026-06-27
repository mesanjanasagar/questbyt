import type { Request, Response, NextFunction } from 'express';
import { ValidationError } from '@pos/shared-utils';

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
  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
}