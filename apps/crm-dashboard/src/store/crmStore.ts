import { create } from 'zustand';
import { Customer, Campaign, DashboardMetrics, SegmentSummary, TierSummary, ChurnScore } from '../types';

interface CRMStore {
  // Customers
  customers: Customer[];
  customerTotal: number;
  selectedCustomer: Customer | null;

  // Segments & Tiers
  segments: SegmentSummary[];
  tiers: TierSummary[];
  metrics: DashboardMetrics | null;

  // Campaigns
  campaigns: Campaign[];
  campaignTotal: number;

  // Churn
  churnScores: ChurnScore[];
  churnSummary: { total: number; critical: number; high: number; medium: number; low: number } | null;

  // Filters
  segmentFilter: string;
  searchQuery: string;

  // Setters
  setCustomers: (customers: Customer[], total: number) => void;
  setSelectedCustomer: (c: Customer | null) => void;
  setSegments: (s: SegmentSummary[]) => void;
  setTiers: (t: TierSummary[]) => void;
  setMetrics: (m: DashboardMetrics) => void;
  setCampaigns: (c: Campaign[], total: number) => void;
  setChurnScores: (scores: ChurnScore[], summary: any) => void;
  setSegmentFilter: (f: string) => void;
  setSearchQuery: (q: string) => void;
}

export const useCRMStore = create<CRMStore>((set) => ({
  customers: [],
  customerTotal: 0,
  selectedCustomer: null,
  segments: [],
  tiers: [],
  metrics: null,
  campaigns: [],
  campaignTotal: 0,
  churnScores: [],
  churnSummary: null,
  segmentFilter: 'all',
  searchQuery: '',

  setCustomers: (customers, total) => set({ customers, customerTotal: total }),
  setSelectedCustomer: (selectedCustomer) => set({ selectedCustomer }),
  setSegments: (segments) => set({ segments }),
  setTiers: (tiers) => set({ tiers }),
  setMetrics: (metrics) => set({ metrics }),
  setCampaigns: (campaigns, total) => set({ campaigns, campaignTotal: total }),
  setChurnScores: (churnScores, churnSummary) => set({ churnScores, churnSummary }),
  setSegmentFilter: (segmentFilter) => set({ segmentFilter }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
}));