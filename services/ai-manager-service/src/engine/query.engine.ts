import { config } from '../config';
import type { ParsedQuery } from '@pos/shared-types';

// ─────────────────────────────────────
// Internal fetch helper with service header
// ─────────────────────────────────────

async function serviceGet<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'X-Internal-Service': 'ai-manager-service' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: T };
    return json.data ?? null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────
// Date helpers
// ─────────────────────────────────────

function todayRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setHours(0, 0, 0, 0);
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);
  return { from: from.toISOString(), to: to.toISOString() };
}

function weekRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 7);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: now.toISOString() };
}

function monthRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  return { from: from.toISOString(), to: now.toISOString() };
}

// ─────────────────────────────────────
// Query handlers — one per intent
// Each returns a raw data object that the formatter will render
// ─────────────────────────────────────

export async function executeQuery(
  query: ParsedQuery,
  storeId: string,
): Promise<Record<string, unknown>> {
  const base = config.REPORTING_SERVICE_URL;
  const custBase = config.CUSTOMER_SERVICE_URL;
  const invBase = config.INVENTORY_SERVICE_URL;

  switch (query.intent) {
    case 'revenue.today': {
      const { from, to } = todayRange();
      const data = await serviceGet(`${base}/api/v1/reports/revenue?storeId=${storeId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&period=day`);
      return { type: 'revenue', period: 'today', data };
    }

    case 'revenue.week': {
      const { from, to } = weekRange();
      const data = await serviceGet(`${base}/api/v1/reports/revenue?storeId=${storeId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&period=week`);
      return { type: 'revenue', period: 'this week', data };
    }

    case 'revenue.month': {
      const { from, to } = monthRange();
      const data = await serviceGet(`${base}/api/v1/reports/revenue?storeId=${storeId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&period=month`);
      return { type: 'revenue', period: 'this month', data };
    }

    case 'channels.breakdown':
    case 'channels.aggregator': {
      const { from, to } = monthRange();
      const data = await serviceGet(`${base}/api/v1/reports/channels?storeId=${storeId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      const filterChannel = query.params.channel;
      return { type: 'channels', filterChannel, data };
    }

    case 'top_items': {
      const { from, to } = monthRange();
      const data = await serviceGet(`${base}/api/v1/reports/top-items?storeId=${storeId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=5`);
      return { type: 'top_items', data };
    }

    case 'customers.segment': {
      const data = await serviceGet(`${custBase}/api/v1/customers/segments?storeId=${storeId}`);
      return { type: 'segments', data };
    }

    case 'customers.lapsed': {
      const data = await serviceGet(`${custBase}/api/v1/customers?storeId=${storeId}&segment=lapsed&limit=5`);
      const counts = await serviceGet(`${custBase}/api/v1/customers/segments?storeId=${storeId}`);
      return { type: 'lapsed', data, counts };
    }

    case 'customers.kpi': {
      const { from, to } = monthRange();
      const data = await serviceGet(`${base}/api/v1/reports/customers?storeId=${storeId}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
      return { type: 'customer_kpi', data };
    }

    case 'inventory.alerts': {
      const data = await serviceGet(`${invBase}/api/v1/inventory/alerts?storeId=${storeId}&status=pending`);
      return { type: 'inventory_alerts', data };
    }

    case 'campaign.stats': {
      const mktBase = config.MARKETING_SERVICE_URL;
      const data = await serviceGet(`${mktBase}/api/v1/campaigns?storeId=${storeId}&status=active&limit=5`);
      return { type: 'campaign_stats', data };
    }

    case 'branch.comparison': {
      // Returns daily snapshot data; branch-level breakdown is a v2 feature
      const data = await serviceGet(`${base}/api/v1/reports/daily?storeId=${storeId}&days=7`);
      return { type: 'branch_comparison', data };
    }

    case 'ai.recommendation':
      // Handled separately in recommendation engine
      return { type: 'recommendation', storeId };

    case 'help':
      return { type: 'help' };

    default:
      return { type: 'unknown', rawText: query.rawText };
  }
}