import { apiClient } from './client';
import type { Customer } from '@pos/shared-types';

export async function lookupCustomer(storeId: string, q: string): Promise<Customer | null> {
  const res = await apiClient.get('/api/v1/customers/lookup', { params: { storeId, q } });
  return (res.data?.data ?? null) as Customer | null;
}

export async function createCustomer(data: { storeId: string; name: string; phone?: string; email?: string }): Promise<Customer> {
  const res = await apiClient.post('/api/v1/customers', data);
  return res.data.data as Customer;
}

export async function updateCustomer(id: string, data: { name?: string; phone?: string; email?: string }): Promise<Customer> {
  const res = await apiClient.patch(`/api/v1/customers/${id}`, data);
  return res.data.data as Customer;
}

export async function getCustomerById(id: string): Promise<Customer> {
  const res = await apiClient.get(`/api/v1/customers/${id}`);
  return res.data.data as Customer;
}
