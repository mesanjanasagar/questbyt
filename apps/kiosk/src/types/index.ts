export interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  imageUrl: string | null;
  category: string;
  available: boolean;
  modifierGroups: ModifierGroup[];
}

export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  modifiers: Modifier[];
}

export interface Modifier {
  id: string;
  name: string;
  price: number;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
}

export interface CartItem {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedModifiers: SelectedModifier[];
  lineTotal: number;
}

export interface SelectedModifier {
  modifierId: string;
  name: string;
  price: number;
}

export type KioskStep = 'menu' | 'cart' | 'payment' | 'confirmation';
export type PaymentMethod = 'cash' | 'card' | 'mobile';