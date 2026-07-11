import { kdsApiClient } from './client';

export interface StaffProfile {
  id: string;
  userId: string;
  storeId: string;
  branchId?: string;
  employeeNumber: string;
  position?: string;
}

export async function getMyStaffProfile(): Promise<StaffProfile> {
  const res = await kdsApiClient.get('/api/v1/staff/me');
  return res.data.data as StaffProfile;
}
