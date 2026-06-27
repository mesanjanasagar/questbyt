import { Request, Response, NextFunction } from 'express';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const request = req as any;

  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${request.correlationId || 'no-id'}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });

  next();
}
