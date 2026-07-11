import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import axios from 'axios';
import api from '../api/client';
import { useDashboardStore } from '../store/dashboardStore';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api/v1';

interface AuthUser {
  id: string;
  storeId: string;
  username: string;
  email?: string;
  role: string;
  status: string;
}

interface AuthState {
  user: AuthUser | null;
  deviceId: string | null;
  storeId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    deviceId: localStorage.getItem('device_id'),
    storeId: localStorage.getItem('store_id'),
    isAuthenticated: !!localStorage.getItem('access_token'),
    isLoading: true,
  });

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Proceed with local logout even if server request fails
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('device_id');
    localStorage.removeItem('store_id');
    setState({ user: null, deviceId: null, storeId: null, isAuthenticated: false, isLoading: false });
  }, []);

  // Restore session from stored token
  useEffect(() => {
    const restore = async () => {
      const accessToken = localStorage.getItem('access_token');
      const refreshToken = localStorage.getItem('refresh_token');
      const deviceId = localStorage.getItem('device_id');

      // If no access token but a refresh token exists, proactively obtain a new access token
      // so we don't need to wait for a 401 to trigger the interceptor refresh.
      if (!accessToken && refreshToken && deviceId) {
        try {
          const { data: refreshData } = await axios.post(`${BASE_URL}/auth/refresh`, {
            refreshToken,
            deviceId,
          });
          localStorage.setItem('access_token', refreshData.data.accessToken);
          localStorage.setItem('refresh_token', refreshData.data.refreshToken);
        } catch {
          // Refresh token is invalid/expired — clear everything and show login
          await logout();
          return;
        }
      } else if (!accessToken) {
        setState((s) => ({ ...s, isLoading: false }));
        return;
      }

      try {
        const { data } = await api.get('/auth/me');
        const user = data.data ?? data;
        setState({
          user,
          deviceId: localStorage.getItem('device_id'),
          storeId: localStorage.getItem('store_id') ?? user.storeId,
          isAuthenticated: true,
          isLoading: false,
        });
        if (user.storeId) {
          localStorage.setItem('store_id', user.storeId);
          if (!useDashboardStore.getState().selectedStoreId) {
            useDashboardStore.getState().setSelectedStore(user.storeId);
          }
        }
      } catch {
        await logout();
      }
    };
    restore();

    const handleLogout = () => logout();
    window.addEventListener('auth:logout', handleLogout);
    return () => window.removeEventListener('auth:logout', handleLogout);
  }, [logout]);

  const login = async (username: string, password: string) => {
    const { data } = await api.post('/auth/login', {
      username,
      password,
      deviceName: `Manager Dashboard — ${navigator.platform}`,
      deviceType: 'dashboard',
    });

    const payload = data.data ?? data;
    localStorage.setItem('access_token', payload.accessToken);
    localStorage.setItem('refresh_token', payload.refreshToken);
    localStorage.setItem('device_id', payload.deviceId);
    localStorage.setItem('store_id', payload.user.storeId);
    if (payload.user.storeId) useDashboardStore.getState().setSelectedStore(payload.user.storeId);

    setState({
      user: payload.user,
      deviceId: payload.deviceId,
      storeId: payload.user.storeId,
      isAuthenticated: true,
      isLoading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
