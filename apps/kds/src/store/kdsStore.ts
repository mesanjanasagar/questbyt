import { create } from 'zustand';
import { Order, KDSFilter } from '../types';

interface KDSStore {
  orders: Order[];
  filter: KDSFilter;
  selectedOrder: Order | null;

  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (order: Order) => void;
  removeOrder: (orderId: string) => void;

  setFilter: (filter: KDSFilter) => void;
  setSelectedOrder: (order: Order | null) => void;
}

export const useKDSStore = create<KDSStore>((set) => ({
  orders: [],
  filter: {
    orderType: 'all',
    station: 'all',
  },
  selectedOrder: null,

  setOrders: (orders) => set({ orders }),
  addOrder: (order) => set((state) => ({ orders: [order, ...state.orders] })),
  updateOrder: (order) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === order.id ? order : o)),
      selectedOrder: state.selectedOrder?.id === order.id ? order : state.selectedOrder,
    })),
  removeOrder: (orderId) =>
    set((state) => ({
      orders: state.orders.filter((o) => o.id !== orderId),
    })),

  setFilter: (filter) => set({ filter }),
  setSelectedOrder: (order) => set({ selectedOrder: order }),
}));