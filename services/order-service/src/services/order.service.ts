import { PoolClient } from 'pg';
import http from 'http';
import https from 'https';
import { db } from '../db/client';
import { publishEvent } from '../events/producer';
import { sseBroadcaster } from '../events/sse-broadcaster';
import { config } from '../config';
import {
  generateId,
  NotFoundError,
  ValidationError,
  buildPaginatedResponse,
  parsePagination,
} from '@pos/shared-utils';
import type {
  Order,
  OrderItem,
  CreateOrderRequest,
  AddOrderItemRequest,
  UpdateOrderStatusRequest,
  CancelOrderRequest,
  OrderListQuery,
  CreateOrderItemRequest,
} from '@pos/shared-types';
import { OrderStatus, OrderItemStatus, OrderType, Platform } from '@pos/shared-types';

// ───────────────────────────────────────────
// Internal HTTP helpers
// ───────────────────────────────────────────

function internalRequest(method: string, targetUrl: string, body: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    const bodyStr = JSON.stringify(body);
    const parsed = new URL(targetUrl);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(parsed, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        'x-internal-service': config.INTERNAL_SERVICE_SECRET,
      },
    });
    let data = '';
    req.on('response', (res) => {
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', (err) => {
      console.warn('[order-service] internal HTTP error:', err.message);
      resolve(null);
    });
    req.write(bodyStr);
    req.end();
  });
}

function internalPost(targetUrl: string, body: unknown): Promise<unknown> {
  return internalRequest('POST', targetUrl, body);
}

// ───────────────────────────────────────────
// Table status helper (calls store-service)
// ───────────────────────────────────────────

async function updateTableStatus(tableId: string, status: string): Promise<void> {
  try {
    await internalRequest('PATCH', `${config.STORE_SERVICE_URL}/tables/${tableId}/status`, { status });
  } catch (err) {
    console.warn('[order-service] Could not update table status:', (err as Error).message);
  }
}

// ───────────────────────────────────────────
// Ingredient reservation helpers (fire-and-forget)
// ───────────────────────────────────────────

async function reserveIngredientsAsync(
  orderId: string,
  storeId: string,
  items: Array<{ menuItemId: string; quantity: number }>,
): Promise<void> {
  try {
    const resolved = await internalPost(`${config.MENU_SERVICE_URL}/items/resolve-ingredients`, { items }) as any;
    const ingredientItems: Array<{ productId: string; quantity: number; unitType: string }> = resolved?.data ?? [];
    if (!ingredientItems.length) return;
    await internalPost(`${config.INVENTORY_SERVICE_URL}/inventory/reserve-for-order`, { orderId, storeId, items: ingredientItems });
  } catch (err) {
    console.warn('[order-service] Could not reserve ingredients:', (err as Error).message);
  }
}

function reserveIngredients(orderId: string, storeId: string, items: Array<{ menuItemId: string; quantity: number }>): void {
  reserveIngredientsAsync(orderId, storeId, items).catch((err) =>
    console.warn('[order-service] reserveIngredients error:', (err as Error).message),
  );
}

function releaseIngredients(orderId: string): void {
  internalPost(`${config.INVENTORY_SERVICE_URL}/inventory/release-for-order`, { orderId }).catch((err) =>
    console.warn('[order-service] releaseIngredients error:', (err as Error).message),
  );
}

function consumeIngredients(orderId: string): void {
  // No userId — consume-for-order's own SYSTEM_USER_ID fallback covers this.
  // Sending the literal string 'system' here used to defeat that fallback
  // (it's a defined value, so `?? SYSTEM_USER_ID` never kicked in) and get
  // inserted straight into a UUID column, throwing and silently rolling
  // back the consumption on every single order.
  internalPost(`${config.INVENTORY_SERVICE_URL}/inventory/consume-for-order`, { orderId }).catch((err) =>
    console.warn('[order-service] consumeIngredients error:', (err as Error).message),
  );
}

// ───────────────────────────────────────────
// Create order
// ───────────────────────────────────────────

export async function createOrder(req: CreateOrderRequest): Promise<Order> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const orderId = generateId();
    const platform = req.platform ?? Platform.DIRECT;
    const isDineIn = req.orderType === OrderType.DINE_IN;
    // Dine-in orders start as 'open'; walk-in/delivery start as 'pending'
    const initialStatus = isDineIn ? 'open' : 'pending';
    const now = new Date().toISOString();

    // Calculate totals from items
    let subtotal = 0;
    const itemRows = req.items.map((item) => {
      const totalPrice = item.unitPrice * item.quantity;
      subtotal += totalPrice;
      return { ...item, totalPrice, id: generateId() };
    });

    const taxAmount = parseFloat((subtotal * 0.05).toFixed(2));
    const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));
    const netRevenue = totalAmount;

    // Insert order
    const orderResult = await client.query(
      `INSERT INTO orders
        (id, store_id, device_id, cashier_id, customer_id, status, total_amount, tax_amount,
         discount_amount, payment_status, order_type, table_number, table_id, guest_count, notes, platform,
         commission_rate, commission_amount, net_revenue, created_offline, branch_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,'unpaid',$9,$10,$11,$12,$13,$14,0,0,$15,false,$16)
       RETURNING *`,
      [
        orderId, req.storeId, req.deviceId, req.cashierId,
        req.customerId ?? null, initialStatus, totalAmount, taxAmount,
        req.orderType, req.tableNumber ?? null, req.tableId ?? null, req.guestCount ?? null,
        req.notes ?? null, platform, netRevenue, req.branchId ?? null,
      ],
    );

    // Insert items — for dine-in, mark immediately as dispatched to KDS
    for (const item of itemRows) {
      await client.query(
        `INSERT INTO order_items
           (id, order_id, menu_item_id, item_name, quantity, unit_price, total_price,
            modifications, notes, kds_dispatched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          item.id, orderId, item.menuItemId, (item as any).itemName ?? null,
          item.quantity, item.unitPrice, item.totalPrice,
          item.modifications ? JSON.stringify(item.modifications) : null,
          item.notes ?? null,
          isDineIn ? now : null,
        ],
      );
    }

    // Audit log
    await writeAudit(client, orderId, 'created', { totalAmount, tableId: req.tableId }, req.cashierId);

    await client.query('COMMIT');
    const order = rowToOrder(orderResult.rows[0]);

    // Fetch items for SSE payload
    const itemsResult = await db.query(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`, [orderId]);
    order.items = itemsResult.rows.map(rowToOrderItem);

    // Update table status → occupied (fire-and-forget)
    if (isDineIn && req.tableId) {
      updateTableStatus(req.tableId, 'occupied').catch(console.error);
    }

    // SSE broadcast for KDS
    if (isDineIn) {
      sseBroadcaster.broadcast(req.storeId, 'ORDER_DISPATCHED', {
        orderId,
        storeId: req.storeId,
        branchId: req.branchId,
        orderNumber: (order as any).orderNumber,
        tableNumber: req.tableNumber,
        tableId: req.tableId,
        orderType: req.orderType,
        notes: req.notes,
        items: order.items,
      });
    }

    // Kafka event (non-blocking)
    publishEvent(
      'order.created',
      req.storeId,
      orderId,
      'Order',
      { orderId, storeId: req.storeId, cashierId: req.cashierId, orderType: req.orderType, totalAmount },
    ).catch(console.error);

    // Reserve ingredients
    reserveIngredients(orderId, req.storeId, req.items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })));

    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ───────────────────────────────────────────
