import { Router } from 'express';
import { z } from 'zod';
import * as customerService from '../services/customer.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';

const router = Router();

router.use(authenticate);

// POST /api/v1/customers
router.post('/', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        name: z.string().min(1).max(255),
        phone: z.string().max(50).optional(),
        email: z.string().email().max(255).optional(),
      }),
      req.body,
    );
    const customer = await customerService.createCustomer(body);
    res.status(201).json(successResponse(customer, 'Customer created successfully'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers?storeId=&segment=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        segment: z.enum(['new', 'active', 'at_risk', 'churned', 'vip', 'lapsed']).optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const result = await customerService.listCustomers(query.storeId, query);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/segments?storeId=
router.get('/segments', async (req, res, next) => {
  try {
    const { storeId } = validateOrThrow(
      z.object({ storeId: z.string().uuid() }),
      req.query,
    );
    const counts = await customerService.getSegmentCounts(storeId);
    res.json(successResponse(counts));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/lookup?storeId=&q=
router.get('/lookup', async (req, res, next) => {
  try {
    const { storeId, q } = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        q: z.string().min(1),
      }),
      req.query,
    );
    const customer = await customerService.lookupCustomer(storeId, q);
    res.json(successResponse(customer));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const customer = await customerService.getCustomerById(id);
    res.json(successResponse(customer));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/customers/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(255).optional(),
        phone: z.string().max(50).optional(),
        email: z.string().email().max(255).optional(),
      }),
      req.body,
    );
    const customer = await customerService.updateCustomer(id, body);
    res.json(successResponse(customer, 'Customer updated successfully'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/customers/:id/loyalty
router.get('/:id/loyalty', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const query = validateOrThrow(
      z.object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    await customerService.getCustomerById(id); // ensure exists
    const ledger = await customerService.getLoyaltyLedger(id, query);
    res.json(successResponse(ledger));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/customers/segments/refresh
// Internal: re-computes all segments for a store (called nightly by scheduler)
router.post('/segments/refresh', async (req, res, next) => {
  try {
    if (!req.isInternalService) {
      res.status(403).json({ success: false, error: 'Internal endpoint only' });
      return;
    }
    const { storeId } = validateOrThrow(
      z.object({ storeId: z.string().uuid() }),
      req.body,
    );
    const updated = await customerService.refreshAllSegments(storeId);
    res.json(successResponse({ updated }, `Refreshed segments for ${updated} customers`));
  } catch (err) {
    next(err);
  }
});

export default router;