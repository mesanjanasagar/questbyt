import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@pos/shared-types';
import { useNotificationStore } from './notificationStore';

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  deviceId: string | null;
  user: Omit<User, 'passwordHash'> | null;
  permissions: string[];
  _hasHydrated: boolean;
  setAuth: (data: {
    accessToken: string;
    refreshToken: string;
    deviceId: string;
    user: Omit<User, 'passwordHash'>;
    permissions: string[];
  }) => void;
  setAccessToken: (token: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setHasHydrated: (v: boolean) => void;
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
      _hasHydrated: false,
      setAuth: (data) =>
        set({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          deviceId: data.deviceId,
          user: data.user,
          permissions: data.permissions,
        }),
      setAccessToken: (token) => set({ accessToken: token }),
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setHasHydrated: (v) => set({ _hasHydrated: v }),
      logout: () => {
        set({ accessToken: null, refreshToken: null, deviceId: null, user: null, permissions: [] });
        // A shared terminal's next sign-in shouldn't inherit this shift's
        // read/unread notification history.
        useNotificationStore.getState().clear();
      },
    }),
    {
      name: 'pos-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        deviceId: state.deviceId,
        user: state.user,
        permissions: state.permissions,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
