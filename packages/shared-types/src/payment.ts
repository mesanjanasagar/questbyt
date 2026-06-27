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