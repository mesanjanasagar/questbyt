//  ─────────────────────────────────────────────────────────────────────────────
// Customer, Loyalty & CRM types
//  ─────────────────────────────────────────────────────────────────────────────

export type CustomerSegment = 'new' | 'active' | 'at_risk' | 'churned' | 'vip' | 'lapsed';

export interface Customer {
  id: string;
  storeId: string;
  name: string;
  phone?: string;
  email?: string;
  loyaltyPoints: number;
  loyaltyTier: 'silver' | 'gold' | 'platinum';
  segment: CustomerSegment;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastOrderAt?: string;
  firstOrderAt?: string;
  daysSinceLastOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCustomerRequest {
  storeId: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  phone?: string;
  email?: string;
}

export interface LoyaltyLedger {
  id: string;
  customerId: string;
  storeId: string;
  orderId: string;
  pointsEarned: number;
  pointsRedeemed: number;
  balance: number;
  description: string;
  createdAt: string;
}

export interface CustomerOrderSummary {
  customerId: string;
  totalOrders: number;
  totalSpend: number;
  averageOrderValue: number;
  lastOrderAt?: string;
  firstOrderAt?: string;
}

export interface SegmentCounts {
  new: number;
  active: number;
  at_risk: number;
  churned: number;
  vip: number;
  lapsed: number;
  total: number;
}