import { create } from 'zustand';
import { StoreMetrics, RevenuePoint, InventoryAlert, StaffSummary, ChurnAlert, CampaignROI } from '../types';

interface DashboardStore {
  stores: StoreMetrics[];
  selectedStoreId: string;
  revenuePeriod: '7d' | '30d' | '90d';
  revenueChart: RevenuePoint[];
  inventoryAlerts: InventoryAlert[];
  staffSummary: StaffSummary[];
  churnAlert: ChurnAlert | null;
  topCampaigns: CampaignROI[];
  lastRefresh: Date | null;

  setStores: (s: StoreMetrics[]) => void;
  setSelectedStore: (id: string) => void;
  setRevenuePeriod: (p: '7d' | '30d' | '90d') => void;
  setRevenueChart: (data: RevenuePoint[]) => void;
  setInventoryAlerts: (a: InventoryAlert[]) => void;
  setStaffSummary: (s: StaffSummary[]) => void;
  setChurnAlert: (c: ChurnAlert) => void;
  setTopCampaigns: (c: CampaignROI[]) => void;
  setLastRefresh: () => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  stores: [],
  selectedStoreId: localStorage.getItem('store_id') || '',
  revenuePeriod: '7d',
  revenueChart: [],
  inventoryAlerts: [],
  staffSummary: [],
  churnAlert: null,
  topCampaigns: [],
  lastRefresh: null,

  setStores: (stores) => set({ stores }),
  setSelectedStore: (id) => {
    localStorage.setItem('store_id', id);
    set({ selectedStoreId: id });
  },
  setRevenuePeriod: (revenuePeriod) => set({ revenuePeriod }),
  setRevenueChart: (revenueChart) => set({ revenueChart }),
  setInventoryAlerts: (inventoryAlerts) => set({ inventoryAlerts }),
  setStaffSummary: (staffSummary) => set({ staffSummary }),
  setChurnAlert: (churnAlert) => set({ churnAlert }),
  setTopCampaigns: (topCampaigns) => set({ topCampaigns }),
  setLastRefresh: () => set({ lastRefresh: new Date() }),
}));