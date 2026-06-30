import { Request, Response, NextFunction } from 'express';
import { NotFoundError, ConflictError } from '@pos/shared-utils';
import { ZodError } from 'zod';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  if (err instanceof ConflictError) {
    res.status(409).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
    return;
  }

  // Handle raw PostgreSQL errors
  const pgCode = (err as any)?.code;
  if (pgCode === '23505') {
    const detail: string = (err as any)?.detail ?? '';
    const field = detail.match(/Key \(([^)]+)\)/)?.[1] ?? 'field';
    console.warn('[store-service] Unique constraint violation:', detail);
    res.status(409).json({ error: `Duplicate value: ${field} already exists for this store` });
    return;
  }
  if (pgCode === '23503') {
    const detail: string = (err as any)?.detail ?? '';
    console.warn('[store-service] FK violation:', detail);
    const ref = detail.match(/Key \(([^)]+)\)/)?.[1] ?? 'record';
    res.status(400).json({ error: `Referenced ${ref} not found. Please check the provided IDs.` });
    return;
  }

  console.error('[store-service] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
}