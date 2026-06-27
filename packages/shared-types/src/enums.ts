//  ─────────────────────────────────────────────────────────────────────────────
// Shared enums used across all services
//  ─────────────────────────────────────────────────────────────────────────────

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  CASHIER = 'cashier',
  KITCHEN = 'kitchen',
  WAITER = 'waiter',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

export enum DeviceType {
  POS_TERMINAL = 'pos_terminal',
  KDS = 'kds',
  MOBILE = 'mobile',
  KIOSK = 'kiosk',
  DASHBOARD = 'dashboard',
}

export enum DeviceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  REVOKED = 'revoked',
}

export enum OrderStatus {
  PENDING = 'pending',
  COOKING = 'cooking',
  READY = 'ready',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum OrderType {
  DINE_IN = 'dine-in',
  TAKEOUT = 'takeout',
  DELIVERY = 'delivery',
}

export enum PaymentStatus {
  UNPAID = 'unpaid',
  PAID = 'paid',
  REFUNDED = 'refunded',
}

export enum PaymentMethod {
  CASH = 'cash',
  CARD = 'card',
  ONLINE = 'online',
  WALLET = 'wallet',
}

export enum OrderItemStatus {
  PENDING = 'pending',
  COOKING = 'cooking',
  READY = 'ready',
  SERVED = 'served',
}

export enum InventoryUnitType {
  PIECE = 'piece',
  KG = 'kg',
  LITER = 'liter',
  BOX = 'box',
}

export enum StockMovementType {
  PURCHASE = 'purchase',
  SALE = 'sale',
  ADJUSTMENT = 'adjustment',
  WASTE = 'waste',
  RETURN = 'return',
}

export enum MenuItemStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SOLD_OUT = 'sold_out',
  HIDDEN = 'hidden',
}

export enum Platform {
  DIRECT = 'direct',
  DELIVEROO = 'deliveroo',
  TALABAT = 'talabat',
  NOON = 'noon',
  CAREEM = 'careem',
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}