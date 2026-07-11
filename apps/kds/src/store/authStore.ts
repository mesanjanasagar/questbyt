import { create } from 'zustand';

interface KDSAuthState {
  token: string | null;
  refreshToken: string | null;
  deviceId: string | null;
  storeId: string | null;
  username: string | null;
  login: (token: string, refreshToken: string, deviceId: string, storeId: string, username: string) => void;
  setTokens: (token: string, refreshToken: string) => void;
  logout: () => void;
}

export const useKDSAuthStore = create<KDSAuthState>()((set) => ({
  token: localStorage.getItem('kdsAuthToken'),
  refreshToken: localStorage.getItem('kdsRefreshToken'),
  deviceId: localStorage.getItem('kdsDeviceId'),
  storeId: localStorage.getItem('kdsStoreId'),
  username: localStorage.getItem('kdsUsername'),

  login: (token, refreshToken, deviceId, storeId, username) => {
    localStorage.setItem('kdsAuthToken', token);
    localStorage.setItem('kdsRefreshToken', refreshToken);
    localStorage.setItem('kdsDeviceId', deviceId);
    localStorage.setItem('kdsStoreId', storeId);
    localStorage.setItem('kdsUsername', username);
    set({ token, refreshToken, deviceId, storeId, username });
  },

  // Called after a silent refresh — access token rotates, refresh token is
  // re-issued too (auth-service rotates it on every use).
  setTokens: (token, refreshToken) => {
    localStorage.setItem('kdsAuthToken', token);
    localStorage.setItem('kdsRefreshToken', refreshToken);
    set({ token, refreshToken });
  },

  logout: () => {
    localStorage.removeItem('kdsAuthToken');
    localStorage.removeItem('kdsRefreshToken');
    localStorage.removeItem('kdsDeviceId');
    localStorage.removeItem('kdsStoreId');
    localStorage.removeItem('kdsUsername');
    set({ token: null, refreshToken: null, deviceId: null, storeId: null, username: null });
  },
}));
