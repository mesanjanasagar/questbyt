import { kdsApiClient } from './client';
import type { KDSOrder, KDSOrderItem } from '../types';

export async function fetchKDSOrders(storeId: string, branchId?: string): Promise<KDSOrder[]> {
  const res = await kdsApiClient.get('/api/v1/orders/kds', { params: { storeId, branchId } });
  const data = res.data.data;
  return (Array.isArray(data) ? data : data?.data ?? []) as KDSOrder[];
}

export async function updateItemStatus(
  orderId: string,
  itemId: string,
  status: KDSOrderItem['status'],
): Promise<KDSOrderItem> {
  const res = await kdsApiClient.patch(
    `/api/v1/orders/${orderId}/items/${itemId}/status`,
    { status },
  );
  return res.data.data as KDSOrderItem;
}
