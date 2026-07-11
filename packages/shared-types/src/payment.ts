export interface Payment {
  id: string;
  orderId: string;
  storeId: string;
  amount: number;
  paymentMethod: string;
  paymentGateway?: string;
  transactionId?: string;
  status: 'pending' | 'success' | 'failed' | 'refunded';
  cashTendered?: number;
  changeDue?: number;
  metadata?: Record<string, unknown>;
  // Only populated on the response from POST /payments/process — lets the
  // caller know whether this payment covered the order's full remaining
  // balance (relevant for split-bill flows where several partial payments
  // are collected against the same order).
  remainingBalance?: number;
  isFullyPaid?: boolean;
  createdAt: string;
  processedAt?: string;
}

export interface Refund {
  id: string;
  paymentId: string;
  amount: number;
  reason: string;
  status: 'pending' | 'success' | 'failed';
  createdAt: string;
}

export interface ProcessPaymentRequest {
  orderId: string;
  amount: number;
  paymentMethod: string;
  cashTendered?: number;
  cardToken?: string;
  receiptDetails?: {
    email?: string;
    phone?: string;
  };
  idempotencyKey: string;
}

export interface RefundRequest {
  amount: number;
  reason: string;
}