import axios from 'axios';
import { Order, OrderItem } from '../types';

const API_BASE = 'http://localhost:3000/api/v1';

// — Mock data ————————————————————————————————————
const now = () => new Date().toISOString();
const minsAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

let mockOrders: Order[] = [
  {
    id: 'o-1', storeId: 'store-1', orderNumber: 38, orderType: 'takeout',
    status: 'in-progress', totalAmount: 23.98, createdAt: minsAgo(18), updatedAt: minsAgo(10),
    items: [
      { id: 'oi-1', menuItemId: 'item-2', itemName: 'BBQ Bacon Burger', quantity: 2, unitPrice: 11.99, modifiers: [], status: 'ready', station: 'grill', createdAt: minsAgo(18) },
      { id: 'oi-2', menuItemId: 'item-7', itemName: 'Onion Rings', quantity: 1, unitPrice: 4.49, modifiers: [], status: 'in-progress', station: 'fryer', createdAt: minsAgo(18) },
      { id: 'oi-3', menuItemId: 'item-10', itemName: 'Coke', quantity: 2, unitPrice: 2.49, modifiers: [], status: 'ready', station: 'bar', createdAt: minsAgo(18) },
    ],
  },
  {
    id: 'o-2', storeId: 'store-1', orderNumber: 39, orderType: 'dine-in',
    status: 'in-progress', totalAmount: 47.95, createdAt: minsAgo(28), updatedAt: minsAgo(5),
    items: [
      { id: 'oi-4', menuItemId: 'item-3', itemName: 'Mushroom Swiss', quantity: 1, unitPrice: 10.99, modifiers: [{ id: 'm-1', name: 'Size', value: 'Large' }], status: 'ready', station: 'grill', createdAt: minsAgo(28) },
      { id: 'oi-5', menuItemId: 'item-6', itemName: 'Pepperoni Pizza', quantity: 2, unitPrice: 14.99, modifiers: [], status: 'in-progress', station: 'general', createdAt: minsAgo(28) },
      { id: 'oi-6', menuItemId: 'item-12', itemName: 'Milkshake', quantity: 2, unitPrice: 4.99, modifiers: [{ id: 'm-2', name: 'Flavour', value: 'Chocolate' }], status: 'ready', station: 'bar', createdAt: minsAgo(28) },
    ],
  },
  {
    id: 'o-3', storeId: 'store-1', orderNumber: 41, orderType: 'dine-in',
    status: 'pending', totalAmount: 16.48, createdAt: minsAgo(2), updatedAt: minsAgo(2),
    items: [
      { id: 'oi-7', menuItemId: 'item-1', itemName: 'Classic Burger', quantity: 1, unitPrice: 8.99, modifiers: [{ id: 'm-3', name: 'Extra', value: 'Cheese' }], status: 'pending', station: 'grill', createdAt: minsAgo(2) },
      { id: 'oi-8', menuItemId: 'item-7', itemName: 'Large Fries', quantity: 1, unitPrice: 3.99, modifiers: [], status: 'pending', station: 'fryer', createdAt: minsAgo(2) },
      { id: 'oi-9', menuItemId: 'item-10', itemName: 'Coke', quantity: 2, unitPrice: 2.49, modifiers: [], status: 'pending', station: 'bar', createdAt: minsAgo(2) },
    ],
  },
  {
    id: 'o-4', storeId: 'store-1', orderNumber: 42, orderType: 'delivery',
    status: 'pending', totalAmount: 32.97, createdAt: minsAgo(0), updatedAt: minsAgo(0),
    items: [
      { id: 'oi-10', menuItemId: 'item-5', itemName: 'Margherita Pizza', quantity: 1, unitPrice: 12.99, modifiers: [{ id: 'm-4', name: 'Crust', value: 'Thin' }], status: 'pending', station: 'general', createdAt: minsAgo(0) },
      { id: 'oi-11', menuItemId: 'item-2', itemName: 'BBQ Bacon Burger', quantity: 1, unitPrice: 11.99, modifiers: [], status: 'pending', station: 'grill', createdAt: minsAgo(0) },
      { id: 'oi-12', menuItemId: 'item-11', itemName: 'Fresh Lemonade', quantity: 2, unitPrice: 3.49, modifiers: [], status: 'pending', station: 'bar', createdAt: minsAgo(0) },
    ],
  },
  {
    id: 'o-5', storeId: 'store-1', orderNumber: 35, orderType: 'dine-in',
    status: 'ready', totalAmount: 22.97, createdAt: minsAgo(32), updatedAt: minsAgo(3),
    items: [
      { id: 'oi-13', menuItemId: 'item-4', itemName: 'Veggie Patty', quantity: 1, unitPrice: 9.49, modifiers: [], status: 'ready', station: 'grill', createdAt: minsAgo(32) },
      { id: 'oi-14', menuItemId: 'item-7', itemName: 'Large Fries', quantity: 1, unitPrice: 3.99, modifiers: [], status: 'ready', station: 'fryer', createdAt: minsAgo(32) },
      { id: 'oi-15', menuItemId: 'item-11', itemName: 'Fresh Lemonade', quantity: 1, unitPrice: 3.49, modifiers: [], status: 'ready', station: 'bar', createdAt: minsAgo(32) },
    ],
  },
];

// — API ————————————————————————————————————
export const ordersAPI = {
  getOrders: async (_storeId: string): Promise<Order[]> => {
    try {
      const response = await axios.get<{ data: Order[] }>(`${API_BASE}/orders`, {
        params: { storeId: _storeId, status: 'pending,in-progress,ready' },
      });
      return response.data.data;
    } catch {
      return mockOrders.filter((o) => ['pending', 'in-progress', 'ready'].includes(o.status));
    }
  },

  getOrder: async (orderId: string): Promise<Order> => {
    try {
      const response = await axios.get<{ data: Order }>(`${API_BASE}/orders/${orderId}`);
      return response.data.data;
    } catch {
      const found = mockOrders.find((o) => o.id === orderId);
      if (!found) throw new Error('Order not found');
      return found;
    }
  },

  updateOrderStatus: async (orderId: string, status: string): Promise<Order> => {
    try {
      const response = await axios.patch<{ data: Order }>(
        `${API_BASE}/orders/${orderId}/status`,
        { status }
      );
      return response.data.data;
    } catch {
      // Update in mock store
      mockOrders = mockOrders.map((o) => {
        if (o.id !== orderId) return o;
        return { ...o, status: status as Order['status'], updatedAt: now() };
      });
      const updated = mockOrders.find((o) => o.id === orderId)!;
      return updated;
    }
  },

  updateItemStatus: async (
    orderId: string,
    itemId: string,
    status: 'in-progress' | 'ready' | 'served'
  ): Promise<Order> => {
    try {
      const response = await axios.patch<{ data: Order }>(
        `${API_BASE}/orders/${orderId}/items/${itemId}`,
        { status }
      );
      return response.data.data;
    } catch {
      // Update item in mock store
      mockOrders = mockOrders.map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          updatedAt: now(),
          items: o.items.map((item) =>
            item.id === itemId ? { ...item, status } : item
          ),
        };
      });
      const updated = mockOrders.find((o) => o.id === orderId)!;
      return updated;
    }
  },
};