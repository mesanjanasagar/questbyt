import { Router } from 'express';
import { z } from 'zod';
import * as reportingService from '../services/reporting.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';

const router = Router();

router.use(authenticate);

// ---- Shared date range validator ----
const dateRangeSchema = z.object({
  storeId: z.string().uuid(),
  from: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  to: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

// GET /api/v1/reports/revenue?storeId=&from=&to=&period=
router.get('/revenue', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      dateRangeSchema.extend({
        period: z.enum(['day', 'week', 'month']).default('day'),
      }),
      req.query,
    );
    const report = await reportingService.getRevenueReport(
      query.storeId,
      query.from,
      query.to,
      query.period,
    );
    res.json(successResponse(report));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/channels?storeId=&from=&to=
router.get('/channels', async (req, res, next) => {
  try {
    const query = validateOrThrow(dateRangeSchema, req.query);
    const contributions = await reportingService.getChannelContributions(
      query.storeId,
      query.from,
      query.to,
    );
    res.json(successResponse(contributions));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/daily?storeId=&days=
router.get('/daily', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        days: z.coerce.number().int().min(1).max(90).default(30),
      }),
      req.query,
    );
    const snapshots = await reportingService.getDailySnapshots(query.storeId, query.days);
    res.json(successResponse(snapshots));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/top-items?storeId=&from=&to=&limit=&sortBy=
router.get('/top-items', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      dateRangeSchema.extend({
        limit: z.coerce.number().int().min(1).max(50).default(10),
        sortBy: z.enum(['revenue', 'quantity']).default('revenue'),
      }),
      req.query,
    );
    const items = await reportingService.getTopItems(
      query.storeId,
      query.from,
      query.to,
      query.limit,
      query.sortBy,
    );
    res.json(successResponse(items));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/hourly?storeId=&from=&to=
router.get('/hourly', async (req, res, next) => {
  try {
    const query = validateOrThrow(dateRangeSchema, req.query);
    const pattern = await reportingService.getHourlyPattern(
      query.storeId,
      query.from,
      query.to,
    );
    res.json(successResponse(pattern));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/customers?storeId=&from=&to=
router.get('/customers', async (req, res, next) => {
  try {
    const query = validateOrThrow(dateRangeSchema, req.query);
    const kpis = await reportingService.getCustomerKpiReport(
      query.storeId,
      query.from,
      query.to,
    );
    res.json(successResponse(kpis));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/reports/snapshots/compute - Internal: compute snapshot for a date
router.post('/snapshots/compute', async (req, res, next) => {
  try {
    if (!req.isInternalService) {
      res.status(403).json({ success: false, error: 'Internal endpoint only' });
      return;
    }
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }),
      req.body,
    );
    const snapshot = await reportingService.computeDailySnapshot(body.storeId, body.date);
    res.json(successResponse(snapshot, 'Daily snapshot computed'));
  } catch (err) {
    next(err);
  }
});

export default router;