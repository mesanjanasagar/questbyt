import { useState } from 'react';
import { PaymentMethod } from '@pos/shared-types';
import { processPayment } from '../api/payments';

interface CheckoutModalProps {
  orderId: string;
  storeId: string;
  totalAmount: number;
  onSuccess: (changeDue?: number) => void;
  onClose: () => void;
}

const PAYMENT_METHODS = [
  { value: PaymentMethod.CASH, label: 'Cash', icon: '💵' },
  { value: PaymentMethod.CARD, label: 'Card', icon: '💳' },
  { value: PaymentMethod.WALLET, label: 'Wallet', icon: '📱' },
] as const;

export default function CheckoutModal({
  orderId,
  storeId,
  totalAmount,
  onSuccess,
  onClose,
}: CheckoutModalProps) {
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [cashTendered, setCashTendered] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ changeDue: number } | null>(null);

  const parsedCash = parseFloat(cashTendered) || 0;
  const changeDue = selectedMethod === PaymentMethod.CASH
    ? Math.max(0, parsedCash - totalAmount)
    : 0;
  const cashIsInsufficient =
    selectedMethod === PaymentMethod.CASH && parsedCash > 0 && parsedCash < totalAmount;

  // Quick-cash denomination buttons
  const quickAmounts = [
    Math.ceil(totalAmount / 10) * 10,
    Math.ceil(totalAmount / 50) * 50,
    Math.ceil(totalAmount / 100) * 100,
  ].filter((v, i, arr) => arr.indexOf(v) === i && v >= totalAmount);

  async function handlePay() {
    setError('');
    if (selectedMethod === PaymentMethod.CASH && parsedCash < totalAmount) {
      setError('Cash tendered must be at least the order total.');
      return;
    }

    setProcessing(true);
    try {
      const payment = await processPayment({
        orderId,
        storeId,
        amount: totalAmount,
        paymentMethod: selectedMethod,
        cashTendered: selectedMethod === PaymentMethod.CASH ? parsedCash : undefined,
        idempotencyKey: `${orderId}-${selectedMethod}-${Date.now()}`,
      });

      const change = payment.changeDue ?? 0;
      setSuccess({ changeDue: change });

      // Show change confirmation for 2 seconds then call onSuccess
      setTimeout(() => onSuccess(change), change > 0 ? 2000 : 800);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Payment failed. Please try again.';
      setError(msg);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-primary-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg">Checkout</h2>
          <button
            onClick={onClose}
            disabled={processing}
            className="text-white/70 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-xl font-bold text-gray-900 mb-1">Payment Successful</p>
            <p className="text-gray-500 text-sm">AED {totalAmount.toFixed(2)} received</p>
            {success.changeDue > 0 && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-700 font-medium">Change Due</p>
                <p className="text-3xl font-bold text-green-800 mt-1">
                  AED {success.changeDue.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Order total */}
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-sm text-gray-500">Amount Due</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">
                AED {totalAmount.toFixed(2)}
              </p>
            </div>

            {/* Payment method selector */}
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Payment Method</p>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => {
                      setSelectedMethod(m.value);
                      setCashTendered('');
                      setError('');
                    }}
                    className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                      selectedMethod === m.value
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-xl">{m.icon}</span>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash input */}
            {selectedMethod === PaymentMethod.CASH && (
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Cash Tendered</p>
                <input
                  type="number"
                  min={totalAmount}
                  step="0.01"
                  value={cashTendered}
                  onChange={(e) => { setCashTendered(e.target.value); setError(''); }}
                  placeholder={`Min. AED ${totalAmount.toFixed(2)}`}
                  className={`w-full border rounded-lg px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    cashIsInsufficient ? 'border-red-400 bg-red-50' : 'border-gray-300'
                  }`}
                />

                {/* Quick-amount buttons */}
                {quickAmounts.length > 0 && (
                  <div className="flex gap-2 mt-2">
                    {quickAmounts.map((amt) => (
                      <button
                        key={amt}
                        onClick={() => setCashTendered(String(amt))}
                        className="flex-1 text-xs py-1.5 border border-gray-300 rounded-lg hover:bg-gray-100 text-gray-600"
                      >
                        AED {amt}
                      </button>
                    ))}
                  </div>
                )}

                {/* Change preview */}
                {parsedCash >= totalAmount && (
                  <div className="mt-3 flex justify-between items-center bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <span className="text-sm text-blue-700">Change</span>
                    <span className="font-bold text-blue-800">AED {changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Card / Wallet message */}
            {selectedMethod !== PaymentMethod.CASH && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center text-sm text-gray-500">
                {selectedMethod === PaymentMethod.CARD
                  ? 'Present card to terminal'
                  : 'Customer scans QR / NFC'}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                disabled={processing}
                className="btn-secondary flex-1 py-3"
              >
                Cancel
              </button>
              <button
                onClick={handlePay}
                disabled={
                  processing ||
                  (selectedMethod === PaymentMethod.CASH &&
                    (parsedCash === 0 || cashIsInsufficient))
                }
                className="btn-primary flex-1 py-3"
              >
                {processing ? 'Processing...' : `Pay AED ${totalAmount.toFixed(2)}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}