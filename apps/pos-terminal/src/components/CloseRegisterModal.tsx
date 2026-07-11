import { useState } from 'react';
import { closeShift, type ShiftSummary } from '../api/shifts';

interface CloseRegisterModalProps {
  summary: ShiftSummary;
  onSuccess: () => void;
  onClose: () => void;
}

export default function CloseRegisterModal({ summary, onSuccess, onClose }: CloseRegisterModalProps) {
  const [countedCash, setCountedCash] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ShiftSummary | null>(null);

  const expectedCash = summary.shift.openingBalance + summary.cashSales - summary.cashRefunds + summary.cashIn - summary.cashOut;
  const counted = parseFloat(countedCash) || 0;
  const variance = counted - expectedCash;

  async function handleClose() {
    setError('');
    if (!countedCash || isNaN(counted) || counted < 0) {
      setError('Count and enter the actual cash in the drawer');
      return;
    }
    setSaving(true);
    try {
      const closed = await closeShift(summary.shift.id, counted, notes.trim() || undefined);
      setResult(closed);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not close shift';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (result) {
    const v = result.shift.variance ?? 0;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
          <div className="bg-primary-800 text-white px-6 py-4">
            <h2 className="font-bold text-lg">Shift Closed</h2>
          </div>
          <div className="p-6 text-center space-y-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${Math.abs(v) <= 0.01 ? 'bg-green-100' : 'bg-amber-100'}`}>
              <span className="text-3xl">{Math.abs(v) <= 0.01 ? '✓' : '!'}</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">
                {Math.abs(v) <= 0.01 ? 'Drawer balanced exactly.' : v > 0 ? 'Drawer has more cash than expected.' : 'Drawer is short.'}
              </p>
              <p className={`text-2xl font-bold mt-1 ${Math.abs(v) <= 0.01 ? 'text-gray-900' : v > 0 ? 'text-success-700' : 'text-red-600'}`}>
                {v > 0 ? '+' : ''}AED {v.toFixed(2)}
              </p>
            </div>
            <button onClick={onSuccess} className="btn-primary w-full py-2.5 text-sm">Done</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden max-h-[85vh] flex flex-col">
        <div className="bg-primary-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-lg">Close Register</h2>
          <button onClick={onClose} disabled={saving} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Opening balance</span><span>AED {summary.shift.openingBalance.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Cash sales</span><span>AED {summary.cashSales.toFixed(2)}</span></div>
            {summary.cashRefunds > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Cash refunds</span><span>-AED {summary.cashRefunds.toFixed(2)}</span></div>
            )}
            {summary.cashIn > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Cash in</span><span>+AED {summary.cashIn.toFixed(2)}</span></div>
            )}
            {summary.cashOut > 0 && (
              <div className="flex justify-between"><span className="text-gray-500">Cash out</span><span>-AED {summary.cashOut.toFixed(2)}</span></div>
            )}
            <div className="flex justify-between pt-2 border-t border-gray-100 font-bold">
              <span>Expected in drawer</span><span>AED {expectedCash.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-gray-400 pt-1">
              <span>Card / wallet / online sales (not cash)</span>
              <span>AED {(summary.cardSales + summary.walletSales + summary.onlineSales).toFixed(2)}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Actual Cash Counted</label>
            <input
              type="number"
              value={countedCash}
              onChange={(e) => setCountedCash(e.target.value)}
              placeholder={expectedCash.toFixed(2)}
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            {countedCash && (
              <p className={`text-xs mt-1 ${Math.abs(variance) <= 0.01 ? 'text-gray-400' : variance > 0 ? 'text-success-600' : 'text-red-600'}`}>
                {Math.abs(variance) <= 0.01 ? 'Matches expected' : `${variance > 0 ? 'Over' : 'Short'} by AED ${Math.abs(variance).toFixed(2)}`}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Verified with manager"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-2 shrink-0">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button onClick={handleClose} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
            {saving ? 'Closing…' : 'Close Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
