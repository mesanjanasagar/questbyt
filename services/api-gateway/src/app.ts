import express, { Express } from 'express';
import http from 'http';
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

// Public kiosk catalog — read-only menu browsing (no auth required)
app.get('/api/v1/menus/full', (req: any, res, next) => {
  injectCorrelationId(req);
  const qs = req.originalUrl.split('?')[1];
  proxy(config.MENU_SERVICE_URL, {
    proxyReqPathResolver: () => `/menus/full${qs ? '?' + qs : ''}`,
  })(req, res, next);
});

// Kiosk order creation (public — no auth required, kiosk terminals are public-facing)
app.use('/api/v1/orders/kiosk', (req: any, res, next) => {
  if (req.method !== 'POST') { next(); return; }
  injectCorrelationId(req);
  proxy(config.ORDER_SERVICE_URL, {
    proxyReqPathResolver: () => '/orders/kiosk',
  })(req, res, next);
});

// SSE real-time events — must be before the generic /api/v1 proxy
// express-http-proxy buffers responses and breaks streaming; use raw http.request instead.
app.get('/api/v1/orders/events', authenticate, (req: any, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const qs = req.originalUrl.includes('?') ? req.originalUrl.split('?')[1] : '';
  const orderServiceUrl = new URL(config.ORDER_SERVICE_URL);
  const proxyReq = http.request({
    hostname: orderServiceUrl.hostname,
    port: parseInt(orderServiceUrl.port || '80', 10),
    path: `/orders/events${qs ? '?' + qs : ''}`,
    method: 'GET',
    headers: {
      'x-user-id': req.user?.sub ?? '',
      'x-store-id': req.user?.storeId ?? '',
      Accept: 'text/event-stream',
    },
  }, (proxyRes) => {
    proxyRes.pipe(res, { end: true });
    proxyRes.on('error', () => { try { res.end(); } catch { /* ignore */ } });
  });

  proxyReq.on('error', (err) => {
    console.error('[gateway] SSE proxy error:', err.message);
    try { res.end(); } catch { /* ignore */ }
  });

  req.on('close', () => proxyReq.destroy());
  proxyReq.end();
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