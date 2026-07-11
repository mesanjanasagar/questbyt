import { apiClient } from './client';

export async function getStoreSettings(storeId: string): Promise<{ posCaptureCustomerDetails: boolean; name: string }> {
  const res = await apiClient.get(`/api/v1/stores/${storeId}`);
  const data = res.data?.data ?? res.data;
  return {
    posCaptureCustomerDetails: data?.posCaptureCustomerDetails ?? false,
    name: data?.branding?.displayName ?? data?.name ?? 'Restaurant',
  };
}
