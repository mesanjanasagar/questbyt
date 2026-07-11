import { create } from 'zustand';
import type { KDSOrder, KDSOrderItem, KDSFilter } from '../types';

interface KDSStore {
  orders: KDSOrder[];
  filter: KDSFilter;

  setOrders: (orders: KDSOrder[]) => void;
  upsertOrder: (order: KDSOrder) => void;
  appendItems: (orderId: string, items: KDSOrderItem[]) => void;
  updateItemStatus: (orderId: string, itemId: string, status: KDSOrderItem['status']) => void;
  removeOrder: (orderId: string) => void;
  setFilter: (filter: KDSFilter) => void;
}

export const useKDSStore = create<KDSStore>((set) => ({
  orders: [],
  filter: { orderType: 'all' },

  setOrders: (orders) => set({ orders }),

  upsertOrder: (order) =>
    set((state) => {
      const exists = state.orders.some((o) => o.id === order.id);
      if (exists) {
        return { orders: state.orders.map((o) => (o.id === order.id ? order : o)) };
      }
      return { orders: [order, ...state.orders] };
    }),

  appendItems: (orderId, items) =>
    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.id !== orderId) return o;
        const existingIds = new Set(o.items.map((i) => i.id));
        const newItems = items.filter((i) => !existingIds.has(i.id));
        return { ...o, items: [...o.items, ...newItems] };
      }),
    })),

  updateItemStatus: (orderId, itemId, status) =>
    set((state) => ({
      orders: state.orders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          items: o.items.map((i) => (i.id === itemId ? { ...i, status } : i)),
        };
      }),
    })),

  removeOrder: (orderId) =>
    set((state) => ({ orders: state.orders.filter((o) => o.id !== orderId) })),

  setFilter: (filter) => set({ filter }),
}));
