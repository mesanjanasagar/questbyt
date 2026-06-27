import { create } from 'zustand';
import { User } from '../types';
import { authAPI } from '../api/auth';
import { getAuthToken } from '../api/client';

interface AuthStore {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithPhone: (phone: string, otp: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialize: async () => {
    try {
      const token = await getAuthToken();
      if (token) {
        const user = await authAPI.getProfile();
        set({ user, isAuthenticated: true });
      }
    } catch {
      // token invalid or expired – user must log in
    } finally {
      set({ isLoading: false });
    }
  },

  login: async (email, password) => {
    const { user } = await authAPI.login(email, password);
    set({ user, isAuthenticated: true });
  },

  loginWithPhone: async (phone, otp) => {
    const { user } = await authAPI.loginWithPhone(phone, otp);
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await authAPI.logout();
    set({ user: null, isAuthenticated: false });
  },

  refreshProfile: async () => {
    const user = await authAPI.getProfile();
    set({ user });
  },
}));