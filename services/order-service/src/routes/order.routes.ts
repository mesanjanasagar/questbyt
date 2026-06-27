import { Router } from 'express';
import { z } from 'zod';
import * as orderService from '../services/order.service';
import { authenticate, requirePermission } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import { OrderType, OrderStatus, Platform } from '@pos/shared-types';

const router = Router();

router.use(authenticate);

// POST /api/v1/orders – create order
router.post('/', requirePermission('order:create'), async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        deviceId: z.string().uuid(),
        cashierId: z.string().uuid(),
        customerId: z.string().uuid().optional(),
        orderType: z.nativeEnum(OrderType),
        tableNumber: z.number().int().positive().optional(),
        notes: z.string().max(500).optional(),
        platform: z.nativeEnum(Platform).optional(),
        items: z.array(
          z.object({
            menuItemId: z.string().uuid(),
            variantId: z.string().uuid().optional(),
            quantity: z.number().int().positive(),
            unitPrice: z.number().positive(),
            modifications: z.array(z.object({
              modifierId: z.string().uuid(),
              modifierName: z.string(),
              priceAdjustment: z.number(),
            })).optional(),
            notes: z.string().optional(),
          }),
        ).min(1),
      }),
      req.body,
    );

    const order = await orderService.createOrder(body);
    res.status(201).json(successResponse(order, 'Order created'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders – list orders
router.get('/', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        status: z.nativeEnum(OrderStatus).optional(),
        platform: z.nativeEnum(Platform).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.coerce.number().optional(),
        limit: z.coerce.number().optional(),
      }),
      req.query,
    );
    const result = await orderService.listOrders(query);
    res.json(successResponse(result));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const order = await orderService.getOrderById(id);
    res.json(successResponse(order));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/orders/:id/status
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        status: z.nativeEnum(OrderStatus),
        reason: z.string().optional(),
      }),
      req.body,
    );
    const order = await orderService.updateOrderStatus(id, body, req.user!.sub);
    res.json(successResponse(order));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/orders/:id/items – add item
router.post('/:id/items', requirePermission('order:create'), async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        menuItemId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        quantity: z.number().int().positive(),
        unitPrice: z.number().positive(),
        modifications: z.array(z.any()).optional(),
        notes: z.string().optional(),
      }),
      req.body,
    );
    const item = await orderService.addOrderItem(id, body, req.user!.sub);
    res.status(201).json(successResponse(item));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/v1/orders/:id/items/:itemId – remove item
router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    const { id, itemId } = validateOrThrow(
      z.object({ id: z.string().uuid(), itemId: z.string().uuid() }),
      req.params,
    );
    await orderService.removeOrderItem(id, itemId);
    res.json(successResponse(null, 'Item removed'));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/orders/:id/payment – called by payment-service after successful charge
router.patch('/:id/payment', async (req, res, next) => {
  try {
    // Allow internal service-to-service calls without user JWT
    const isInternal = req.headers['x-internal-service'] === 'payment-service';
    if (!isInternal && !req.user) {
      res.status(401).json({ success: false, error: 'Unauthenticated' });
      return;
    }
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        paymentStatus: z.enum(['paid', 'refunded']),
        paymentMethod: z.string().min(1),
        paymentId: z.string().uuid(),
      }),
      req.body,
    );
    const order = await orderService.markOrderPaid(id, body);
    res.json(successResponse(order, 'Order payment status updated'));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/orders/:id/cancel
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(z.object({ reason: z.string().min(1) }), req.body);
    const order = await orderService.cancelOrder(id, body, req.user!.sub);
    res.json(successResponse(order, 'Order cancelled'));
  } catch (err) {
    next(err);
  }
});

export default router;