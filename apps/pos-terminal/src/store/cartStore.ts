import { create } from 'zustand';
import type { MenuItem, OrderItemModification, OrderType } from '@pos/shared-types';

export interface CartItem {
  id: string;           // temporary client-side ID
  menuItem: MenuItem;
  variantId?: string;
  variantName?: string;
  quantity: number;
  unitPrice: number;
  modifications: OrderItemModification[];
  notes?: string;
}

interface CartState {
  items: CartItem[];
  orderType: OrderType;
  tableNumber?: number;
  customerId?: string;
  notes?: string;

  addItem: (item: Omit<CartItem, 'id'>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  setOrderType: (type: OrderType) => void;
  setTableNumber: (n: number | undefined) => void;
  setCustomerId: (id: string | undefined) => void;
  setNotes: (notes: string) => void;

  // Computed
  subtotal: () => number;
  taxAmount: () => number;
  totalAmount: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  orderType: 'dine-in',
  tableNumber: undefined,
  customerId: undefined,
  notes: undefined,

  addItem: (item) => {
    const items = get().items;
    // Check if same item+variant+mods already in cart
    const existingIdx = items.findIndex(
      (i) =>
        i.menuItem.id === item.menuItem.id &&
        i.variantId === item.variantId &&
        JSON.stringify(i.modifications) === JSON.stringify(item.modifications),
    );

    if (existingIdx >= 0) {
      const updated = [...items];
      updated[existingIdx] = {
        ...updated[existingIdx],
        quantity: updated[existingIdx].quantity + item.quantity,
      };
      set({ items: updated });
    } else {
      set({ items: [...items, { ...item, id: crypto.randomUUID() }] });
    }
  },

  updateQuantity: (id, quantity) => {
    if (quantity <= 0) {
      get().removeItem(id);
      return;
    }
    set({ items: get().items.map((i) => (i.id === id ? { ...i, quantity } : i)) });
  },

  removeItem: (id) => set({ items: get().items.filter((i) => i.id !== id) }),

  clearCart: () =>
    set({ items: [], tableNumber: undefined, customerId: undefined, notes: undefined }),

  setOrderType: (orderType) => set({ orderType }),
  setTableNumber: (tableNumber) => set({ tableNumber }),
  setCustomerId: (customerId) => set({ customerId }),
  setNotes: (notes) => set({ notes }),

  subtotal: () => get().items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
  taxAmount: () => parseFloat((get().subtotal() * 0.05).toFixed(2)),
  totalAmount: () => parseFloat((get().subtotal() + get().taxAmount()).toFixed(2)),
  itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
}));