// Get active dine-in order for a table
// ───────────────────────────────────────────

export async function getActiveOrderForTable(tableId: string, storeId: string): Promise<Order | null> {
  const result = await db.query(
    `SELECT * FROM orders
     WHERE table_id = $1 AND store_id = $2
       AND status IN ('open','in_progress','ready','bill_requested')
     ORDER BY created_at DESC
     LIMIT 1`,
    [tableId, storeId],
  );
  if (!result.rowCount || result.rowCount === 0) return null;

  const order = rowToOrder(result.rows[0]);
  const itemsResult = await db.query(
    `SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`,
    [order.id],
  );
  order.items = itemsResult.rows.map(rowToOrderItem);
  return order;
}

// ───────────────────────────────────────────
// Get KDS-focused view of active orders
// Returns orders with only dispatched, non-served items
// ───────────────────────────────────────────

export async function getKDSOrders(storeId: string, branchId?: string): Promise<Order[]> {
  // Every order type needs kitchen prep, not just dine-in — takeout and
  // delivery orders just get dispatched at a different point in their
  // lifecycle (on payment, in markOrderPaid, rather than on an explicit
  // "Send to Kitchen" tap). The kds_dispatched_at/item-status filters below
  // are what actually keep a ticket on the board, so this stays a single
  // query for the whole KDS regardless of channel.
  //
  // branch_id scoping mirrors the same fix applied to the POS order list —
  // a store with several physical branches has a separate kitchen per
  // branch, and without this a KDS screen shows every branch's tickets,
  // which reads as someone else's order sitting on your board. Orders
  // without a branch_id (created before this existed) still show
  // everywhere, same fallback as the POS-side fix.
  const params: unknown[] = [storeId];
  let branchClause = '';
  if (branchId) {
    branchClause = ` AND (branch_id = $2 OR branch_id IS NULL)`;
    params.push(branchId);
  }
  const ordersResult = await db.query(
    `SELECT * FROM orders
     WHERE store_id = $1
       AND status IN ('open','in_progress','ready','bill_requested')
       ${branchClause}
     ORDER BY created_at ASC`,
    params,
  );
  if (!ordersResult.rowCount || ordersResult.rowCount === 0) return [];

  const orderIds = ordersResult.rows.map((r) => r.id);
  const itemsResult = await db.query(
    `SELECT * FROM order_items
     WHERE order_id = ANY($1::uuid[])
       AND kds_dispatched_at IS NOT NULL
       AND status NOT IN ('served','collected','cancelled')
     ORDER BY created_at ASC`,
    [orderIds],
  );

  const itemsByOrderId: Record<string, OrderItem[]> = {};
  for (const row of itemsResult.rows) {
    const item = rowToOrderItem(row);
    if (!itemsByOrderId[item.orderId]) itemsByOrderId[item.orderId] = [];
    itemsByOrderId[item.orderId].push(item);
  }

  return ordersResult.rows
    .map(rowToOrder)
    .map((o) => ({ ...o, items: itemsByOrderId[o.id] ?? [] }))
    .filter((o) => (o.items?.length ?? 0) > 0);
}

// ───────────────────────────────────────────
// Send items to kitchen (add to existing order + dispatch)
// ───────────────────────────────────────────

export async function sendToKitchen(
  orderId: string,
  items: CreateOrderItemRequest[],
  actorId: string,
): Promise<OrderItem[]> {
  // 'ready' is a legitimate, ordinary value here — orders.status borrows it
  // to mean "every item dispatched so far is ready-or-beyond" (see
  // computeOrderStage). A table often gets a second round of food ordered
  // after the first round is fully up, so that can't be treated as a
  // terminal state the same way bill_requested/paid/closed are.
  const orderResult = await db.query(
    `SELECT * FROM orders WHERE id = $1 AND status IN ('open','in_progress','ready')`,
    [orderId],
  );
  if (!orderResult.rowCount || orderResult.rowCount === 0) {
    throw new ValidationError('Order is not in a state that allows adding items');
  }
  const order = orderResult.rows[0];
  const now = new Date().toISOString();

  const client = await db.connect();
  const newItems: OrderItem[] = [];
  try {
    await client.query('BEGIN');

    for (const item of items) {
      const itemId = generateId();
      const totalPrice = item.unitPrice * item.quantity;
      await client.query(
        `INSERT INTO order_items
           (id, order_id, menu_item_id, item_name, quantity, unit_price, total_price,
            modifications, notes, kds_dispatched_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          itemId, orderId, item.menuItemId, item.itemName ?? null,
          item.quantity, item.unitPrice, totalPrice,
          item.modifications ? JSON.stringify(item.modifications) : null,
          item.notes ?? null, now,
        ],
      );
      const itemResult = await client.query(`SELECT * FROM order_items WHERE id = $1`, [itemId]);
      newItems.push(rowToOrderItem(itemResult.rows[0]));
    }

    // The freshly-added items are always 'pending', so the order's derived
    // stage can only ever move backward here (e.g. 'ready' -> 'in_progress')
    // — never let orders.status keep claiming 'ready' once a new pending
    // item exists, or the table color and the KDS board (which derives its
    // column straight from item statuses) drift out of sync.
    const activeItemsResult = await client.query(
      `SELECT status FROM order_items WHERE order_id = $1 AND kds_dispatched_at IS NOT NULL AND status != 'cancelled'`,
      [orderId],
    );
    const newStage = computeOrderStage(activeItemsResult.rows.map((r) => r.status as string));

    if (order.status === 'open') {
      await client.query(
        `UPDATE orders SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
        [orderId],
      );
    } else if (order.status === 'ready' && newStage !== 'ready') {
      await client.query(
        `UPDATE orders SET status = 'in_progress', updated_at = NOW() WHERE id = $1`,
        [orderId],
      );
    }

    await recalculateOrderTotalClient(client, orderId);
    await writeAudit(client, orderId, 'items_dispatched', { count: items.length }, actorId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  // SSE broadcast with only the new items
  sseBroadcaster.broadcast(order.store_id, 'ORDER_DISPATCHED', {
    orderId,
    storeId: order.store_id,
    branchId: order.branch_id,
    orderNumber: order.order_number,
    tableNumber: order.table_number,
    tableId: order.table_id,
    orderType: order.order_type,
    items: newItems,
  });

  // New items are always pending, so the table can never still be "ready to
  // serve" right after this — reflect that it's back in the kitchen.
  if (order.table_id) {
    updateTableStatus(order.table_id, 'food_preparing').catch(console.error);
  }

  // Reserve ingredients for this round too — createOrder only covers the
  // items present at creation, so a second "Send to Kitchen" round (a table
  // ordering more food before the bill) needs its own reservation call or
  // its ingredients never get reserved or, later, consumed on payment.
  reserveIngredients(orderId, order.store_id, items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })));

  return newItems;
}

