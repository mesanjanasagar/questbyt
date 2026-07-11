import axios from 'axios';
import { useKDSAuthStore } from '../store/authStore';

export const API_BASE = 'http://localhost:3000';

export const kdsApiClient = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

kdsApiClient.interceptors.request.use((config) => {
  const token = useKDSAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Access tokens expire after 15 minutes — a kitchen display is meant to stay
// open all day, so without this every screen would silently die mid-shift.
//
// Refresh tokens rotate on every use (single-use), so if two 401s fire around
// the same time (e.g. React StrictMode's double effect invocation, or two
// requests expiring together), the loser would present an already-consumed
// refresh token and wrongly trigger a logout right after the winner just
// succeeded. Share one in-flight promise so concurrent callers get the same
// result instead of racing separate /auth/refresh calls.
let refreshInFlight: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const { refreshToken, deviceId, setTokens, logout } = useKDSAuthStore.getState();
    if (!refreshToken || !deviceId) {
      logout();
      return null;
    }
    try {
      const res = await axios.post(`${API_BASE}/api/v1/auth/refresh`, { refreshToken, deviceId });
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

kdsApiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return kdsApiClient(original);
      }
    }
    return Promise.reject(error);
  },
);

export function getSSEUrl(storeId: string): string {
  const token = useKDSAuthStore.getState().token ?? '';
  return `${API_BASE}/api/v1/orders/events?storeId=${encodeURIComponent(storeId)}&token=${encodeURIComponent(token)}`;
}
