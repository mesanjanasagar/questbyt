import { useState } from 'react';
import { applyDiscount, removeDiscount } from '../api/orders';
import type { Order } from '@pos/shared-types';

interface DiscountModalProps {
  orderId: string;
  currentDiscountAmount: number;
  onApplied: (order: Order) => void;
  onClose: () => void;
}

type Mode = 'promo' | 'manual';

export default function DiscountModal({ orderId, currentDiscountAmount, onApplied, onClose }: DiscountModalProps) {
  const [mode, setMode] = useState<Mode>('promo');
  const [promoCode, setPromoCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');

  async function handleApply() {
    setError('');
    setSaving(true);
    try {
      const order = mode === 'promo'
        ? await applyDiscount(orderId, { promoCode: promoCode.trim() })
        : await applyDiscount(orderId, {
            discountType,
            discountValue: parseFloat(discountValue),
            reason: reason.trim() || undefined,
          });
      onApplied(order);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not apply discount. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    try {
      const order = await removeDiscount(orderId);
      onApplied(order);
    } catch {
      setError('Could not remove discount');
    } finally {
      setRemoving(false);
    }
  }

  const canApply = mode === 'promo'
    ? promoCode.trim().length > 0
    : discountValue.trim().length > 0 && parseFloat(discountValue) > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-primary-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg">Apply Discount</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setMode('promo')}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${mode === 'promo' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Promo Code
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-colors ${mode === 'manual' ? 'bg-white shadow text-gray-900' : 'text-gray-500'}`}
            >
              Manual
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {mode === 'promo' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Promo Code</label>
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="WELCOME10"
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
              />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'fixed')}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed (AED)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    placeholder={discountType === 'percentage' ? '10' : '25.00'}
                    autoFocus
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Manager comp, birthday, etc."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {currentDiscountAmount > 0 && (
            <button
              onClick={handleRemove}
              disabled={removing}
              className="text-sm text-gray-400 hover:text-red-600"
            >
              {removing ? 'Removing…' : `Remove current discount (AED ${currentDiscountAmount.toFixed(2)})`}
            </button>
          )}
        </div>

        <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={handleApply}
            disabled={saving || !canApply}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-60"
          >
            {saving ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
