import api from './client';
import { Campaign, CampaignPerformance, CustomerSegment } from '../types';

// — Mock data ——————————————————————————————————
const daysAgo = (d: number) => new Date(Date.now() - d * 86400_000).toISOString();
const daysFromNow = (d: number) => new Date(Date.now() + d * 86400_000).toISOString();

const MOCK_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-1', name: 'Summer Loyalty Reward', type: 'promotional',
    targetSegment: 'Loyal', channel: 'email', status: 'active',
    sentCount: 3982, deliveredCount: 3784, clickRate: 0.312, revenue: 48200,
    storeId: 'store-1', openRate: 0.47,
    scheduledAt: daysAgo(16), completedAt: '',
    createdAt: daysAgo(14),
  },
  {
    id: 'camp-2', name: 'VIP Weekend Special', type: 'promotional',
    targetSegment: 'VIP', channel: 'sms', status: 'active',
    sentCount: 1156, deliveredCount: 1143, clickRate: 0.489, revenue: 72400,
    storeId: 'store-2', openRate: 0.52,
    scheduledAt: daysAgo(9), completedAt: '',
    createdAt: daysAgo(7),
  },
  {
    id: 'camp-3', name: 'Win-back At-Risk Customers', type: 're-engagement',
    targetSegment: 'At-Risk', channel: 'email', status: 'completed',
    sentCount: 891, deliveredCount: 820, clickRate: 0.178, revenue: 12800,
    storeId: 'store-3', openRate: 0.36,
    scheduledAt: daysAgo(32), completedAt: daysAgo(29),
    createdAt: daysAgo(30),
  },
  {
    id: 'camp-4', name: 'New Customer Welcome', type: 'onboarding',
    targetSegment: 'New', channel: 'email', status: 'active',
    sentCount: 342, deliveredCount: 342, clickRate: 0.562, revenue: 8900,
    storeId: 'store-4', openRate: 0.64,
    scheduledAt: daysAgo(7), completedAt: '',
    createdAt: daysAgo(5),
  },
  {
    id: 'camp-5', name: 'Churned Customer Re-engagement', type: 're-engagement',
    targetSegment: 'Churned', channel: 'whatsapp', status: 'paused',
    sentCount: 600, deliveredCount: 582, clickRate: 0.092, revenue: 4200,
    storeId: 'store-5', openRate: 0.28,
    scheduledAt: daysAgo(47), completedAt: '',
    createdAt: daysAgo(45),
  },
];

const MOCK_PERFORMANCE: CampaignPerformance[] = [
  { campaignId: 'camp-2', name: 'VIP Weekend Special', roi: 312, sentCount: 1156, deliveredCount: 1143, deliveredRate: 1143 / 1156, clickRate: 0.489, revenueGenerated: 72400, openRate: 0.52 },
  { campaignId: 'camp-1', name: 'Summer Loyalty Reward', roi: 248, sentCount: 3982, deliveredCount: 3784, deliveredRate: 3784 / 3982, clickRate: 0.312, revenueGenerated: 48200, openRate: 0.47 },
  { campaignId: 'camp-4', name: 'New Customer Welcome', roi: 189, sentCount: 342, deliveredCount: 342, deliveredRate: 342 / 342, clickRate: 0.562, revenueGenerated: 8900, openRate: 0.64 },
  { campaignId: 'camp-3', name: 'Win-back At-Risk', roi: 94, sentCount: 891, deliveredCount: 820, deliveredRate: 820 / 891, clickRate: 0.178, revenueGenerated: 12800, openRate: 0.36 },
  { campaignId: 'camp-5', name: 'Churned Re-engagement', roi: 42, sentCount: 600, deliveredCount: 582, deliveredRate: 582 / 600, clickRate: 0.092, revenueGenerated: 4200, openRate: 0.28 },
];

// — API ——————————————————————————————————
export const campaignsAPI = {
  getCampaigns: async (params?: { status?: string; page?: number; limit?: number }) => {
    try {
      const res = await api.get<{ data: Campaign[]; total: number }>('/campaigns', { params });
      return res.data;
    } catch {
      let filtered = [...MOCK_CAMPAIGNS];
      if (params?.status) filtered = filtered.filter((c) => c.status === params.status);
      const limit = params?.limit ?? 50;
      return { data: filtered.slice(0, limit), total: filtered.length };
    }
  },

  getCampaign: async (id: string): Promise<Campaign> => {
    try {
      const res = await api.get<{ data: Campaign }>(`/campaigns/${id}`);
      return res.data.data;
    } catch {
      const found = MOCK_CAMPAIGNS.find((c) => c.id === id);
      if (!found) throw new Error('Campaign not found');
      return found;
    }
  },

  getPerformance: async (): Promise<CampaignPerformance[]> => {
    try {
      const res = await api.get<{ data: CampaignPerformance[] }>('/campaigns/performance');
      return res.data.data;
    } catch {
      return MOCK_PERFORMANCE;
    }
  },

  createCampaign: async (data: {
    name: string;
    type: string;
    targetSegment: CustomerSegment;
    message: string;
    channel: string;
    scheduledAt?: string;
  }): Promise<Campaign> => {
    try {
      const res = await api.post<{ data: Campaign }>('/campaigns', data);
      return res.data.data;
    } catch {
      const newCampaign: Campaign = {
        id: `camp-${Date.now()}`,
        name: data.name,
        type: data.type,
        targetSegment: data.targetSegment,
        channel: data.channel,
        status: 'draft',
        sentCount: 0,
        deliveredCount: 0,
        clickRate: 0,
        revenue: 0,
        createdAt: new Date().toISOString(),
        storeId: '',
        openRate: 0,
        scheduledAt: null,
        completedAt: null
      };
      MOCK_CAMPAIGNS.unshift(newCampaign);
      return newCampaign;
    }
  },

  updateStatus: async (id: string, status: Campaign['status']): Promise<Campaign> => {
    try {
      const res = await api.patch<{ data: Campaign }>(`/campaigns/${id}/status`, { status });
      return res.data.data;
    } catch {
      const idx = MOCK_CAMPAIGNS.findIndex((c) => c.id === id);
      if (idx !== -1) MOCK_CAMPAIGNS[idx] = { ...MOCK_CAMPAIGNS[idx], status };
      return MOCK_CAMPAIGNS[idx];
    }
  },
};