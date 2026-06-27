import { Router } from 'express';
import { z } from 'zod';
import * as paymentService from '../services/payment.service';
import { authenticate } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import { PaymentMethod } from '@pos/shared-types';

const router = Router();

router.use(authenticate);

// POST /api/v1/payments/process
router.post('/process', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        orderId: z.string().uuid(),
        storeId: z.string().uuid(),
        amount: z.number().positive(),
        paymentMethod: z.nativeEnum(PaymentMethod),
        cashTendered: z.number().positive().optional(),
        cardToken: z.string().optional(),
        idempotencyKey: z.string().min(1),
        receiptDetails: z
          .object({ email: z.string().email().optional(), phone: z.string().optional() })
          .optional(),
      }),
      req.body,
    );
    const payment = await paymentService.processPayment(body);
    res.status(201).json(successResponse(payment, 'Payment processed successfully'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/payments/order/:orderId
router.get('/order/:orderId', async (req, res, next) => {
  try {
    const { orderId } = validateOrThrow(
      z.object({ orderId: z.string().uuid() }),
      req.params,
    );
    const payment = await paymentService.getPaymentByOrderId(orderId);
    res.json(successResponse(payment));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/payments/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const payment = await paymentService.getPaymentById(id);
    res.json(successResponse(payment));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/payments/:id/refund
router.post('/:id/refund', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        amount: z.number().positive(),
        reason: z.string().min(1).max(255),
      }),
      req.body,
    );
    const refund = await paymentService.refundPayment(id, body);
    res.json(successResponse(refund, 'Refund processed successfully'));
  } catch (err) {
    next(err);
  }
});

export default router;