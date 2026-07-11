import React, { useEffect, useRef, useCallback } from 'react';
import { useKDSStore } from '../store/kdsStore';
import { useKDSAuthStore } from '../store/authStore';
import { fetchKDSOrders, updateItemStatus as apiUpdateItemStatus } from '../api/orders';
import { getMyStaffProfile } from '../api/staff';
import { getSSEUrl, refreshAccessToken } from '../api/client';
import { OrderCard } from '../components/OrderCard';
import type { KDSOrder, KDSOrderItem } from '../types';
import { getOrderColumn } from '../types';

const COL_CONFIG = {
  'new': { label: 'New Orders', dot: 'bg-orange-400', header: 'border-orange-500' },
  'in-progress': { label: 'In Progress', dot: 'bg-blue-400', header: 'border-blue-500' },
  'ready': { label: 'Ready', dot: 'bg-green-400', header: 'border-green-500' },
} as const;

export function KDSPage() {
  const { orders, filter, setOrders, upsertOrder, appendItems, updateItemStatus, removeOrder, setFilter } = useKDSStore();
  const { token, storeId, username, logout } = useKDSAuthStore();
  const esRef = useRef<EventSource | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [connectionStatus, setConnectionStatus] = React.useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  // A store with several physical branches has a separate kitchen per branch —
  // without this, this screen would show every branch's tickets, which reads
  // as someone else's order sitting on your board (same fix as the POS side).
  const [branchId, setBranchId] = React.useState<string | undefined>(undefined);
  const branchIdRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    getMyStaffProfile()
      .then((profile) => {
        setBranchId(profile.branchId);
        branchIdRef.current = profile.branchId;
      })
      .catch(() => { /* no staff profile — falls back to store-wide, same as before */ });
  }, []);

  // Initial load
  useEffect(() => {
    if (!storeId) return;
    fetchKDSOrders(storeId, branchId)
      .then((data) => setOrders(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [storeId, branchId, setOrders]);

  // Periodic reconciliation — SSE is fire-and-forget with no replay, so any
  // event that arrives while the connection is mid-reconnect (token refresh,
  // network blip) is lost for good. Without this, a ticket whose removal
  // event got dropped stays stuck on the board — looking "in progress" here
  // while the table's already free on the POS side — until someone manually
  // reloads the page. Re-fetching the server's actual state self-heals that.
  useEffect(() => {
    if (!storeId) return;
    const reconcile = setInterval(() => {
      fetchKDSOrders(storeId, branchIdRef.current).then(setOrders).catch(console.error);
    }, 60_000);
    return () => clearInterval(reconcile);
  }, [storeId, setOrders]);

  // SSE subscription
  useEffect(() => {
    if (!storeId || !token) return;

    function connect() {
      const url = getSSEUrl(storeId!);
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener('connected', () => setConnectionStatus('connected'));

      es.addEventListener('ORDER_DISPATCHED', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as {
          orderId: string;
          storeId: string;
          branchId?: string;
          orderNumber: number;
          tableNumber?: number;
          tableId?: string;
          orderType: string;
          notes?: string;
          items: KDSOrderItem[];
        };
        // SSE broadcasts store-wide (no per-branch channel), so a live event
        // for another branch's order still arrives here — drop it the same
        // way the initial REST fetch already does. An order with no
        // branchId at all (legacy/untagged) still shows everywhere.
        if (branchIdRef.current && data.branchId && data.branchId !== branchIdRef.current) return;
        // Check if order already exists (add items) or is new (upsert)
        const existingOrder = useKDSStore.getState().orders.find((o) => o.id === data.orderId);
        if (existingOrder) {
          appendItems(data.orderId, data.items);
        } else {
          upsertOrder({
            id: data.orderId,
            storeId: data.storeId,
            orderNumber: data.orderNumber,
            orderType: data.orderType as KDSOrder['orderType'],
            status: 'in_progress',
            tableNumber: data.tableNumber,
            tableId: data.tableId,
            notes: data.notes,
            totalAmount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: data.items,
          });
        }
      });

      es.addEventListener('ITEM_STATUS_CHANGED', (e: MessageEvent) => {
        const { orderId, itemId, status, orderStatus } = JSON.parse(e.data) as {
          orderId: string;
          itemId: string;
          status: KDSOrderItem['status'];
          orderStatus: string;
        };
        updateItemStatus(orderId, itemId, status);
        // If order is now closed/cancelled, remove from KDS
        if (orderStatus === 'closed' || orderStatus === 'cancelled') removeOrder(orderId);
      });

      es.addEventListener('BILL_REQUESTED', (e: MessageEvent) => {
        const { orderId } = JSON.parse(e.data) as { orderId: string };
        // Highlight or mark — for now just log
        console.info('[KDS] Bill requested for order', orderId);
      });

      es.addEventListener('ORDER_CLOSED', (e: MessageEvent) => {
        const { orderId } = JSON.parse(e.data) as { orderId: string };
        removeOrder(orderId);
      });

      // A cancelled order frees its table immediately on the POS side — without
      // this the ticket sat here indefinitely since cancellation never told the
      // board to drop it.
      es.addEventListener('ORDER_CANCELLED', (e: MessageEvent) => {
        const { orderId } = JSON.parse(e.data) as { orderId: string };
        removeOrder(orderId);
      });

      // Fired once, server-side, exactly when the derived kitchen stage first
      // reaches "ready" (every item ready-or-beyond) — the column move itself
      // already happens reactively from the item statuses above; this is the
      // hook for a dedicated waiter notification / expo alert.
      es.addEventListener('ORDER_READY', (e: MessageEvent) => {
        const { orderId, tableNumber } = JSON.parse(e.data) as { orderId: string; tableNumber?: number };
        console.info('[KDS] Order ready for pickup', orderId, tableNumber != null ? `Table ${tableNumber}` : '');
      });

      // Fired once every item on the order has been collected — the order
      // leaves the active board entirely (history is preserved server-side).
      es.addEventListener('ORDER_COLLECTED', (e: MessageEvent) => {
        const { orderId } = JSON.parse(e.data) as { orderId: string };
        removeOrder(orderId);
      });

      es.onerror = () => {
        setConnectionStatus('disconnected');
        es.close();
        esRef.current = null;
        // The access token may have expired (15min TTL) — refresh it before
        // retrying, otherwise a stale token makes every reconnect attempt
        // fail identically and this loops forever ("Reconnecting…" forever
        // while orders silently stop updating).
        setTimeout(async () => {
          if (!useKDSAuthStore.getState().token) return; // logged out during refresh
          await refreshAccessToken();
          if (useKDSAuthStore.getState().token) connect();
        }, 5000);
      };
    }

    connect();

    // Proactively refresh + reconnect well before the 15min access token
    // expires, so a shift-long kitchen display never actually drops the
    // connection in the first place.
    const proactiveRefresh = setInterval(async () => {
      if (!useKDSAuthStore.getState().token) return;
      const newToken = await refreshAccessToken();
      if (newToken) {
        esRef.current?.close();
        connect();
      }
    }, 10 * 60 * 1000);

    return () => {
      clearInterval(proactiveRefresh);
      esRef.current?.close();
      esRef.current = null;
    };
  }, [storeId, token, upsertOrder, appendItems, updateItemStatus, removeOrder]);

  const handleItemStatus = useCallback(
    async (orderId: string, itemId: string, status: KDSOrderItem['status']) => {
      try {
        await apiUpdateItemStatus(orderId, itemId, status);
        // SSE will update state; optimistically update for snappiness
        updateItemStatus(orderId, itemId, status);
      } catch (err) {
        console.error('[KDS] Failed to update item status', err);
      }
    },
    [updateItemStatus],
  );

  // upsertOrder prepends live-arriving orders while the initial fetch comes back
  // oldest-first, so the array's insertion order isn't reliable on its own —
  // sort explicitly (oldest first, matching kitchen FIFO) so a long-sitting
  // backlog can never silently push a brand-new ticket out of sorted position.
  const filteredOrders = orders
    .filter((o) => {
      if (filter.orderType !== 'all' && o.orderType !== filter.orderType) return false;
      return true;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const newOrders = filteredOrders.filter((o) => getOrderColumn(o) === 'new');
  const inProgressOrders = filteredOrders.filter((o) => getOrderColumn(o) === 'in-progress');
  const readyOrders = filteredOrders.filter((o) => getOrderColumn(o) === 'ready');
  const columns = { 'new': newOrders, 'in-progress': inProgressOrders, 'ready': readyOrders } as const;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-neutral-950 text-neutral-300">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p>Loading kitchen display…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 bg-neutral-900 border-b border-neutral-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center font-black text-sm">K</div>
          <span className="font-bold text-white text-sm">Kitchen Display</span>
          <div className="flex items-center gap-1.5 ml-2">
            <span className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-400' : connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-xs text-neutral-400">
              {connectionStatus === 'connected' ? 'Live' : connectionStatus === 'connecting' ? 'Connecting…' : 'Reconnecting…'}
            </span>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          {(['all', 'dine-in', 'takeout', 'delivery'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter({ ...filter, orderType: t })}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filter.orderType === t
                  ? 'bg-brand-600 text-white'
                  : 'bg-neutral-800 text-neutral-400 hover:bg-neutral-700 hover:text-white'
              }`}
            >
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-neutral-400">{username}</span>
          <button
            onClick={logout}
            className="text-xs text-neutral-400 hover:text-white border border-neutral-700 rounded-lg px-3 py-1.5 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Columns */}
      <div className="flex flex-1 overflow-hidden gap-0 divide-x divide-neutral-800">
        {(['new', 'in-progress', 'ready'] as const).map((col) => {
          const cfg = COL_CONFIG[col];
          const colOrders = columns[col];
          return (
            <div key={col} className="flex flex-col flex-1 min-w-0">
              {/* Column header */}
              <div className={`flex items-center gap-2 px-4 py-3 border-b-2 ${cfg.header} bg-neutral-900 shrink-0`}>
                <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot}`} />
                <span className="font-bold text-sm text-white">{cfg.label}</span>
                <span className="ml-auto bg-neutral-800 text-neutral-300 text-xs font-bold px-2 py-0.5 rounded-full">
                  {colOrders.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {colOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-32 text-neutral-600 text-sm">
                    Empty
                  </div>
                ) : (
                  colOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      column={col}
                      onItemStatus={handleItemStatus}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
