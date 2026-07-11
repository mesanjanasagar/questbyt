import { useEffect, useState } from 'react';
import { getCustomerById } from '../api/customers';
import type { Customer } from '@pos/shared-types';

interface LoyaltyModalProps {
  customerId?: string;
  onOpenCustomer: () => void;
  onClose: () => void;
}

const TIER_COLOR: Record<string, string> = {
  silver: 'bg-neutral-100 text-neutral-700',
  gold: 'bg-yellow-100 text-yellow-800',
  platinum: 'bg-indigo-100 text-indigo-700',
};

export default function LoyaltyModal({ customerId, onOpenCustomer, onClose }: LoyaltyModalProps) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(!!customerId);

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    getCustomerById(customerId)
      .then(setCustomer)
      .finally(() => setLoading(false));
  }, [customerId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-primary-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg">Loyalty</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="p-6">
          {!customerId ? (
            <div className="text-center py-4">
              <p className="text-sm text-gray-500 mb-4">Attach a customer to this order to view their loyalty balance.</p>
              <button onClick={onOpenCustomer} className="btn-primary px-5 py-2 text-sm">
                Attach Customer
              </button>
            </div>
          ) : loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading…</div>
          ) : customer ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{customer.name}</p>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${TIER_COLOR[customer.loyaltyTier]}`}>
                  {customer.loyaltyTier}
                </span>
              </div>
              <div className="bg-primary-50 border border-primary-100 rounded-xl p-4 text-center">
                <p className="text-xs text-primary-600 font-medium uppercase tracking-wide">Points Balance</p>
                <p className="text-3xl font-bold text-primary-800 mt-1">{customer.loyaltyPoints}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Total Orders</p>
                  <p className="text-lg font-bold text-gray-900">{customer.totalOrders}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Total Spend</p>
                  <p className="text-lg font-bold text-gray-900">AED {customer.totalSpend.toFixed(0)}</p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">Could not load customer loyalty details.</p>
          )}
        </div>
      </div>
    </div>
  );
}
