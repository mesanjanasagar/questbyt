import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import inventoryRoutes from './routes/inventory.routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? [
      'http://localhost:5173',
      'http://localhost:3000',
    ],
    credentials: true,
  }),
);
app.use(morgan('combined'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later' },
  }),
);

app.use('/api/v1/inventory', inventoryRoutes);
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'inventory-service', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
});

app.use(errorHandler);