// ───────────────────────────────────────────
// Update order item status (called by KDS)
// ───────────────────────────────────────────

// ───────────────────────────────────────────
// Derived kitchen stage — NEVER set directly. Always recomputed from the
// order's own (active, non-cancelled) item statuses, so the order and its
// items can never drift out of sync. Mirrored by getOrderColumn() in
// apps/kds/src/types/index.ts — keep both in lockstep if either changes.
// ───────────────────────────────────────────

export type KDSStage = 'new' | 'in_progress' | 'ready' | 'collected' | 'completed';

export function computeOrderStage(itemStatuses: string[]): KDSStage {
  if (itemStatuses.length === 0) return 'ready';
  if (itemStatuses.every((s) => s === 'served')) return 'completed';
  if (itemStatuses.every((s) => s === 'collected' || s === 'served')) return 'collected';
  if (itemStatuses.every((s) => s === 'ready' || s === 'collected' || s === 'served')) return 'ready';
  if (itemStatuses.every((s) => s === 'pending')) return 'new';
  return 'in_progress';
}

const VALID_ITEM_TRANSITIONS: Record<string, OrderItemStatus[]> = {
  pending: [OrderItemStatus.ACCEPTED, OrderItemStatus.CANCELLED],
  accepted: [OrderItemStatus.PREPARING, OrderItemStatus.CANCELLED],
  preparing: [OrderItemStatus.READY, OrderItemStatus.CANCELLED],
  ready: [OrderItemStatus.COLLECTED],
  collected: [OrderItemStatus.SERVED],
  served: [],
  cancelled: [],
  cooking: [OrderItemStatus.READY], // legacy
};

export async function updateOrderItemStatus(
  orderId: string,
  itemId: string,
  status: OrderItemStatus,
  actorId: string,
): Promise<OrderItem> {

  const orderResult = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!orderResult.rowCount || orderResult.rowCount === 0) throw new NotFoundError(`Order ${orderId} not found`);
  const order = orderResult.rows[0];

  const itemResult = await db.query(`SELECT * FROM order_items WHERE id = $1 AND order_id = $2`, [itemId, orderId]);
  if (!itemResult.rowCount || itemResult.rowCount === 0) throw new NotFoundError(`Item ${itemId} not found`);
  const currentItem = itemResult.rows[0];

  const allowedNext = VALID_ITEM_TRANSITIONS[currentItem.status as string] ?? [];
  if (!allowedNext.includes(status)) {
    throw new ValidationError(`Cannot transition item status from '${currentItem.status}' to '${status}'`);
  }

  await db.query(
    `UPDATE order_items SET status = $1 WHERE id = $2`,
    [status, itemId],
  );

  const updatedItem = rowToOrderItem((await db.query(`SELECT * FROM order_items WHERE id = $1`, [itemId])).rows[0]);

  // Derive the kitchen stage from item statuses (never set directly) and fire
  // stage-transition events exactly once, only when the stage actually changed —
  // makes repeated/replayed item updates idempotent at the order level.
  const activeItemsResult = await db.query(
    `SELECT id, status FROM order_items
     WHERE order_id = $1 AND kds_dispatched_at IS NOT NULL AND status != 'cancelled'`,
    [orderId],
  );
  const afterStatuses = activeItemsResult.rows.map((r) => r.status as string);
  const beforeStatuses = activeItemsResult.rows.map((r) =>
    r.id === itemId ? (currentItem.status as string) : (r.status as string),
  );
  const previousStage = computeOrderStage(beforeStatuses);
  const newStage = computeOrderStage(afterStatuses);

  let orderStatus = order.status as string;
  if (newStage === 'ready' && order.status !== 'ready') {
    // orders.status keeps its existing billing-lifecycle meaning
    // (open/bill_requested/paid/closed) — 'ready' is the one value it also
    // borrows for the POS table-color feature, so only that stage writes back.
    await db.query(`UPDATE orders SET status = 'ready', updated_at = NOW() WHERE id = $1`, [orderId]);
    orderStatus = 'ready';
    if (order.table_id) updateTableStatus(order.table_id, 'ready_to_serve').catch(console.error);
  } else if (newStage === 'collected' && order.order_type !== 'dine-in' && order.status !== 'closed') {
    // Takeout/delivery already paid upfront at order time — there's no
    // waiter-driven "request bill" step waiting to close it, so the moment
    // the customer/courier has collected every item, the order is done.
    await db.query(`UPDATE orders SET status = 'closed', completed_at = NOW(), updated_at = NOW() WHERE id = $1`, [orderId]);
    orderStatus = 'closed';
    sseBroadcaster.broadcast(order.store_id, 'ORDER_CLOSED', {
      orderId, storeId: order.store_id, tableId: order.table_id,
    });
  }

  await writeAudit(db as unknown as PoolClient, orderId, 'item_status_updated', { itemId, status }, actorId);

  sseBroadcaster.broadcast(order.store_id, 'ITEM_STATUS_CHANGED', {
    orderId,
    itemId,
    status,
    storeId: order.store_id,
    tableId: order.table_id,
    tableNumber: order.table_number,
    orderNumber: order.order_number,
    itemName: updatedItem.itemName,
    quantity: updatedItem.quantity,
    orderStatus,
  });

  if (previousStage !== newStage) {
    if (newStage === 'ready') {
      sseBroadcaster.broadcast(order.store_id, 'ORDER_READY', {
        orderId, storeId: order.store_id, tableId: order.table_id, tableNumber: order.table_number,
        orderNumber: order.order_number, orderType: order.order_type,
      });
    } else if (newStage === 'collected') {
      sseBroadcaster.broadcast(order.store_id, 'ORDER_COLLECTED', {
        orderId, storeId: order.store_id, tableId: order.table_id, tableNumber: order.table_number,
      });
    }
  }

  return updatedItem;
}

