import { db } from '../db/client';
import { config } from '../config';
import { generateId, ValidationError, NotFoundError, ConflictError } from '@pos/shared-utils';
import type { Payment, Refund, ProcessPaymentRequest, RefundRequest } from '@pos/shared-types';

// ───────────────────────────────────────────
// Process a payment for an order
// ───────────────────────────────────────────

export async function processPayment(
  req: ProcessPaymentRequest & { storeId: string },
): Promise<Payment> {
  // Idempotency check – prevent double-charging
  const existing = await db.query(
    `SELECT * FROM payments WHERE idempotency_key = $1`,
    [req.idempotencyKey],
  );
  if (existing.rowCount && existing.rowCount > 0) {
    return rowToPayment(existing.rows[0]);
  }

  // Validate cash tendered covers total
  if (req.paymentMethod === 'cash' && req.cashTendered !== undefined) {
    if (req.cashTendered < req.amount) {
      throw new ValidationError('Cash tendered is less than the order amount');
    }
  }

  const changeDue =
    req.paymentMethod === 'cash' && req.cashTendered !== undefined
      ? parseFloat((req.cashTendered - req.amount).toFixed(2))
      : 0;

  // For card/online – generate a mock transaction id (real gateway integration goes here)
  const transactionId =
    req.paymentMethod !== 'cash'
      ? `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      : undefined;

  const result = await db.query(
    `INSERT INTO payments
      (id, order_id, store_id, amount, payment_method, transaction_id, status,
       idempotency_key, cash_tendered, change_due, metadata, processed_at)
     VALUES ($1,$2,$3,$4,$5,$6,'success',$7,$8,$9,$10,NOW())
     RETURNING *`,
    [
      generateId(),
      req.orderId,
      req.storeId,
      req.amount,
      req.paymentMethod,
      transactionId ?? null,
      req.idempotencyKey,
      req.cashTendered ?? null,
      changeDue || null,
      req.receiptDetails ? JSON.stringify(req.receiptDetails) : null,
    ],
  );

  const payment = rowToPayment(result.rows[0]);

  // Notify order-service to mark order as paid (best-effort)
  notifyOrderPaid(req.orderId, payment.id, req.paymentMethod).catch((err) =>
    console.warn('Failed to notify order-service of payment:', err.message),
  );

  return payment;
}

// ───────────────────────────────────────────
// Get payment by ID
// ───────────────────────────────────────────

export async function getPaymentById(id: string): Promise<Payment> {
  const result = await db.query(`SELECT * FROM payments WHERE id = $1`, [id]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Payment ${id} not found`);
  return rowToPayment(result.rows[0]);
}

// ───────────────────────────────────────────
// Get payment by order ID
// ───────────────────────────────────────────

export async function getPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const result = await db.query(
    `SELECT * FROM payments WHERE order_id = $1 AND status = 'success' ORDER BY created_at DESC LIMIT 1`,
    [orderId],
  );
  if (!result.rowCount || result.rowCount === 0) return null;
  return rowToPayment(result.rows[0]);
}

// ───────────────────────────────────────────
// Refund a payment
// ───────────────────────────────────────────

export async function refundPayment(paymentId: string, req: RefundRequest): Promise<Refund> {
  const paymentResult = await db.query(`SELECT * FROM payments WHERE id = $1`, [paymentId]);
  if (!paymentResult.rowCount || paymentResult.rowCount === 0) {
    throw new NotFoundError(`Payment ${paymentId} not found`);
  }

  const payment = paymentResult.rows[0];
  if (payment.status !== 'success') {
    throw new ConflictError(`Cannot refund a payment with status: ${payment.status}`);
  }
  if (req.amount > parseFloat(payment.amount)) {
    throw new ValidationError('Refund amount exceeds original payment amount');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const refundResult = await client.query(
      `INSERT INTO refunds (id, payment_id, amount, reason, status)
       VALUES ($1,$2,$3,$4,'success') RETURNING *`,
      [generateId(), paymentId, req.amount, req.reason],
    );

    await client.query(
      `UPDATE payments SET status = 'refunded', processed_at = NOW() WHERE id = $1`,
      [paymentId],
    );

    await client.query('COMMIT');
    return rowToRefund(refundResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ───────────────────────────────────────────
// Notify order-service of payment completion
// ───────────────────────────────────────────

async function notifyOrderPaid(
  orderId: string,
  paymentId: string,
  paymentMethod: string,
): Promise<void> {
  const url = `${config.ORDER_SERVICE_URL}/api/v1/orders/${orderId}/payment`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Service': 'payment-service' },
    body: JSON.stringify({ paymentStatus: 'paid', paymentMethod, paymentId }),
  });
  if (!res.ok) {
    throw new Error(`Order service responded with ${res.status}`);
  }
}

// ───────────────────────────────────────────
// Row mappers
// ───────────────────────────────────────────

function rowToPayment(row: Record<string, unknown>): Payment {
  return {
    id: row.id as string,
    orderId: row.order_id as string,
    storeId: row.store_id as string,
    amount: parseFloat(row.amount as string),
    paymentMethod: row.payment_method as string,
    transactionId: row.transaction_id as string | undefined,
    status: row.status as Payment['status'],
    cashTendered: row.cash_tendered ? parseFloat(row.cash_tendered as string) : undefined,
    changeDue: row.change_due ? parseFloat(row.change_due as string) : undefined,
    metadata: row.metadata as Record<string, unknown> | undefined,
    createdAt: row.created_at as string,
    processedAt: row.processed_at as string | undefined,
  };
}

function rowToRefund(row: Record<string, unknown>): Refund {
  return {
    id: row.id as string,
    paymentId: row.payment_id as string,
    amount: parseFloat(row.amount as string),
    reason: row.reason as string,
    status: row.status as Refund['status'],
    createdAt: row.created_at as string,
  };
}