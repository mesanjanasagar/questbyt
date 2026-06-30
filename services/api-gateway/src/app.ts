import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import proxy from 'express-http-proxy';
import { config } from './config';
import { errorHandler } from './middleware/errorhandler';
import { authenticate, optionalAuthenticate } from './middleware/authenticate';
import { requestLogger } from './middleware/requestlogger';
import { getServiceTarget, injectCorrelationId } from './utils/proxy';

export const app: Express = express();

// Helmet for security
app.use(helmet());

// CORS
app.use(cors({
  origin: config.ALLOWED_ORIGINS.split(','),
  credentials: true,
}));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

// Request correlation ID and logging
app.use(requestLogger);

// Global rate limiting (300 req/min)
const globalRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
});
app.use(globalRateLimiter);

// Per-user rate limiting (100 req/min per user)
const perUserRateLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.NODE_ENV === 'production' ? 100 : 10000,
  standardHeaders: false,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.sub || req.ip || 'anonymous',
  skip: (req) => !req.user || req.path === '/health',
});
app.use(perUserRateLimiter);

// Health check (no auth required)
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    timestamp: new Date().toISOString(),
  });
});

// Auth routes (public) — req.path here is already stripped of '/api/v1/auth' by Express
app.use('/api/v1/auth', optionalAuthenticate, (req: any, res, next) => {
  injectCorrelationId(req);
  proxy(config.AUTH_SERVICE_URL, {
    proxyReqPathResolver: (req: any) => '/auth' + req.path,
  })(req, res, next);
});

// All other routes (authenticated)
app.use('/api/v1', authenticate, (req: any, res, next) => {
  injectCorrelationId(req);

  const target = getServiceTarget(req);
  if (!target) {
    res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
    return;
  }

  const serviceProxy = proxy(target, {
      // req.url preserves the query string (req.path drops it)
      proxyReqPathResolver: (req: any) => req.url,
      userResHeaderDecorator: (headers: any, userReq: any) => {
      headers['x-correlation-id'] = userReq.correlationId || '';
      return headers;
    },
  });

  serviceProxy(req, res, next);
});

// 404
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
});

// Error handling
app.use(errorHandler);