// ───────────────────────────────────────────
// Request bill
// ───────────────────────────────────────────

export async function requestBill(orderId: string, actorId: string): Promise<Order> {
  const result = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Order ${orderId} not found`);
  const order = result.rows[0];

  if (!['open', 'in_progress', 'ready'].includes(order.status as string)) {
    throw new ValidationError(`Cannot request bill for order with status '${order.status}'`);
  }

  const updated = await db.query(
    `UPDATE orders SET status = 'bill_requested', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [orderId],
  );

  await writeAudit(db as unknown as PoolClient, orderId, 'bill_requested', {}, actorId);

  if (order.table_id) updateTableStatus(order.table_id, 'bill_requested').catch(console.error);

  const updatedOrder = rowToOrder(updated.rows[0]);
  sseBroadcaster.broadcast(order.store_id, 'BILL_REQUESTED', {
    orderId,
    storeId: order.store_id,
    tableId: order.table_id,
    tableNumber: order.table_number,
    totalAmount: updatedOrder.totalAmount,
  });

  return updatedOrder;
}

// ───────────────────────────────────────────
// Close order after payment
// ───────────────────────────────────────────

export async function closeOrder(orderId: string, actorId: string): Promise<Order> {
  const result = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Order ${orderId} not found`);
  const order = result.rows[0];

  const updated = await db.query(
    `UPDATE orders SET status = 'closed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *`,
    [orderId],
  );

  await writeAudit(db as unknown as PoolClient, orderId, 'closed', {}, actorId);

  // Mark the table paid — it still needs a physical clean before it's free
  // again, so staff must explicitly move it through 'cleaning' to 'available'
  // rather than skipping straight there.
  if (order.table_id) updateTableStatus(order.table_id, 'paid').catch(console.error);

  const closedOrder = rowToOrder(updated.rows[0]);
  sseBroadcaster.broadcast(order.store_id, 'ORDER_CLOSED', {
    orderId,
    storeId: order.store_id,
    tableId: order.table_id,
  });

  consumeIngredients(orderId);

  return closedOrder;
}

// ───────────────────────────────────────────
// Get order by ID (with items)
// ───────────────────────────────────────────

export async function getOrderById(id: string): Promise<Order> {
  const orderResult = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
  if (!orderResult.rowCount || orderResult.rowCount === 0) throw new NotFoundError(`Order ${id} not found`);

  const order = rowToOrder(orderResult.rows[0]);

  const itemsResult = await db.query(
    `SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`,
    [id],
  );
  order.items = itemsResult.rows.map(rowToOrderItem);

  return order;
}

// ───────────────────────────────────────────
// List orders (paginated)
// ───────────────────────────────────────────

export async function listOrders(query: OrderListQuery) {
  const { page, limit, offset } = parsePagination(query);

  const conditions: string[] = ['store_id = $1'];
  const values: unknown[] = [query.storeId];
  let paramIdx = 2;

  // Orders created before branch scoping existed have a NULL branch_id and
  // would otherwise vanish from every branch-filtered view — surface them
  // to every branch rather than none, since we can't retroactively know
  // which branch they belonged to.
  if (query.branchId) {
    conditions.push(`(branch_id = $${paramIdx++} OR branch_id IS NULL)`);
    values.push(query.branchId);
  }
  if (query.customerId) {
    conditions.push(`customer_id = $${paramIdx++}`);
    values.push(query.customerId);
  }
  if (query.status) {
    conditions.push(`status = $${paramIdx++}`);
    values.push(query.status);
  }
  if (query.platform) {
    conditions.push(`platform = $${paramIdx++}`);
    values.push(query.platform);
  }
  if (query.from) {
    conditions.push(`created_at >= $${paramIdx++}`);
    values.push(query.from);
  }
  if (query.to) {
    conditions.push(`created_at <= $${paramIdx++}`);
    values.push(query.to);
  }

  const where = conditions.join(' AND ');

  const [countResult, dataResult] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM orders WHERE ${where}`, values),
    db.query(
      `SELECT o.*, COALESCE(i.item_count, 0) AS item_count
       FROM orders o
       LEFT JOIN (
         SELECT order_id, COUNT(*) AS item_count FROM order_items GROUP BY order_id
       ) i ON i.order_id = o.id
       WHERE ${where}
       ORDER BY o.created_at DESC
       LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, limit, offset],
    ),
  ]);

  return buildPaginatedResponse(
    dataResult.rows.map(rowToOrder),
    parseInt(countResult.rows[0].count),
    page,
    limit,
  );
}

// ───────────────────────────────────────────
// Update order status
// ───────────────────────────────────────────

export async function updateOrderStatus(
  orderId: string,
  req: UpdateOrderStatusRequest,
  actorId: string,
): Promise<Order> {
  const existing = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!existing.rowCount || existing.rowCount === 0) throw new NotFoundError(`Order ${orderId} not found`);

  const prev = existing.rows[0];
  validateStatusTransition(prev.status, req.status);

  const isTerminal = [OrderStatus.COMPLETED, OrderStatus.CLOSED].includes(req.status);
  const completedAt = isTerminal ? 'NOW()' : 'NULL';
  const result = await db.query(
    `UPDATE orders SET status = $1, updated_at = NOW(), completed_at = ${completedAt} WHERE id = $2 RETURNING *`,
    [req.status, orderId],
  );

  await writeAudit(db as unknown as PoolClient, orderId, 'status_updated', {
    from: prev.status,
    to: req.status,
    reason: req.reason,
  }, actorId);

  const order = rowToOrder(result.rows[0]);

  publishEvent('order.status_updated', order.storeId, orderId, 'Order', {
    orderId,
    previousStatus: prev.status,
    newStatus: req.status,
    reason: req.reason,
  }).catch(console.error);

  return order;
}

// ───────────────────────────────────────────
// Add item to order
// ───────────────────────────────────────────

