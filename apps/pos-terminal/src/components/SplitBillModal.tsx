import { useState, useEffect } from 'react';
import { PaymentMethod } from '@pos/shared-types';
import { processPayment, getPaymentSummary } from '../api/payments';

interface SplitBillModalProps {
  orderId: string;
  storeId: string;
  onSuccess: () => void;
  onClose: () => void;
}

const PAYMENT_METHODS = [
  { value: PaymentMethod.CASH, label: 'Cash', icon: '💵' },
  { value: PaymentMethod.CARD, label: 'Card', icon: '💳' },
  { value: PaymentMethod.WALLET, label: 'Wallet', icon: '📱' },
] as const;

const WAYS_PRESETS = [2, 3, 4, 5, 6];

export default function SplitBillModal({ orderId, storeId, onSuccess, onClose }: SplitBillModalProps) {
  const [loading, setLoading] = useState(true);
  const [remainingBalance, setRemainingBalance] = useState(0);
  const [paidCount, setPaidCount] = useState(0);
  const [error, setError] = useState('');

  const [ways, setWays] = useState<number | null>(null);
  const [customWays, setCustomWays] = useState('');

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [cashTendered, setCashTendered] = useState('');
  const [processing, setProcessing] = useState(false);
  const [lastChange, setLastChange] = useState<number | null>(null);

  // Reopening a table that already has some shares collected — pick up
  // where the last cashier left off rather than re-splitting the full total.
  useEffect(() => {
    let cancelled = false;
    getPaymentSummary(orderId)
      .then((summary) => {
        if (cancelled) return;
        setRemainingBalance(summary.remainingBalance);
        setPaidCount(summary.payments.length);
      })
      .catch(() => setError('Could not load payment status for this order'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderId]);

  const effectiveWays = ways ?? (customWays ? parseInt(customWays, 10) : 0);
  const shareAmount = effectiveWays > 0 ? parseFloat((remainingBalance / effectiveWays).toFixed(2)) : 0;
  // Rounding remainder (splitting AED 10 three ways is 3.33/3.33/3.34) goes
  // on the last share so the shares always sum to exactly what's owed.
  const lastShareAmount = effectiveWays > 0
    ? parseFloat((remainingBalance - shareAmount * (effectiveWays - 1)).toFixed(2))
    : 0;
  const currentShareIndex = paidCount % Math.max(effectiveWays, 1);
  const isLastShare = effectiveWays > 0 && currentShareIndex === effectiveWays - 1;
  const currentShareAmount = effectiveWays > 0 ? (isLastShare ? lastShareAmount : shareAmount) : 0;

  const parsedCash = parseFloat(cashTendered) || 0;
  const changeDue = selectedMethod === PaymentMethod.CASH
    ? Math.max(0, parsedCash - currentShareAmount)
    : 0;
  const cashIsInsufficient =
    selectedMethod === PaymentMethod.CASH && parsedCash > 0 && parsedCash < currentShareAmount;

  async function handleCollectShare() {
    setError('');
    if (selectedMethod === PaymentMethod.CASH && parsedCash < currentShareAmount) {
      setError('Cash tendered must be at least the share amount.');
      return;
    }
    setProcessing(true);
    try {
      const payment = await processPayment({
        orderId,
        storeId,
        amount: currentShareAmount,
        paymentMethod: selectedMethod,
        cashTendered: selectedMethod === PaymentMethod.CASH ? parsedCash : undefined,
        idempotencyKey: `${orderId}-split-${paidCount}-${Date.now()}`,
      });

      if (payment.isFullyPaid) {
        setLastChange(payment.changeDue ?? 0);
        setTimeout(() => onSuccess(), (payment.changeDue ?? 0) > 0 ? 1500 : 600);
        return;
      }

      // More shares left — reset the payment inputs and advance.
      setPaidCount((p) => p + 1);
      setRemainingBalance((r) => Math.max(0, parseFloat((r - currentShareAmount).toFixed(2))));
      setCashTendered('');
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
        <div className="bg-primary-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg">Split Bill</h2>
          <button onClick={onClose} disabled={processing} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : lastChange !== null ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✓</span>
            </div>
            <p className="text-xl font-bold text-gray-900 mb-1">Bill Fully Settled</p>
            {lastChange > 0 && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4">
                <p className="text-sm text-green-700 font-medium">Change Due (last share)</p>
                <p className="text-3xl font-bold text-green-800 mt-1">AED {lastChange.toFixed(2)}</p>
              </div>
            )}
          </div>
        ) : ways === null && !customWays ? (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">Remaining Balance</p>
              <p className="text-3xl font-bold text-gray-900">AED {remainingBalance.toFixed(2)}</p>
              {paidCount > 0 && (
                <p className="text-xs text-gray-400 mt-1">{paidCount} share{paidCount !== 1 ? 's' : ''} already collected</p>
              )}
            </div>
            <p className="text-sm font-medium text-gray-700">Split into how many ways?</p>
            <div className="grid grid-cols-5 gap-2">
              {WAYS_PRESETS.map((n) => (
                <button
                  key={n}
                  onClick={() => setWays(n)}
                  className="border-2 border-gray-200 hover:border-primary-400 rounded-xl py-3 text-lg font-bold text-gray-800 transition-colors"
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={2}
                value={customWays}
                onChange={(e) => setCustomWays(e.target.value)}
                placeholder="Custom number of ways"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={() => { if (parseInt(customWays, 10) >= 2) setWays(parseInt(customWays, 10)); }}
                className="btn-primary px-4 py-2.5 text-sm"
              >
                Go
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-500">
                Share {currentShareIndex + 1} of {effectiveWays}
              </p>
              <p className="text-3xl font-bold text-gray-900">AED {currentShareAmount.toFixed(2)}</p>
              <p className="text-xs text-gray-400 mt-1">AED {remainingBalance.toFixed(2)} remaining overall</p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m.value}
                  onClick={() => { setSelectedMethod(m.value); setCashTendered(''); setError(''); }}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition-colors ${
                    selectedMethod === m.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                  }`}
                >
                  <span className="text-xl">{m.icon}</span>
                  <span className="text-xs font-medium text-gray-700">{m.label}</span>
                </button>
              ))}
            </div>

            {selectedMethod === PaymentMethod.CASH && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cash Tendered</label>
                <input
                  type="number"
                  value={cashTendered}
                  onChange={(e) => setCashTendered(e.target.value)}
                  placeholder={currentShareAmount.toFixed(2)}
                  autoFocus
                  className={`w-full border rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 ${
                    cashIsInsufficient ? 'border-red-300 focus:ring-red-400' : 'border-gray-300 focus:ring-primary-500'
                  }`}
                />
                {changeDue > 0 && (
                  <p className="text-xs text-green-600 mt-1">Change due: AED {changeDue.toFixed(2)}</p>
                )}
              </div>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
        )}

        {!loading && lastChange === null && ways !== null && (
          <div className="border-t border-gray-100 px-6 py-4 flex justify-between gap-2">
            <button
              onClick={() => setWays(null)}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              Change split
            </button>
            <button
              onClick={handleCollectShare}
              disabled={processing || (selectedMethod === PaymentMethod.CASH && cashIsInsufficient)}
              className="btn-primary px-5 py-2 text-sm disabled:opacity-60"
            >
              {processing ? 'Processing…' : `Collect AED ${currentShareAmount.toFixed(2)}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
