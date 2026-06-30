import api from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserRecord {
  id: string;
  storeId: string;
  username: string;
  email?: string;
  role: string;
  status: string;
  createdAt: string;
  lastLogin?: string;
}

export interface StaffProfile {
  id: string;
  userId: string;
  storeId: string;
  branchId?: string;
  employeeNumber: string;
  position?: string;
  createdAt: string;
  updatedAt: string;
}

export interface StaffWithUser extends StaffProfile {
  user?: UserRecord;
}

export interface Branch {
  id: string;
  storeId: string;
  branchCode: string;
  name: string;
  phone?: string;
  email?: string;
  timezone: string;
  isMain: boolean;
  isActive: boolean;
  address?: { line1: string; city: string; country: string; postalCode?: string };
  createdAt: string;
  updatedAt: string;
}

export interface DiningArea {
  id: string;
  branchId: string;
  storeId: string;
  name: string;
  description?: string;
  floorNumber?: number;
  createdAt: string;
}

export interface Table {
  id: string;
  diningAreaId: string;
  branchId: string;
  storeId: string;
  tableNumber: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'cleaning';
  createdAt: string;
  updatedAt: string;
}

export interface StoreProfile {
  id: string;
  name: string;
  businessType: string;
  currency: string;
  locale: string;
  timezone: string;
  phone?: string;
  email?: string;
  website?: string;
  vatNumber?: string;
  address?: { line1: string; line2?: string; city: string; state?: string; country: string; postalCode?: string };
  operatingHours?: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isClosed: boolean }>;
  branding?: { primaryColor?: string; logoUrl?: string; displayName?: string };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function unwrap<T>(res: { data: { data?: T } & T }): T {
  return (res.data as any).data ?? res.data;
}

// ─── Restaurant ───────────────────────────────────────────────────────────────

export const restaurantAPI = {
  list: () =>
    api.get('/stores').then(unwrap<StoreProfile[]>),

  get: (storeId: string) =>
    api.get(`/stores/${storeId}`).then(unwrap<StoreProfile>),

  create: (body: {
    name: string;
    businessType: string;
    currency?: string;
    locale?: string;
    timezone?: string;
    primaryColor?: string;
    logoUrl?: string;
  }) => api.post('/stores', body).then(unwrap<StoreProfile>),

  update: (storeId: string, body: Partial<StoreProfile>) =>
    api.patch(`/stores/${storeId}`, body).then(unwrap<StoreProfile>),

  updateBranding: (storeId: string, body: Record<string, unknown>) =>
    api.patch(`/stores/${storeId}/branding`, body).then(unwrap<StoreProfile>),

  setStatus: (storeId: string, isActive: boolean) =>
    api.patch(`/stores/${storeId}/status`, { isActive }).then(unwrap<StoreProfile>),

  remove: (storeId: string) =>
    api.delete(`/stores/${storeId}`).then((r) => r.data),
};

// ─── Branches ─────────────────────────────────────────────────────────────────

export const branchAPI = {
  list: (storeId: string) =>
    api.get('/branches/by-store/' + storeId).then(unwrap<Branch[]>),

  create: (body: {
    storeId: string;
    branchCode: string;
    name: string;
    phone?: string;
    email?: string;
    timezone?: string;
    isMain?: boolean;
    address?: Branch['address'];
  }) => api.post('/branches', body).then(unwrap<Branch>),

  update: (branchId: string, body: Partial<Branch>) =>
    api.patch('/branches/' + branchId, body).then(unwrap<Branch>),

  setStatus: (branchId: string, isActive: boolean) =>
    api.patch('/branches/' + branchId + '/status', { isActive }).then(unwrap<Branch>),

  remove: (branchId: string) =>
    api.delete('/branches/' + branchId).then((r) => r.data),

  getDiningAreas: (branchId: string) =>
    api.get('/branches/' + branchId + '/dining-areas').then(unwrap<DiningArea[]>),

  createDiningArea: (
    branchId: string,
    body: { storeId: string; name: string; description?: string; floorNumber?: number },
  ) => api.post('/branches/' + branchId + '/dining-areas', body).then(unwrap<DiningArea>),
};

