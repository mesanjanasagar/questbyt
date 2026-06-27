import { config } from '../config';
import type { AiRecommendation } from '@pos/shared-types';

interface ServiceData {
  segments?: Record<string, number>;
  channels?: Array<{ channel: string; netRevenue: number; commissionAmount: number; grossRevenue: number }>;
  alerts?: unknown[];
  revenue?: { grossRevenue: number; netRevenue: number; totalOrders: number };
}

// ─────────────────────────────────────
// Fetch data needed to rank recommendations
// ─────────────────────────────────────

async function fetchContext(storeId: string): Promise<ServiceData> {
  const custBase = config.CUSTOMER_SERVICE_URL;
  const repBase = config.REPORTING_SERVICE_URL;
  const invBase = config.INVENTORY_SERVICE_URL;

  const now = new Date();
  const from = new Date(now); from.setDate(from.getDate() - 30); from.setHours(0,0,0,0);

  const [segRes, chanRes, alertRes, revRes] = await Promise.allSettled([
    fetch(`${custBase}/api/v1/customers/segments?storeId=${storeId}`, { headers: { 'X-Internal-Service': 'ai-manager-service' } }),
    fetch(`${repBase}/api/v1/reports/channels?storeId=${storeId}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(now.toISOString())}`, { headers: { 'X-Internal-Service': 'ai-manager-service' } }),
    fetch(`${invBase}/api/v1/inventory/alerts?storeId=${storeId}&status=pending`, { headers: { 'X-Internal-Service': 'ai-manager-service' } }),
    fetch(`${repBase}/api/v1/reports/revenue?storeId=${storeId}&from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(now.toISOString())}&period=month`, { headers: { 'X-Internal-Service': 'ai-manager-service' } }),
  ]);

  const safe = async (res: PromiseSettledResult<Response>) => {
    if (res.status === 'rejected') return null;
    try { const j = await res.value.json() as { data?: unknown }; return j.data; } catch { return null; }
  };

  return {
    segments: (await safe(segRes)) as Record<string, number> | undefined,
    channels: (await safe(chanRes)) as ServiceData['channels'],
    alerts: (await safe(alertRes)) as unknown[] | undefined,
    revenue: (await safe(revRes)) as ServiceData['revenue'],
  };
}

// ─────────────────────────────────────
// Rule-based recommendation engine
// Each rule evaluates context and returns a recommendation with estimated impact
// Sorted by estimated AED impact descending
// ─────────────────────────────────────

export async function generateRecommendations(storeId: string): Promise<AiRecommendation[]> {
  const ctx = await fetchContext(storeId);
  const recommendations: Array<AiRecommendation & { score: number }> = [];
  let rank = 0;

  // Rule 1: High at-risk customers → trigger retention campaign
  const atRisk = ctx.segments?.at_risk ?? 0;
  if (atRisk > 0) {
    const avgOrderVal = ctx.revenue?.grossRevenue && ctx.revenue.totalOrders
      ? ctx.revenue.grossRevenue / ctx.revenue.totalOrders
      : 50;
    const impact = Math.round(atRisk * avgOrderVal * 0.3);
    recommendations.push({
      rank: ++rank,
      score: impact,
      action: `Send retention offer to ${atRisk} at-risk customers`,
      reason: `${atRisk} customers haven't ordered in 7-14 days and are close to churning`,
      estimatedImpact: `+AED ${impact.toLocaleString()} if 30% re-engage`,
    });
  }

  // Rule 2: High lapsed customers → win-back campaign
  const lapsed = (ctx.segments?.lapsed ?? 0) + (ctx.segments?.churned ?? 0);
  if (lapsed > 10) {
    const impact = Math.round(lapsed * 30 * 0.1); // 10% recovery at AED 30 avg
    recommendations.push({
      rank: ++rank,
      score: impact,
      action: `Launch win-back campaign for ${lapsed} lapsed customers`,
      reason: `${lapsed} customers have not ordered in 30+ days — a discount offer can recover 10%`,
      estimatedImpact: `+AED ${impact.toLocaleString()} potential recovery`,
    });
  }

  // Rule 3: Aggregator commission eating margin
  const aggChannels = (ctx.channels ?? []).filter(
    (c) => c.channel !== 'direct' && c.commissionAmount > 0,
  );
  for (const ch of aggChannels) {
    const commissionPct = ch.grossRevenue > 0
      ? Math.round((ch.commissionAmount / ch.grossRevenue) * 100)
      : 0;
    if (commissionPct > 20) {
      const saving = Math.round(ch.commissionAmount * 0.15); // 15% shift to direct
      recommendations.push({
        rank: ++rank,
        score: saving,
        action: `Promote direct ordering to ${ch.channel} customers`,
        reason: `${ch.channel} is charging ${commissionPct}% commission — shifting 15% to direct saves AED ${saving.toLocaleString()}/month`,
        estimatedImpact: `+AED ${saving.toLocaleString()}/month in saved commission`,
      });
    }
  }

  // Rule 4: Low stock alerts outstanding
  const alertCount = (ctx.alerts as unknown[] ?? []).length;
  if (alertCount > 0) {
    recommendations.push({
      rank: ++rank,
      score: alertCount * 100,
      action: `Restock ${alertCount} low-stock items before next peak`,
      reason: `${alertCount} items are below reorder level — stockouts during peak hours lose orders`,
      estimatedImpact: `Prevent revenue loss during peak service`,
    });
  }

  // Rule 5: High new-customer ratio → loyalty onboarding
  const newCust = ctx.segments?.new ?? 0;
  const total = Object.values(ctx.segments ?? {}).reduce((a, b) => a + b, 0);
  if (total > 0 && newCust / total > 0.3) {
    recommendations.push({
      rank: ++rank,
      score: newCust * 20,
      action: `Enrol new customers in loyalty programme via WhatsApp`,
      reason: `${newCust} new customers (${Math.round((newCust / total) * 100)}%) haven't been introduced to loyalty yet`,
      estimatedImpact: `+${Math.round(newCust * 0.4)} repeat visits if 40% enrol`,
    });
  }

  // Default fallback
  if (recommendations.length === 0) {
    recommendations.push({
      rank: 1,
      score: 0,
      action: 'Review your top-selling items and promote them on aggregators',
      reason: 'No specific issues detected — focus on menu visibility and upselling',
      estimatedImpact: 'Incremental revenue growth',
    });
  }

  // Sort by score descending, re-assign rank
  return recommendations
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({ rank: i + 1, action: r.action, reason: r.reason, estimatedImpact: r.estimatedImpact }));
}