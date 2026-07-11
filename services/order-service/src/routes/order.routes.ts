import { Router, type IRouter } from 'express';
import { z } from 'zod';
import * as orderService from '../services/order.service';
import { authenticate, requirePermission } from '../middleware/authenticate';
import { validateOrThrow, successResponse } from '@pos/shared-utils';
import { OrderType, OrderStatus, Platform, OrderItemStatus } from '@pos/shared-types';
import { sseBroadcaster } from '../events/sse-broadcaster';

const router: IRouter = Router();

// ─── Public kiosk endpoint (no JWT required) ────────────────────────────────
const KIOSK_SYSTEM_ID = '00000000-0000-0000-0000-000000000001';

router.post('/kiosk', async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        items: z.array(
          z.object({
            menuItemId: z.string().uuid(),
            quantity: z.number().int().positive(),
            unitPrice: z.number().min(0),
            modifierIds: z.array(z.string()).optional(),
          }),
        ).min(1),
        tableNumber: z.number().int().positive().optional(),
        notes: z.string().max(500).optional(),
      }),
      req.body,
    );

    const order = await orderService.createOrder({
      storeId: body.storeId,
      deviceId: KIOSK_SYSTEM_ID,
      cashierId: KIOSK_SYSTEM_ID,
      orderType: OrderType.TAKEOUT,
      platform: Platform.KIOSK,
      items: body.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        modifications: (item.modifierIds ?? []).map((id) => ({
          modifierId: id,
          modifierName: '',
          priceAdjustment: 0,
        })),
      })),
      tableNumber: body.tableNumber,
      notes: body.notes,
    });

    res.status(201).json(successResponse({ id: order.id, orderNumber: (order as any).orderNumber ?? 0 }, 'Order created'));
  } catch (err) {
    next(err);
  }
});

// ─── SSE real-time events — no JWT from header; gateway injects x-store-id ──
router.get('/events', (req, res) => {
  const storeId = (req.query.storeId as string) || (req.headers['x-store-id'] as string) || '';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  res.write(`event: connected\ndata: ${JSON.stringify({ storeId, ts: Date.now() })}\n\n`);

  const disconnect = sseBroadcaster.connect(storeId, res);

  const heartbeat = setInterval(() => {
    try { res.write(': heartbeat\n\n'); } catch { /* client gone */ }
  }, 25000);

  req.on('close', () => {
    disconnect();
    clearInterval(heartbeat);
  });
});

// ─── Authenticated routes below ─────────────────────────────────────────────
router.use(authenticate);

// ─── Promo codes (manager-dashboard managed) ────────────────────────────────

// GET /orders/promo-codes?storeId=
router.get('/promo-codes', async (req, res, next) => {
  try {
    const { storeId } = validateOrThrow(z.object({ storeId: z.string().uuid() }), req.query);
    const codes = await orderService.listPromoCodes(storeId);
    res.json(successResponse(codes));
  } catch (err) {
    next(err);
  }
});

// POST /orders/promo-codes
router.post('/promo-codes', requirePermission('promo:manage'), async (req, res, next) => {
  try {
    const body = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        code: z.string().min(2).max(50),
        description: z.string().max(255).optional(),
        discountType: z.enum(['percentage', 'fixed']),
        discountValue: z.number().positive(),
        firstTimeCustomerOnly: z.boolean().optional(),
        minOrderAmount: z.number().positive().optional(),
        maxUses: z.number().int().positive().optional(),
        expiresAt: z.string().optional(),
      }),
      req.body,
    );
    const code = await orderService.createPromoCode(body);
    res.status(201).json(successResponse(code, 'Promo code created'));
  } catch (err) {
    next(err);
  }
});

// PATCH /orders/promo-codes/:id
router.patch('/promo-codes/:id', requirePermission('promo:manage'), async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        description: z.string().max(255).optional(),
        discountType: z.enum(['percentage', 'fixed']).optional(),
        discountValue: z.number().positive().optional(),
        firstTimeCustomerOnly: z.boolean().optional(),
        minOrderAmount: z.number().positive().nullable().optional(),
        maxUses: z.number().int().positive().nullable().optional(),
        isActive: z.boolean().optional(),
        expiresAt: z.string().nullable().optional(),
      }),
      req.body,
    );
    const code = await orderService.updatePromoCode(id, body);
    res.json(successResponse(code, 'Promo code updated'));
  } catch (err) {
    next(err);
  }
});

// DELETE /orders/promo-codes/:id
router.delete('/promo-codes/:id', requirePermission('promo:manage'), async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    await orderService.deletePromoCode(id);
    res.json(successResponse(null, 'Promo code deleted'));
  } catch (err) {
    next(err);
  }
});

// GET /orders/active-for-table?tableId=xxx&storeId=xxx
router.get('/active-for-table', async (req, res, next) => {
  try {
    const { tableId, storeId } = validateOrThrow(
      z.object({ tableId: z.string().uuid(), storeId: z.string().uuid() }),
      req.query,
    );
    const order = await orderService.getActiveOrderForTable(tableId, storeId);
    res.json(successResponse(order));
  } catch (err) {
    next(err);
  }
});