// ─── Staff ────────────────────────────────────────────────────────────────────

export const staffAPI = {
  list: (storeId: string) =>
    api.get('/staff', { params: { storeId } }).then(unwrap<StaffProfile[]>),

  get: (staffId: string) =>
    api.get('/staff/' + staffId).then(unwrap<StaffProfile>),

  create: (storeId: string, body: { userId: string; branchId?: string; employeeNumber: string; position?: string }) =>
    api.post(`/onboarding/${storeId}/staff`, body).then(unwrap<StaffProfile>),

  update: (staffId: string, body: { branchId?: string | null; position?: string; employeeNumber?: string }) =>
    api.patch('/staff/' + staffId, body).then(unwrap<StaffProfile>),

  delete: (staffId: string) =>
    api.delete('/staff/' + staffId).then((r) => r.data),
};

// ─── Tables ───────────────────────────────────────────────────────────────────

export const tableAPI = {
  listByBranch: (branchId: string) =>
    api.get('/tables/by-branch/' + branchId).then(unwrap<Table[]>),

  listByArea: (diningAreaId: string) =>
    api.get('/tables/by-area/' + diningAreaId).then(unwrap<Table[]>),

  create: (body: { diningAreaId: string; branchId: string; storeId: string; tableNumber: string; capacity: number }) =>
    api.post('/tables', body).then(unwrap<Table>),

  updateStatus: (tableId: string, status: Table['status']) =>
    api.patch('/tables/' + tableId + '/status', { status }).then(unwrap<Table>),

  delete: (tableId: string) =>
    api.delete('/tables/' + tableId).then((r) => r.data),
};

// ─── Inventory ────────────────────────────────────────────────────────────────

export interface InventoryProduct {
  id: string;
  storeId: string;
  sku?: string;
  name: string;
  description?: string;
  categoryId?: string;
  unitType: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
  inventory?: {
    currentStock: number;
    reservedStock: number;
    availableStock: number;
    reorderLevel?: number;
    reorderQuantity?: number;
    updatedAt: string;
  };
}

