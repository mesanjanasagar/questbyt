export interface StoreMetrics {
  storeId: string;
  storeName: string;
  ordersToday: number;
  revenueToday: number;
  avgOrderValue: number;
  customerCount: number;
  ordersInProgress: number;
  ordersCompleted: number;
  ordersCancelled: number;
}

export interface RevenuePoint {
  label: string;
  revenue: number;
  orders: number;
}

export interface InventoryAlert {
  id: string;
  productId: string;
  productName: string;
  storeId: string;
  currentStock: number;
  reorderLevel: number;
  status: 'low_stock' | 'out_of_stock';
  createdAt: string;
}

export interface StaffSummary {
  date: string;
  storeId: string;
  recommendedStaffCount: number;
  forecastedOrders: number;
  shiftType: string;
}

export interface ChurnAlert {
  customersAtRisk: number;
  customersChurned: number;
  criticalCount: number;
  weeklyChange: number;
}

export interface CampaignROI {
  campaignId: string;
  name: string;
  roi: number;
  revenueGenerated: number;
  sentCount: number;
}
