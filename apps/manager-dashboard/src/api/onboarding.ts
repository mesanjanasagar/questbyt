import api from './client';
import type {
  StoreProfile,
  Branch,
  DiningArea,
  Table,
  OnboardingState,
  PaymentConfiguration,
  NotificationConfiguration,
} from '@pos/shared-types';

// ─── Store ────────────────────────────────────────────────────────────────────

export const storeAPI = {
  create: (body: {
    name: string;
    businessType: string;
    currency?: string;
    locale?: string;
    timezone?: string;
  }) => api.post<{ data: StoreProfile }>('/stores', body).then((r) => r.data.data ?? r.data),

  get: (storeId: string) =>
    api.get<{ data: StoreProfile }>(`/stores/${storeId}`).then((r) => r.data.data ?? r.data),

  update: (storeId: string, body: Partial<StoreProfile>) =>
    api.patch<{ data: StoreProfile }>(`/stores/${storeId}`, body).then((r) => r.data.data ?? r.data),

  updateBranding: (storeId: string, body: Record<string, unknown>) =>
    api.patch(`/stores/${storeId}/branding`, body).then((r) => r.data),
};

// ─── Onboarding State ─────────────────────────────────────────────────────────

export const onboardingAPI = {
  getState: (storeId: string) =>
    api.get<{ data: OnboardingState }>(`/onboarding/${storeId}`).then((r) => r.data.data ?? r.data),

  completeStep: (storeId: string, step: string) =>
    api.post<{ data: OnboardingState }>(`/onboarding/${storeId}/complete-step`, { step }).then((r) => r.data.data ?? r.data),

  complete: (storeId: string) =>
    api.post<{ data: OnboardingState }>(`/onboarding/${storeId}/complete`).then((r) => r.data.data ?? r.data),

  getPaymentConfig: (storeId: string) =>
    api.get<{ data: PaymentConfiguration }>(`/onboarding/${storeId}/payment-config`).then((r) => r.data.data ?? r.data),

  setPaymentConfig: (storeId: string, body: { cashEnabled?: boolean; cardEnabled?: boolean; enabledMethods?: string[] }) =>
    api.put<{ data: PaymentConfiguration }>(`/onboarding/${storeId}/payment-config`, body).then((r) => r.data.data ?? r.data),

  getNotificationConfig: (storeId: string) =>
    api.get<{ data: NotificationConfiguration }>(`/onboarding/${storeId}/notification-config`).then((r) => r.data.data ?? r.data),

  setNotificationConfig: (storeId: string, body: { managerPhone?: string; managerEmail?: string; lowStockAlerts?: boolean; orderAlerts?: boolean; channels?: string[] }) =>
    api.put<{ data: NotificationConfiguration }>(`/onboarding/${storeId}/notification-config`, body).then((r) => r.data.data ?? r.data),

  getStaff: (storeId: string) =>
    api.get(`/onboarding/${storeId}/staff`).then((r) => r.data.data ?? r.data),

  addStaffProfile: (storeId: string, body: { userId: string; branchId?: string; employeeNumber: string; position?: string }) =>
    api.post(`/onboarding/${storeId}/staff`, body).then((r) => r.data.data ?? r.data),
};

// ─── Branches ─────────────────────────────────────────────────────────────────

export const branchAPI = {
  create: (body: { storeId: string; branchCode: string; name: string; timezone?: string; isMain?: boolean; phone?: string; email?: string }) =>
    api.post<{ data: Branch }>('/branches', body).then((r) => r.data.data ?? r.data),

  list: (storeId: string) =>
    api.get<{ data: Branch[] }>(`/branches/by-store/${storeId}`).then((r) => r.data.data ?? r.data),

  update: (branchId: string, body: Partial<Branch>) =>
    api.patch<{ data: Branch }>(`/branches/${branchId}`, body).then((r) => r.data.data ?? r.data),

  createDiningArea: (branchId: string, body: { storeId: string; name: string; description?: string; floorNumber?: number }) =>
    api.post<{ data: DiningArea }>(`/branches/${branchId}/dining-areas`, body).then((r) => r.data.data ?? r.data),

  getDiningAreas: (branchId: string) =>
    api.get<{ data: DiningArea[] }>(`/branches/${branchId}/dining-areas`).then((r) => r.data.data ?? r.data),
};

// ─── Tables ───────────────────────────────────────────────────────────────────

export const tableAPI = {
  create: (body: { diningAreaId: string; branchId: string; storeId: string; tableNumber: string; capacity: number }) =>
    api.post<{ data: Table }>('/tables', body).then((r) => r.data.data ?? r.data),

  listByBranch: (branchId: string) =>
    api.get<{ data: Table[] }>(`/tables/by-branch/${branchId}`).then((r) => r.data.data ?? r.data),

  listByArea: (diningAreaId: string) =>
    api.get<{ data: Table[] }>(`/tables/by-area/${diningAreaId}`).then((r) => r.data.data ?? r.data),
};

// ─── Users / Staff ────────────────────────────────────────────────────────────

export const userAPI = {
  create: (body: { storeId: string; username: string; email?: string; password: string; role: string }) =>
    api.post('/users', body).then((r) => r.data.data ?? r.data),

  list: (storeId: string) =>
    api.get('/users', { params: { storeId } }).then((r) => r.data.data ?? r.data),
};

// ─── Menu ─────────────────────────────────────────────────────────────────────

export const menuAPI = {
  create: (body: { storeId: string; name: string; description?: string; isDefault?: boolean }) =>
    api.post('/menus', body).then((r) => r.data.data ?? r.data),

  list: (storeId: string) =>
    api.get('/menus', { params: { storeId } }).then((r) => r.data.data ?? r.data),

  createCategory: (menuId: string, body: { storeId: string; name: string; displayOrder?: number }) =>
    api.post(`/menus/${menuId}/categories`, body).then((r) => r.data.data ?? r.data),

  getCategories: (menuId: string) =>
    api.get(`/menus/${menuId}/categories`).then((r) => r.data.data ?? r.data),

  createItem: (body: { categoryId: string; storeId: string; name: string; basePrice: number; description?: string }) =>
    api.post('/items', body).then((r) => r.data.data ?? r.data),
};

// ─── Inventory ────────────────────────────────────────────────────────────────

export const inventoryAPI = {
  createProduct: (body: { storeId: string; name: string; unitType: string; sku?: string; description?: string }) =>
    api.post('/inventory/products', body).then((r) => r.data.data ?? r.data),

  listProducts: (storeId: string) =>
    api.get('/inventory/products', { params: { storeId } }).then((r) => r.data.data ?? r.data),

  setStock: (productId: string, body: { currentStock: number; reorderLevel?: number; reorderQuantity?: number }) =>
    api.patch(`/inventory/products/${productId}/stock`, body).then((r) => r.data.data ?? r.data),
};
