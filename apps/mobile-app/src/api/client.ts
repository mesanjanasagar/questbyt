import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

export const API_BASE = 'http://localhost:3000/api/v1';

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
    }
    return Promise.reject(error);
  }
);

export const setAuthToken = async (token: string) => {
  await SecureStore.setItemAsync('auth_token', token);
};

export const clearAuthToken = async () => {
  await SecureStore.deleteItemAsync('auth_token');
};

export const getAuthToken = async (): Promise<string | null> => {
  return SecureStore.getItemAsync('auth_token');
};