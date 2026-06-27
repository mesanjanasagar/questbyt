import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validateOrThrow } from '@pos/shared-utils';
import { authenticate } from '../middleware/authenticate';
import * as reservationService from '../services/reservation.service';

const router = Router();

// Create reservation
router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = validateOrThrow(
      z.object({
        customerId: z.string().uuid().optional().nullable(),
        customerName: z.string().min(1),
        customerPhone: z.string().optional().nullable(),
        customerEmail: z.string().email().optional().nullable(),
        partySize: z.number().int().min(1),
        reservedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        reservedTime: z.string().regex(/^\d{2}:\d{2}$/),
        notes: z.string().optional().nullable(),
      }),
      req.body
    );

    const reservation = await reservationService.createReservation(
      req.user!.storeId,
      payload.customerId || null,
      payload.customerName,
      payload.customerPhone || null,
      payload.customerEmail || null,
      payload.partySize,
      payload.reservedDate,
      payload.reservedTime,
      payload.notes || null
    );

    res.status(201).json({ success: true, data: reservation });
  } catch (err) {
    next(err);
  }
});

// Get reservations
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, status } = req.query;

    const reservations = await reservationService.getReservations(
      req.user!.storeId,
      date as string | undefined,
      status as string | undefined
    );

    res.json({ success: true, data: reservations, count: reservations.length });
  } catch (err) {
    next(err);
  }
});

// Get available tables
router.get('/available', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = validateOrThrow(
      z.object({
        partySize: z.coerce.number().int().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        time: z.string().regex(/^\d{2}:\d{2}$/),
      }),
      req.query
    );

    const tables = await reservationService.getAvailableTables(
      req.user!.storeId,
      payload.partySize,
      payload.date,
      payload.time
    );

    res.json({ success: true, data: tables, count: tables.length });
  } catch (err) {
    next(err);
  }
});

// Check in
router.post('/:id/checkin', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const reservation = await reservationService.checkIn(req.params.id, req.user!.storeId);
    res.json({ success: true, data: reservation });
  } catch (err) {
    next(err);
  }
});

// Seat reservation
router.post('/:id/seat', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = validateOrThrow(z.object({ tableId: z.string().uuid() }), req.body);
    const reservation = await reservationService.seat(req.params.id, req.user!.storeId, payload.tableId);
    res.json({ success: true, data: reservation });
  } catch (err) {
    next(err);
  }
});

// Cancel reservation
router.post('/:id/cancel', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = validateOrThrow(
      z.object({
        reason: z.string(),
        cancelledBy: z.enum(['customer', 'staff', 'system']),
      }),
      req.body
    );

    await reservationService.cancel(req.params.id, req.user!.storeId, payload.reason, payload.cancelledBy);
    res.json({ success: true, message: 'Reservation cancelled' });
  } catch (err) {
    next(err);
  }
});

// Get tables
router.get('/tables/list', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tables = await reservationService.getTables(req.user!.storeId);
    res.json({ success: true, data: tables, count: tables.length });
  } catch (err) {
    next(err);
  }
});

export default router;