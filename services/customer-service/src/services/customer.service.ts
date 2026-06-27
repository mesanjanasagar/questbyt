import { db } from '../db/client';
import { config } from '../config';
import { publishEvent } from '../events/producer';
import {
  generateId,
  NotFoundError,
  ConflictError,
  buildPaginatedResponse,
  parsePagination,
} from '@pos/shared-utils';
import type {
  Customer,
  LoyaltyLedger,
  SegmentCounts,
  CreateCustomerRequest,
  UpdateCustomerRequest,
  PaginatedResponse,
  PaginationQuery,
} from '@pos/shared-types';
import type { CustomerSegment } from '@pos/shared-types';

// ================================================
// Segment computation - pure function, no DB
// ================================================

export function computeSegment(
  totalOrders: number,
  totalSpend: number,
  daysSinceLastOrder: number | null,
): CustomerSegment {
  if (totalSpend >= config.VIP_SPEND_THRESHOLD) return 'vip';
  if (totalOrders === 0 || daysSinceLastOrder === null) return 'new';
  if (daysSinceLastOrder <= config.SEGMENT_ACTIVE_DAYS) return 'active';
  if (daysSinceLastOrder <= config.SEGMENT_AT_RISK_DAYS) return 'at_risk';
  if (daysSinceLastOrder <= config.SEGMENT_CHURNED_DAYS) return 'churned';
  return 'lapsed';
}

export function computeTier(lifetimePoints: number): Customer['loyaltyTier'] {
  if (lifetimePoints >= config.TIER_PLATINUM_THRESHOLD) return 'platinum';
  if (lifetimePoints >= config.TIER_GOLD_THRESHOLD) return 'gold';
  return 'silver';
}

// ================================================
// Create customer
// ================================================

export async function createCustomer(req: CreateCustomerRequest): Promise<Customer> {
  // Check phone/email uniqueness within store
  if (req.phone) {
    const dup = await db.query(
      `SELECT id FROM customers WHERE store_id = $1 AND phone = $2`,
      [req.storeId, req.phone],
    );
    if (dup.rowCount && dup.rowCount > 0) {
      throw new ConflictError(`A customer with phone ${req.phone} already exists in this store`);
    }
  }
  if (req.email) {
    const dup = await db.query(
      `SELECT id FROM customers WHERE store_id = $1 AND email = $2`,
      [req.storeId, req.email],
    );
    if (dup.rowCount && dup.rowCount > 0) {
      throw new ConflictError(`A customer with email ${req.email} already exists in this store`);
    }
  }

  const id = generateId();
  const result = await db.query(
    `INSERT INTO customers (id, store_id, name, phone, email)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [id, req.storeId, req.name, req.phone ?? null, req.email ?? null],
  );

  const customer = rowToCustomer(result.rows[0]);

  publishEvent(
    'customer.created',
    customer.storeId,
    customer.id,
    'customer',
    { customerId: customer.id, storeId: customer.storeId, name: customer.name, phone: customer.phone, email: customer.email },
  ).catch((err) => console.warn('Failed to publish customer.created:', err.message));

  return customer;
}

// ================================================
// Get by ID
// ================================================

export async function getCustomerById(id: string): Promise<Customer> {
  const result = await db.query(`SELECT * FROM customers WHERE id = $1`, [id]);
  if (!result.rowCount || result.rowCount === 0) {
    throw new NotFoundError(`Customer ${id} not found`);
  }
  return rowToCustomer(result.rows[0]);
}

// ================================================
// Lookup by phone or email (for POS lookup at checkout)
// ================================================

export async function lookupCustomer(
  storeId: string,
  query: string,
): Promise<Customer | null> {
  const result = await db.query(
    `SELECT * FROM customers
     WHERE store_id = $1 AND (phone = $2 OR email = $2)
     LIMIT 1`,
    [storeId, query],
  );
  if (!result.rowCount || result.rowCount === 0) return null;
  return rowToCustomer(result.rows[0]);
}

// ================================================
// Update customer
// ================================================

export async function updateCustomer(
  id: string,
  req: UpdateCustomerRequest,
): Promise<Customer> {
  await getCustomerById(id); // throws NotFoundError if missing

  const result = await db.query(
    `UPDATE customers
     SET name = COALESCE($2, name),
         phone = COALESCE($3, phone),
         email = COALESCE($4, email),
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, req.name ?? null, req.phone ?? null, req.email ?? null],
  );
  return rowToCustomer(result.rows[0]);
}

