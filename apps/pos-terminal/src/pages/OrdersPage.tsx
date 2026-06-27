import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';
import { listOrders } from '../api/orders';
import CheckoutModal from '../components/CheckoutModal';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { Order } from '@pos/shared-types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  cooking: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function OrdersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const storeId = useAuthStore((s) => s.user?.storeId ?? '');
  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['orders', storeId],
    queryFn: () => listOrders({ storeId }),
    enabled: !!storeId,
    refetchInterval: 10000, // poll every 10s
  });

  const orders: Order[] = data?.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary-800 text-white px-6 py-4 flex items-center justify-between">
        <h1 className="font-bold text-lg">Orders</h1>
        <button onClick={() => navigate('/')} className="text-white/70 hover:text-white text-sm">
          ← Back to POS
        </button>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="text-center py-12 text-gray-400">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No orders yet today</div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="card flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">
                    #{order.id.slice(-8)}
                    {order.tableNumber && (
                      <span className="ml-2 text-sm text-gray-500">Table {order.tableNumber}</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {order.orderType} • {new Date(order.createdAt).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[order.status] ?? 'bg-gray-100'}`}
                  >
                    {order.status}
                  </span>
                  <span className="font-bold text-gray-900 w-24 text-right">
                    AED {order.totalAmount.toFixed(2)}
                  </span>
                  {order.paymentStatus === 'unpaid' && order.status !== 'cancelled' && (
                    <button
                      onClick={() => setCheckoutOrder(order)}
                      className="btn-primary text-xs px-3 py-1.5 whitespace-nowrap"
                    >
                      Pay
                    </button>
                  )}
                  {order.paymentStatus === 'paid' && (
                    <span className="text-xs text-green-600 font-medium px-3 py-1.5">Paid</span>
                  )}
                  {order.paymentStatus === 'refunded' && (
                    <span className="text-xs text-gray-500 font-medium px-3 py-1.5">Refunded</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {checkoutOrder && (
        <CheckoutModal
          orderId={checkoutOrder.id}
          storeId={storeId}
          totalAmount={checkoutOrder.totalAmount}
          onSuccess={() => {
            setCheckoutOrder(null);
            queryClient.invalidateQueries({ queryKey: ['orders', storeId] });
          }}
          onClose={() => setCheckoutOrder(null)}
        />
      )}
    </div>
  );
}