import { useEffect, useState, useCallback, useRef } from 'react';
import {
  PageHeader, Card, CardBody, StatusBadge, Badge, Table, EmptyState,
  ReceiptIcon,
} from '@pos/ui';
import type { Column } from '@pos/ui';
import api from '../api/client';
import { useDashboardStore } from '../store/dashboardStore';
import { useAuth } from '../contexts/AuthContext';

interface Order {
  id: string;
  orderNumber: number;
  orderType: string;
  status: string;
  totalAmount: number;
  itemCount: number;
  createdAt: string;
}

interface OrderStats {
  total: number;
  pending: number;
  cooking: number;
  ready: number;
  completed: number;
  cancelled: number;
}

const STATUS_FILTERS = ['all', 'pending', 'cooking', 'ready', 'completed', 'cancelled'] as const;
type StatusFilter = typeof STATUS_FILTERS[number];

const POLL_INTERVAL = 10_000;

const columns: Column<Order>[] = [
  {
    key: 'number',
    header: 'Order',
    cell: (o) => (
      <span className="font-bold text-neutral-900 font-mono">#{o.orderNumber}</span>
    ),
  },
  {
    key: 'type',
    header: 'Type',
    cell: (o) => (
      <span className="capitalize text-neutral-600 text-xs font-medium">{o.orderType}</span>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    cell: (o) => <StatusBadge status={o.status} />,
  },
  {
    key: 'items',
    header: 'Items',
    headerClassName: 'text-right',
    className: 'text-right tabular-nums',
    cell: (o) => o.itemCount,
  },
  {
    key: 'total',
    header: 'Total',
    headerClassName: 'text-right',
    className: 'text-right font-semibold text-neutral-800 tabular-nums',
    cell: (o) => `$${o.totalAmount.toFixed(2)}`,
  },
  {
    key: 'time',
    header: 'Time',
    cell: (o) => (
      <span className="text-neutral-500 text-xs">
        {new Date(o.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </span>
    ),
  },
];

export const OrdersPage: React.FC = () => {
  const { selectedStoreId } = useDashboardStore();
  const { user } = useAuth();
  const effectiveStoreId = selectedStoreId || user?.storeId || '';

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ── A: Global order statistics ─────────────────────────────────────────────
  // Fetched independently of the active filter. Drives badge counts only.
  const [stats, setStats] = useState<OrderStats>({
    total: 0, pending: 0, cooking: 0, ready: 0, completed: 0, cancelled: 0,
  });
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStats = useCallback(async () => {
    if (!effectiveStoreId) return;
    try {
      const res = await api.get('/orders/stats', { params: { storeId: effectiveStoreId } });
      const data = (res.data as any)?.data;
      if (data) setStats(data as OrderStats);
    } catch {
      // non-fatal — leave previous counts in place
    }
  }, [effectiveStoreId]);

  useEffect(() => {
    if (!effectiveStoreId) return;
    fetchStats();
    statsTimerRef.current = setInterval(fetchStats, POLL_INTERVAL);
    return () => {
      if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    };
  }, [fetchStats]);

  // ── B: Filtered order list ─────────────────────────────────────────────────
  // Re-fetches when statusFilter changes. Drives table rows only.
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const ordersTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!effectiveStoreId) {
      setLoading(false);
      return;
    }
    try {
      const res = await api.get('/orders', {
        params: {
          storeId: effectiveStoreId,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          limit: 100,
        },
      });
      const payload = (res.data as any)?.data;
      setOrders(
        Array.isArray(payload?.data) ? payload.data
          : Array.isArray(payload) ? payload
          : [],
      );
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }, [effectiveStoreId, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
    if (ordersTimerRef.current) clearInterval(ordersTimerRef.current);
    ordersTimerRef.current = setInterval(fetchOrders, POLL_INTERVAL);
    return () => {
      if (ordersTimerRef.current) clearInterval(ordersTimerRef.current);
    };
  }, [fetchOrders]);

  // ── Badge label helper ─────────────────────────────────────────────────────

  function badgeLabel(s: StatusFilter): string {
    if (s === 'all') return `All (${stats.total})`;
    return `${s.charAt(0).toUpperCase() + s.slice(1)} (${stats[s] ?? 0})`;
  }

  return (
    <div className="p-6 space-y-5">
      <PageHeader
        title="Live Orders"
        description="Real-time order feed — refreshes every 10 seconds"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="info">{stats.cooking} Cooking</Badge>
            <Badge variant="success">{stats.ready} Ready</Badge>
            <Badge variant="default">{stats.pending} Pending</Badge>
          </div>
        }
      />

      {/* Status filter tabs — counts come from stats, never from filtered rows */}
      <div className="flex gap-1.5 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
              statusFilter === s
                ? 'bg-primary-600 text-white'
                : 'bg-white border border-neutral-200 text-neutral-600 hover:bg-neutral-50'
            }`}
          >
            {badgeLabel(s)}
          </button>
        ))}
      </div>

      <Card>
        <CardBody padding="none">
          <Table
            columns={columns}
            data={orders}
            keyExtractor={(o) => o.id}
            loading={loading}
            emptyState={
              <EmptyState
                icon={<ReceiptIcon size={20} />}
                title="No orders found"
                description="Orders will appear here as they come in"
              />
            }
          />
        </CardBody>
      </Card>
    </div>
  );
};
