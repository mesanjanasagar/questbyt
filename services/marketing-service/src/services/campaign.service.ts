import { db } from '../db/client';
import { config } from '../config';
import { publishEvent } from '../events/producer';
import {
  generateId,
  NotFoundError,
  ValidationError,
  buildPaginatedResponse,
  parsePagination,
} from '@pos/shared-utils';
import type {
  Campaign,
  CampaignExecution,
  CampaignStats,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  PaginatedResponse,
  PaginationQuery,
  Customer,
} from '@pos/shared-types';

// ——————————————————————————————————————————
// Template renderer — replaces {{tokens}} in message
// ——————————————————————————————————————————

export function renderTemplate(
  template: string,
  customer: { name: string; loyaltyPoints?: number },
  storeName: string,
): string {
  return template
    .replace(/\{\{customer_name\}\}/g, customer.name)
    .replace(/\{\{store_name\}\}/g, storeName)
    .replace(/\{\{points\}\}/g, String(customer.loyaltyPoints ?? 0));
}

// ——————————————————————————————————————————
// Create campaign
// ——————————————————————————————————————————

export async function createCampaign(req: CreateCampaignRequest): Promise<Campaign> {
  const id = generateId();
  const result = await db.query(
    `INSERT INTO campaigns
      (id, store_id, name, description, trigger, target_segment, from_segment,
       channel, message_template, throttle_days, status,
       campaign_type, coupon_code, discount_type, discount_value,
       max_discount, min_order_amount, valid_from, valid_until,
       max_redemptions, usage_per_customer, priority,
       applicable_branches, applicable_segments, applicable_categories, applicable_items)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
             $12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)
     RETURNING *`,
    [
      id, req.storeId, req.name, req.description ?? null,
      req.trigger ?? 'manual',
      req.targetSegment ?? null, req.fromSegment ?? null,
      req.channel ?? null, req.messageTemplate ?? null,
      req.throttleDays ?? 0,
      req.status ?? 'draft',
      req.campaignType ?? null, req.couponCode ?? null,
      req.discountType ?? null, req.discountValue ?? null,
      req.maxDiscount ?? null, req.minOrderAmount ?? null,
      req.validFrom ?? null, req.validUntil ?? null,
      req.maxRedemptions ?? null, req.usagePerCustomer ?? 1,
      req.priority ?? 0,
      JSON.stringify(req.applicableBranches ?? []),
      JSON.stringify(req.applicableSegments ?? []),
      JSON.stringify(req.applicableCategories ?? []),
      JSON.stringify(req.applicableItems ?? []),
    ],
  );
  return rowToCampaign(result.rows[0]);
}

// ——————————————————————————————————————————
// Get campaign by ID
// ——————————————————————————————————————————

export async function getCampaignById(id: string): Promise<Campaign> {
  const result = await db.query(`SELECT * FROM campaigns WHERE id = $1`, [id]);
  if (!result.rowCount || result.rowCount === 0) {
    throw new NotFoundError(`Campaign ${id} not found`);
  }
  return rowToCampaign(result.rows[0]);
}

// ——————————————————————————————————————————
// List campaigns for store
// ——————————————————————————————————————————

