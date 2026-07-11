import { apiClient } from './client';
import type { Table, StaffProfile, Order } from '@pos/shared-types';

export interface DiningArea {
  id: string;
  branchId: string;
  storeId: string;
  name: string;
  floorNumber?: number;
}

export async function getMyStaffProfile(): Promise<StaffProfile> {
  const res = await apiClient.get('/api/v1/staff/me');
  return res.data.data as StaffProfile;
}

export async function getDiningAreasByBranch(branchId: string): Promise<DiningArea[]> {
  const res = await apiClient.get(`/api/v1/branches/${branchId}/dining-areas`);
  return res.data.data as DiningArea[];
}

export async function getTablesByBranch(branchId: string): Promise<Table[]> {
  const res = await apiClient.get(`/api/v1/tables/by-branch/${branchId}`);
  return res.data.data as Table[];
}

export async function updateTableStatus(tableId: string, status: Table['status']): Promise<Table> {
  const res = await apiClient.patch(`/api/v1/tables/${tableId}/status`, { status });
  return res.data.data as Table;
}

export async function getActiveOrdersForStore(storeId: string, branchId?: string): Promise<Order[]> {
  // Fetch recent orders (last 200) to correlate with table numbers on the frontend.
  // We pass a 'from' of today midnight so we only get today's session orders.
  // branchId scopes this to the caller's own branch — table_number is only
  // unique per-branch, so without it a table on one branch's grid can match
  // (and appear to show) another branch's order for the same table number.
  const from = new Date();
  from.setHours(0, 0, 0, 0);
  const res = await apiClient.get('/api/v1/orders', {
    params: { storeId, branchId, from: from.toISOString(), limit: 200 },
  });
  const result = res.data.data;
  return (result?.data ?? result) as Order[];
}
