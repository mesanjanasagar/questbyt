import api from './client';
import { StoreMetrics, RevenuePoint, InventoryAlert, StaffSummary, ChurnAlert, CampaignROI } from '../types';

// — Mock data ————————————————————————————————————————
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
const addDays = (d: number) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  return dt.toISOString().split('T')[0];
};
const dayLabel = (daysOffset: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysOffset);
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric' });
};

const MOCK_STORES: StoreMetrics[] = [
  { storeId: 'store-1', storeName: 'Downtown Branch', ordersToday: 142, revenueToday: 5603.40,
    avgOrderValue: 39.46, customerCount: 118, ordersInProgress: 8, ordersCompleted: 129, ordersCancelled: 5 },
  { storeId: 'store-2', storeName: 'Marina Branch', ordersToday: 98, revenueToday: 3851.60,
    avgOrderValue: 39.30, customerCount: 85, ordersInProgress: 5, ordersCompleted: 90, ordersCancelled: 3 },
  { storeId: 'store-3', storeName: 'JBR Branch', ordersToday: 73, revenueToday: 2688.70,
    avgOrderValue: 36.83, customerCount: 62, ordersInProgress: 4, ordersCompleted: 67, ordersCancelled: 2 },
];

const buildRevenue7d = (): RevenuePoint[] =>
  Array.from({ length: 7 }, (_, i) => ({
    label: dayLabel(6 - i),
    revenue: 4000 + Math.random() * 4000,
    orders: 80 + Math.floor(Math.random() * 120),
  }));

const buildRevenue30d = (): RevenuePoint[] =>
  Array.from({ length: 30 }, (_, i) => ({
    label: `${i + 1}`,
    revenue: 3500 + Math.random() * 5000,
    orders: 70 + Math.floor(Math.random() * 150),
  }));

const buildRevenue90d = (): RevenuePoint[] =>
  Array.from({ length: 12 }, (_, i) => ({
    label: `Week ${i + 1}`,
    revenue: 24000 + Math.random() * 20000,
    orders: 480 + Math.floor(Math.random() * 600),
  }));

const MOCK_REVENUE: Record<string, RevenuePoint[]> = {
  '7d': buildRevenue7d(),
  '30d': buildRevenue30d(),
  '90d': buildRevenue90d(),
};

const MOCK_INVENTORY: InventoryAlert[] = [
  { id: 'ia-1', productId: 'prod-1', productName: 'Beef Patties (200g)', storeId: 'store-1',
    currentStock: 12, reorderLevel: 50, status: 'low_stock', createdAt: daysAgo(1) },
  { id: 'ia-2', productId: 'prod-2', productName: 'Burger Buns', storeId: 'store-1',
    currentStock: 0, reorderLevel: 100, status: 'out_of_stock', createdAt: daysAgo(0) },
  { id: 'ia-3', productId: 'prod-3', productName: 'Mozzarella Cheese', storeId: 'store-2',
    currentStock: 8, reorderLevel: 30, status: 'low_stock', createdAt: daysAgo(2) },
  { id: 'ia-4', productId: 'prod-4', productName: 'Lettuce Heads', storeId: 'store-3',
    currentStock: 3, reorderLevel: 20, status: 'low_stock', createdAt: daysAgo(0) },
  { id: 'ia-5', productId: 'prod-5', productName: 'Bacon Strips', storeId: 'store-1',
    currentStock: 0, reorderLevel: 40, status: 'out_of_stock', createdAt: daysAgo(0) },
];

const MOCK_STAFF: StaffSummary[] = Array.from({ length: 7 }, (_, i) => ({
  date: addDays(i),
  storeId: 'store-1',
  recommendedStaffCount: 6 + Math.floor(Math.random() * 6),
  forecastedOrders: 90 + Math.floor(Math.random() * 100),
  shiftType: i === 0 || i === 6 ? 'weekend' : 'weekday',
}));

const MOCK_CHURN_ALERT: ChurnAlert = {
  customersAtRisk: 891,
  customersChurned: 1204,
  criticalCount: 47,
  weeklyChange: 12,
};

