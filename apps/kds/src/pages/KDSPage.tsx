import React, { useEffect, useState, useCallback } from 'react';
import { useKDSStore } from '../store/kdsStore';
import { Order, KDSFilter } from '../../types';
import { OrderCard } from '../components/OrderCard';
import { FilterBar } from '../components/FilterBar';
import { ordersAPI } from '../api/orders';

export const KDSPage: React.FC = () => {
  const { orders, filter, setOrders, updateOrder, setFilter } = useKDSStore();
  const [loading, setLoading] = useState(true);
  const [storeId] = useState(localStorage.getItem('storeId') || 'default-store');

  // Fetch orders periodically
  const fetchOrders = useCallback(async () => {
    try {
      const data = await ordersAPI.getOrders(storeId);
      setOrders(data);
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [storeId, setOrders]);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000); // Poll every 5 seconds
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (filter.orderType !== 'all' && order.orderType !== filter.orderType) {
      return false;
    }

    if (filter.station !== 'all') {
      const hasStation = order.items.some((item) => item.station === filter.station);
      if (!hasStation) return false;
    }

    return true;
  });

  // Organize into queues
  const pending = filteredOrders.filter((o) => o.status === 'pending');
  const inProgress = filteredOrders.filter((o) => o.status === 'in-progress');
  const ready = filteredOrders.filter((o) => o.status === 'ready');

  if (loading && orders.length === 0) {
    return <div className="flex items-center justify-center h-screen text-2xl">Loading...</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen">
      <FilterBar filter={filter} onFilterChange={setFilter} />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pending Queue */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-bold mb-4 text-gray-800">
              ⬜ New Orders ({pending.length})
            </h2>
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {pending.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No pending orders</p>
              ) : (
                pending.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={(updated) => updateOrder(updated)}
                  />
                ))
              )}
            </div>
          </div>

          {/* In Progress Queue */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-bold mb-4 text-blue-800">
              🔵 In Progress ({inProgress.length})
            </h2>
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {inProgress.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No orders in progress</p>
              ) : (
                inProgress.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={(updated) => updateOrder(updated)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Ready Queue */}
          <div className="bg-white rounded-lg shadow-lg p-4">
            <h2 className="text-xl font-bold mb-4 text-green-800">
              ✅ Ready for Pickup ({ready.length})
            </h2>
            <div className="space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
              {ready.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No ready orders</p>
              ) : (
                ready.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onStatusChange={(updated) => updateOrder(updated)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};