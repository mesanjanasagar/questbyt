import type { ParsedQuery, QueryIntent } from '@pos/shared-types';

// ─────────────────────────────────────
// Intent detection rules — ordered by specificity
// Each rule: regex patterns to match against lowercased input
// ─────────────────────────────────────

interface IntentRule {
  intent: QueryIntent;
  patterns: RegExp[];
}

const INTENT_RULES: IntentRule[] = [
  // Help / menu
  {
    intent: 'help',
    patterns: [/\bhelp\b/, /\bmenu\b/, /\bwhat can you do\b/, /\bcommands\b/, /^\?$/],
  },

  // Revenue — time scoped
  {
    intent: 'revenue.today',
    patterns: [/\btoday\b/, /\btoday.s (revenue|sales|earning)/i, /\bhow much.*(today|so far)/i],
  },
  {
    intent: 'revenue.week',
    patterns: [/\bthis week\b/, /\bweekly (revenue|sales)/i, /\blast 7 days\b/],
  },
  {
    intent: 'revenue.month',
    patterns: [/\bthis month\b/, /\bmonthly (revenue|sales)/i, /\blast 30 days\b/],
  },

  // General revenue (fallback)
  {
    intent: 'revenue.today',
    patterns: [/\brevenue\b/, /\bsales\b/, /\bearnings?\b/, /\bhow much (did|have) (we|i)/i],
  },

  // Channels / aggregators
  {
    intent: 'channels.aggregator',
    patterns: [
      /\bdeliveroo\b/, /\btalabat\b/, /\bnoon\b/, /\bcareem\b/, /\bhunger station\b/,
      /\baggregator\b/, /\bcommission\b/, /\bplatform (cost|fee|breakdown)/i,
    ],
  },
  {
    intent: 'channels.breakdown',
    patterns: [/\bchannel\b/, /\bbreakdown\b/, /\bdirect vs\b/, /\bsplit\b/],
  },

  // Top items
  {
    intent: 'top_items',
    patterns: [
      /\bbest seller/i, /\btop (item|dish|product|selling)/i,
      /\bmost (popular|ordered|sold)/i, /\bwhat.*(selling|popular)/i,
    ],
  },

  // Customers — segment specific
  {
    intent: 'customers.lapsed',
    patterns: [/\blapsed\b/, /\binactive customer/i, /\bnot ordered/i, /\bwin.back/i],
  },
  {
    intent: 'customers.segment',
    patterns: [
      /\bat.risk\b/, /\bchurned\b/, /\bactive customer/i, /\bvip\b/,
      /\bsegment\b/, /\bretention\b/,
    ],
  },
  {
    intent: 'customers.kpi',
    patterns: [/\bcustomer\b/, /\bnew customer/i, /\bhow many (customer|people|buyer)/i],
  },

  // Branch comparison
  {
    intent: 'branch.comparison',
    patterns: [/\bbranch\b/, /\blocation\b/, /\bunderperform/i, /\bworst (branch|location)/i],
  },

  // Inventory alerts
  {
    intent: 'inventory.alerts',
    patterns: [/\blow stock\b/, /\binventory\b/, /\bstock alert/i, /\brunning out/i, /\breorder\b/],
  },

  // Campaign management
  {
    intent: 'campaign.trigger',
    patterns: [/\bsend (campaign|message|offer)/i, /\btrigger (campaign|blast)/i, /\bbroadcast\b/],
  },
  {
    intent: 'campaign.stats',
    patterns: [/\bcampaign (stat|result|performance)/i, /\bhow many (message|sms|whatsapp) sent/i],
  },

  // AI recommendation
  {
    intent: 'ai.recommendation',
    patterns: [
      /\bhow (can|do|should) (i|we) (increase|grow|boost|improve)/i,
      /\brecommend/i, /\bwhat should (i|we) do/i,
      /\btips?\b/, /\bsuggestion/i, /\badvice\b/,
    ],
  },
];

// ─────────────────────────────────────
// Parse a raw message → intent + params
// ─────────────────────────────────────

export function parseQuery(rawText: string): ParsedQuery {
  const lower = rawText.toLowerCase().trim();
  const params: Record<string, string> = {};

  // Extract any explicit channel name
  const channelMatch = lower.match(/\b(deliveroo|talabat|noon|careem|hunger station|direct)\b/);
  if (channelMatch) params.channel = channelMatch[1];

  // Extract segment name
  const segmentMatch = lower.match(/\b(new|active|at.risk|churned|vip|lapsed)\b/);
  if (segmentMatch) params.segment = segmentMatch[1].replace('-', '_');

  // Detect intent
  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((p) => p.test(lower))) {
      return { intent: rule.intent, rawText, params };
    }
  }

  return { intent: 'unknown', rawText, params };
}