export async function addOrderItem(
  orderId: string,
  req: AddOrderItemRequest,
  actorId: string,
): Promise<OrderItem> {
  const order = await db.query(
    `SELECT * FROM orders WHERE id = $1 AND status IN ('pending','open','in_progress')`,
    [orderId],
  );
  if (order.rowCount === 0) {
    throw new ValidationError('Can only add items to pending or open orders');
  }

  const itemId = generateId();

  await db.query(
    `INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, total_price, modifications, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      itemId, orderId, req.menuItemId, req.quantity,
      req.unitPrice, req.unitPrice * req.quantity,
      req.modifications ? JSON.stringify(req.modifications) : null,
      req.notes ?? null,
    ],
  );

  await recalculateOrderTotal(orderId);

  const itemResult = await db.query(`SELECT * FROM order_items WHERE id = $1`, [itemId]);
  const item = rowToOrderItem(itemResult.rows[0]);

  await writeAudit(db as unknown as PoolClient, orderId, 'item_added', {
    itemId,
    menuItemId: req.menuItemId,
    quantity: req.quantity,
  }, actorId);

  publishEvent('order.item_added', order.rows[0].store_id, orderId, 'Order', {
    itemId,
    menuItemId: req.menuItemId,
    quantity: req.quantity,
  }).catch(console.error);

  return item;
}

// ───────────────────────────────────────────
// Remove item from order
// ───────────────────────────────────────────

export async function removeOrderItem(orderId: string, itemId: string): Promise<void> {
  const order = await db.query(
    `SELECT * FROM orders WHERE id = $1 AND status IN ('pending','open','in_progress')`,
    [orderId],
  );
  if (order.rowCount === 0) {
    throw new ValidationError('Can only remove items from pending or open orders');
  }

  const existing = await db.query(`SELECT status FROM order_items WHERE id = $1 AND order_id = $2`, [itemId, orderId]);
  if (!existing.rowCount) throw new NotFoundError(`Order item ${itemId} not found`);
  if (existing.rows[0].status !== 'pending') {
    throw new ValidationError('Cannot remove an item the kitchen has already started preparing');
  }

  const item = await db.query(
    `DELETE FROM order_items WHERE id = $1 AND order_id = $2 RETURNING *`,
    [itemId, orderId],
  );
  if (item.rowCount === 0) throw new NotFoundError(`Order item ${itemId} not found`);

  await recalculateOrderTotal(orderId);

  publishEvent('order.item_removed', order.rows[0].store_id, orderId, 'Order', {
    orderId, itemId,
  }).catch(console.error);
}

// ───────────────────────────────────────────
// Update quantity of an already-sent item — only while the kitchen
// hasn't accepted/started it yet (item.status === 'pending')
// ───────────────────────────────────────────

export async function updateOrderItemQuantity(orderId: string, itemId: string, quantity: number): Promise<OrderItem> {
  const order = await db.query(
    `SELECT * FROM orders WHERE id = $1 AND status IN ('pending','open','in_progress')`,
    [orderId],
  );
  if (order.rowCount === 0) {
    throw new ValidationError('Can only edit items on pending or open orders');
  }

  const existing = await db.query(`SELECT * FROM order_items WHERE id = $1 AND order_id = $2`, [itemId, orderId]);
  if (!existing.rowCount) throw new NotFoundError(`Order item ${itemId} not found`);
  if (existing.rows[0].status !== 'pending') {
    throw new ValidationError('Cannot change an item the kitchen has already started preparing');
  }

  const unitPrice = parseFloat(existing.rows[0].unit_price);
  const totalPrice = parseFloat((unitPrice * quantity).toFixed(2));

  const result = await db.query(
    `UPDATE order_items SET quantity = $1, total_price = $2 WHERE id = $3 AND order_id = $4 RETURNING *`,
    [quantity, totalPrice, itemId, orderId],
  );

  await recalculateOrderTotal(orderId);

  publishEvent('order.item_updated', order.rows[0].store_id, orderId, 'Order', {
    orderId, itemId, quantity,
  }).catch(console.error);

  return rowToOrderItem(result.rows[0]);
}

// ───────────────────────────────────────────
// Mark order as paid (called by payment-service)
// ───────────────────────────────────────────

export async function markOrderPaid(
  orderId: string,
  req: { paymentStatus: 'paid' | 'refunded'; paymentMethod: string; paymentId: string },
): Promise<Order> {
  // $1 previously did double duty (plain assignment + a CASE WHEN
  // comparison) — Postgres infers a parameter's type from context, and two
  // different contexts for the same $N produced "inconsistent types
  // deduced for parameter $1" (42P08), failing this query for every
  // payment. Passing the computed paid_at value as its own parameter avoids
  // the clash entirely.
  const paidAt = req.paymentStatus === 'paid' ? new Date().toISOString() : null;
  const result = await db.query(
    `UPDATE orders
     SET payment_status = $1, payment_method = $2, updated_at = NOW(),
         paid_at = COALESCE($4::timestamptz, paid_at)
     WHERE id = $3 RETURNING *`,
    [req.paymentStatus, req.paymentMethod, orderId, paidAt],
  );

  if (result.rowCount === 0) throw new NotFoundError(`Order ${orderId} not found`);

  const order = result.rows[0];
  publishEvent('payment.processed', order.store_id, orderId, 'Order', {
    orderId,
    // customer-service's consumer reads this to compute loyalty points —
    // it was missing entirely before, so every points calculation reduced
    // to Math.floor(undefined * rate) = NaN and silently failed the
    // customer UPDATE (caught and logged, never surfaced) on every payment.
    amount: parseFloat(order.total_amount),
    paymentId: req.paymentId,
    paymentMethod: req.paymentMethod,
    paymentStatus: req.paymentStatus,
  }).catch(console.error);

  if (req.paymentStatus === 'paid') consumeIngredients(orderId);

  // Takeout/delivery pay upfront and have no "Send to Kitchen" tap of their
  // own (that's a dine-in-only action) — their items sit with
  // kds_dispatched_at unset until payment confirms the order is real, at
  // which point this is the only thing that ever puts them on the KDS board.
  if (req.paymentStatus === 'paid' && order.order_type !== 'dine-in' && order.status === 'pending') {
    await db.query(
      `UPDATE order_items SET kds_dispatched_at = NOW() WHERE order_id = $1 AND kds_dispatched_at IS NULL`,
      [orderId],
    );
    await db.query(`UPDATE orders SET status = 'in_progress', updated_at = NOW() WHERE id = $1`, [orderId]);

    const itemsResult = await db.query(`SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`, [orderId]);
    sseBroadcaster.broadcast(order.store_id, 'ORDER_DISPATCHED', {
      orderId,
      storeId: order.store_id,
      branchId: order.branch_id,
      orderNumber: order.order_number,
      tableNumber: order.table_number,
      tableId: order.table_id,
      orderType: order.order_type,
      notes: order.notes,
      items: itemsResult.rows.map(rowToOrderItem),
    });
  }

  return rowToOrder(order);
}

// ───────────────────────────────────────────
// Cancel order
// ───────────────────────────────────────────

export async function cancelOrder(
  orderId: string,
  req: CancelOrderRequest,
  actorId: string,
): Promise<Order> {
  const existing = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!existing.rowCount || existing.rowCount === 0) throw new NotFoundError(`Order ${orderId} not found`);

  const prev = existing.rows[0];
  const terminal = [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.CLOSED];
  if (terminal.includes(prev.status as OrderStatus)) {
    throw new ValidationError(`Cannot cancel an order with status: ${prev.status}`);
  }

  const result = await db.query(
    `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1 RETURNING *`,
    [orderId],
  );

  await writeAudit(db as unknown as PoolClient, orderId, 'cancelled', { reason: req.reason }, actorId);

  publishEvent('order.cancelled', prev.store_id, orderId, 'Order', {
    orderId, reason: req.reason,
  }).catch(console.error);

  releaseIngredients(orderId);

  if (prev.table_id) updateTableStatus(prev.table_id, 'available').catch(console.error);

  // The table is freed above, but without this the order stays stuck on the
  // KDS board indefinitely — cancellation only ever published to Kafka, which
  // the KDS doesn't consume; it only listens on the SSE stream.
  sseBroadcaster.broadcast(prev.store_id, 'ORDER_CANCELLED', {
    orderId, storeId: prev.store_id, tableId: prev.table_id,
  });

  return rowToOrder(result.rows[0]);
}

// ───────────────────────────────────────────
// Order statistics
// ───────────────────────────────────────────

export interface OrderStats {
  total: number;
  pending: number;
  cooking: number;
  ready: number;
  completed: number;
  cancelled: number;
  open: number;
  in_progress: number;
  bill_requested: number;
}

export async function getOrderStats(storeId: string): Promise<OrderStats> {
  const result = await db.query(
    `SELECT status, COUNT(*) AS count FROM orders WHERE store_id = $1 GROUP BY status`,
    [storeId],
  );

  const base: OrderStats = { total: 0, pending: 0, cooking: 0, ready: 0, completed: 0, cancelled: 0, open: 0, in_progress: 0, bill_requested: 0 };
  for (const row of result.rows) {
    const n = parseInt(row.count, 10);
    const s = row.status.replace('-', '_') as keyof OrderStats;
    if (s in base) (base[s] as number) = n;
    base.total += n;
  }
  return base;
}

export interface TodayStats {
  ordersToday: number;
  revenueToday: number;
  avgOrderValue: number;
  customerCount: number;
  ordersInProgress: number;
  ordersCompleted: number;
  ordersCancelled: number;
}

// Revenue is anchored on paid_at (the moment money was actually collected),
// not created_at — an order opened yesterday and paid today counts as
// today's revenue; an order opened today but still unpaid doesn't.
export async function getTodayStats(storeId: string): Promise<TodayStats> {
  const result = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM orders WHERE store_id = $1 AND created_at >= date_trunc('day', NOW()))
         AS orders_today,
       (SELECT COUNT(DISTINCT customer_id) FROM orders
          WHERE store_id = $1 AND created_at >= date_trunc('day', NOW()) AND customer_id IS NOT NULL)
         AS customer_count,
       (SELECT COUNT(*) FROM orders
          WHERE store_id = $1 AND status IN ('open','in_progress','bill_requested','pending','cooking','ready'))
         AS orders_in_progress,
       (SELECT COUNT(*) FROM orders
          WHERE store_id = $1 AND created_at >= date_trunc('day', NOW()) AND status IN ('completed','closed'))
         AS orders_completed,
       (SELECT COUNT(*) FROM orders
          WHERE store_id = $1 AND created_at >= date_trunc('day', NOW()) AND status = 'cancelled')
         AS orders_cancelled,
       (SELECT COALESCE(SUM(total_amount), 0) FROM orders
          WHERE store_id = $1 AND payment_status = 'paid' AND paid_at >= date_trunc('day', NOW()))
         AS revenue_today,
       (SELECT COUNT(*) FROM orders
          WHERE store_id = $1 AND payment_status = 'paid' AND paid_at >= date_trunc('day', NOW()))
         AS paid_orders_today`,
    [storeId],
  );

  const row = result.rows[0];
  const revenueToday = parseFloat(row.revenue_today);
  const paidOrdersToday = parseInt(row.paid_orders_today, 10);

  return {
    ordersToday: parseInt(row.orders_today, 10),
    revenueToday,
    avgOrderValue: paidOrdersToday > 0 ? parseFloat((revenueToday / paidOrdersToday).toFixed(2)) : 0,
    customerCount: parseInt(row.customer_count, 10),
    ordersInProgress: parseInt(row.orders_in_progress, 10),
    ordersCompleted: parseInt(row.orders_completed, 10),
    ordersCancelled: parseInt(row.orders_cancelled, 10),
  };
}

