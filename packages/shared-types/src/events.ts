//  ─────────────────────────────────────────────────────────────────────────────
// Domain event types for Kafka event bus
//  ─────────────────────────────────────────────────────────────────────────────

export type EventType =
  | 'order.created'
  | 'order.item_added'
  | 'order.item_removed'
  | 'order.item_updated'
  | 'order.status_updated'
  | 'order.cancelled'
  | 'order.completed'
  | 'inventory.reserved'
  | 'inventory.adjusted'
  | 'inventory.deducted'
  | 'inventory.low_stock'
  | 'inventory.out_of_stock'
  | 'campaign.sent'
  | 'payment.processed'
  | 'payment.failed'
  | 'payment.refunded'
  | 'customer.created'
  | 'customer.segment_changed'
  | 'customer.points_earned'
  | 'device.synced'
  | 'device.offline'
  | 'device.online'
  | 'menu.updated'
  | 'sync.queue_added'
  | 'sync.reconciled'
  | 'sync.conflict_detected'
  | 'churn.scored'
  | 'churn.risk_identified'
  | 'churn.engaged'
  | 'reservation.created'
  | 'reservation.cancelled'
  | 'reservation.checked_in'
  | 'table.status_changed'
  | 'forecast.generated'
  | 'shift.recommended'
  | 'staffing.alert_triggered'
  // Store lifecycle
  | 'store_created_v1'
  | 'store_updated_v1'
  | 'store_deleted_v1'
  // Branch lifecycle
  | 'branch_created_v1'
  | 'branch_updated_v1'
  // Table lifecycle
  | 'table_created_v1'
  | 'table_updated_v1'
  | 'table_deleted_v1'
  // Staff lifecycle
  | 'staff_created_v1'
  | 'staff_updated_v1'
  | 'staff_deleted_v1'
  // Device lifecycle
  | 'device_registered_v1'
  | 'device_updated_v1'
  // Menu lifecycle
  | 'menu_created_v1'
  | 'menu_updated_v1'
  | 'menu_deleted_v1'
  | 'category_created_v1'
  | 'category_updated_v1'
  | 'menu_item_created_v1'
  | 'menu_item_updated_v1'
  | 'menu_item_deleted_v1'
  | 'modifier_group_created_v1'
  | 'modifier_created_v1'
  // Inventory lifecycle
  | 'inventory_item_created_v1'
  | 'inventory_stock_initialized_v1'
  | 'inventory_stock_adjusted_v1'
  | 'inventory_reserved_v1'
  | 'inventory_released_v1'
  | 'inventory_consumed_v1'
  | 'inventory_low_stock_v1'
  | 'inventory_out_of_stock_v1'
  | 'recipe_created_v1'
  | 'recipe_updated_v1'
  // Order lifecycle
  | 'order_created_v1'
  | 'order_confirmed_v1'
  | 'order_sent_to_kds_v1'
  | 'order_accepted_v1'
  | 'order_preparing_v1'
  | 'order_ready_v1'
  | 'order_served_v1'
  | 'order_completed_v1'
  | 'order_cancelled_v1'
  // Payment lifecycle
  | 'payment_initiated_v1'
  | 'payment_completed_v1'
  | 'payment_failed_v1'
  | 'payment_refunded_v1'
  // Reservation lifecycle
  | 'reservation_created_v1'
  | 'reservation_confirmed_v1'
  | 'reservation_cancelled_v1'
  | 'reservation_completed_v1'
  // Customer lifecycle
  | 'customer_created_v1'
  | 'customer_updated_v1'
  | 'customer_loyalty_updated_v1'
  // Notification
  | 'notification_sent_v1'
  // Restaurant onboarding
  | 'restaurant_onboarding_started_v1'
  | 'restaurant_onboarding_completed_v1'
  // Shift lifecycle
  | 'restaurant_opened_v1'
  | 'restaurant_closed_v1'
  | 'shift_opened_v1'
  | 'shift_closed_v1';

export interface DomainEvent<T = unknown> {
  eventId: string;
  eventType: EventType;
  aggregateId: string;
  aggregateType: string;
  version: number;
  timestamp: string;
  sourceService: string;
  sourceDeviceId?: string;
  userId?: string;
  storeId: string;
  data: T;
  metadata: EventMetadata;
}

export interface EventMetadata {
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
}

