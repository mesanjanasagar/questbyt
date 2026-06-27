//----------------------------------------------
// AI Manager Types
//----------------------------------------------

export type QueryIntent =
  | 'revenue.today'
  | 'revenue.week'
  | 'revenue.month'
  | 'revenue.custom'
  | 'channels.breakdown'
  | 'channels.aggregator'
  | 'top_items'
  | 'customers.segment'
  | 'customers.kpi'
  | 'customers.lapsed'
  | 'branch.comparison'
  | 'inventory.alerts'
  | 'campaign.trigger'
  | 'campaign.stats'
  | 'ai.recommendation'
  | 'help'
  | 'unknown';

export interface ParsedQuery {
  intent: QueryIntent;
  rawText: string;
  params: Record<string, string>;
}

export interface AiRecommendation {
  rank: number;
  action: string;
  reason: string;
  estimatedImpact: string;
}

export interface WhatsAppMessage {
  from: string;          // sender phone number
  text: string;
  timestamp: string;
  messageId: string;
}

export interface ConversationSession {
  phone: string;
  storeId: string;
  lastIntent?: QueryIntent;
  lastQueryAt: string;
}