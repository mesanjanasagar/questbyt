import { Router } from 'express';
import { z } from 'zod';
import * as campaignService from '../services/campaign.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import type { Customer } from '@pos/shared-types';

const router = Router();

router.use(authenticate);

// POST /api/v1/campaigns
router.post('/', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        trigger: z.enum(['customer.created', 'customer.segment_changed', 'customer.points_earned', 'manual']),
        targetSegment: z.enum(['new', 'active', 'at_risk', 'churned', 'vip', 'lapsed']).optional(),
        fromSegment: z.enum(['new', 'active', 'at_risk', 'churned', 'vip', 'lapsed']).optional(),
        channel: z.enum(['whatsapp', 'email', 'sms', 'push']),
        messageTemplate: z.string().min(1),
        throttleDays: z.number().int().min(0).optional(),
      }),
      req.body,
    );
    const campaign = await campaignService.createCampaign(body);
    res.status(201).json(successResponse(campaign, 'Campaign created'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/campaigns?storeId=&status=&trigger=&page=&limit=
router.get('/', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        status: z.enum(['active', 'paused', 'archived']).optional(),
        trigger: z.string().optional(),
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const result = await campaignService.listCampaigns(query.storeId, query);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/campaigns/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const campaign = await campaignService.getCampaignById(id);
    res.json(successResponse(campaign));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/campaigns/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        messageTemplate: z.string().min(1).optional(),
        status: z.enum(['active', 'paused', 'archived']).optional(),
        throttleDays: z.number().int().min(0).optional(),
      }),
      req.body,
    );
    const campaign = await campaignService.updateCampaign(id, body);
    res.json(successResponse(campaign, 'Campaign updated'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/campaigns/:id/stats
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const stats = await campaignService.getCampaignStats(id);
    res.json(successResponse(stats));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/campaigns/:id/executions?page=&limit=
router.get('/:id/executions', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const query = validateOrThrow(
      z.object({
        page: z.coerce.number().int().positive().optional(),
        limit: z.coerce.number().int().min(1).max(100).optional(),
      }),
      req.query,
    );
    const result = await campaignService.getExecutions(id, query);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/campaigns/:id/trigger
// Manual broadcast — pass array of customers to target
// In production: customer-service fetches target segment; body just carries storeId + segment
router.post('/:id/trigger', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        customers: z.array(z.object({
          id: z.string().uuid(),
          storeId: z.string().uuid(),
          name: z.string(),
          phone: z.string().optional(),
          email: z.string().optional(),
          loyaltyPoints: z.number().default(0),
          loyaltyTier: z.enum(['silver', 'gold', 'platinum']).default('silver'),
          segment: z.string().default('new'),
          totalOrders: z.number().default(0),
          totalSpend: z.number().default(0),
          averageOrderValue: z.number().default(0),
          createdAt: z.string(),
          updatedAt: z.string(),
        })),
      }),
      req.body,
    );
    const result = await campaignService.triggerManual(id, body.customers as Customer[]);
    res.json(successResponse(result, `Campaign triggered: ${result.queued} queued, ${result.skipped} skipped`));
  } catch (err) {
    next(err);
  }
});

export default router;