import { useState, useEffect, useRef } from 'react';
import { lookupCustomer, createCustomer, updateCustomer } from '../api/customers';
import type { Customer } from '@pos/shared-types';

interface CustomerModalProps {
  storeId: string;
  currentCustomerId?: string;
  currentCustomerName?: string;
  currentCustomerPhone?: string;
  onAttach: (customer: Customer) => void;
  onRemove: () => void;
  onViewHistory: (customer: Customer) => void;
  onClose: () => void;
}

export default function CustomerModal({
  storeId,
  currentCustomerId,
  currentCustomerName,
  currentCustomerPhone,
  onAttach,
  onRemove,
  onViewHistory,
  onClose,
}: CustomerModalProps) {
  const [phone, setPhone] = useState(currentCustomerPhone ?? '');
  const [name, setName] = useState(currentCustomerName ?? '');
  const [email, setEmail] = useState('');
  const [matched, setMatched] = useState<Customer | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const lookupTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced lookup-as-you-type on phone — the fastest path to an existing
  // customer's record without making the cashier hunt through a list.
  useEffect(() => {
    if (lookupTimer.current) clearTimeout(lookupTimer.current);
    if (phone.trim().length < 5) {
      setMatched(null);
      return;
    }
    lookupTimer.current = setTimeout(async () => {
      setLooking(true);
      try {
        const found = await lookupCustomer(storeId, phone.trim());
        setMatched(found);
        if (found) {
          setName(found.name);
          setEmail(found.email ?? '');
        }
      } finally {
        setLooking(false);
      }
    }, 400);
    return () => { if (lookupTimer.current) clearTimeout(lookupTimer.current); };
  }, [phone, storeId]);

  async function handleSave() {
    setError('');
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    try {
      let customer: Customer;
      if (matched) {
        customer = await updateCustomer(matched.id, {
          name: name.trim(),
          email: email.trim() || undefined,
        });
      } else {
        customer = await createCustomer({
          storeId,
          name: name.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        });
      }
      onAttach(customer);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Could not save customer. Please try again.';
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="bg-primary-800 text-white px-6 py-4 flex items-center justify-between">
          <h2 className="font-bold text-lg">Customer Details</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mobile</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile No."
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
            />
            {looking && <p className="text-xs text-gray-400 mt-1">Looking up…</p>}
            {matched && !looking && (
              <p className="text-xs text-success-600 mt-1 font-medium">
                Existing customer found — {matched.totalOrders} past order{matched.totalOrders !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-400"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2 pt-2">
            {matched && (
              <button
                onClick={() => onViewHistory(matched)}
                className="text-sm text-primary-700 font-medium hover:underline"
              >
                View Order History
              </button>
            )}
            {currentCustomerId && (
              <button
                onClick={onRemove}
                className="text-sm text-gray-400 hover:text-red-600 ml-auto"
              >
                Remove from order
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 py-4 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary px-5 py-2 text-sm disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
