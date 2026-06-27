import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import menuRoutes from './routes/menu.routes';
import itemRoutes from './routes/item.routes';
import { errorHandler } from './middleware/errorHandler';

export const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));

app.use('/api/v1/menus', menuRoutes);
app.use('/api/v1/items', itemRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'menu-service', timestamp: new Date().toISOString() });
});

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Route not found' });
});

app.use(errorHandler);