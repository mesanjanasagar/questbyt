//
// Marketing Automation types
//

export type CampaignTrigger =
  | 'customer.created'          // New signup
  | 'customer.segment_changed'  // Segment transition (e.g. active -> at_risk)
  | 'customer.points_earned'    // Loyalty milestone
  | 'manual';                   // Manager-triggered broadcast

export type CampaignChannel = 'whatsapp' | 'email' | 'sms' | 'push';

export type CampaignStatus = 'active' | 'paused' | 'archived';

export type ExecutionStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export interface Campaign {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  trigger: CampaignTrigger;
  // Trigger condition: only fire if segment matches this value (optional)
  targetSegment?: string;
  // Trigger condition: only fire if previous segment matches (for segment_changed)
  fromSegment?: string;
  channel: CampaignChannel;
  messageTemplate: string; // Supports {{customer_name}}, {{store_name}}, {{points}} tokens
  status: CampaignStatus;
  // Throttle: don't send to same customer more often than N days (0 = no throttle)
  throttleDays: number;
  totalSent: number;
  totalFailed: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignRequest {
  storeId: string;
  name: string;
  description?: string;
  trigger: CampaignTrigger;
  targetSegment?: string;
  fromSegment?: string;
  channel: CampaignChannel;
  messageTemplate: string;
  throttleDays?: number;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  messageTemplate?: string;
  status?: CampaignStatus;
  throttleDays?: number;
}

export interface CampaignExecution {
  id: string;
  campaignId: string;
  customerId: string;
  storeId: string;
  channel: CampaignChannel;
  renderedMessage: string;
  status: ExecutionStatus;
  errorMessage?: string;
  triggeredBy: string; // event type or 'manual'
  sentAt?: string;
  createdAt: string;
}

export interface CampaignStats {
  campaignId: string;
  totalSent: number;
  totalFailed: number;
  totalSkipped: number;
  last30DaysSent: number;
}