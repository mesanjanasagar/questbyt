import React, { useEffect, useState, useCallback } from 'react';
import { dashboardAPI } from '../api/dashboard';
import { useDashboardStore } from '../store/dashboardStore';

interface Order {
  id: string;
  orderNumber: number;
  orderType: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-700',
  'in-progress': 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  delivered: 'bg-teal-100 text-teal-800',
  cancelled: 'bg-red-100 text-red-800',
};

export const OrdersPage: React.FC = () => {
  const { selectedStoreId } = useDashboardStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const res = await import('../api/client').then((m) => m.default.get('/orders', {
        params: {
          storeId: selectedStoreId || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          limit: 100,
        },
      }));
      setOrders(res.data.data ?? []);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedStoreId, statusFilter]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const counts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Live Orders</h2>
        <div className="flex gap-2 text-sm">
          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full font-semibold">
            {counts['in-progress'] ?? 0} In Progress
          </span>
          <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full font-semibold">
            {counts['ready'] ?? 0} Ready
          </span>
          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-semibold">
            {counts['pending'] ?? 0} Pending
          </span>
        </div>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'in-progress', 'ready', 'delivered', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Order #</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Type</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Items</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Total</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No orders found</td></tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-bold text-gray-900">#{order.orderNumber}</td>
                  <td className="px-5 py-3 capitalize text-gray-600">{order.orderType}</td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-700'}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-gray-700">{order.itemCount}</td>
                  <td className="px-5 py-3 text-right font-medium text-gray-800">${order.totalAmount.toFixed(2)}</td>
                  <td className="px-5 py-3 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};