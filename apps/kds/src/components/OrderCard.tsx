import { useState } from 'react';
import type { KDSOrder, KDSOrderItem, KDSColumn } from '../types';
import { getOrderProgress } from '../types';

interface OrderCardProps {
  order: KDSOrder;
  column: KDSColumn;
  onItemStatus: (orderId: string, itemId: string, status: KDSOrderItem['status']) => Promise<void>;
}

const ITEM_NEXT: Record<KDSOrderItem['status'], KDSOrderItem['status'] | null> = {
  pending: 'accepted',
  accepted: 'preparing',
  preparing: 'ready',
  ready: 'collected',
  collected: 'served',
  served: null,
  cancelled: null,
};

const ITEM_NEXT_LABEL: Record<string, string> = {
  pending: 'Accept',
  accepted: 'Preparing',
  preparing: 'Ready',
  ready: 'Collected',
  collected: 'Served',
};

const ITEM_STATUS_STYLE: Record<KDSOrderItem['status'], string> = {
  pending: 'bg-orange-900/40 border-orange-700 text-orange-300',
  accepted: 'bg-blue-900/40 border-blue-700 text-blue-300',
  preparing: 'bg-yellow-900/40 border-yellow-700 text-yellow-300',
  ready: 'bg-green-900/40 border-green-700 text-green-300',
  collected: 'bg-teal-900/30 border-teal-800 text-teal-400',
  served: 'bg-neutral-800 border-neutral-700 text-neutral-500 line-through',
  cancelled: 'bg-neutral-900 border-neutral-800 text-neutral-600 line-through',
};

function elapsed(createdAt: string): string {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 1) return '<1m';
  return `${mins}m`;
}

function urgencyStyle(createdAt: string): string {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 15) return 'border-neutral-700';
  if (mins < 30) return 'border-yellow-600';
  return 'border-red-600';
}

export function OrderCard({ order, column: _column, onItemStatus }: OrderCardProps) {
  const [updating, setUpdating] = useState<string | null>(null);

  // Cancelled items are dropped entirely — everything else (including
  // collected/served) stays visible so the kitchen can see what's already
  // been handed off, matching a real expo board.
  const visibleItems = order.items.filter((i) => i.kdsDispatchedAt && i.status !== 'cancelled');
  const progress = getOrderProgress(order);

  async function advanceItem(item: KDSOrderItem) {
    const next = ITEM_NEXT[item.status];
    if (!next || updating) return;
    setUpdating(item.id);
    try {
      await onItemStatus(order.id, item.id, next);
    } finally {
      setUpdating(null);
    }
  }

  const tableLabel = order.tableNumber != null ? `Table ${order.tableNumber}` : null;

  return (
    <div className={`bg-neutral-900 border-2 ${urgencyStyle(order.createdAt)} rounded-xl overflow-hidden`}>
      {/* Card header */}
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-800/60 border-b border-neutral-700">
        <div className="flex items-center gap-2">
          <span className="font-black text-white text-base">#{order.orderNumber}</span>
          {tableLabel && (
            <span className="bg-brand-700/60 text-brand-200 text-xs font-bold px-2 py-0.5 rounded-lg">
              {tableLabel}
            </span>
          )}
          <span className="text-xs text-neutral-500 capitalize">
            {order.orderType === 'dine-in' ? 'Dine-In' : order.orderType === 'takeout' ? 'Take-Away' : 'Delivery'}
          </span>
        </div>
        <span className="text-xs font-bold text-neutral-400">{elapsed(order.createdAt)}</span>
      </div>

      {/* Progress bar — X/Y items ready, updates as items change state */}
      {progress.total > 0 && (
        <div className="px-4 py-2 bg-neutral-800/30 border-b border-neutral-800">
          <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 mb-1">
            <span>{progress.ready} / {progress.total} Ready</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-1.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${progress.percent === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>
      )}

      {/* Order-level kitchen note */}
      {order.notes && (
        <div className="px-4 py-2 bg-amber-900/30 border-b border-amber-800/60">
          <p className="text-xs text-amber-300 italic">📝 {order.notes}</p>
        </div>
      )}

      {/* Items */}
      <div className="p-3 space-y-2">
        {visibleItems.length === 0 && (
          <p className="text-xs text-neutral-500 text-center py-3">No active items</p>
        )}
        {visibleItems.map((item) => {
          const nextStatus = ITEM_NEXT[item.status];
          const nextLabel = ITEM_NEXT_LABEL[item.status];
          const isUpdating = updating === item.id;
          const isOptionalStep = item.status === 'collected'; // "Served" is optional per spec

          return (
            <div
              key={item.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${ITEM_STATUS_STYLE[item.status]}`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm leading-tight">
                  <span className="text-white">{item.quantity}×</span>{' '}
                  {item.itemName ?? item.menuItemId.slice(0, 8)}
                </p>
                {item.modifications && item.modifications.length > 0 && (
                  <p className="text-xs opacity-70 mt-0.5">
                    {item.modifications.map((m) => m.modifierName).join(', ')}
                  </p>
                )}
                {item.notes && (
                  <p className="text-xs italic opacity-70 mt-0.5">{item.notes}</p>
                )}
              </div>

              {nextStatus && nextLabel && (
                <button
                  onClick={() => advanceItem(item)}
                  disabled={isUpdating}
                  className={`shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                    isOptionalStep
                      ? 'bg-transparent border border-neutral-600 text-neutral-400 hover:border-neutral-400 hover:text-neutral-200'
                      : item.status === 'pending'
                      ? 'bg-orange-600 hover:bg-orange-500 text-white'
                      : item.status === 'accepted'
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : item.status === 'ready'
                      ? 'bg-teal-600 hover:bg-teal-500 text-white'
                      : 'bg-green-600 hover:bg-green-500 text-white'
                  } disabled:opacity-50`}
                >
                  {isUpdating ? '…' : nextLabel}
                </button>
              )}

              {(item.status === 'ready' || item.status === 'collected' || item.status === 'served') && (
                <span className="shrink-0 text-green-400 text-lg font-bold">✓</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary footer when the whole order has reached ready-or-beyond */}
      {progress.total > 0 && progress.percent === 100 && (
        <div className="px-4 py-2.5 bg-green-900/30 border-t border-green-800 text-center">
          <span className="text-green-300 text-xs font-bold">✓ ALL ITEMS READY</span>
        </div>
      )}
    </div>
  );
}
