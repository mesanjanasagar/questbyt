import { apiClient } from './client';

export interface RegisterShift {
  id: string;
  storeId: string;
  deviceId: string;
  cashierId: string;
  openingBalance: number;
  openingNotes?: string;
  closingBalance?: number;
  expectedCash?: number;
  variance?: number;
  closingNotes?: string;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
}

export interface CashMovement {
  id: string;
  shiftId: string;
  type: 'cash_in' | 'cash_out';
  amount: number;
  reason: string;
  createdBy: string;
  createdAt: string;
}

export interface ShiftSummary {
  shift: RegisterShift;
  cashSales: number;
  cardSales: number;
  walletSales: number;
  onlineSales: number;
  cashRefunds: number;
  cashIn: number;
  cashOut: number;
  expectedCash: number;
  movements: CashMovement[];
}

export async function openShift(storeId: string, openingBalance: number, openingNotes?: string): Promise<RegisterShift> {
  const res = await apiClient.post('/api/v1/shifts/open', { storeId, openingBalance, openingNotes });
  return res.data.data as RegisterShift;
}

export async function getActiveShift(): Promise<ShiftSummary | null> {
  const res = await apiClient.get('/api/v1/shifts/active');
  return res.data.data as ShiftSummary | null;
}

export async function recordCashMovement(
  shiftId: string,
  type: 'cash_in' | 'cash_out',
  amount: number,
  reason: string,
): Promise<CashMovement> {
  const res = await apiClient.post(`/api/v1/shifts/${shiftId}/cash-movement`, { type, amount, reason });
  return res.data.data as CashMovement;
}

export async function closeShift(shiftId: string, closingBalance: number, closingNotes?: string): Promise<ShiftSummary> {
  const res = await apiClient.post(`/api/v1/shifts/${shiftId}/close`, { closingBalance, closingNotes });
  return res.data.data as ShiftSummary;
}