// ───────────────────────────────────────────
// Promo codes (manager-dashboard managed)
// ───────────────────────────────────────────

export interface PromoCode {
  id: string;
  storeId: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  firstTimeCustomerOnly: boolean;
  minOrderAmount?: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

function rowToPromoCode(row: Record<string, unknown>): PromoCode {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    code: row.code as string,
    description: row.description as string | undefined,
    discountType: row.discount_type as 'percentage' | 'fixed',
    discountValue: parseFloat(row.discount_value as string),
    firstTimeCustomerOnly: row.first_time_customer_only as boolean,
    minOrderAmount: row.min_order_amount != null ? parseFloat(row.min_order_amount as string) : undefined,
    maxUses: row.max_uses as number | undefined,
    usedCount: row.used_count as number,
    isActive: row.is_active as boolean,
    expiresAt: row.expires_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export async function createPromoCode(req: {
  storeId: string; code: string; description?: string;
  discountType: 'percentage' | 'fixed'; discountValue: number;
  firstTimeCustomerOnly?: boolean; minOrderAmount?: number; maxUses?: number; expiresAt?: string;
}): Promise<PromoCode> {
  const existing = await db.query(
    `SELECT id FROM promo_codes WHERE store_id = $1 AND code = $2`,
    [req.storeId, req.code.toUpperCase()],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    throw new ValidationError(`Promo code "${req.code}" already exists`);
  }
  const result = await db.query(
    `INSERT INTO promo_codes
       (id, store_id, code, description, discount_type, discount_value,
        first_time_customer_only, min_order_amount, max_uses, expires_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      generateId(), req.storeId, req.code.toUpperCase().trim(), req.description ?? null,
      req.discountType, req.discountValue, req.firstTimeCustomerOnly ?? false,
      req.minOrderAmount ?? null, req.maxUses ?? null, req.expiresAt ?? null,
    ],
  );
  return rowToPromoCode(result.rows[0]);
}

export async function listPromoCodes(storeId: string): Promise<PromoCode[]> {
  const result = await db.query(
    `SELECT * FROM promo_codes WHERE store_id = $1 ORDER BY created_at DESC`,
    [storeId],
  );
  return result.rows.map(rowToPromoCode);
}

export async function updatePromoCode(
  id: string,
  req: Partial<{
    description: string; discountType: 'percentage' | 'fixed'; discountValue: number;
    firstTimeCustomerOnly: boolean; minOrderAmount: number | null; maxUses: number | null;
    isActive: boolean; expiresAt: string | null;
  }>,
): Promise<PromoCode> {
  const result = await db.query(
    `UPDATE promo_codes SET
       description = COALESCE($2, description),
       discount_type = COALESCE($3, discount_type),
       discount_value = COALESCE($4, discount_value),
       first_time_customer_only = COALESCE($5, first_time_customer_only),
       min_order_amount = CASE WHEN $6::boolean IS TRUE THEN $7 ELSE min_order_amount END,
       max_uses = CASE WHEN $8::boolean IS TRUE THEN $9 ELSE max_uses END,
       is_active = COALESCE($10, is_active),
       expires_at = CASE WHEN $11::boolean IS TRUE THEN $12 ELSE expires_at END,
       updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      req.description ?? null, req.discountType ?? null, req.discountValue ?? null,
      req.firstTimeCustomerOnly ?? null,
      'minOrderAmount' in req, req.minOrderAmount ?? null,
      'maxUses' in req, req.maxUses ?? null,
      req.isActive ?? null,
      'expiresAt' in req, req.expiresAt ?? null,
    ],
  );
  if (!result.rowCount) throw new NotFoundError(`Promo code ${id} not found`);
  return rowToPromoCode(result.rows[0]);
}

export async function deletePromoCode(id: string): Promise<void> {
  const result = await db.query(`DELETE FROM promo_codes WHERE id = $1`, [id]);
  if (!result.rowCount) throw new NotFoundError(`Promo code ${id} not found`);
}

// ───────────────────────────────────────────
// Discounts (manual or promo-code driven)
// ───────────────────────────────────────────

export async function applyDiscount(
  orderId: string,
  req: { discountType?: 'percentage' | 'fixed'; discountValue?: number; reason?: string; promoCode?: string },
  actorId: string,
): Promise<Order> {
  const orderResult = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!orderResult.rowCount) throw new NotFoundError(`Order ${orderId} not found`);
  const order = orderResult.rows[0];