export async function listCampaigns(
  storeId: string,
  query: PaginationQuery & { status?: string; trigger?: string; campaignType?: string; search?: string },
): Promise<PaginatedResponse<Campaign>> {
  const { page, limit, offset } = parsePagination(query);
  const params: unknown[] = [storeId];
  let where = `WHERE store_id = $1`;

  if (query.status) {
    params.push(query.status);
    where += ` AND status = $${params.length}`;
  }
  if (query.trigger) {
    params.push(query.trigger);
    where += ` AND trigger = $${params.length}`;
  }
  if (query.campaignType) {
    params.push(query.campaignType);
    where += ` AND campaign_type = $${params.length}`;
  }
  if (query.search) {
    params.push(`%${query.search}%`);
    where += ` AND (name ILIKE $${params.length} OR coupon_code ILIKE $${params.length})`;
  }

  const countResult = await db.query(`SELECT COUNT(*) FROM campaigns ${where}`, params);
  const total = parseInt(countResult.rows[0].count, 10);

  params.push(limit, offset);
  const dataResult = await db.query(
    `SELECT * FROM campaigns ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return buildPaginatedResponse(dataResult.rows.map(rowToCampaign), total, page, limit);
}

// ——————————————————————————————————————————
// Update campaign
// ——————————————————————————————————————————

export async function updateCampaign(id: string, req: UpdateCampaignRequest): Promise<Campaign> {
  await getCampaignById(id);
  const result = await db.query(
    `UPDATE campaigns
     SET name                  = COALESCE($2,  name),
         description           = COALESCE($3,  description),
         message_template      = COALESCE($4,  message_template),
         status                = COALESCE($5,  status),
         throttle_days         = COALESCE($6,  throttle_days),
         campaign_type         = COALESCE($7,  campaign_type),
         coupon_code           = COALESCE($8,  coupon_code),
         discount_type         = COALESCE($9,  discount_type),
         discount_value        = COALESCE($10, discount_value),
         max_discount          = COALESCE($11, max_discount),
         min_order_amount      = COALESCE($12, min_order_amount),
         valid_from            = COALESCE($13, valid_from),
         valid_until           = COALESCE($14, valid_until),
         max_redemptions       = COALESCE($15, max_redemptions),
         usage_per_customer    = COALESCE($16, usage_per_customer),
         priority              = COALESCE($17, priority),
         applicable_branches   = COALESCE($18, applicable_branches),
         applicable_segments   = COALESCE($19, applicable_segments),
         applicable_categories = COALESCE($20, applicable_categories),
         applicable_items      = COALESCE($21, applicable_items),
         updated_at            = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      req.name ?? null, req.description ?? null, req.messageTemplate ?? null,
      req.status ?? null, req.throttleDays ?? null,
      req.campaignType ?? null, req.couponCode ?? null,
      req.discountType ?? null, req.discountValue ?? null,
      req.maxDiscount ?? null, req.minOrderAmount ?? null,
      req.validFrom ?? null, req.validUntil ?? null,
      req.maxRedemptions ?? null, req.usagePerCustomer ?? null,
      req.priority ?? null,
      req.applicableBranches !== undefined ? JSON.stringify(req.applicableBranches) : null,
      req.applicableSegments !== undefined ? JSON.stringify(req.applicableSegments) : null,
      req.applicableCategories !== undefined ? JSON.stringify(req.applicableCategories) : null,
      req.applicableItems !== undefined ? JSON.stringify(req.applicableItems) : null,
    ],
  );
  return rowToCampaign(result.rows[0]);
}

// ——————————————————————————————————————————
// Delete campaign (hard delete)
// ——————————————————————————————————————————

export async function deleteCampaign(id: string): Promise<void> {
  const result = await db.query(`DELETE FROM campaigns WHERE id = $1`, [id]);
  if (!result.rowCount || result.rowCount === 0) throw new NotFoundError(`Campaign ${id} not found`);
}

// ——————————————————————————————————————————
// Duplicate campaign
// ——————————————————————————————————————————

export async function duplicateCampaign(id: string): Promise<Campaign> {
  const original = await getCampaignById(id);
  return createCampaign({
    ...original,
    name: `${original.name} (Copy)`,
    status: 'draft',
    couponCode: original.couponCode ? `${original.couponCode}-COPY` : undefined,
  } as CreateCampaignRequest);
}

// ——————————————————————————————————————————
// Bulk status update
// ——————————————————————————————————————————

export async function bulkUpdateStatus(
  ids: string[],
  status: string,
): Promise<number> {
  if (ids.length === 0) return 0;
  const placeholders = ids.map((_, i) => `$${i + 2}`).join(',');
  const result = await db.query(
    `UPDATE campaigns SET status = $1, updated_at = NOW() WHERE id IN (${placeholders})`,
    [status, ...ids],
  );
  return result.rowCount ?? 0;
}

// ——————————————————————————————————————————
// Get campaign stats
// ——————————————————————————————————————————

export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  await getCampaignById(campaignId);

  const result = await db.query(
    `SELECT
       COUNT(*) FILTER (WHERE status = 'sent') AS total_sent,
       COUNT(*) FILTER (WHERE status = 'failed') AS total_failed,
       COUNT(*) FILTER (WHERE status = 'skipped') AS total_skipped,
       COUNT(*) FILTER (WHERE status = 'sent' AND created_at > NOW() - INTERVAL '30 days') AS last_30_days_sent
     FROM campaign_executions
     WHERE campaign_id = $1`,
    [campaignId],
  );

  const row = result.rows[0];
  return {
    campaignId,
    totalSent: parseInt(row.total_sent ?? '0', 10),
    totalFailed: parseInt(row.total_failed ?? '0', 10),
    totalSkipped: parseInt(row.total_skipped ?? '0', 10),
    last30DaysSent: parseInt(row.last_30_days_sent ?? '0', 10),
  };
}

