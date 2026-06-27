import api from './client';
import { Customer, SegmentSummary, TierSummary, DashboardMetrics } from '../types';

// -- Mock data
const MOCK_CUSTOMERS: Customer[] = [
  { id: 'c-1', name: 'Ahmed Al Mansoori', email: 'ahmed@example.com', phone: '+971501234567', loyaltyTier: 'Gold', loyaltyPoints: 12845, totalOrders: 47, totalSpend: 3284.50, segment: 'VIP', lastOrderAt: new Date(Date.now() - 2 * 86400000).toISOString() },
  { id: 'c-2', name: 'Sara Khalid', email: 'sara@example.com', phone: null, loyaltyTier: 'Silver', loyaltyPoints: 11020, totalOrders: 23, totalSpend: 1102.00, segment: 'Loyal', lastOrderAt: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: 'c-3', name: 'James Thompson', email: 'james@example.com', phone: null, loyaltyTier: 'Bronze', loyaltyPoints: 875, totalOrders: 3, totalSpend: 87.50, segment: 'New', lastOrderAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 'c-4', name: 'Fatima Nasser', email: null, phone: '+971509876543', loyaltyTier: 'Silver', loyaltyPoints: 9020, totalOrders: 18, totalSpend: 982.00, segment: 'At-Risk', lastOrderAt: new Date(Date.now() - 16 * 86400000).toISOString() },
  { id: 'c-5', name: 'Tom Richards', email: 'tom@example.com', phone: null, loyaltyTier: 'Bronze', loyaltyPoints: 3120, totalOrders: 8, totalSpend: 312.00, segment: 'At-Risk', lastOrderAt: new Date(Date.now() - 16 * 86400000).toISOString() },
  { id: 'c-6', name: 'Layla Hassan', email: 'layla@example.com', phone: null, loyaltyTier: 'Platinum', loyaltyPoints: 52000, totalOrders: 134, totalSpend: 8900.00, segment: 'VIP', lastOrderAt: new Date(Date.now() - 3 * 86400000).toISOString() },
  { id: 'c-7', name: 'Omar Farooq', email: 'omar@example.com', phone: null, loyaltyTier: 'Gold', loyaltyPoints: 15200, totalOrders: 56, totalSpend: 4200.00, segment: 'Loyal', lastOrderAt: new Date(Date.now() - 45 * 86400000).toISOString() },
  { id: 'c-8', name: 'Priya Sharma', email: 'priya@example.com', phone: null, loyaltyTier: 'Bronze', loyaltyPoints: 420, totalOrders: 2, totalSpend: 42.00, segment: 'At-Risk', lastOrderAt: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: 'c-9', name: 'David Lee', email: 'david@example.com', phone: null, loyaltyTier: 'Silver', loyaltyPoints: 7800, totalOrders: 15, totalSpend: 780.00, segment: 'New', lastOrderAt: new Date(Date.now() - 0.5 * 86400000).toISOString() },
  { id: 'c-10', name: 'Maria Garcia', email: 'maria@example.com', phone: null, loyaltyTier: 'Bronze', loyaltyPoints: 1540, totalOrders: 6, totalSpend: 154.00, segment: 'Churned', lastOrderAt: new Date(Date.now() - 20 * 86400000).toISOString() },
];

const MOCK_SEGMENTS: SegmentSummary[] = [
  { segment: 'VIP', count: 1156, avgSpend: 5840.20, avgOrders: 89 },
  { segment: 'Loyal', count: 3982, avgSpend: 1240.50, avgOrders: 28 },
  { segment: 'New', count: 3471, avgSpend: 52.30, avgOrders: 2 },
  { segment: 'At-Risk', count: 891, avgSpend: 620.80, avgOrders: 12 },
  { segment: 'Churned', count: 1347, avgSpend: 280.40, avgOrders: 5 },
];

const MOCK_TIERS: TierSummary[] = [
  { tier: 'Platinum', count: 1200, totalPoints: 48000000 },
  { tier: 'Gold', count: 2800, totalPoints: 22400000 },
  { tier: 'Silver', count: 3100, totalPoints: 9300000 },
  { tier: 'Bronze', count: 5200, totalPoints: 2600000 },
];

const MOCK_METRICS: DashboardMetrics = {
  totalCustomers: 12847,
  newThisMonth: 342,
  atRisk: 891,
  churned: 1284,
  vip: 1156,
  avgLifetimeValue: 284.50,
};

// -- API
export const customersAPI = {
  getCustomers: async (params?: {
    segment?: string;
    tier?: string;
    search?: string;
    page?: number;
    limit?: number;
  }) => {
    try {
      const res = await api.get<{ data: Customer[]; total: number }>('/customers', { params });
      return res.data;
    } catch {
      let filtered = [...MOCK_CUSTOMERS];
      if (params?.segment && params.segment !== 'all') {
        filtered = filtered.filter((c) => c.segment === params.segment);
      }
      if (params?.search) {
        const q = params.search.toLowerCase();
        filtered = filtered.filter(
          (c) =>
            c.name.toLowerCase().includes(q) ||
            (c.email ?? '').toLowerCase().includes(q) ||
            (c.phone ?? '').includes(q)
        );
      }
      const page = params?.page ?? 1;
      const limit = params?.limit ?? 20;
      const start = (page - 1) * limit;
      return { data: filtered.slice(start, start + limit), total: filtered.length };
    }
  },

  getCustomer: async (id: string): Promise<Customer> => {
    try {
      const res = await api.get<{ data: Customer }>(`/customers/${id}`);
      return res.data.data;
    } catch {
      const found = MOCK_CUSTOMERS.find((c) => c.id === id);
      if (!found) throw new Error('Customer not found');
      return found;
    }
  },

  getSegments: async (): Promise<SegmentSummary[]> => {
    try {
      const res = await api.get<{ data: SegmentSummary[] }>('/customers/segments');
      return res.data.data;
    } catch {
      return MOCK_SEGMENTS;
    }
  },

  getTiers: async (): Promise<TierSummary[]> => {
    try {
      const res = await api.get<{ data: TierSummary[] }>('/customers/tiers');
      return res.data.data;
    } catch {
      return MOCK_TIERS;
    }
  },

  getMetrics: async (): Promise<DashboardMetrics> => {
    try {
      const res = await api.get<{ data: DashboardMetrics }>('/customers/metrics');
      return res.data.data;
    } catch {
      return MOCK_METRICS;
    }
  },
};