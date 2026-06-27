import React, { useState, useEffect } from 'react';
import { Order, OrderItem } from '../types';
import { formatDistanceToNow } from 'date-fns';
import { ordersAPI } from '../api/orders';

interface OrderCardProps {
  order: Order;
  onStatusChange: (order: Order) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({ order, onStatusChange }) => {
  const [updating, setUpdating] = useState(false);
  const createdTime = new Date(order.createdAt);
  const elapsedMinutes = Math.floor((Date.now() - createdTime.getTime()) / 60000);

  // Color coding: green (0-15 min), yellow (15-30 min), red (30+ min)
  const getUrgencyColor = () => {
    if (elapsedMinutes < 15) return 'border-green-500 bg-green-50';
    if (elapsedMinutes < 30) return 'border-yellow-500 bg-yellow-50';
    return 'border-red-500 bg-red-50';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'in-progress':
        return 'bg-blue-100 text-blue-800';
      case 'ready':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const handleStatusAdvance = async () => {
    if (updating) return;
    setUpdating(true);

    const nextStatus = order.status === 'pending' ? 'in-progress' : 'ready';
    try {
      const updated = await ordersAPI.updateOrderStatus(order.id, nextStatus);
      onStatusChange(updated);
    } catch (err) {
      console.error('Failed to update order:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handleItemComplete = async (item: OrderItem) => {
    if (updating) return;
    setUpdating(true);

    try {
      const updated = await ordersAPI.updateItemStatus(order.id, item.id, 'ready');
      onStatusChange(updated);
    } catch (err) {
      console.error('Failed to update item:', err);
    } finally {
      setUpdating(false);
    }
  };

  const allItemsReady = order.items.every((item) => item.status === 'ready' || item.status === 'served');

  return (
    <div className={`border-4 rounded-lg p-4 ${getUrgencyColor()} shadow-lg`}>
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-2xl font-bold">Order #{order.orderNumber}</h3>
          <p className="text-sm text-gray-600">
            {formatDistanceToNow(createdTime, { addSuffix: true })} ({elapsedMinutes}m)
          </p>
        </div>
        <div className="text-right">
          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
            {order.status.toUpperCase()}
          </span>
          <p className="text-sm text-gray-600 mt-1">
            {order.orderType === 'dine-in' && '🍽 Dine-In'}
            {order.orderType === 'takeout' && '🥡 Takeout'}
            {order.orderType === 'delivery' && '🛵 Delivery'}
          </p>
        </div>
      </div>

      <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
        {order.items.map((item) => (
          <div
            key={item.id}
            className={`p-2 rounded flex justify-between items-center cursor-pointer transition ${
              item.status === 'ready' || item.status === 'served'
                ? 'bg-green-200 line-through'
                : item.status === 'in-progress'
                ? 'bg-blue-200'
                : 'bg-white border border-gray-300'
            }`}
            onClick={() => handleItemComplete(item)}
          >
            <div className="flex-1">
              <p className="font-semibold">
                {item.quantity}x {item.itemName}
              </p>
              {item.modifiers.length > 0 && (
                <p className="text-xs text-gray-600">
                  {item.modifiers.map((m) => `${m.name}: ${m.value}`).join(', ')}
                </p>
              )}
            </div>
            <span className="text-xs font-bold bg-gray-200 px-2 py-1 rounded">
              {item.station.toUpperCase()}
            </span>
          </div>
        ))}
      </div>

      {order.status === 'pending' && (
        <button
          onClick={handleStatusAdvance}
          disabled={updating}
          className="w-full py-3 rounded-lg font-bold text-lg transition bg-blue-600 hover:bg-blue-700 text-white"
        >
          {updating ? 'Updating...' : '▶ Start Order'}
        </button>
      )}
      {order.status === 'in-progress' && (
        <button
          onClick={handleStatusAdvance}
          disabled={!allItemsReady || updating}
          className={`w-full py-3 rounded-lg font-bold text-lg transition ${
            allItemsReady
              ? 'bg-green-600 hover:bg-green-700 text-white'
              : 'bg-gray-300 text-gray-600 cursor-not-allowed'
          }`}
        >
          {updating ? 'Updating...' : allItemsReady ? '✓ Mark Order Ready' : 'Complete all items first'}
        </button>
      )}
    </div>
  );
};