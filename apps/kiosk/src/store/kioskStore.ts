import { create } from 'zustand';
import { MenuItem, CartItem, SelectedModifier, KioskStep, Category } from '../types';

interface KioskStore {
  // Menu
  categories: Category[];
  menuItems: MenuItem[];
  selectedCategory: string;
  selectedItem: MenuItem | null;

  // Cart
  cart: CartItem[];
  step: KioskStep;

  // Order
  orderId: string | null;
  orderNumber: number | null;

  // Actions
  setCategories: (c: Category[]) => void;
  setMenuItems: (items: MenuItem[]) => void;
  setSelectedCategory: (id: string) => void;
  setSelectedItem: (item: MenuItem | null) => void;
  setStep: (step: KioskStep) => void;

  addToCart: (item: MenuItem, quantity: number, modifiers: SelectedModifier[]) => void;
  updateQuantity: (menuItemId: string, delta: number) => void;
  removeFromCart: (menuItemId: string) => void;
  clearCart: () => void;

  setOrderConfirmed: (orderId: string, orderNumber: number) => void;

  cartTotal: () => number;
  cartCount: () => number;
}

export const useKioskStore = create<KioskStore>((set, get) => ({
  categories: [],
  menuItems: [],
  selectedCategory: '',
  selectedItem: null,
  cart: [],
  step: 'menu',
  orderId: null,
  orderNumber: null,

  setCategories: (categories) => set({ categories }),
  setMenuItems: (menuItems) => set({ menuItems }),
  setSelectedCategory: (selectedCategory) => set({ selectedCategory }),
  setSelectedItem: (selectedItem) => set({ selectedItem }),
  setStep: (step) => set({ step }),

  addToCart: (item, quantity, modifiers) => {
    const modifierTotal = modifiers.reduce((s, m) => s + m.price, 0);
    const lineTotal = (item.price + modifierTotal) * quantity;
    const cartItem: CartItem = {
      menuItemId: item.id,
      name: item.name,
      price: item.price,
      quantity,
      selectedModifiers: modifiers,
      lineTotal,
    };
    set((state) => ({ cart: [...state.cart, cartItem], selectedItem: null }));
  },

  updateQuantity: (menuItemId, delta) => {
    set((state) => ({
      cart: state.cart
        .map((item) =>
          item.menuItemId === menuItemId
            ? { ...item, quantity: item.quantity + delta, lineTotal: (item.price + item.selectedModifiers.reduce((s, m) => s + m.price, 0)) * (item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0),
    }));
  },

  removeFromCart: (menuItemId) => {
    set((state) => ({ cart: state.cart.filter((i) => i.menuItemId !== menuItemId) }));
  },

  clearCart: () => set({ cart: [], orderId: null, orderNumber: null }),

  setOrderConfirmed: (orderId, orderNumber) => set({ orderId, orderNumber }),

  cartTotal: () => get().cart.reduce((s, i) => s + i.lineTotal, 0),
  cartCount: () => get().cart.reduce((s, i) => s + i.quantity, 0),
}));