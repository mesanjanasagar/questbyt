export interface Order {
  id: string;
  storeId: string;
  orderNumber: number;
  orderType: 'dine-in' | 'takeout' | 'delivery';
  status: 'pending' | 'in-progress' | 'ready' | 'delivered' | 'cancelled';
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  modifiers: Modifier[];
  status: 'pending' | 'in-progress' | 'ready' | 'served';
  station: 'grill' | 'fryer' | 'bar' | 'general';
  prepTime?: number;
  createdAt: string;
  completedAt?: string;
}

export interface Modifier {
  id: string;
  name: string;
  value: string;
}

export interface OrderQueue {
  pending: Order[];
  inProgress: Order[];
  ready: Order[];
}

export interface KDSFilter {
  orderType: 'all' | 'dine-in' | 'takeout' | 'delivery';
  station: 'all' | 'grill' | 'fryer' | 'bar' | 'general';
}