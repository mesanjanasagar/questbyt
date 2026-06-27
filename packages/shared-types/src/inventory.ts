import { InventoryUnitType, StockMovementType } from './enums';

export interface Product {
  id: string;
  storeId: string;
  sku?: string;
  name: string;
  description?: string;
  categoryId?: string;
  unitType: InventoryUnitType;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
  updatedAt: string;
}

export interface InventoryRecord {
  id: string;
  productId: string;
  storeId: string;
  currentStock: number;
  reservedStock: number;
  availableStock: number;
  reorderLevel?: number;
  reorderQuantity?: number;
  lastCountedAt?: string;
  updatedAt: string;
}

export interface StockMovement {
  id: string;
  productId: string;
  storeId: string;
  movementType: StockMovementType;
  quantity: number;
  referenceId?: string;
  referenceType?: string;
  notes?: string;
  createdBy: string;
  createdAt: string;
}

export interface StockReservation {
  reservationId: string;
  productId: string;
  orderId: string;
  reservedQuantity: number;
  createdAt: string;
}

export interface LowStockAlert {
  id: string;
  storeId: string;
  productId: string;
  alertLevel: number;
  status: 'pending' | 'acknowledged' | 'resolved';
  createdAt: string;
  acknowledgedAt?: string;
}

export interface AdjustStockRequest {
  adjustmentQuantity: number;
  reason: string;
  referenceId?: string;
}

export interface ReserveStockRequest {
  productId: string;
  quantity: number;
  orderId: string;
}

export interface ReleaseStockRequest {
  reservationId: string;
}