import { MenuItemStatus } from './enums';

export interface Menu {
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
  nameAr?: string;
  description?: string;
  imageUrl?: string;
  displayOrder: number;
  status: 'active' | 'inactive' | 'hidden';
  availableFrom?: string;
  availableTo?: string;
  availableDays?: string;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  storeId: string;
  name: string;
  nameAr?: string;
  description?: string;
  imageUrl?: string;
  basePrice: number;
  taxRate: number;
  sku?: string;
  barcode?: string;
  calories?: number;
  allergens?: string;
  tags?: string;
  status: MenuItemStatus;
  sortOrder: number;
  isFeatured: boolean;
  inventoryProductId?: string;
  modifierGroups?: ModifierGroup[];
  variants?: ItemVariant[];
  createdAt: string;
  updatedAt: string;
}

export interface ModifierGroup {
  id: string;
  storeId: string;
  name: string;
  selectionType: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  modifiers: Modifier[];
}

export interface Modifier {
  id: string;
  groupId: string;
  name: string;
  nameAr?: string;
  priceAdjustment: number;
  isDefault: boolean;
  status: 'active' | 'inactive';
  inventoryProductId?: string;
}

export interface ItemVariant {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  sku?: string;
  status: 'active' | 'inactive';
}

export interface CreateMenuRequest {
  storeId: string;
  name: string;
  description?: string;
  isDefault?: boolean;
}

export interface CreateCategoryRequest {
  menuId: string;
  storeId: string;
  name: string;
  nameAr?: string;
  description?: string;
  imageUrl?: string;
  displayOrder?: number;
  availableFrom?: string;
  availableTo?: string;
  availableDays?: string;
}

export interface CreateMenuItemRequest {
  categoryId: string;
  storeId: string;
  name: string;
  nameAr?: string;
  description?: string;
  basePrice: number;
  taxRate?: number;
  sku?: string;
  calories?: number;
  allergens?: string;
  tags?: string;
  inventoryProductId?: string;
}