// GET /orders/kds?storeId=xxx&branchId=yyy — KDS-optimised view with dispatched items
router.get('/kds', async (req, res, next) => {
  try {
    const { storeId, branchId } = validateOrThrow(
      z.object({ storeId: z.string().uuid(), branchId: z.string().uuid().optional() }),
      req.query,
    );
    const orders = await orderService.getKDSOrders(storeId, branchId);
    res.json(successResponse(orders));
  } catch (err) {
    next(err);
  }
});

// GET /orders/stats?storeId=
router.get('/stats', async (req, res, next) => {
  try {
    const { storeId } = validateOrThrow(z.object({ storeId: z.string().uuid() }), req.query);
    const stats = await orderService.getOrderStats(storeId);
    res.json(successResponse(stats));
  } catch (err) {
    next(err);
  }
});

// GET /orders/stats/today?storeId= — real, live "today's sales" summary
router.get('/stats/today', async (req, res, next) => {
  try {
    const { storeId } = validateOrThrow(z.object({ storeId: z.string().uuid() }), req.query);
    const stats = await orderService.getTodayStats(storeId);
    res.json(successResponse(stats));
  } catch (err) {
    next(err);
  }
});

// POST /orders – create order
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
        tableId: z.string().uuid().optional(),
        branchId: z.string().uuid().optional(),
        guestCount: z.number().int().positive().optional(),
        notes: z.string().max(500).optional(),
        platform: z.nativeEnum(Platform).optional(),
        items: z.array(
          z.object({
            menuItemId: z.string().uuid(),
            itemName: z.string().optional(),
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

// GET /orders – list orders
router.get('/', async (req, res, next) => {
  try {
    const query = validateOrThrow(
      z.object({
        storeId: z.string().uuid(),
        branchId: z.string().uuid().optional(),
        customerId: z.string().uuid().optional(),
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

// GET /orders/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const order = await orderService.getOrderById(id);
    res.json(successResponse(order));
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/send-to-kitchen – add new items to existing order and dispatch to KDS
router.post('/:id/send-to-kitchen', requirePermission('order:create'), async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        items: z.array(z.object({
          menuItemId: z.string().uuid(),
          itemName: z.string().optional(),
          variantId: z.string().uuid().optional(),
          quantity: z.number().int().positive(),
          unitPrice: z.number().positive(),
          modifications: z.array(z.any()).optional(),
          notes: z.string().optional(),
        })).min(1),
      }),
      req.body,
    );
    const newItems = await orderService.sendToKitchen(id, body.items, req.user!.sub);
    res.status(201).json(successResponse(newItems, 'Items sent to kitchen'));
  } catch (err) {
    next(err);
  }
});

// PATCH /orders/:id/items/:itemId/status – KDS updates individual item status
router.patch('/:id/items/:itemId/status', async (req, res, next) => {
  try {
    const { id, itemId } = validateOrThrow(
      z.object({ id: z.string().uuid(), itemId: z.string().uuid() }),
      req.params,
    );
    const { status } = validateOrThrow(
      z.object({ status: z.nativeEnum(OrderItemStatus) }),
      req.body,
    );
    const item = await orderService.updateOrderItemStatus(id, itemId, status, req.user!.sub);
    res.json(successResponse(item));
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/discount – apply a manual discount or a promo code
router.post('/:id/discount', requirePermission('order:create'), async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const body = validateOrThrow(
      z.object({
        discountType: z.enum(['percentage', 'fixed']).optional(),
        discountValue: z.number().positive().optional(),
        reason: z.string().max(255).optional(),
        promoCode: z.string().min(1).max(50).optional(),
      }),
      req.body,
    );
    const order = await orderService.applyDiscount(id, body, req.user!.sub);
    res.json(successResponse(order, 'Discount applied'));
  } catch (err) {
    next(err);
  }
});

// DELETE /orders/:id/discount
router.delete('/:id/discount', requirePermission('order:create'), async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const order = await orderService.removeDiscount(id);
    res.json(successResponse(order, 'Discount removed'));
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/request-bill
router.post('/:id/request-bill', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const order = await orderService.requestBill(id, req.user!.sub);
    res.json(successResponse(order, 'Bill requested'));
  } catch (err) {
    next(err);
  }
});

// POST /orders/:id/close – close order after payment, free table
router.post('/:id/close', async (req, res, next) => {
  try {
    const { id } = validateOrThrow(z.object({ id: z.string().uuid() }), req.params);
    const order = await orderService.closeOrder(id, req.user!.sub);
    res.json(successResponse(order, 'Order closed'));
  } catch (err) {
    next(err);
  }
});

// PATCH /orders/:id/status
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

// POST /orders/:id/items – add single item
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

// PATCH /orders/:id/items/:itemId – change quantity (only while item is still 'pending')
router.patch('/:id/items/:itemId', requirePermission('order:create'), async (req, res, next) => {
  try {
    const { id, itemId } = validateOrThrow(
      z.object({ id: z.string().uuid(), itemId: z.string().uuid() }),
      req.params,
    );
    const { quantity } = validateOrThrow(z.object({ quantity: z.number().int().positive() }), req.body);
    const item = await orderService.updateOrderItemQuantity(id, itemId, quantity);
    res.json(successResponse(item));
  } catch (err) {
    next(err);
  }
});

// DELETE /orders/:id/items/:itemId
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

// PATCH /orders/:id/payment
router.patch('/:id/payment', async (req, res, next) => {
  try {
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

// POST /orders/:id/cancel
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