// ================================================
// List customers (with pagination + segment filter)
// ================================================

export async function listCustomers(
  storeId: string,
  query: PaginationQuery & { segment?: string },
): Promise<PaginatedResponse<Customer>> {
  const { page, limit, offset } = parsePagination(query);
  const params: unknown[] = [storeId];
  let where = `WHERE store_id = $1`;

  if (query.segment) {
    params.push(query.segment);
    where += ` AND segment = $${params.length}`;
  }

  const countResult = await db.query(
    `SELECT COUNT(*) FROM customers ${where}`,
    params,
  );
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const dataResult = await db.query(
    `SELECT * FROM customers ${where}
     ORDER BY last_order_at DESC NULLS LAST, created_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );

  return buildPaginatedResponse(dataResult.rows.map(rowToCustomer), total, page, limit);
}

// ================================================
// Segment counts - for dashboard KPIs
// ================================================

export async function getSegmentCounts(storeId: string): Promise<SegmentCounts> {
  const result = await db.query(
    `SELECT segment, COUNT(*) as count
     FROM customers
     WHERE store_id = $1
     GROUP BY segment`,
    [storeId],
  );

  const counts: SegmentCounts = { new: 0, active: 0, at_risk: 0, churned: 0, vip: 0, lapsed: 0, total: 0 };
  for (const row of result.rows) {
    const seg = row.segment as keyof Omit<SegmentCounts, 'total'>;
    counts[seg] = parseInt(row.count, 10);
    counts.total += counts[seg];
  }
  return counts;
}

// ================================================
// Get loyalty ledger for a customer
// ================================================

export async function getLoyaltyLedger(
  customerId: string,
  query: PaginationQuery,
): Promise<PaginatedResponse<LoyaltyLedger>> {
  const { page, limit, offset } = parsePagination(query);

  const countResult = await db.query(
    `SELECT COUNT(*) FROM loyalty_ledger WHERE customer_id = $1`,
    [customerId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await db.query(
    `SELECT * FROM loyalty_ledger WHERE customer_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [customerId, limit, offset],
  );

  return buildPaginatedResponse(dataResult.rows.map(rowToLedger), total, page, limit);
}

// ================================================
// Record order - called by the Kafka consumer on payment.processed
// Updates stats, awards loyalty points, re-computes segment
// ================================================

