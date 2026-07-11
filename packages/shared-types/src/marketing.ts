//
// Marketing Automation types
//

export type CampaignTrigger =
  | 'customer.created'          // New signup
  | 'customer.segment_changed'  // Segment transition (e.g. active -> at_risk)
  | 'customer.points_earned'    // Loyalty milestone
  | 'manual';                   // Manager-triggered broadcast

export type CampaignChannel = 'whatsapp' | 'email' | 'sms' | 'push';

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'active'
  | 'paused'
  | 'completed'
  | 'expired'
  | 'archived';

export type CampaignType =
  | 'percentage_discount'
  | 'fixed_discount'
  | 'bogo'
  | 'free_item'
  | 'loyalty_reward'
  | 'birthday'
  | 'first_order'
  | 'win_back'
  | 'churn_recovery'
  | 'seasonal'
  | 'festival'
  | 'coupon';

export type ExecutionStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export interface Campaign {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  // Promo/discount fields
  campaignType?: CampaignType;
  couponCode?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  maxDiscount?: number;
  minOrderAmount?: number;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
  usageCount: number;
  usagePerCustomer: number;
  priority: number;
  applicableBranches: string[];
  applicableSegments: string[];
  applicableCategories: string[];
  applicableItems: string[];
  revenueGenerated: number;
  ordersCount: number;
  customersReached: number;
  roi: number;
  // Legacy messaging automation fields
  trigger: CampaignTrigger;
  targetSegment?: string;
  fromSegment?: string;
  channel?: CampaignChannel;
  messageTemplate?: string;
  throttleDays: number;
  totalSent: number;
  totalFailed: number;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignRequest {
  storeId: string;
  name: string;
  description?: string;
  campaignType?: CampaignType;
  couponCode?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  maxDiscount?: number;
  minOrderAmount?: number;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
  usagePerCustomer?: number;
  priority?: number;
  applicableBranches?: string[];
  applicableSegments?: string[];
  applicableCategories?: string[];
  applicableItems?: string[];
  // Legacy
  trigger?: CampaignTrigger;
  targetSegment?: string;
  fromSegment?: string;
  channel?: CampaignChannel;
  messageTemplate?: string;
  throttleDays?: number;
  status?: CampaignStatus;
}

export interface UpdateCampaignRequest {
  name?: string;
  description?: string;
  campaignType?: CampaignType;
  couponCode?: string;
  discountType?: 'percentage' | 'fixed';
  discountValue?: number;
  maxDiscount?: number;
  minOrderAmount?: number;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
  usagePerCustomer?: number;
  priority?: number;
  applicableBranches?: string[];
  applicableSegments?: string[];
  applicableCategories?: string[];
  applicableItems?: string[];
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
  triggeredBy: string;
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
