export type CustomerSegment = 'VIP' | 'Loyal' | 'At-Risk' | 'Churned' | 'New';
export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Customer {
  id: string;
  storeId: string;
  name: string;
  email: string | null;
  phone: string | null;
  segment: CustomerSegment;
  loyaltyTier: LoyaltyTier;
  loyaltyPoints: number;
  totalSpend: number;
  totalOrders: number;
  lastOrderAt: string | null;
  churnScore: number | null;
  riskLevel: RiskLevel | null;
  createdAt: string;
}

export interface SegmentSummary {
  segment: CustomerSegment;
  count: number;
  percentage: number;
  avgSpend: number;
  avgOrders: number;
}

export interface TierSummary {
  tier: LoyaltyTier;
  count: number;
  percentage: number;
  totalPoints: number;
}

export interface ChurnScore {
  customerId: string;
  storeId: string;
  churnScore: number;
  riskLevel: RiskLevel;
  lastOrderDays: number | null;
  frequencyTrend: number;
  avgOrderValueTrend: number;
  calculatedAt: string;
}

export interface Campaign {
  id: string;
  storeId: string;
  name: string;
  type: string;
  channel: string;
  targetSegment: CustomerSegment;
  status: 'draft' | 'active' | 'paused' | 'completed';
  sentCount: number;
  deliveredCount: number;
  openRate: number;
  clickRate: number;
  revenue: number;
  createdAt: string;
  scheduledAt: string | null;
  completedAt: string | null;
}

export interface CampaignPerformance {
  campaignId: string;
  name: string;
  sentCount: number;
  deliveredCount: number;
  deliveredRate: number;
  openRate: number;
  clickRate: number;
  revenueGenerated: number;
  roi: number;
}

export interface DashboardMetrics {
  totalCustomers: number;
  newThisMonth: number;
  atRisk: number;
  churned: number;
  vip: number;
  avgLifetimeValue: number;
  activeSegments: SegmentSummary[];
  tierDistribution: TierSummary[];
}