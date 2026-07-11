import api from './client';

export interface PromoCode {
  id: string;
  storeId: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  firstTimeCustomerOnly: boolean;
  minOrderAmount?: number;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

function unwrap<T>(res: { data: { data?: T } & T }): T {
  return (res.data as any).data ?? res.data;
}

export const promoCodesAPI = {
  list: (storeId: string) =>
    api.get('/orders/promo-codes', { params: { storeId } }).then(unwrap<PromoCode[]>),

  create: (body: {
    storeId: string; code: string; description?: string;
    discountType: 'percentage' | 'fixed'; discountValue: number;
    firstTimeCustomerOnly?: boolean; minOrderAmount?: number; maxUses?: number; expiresAt?: string;
  }) => api.post('/orders/promo-codes', body).then(unwrap<PromoCode>),

  update: (id: string, body: Partial<{
    description: string; discountType: 'percentage' | 'fixed'; discountValue: number;
    firstTimeCustomerOnly: boolean; minOrderAmount: number | null; maxUses: number | null;
    isActive: boolean; expiresAt: string | null;
  }>) => api.patch(`/orders/promo-codes/${id}`, body).then(unwrap<PromoCode>),

  remove: (id: string) => api.delete(`/orders/promo-codes/${id}`).then((r) => r.data),
};
