export interface KDSOrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  itemName?: string;
  quantity: number;
  unitPrice: number;
  modifications: Array<{ modifierId: string; modifierName: string; priceAdjustment: number }>;
  notes?: string;
  status: 'pending' | 'accepted' | 'preparing' | 'ready' | 'collected' | 'served' | 'cancelled';
  kdsDispatchedAt?: string;
  createdAt: string;
}

export interface KDSOrder {
  id: string;
  storeId: string;
  orderNumber: number;
  orderType: 'dine-in' | 'takeout' | 'delivery';
  status: string;
  tableNumber?: number;
  tableId?: string;
  notes?: string;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: KDSOrderItem[];
}

export interface KDSFilter {
  orderType: 'all' | 'dine-in' | 'takeout' | 'delivery';
}

export type KDSColumn = 'new' | 'in-progress' | 'ready';

// Mirrors computeOrderStage() in services/order-service/src/services/order.service.ts —
// keep both in lockstep if either changes. Order status is *derived*, never set
// directly: it's always a function of its own item statuses.
//
// Collected/served items don't count toward "active" here because a fully
// collected order is removed from the board entirely (via the ORDER_COLLECTED
// SSE event) rather than shown as a fourth column — the KDS only has 3.
export function getOrderColumn(order: KDSOrder): KDSColumn {
  const active = order.items.filter(
    (i) => i.kdsDispatchedAt && i.status !== 'served' && i.status !== 'collected' && i.status !== 'cancelled',
  );
  if (active.length === 0) return 'ready';
  // Only "New" while nothing has been touched yet. The moment any item is
  // accepted/preparing, the whole ticket moves to "In Progress" even if other
  // items on it are still pending — a partially-started order isn't "new".
  if (active.every((i) => i.status === 'pending')) return 'new';
  if (active.every((i) => i.status === 'ready')) return 'ready';
  return 'in-progress';
}

export interface KDSProgress {
  /** items that have reached ready or beyond (ready/collected/served) */
  ready: number;
  /** dispatched, non-cancelled items */
  total: number;
  percent: number;
}

export function getOrderProgress(order: KDSOrder): KDSProgress {
  const active = order.items.filter((i) => i.kdsDispatchedAt && i.status !== 'cancelled');
  const total = active.length;
  const ready = active.filter((i) => i.status === 'ready' || i.status === 'collected' || i.status === 'served').length;
  const percent = total === 0 ? 100 : Math.round((ready / total) * 100);
  return { ready, total, percent };
}