export interface StockMovement {
  id: string;
  productId: string;
  storeId: string;
  movementType: string;
  quantity: number;
  referenceId?: string;
  referenceType?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export const inventoryAPI = {
  listWithStock: (storeId: string, params?: { status?: string; search?: string; page?: number; limit?: number }) =>
    api.get('/inventory/products-with-stock', { params: { storeId, ...params } }).then(unwrap<{ data: InventoryProduct[]; total: number; page: number; limit: number; totalPages: number }>),

  list: (storeId: string, params?: { status?: string; page?: number; limit?: number }) =>
    api.get('/inventory/products', { params: { storeId, ...params } }).then(unwrap<{ data: InventoryProduct[]; total: number; page: number; limit: number; totalPages: number }>),

  create: (body: { storeId: string; name: string; unitType: string; sku?: string; description?: string }) =>
    api.post('/inventory/products', body).then(unwrap<InventoryProduct>),

  update: (productId: string, body: { name?: string; description?: string; sku?: string; unitType?: string }) =>
    api.patch(`/inventory/products/${productId}`, body).then(unwrap<InventoryProduct>),

  archive: (productId: string) =>
    api.delete(`/inventory/products/${productId}`).then((r) => r.data),

  setStock: (productId: string, body: { currentStock: number; reorderLevel?: number; reorderQuantity?: number }) =>
    api.patch(`/inventory/products/${productId}/stock`, body).then(unwrap<{ currentStock: number }>),

  adjust: (productId: string, body: { movementType: 'purchase' | 'adjustment' | 'waste' | 'return'; adjustmentQuantity: number; reason: string }) =>
    api.post(`/inventory/products/${productId}/adjust`, body).then(unwrap<{ movement: StockMovement }>),

  getMovements: (productId: string, params?: { page?: number; limit?: number }) =>
    api.get(`/inventory/products/${productId}/movements`, { params }).then(unwrap<{ data: StockMovement[]; total: number; page: number }>),
};

// ─── Menu ─────────────────────────────────────────────────────────────────────

export interface MenuRecord {
  id: string;
  storeId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  status: 'active' | 'inactive';
  createdAt: string;
}

export interface MenuCategory {
  id: string;
  menuId: string;
  storeId: string;
  name: string;
  description?: string;
  displayOrder: number;
  status: 'active' | 'inactive' | 'hidden';
}

export interface MenuItemRecord {
  id: string;
  categoryId: string;
  storeId: string;
  name: string;
  description?: string;
  basePrice: number;
  taxRate: number;
  sku?: string;
  calories?: number;
  allergens?: string;
  tags?: string;
  status: string;
  sortOrder: number;
  isFeatured: boolean;
  inventoryProductId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MenuItemIngredient {
  id: string;
  menuItemId: string;
  inventoryProductId: string;
  quantity: number;
  unitType: string;
  createdAt: string;
}

export const menuAPI = {
  listMenus: (storeId: string) =>
    api.get('/menus', { params: { storeId } }).then(unwrap<MenuRecord[]>),

  createMenu: (body: { storeId: string; name: string; description?: string; isDefault?: boolean }) =>
    api.post('/menus', body).then(unwrap<MenuRecord>),

  updateMenu: (menuId: string, body: { name?: string; description?: string; isDefault?: boolean }) =>
    api.patch(`/menus/${menuId}`, body).then(unwrap<MenuRecord>),

  listCategories: (menuId: string) =>
    api.get(`/menus/${menuId}/categories`).then(unwrap<MenuCategory[]>),

  createCategory: (menuId: string, body: { storeId: string; name: string; description?: string; displayOrder?: number }) =>
    api.post(`/menus/${menuId}/categories`, body).then(unwrap<MenuCategory>),

  listItems: (categoryId: string) =>
    api.get('/items', { params: { categoryId } }).then(unwrap<MenuItemRecord[]>),

  createItem: (body: { categoryId: string; storeId: string; name: string; description?: string; basePrice: number; taxRate?: number; sku?: string; inventoryProductId?: string }) =>
    api.post('/items', body).then(unwrap<MenuItemRecord>),

  updateItem: (itemId: string, body: Partial<{ name: string; description: string | null; basePrice: number; taxRate: number; sku: string | null; calories: number | null; status: string; inventoryProductId: string | null }>) =>
    api.patch(`/items/${itemId}`, body).then(unwrap<MenuItemRecord>),

  deleteItem: (itemId: string) =>
    api.delete(`/items/${itemId}`).then((r) => r.data),

  listIngredients: (itemId: string) =>
    api.get(`/items/${itemId}/ingredients`).then(unwrap<MenuItemIngredient[]>),

  addIngredient: (itemId: string, body: { inventoryProductId: string; quantity: number; unitType: string }) =>
    api.post(`/items/${itemId}/ingredients`, body).then(unwrap<MenuItemIngredient>),

  updateIngredient: (itemId: string, ingredientId: string, body: { quantity: number; unitType: string }) =>
    api.patch(`/items/${itemId}/ingredients/${ingredientId}`, body).then(unwrap<MenuItemIngredient>),

  removeIngredient: (itemId: string, ingredientId: string) =>
    api.delete(`/items/${itemId}/ingredients/${ingredientId}`).then((r) => r.data),
};

// ─── Users ────────────────────────────────────────────────────────────────────

export const userAPI = {
  list: (storeId: string) =>
    api.get('/users', { params: { storeId } }).then(unwrap<UserRecord[]>),

  get: (userId: string) =>
    api.get('/users/' + userId).then(unwrap<UserRecord>),

  create: (body: { storeId: string; username: string; email?: string; password: string; role: string }) =>
    api.post('/users', body).then(unwrap<UserRecord>),

  updateRole: (userId: string, role: string) =>
    api.patch('/users/' + userId + '/role', { role }).then(unwrap<UserRecord>),

  updateStatus: (userId: string, status: 'active' | 'inactive' | 'suspended') =>
    api.patch('/users/' + userId + '/status', { status }).then(unwrap<UserRecord>),

  resetPassword: (userId: string, newPassword: string) =>
    api.patch('/users/' + userId + '/password', { newPassword }).then((r) => r.data),
};
