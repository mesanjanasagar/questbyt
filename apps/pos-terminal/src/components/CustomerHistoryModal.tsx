import { useEffect, useState } from 'react';
import { listOrders } from '../api/orders';
import type { Customer, Order } from '@pos/shared-types';

interface CustomerHistoryModalProps {
  storeId: string;
  customer: Customer;
  onClose: () => void;
}

export default function CustomerHistoryModal({ storeId, customer, onClose }: CustomerHistoryModalProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listOrders({ storeId, customerId: customer.id, limit: 25 })
      .then((res) => { if (!cancelled) setOrders(res.data ?? []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [storeId, customer.id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col overflow-hidden">
        <div className="bg-primary-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-lg">Customer History</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-gray-900">{customer.name}</p>
            {customer.phone && <p className="text-sm text-gray-500">{customer.phone}</p>}
          </div>
          <div className="grid grid-cols-3 gap-4 mt-3">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Visits</p>
              <p className="text-lg font-bold text-gray-900">{customer.totalOrders}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Avg Bill</p>
              <p className="text-lg font-bold text-gray-900">AED {customer.averageOrderValue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Customer Since</p>
              <p className="text-sm font-medium text-gray-700 mt-1">
                {customer.firstOrderAt ? new Date(customer.firstOrderAt).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="text-center py-8 text-gray-400 text-sm">Loading orders…</div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No past orders yet</div>
          ) : (
            <div className="space-y-2">
              {orders.map((o) => (
                <div key={o.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      #{o.id.slice(-8)}
                      {o.tableNumber != null && <span className="ml-2 text-xs text-gray-500 font-normal">Table {o.tableNumber}</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 capitalize">
                      {o.orderType} · {new Date(o.createdAt).toLocaleDateString()} {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="font-bold text-gray-900">AED {o.totalAmount.toFixed(2)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
