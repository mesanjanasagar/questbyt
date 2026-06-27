export interface User {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  loyaltyTier: LoyaltyTier;
  loyaltyPoints: number;
  totalOrders: number;
  totalSpend: number;
  segment: CustomerSegment;
}

export type LoyaltyTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
export type CustomerSegment = 'VIP' | 'Loyal' | 'New' | 'At-Risk' | 'Churned';

export interface Transaction {
  id: string;
  orderNumber: number;
  totalAmount: number;
  pointsEarned: number;
  status: 'completed' | 'cancelled' | 'refunded';
  createdAt: string;
  items: TransactionItem[];
}

export interface TransactionItem {
  name: string;
  quantity: number;
  price: number;
}

export interface Campaign {
  id: string;
  name: string;
  message: string;
  channel: string;
  sentAt: string;
  expiresAt: string | null;
  redeemed: boolean;
}

export interface Reservation {
  id: string;
  reservedDate: string;
  reservedTime: string;
  partySize: number;
  status: 'pending' | 'confirmed' | 'arrived' | 'seated' | 'cancelled';
  tableNumber: string | null;
  notes: string | null;
}

export interface PointsHistory {
  id: string;
  type: 'earned' | 'redeemed' | 'expired' | 'bonus';
  points: number;
  description: string;
  createdAt: string;
}