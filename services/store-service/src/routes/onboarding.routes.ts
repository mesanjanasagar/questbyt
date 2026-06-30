import { Router, IRouter } from 'express';
import { z } from 'zod';
import {
  getOnboardingState,
  completeStep,
  completeOnboarding,
  upsertPaymentConfig,
  getPaymentConfig,
  upsertNotificationConfig,
  getNotificationConfig,
  createStaffProfile,
  getStaffByStore,
} from '../services/onboarding.service';
import { authenticate, requireAdmin, AuthenticatedRequest } from '../middleware/authenticate';

const router: IRouter = Router();
router.use(authenticate);

// GET /onboarding/:storeId – get onboarding state
router.get('/:storeId', async (req, res, next) => {
  try {
    const state = await getOnboardingState(req.params.storeId);
    res.json({ success: true, data: state });
  } catch (err) {
    next(err);
  }
});

// POST /onboarding/:storeId/complete-step – mark a step complete
router.post('/:storeId/complete-step', requireAdmin, async (req, res, next) => {
  try {
    const { step } = z.object({
      step: z.enum([
        'restaurant_setup',
        'branch_created',
        'tables_configured',
        'staff_added',
        'device_registered',
        'menu_created',
        'inventory_configured',
        'payment_configured',
        'notifications_configured',
      ]),
    }).parse(req.body);

    const state = await completeStep(req.params.storeId, step);
    res.json({ success: true, data: state });
  } catch (err) {
    next(err);
  }
});

// POST /onboarding/:storeId/complete – mark onboarding fully complete
router.post('/:storeId/complete', requireAdmin, async (req, res, next) => {
  try {
    const state = await completeOnboarding(req.params.storeId);
    res.json({ success: true, data: state });
  } catch (err) {
    next(err);
  }
});

// ─── Payment Config ───────────────────────────────────────────────────────────

router.get('/:storeId/payment-config', async (req, res, next) => {
  try {
    const config = await getPaymentConfig(req.params.storeId);
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

router.put('/:storeId/payment-config', requireAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      cashEnabled: z.boolean().optional(),
      cardEnabled: z.boolean().optional(),
      enabledMethods: z.array(z.string()).optional(),
    }).parse(req.body);
    const config = await upsertPaymentConfig(req.params.storeId, body);
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// ─── Notification Config ──────────────────────────────────────────────────────

router.get('/:storeId/notification-config', async (req, res, next) => {
  try {
    const config = await getNotificationConfig(req.params.storeId);
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

router.put('/:storeId/notification-config', requireAdmin, async (req, res, next) => {
  try {
    const body = z.object({
      managerPhone: z.string().optional(),
      managerEmail: z.string().email().optional(),
      lowStockAlerts: z.boolean().optional(),
      orderAlerts: z.boolean().optional(),
      channels: z.array(z.enum(['sms', 'email', 'whatsapp', 'push'])).optional(),
    }).parse(req.body);
    const config = await upsertNotificationConfig(req.params.storeId, body);
    res.json({ success: true, data: config });
  } catch (err) {
    next(err);
  }
});

// ─── Staff Profiles ───────────────────────────────────────────────────────────

router.get('/:storeId/staff', async (req, res, next) => {
  try {
    const staff = await getStaffByStore(req.params.storeId);
    res.json({ success: true, data: staff });
  } catch (err) {
    next(err);
  }
});

router.post('/:storeId/staff', requireAdmin, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = z.object({
      userId: z.string().uuid(),
      branchId: z.string().uuid().optional(),
      employeeNumber: z.string().min(1).max(50),
      position: z.string().max(100).optional(),
    }).parse(req.body);

    const profile = await createStaffProfile(
      body.userId,
      req.params.storeId,
      body.branchId,
      body.employeeNumber,
      body.position,
    );
    res.status(201).json({ success: true, data: profile });
  } catch (err) {
    next(err);
  }
});

export { router as onboardingRoutes };
