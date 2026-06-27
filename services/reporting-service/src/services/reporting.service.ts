import { db } from '../db/client';
import { generateId } from '@pos/shared-utils';
import type {
  RevenueReport,
  ChannelContribution,
  DailySnapshot,
  TopItem,
  CustomerKpiReport,
  HourlyOrderPattern,
} from '@pos/shared-types';

// ----------------------------------------
// Revenue report - gross, net, tax, discount, commission
// ----------------------------------------

export async function getRevenueReport(
  storeId: string,
  from: string,
  to: string,
  period: 'day' | 'week' | 'month',
): Promise<RevenueReport> {
  const result = await db.query(
    `SELECT
       COUNT(*)                                AS total_orders,
       COALESCE(SUM(total_amount), 0)           AS gross_revenue,
       COALESCE(SUM(net_revenue), 0)            AS net_revenue,
       COALESCE(SUM(tax_amount), 0)             AS total_tax,
       COALESCE(SUM(discount_amount), 0)        AS total_discount,
       COALESCE(SUM(commission_amount), 0)      AS total_commission,
       CASE WHEN COUNT(*) > 0
         THEN ROUND(SUM(total_amount)::numeric / COUNT(*), 2)
         ELSE 0 END                             AS avg_order_value
     FROM report_orders
     WHERE store_id = $1
       AND created_at >= $2
       AND created_at < $3
       AND status = 'completed'`,
    [storeId, from, to],
  );

  const row = result.rows[0];
  const gross = parseFloat(row.gross_revenue);

  const byChannel = await getChannelContributions(storeId, from, to, gross);

  return {
    storeId,
    period,
    from,
    to,
    grossRevenue: gross,
    netRevenue: parseFloat(row.net_revenue),
    totalOrders: parseInt(row.total_orders, 10),
    averageOrderValue: parseFloat(row.avg_order_value),
    totalTax: parseFloat(row.total_tax),
    totalDiscount: parseFloat(row.total_discount),
    totalCommission: parseFloat(row.total_commission),
    byChannel,
  };
}

// ----------------------------------------
// Channel contribution breakdown
// ----------------------------------------

export async function getChannelContributions(
  storeId: string,
  from: string,
  to: string,
  totalGross?: number,
): Promise<ChannelContribution[]> {
  const result = await db.query(
    `SELECT
       platform                                 AS channel,
       COUNT(*)                                 AS total_orders,
       COALESCE(SUM(total_amount), 0)           AS gross_revenue,
       COALESCE(SUM(commission_amount), 0)      AS commission_amount,
       COALESCE(SUM(net_revenue), 0)            AS net_revenue
     FROM report_orders
     WHERE store_id = $1
       AND created_at >= $2
       AND created_at < $3
       AND status = 'completed'
     GROUP BY platform
     ORDER BY gross_revenue DESC`,
    [storeId, from, to],
  );

  const gross = totalGross ?? result.rows.reduce((acc, r) => acc + parseFloat(r.gross_revenue), 0);

  return result.rows.map((row) => ({
    channel: row.channel as string,
    totalOrders: parseInt(row.total_orders, 10),
    grossRevenue: parseFloat(row.gross_revenue),
    commissionAmount: parseFloat(row.commission_amount),
    netRevenue: parseFloat(row.net_revenue),
    contributionPct: gross > 0
      ? parseFloat(((parseFloat(row.gross_revenue) / gross) * 100).toFixed(1))
      : 0,
  }));
}

// ----------------------------------------
// Daily snapshots - last N days
// ----------------------------------------

export async function getDailySnapshots(
  storeId: string,
  days: number,
): Promise<DailySnapshot[]> {
  const result = await db.query(
    `SELECT * FROM daily_snapshots
     WHERE store_id = $1
       AND date >= CURRENT_DATE - INTERVAL '${Math.min(days, 90)} days'
     ORDER BY date DESC`,
    [storeId],
  );
  return result.rows.map(rowToSnapshot);
}

// ----------------------------------------
// Top items by revenue or quantity
// ----------------------------------------

export async function getTopItems(
  storeId: string,
  from: string,
  to: string,
  limit = 10,
  sortBy: 'revenue' | 'quantity' = 'revenue',
): Promise<TopItem[]> {
  const orderCol = sortBy === 'revenue' ? 'total_revenue' : 'total_quantity';
  const result = await db.query(
    `SELECT
       menu_item_id,
       MAX(menu_item_name)   AS name,
       SUM(quantity)         AS total_quantity,
       SUM(total_price)      AS total_revenue,
       COUNT(DISTINCT order_id) AS order_count
     FROM report_order_items
     WHERE store_id = $1
       AND created_at >= $2
       AND created_at < $3
     GROUP BY menu_item_id
     ORDER BY ${orderCol} DESC
     LIMIT $4`,
    [storeId, from, to, limit],
  );

  return result.rows.map((row) => ({
    menuItemId: row.menu_item_id as string,
    name: (row.name ?? 'Unknown') as string,
    totalQuantity: parseInt(row.total_quantity, 10),
    totalRevenue: parseFloat(row.total_revenue),
    orderCount: parseInt(row.order_count, 10),
  }));
}

