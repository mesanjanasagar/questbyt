import { useEffect, useState, useCallback } from 'react';
import {
  PageHeader, Card, CardBody, StatusBadge, Badge, Table, EmptyState,
  ReceiptIcon,
} from '@pos/ui';
import type { Column } from '@pos/ui';
import api from '../api/client';
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

const STATUS_FILTERS = ['all', 'pending', 'in-progress', 'ready', 'delivered', 'cancelled'];

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
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/orders', {
        params: {
          storeId: selectedStoreId || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          limit: 100,
        },
      });
      setOrders((res.data as { data: Order[] }).data ?? []);
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
      <PageHeader
        title="Live Orders"
        description="Real-time order feed — refreshes every 10 seconds"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant="info">{counts['in-progress'] ?? 0} In Progress</Badge>
            <Badge variant="success">{counts['ready'] ?? 0} Ready</Badge>
            <Badge variant="default">{counts['pending'] ?? 0} Pending</Badge>
          </div>
        }
      />

      {/* Status filter tabs */}
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
            {s === 'all' ? `All (${orders.length})` : `${s} (${counts[s] ?? 0})`}
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
