import type { AiRecommendation } from '@pos/shared-types';

// ─────────────────────────────────────
// Plain-text formatter for WhatsApp replies
// No markdown — WhatsApp renders * for bold but we keep it minimal
// ─────────────────────────────────────

function aed(n: number): string {
  return `AED ${n.toLocaleString('en-AE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function pct(n: number): string {
  return `${n.toFixed(1)}%`;
}

export function formatResponse(result: Record<string, unknown>): string {
  const type = result.type as string;

  switch (type) {
    case 'revenue': {
      const period = result.period as string;
      const d = result.data as Record<string, number> | null;
      if (!d) return `No revenue data available for ${period}.`;
      return [
        `Revenue (${period})`,
        `Gross: ${aed(d.grossRevenue)}`,
        `Net: ${aed(d.netRevenue)}`,
        `Orders: ${d.totalOrders}`,
        `Avg order: ${aed(d.averageOrderValue)}`,
        `Commission paid: ${aed(d.totalCommission)}`,
        `Discount given: ${aed(d.totalDiscount)}`,
      ].join('\n');
    }

    case 'channels': {
      const channels = result.data as Array<Record<string, unknown>> | null;
      const filter = result.filterChannel as string | undefined;

      if (!channels || channels.length === 0) return 'No channel data available for this period.';

      const rows = filter
        ? channels.filter((c) => String(c.channel).includes(filter))
        : channels;

      if (rows.length === 0) return `No data found for channel: ${filter}.`;

      const lines = rows.map((c) =>
        `${String(c.channel).toUpperCase()}: ${aed(c.grossRevenue as number)} gross | ${aed(c.netRevenue as number)} net | ${pct(c.contributionPct as number)} share | Commission: ${aed(c.commissionAmount as number)}`
      );
      return ['Channel Breakdown (last 30 days)', ...lines].join('\n');
    }

    case 'top_items': {
      const items = result.data as Array<Record<string, unknown>> | null;
      if (!items || items.length === 0) return 'No item data available for this period.';
      const lines = items.map((item, i) =>
        `${i + 1}. ${item.name} — ${aed(item.totalRevenue as number)} (${item.totalQuantity} sold)`
      );
      return ['Top 5 Items (last 30 days)', ...lines].join('\n');
    }

    case 'segments': {
      const d = result.data as Record<string, number> | null;
      if (!d) return 'No customer segment data available.';
      return [
        `Customer Segments`,
        `Total: ${d.total ?? 0}`,
        `New: ${d.new ?? 0}`,
        `Active: ${d.active ?? 0}`,
        `At-Risk: ${d.at_risk ?? 0}`,
        `Churned: ${d.churned ?? 0}`,
        `Lapsed: ${d.lapsed ?? 0}`,
        `VIP: ${d.vip ?? 0}`,
      ].join('\n');
    }

    case 'lapsed': {
      const counts = result.counts as Record<string, number> | null;
      const lapsedTotal = (counts?.lapsed ?? 0) + (counts?.churned ?? 0);
      return [
        `Lapsed Customers`,
        `Total lapsed/churned: ${lapsedTotal}`,
        lapsedTotal > 0
          ? `Tip: Send a win-back campaign — reply "send win-back campaign" to trigger it.`
          : 'No lapsed customers at this time.',
      ].join('\n');
    }

    case 'customer_kpi': {
      const d = result.data as Record<string, number> | null;
      if (!d) return 'No customer KPI data available.';
      return [
        `Customer KPIs (last 30 days)`,
        `Total customers: ${d.totalCustomers}`,
        `New: ${d.newCustomers}`,
        `Returning: ${d.returningCustomers}`,
        `Retention rate: ${pct(d.retentionRate)}`,
        `Avg order value: ${aed(d.avgOrderValue)}`,
      ].join('\n');
    }

    case 'inventory_alerts': {
      const alerts = result.data as Array<Record<string, unknown>> | null;
      if (!alerts || alerts.length === 0) return 'No low-stock alerts. All inventory levels are healthy.';
      const lines = alerts.map((a) => `- Product ${a.productId}: stock at ${a.alertLevel}`);
      return [`${alerts.length} Low-Stock Alert(s)`, ...lines, `\nReply "acknowledge alert" or restock via the POS dashboard.`].join('\n');
    }

    case 'campaign_stats': {
      const campaigns = result.data as { data?: Array<Record<string, unknown>> } | null;
      const list = campaigns?.data ?? [];
      if (list.length === 0) return 'No active campaigns found. Reply "help" to learn how to create one.';
      const lines = list.map((c) => `- ${c.name}: ${c.totalSent} sent | ${c.status}`);
      return ['Active Campaigns', ...lines].join('\n');
    }

    case 'branch_comparison': {
      const snapshots = result.data as Array<Record<string, unknown>> | null;
      if (!snapshots || snapshots.length === 0) return 'No branch data available yet.';
      const latest = snapshots[0];
      return [
        `Branch Report (last 7 days)`,
        `Total orders: ${latest.totalOrders}`,
        `Gross revenue: ${aed(latest.grossRevenue as number)}`,
        `Avg order: ${aed(latest.avgOrderValue as number)}`,
        `Note: Multi-branch comparison available in dashboard.`,
      ].join('\n');
    }

    case 'recommendation': {
      // Populated separately by recommendation engine
      return '';
    }

    case 'help':
      return [
        'What can I help you with?',
        '',
        'Revenue:',
        '  "revenue today"',
        '  "revenue this week"',
        '  "revenue this month"',
        '',
        'Channels:',
        '  "channel breakdown"',
        '  "deliveroo commission"',
        '',
        'Customers:',
        '  "show lapsed customers"',
        '  "customer segments"',
        '  "customer KPIs"',
        '',
        'Items:',
        '  "top items"',
        '  "best sellers"',
        '',
        'Inventory:',
        '  "low stock alerts"',
        '',
        'AI Advice:',
        '  "how can I increase revenue?"',
        '  "what should I do?"',
      ].join('\n');

    default:
      return [
        "I didn't understand that. Here are some things you can ask:",
        '',
        '"revenue today" | "top items" | "channel breakdown"',
        '"lapsed customers" | "low stock alerts"',
        '"how can I increase revenue?"',
        '',
        'Reply "help" for the full menu.',
      ].join('\n');
  }
}

export function formatRecommendations(recs: AiRecommendation[]): string {
  const lines = recs.map(
    (r) => `${r.rank}. ${r.action}\n   Why: ${r.reason}\n   Impact: ${r.estimatedImpact}`
  );
  return ['AI Recommendations', '', ...lines].join('\n');
}