//  ─────────────────────────────────────────────────────────────────────────────
// Domain event types for Kafka event bus
//  ─────────────────────────────────────────────────────────────────────────────

export type EventType =
  | 'order.created'
  | 'order.item_added'
  | 'order.item_removed'
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
  | 'staffing.alert_triggered';

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