  const subtotalResult = await db.query(
    `SELECT COALESCE(SUM(total_price), 0) AS subtotal FROM order_items WHERE order_id = $1`,
    [orderId],
  );
  const subtotal = parseFloat(subtotalResult.rows[0].subtotal);

  let discountType = req.discountType;
  let discountValue = req.discountValue;
  let reason = req.reason;
  let promoCodeRow: Record<string, unknown> | null = null;

  if (req.promoCode) {
    const promoResult = await db.query(
      `SELECT * FROM promo_codes WHERE store_id = $1 AND code = $2`,
      [order.store_id, req.promoCode.toUpperCase().trim()],
    );
    if (!promoResult.rowCount) throw new ValidationError(`Promo code "${req.promoCode}" not found`);
    const promo = promoResult.rows[0];
    promoCodeRow = promo;

    if (!promo.is_active) throw new ValidationError('This promo code is no longer active');
    if (promo.expires_at && new Date(promo.expires_at as string) < new Date()) {
      throw new ValidationError('This promo code has expired');
    }
    if (promo.max_uses != null && (promo.used_count as number) >= (promo.max_uses as number)) {
      throw new ValidationError('This promo code has reached its usage limit');
    }
    if (promo.min_order_amount != null && subtotal < parseFloat(promo.min_order_amount as string)) {
      throw new ValidationError(`Order must be at least ${promo.min_order_amount} to use this code`);
    }
    if (promo.first_time_customer_only) {
      if (!order.customer_id) {
        throw new ValidationError('Attach a customer to this order to use a first-time-customer promo code');
      }
      // "First time" = no other non-cancelled order on record for this
      // customer — checked against order-service's own data rather than
      // customer-service's denormalized totalOrders counter, since that
      // counter is only updated via a Kafka consumer that isn't reliably
      // wired up (see reporting-service's identical fragility).
      const priorOrders = await db.query(
        `SELECT COUNT(*) FROM orders WHERE customer_id = $1 AND id != $2 AND status != 'cancelled'`,
        [order.customer_id, orderId],
      );
      if (parseInt(priorOrders.rows[0].count, 10) > 0) {
        throw new ValidationError('This promo code is only valid for a customer\'s first order');
      }
    }

    discountType = promo.discount_type as 'percentage' | 'fixed';
    discountValue = parseFloat(promo.discount_value as string);
    reason = (promo.description as string) ?? `Promo code ${promo.code}`;
  }

  if (!discountType || discountValue == null) {
    throw new ValidationError('discountType and discountValue (or a promoCode) are required');
  }
  if (discountType === 'percentage' && (discountValue <= 0 || discountValue > 100)) {
    throw new ValidationError('Percentage discount must be between 0 and 100');
  }

