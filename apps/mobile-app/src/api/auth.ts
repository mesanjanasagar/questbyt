import { apiClient, setAuthToken, clearAuthToken } from './client';
import { User } from '../types';

interface LoginResponse {
  token: string;
  user: User;
}

export const authAPI = {
  login: async (email: string, password: string): Promise<LoginResponse> => {
    const res = await apiClient.post<{ data: LoginResponse }>('/auth/login', {
      email,
      password,
    });
    await setAuthToken(res.data.data.token);
    return res.data.data;
  },

  loginWithPhone: async (phone: string, otp: string): Promise<LoginResponse> => {
    const res = await apiClient.post<{ data: LoginResponse }>('/auth/login/phone', {
      phone,
      otp,
    });
    await setAuthToken(res.data.data.token);
    return res.data.data;
  },

  requestOTP: async (phone: string): Promise<void> => {
    await apiClient.post('/auth/otp/request', { phone });
  },

  logout: async (): Promise<void> => {
    await clearAuthToken();
  },

  getProfile: async (): Promise<User> => {
    const res = await apiClient.get<{ data: User }>('/customers/me');
    return res.data.data;
  },
};