export interface OrderCreatedEvent {
  orderId: string;
  storeId: string;
  cashierId: string;
  deviceId: string;
  orderType: string;
  items: Array<{
    menuItemId: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
}

export interface OrderStatusUpdatedEvent {
  orderId: string;
  previousStatus: string;
  newStatus: string;
  reason?: string;
}

export interface InventoryAdjustedEvent {
  productId: string;
  storeId: string;
  previousStock: number;
  newStock: number;
  movementType: string;
  referenceId?: string;
}

export interface PaymentProcessedEvent {
  paymentId: string;
  orderId: string;
  storeId: string;
  amount: number;
  paymentMethod: string;
  transactionId: string;
}

export interface CustomerCreatedEvent {
  customerId: string;
  storeId: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface CustomerSegmentChangedEvent {
  customerId: string;
  storeId: string;
  previousSegment: string;
  newSegment: string;
}

export interface CustomerPointsEarnedEvent {
  customerId: string;
  storeId: string;
  orderId: string;
  pointsEarned: number;
  newBalance: number;
}

export interface InventoryDeductedEvent {
  orderId: string;
  storeId: string;
  items: Array<{
    productId: string;
    quantityDeducted: number;
    remainingStock: number;
  }>;
}

export interface InventoryLowStockEvent {
  productId: string;
  storeId: string;
  currentStock: number;
  reorderLevel: number;
  alertId: string;
}

export interface CampaignSentEvent {
  campaignId: string;
  customerId: string;
  storeId: string;
  channel: string;
  executionId: string;
}

export interface SyncQueueAddedEvent {
  queueId: string;
  deviceId: string;
  storeId: string;
  operationType: string;
  resourceType: string;
}

export interface SyncReconciledEvent {
  queueId: string;
  deviceId: string;
  storeId: string;
  reconciledItemCount: number;
  conflictCount: number;
}

export interface ChurnScoredEvent {
  customerId: string;
  storeId: string;
  churnScore: number;
  riskLevel: string;
  previousScore?: number;
}

export interface ChurnRiskIdentifiedEvent {
  customerId: string;
  storeId: string;
  riskLevel: string;
  triggerType: string;
  campaignId?: string;
}

export interface ReservationCreatedEvent {
  reservationId: string;
  customerId?: string;
  storeId: string;
  customerName: string;
  partySize: number;
  reservedDate: string;
  reservedTime: string;
}

export interface ReservationCancelledEvent {
  reservationId: string;
  storeId: string;
  reason: string;
  cancelledBy: string;
}

export interface TableStatusChangedEvent {
  tableId: string;
  storeId: string;
  previousStatus: string;
  newStatus: string;
}

export interface ForecastGeneratedEvent {
  storeId: string;
  forecastDate: string;
  totalPredictedOrders: number;
  avgConfidence: number;
}

export interface ShiftRecommendedEvent {
  storeId: string;
  recommendationDate: string;
  recommendedStaffCount: number;
  shiftType: string;
}

export interface StaffingAlertTriggeredEvent {
  storeId: string;
  alertDate: string;
  alertType: string;
  severity: string;
  message: string;
}

// ─── Onboarding events ───────────────────────────────────────────────────────

export interface StoreCreatedEvent {
  storeId: string;
  name: string;
  businessType: string;
  currency: string;
  timezone: string;
}

export interface BranchCreatedEvent {
  branchId: string;
  storeId: string;
  branchCode: string;
  name: string;
  isMain: boolean;
}

export interface DiningAreaCreatedEvent {
  diningAreaId: string;
  branchId: string;
  storeId: string;
  name: string;
  floorNumber: number;
}

export interface TableCreatedEvent {
  tableId: string;
  diningAreaId: string;
  branchId: string;
  storeId: string;
  tableNumber: string;
  capacity: number;
}

export interface StaffCreatedEvent {
  userId: string;
  storeId: string;
  branchId?: string;
  username: string;
  role: string;
  employeeNumber: string;
}

export interface DeviceRegisteredEvent {
  deviceId: string;
  storeId: string;
  branchId?: string;
  deviceName: string;
  deviceType: string;
}

export interface PaymentConfigurationUpdatedEvent {
  storeId: string;
  enabledMethods: string[];
  cashEnabled: boolean;
  cardEnabled: boolean;
}

export interface NotificationConfigurationUpdatedEvent {
  storeId: string;
  channels: string[];
  lowStockAlerts: boolean;
  orderAlerts: boolean;
}

export interface RestaurantOnboardingStartedEvent {
  storeId: string;
  startedAt: string;
}

export interface RestaurantOnboardingCompletedEvent {
  storeId: string;
  completedAt: string;
  branchCount: number;
  staffCount: number;
  menuItemCount: number;
}

export interface ShiftOpenedEvent {
  storeId: string;
  branchId: string;
  shiftId: string;
  openedBy: string;
  openedAt: string;
}

export interface ShiftClosedEvent {
  storeId: string;
  branchId: string;
  shiftId: string;
  closedBy: string;
  closedAt: string;
  totalRevenue: number;
}