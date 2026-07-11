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
  // Legacy walk-in / takeout lifecycle
  PENDING = 'pending',
  COOKING = 'cooking',
  COMPLETED = 'completed',
  // Shared
  READY = 'ready',
  CANCELLED = 'cancelled',
  // Dine-in lifecycle
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  BILL_REQUESTED = 'bill_requested',
  PAID = 'paid',
  CLOSED = 'closed',
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
  // Legacy
  COOKING = 'cooking',
  // Active statuses
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  PREPARING = 'preparing',
  READY = 'ready',
  // Waiter has picked the item up from the pass but hasn't necessarily set it
  // down at the table yet — distinct from READY (kitchen's done) so the KDS
  // can tell "cooked" apart from "handed off" for expo/pickup tracking.
  COLLECTED = 'collected',
  SERVED = 'served',
  CANCELLED = 'cancelled',
}

export enum TableStatus {
  AVAILABLE = 'available',
  OCCUPIED = 'occupied',
  FOOD_PREPARING = 'food_preparing',
  READY_TO_SERVE = 'ready_to_serve',
  BILL_REQUESTED = 'bill_requested',
  PAID = 'paid',
  CLEANING = 'cleaning',
  RESERVED = 'reserved',
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

export enum DietaryType {
  VEG = 'veg',
  NON_VEG = 'non_veg',
}

export enum Platform {
  DIRECT = 'direct',
  KIOSK = 'kiosk',
  DELIVEROO = 'deliveroo',
  TALABAT = 'talabat',
  NOON = 'noon',
  CAREEM = 'careem',
}

export enum DiscountType {
  PERCENTAGE = 'percentage',
  FIXED = 'fixed',
}