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

// Auto-refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const { refreshToken, deviceId, setAccessToken, logout } = useAuthStore.getState();
      if (refreshToken && deviceId) {
        try {
          const res = await axios.post('/auth/refresh', { refreshToken, deviceId });
          setAccessToken(res.data.data.accessToken);
          original.headers.Authorization = `Bearer ${res.data.data.accessToken}`;
          return apiClient(original);
        } catch {
          logout();
        }
      } else {
        logout();
      }
    }
    return Promise.reject(error);
  },
);