  const discountAmount = discountType === 'percentage'
    ? parseFloat((subtotal * (discountValue / 100)).toFixed(2))
    : Math.min(discountValue, subtotal);

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // One active discount per order — replace rather than stack, so
    // re-opening the discount modal to change the value doesn't double-apply.
    await client.query(`DELETE FROM order_discounts WHERE order_id = $1`, [orderId]);
    await client.query(
      `INSERT INTO order_discounts
         (id, order_id, discount_type, discount_value, reason, applied_by, promo_code_id, promo_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        generateId(), orderId, discountType, discountValue, reason ?? null, actorId,
        promoCodeRow?.id ?? null, promoCodeRow?.code ?? null,
      ],
    );
    await client.query(`UPDATE orders SET discount_amount = $1 WHERE id = $2`, [discountAmount, orderId]);
    await recalculateOrderTotalClient(client, orderId);

    if (promoCodeRow) {
      await client.query(`UPDATE promo_codes SET used_count = used_count + 1 WHERE id = $1`, [promoCodeRow.id]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  return rowToOrder(updated.rows[0]);
}

export async function removeDiscount(orderId: string): Promise<Order> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`DELETE FROM order_discounts WHERE order_id = $1`, [orderId]);
    await client.query(`UPDATE orders SET discount_amount = 0 WHERE id = $1`, [orderId]);
    await recalculateOrderTotalClient(client, orderId);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  const updated = await db.query(`SELECT * FROM orders WHERE id = $1`, [orderId]);
  if (!updated.rowCount) throw new NotFoundError(`Order ${orderId} not found`);
  return rowToOrder(updated.rows[0]);
}

// ───────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────

async function recalculateOrderTotal(orderId: string): Promise<void> {
  const [items, order] = await Promise.all([
    db.query(`SELECT SUM(total_price) as subtotal FROM order_items WHERE order_id = $1`, [orderId]),
    db.query(`SELECT discount_amount FROM orders WHERE id = $1`, [orderId]),
  ]);
  const subtotal = parseFloat(items.rows[0].subtotal ?? '0');
  // discount_amount is preserved across recalculation — item add/remove/qty
  // changes used to always overwrite total_amount from subtotal+tax alone,
  // silently discarding any discount applied earlier in the same order.
  const discountAmount = Math.min(parseFloat(order.rows[0]?.discount_amount ?? '0'), subtotal);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = parseFloat((taxableAmount * 0.05).toFixed(2));
  const totalAmount = parseFloat((taxableAmount + taxAmount).toFixed(2));
  await db.query(
    `UPDATE orders SET total_amount = $1, tax_amount = $2, net_revenue = $1, updated_at = NOW() WHERE id = $3`,
    [totalAmount, taxAmount, orderId],
  );
}

async function recalculateOrderTotalClient(client: PoolClient, orderId: string): Promise<void> {
  const [items, order] = await Promise.all([
    client.query(`SELECT SUM(total_price) as subtotal FROM order_items WHERE order_id = $1`, [orderId]),
    client.query(`SELECT discount_amount FROM orders WHERE id = $1`, [orderId]),
  ]);
  const subtotal = parseFloat(items.rows[0].subtotal ?? '0');
  const discountAmount = Math.min(parseFloat(order.rows[0]?.discount_amount ?? '0'), subtotal);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = parseFloat((taxableAmount * 0.05).toFixed(2));
  const totalAmount = parseFloat((taxableAmount + taxAmount).toFixed(2));
  await client.query(
    `UPDATE orders SET total_amount = $1, tax_amount = $2, net_revenue = $1, updated_at = NOW() WHERE id = $3`,
    [totalAmount, taxAmount, orderId],
  );
}

async function writeAudit(
  client: PoolClient | typeof db,
  orderId: string,
  action: string,
  changes: unknown,
  actorId: string,
): Promise<void> {
  await (client as PoolClient).query(
    `INSERT INTO order_audit (id, order_id, action, changes, actor_id) VALUES ($1,$2,$3,$4,$5)`,
    [generateId(), orderId, action, JSON.stringify(changes), actorId],
  );
}

const VALID_TRANSITIONS: Record<string, OrderStatus[]> = {
  pending: [OrderStatus.COOKING, OrderStatus.CANCELLED],
  cooking: [OrderStatus.READY, OrderStatus.CANCELLED],
  open: [OrderStatus.IN_PROGRESS, OrderStatus.CANCELLED, OrderStatus.BILL_REQUESTED],
  in_progress: [OrderStatus.READY, OrderStatus.CANCELLED, OrderStatus.BILL_REQUESTED],
  ready: [OrderStatus.COMPLETED, OrderStatus.CANCELLED, OrderStatus.BILL_REQUESTED, OrderStatus.CLOSED],
  bill_requested: [OrderStatus.CLOSED, OrderStatus.CANCELLED],
  completed: [],
  closed: [],
  cancelled: [],
  paid: [OrderStatus.CLOSED],
};

function validateStatusTransition(from: string, to: OrderStatus): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new ValidationError(`Invalid status transition from '${from}' to '${to}'`);
  }
}

// ───────────────────────────────────────────
// Row mappers
// ───────────────────────────────────────────

function rowToOrder(row: Record<string, unknown>): Order & { orderNumber: number; itemCount: number } {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    deviceId: row.device_id as string,
    cashierId: row.cashier_id as string,
    customerId: row.customer_id as string | undefined,
    status: row.status as OrderStatus,
    totalAmount: parseFloat(row.total_amount as string),
    taxAmount: parseFloat(row.tax_amount as string),
    discountAmount: parseFloat(row.discount_amount as string),
    paymentStatus: row.payment_status as import('@pos/shared-types').PaymentStatus,
    paymentMethod: row.payment_method as import('@pos/shared-types').PaymentMethod | undefined,
    orderType: row.order_type as import('@pos/shared-types').OrderType,
    tableNumber: row.table_number as number | undefined,
    tableId: row.table_id as string | undefined,
    guestCount: row.guest_count != null ? Number(row.guest_count) : undefined,
    notes: row.notes as string | undefined,
    platform: row.platform as Platform,
    platformOrderId: row.platform_order_id as string | undefined,
    commissionRate: parseFloat(row.commission_rate as string),
    commissionAmount: parseFloat(row.commission_amount as string),
    netRevenue: row.net_revenue ? parseFloat(row.net_revenue as string) : undefined,
    createdOffline: row.created_offline as boolean,
    syncedAt: row.synced_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    completedAt: row.completed_at as string | undefined,
    orderNumber: row.order_number ? parseInt(row.order_number as string, 10) : 0,
    itemCount: row.item_count ? parseInt(row.item_count as string, 10) : 0,
  };
}

function rowToOrderItem(row: Record<string, unknown>): OrderItem {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    menuItemId: row.menu_item_id as string,
    itemName: row.item_name as string | undefined,
    quantity: row.quantity as number,
    unitPrice: parseFloat(row.unit_price as string),
    totalPrice: parseFloat(row.total_price as string),
    modifications: (row.modifications as import('@pos/shared-types').OrderItemModification[] | null) ?? [],
    notes: row.notes as string | undefined,
    status: row.status as OrderItemStatus,
    kdsDispatchedAt: row.kds_dispatched_at as string | undefined,
    createdAt: row.created_at as string,
  };
}
