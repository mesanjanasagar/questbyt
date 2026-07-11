import { Router, type IRouter } from 'express';
import { z } from 'zod';
import * as shiftService from '../services/shift.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';

const router: IRouter = Router();

router.use(authenticate);

// POST /api/v1/shifts/open
router.post('/open', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        openingBalance: z.number().min(0),
        openingNotes: z.string().max(500).optional(),
      }),
      req.body,
    );
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthenticated' }); return; }
    const shift = await shiftService.openShift({
      storeId: body.storeId,
      deviceId: req.user.deviceId,
      cashierId: req.user.sub,
      openingBalance: body.openingBalance,
      openingNotes: body.openingNotes,
    });
    res.status(201).json(successResponse(shift, 'Shift opened'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/shifts/active — the active shift for the caller's own device
router.get('/active', async (req, res, next) => {
  try {
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthenticated' }); return; }
    const summary = await shiftService.getActiveShift(req.user.deviceId);
    res.json(successResponse(summary));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/shifts/:id/cash-movement
router.post('/:id/cash-movement', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        type: z.enum(['cash_in', 'cash_out']),
        amount: z.number().positive(),
        reason: z.string().min(1).max(255),
      }),
      req.body,
    );
    if (!req.user) { res.status(401).json({ success: false, error: 'Unauthenticated' }); return; }
    const movement = await shiftService.recordCashMovement({
      shiftId: id,
      type: body.type,
      amount: body.amount,
      reason: body.reason,
      actorId: req.user.sub,
    });
    res.status(201).json(successResponse(movement, 'Recorded'));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/shifts/:id/close
router.post('/:id/close', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        closingBalance: z.number().min(0),
        closingNotes: z.string().max(500).optional(),
      }),
      req.body,
    );
    const summary = await shiftService.closeShift({
      shiftId: id,
      closingBalance: body.closingBalance,
      closingNotes: body.closingNotes,
    });
    res.json(successResponse(summary, 'Shift closed'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/shifts?storeId=&limit=
router.get('/', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        limit: z.coerce.number().int().positive().max(100).optional(),
      }),
      req.query,
    );
    const shifts = await shiftService.listShifts(query.storeId, query.limit);
    res.json(successResponse(shifts));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/shifts/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const summary = await shiftService.getShiftById(id);
    res.json(successResponse(summary));
  } catch (err) {
    next(err);
  }
});

export default router;
