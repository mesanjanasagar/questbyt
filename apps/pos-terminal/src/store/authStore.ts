import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@pos/shared-types';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  deviceId: string | null;
  user: Omit<User, 'passwordHash'> | null;
  permissions: string[];
  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    deviceId: string;
    user: Omit<User, 'passwordHash'>;
    permissions: string[];
  }) => void;
  setAccessToken: (token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      deviceId: null,
      user: null,
      permissions: [],
      setAuth: (data) =>
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          deviceId: data.deviceId,
          user: data.user,
          permissions: data.permissions,
        }),
      setAccessToken: (token) => set({ accessToken: token }),
      logout: () =>
        set({ accessToken: null, refreshToken: null, deviceId: null, user: null, permissions: [] }),
    }),
    {
      name: 'pos-auth',
      // Only persist non-sensitive fields (access token is short-lived anyway)
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        deviceId: state.deviceId,
        user: state.user,
        permissions: state.permissions,
      }),
    },
  ),
);