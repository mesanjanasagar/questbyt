//
// Reporting & Analytics types
//

export interface RevenueReport {
  storeId: string;
  period: 'day' | 'week' | 'month';
  from: string;
  to: string;
  grossRevenue: number;
  netRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  totalTax: number;
  totalDiscount: number;
  totalCommission: number;
  byChannel: ChannelContribution[];
}

export interface ChannelContribution {
  channel: string; // direct | deliveroo | talabat | noon | careem
  totalOrders: number;
  grossRevenue: number;
  commissionAmount: number;
  netRevenue: number;
  contributionPct: number; // % of total gross revenue
}

export interface DailySnapshot {
  id: string;
  storeId: string;
  date: string; // YYYY-MM-DD
  totalOrders: number;
  grossRevenue: number;
  netRevenue: number;
  totalTax: number;
  totalDiscount: number;
  totalCommission: number;
  avgOrderValue: number;
  newCustomers: number;
  returningCustomers: number;
  topItemId?: string;
  topItemName?: string;
  topItemRevenue?: number;
  createdAt: string;
}

export interface TopItem {
  menuItemId: string;
  name: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
}

export interface CustomerKpiReport {
  storeId: string;
  from: string;
  to: string;
  totalCustomers: number;
  newCustomers: number;
  returningCustomers: number;
  retentionRate: number; // %
  avgOrderValue: number;
  totalLoyaltyPointsIssued: number;
  segmentBreakdown: Array<{ segment: string; count: number; pct: number }>;
}

export interface HourlyOrderPattern {
  hour: number; // 0-23
  totalOrders: number;
  totalRevenue: number;
}