import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

// Security headers
app.use(helmet());

// CORS - internal services + POS terminal
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  }),
);

// Request logging
app.use(morgan('combined'));

// Body parser
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// Rate limiting - auth endpoints are sensitive
const authLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,             // 20 attempts per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later' },
});

app.use('/auth', authLimiter);

// Routes
app.use('/auth', authRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service', timestamp: new Date().toISOString() });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
});

// Error handler (must be last)
app.use(errorHandler);