export async function recordOrderForCustomer(
  customerId: string,
  storeId: string,
  orderId: string,
  orderAmount: number,
): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch current customer
    const custResult = await client.query(
      `SELECT * FROM customers WHERE id = $1 FOR UPDATE`,
      [customerId],
    );
    if (!custResult.rowCount || custResult.rowCount === 0) return;
    const row = custResult.rows[0];

    const prevSegment: CustomerSegment = row.segment;
    const newTotalOrders: number = row.total_orders + 1;
    const newTotalSpend: number = parseFloat(row.total_spend) + orderAmount;

    // 2. Compute loyalty points earned (configurable rate)
    const pointsEarned = Math.floor(orderAmount * config.POINTS_PER_AED);
    const newPoints = row.loyalty_points + pointsEarned;
    const newTier = computeTier(newPoints);

    // 3. Compute new segment
    const newSegment = computeSegment(newTotalOrders, newTotalSpend, 0);

    // 4. Update customer record
    await client.query(
      `UPDATE customers
       SET total_orders = $2,
           total_spend = $3,
           loyalty_points = $4,
           loyalty_tier = $5,
           segment = $6,
           last_order_at = NOW(),
           first_order_at = COALESCE(first_order_at, NOW()),
           updated_at = NOW()
       WHERE id = $1`,
      [customerId, newTotalOrders, newTotalSpend, newPoints, newTier, newSegment],
    );

    // 5. Write loyalty ledger entry (idempotent by order_id + customer_id)
    await client.query(
      `INSERT INTO loyalty_ledger
       (id, customer_id, store_id, order_id, points_earned, points_redeemed, balance, description)
       VALUES ($1, $2, $3, $4, $5, 0, $6, $7)
       ON CONFLICT (order_id, customer_id) DO NOTHING`,
      [
        generateId(),
        customerId,
        storeId,
        orderId,
        pointsEarned,
        newPoints,
        `Order ${orderId.slice(0, 8)} - earned ${pointsEarned} pts`,
      ],
    );

    await client.query('COMMIT');

    // 6. Publish events (outside transaction - best-effort)
    if (pointsEarned > 0) {
      publishEvent(
        'customer.points_earned',
        storeId,
        customerId,
        'customer',
        { customerId, storeId, orderId, pointsEarned, newBalance: newPoints },
      ).catch((err) => console.warn('Failed to publish customer.points_earned:', err.message));
    }

    if (prevSegment !== newSegment) {
      publishEvent(
        'customer.segment_changed',
        storeId,
        customerId,
        'customer',
        { customerId, storeId, previousSegment: prevSegment, newSegment },
      ).catch((err) => console.warn('Failed to publish customer.segment_changed:', err.message));
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ================================================
// Refresh all segments - run as a scheduled job (nightly)
// Re-computes segment for every customer based on days since last order
// ================================================

export async function refreshAllSegments(storeId: string): Promise<number> {
  const result = await db.query(
    `UPDATE customers
     SET segment = CASE
       WHEN total_spend >= $2 THEN 'vip'
       WHEN total_orders = 0 OR last_order_at IS NULL THEN 'new'
       WHEN EXTRACT(EPOCH FROM (NOW() - last_order_at)) / 86400 <= $3 THEN 'active'
       WHEN EXTRACT(EPOCH FROM (NOW() - last_order_at)) / 86400 <= $4 THEN 'at_risk'
       WHEN EXTRACT(EPOCH FROM (NOW() - last_order_at)) / 86400 <= $5 THEN 'churned'
       ELSE 'lapsed'
     END,
     updated_at = NOW()
     WHERE store_id = $1`,
    [
      storeId,
      config.VIP_SPEND_THRESHOLD,
      config.SEGMENT_ACTIVE_DAYS,
      config.SEGMENT_AT_RISK_DAYS,
      config.SEGMENT_CHURNED_DAYS,
    ],
  );
  return result.rowCount ?? 0;
}

// ================================================
// Row mappers
// ================================================

function rowToCustomer(row: Record<string, unknown>): Customer {
  const totalOrders = row.total_orders as number;
  const totalSpend = parseFloat(row.total_spend as string);
  const lastOrderAt = row.last_order_at as string | undefined;
  const daysSinceLastOrder = lastOrderAt
    ? Math.floor((Date.now() - new Date(lastOrderAt).getTime()) / 86_400_000)
    : undefined;

  return {
    id: row.id as string,
    storeId: row.store_id as string,
    name: row.name as string,
    phone: row.phone as string | undefined,
    email: row.email as string | undefined,
    loyaltyPoints: row.loyalty_points as number,
    loyaltyTier: row.loyalty_tier as Customer['loyaltyTier'],
    segment: row.segment as CustomerSegment,
    totalOrders,
    totalSpend,
    averageOrderValue: totalOrders > 0 ? parseFloat((totalSpend / totalOrders).toFixed(2)) : 0,
    lastOrderAt,
    firstOrderAt: row.first_order_at as string | undefined,
    daysSinceLastOrder,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToLedger(row: Record<string, unknown>): LoyaltyLedger {
  return {
    id: row.id as string,
    customerId: row.customer_id as string,
    storeId: row.store_id as string,
    orderId: row.order_id as string,
    pointsEarned: row.points_earned as number,
    pointsRedeemed: row.points_redeemed as number,
    balance: row.balance as number,
    description: row.description as string,
    createdAt: row.created_at as string,
  };
}