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
       channel, message_template, throttle_days)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING *`,
    [
      id,
      req.storeId,
      req.name,
      req.description ?? null,
      req.trigger,
      req.targetSegment ?? null,
      req.fromSegment ?? null,
      req.channel,
      req.messageTemplate,
      req.throttleDays ?? 0,
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
  query: PaginationQuery & { status?: string; trigger?: string },
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
     SET name             = COALESCE($2, name),
         description      = COALESCE($3, description),
         message_template = COALESCE($4, message_template),
         status           = COALESCE($5, status),
         throttle_days    = COALESCE($6, throttle_days),
         updated_at       = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, req.name ?? null, req.description ?? null, req.messageTemplate ?? null, req.status ?? null, req.throttleDays ?? null],
  );
  return rowToCampaign(result.rows[0]);
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
          [generateId(), campaign.id, customer.id, customer.storeId, campaign.channel, '', triggeredBy],
        );
        return false;
      }
    }
  }

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
    [execId, campaign.id, customer.id, customer.storeId, campaign.channel, rendered, triggeredBy, now],
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
    { campaignId: campaign.id, customerId: customer.id, storeId: customer.storeId, channel: campaign.channel, executionId: execId },
  ).catch((err) => console.warn('Failed to publish campaign.sent:', err.message));

  console.info(
    `marketing-service: [${campaign.channel.toUpperCase()}] "${campaign.name}" → ${customer.name} (${customer.id})`,
  );

  return true;
}

// ——————————————————————————————————————————
// Row mappers
// ——————————————————————————————————————————

function rowToCampaign(row: Record<string, unknown>): Campaign {
  return {
    id: row.id as string,
    storeId: row.store_id as string,
    name: row.name as string,
    description: row.description as string | undefined,
    trigger: row.trigger as Campaign['trigger'],
    targetSegment: row.target_segment as string | undefined,
    fromSegment: row.from_segment as string | undefined,
    channel: row.channel as Campaign['channel'],
    messageTemplate: row.message_template as string,
    status: row.status as Campaign['status'],
    throttleDays: row.throttle_days as number,
    totalSent: row.total_sent as number,
    totalFailed: row.total_failed as number,
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