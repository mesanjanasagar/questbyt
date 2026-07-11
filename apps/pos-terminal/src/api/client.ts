import axios from 'axios';
import { useAuthStore } from '../store/authStore';

export const apiClient = axios.create({
  baseURL: '/',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT on every request
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  const deviceId = useAuthStore.getState().deviceId;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (deviceId) config.headers['X-Device-ID'] = deviceId;
  return config;
});

// Refresh tokens rotate on every use (single-use) — if two 401s (or a 401 and
// a proactive SSE refresh) fire around the same time, the loser would present
// an already-consumed refresh token and wrongly log out right after the
// winner just succeeded. Share one in-flight promise so concurrent callers
// get the same result instead of racing separate /auth/refresh calls.
let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken, deviceId, setTokens, logout } = useAuthStore.getState();
    if (!refreshToken || !deviceId) {
      logout();
      return null;
    }
    try {
      const res = await axios.post('/auth/refresh', { refreshToken, deviceId });
      const { accessToken, refreshToken: newRefreshToken } = res.data.data;
      setTokens(accessToken, newRefreshToken);
      return accessToken;
    } catch {
      logout();
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }
    }
    return Promise.reject(error);
  },
);

// SSE — same event stream KDS subscribes to, filtered client-side to the
// events a waiter cares about (order ready for pickup).
export function getSSEUrl(storeId: string): string {
  const token = useAuthStore.getState().accessToken ?? '';
  return `/api/v1/orders/events?storeId=${encodeURIComponent(storeId)}&token=${encodeURIComponent(token)}`;
}