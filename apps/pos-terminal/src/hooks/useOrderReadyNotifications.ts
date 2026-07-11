import { useEffect, useRef } from 'react';
import { useToast } from '@pos/ui';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { getSSEUrl, refreshAccessToken } from '../api/client';

interface OrderReadyPayload {
  orderId: string;
  tableNumber?: number;
  orderNumber?: number;
  orderType?: string;
}

interface ItemStatusChangedPayload {
  orderId: string;
  itemId: string;
  status: string;
  tableNumber?: number;
  orderNumber?: number;
  itemName?: string;
  quantity?: number;
}

function tableOrOrderLabel(tableNumber?: number, orderNumber?: number): string {
  if (tableNumber != null) return `Table ${tableNumber}`;
  if (orderNumber != null) return `Order #${orderNumber}`;
  return 'Order';
}

// Subscribes to the same SSE stream KDS uses and surfaces a toast the moment
// any item is ready for pickup, plus a stronger one when the whole ticket is
// done — a waiter finds out regardless of which POS screen they're on,
// instead of only noticing when the table grid happens to poll and show
// green (and instead of waiting for every single item before saying anything,
// which meant nothing showed up for a partially-ready order).
export function useOrderReadyNotifications(storeId: string | undefined) {
  const { info, success } = useToast();
  const addNotification = useNotificationStore((s) => s.add);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!storeId) return;

    function connect() {
      if (!useAuthStore.getState().accessToken) return;
      const es = new EventSource(getSSEUrl(storeId!));
      esRef.current = es;

      es.addEventListener('ITEM_STATUS_CHANGED', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as ItemStatusChangedPayload;
        if (data.status !== 'ready') return;
        const label = tableOrOrderLabel(data.tableNumber, data.orderNumber);
        const itemLabel = data.itemName
          ? `${data.quantity && data.quantity > 1 ? `${data.quantity}× ` : ''}${data.itemName}`
          : 'An item';
        const message = `${itemLabel} is up at the kitchen pass.`;
        info(`${label} — Item Ready`, message);
        addNotification({
          type: 'item_ready',
          title: `${label} — Item Ready`,
          message,
          orderId: data.orderId,
          tableNumber: data.tableNumber,
        });
      });

      es.addEventListener('ORDER_READY', (e: MessageEvent) => {
        const data = JSON.parse(e.data) as OrderReadyPayload;
        const label = tableOrOrderLabel(data.tableNumber, data.orderNumber);
        const message = 'All items are up at the kitchen pass.';
        success(`${label} — Ready to Collect`, message);
        addNotification({
          type: 'order_ready',
          title: `${label} — Ready to Collect`,
          message,
          orderId: data.orderId,
          tableNumber: data.tableNumber,
        });
      });

      // Access token may have expired (15min TTL) — refresh before retrying,
      // otherwise a stale token makes every reconnect fail identically and
      // the terminal silently stops hearing about ready orders for the rest
      // of the shift.
      es.onerror = () => {
        es.close();
        esRef.current = null;
        setTimeout(async () => {
          if (!useAuthStore.getState().accessToken) return;
          await refreshAccessToken();
          connect();
        }, 5000);
      };
    }

    connect();

    // Proactively refresh + reconnect well before the 15min access token
    // expires, so a shift-long POS session never actually drops the
    // connection in the first place.
    const proactiveRefresh = setInterval(async () => {
      if (!useAuthStore.getState().accessToken) return;
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
  }, [storeId, info, success, addNotification]);
}
