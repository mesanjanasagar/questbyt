export type ReservationStatus = 'confirmed' | 'arrived' | 'seated' | 'completed' | 'cancelled' | 'no_show';
export type TableStatus = 'available' | 'reserved' | 'occupied' | 'cleaning';

export interface Reservation {
  id: string;
  storeId: string;
  customerId: string | null;
  tableId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  partySize: number;
  reservedDate: string;
  reservedTime: string;
  status: ReservationStatus;
  notes: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantTable {
  id: string;
  storeId: string;
  tableNumber: string;
  capacity: number;
  location: string | null;
  status: TableStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationCancellation {
  id: string;
  reservationId: string;
  reason: string;
  cancelledBy: 'customer' | 'staff' | 'system';
  refundAmount: number | null;
  cancelledAt: string;
}