const MOCK_CAMPAIGNS: CampaignROI[] = [
  { campaignId: 'camp-2', name: 'VIP Weekend Special', roi: 312, revenueGenerated: 72400, sentCount: 1156 },
  { campaignId: 'camp-1', name: 'Summer Loyalty Reward', roi: 248, revenueGenerated: 48200, sentCount: 3982 },
  { campaignId: 'camp-4', name: 'New Customer Welcome', roi: 189, revenueGenerated: 8900, sentCount: 342 },
  { campaignId: 'camp-3', name: 'Win-back At-Risk', roi: 94, revenueGenerated: 12800, sentCount: 891 },
  { campaignId: 'camp-5', name: 'Churned Re-engagement', roi: 42, revenueGenerated: 4200, sentCount: 600 },
];

// — API ————————————————————————————————————————————————
export const dashboardAPI = {
  getStoreMetrics: async (storeId?: string): Promise<StoreMetrics[]> => {
    if (storeId) {
      try {
        const [today, profile] = await Promise.all([
          api.get<{ data: {
            ordersToday: number; revenueToday: number; avgOrderValue: number;
            customerCount: number; ordersInProgress: number; ordersCompleted: number; ordersCancelled: number;
          } }>('/orders/stats/today', { params: { storeId } }),
          api.get<{ data: { name: string } }>(`/stores/${storeId}`).catch(() => null),
        ]);
        const d = today.data.data;
        return [{
          storeId,
          storeName: profile?.data?.data?.name ?? 'Your Store',
          ordersToday: d.ordersToday,
          revenueToday: d.revenueToday,
          avgOrderValue: d.avgOrderValue,
          customerCount: d.customerCount,
          ordersInProgress: d.ordersInProgress,
          ordersCompleted: d.ordersCompleted,
          ordersCancelled: d.ordersCancelled,
        }];
      } catch {
        return MOCK_STORES.filter((s) => s.storeId === storeId);
      }
    }
    try {
      const res = await api.get<{ data: StoreMetrics[] }>('/reports/store-metrics');
      return res.data.data;
    } catch {
      return MOCK_STORES;
    }
  },

  getRevenueChart: async (storeId: string, period: string): Promise<RevenuePoint[]> => {
    try {
      const res = await api.get<{ data: RevenuePoint[] }>('/reports/revenue', {
        params: { storeId, period },
      });
      return res.data.data;
    } catch {
      return MOCK_REVENUE[period] ?? MOCK_REVENUE['7d'];
    }
  },

  getInventoryAlerts: async (storeId?: string): Promise<InventoryAlert[]> => {
    try {
      const res = await api.get<{ data: InventoryAlert[] }>('/inventory/alerts', {
        params: storeId ? { storeId } : undefined,
      });
      return res.data.data;
    } catch {
      if (storeId) return MOCK_INVENTORY.filter((a) => a.storeId === storeId);
      return MOCK_INVENTORY;
    }
  },

  getStaffRecommendations: async (storeId: string): Promise<StaffSummary[]> => {
    try {
      const res = await api.get<{ data: StaffSummary[] }>('/staff/recommendations', {
        params: { storeId },
      });
      return res.data.data;
    } catch {
      return MOCK_STAFF.map((s) => ({ ...s, storeId }));
    }
  },

  getChurnAlert: async (_storeId: string): Promise<ChurnAlert> => {
    try {
      const res = await api.get<{ summary: ChurnAlert }>('/churn/scores', {
        params: { storeId: _storeId },
      });
      return res.data.summary;
    } catch {
      return MOCK_CHURN_ALERT;
    }
  },

  getCampaignROI: async (storeId?: string): Promise<CampaignROI[]> => {
    try {
      const res = await api.get<{ data: CampaignROI[] }>('/campaigns/performance', {
        params: storeId ? { storeId } : undefined,
      });
      return res.data.data;
    } catch {
      return MOCK_CAMPAIGNS;
    }
  },

  getOrderStream: async (storeId: string) => {
    try {
      const res = await api.get<{ data: { ordersInProgress: number; ordersCompleted: number } }>(
        '/reports/order-stream',
        { params: { storeId } }
      );
      return res.data.data;
    } catch {
      const store = MOCK_STORES.find((s) => s.storeId === storeId) ?? MOCK_STORES[0];
      return { ordersInProgress: store.ordersInProgress, ordersCompleted: store.ordersCompleted };
    }
  },
};