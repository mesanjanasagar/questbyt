import { useState } from 'react';
import { openShift } from '../api/shifts';

interface OpenShiftModalProps {
  storeId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export default function OpenShiftModal({ storeId, onSuccess, onClose }: OpenShiftModalProps) {
  const [openingBalance, setOpeningBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleOpen() {
    setError('');
    const balance = parseFloat(openingBalance);
    if (isNaN(balance) || balance < 0) {
      setError('Enter a valid opening cash amount');
      return;
    }
    setSaving(true);
    try {
      await openShift(storeId, balance, notes.trim() || undefined);
      onSuccess();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not open shift';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-primary-800 text-white px-6 py-4">
          <h2 className="font-bold text-lg">Open Shift</h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Count the cash currently in the drawer before taking any orders. This becomes the
            starting point for today's reconciliation.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Opening Cash Amount</label>
            <input
              type="number"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Counted with manager"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
            Not now
          </button>
          <button onClick={handleOpen} disabled={saving} className="btn-primary px-5 py-2 text-sm disabled:opacity-60">
            {saving ? 'Opening…' : 'Open Shift'}
          </button>
        </div>
      </div>
    </div>
  );
}
