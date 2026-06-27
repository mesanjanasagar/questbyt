import { apiClient } from './client';
import type { Payment, Refund, ProcessPaymentRequest } from '@pos/shared-types';

export async function processPayment(
  data: ProcessPaymentRequest & { storeId: string },
): Promise<Payment> {
  const res = await apiClient.post('/api/v1/payments/process', data);
  return res.data.data as Payment;
}

export async function getPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const res = await apiClient.get(`/api/v1/payments/order/${orderId}`);
  return res.data.data as Payment | null;
}

export async function refundPayment(
  paymentId: string,
  amount: number,
  reason: string,
): Promise<Refund> {
  const res = await apiClient.post(`/api/v1/payments/${paymentId}/refund`, { amount, reason });
  return res.data.data as Refund;
}