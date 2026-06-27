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