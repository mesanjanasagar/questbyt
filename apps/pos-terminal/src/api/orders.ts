import { apiClient } from './client';
import type { Order, CreateOrderRequest, UpdateOrderStatusRequest } from '@pos/shared-types';

export async function createOrder(data: CreateOrderRequest): Promise<Order> {
  const res = await apiClient.post('/api/v1/orders', data);
  return res.data.data as Order;
}

export async function getOrder(id: string): Promise<Order> {
  const res = await apiClient.get(`/api/v1/orders/${id}`);
  return res.data.data as Order;
}

export async function updateOrderStatus(id: string, data: UpdateOrderStatusRequest): Promise<Order> {
  const res = await apiClient.patch(`/api/v1/orders/${id}/status`, data);
  return res.data.data as Order;
}

export async function cancelOrder(id: string, reason: string): Promise<Order> {
  const res = await apiClient.post(`/api/v1/orders/${id}/cancel`, { reason });
  return res.data.data as Order;
}

export async function listOrders(params: Record<string, string | number | undefined>): Promise<{ data: Order[]; total: number; page: number }> {
  const res = await apiClient.get('/api/v1/orders', { params });
  return res.data.data;
}

export async function getActiveOrderForTable(tableId: string, storeId: string): Promise<Order | null> {
  try {
    const res = await apiClient.get('/api/v1/orders/active-for-table', { params: { tableId, storeId } });
    return res.data.data as Order;
  } catch (err: any) {
    if (err?.response?.status === 404) return null;
    throw err;
  }
}

export async function sendToKitchen(orderId: string, items: import('@pos/shared-types').CreateOrderItemRequest[]): Promise<Order> {
  const res = await apiClient.post(`/api/v1/orders/${orderId}/send-to-kitchen`, { items });
  return res.data.data as Order;
}

export async function requestBill(orderId: string): Promise<Order> {
  const res = await apiClient.post(`/api/v1/orders/${orderId}/request-bill`);
  return res.data.data as Order;
}

export async function closeOrder(orderId: string): Promise<Order> {
  const res = await apiClient.post(`/api/v1/orders/${orderId}/close`);
  return res.data.data as Order;
}

// Only works while the item is still 'pending' — i.e. the kitchen hasn't
// accepted/started it yet.
export async function updateSentItemQuantity(orderId: string, itemId: string, quantity: number): Promise<import('@pos/shared-types').OrderItem> {
  const res = await apiClient.patch(`/api/v1/orders/${orderId}/items/${itemId}`, { quantity });
  return res.data.data;
}

export async function removeSentItem(orderId: string, itemId: string): Promise<void> {
  await apiClient.delete(`/api/v1/orders/${orderId}/items/${itemId}`);
}

export async function applyDiscount(
  orderId: string,
  data: { discountType?: 'percentage' | 'fixed'; discountValue?: number; reason?: string; promoCode?: string },
): Promise<Order> {
  const res = await apiClient.post(`/api/v1/orders/${orderId}/discount`, data);
  return res.data.data as Order;
}

export async function removeDiscount(orderId: string): Promise<Order> {
  const res = await apiClient.delete(`/api/v1/orders/${orderId}/discount`);
  return res.data.data as Order;
}