// ----------------------------------------
// Hourly order pattern - busiest hours
// ----------------------------------------

export async function getHourlyPattern(
  storeId: string,
  from: string,
  to: string,
): Promise<HourlyOrderPattern[]> {
  const result = await db.query(
    `SELECT
       EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC') AS hour,
       COUNT(*)                                AS total_orders,
       COALESCE(SUM(total_amount),0)           AS total_revenue
     FROM report_orders
     WHERE store_id = $1
       AND created_at >= $2
       AND created_at < $3
       AND status = 'completed'
     GROUP BY hour
     ORDER BY hour ASC`,
    [storeId, from, to],
  );

  // Fill gaps - return all 24 hours even if no data
  const map = new Map<number, HourlyOrderPattern>();
  for (const row of result.rows) {
    const h = parseInt(row.hour, 10);
    map.set(h, {
      hour: h,
      totalOrders: parseInt(row.total_orders, 10),
      totalRevenue: parseFloat(row.total_revenue),
    });
  }

  return Array.from({ length: 24 }, (_, h) => map.get(h) ?? { hour: h, totalOrders: 0, totalRevenue: 0 });
}

// ----------------------------------------
// Customer KPI report
// ----------------------------------------

export async function getCustomerKpiReport(
  storeId: string,
  from: string,
  to: string,
): Promise<CustomerKpiReport> {
  // Total, new, returning customers in period
  const result = await db.query(
    `SELECT
       COUNT(DISTINCT customer_id)                                              AS total_customers,
       COUNT(DISTINCT CASE WHEN is_first_order THEN customer_id END)            AS new_customers,
       COUNT(DISTINCT CASE WHEN NOT is_first_order THEN customer_id END) AS returning_customers
     FROM (
       SELECT
         customer_id,
         (MIN(created_at) OVER (PARTITION BY customer_id)) = created_at AS is_first_order,
         created_at
       FROM report_orders
       WHERE store_id = $1 AND customer_id IS NOT NULL AND status = 'completed'
     ) sub
     WHERE created_at >= $2 AND created_at < $3`,
    [storeId, from, to],
  );

  const row = result.rows[0];
  const total = parseInt(row.total_customers ?? '0', 10);
  const newCust = parseInt(row.new_customers ?? '0', 10);
  const returning = parseInt(row.returning_customers ?? '0', 10);
  const retention = total > 0 ? parseFloat(((returning / total) * 100).toFixed(1)) : 0;

  // Avg order value in period
  const aovResult = await db.query(
    `SELECT CASE WHEN COUNT(*) > 0
       THEN ROUND(SUM(total_amount)::numeric / COUNT(*), 2)
       ELSE 0 END AS avg_order_value
     FROM report_orders
     WHERE store_id = $1
       AND created_at >= $2 AND created_at < $3
       AND status = 'completed'`,
    [storeId, from, to],
  );

  return {
    storeId,
    from,
    to,
    totalCustomers: total,
    newCustomers: newCust,
    returningCustomers: returning,
    retentionRate: retention,
    avgOrderValue: parseFloat(aovResult.rows[0].avg_order_value ?? '0'),
    totalLoyaltyPointsIssued: 0, // populated by customer-service data in v2
    segmentBreakdown: [],         // populated by customer-service data in v2
  };
}

// ----------------------------------------
// Compute and upsert daily snapshot (called nightly by scheduler)
// ----------------------------------------

