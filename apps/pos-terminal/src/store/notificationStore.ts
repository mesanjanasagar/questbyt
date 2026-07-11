import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface POSNotification {
  id: string;
  type: 'item_ready' | 'order_ready';
  title: string;
  message: string;
  orderId: string;
  tableNumber?: number;
  createdAt: string;
  read: boolean;
}

interface NotificationState {
  notifications: POSNotification[];
  add: (n: Omit<POSNotification, 'id' | 'read' | 'createdAt'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

// Persisted to localStorage (like authStore) so an accidental refresh or a
// PWA auto-update swapping in a new build doesn't wipe out notifications the
// waiter hasn't seen yet — the entire point is catching them up on what
// happened while they were away from the screen. Cleared on logout (see
// authStore) so the next person signing in on a shared terminal doesn't
// inherit the previous shift's read/unread state.
const MAX_NOTIFICATIONS = 30;

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set) => ({
      notifications: [],
      add: (n) =>
        set((state) => ({
          notifications: [
            {
              ...n,
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              read: false,
              createdAt: new Date().toISOString(),
            },
            ...state.notifications,
          ].slice(0, MAX_NOTIFICATIONS),
        })),
      markRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        })),
      markAllRead: () =>
        set((state) => ({ notifications: state.notifications.map((n) => ({ ...n, read: true })) })),
      dismiss: (id) =>
        set((state) => ({ notifications: state.notifications.filter((n) => n.id !== id) })),
      clear: () => set({ notifications: [] }),
    }),
    { name: 'pos-notifications' },
  ),
);
