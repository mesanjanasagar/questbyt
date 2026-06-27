import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { storeRoutes } from './routes/store.routes';
import { errorHandler } from './middleware/errorHandler';
import { config } from './config';

const app = express();

// ── Security ─────────────────────────
app.use(helmet());
app.use(cors({ origin: config.CORS_ORIGIN, credentials: true }));

// ── Rate limiting ────────────────────
app.use(
  rateLimit({
    windowMs: 60_000, // 1 minute
    max: 200,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── Parsing + logging ────────────────
app.use(express.json({ limit: '1mb' }));
app.use(morgan('short'));

// ── Health check (unauthenticated) ──
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'store-service' });
});

// ── Routes ───────────────────────────
app.use('/stores', storeRoutes);

// ── Error handler ────────────────────
app.use(errorHandler);

export { app };