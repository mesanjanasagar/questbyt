import { useState } from 'react';
import { recordCashMovement, type ShiftSummary } from '../api/shifts';

interface CashManagementModalProps {
  summary: ShiftSummary;
  onChanged: () => void;
  onClose: () => void;
}

export default function CashManagementModal({ summary, onChanged, onClose }: CashManagementModalProps) {
  const [type, setType] = useState<'cash_in' | 'cash_out'>('cash_out');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const drawerNow = summary.shift.openingBalance + summary.cashSales - summary.cashRefunds + summary.cashIn - summary.cashOut;

  async function handleRecord() {
    setError('');
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (!reason.trim()) {
      setError('A reason is required');
      return;
    }
    setSaving(true);
    try {
      await recordCashMovement(summary.shift.id, type, amt, reason.trim());
      setAmount('');
      setReason('');
      onChanged();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not record cash movement';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="bg-primary-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-lg">Cash Management</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Opening</p>
              <p className="font-bold text-gray-900">AED {summary.shift.openingBalance.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Cash Sales</p>
              <p className="font-bold text-gray-900">AED {summary.cashSales.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Card / Other Sales</p>
              <p className="font-bold text-gray-900">AED {(summary.cardSales + summary.walletSales + summary.onlineSales).toFixed(2)}</p>
            </div>
            <div>
              <p className="text-gray-400 text-xs uppercase tracking-wide">Expected in Drawer</p>
              <p className="font-bold text-primary-700">AED {drawerNow.toFixed(2)}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Record Cash In / Out</p>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setType('cash_in')}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  type === 'cash_in' ? 'border-success-500 bg-success-50 text-success-700' : 'border-gray-200 text-gray-500'
                }`}
              >
                Cash In
              </button>
              <button
                onClick={() => setType('cash_out')}
                className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                  type === 'cash_out' ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'
                }`}
              >
                Cash Out
              </button>
            </div>
            <div className="space-y-2">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={type === 'cash_out' ? 'Reason, e.g. paid supplier' : 'Reason, e.g. added float'}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
            <button
              onClick={handleRecord}
              disabled={saving}
              className="btn-primary w-full mt-3 py-2.5 text-sm disabled:opacity-60"
            >
              {saving ? 'Recording…' : `Record ${type === 'cash_in' ? 'Cash In' : 'Cash Out'}`}
            </button>
          </div>

          {summary.movements.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">This Shift's Movements</p>
              <div className="space-y-1.5">
                {summary.movements.slice().reverse().map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm border-b border-gray-100 pb-1.5">
                    <div>
                      <span className={m.type === 'cash_in' ? 'text-success-600' : 'text-red-500'}>
                        {m.type === 'cash_in' ? '+' : '−'} AED {m.amount.toFixed(2)}
                      </span>
                      <span className="text-gray-400 ml-2 text-xs">{m.reason}</span>
                    </div>
                    <span className="text-gray-400 text-xs">
                      {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
