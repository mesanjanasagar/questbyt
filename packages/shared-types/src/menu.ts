import { MenuItemStatus, DietaryType } from './enums';

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
  dietaryType?: DietaryType;
  status: MenuItemStatus;
  sortOrder: number;
  isFeatured: boolean;
  isRecommended: boolean;
  hideOnline: boolean;
  availableFromTime?: string;
  availableToTime?: string;
  availableDays?: string;
  inventoryProductId?: string;
  modifierGroups?: ModifierGroup[];
  variants?: ItemVariant[];
  // Cheap flags on the full-menu list response, so a POS can decide whether an
  // item needs the options dialog without fetching every item's full detail —
  // the nested modifierGroups/variants arrays above are only populated by the
  // single-item endpoint.
  hasVariants?: boolean;
  hasModifierGroups?: boolean;
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
  dietaryType?: DietaryType;
  inventoryProductId?: string;
}

export interface CreateItemVariantRequest {
  name: string;
  price: number;
  sku?: string;
}

export interface UpdateItemVariantRequest {
  name?: string;
  price?: number;
  sku?: string;
  status?: 'active' | 'inactive';
}

export interface CreateModifierGroupRequest {
  storeId: string;
  name: string;
  selectionType?: 'single' | 'multiple';
  minSelections?: number;
  maxSelections?: number;
  isRequired?: boolean;
}

export interface UpdateModifierGroupRequest {
  name?: string;
  selectionType?: 'single' | 'multiple';
  minSelections?: number;
  maxSelections?: number;
  isRequired?: boolean;
}

export interface CreateModifierRequest {
  name: string;
  nameAr?: string;
  priceAdjustment?: number;
  isDefault?: boolean;
}

export interface UpdateModifierRequest {
  name?: string;
  nameAr?: string;
  priceAdjustment?: number;
  isDefault?: boolean;
  status?: 'active' | 'inactive';
}