import {
  OrderStatus,
  OrderType,
  PaymentStatus,
  PaymentMethod,
  OrderItemStatus,
  Platform,
  DiscountType,
} from './enums';

export interface Order {
  id: string;
  storeId: string;
  deviceId: string;
  cashierId: string;
  customerId?: string;
  status: OrderStatus;
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  orderType: OrderType;
  tableNumber?: number;
  notes?: string;
  platform: Platform;
  platformOrderId?: string;
  commissionRate: number;
  commissionAmount: number;
  netRevenue?: number;
  createdOffline: boolean;
  syncedAt?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  orderId: string;
  menuItemId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  modifications?: OrderItemModification[];
  notes?: string;
  status: OrderItemStatus;
  createdAt: string;
}

export interface OrderItemModification {
  modifierId: string;
  modifierName: string;
  priceAdjustment: number;
}

export interface OrderDiscount {
  id: string;
  orderId: string;
  discountType: DiscountType;
  discountValue: number;
  reason?: string;
  appliedBy: string;
  appliedAt: string;
}

export interface CreateOrderRequest {
  storeId: string;
  deviceId: string;
  cashierId: string;
  customerId?: string;
  orderType: OrderType;
  tableNumber?: number;
  notes?: string;
  platform?: Platform;
  items: CreateOrderItemRequest[];
}

export interface CreateOrderItemRequest {
  menuItemId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  modifications?: OrderItemModification[];
  notes?: string;
}

export interface UpdateOrderStatusRequest {
  status: OrderStatus;
  reason?: string;
}

export interface AddOrderItemRequest {
  menuItemId: string;
  variantId?: string;
  quantity: number;
  unitPrice: number;
  modifications?: OrderItemModification[];
  notes?: string;
}

export interface CancelOrderRequest {
  reason: string;
}

export interface OrderListQuery {
  storeId: string;
  status?: OrderStatus;
  from?: string;
  to?: string;
  platform?: Platform;
  page?: number;
  limit?: number;
}