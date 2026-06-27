import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import webhookRoutes from './routes/webhook.routes';
import { errorHandler } from './middleware/errorHandler';
import { getActiveSessions } from './session/context';

export const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3000'], credentials: true }));
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Stricter rate limit on webhook (WhatsApp sends bursts)
app.use(
  '/webhook',
  rateLimit({
    windowMs: 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests' },
  }),
);

app.use('/webhook', webhookRoutes);

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'ai-manager-service',
    activeSessions: getActiveSessions(),
    timestamp: new Date().toISOString(),
  });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
});

app.use(errorHandler);