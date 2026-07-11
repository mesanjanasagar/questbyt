import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import customerRoutes from './routes/customer.routes';
import { errorHandler } from './middleware/errorHandler';

export const app: Express = express();

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

// The gateway mounts this whole service at '/api/v1/customers' and strips
// that prefix before proxying — every other service (order, inventory,
// store...) mounts its routes at the bare resource path for the same
// reason. This used to mount at '/api/v1/customers' too, which meant every
// request arriving from the gateway 404'd before reaching a route handler.
app.use('/customers', customerRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'customer-service', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
});

app.use(errorHandler);