// ——————————————————————————————————————————
// Get execution history for a campaign
// ——————————————————————————————————————————

export async function getExecutions(
  campaignId: string,
  query: PaginationQuery,
): Promise<PaginatedResponse<CampaignExecution>> {
  const { page, limit, offset } = parsePagination(query);

  const countResult = await db.query(
    `SELECT COUNT(*) FROM campaign_executions WHERE campaign_id = $1`,
    [campaignId],
  );
  const total = parseInt(countResult.rows[0].count, 10);

  const dataResult = await db.query(
    `SELECT * FROM campaign_executions WHERE campaign_id = $1
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
    [campaignId, limit, offset],
  );
  return buildPaginatedResponse(dataResult.rows.map(rowToExecution), total, page, limit);
}

// ——————————————————————————————————————————
// Fire all matching campaigns for a given trigger + customer
// Called by the Kafka consumer
// ——————————————————————————————————————————

export async function fireCampaigns(
  trigger: string,
  customer: Customer,
  extraContext: { fromSegment?: string } = {},
): Promise<void> {
  // Find all active campaigns for this store + trigger
  const params: unknown[] = [customer.storeId, trigger];
  let query = `
    SELECT * FROM campaigns
    WHERE store_id = $1
      AND trigger = $2
      AND status = 'active'`;

  if (extraContext.fromSegment) {
    params.push(extraContext.fromSegment);
    query += ` AND (from_segment IS NULL OR from_segment = $${params.length})`;
  }

  if (customer.segment) {
    params.push(customer.segment);
    query += ` AND (target_segment IS NULL OR target_segment = $${params.length})`;
  }

  const campaignResult = await db.query(query, params);
  if (!campaignResult.rowCount || campaignResult.rowCount === 0) return;

  for (const row of campaignResult.rows) {
    const campaign = rowToCampaign(row);
    await executeForCustomer(campaign, customer, trigger);
  }
}

// ——————————————————————————————————————————
// Manual broadcast: fire a campaign for all customers in target segment
// Manager-triggered, fetched from customer-service
// ——————————————————————————————————————————

export async function triggerManual(
  campaignId: string,
  customers: Customer[],
): Promise<{ queued: number; skipped: number }> {
  const campaign = await getCampaignById(campaignId);
  if (campaign.trigger !== 'manual') {
    throw new ValidationError('Only manual campaigns can be triggered manually');
  }

  let queued = 0;
  let skipped = 0;

  for (const customer of customers) {
    const executed = await executeForCustomer(campaign, customer, 'manual');
    if (executed) queued++;
    else skipped++;
  }

  return { queued, skipped };
}

// ——————————————————————————————————————————
// Internal: execute a single campaign for one customer
// Handles throttle check + records execution
// Returns true if message was queued, false if skipped
// ——————————————————————————————————————————

async function executeForCustomer(
  campaign: Campaign,
  customer: Customer,
  triggeredBy: string,
): Promise<boolean> {
  // Throttle check
  if (campaign.throttleDays > 0) {
    const lastSend = await db.query(
      `SELECT sent_at FROM campaign_executions
       WHERE campaign_id = $1 AND customer_id = $2 AND status = 'sent'
       ORDER BY sent_at DESC LIMIT 1`,
      [campaign.id, customer.id],
    );
    if (lastSend.rowCount && lastSend.rowCount > 0) {
      const lastSentAt = new Date(lastSend.rows[0].sent_at as string);
      const daysSince = (Date.now() - lastSentAt.getTime()) / 86_400_000;
      if (daysSince < campaign.throttleDays) {
        // Too soon — skip silently
        await db.query(
          `INSERT INTO campaign_executions
            (id, campaign_id, customer_id, store_id, channel, rendered_message, status, triggered_by)
           VALUES ($1,$2,$3,$4,$5,$6,'skipped',$7)`,
          [generateId(), campaign.id, customer.id, customer.storeId, campaign.channel ?? 'none', '', triggeredBy],
        );
        return false;
      }
    }
  }

  if (!campaign.channel || !campaign.messageTemplate) {
    return false;
  }
  const channel = campaign.channel;

  // Render message
  const rendered = renderTemplate(
    campaign.messageTemplate,
    { name: customer.name, loyaltyPoints: customer.loyaltyPoints },
    config.DEFAULT_STORE_NAME,
  );

  const execId = generateId();
  const now = new Date().toISOString();

  // In production this would call WhatsApp/Email/SMS gateway
  // For now: record as 'sent' and publish event
  await db.query(
    `INSERT INTO campaign_executions
      (id, campaign_id, customer_id, store_id, channel, rendered_message, status, triggered_by, sent_at)
     VALUES ($1,$2,$3,$4,$5,$6,'sent',$7,$8)`,
    [execId, campaign.id, customer.id, customer.storeId, channel, rendered, triggeredBy, now],
  );

  // Update campaign counters
  await db.query(
    `UPDATE campaigns SET total_sent = total_sent + 1, updated_at = NOW() WHERE id = $1`,
    [campaign.id],
  );

  publishEvent(
    'campaign.sent',
    customer.storeId,
    campaign.id,
    'campaign',
    { campaignId: campaign.id, customerId: customer.id, storeId: customer.storeId, channel, executionId: execId },
  ).catch((err) => console.warn('Failed to publish campaign.sent:', err.message));

  console.info(
    `marketing-service: [${channel.toUpperCase()}] "${campaign.name}" → ${customer.name} (${customer.id})`,
  );

  return true;
}

// ——————————————————————————————————————————
// Row mappers
// ——————————————————————————————————————————

function rowToCampaign(row: Record<string, unknown>): Campaign {
  const parseJson = (v: unknown): string[] => {
    if (!v) return [];
    if (Array.isArray(v)) return v as string[];
    try { return JSON.parse(v as string); } catch { return []; }
  };
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    trigger: (row.trigger as Campaign['trigger']) ?? 'manual',
    targetSegment: row.target_segment as string | undefined,
    fromSegment: row.from_segment as string | undefined,
    channel: row.channel as Campaign['channel'] | undefined,
    messageTemplate: row.message_template as string | undefined,
    status: row.status as Campaign['status'],
    throttleDays: (row.throttle_days as number) ?? 0,
    totalSent: (row.total_sent as number) ?? 0,
    totalFailed: (row.total_failed as number) ?? 0,
    campaignType: row.campaign_type as Campaign['campaignType'] | undefined,
    couponCode: row.coupon_code as string | undefined,
    discountType: row.discount_type as Campaign['discountType'] | undefined,
    discountValue: row.discount_value ? parseFloat(row.discount_value as string) : undefined,
    maxDiscount: row.max_discount ? parseFloat(row.max_discount as string) : undefined,
    minOrderAmount: row.min_order_amount ? parseFloat(row.min_order_amount as string) : undefined,
    validFrom: row.valid_from as string | undefined,
    validUntil: row.valid_until as string | undefined,
    maxRedemptions: row.max_redemptions as number | undefined,
    usageCount: (row.usage_count as number) ?? 0,
    usagePerCustomer: (row.usage_per_customer as number) ?? 1,
    priority: (row.priority as number) ?? 0,
    applicableBranches: parseJson(row.applicable_branches),
    applicableSegments: parseJson(row.applicable_segments),
    applicableCategories: parseJson(row.applicable_categories),
    applicableItems: parseJson(row.applicable_items),
    revenueGenerated: parseFloat((row.revenue_generated as string) ?? '0'),
    ordersCount: (row.orders_count as number) ?? 0,
    customersReached: (row.customers_reached as number) ?? 0,
    roi: parseFloat((row.roi as string) ?? '0'),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function rowToExecution(row: Record<string, unknown>): CampaignExecution {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    customerId: row.customer_id as string,
    storeId: row.store_id as string,
    channel: row.channel as CampaignExecution['channel'],
    renderedMessage: row.rendered_message as string,
    status: row.status as CampaignExecution['status'],
    errorMessage: row.error_message as string | undefined,
    triggeredBy: row.triggered_by as string,
    sentAt: row.sent_at as string | undefined,
    createdAt: row.created_at as string,
  };
}