export async function computeDailySnapshot(
  storeId: string,
  date: string, // YYYY-MM-DD
): Promise<DailySnapshot> {
  const from = `${date}T00:00:00Z`;
  const to = `${date}T23:59:59.999Z`;

  const aggResult = await db.query(
    `SELECT
       COUNT(*)                                AS total_orders,
       COALESCE(SUM(total_amount), 0)           AS gross_revenue,
       COALESCE(SUM(net_revenue), 0)            AS net_revenue,
       COALESCE(SUM(tax_amount), 0)             AS total_tax,
       COALESCE(SUM(discount_amount), 0)        AS total_discount,
       COALESCE(SUM(commission_amount), 0)      AS total_commission,
       CASE WHEN COUNT(*) > 0 THEN ROUND(SUM(total_amount)::numeric / COUNT(*), 2) ELSE 0 END AS avg_order_value,
       COUNT(DISTINCT CASE WHEN is_first_order THEN customer_id END)            AS new_customers,
       COUNT(DISTINCT CASE WHEN NOT is_first_order THEN customer_id END) AS returning_customers
     FROM (
       SELECT *,
         (MIN(created_at) OVER (PARTITION BY customer_id)) = created_at AS is_first_order
       FROM report_orders
       WHERE store_id = $1 AND created_at >= $2 AND created_at <= $3 AND status = 'completed'
     ) sub`,
    [storeId, from, to],
  );

  const topItemResult = await db.query(
    `SELECT menu_item_id, MAX(menu_item_name) AS name, SUM(total_price) AS revenue
     FROM report_order_items
     WHERE store_id = $1 AND created_at >= $2 AND created_at <= $3
     GROUP BY menu_item_id
     ORDER BY revenue DESC LIMIT 1`,
    [storeId, from, to],
  );

  const agg = aggResult.rows[0];
  const topItem = topItemResult.rows[0] ?? null;

  const upsertResult = await db.query(
    `INSERT INTO daily_snapshots
       (id, store_id, date, total_orders, gross_revenue, net_revenue, total_tax,
        total_discount, total_commission, avg_order_value, new_customers, returning_customers,
        top_item_id, top_item_name, top_item_revenue)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
     ON CONFLICT (store_id, date) DO UPDATE SET
       total_orders          = EXCLUDED.total_orders,
       gross_revenue         = EXCLUDED.gross_revenue,
       net_revenue           = EXCLUDED.net_revenue,
       total_tax             = EXCLUDED.total_tax,
       total_discount        = EXCLUDED.total_discount,
       total_commission      = EXCLUDED.total_commission,
       avg_order_value       = EXCLUDED.avg_order_value,
       new_customers         = EXCLUDED.new_customers,
       returning_customers   = EXCLUDED.returning_customers,
       top_item_id           = EXCLUDED.top_item_id,
       top_item_name         = EXCLUDED.top_item_name,
       top_item_revenue      = EXCLUDED.top_item_revenue
     RETURNING *`,
    [
      generateId(),
      storeId,
      date,
      parseInt(agg.total_orders, 10),
      parseFloat(agg.gross_revenue),
      parseFloat(agg.net_revenue),
      parseFloat(agg.total_tax),
      parseFloat(agg.total_discount),
      parseFloat(agg.total_commission),
      parseFloat(agg.avg_order_value),
      parseInt(agg.new_customers ?? '0', 10),
      parseInt(agg.returning_customers ?? '0', 10),
      topItem?.menu_item_id ?? null,
      topItem?.name ?? null,
      topItem ? parseFloat(topItem.revenue) : null,
    ],
  );

  return rowToSnapshot(upsertResult.rows[0]);
}

// ----------------------------------------
// Ingest order event - called by Kafka consumer
// ----------------------------------------

export async function ingestOrder(order: {
  id: string;
  storeId: string;
  customerId?: string;
  cashierId: string;
  orderType: string;
  platform: string;
  status: string;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  commissionRate: number;
  commissionAmount: number;
  netRevenue: number;
  itemCount: number;
  completedAt?: string;
  createdAt: string;
  items?: Array<{
    id: string;
    menuItemId: string;
    menuItemName?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}): Promise<void> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO report_orders
         (id, store_id, customer_id, cashier_id, order_type, platform, status,
          total_amount, tax_amount, discount_amount, commission_rate, commission_amount,
          net_revenue, item_count, completed_at, created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       ON CONFLICT (id) DO UPDATE SET
         status              = EXCLUDED.status,
         total_amount         = EXCLUDED.total_amount,
         net_revenue          = EXCLUDED.net_revenue,
         commission_amount    = EXCLUDED.commission_amount,
         completed_at         = EXCLUDED.completed_at`,
      [
        order.id, order.storeId, order.customerId ?? null,
        order.cashierId, order.orderType, order.platform, order.status,
        order.totalAmount, order.taxAmount, order.discountAmount,
        order.commissionRate, order.commissionAmount, order.netRevenue,
        order.itemCount, order.completedAt ?? null, order.createdAt,
      ],
    );

    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        await client.query(
          `INSERT INTO report_order_items
             (id, order_id, store_id, menu_item_id, menu_item_name,
              quantity, unit_price, total_price, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           ON CONFLICT (id) DO NOTHING`,
          [
            item.id, order.id, order.storeId,
            item.menuItemId, item.menuItemName ?? null,
            item.quantity, item.unitPrice, item.totalPrice, order.createdAt,
          ],
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ----------------------------------------
// Row mapper
// ----------------------------------------

function rowToSnapshot(row: Record<string, unknown>): DailySnapshot {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    date: (row.date as Date).toISOString().slice(0, 10),
    totalOrders: row.total_orders as number,
    grossRevenue: parseFloat(row.gross_revenue as string),
    netRevenue: parseFloat(row.net_revenue as string),
    totalTax: parseFloat(row.total_tax as string),
    totalDiscount: parseFloat(row.total_discount as string),
    totalCommission: parseFloat(row.total_commission as string),
    avgOrderValue: parseFloat(row.avg_order_value as string),
    newCustomers: row.new_customers as number,
    returningCustomers: row.returning_customers as number,
    topItemId: row.top_item_id as string | undefined,
    topItemName: row.top_item_name as string | undefined,
    topItemRevenue: row.top_item_revenue ? parseFloat(row.top_item_revenue as string) : undefined,
    createdAt: row.created_at as string,
  };
}