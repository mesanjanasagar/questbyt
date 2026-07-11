import { Router, type IRouter } from 'express';
import { z } from 'zod';
import * as campaignService from '../services/campaign.service';
import { config } from '../config';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import type { Customer } from '@pos/shared-types';

const router: IRouter = Router();

router.use(authenticate);

const CAMPAIGN_TYPE_VALUES = [
  'percentage_discount', 'fixed_discount', 'bogo', 'free_item',
  'loyalty_reward', 'birthday', 'first_order', 'win_back',
  'churn_recovery', 'seasonal', 'festival', 'coupon',
] as const;

const STATUS_VALUES = ['draft', 'scheduled', 'active', 'paused', 'completed', 'expired', 'archived'] as const;

// PATCH /campaigns/bulk — bulk status update (must be before /:id)
router.patch('/bulk', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        ids: z.array(z.string().uuid()).min(1).max(100),
        status: z.enum(STATUS_VALUES),
      }),
      req.body,
    );
    const count = await campaignService.bulkUpdateStatus(body.ids, body.status);
    res.json(successResponse({ count }, `${count} campaigns updated`));
  } catch (err) {
    next(err);
  }
});

// POST /campaigns
router.post('/', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        name: z.string().min(1).max(255),
        description: z.string().optional(),
        status: z.enum(STATUS_VALUES).optional(),
        // Promo fields
        campaignType: z.enum(CAMPAIGN_TYPE_VALUES).optional(),
        couponCode: z.string().max(100).optional(),
        discountType: z.enum(['percentage', 'fixed']).optional(),
        discountValue: z.number().min(0).optional(),
        maxDiscount: z.number().min(0).optional(),
        minOrderAmount: z.number().min(0).optional(),
        validFrom: z.string().datetime({ offset: true }).optional(),
        validUntil: z.string().datetime({ offset: true }).optional(),
        maxRedemptions: z.number().int().positive().optional(),
        usagePerCustomer: z.number().int().positive().optional(),
        priority: z.number().int().min(0).optional(),
        applicableBranches: z.array(z.string()).optional(),
        applicableSegments: z.array(z.string()).optional(),
        applicableCategories: z.array(z.string()).optional(),
        applicableItems: z.array(z.string()).optional(),
        // Legacy messaging fields
        trigger: z.enum(['customer.created', 'customer.segment_changed', 'customer.points_earned', 'manual']).optional(),
        targetSegment: z.string().optional(),
        fromSegment: z.string().optional(),
        channel: z.enum(['whatsapp', 'email', 'sms', 'push']).optional(),
        messageTemplate: z.string().optional(),
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

// GET /campaigns?storeId=&status=&campaignType=&page=&limit=&search=
router.get('/', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        status: z.enum(STATUS_VALUES).optional(),
        campaignType: z.string().optional(),
        trigger: z.string().optional(),
        search: z.string().optional(),
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

// GET /campaigns/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const campaign = await campaignService.getCampaignById(id);
    res.json(successResponse(campaign));
  } catch (err) {
    next(err);
  }
});

// PATCH /campaigns/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        status: z.enum(STATUS_VALUES).optional(),
        campaignType: z.enum(CAMPAIGN_TYPE_VALUES).optional(),
        couponCode: z.string().max(100).optional(),
        discountType: z.enum(['percentage', 'fixed']).optional(),
        discountValue: z.number().min(0).optional(),
        maxDiscount: z.number().min(0).optional(),
        minOrderAmount: z.number().min(0).optional(),
        validFrom: z.string().datetime({ offset: true }).optional(),
        validUntil: z.string().datetime({ offset: true }).optional(),
        maxRedemptions: z.number().int().positive().optional(),
        usagePerCustomer: z.number().int().positive().optional(),
        priority: z.number().int().min(0).optional(),
        applicableBranches: z.array(z.string()).optional(),
        applicableSegments: z.array(z.string()).optional(),
        applicableCategories: z.array(z.string()).optional(),
        applicableItems: z.array(z.string()).optional(),
        messageTemplate: z.string().optional(),
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

// DELETE /campaigns/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    await campaignService.deleteCampaign(id);
    res.json(successResponse(null, 'Campaign deleted'));
  } catch (err) {
    next(err);
  }
});

// POST /campaigns/:id/duplicate
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const campaign = await campaignService.duplicateCampaign(id);
    res.status(201).json(successResponse(campaign, 'Campaign duplicated'));
  } catch (err) {
    next(err);
  }
});

// GET /campaigns/:id/stats
router.get('/:id/stats', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const stats = await campaignService.getCampaignStats(id);
    res.json(successResponse(stats));
  } catch (err) {
    next(err);
  }
});

// GET /campaigns/:id/executions
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

// POST /campaigns/:id/trigger — manual broadcast
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


// POST /campaigns/coupons/validate — simple coupon validation (MVP)
router.post('/coupons/validate', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        code: z.string().min(1),
        storeId: z.string().uuid(),
        customerId: z.string().uuid().optional(),
        subtotal: z.number().min(0).optional(),
      }),
      req.body,
    );

    const code = body.code.trim().toUpperCase();

    // MVP: support only LOYALTY coupon which applies for first-time customers
    if (code !== 'LOYALTY') {
      res.json(successResponse({ valid: false, reason: 'INVALID_CODE' }));
      return;
    }

    if (!body.customerId) {
      res.json(successResponse({ valid: false, reason: 'NO_CUSTOMER' }));
      return;
    }

    // Check if customer has previous orders — if none, it's first order
    let hasPreviousOrders = false;
    try {
      const url = `${config.ORDER_SERVICE_URL}/api/v1/orders?storeId=${encodeURIComponent(body.storeId)}&customerId=${encodeURIComponent(body.customerId)}&limit=1`;
      const ordersRes = await fetch(url, { headers: { 'X-Internal-Service': 'marketing-service' } });
      if (ordersRes.ok) {
        const json = await ordersRes.json();
        const payload = json?.data;
        // payload might be a paginated object or an array
        if (Array.isArray(payload)) {
          hasPreviousOrders = payload.length > 0;
        } else if (payload && (payload.data ?? payload.items)) {
          const arr = payload.data ?? payload.items;
          hasPreviousOrders = Array.isArray(arr) && arr.length > 0;
        } else if (payload && typeof payload.total === 'number') {
          hasPreviousOrders = payload.total > 0;
        }
      }
    } catch (err) {
      console.warn('marketing-service: could not check previous orders for coupon validation', (err as Error).message);
    }

    if (hasPreviousOrders) {
      res.json(successResponse({ valid: false, reason: 'NOT_FIRST_ORDER' }));
      return;
    }

    // Compute discount — MVP: 15% off, max AED 25
    const discountPercentage = 15;
    const maxDiscount = 25;
    const subtotal = body.subtotal ?? 0;
    const raw = (subtotal * discountPercentage) / 100;
    const computed = Math.round(Math.min(raw, maxDiscount) * 100) / 100;

    res.json(successResponse({
      valid: true,
      discountType: 'percentage',
      discountValue: discountPercentage,
      maxDiscount,
      computedDiscount: computed,
      message: 'LOYALTY applied: first order discount',
    }));
  } catch (err) {
    next(err);
  }
});

export default router;
