import { apiClient } from './client';
import { Transaction, Campaign, Reservation, PointsHistory } from '../types';

export const loyaltyAPI = {
  getTransactions: async (page = 1, limit = 20): Promise<{ data: Transaction[]; total: number }> => {
    const res = await apiClient.get<{ data: Transaction[]; total: number }>('/customers/me/orders', {
      params: { page, limit },
    });
    return res.data;
  },

  getPointsHistory: async (): Promise<PointsHistory[]> => {
    const res = await apiClient.get<{ data: PointsHistory[] }>('/customers/me/points-history');
    return res.data.data;
  },

  getCampaigns: async (): Promise<Campaign[]> => {
    const res = await apiClient.get<{ data: Campaign[] }>('/customers/me/campaigns');
    return res.data.data;
  },

  redeemOffer: async (campaignId: string): Promise<void> => {
    await apiClient.post(`/customers/me/campaigns/${campaignId}/redeem`);
  },

  getReservations: async (): Promise<Reservation[]> => {
    const res = await apiClient.get<{ data: Reservation[] }>('/reservations/me');
    return res.data.data;
  },

  createReservation: async (data: {
    date: string;
    time: string;
    partySize: number;
    notes?: string;
    storeId: string;
  }): Promise<Reservation> => {
    const res = await apiClient.post<{ data: Reservation }>('/reservations', data);
    return res.data.data;
  },

  cancelReservation: async (reservationId: string, reason?: string): Promise<void> => {
    await apiClient.post(`/reservations/${reservationId}/cancel`, { reason });
  },
};