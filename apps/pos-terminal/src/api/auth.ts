import { apiClient } from './client';
import type { LoginRequest, LoginResponse } from '@pos/shared-types';

export async function login(data: LoginRequest): Promise<LoginResponse> {
  const res = await apiClient.post('/auth/login', data);
  return res.data.data as LoginResponse;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}