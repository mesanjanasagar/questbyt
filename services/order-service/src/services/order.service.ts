import { PoolClient } from 'pg';
import { db } from '../db/client';
import { publishEvent } from '../events/producer';
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
} from '@pos/shared-types';
import { OrderStatus, Platform } from '@pos/shared-types';

// ───────────────────────────────────────────
// Create order
// ───────────────────────────────────────────

export async function createOrder(req: CreateOrderRequest): Promise<Order> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const orderId = generateId();
    const platform = req.platform ?? Platform.DIRECT;

    // Calculate totals from items
    let subtotal = 0;
    const itemRows = req.items.map((item) => {
      const totalPrice = item.unitPrice * item.quantity;
      subtotal += totalPrice;
      return { ...item, totalPrice, id: generateId() };
    });

    const taxAmount = parseFloat((subtotal * 0.05).toFixed(2));
    const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));
    const netRevenue = totalAmount; // No commission for direct POS initially

    // Insert order
    const orderResult = await client.query(
      `INSERT INTO orders
        (id, store_id, device_id, cashier_id, customer_id, status, total_amount, tax_amount,
         discount_amount, payment_status, order_type, table_number, notes, platform,
         commission_rate, commission_amount, net_revenue, created_offline)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,0,'unpaid',$8,$9,$10,$11,0,0,$12,0,$13,false)
       RETURNING *`,
      [
        orderId, req.storeId, req.deviceId, req.cashierId,
        req.customerId ?? null, totalAmount, taxAmount,
        req.orderType, req.tableNumber ?? null, req.notes ?? null,
        platform, req.platform ? null : null, netRevenue,
      ],
    );

    // Insert items
    for (const item of itemRows) {
      await client.query(
        `INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, total_price, modifications, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          item.id, orderId, item.menuItemId, item.quantity,
          item.unitPrice, item.totalPrice,
          item.modifications ? JSON.stringify(item.modifications) : null,
          item.notes ?? null,
        ],
      );
    }

    // Audit log
    await writeAudit(client, orderId, 'created', { totalAmount }, req.cashierId);

    await client.query('COMMIT');
    const order = rowToOrder(orderResult.rows[0]);

    // Publish event (non-blocking)
    publishEvent(
      'order.created',
      req.storeId,
      orderId,
      'Order',
      { orderId, storeId: req.storeId, cashierId: req.cashierId, deviceId: req.deviceId, orderType: req.orderType, items: req.items, totalAmount },
    ).catch(console.error);

    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
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

  const [countResult, dateResult] = await Promise.all([
    db.query(`SELECT COUNT(*) FROM orders WHERE ${where}`, values),
    db.query(
      `SELECT * FROM orders WHERE ${where} ORDER BY created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...values, limit, offset],
    ),
  ]);

  return buildPaginatedResponse(
    dateResult.rows.map(rowToOrder),
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

  const completedAt = req.status === OrderStatus.COMPLETED ? 'NOW()' : 'NULL';
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

  return rowToOrder(result.rows[0]);
}

// ───────────────────────────────────────────
// Add item to order
// ───────────────────────────────────────────

export async function addOrderItem(
  orderId: string,
  req: AddOrderItemRequest,
  actorId: string,
): Promise<OrderItem> {
  const order = await db.query(`SELECT * FROM orders WHERE id = $1 AND status IN ('pending')`, [orderId]);
  if (order.rowCount === 0) {
    throw new ValidationError('Can only add items to pending orders');
  }

  const itemId = generateId();

  await db.query(
    `INSERT INTO order_items (id, order_id, menu_item_id, quantity, unit_price, total_price, modifications, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      itemId,
      orderId,
      req.menuItemId,
      req.quantity,
      req.unitPrice,
      req.unitPrice * req.quantity,
      req.modifications ? JSON.stringify(req.modifications) : null,
      req.notes ?? null,
    ],
  );

  // Recalculate order total
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

export async function removeOrderItem(
  orderId: string,
  itemId: string,
): Promise<void> {
  const order = await db.query(`SELECT * FROM orders WHERE id = $1 AND status IN ('pending')`, [orderId]);
  if (order.rowCount === 0) {
    throw new ValidationError('Can only remove items from pending orders');
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
// Mark order as paid (called by payment-service)
// ───────────────────────────────────────────

export async function markOrderPaid(
  orderId: string,
  req: { paymentStatus: 'paid' | 'refunded'; paymentMethod: string; paymentId: string },
): Promise<Order> {
  const result = await db.query(
    `UPDATE orders
     SET payment_status = $1, payment_method = $2, updated_at = NOW()
     WHERE id = $3 RETURNING *`,
    [req.paymentStatus, req.paymentMethod, orderId],
  );

  if (result.rowCount === 0) {
    throw new NotFoundError(`Order ${orderId} not found`);
  }

  const order = result.rows[0];
  publishEvent('payment.processed', order.store_id, orderId, 'Order', {
    orderId,
    paymentId: req.paymentId,
    paymentMethod: req.paymentMethod,
    paymentStatus: req.paymentStatus,
  }).catch(console.error);

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
  if ([OrderStatus.COMPLETED, OrderStatus.CANCELLED].includes(prev.status as OrderStatus)) {
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

  return rowToOrder(result.rows[0]);
}

// ───────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────

async function recalculateOrderTotal(orderId: string): Promise<void> {
  const items = await db.query(
    `SELECT SUM(total_price) as subtotal FROM order_items WHERE order_id = $1`,
    [orderId],
  );
  const subtotal = parseFloat(items.rows[0].subtotal) ?? '0';
  const taxAmount = parseFloat((subtotal * 0.05).toFixed(2));
  const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));
  await db.query(
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
  ready: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  completed: [],
  cancelled: [],
};

function validateStatusTransition(from: string, to: OrderStatus): void {
  if (!VALID_TRANSITIONS[from]?.includes(to)) {
    throw new ValidationError(`Invalid status transition from '${from}' to '${to}'`);
  }
}

// ───────────────────────────────────────────
// Row mappers
// ───────────────────────────────────────────

function rowToOrder(row: Record<string, unknown>): Order {
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
  };
}

function rowToOrderItem(row: Record<string, unknown>): OrderItem {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    menuItemId: row.menu_item_id as string,
    quantity: row.quantity as number,
    unitPrice: parseFloat(row.unit_price as string),
    totalPrice: parseFloat(row.total_price as string),
    modifications: row.modifications as import('@pos/shared-types').OrderItemModification[] | undefined,
    notes: row.notes as string | undefined,
    status: row.status as import('@pos/shared-types').OrderItemStatus,
    createdAt: row.created_at as string,
  };
}