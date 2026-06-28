import React, { useEffect } from 'react';
import {
  PageHeader, KPICard, Card, CardBody, Badge, EmptyState, CheckCircleIcon,
  PackageIcon, AlertTriangleIcon,
} from '@pos/ui';
import { useDashboardStore } from '../store/dashboardStore';
import { dashboardAPI } from '../api/dashboard';
import { formatDistanceToNow } from 'date-fns';

export const InventoryPage: React.FC = () => {
  const { inventoryAlerts, selectedStoreId, setInventoryAlerts } = useDashboardStore();

  useEffect(() => {
    dashboardAPI
      .getInventoryAlerts(selectedStoreId || undefined)
      .then(setInventoryAlerts)
      .catch(console.error);
  }, [selectedStoreId]);

  const outOfStock = inventoryAlerts.filter((a) => a.status === 'out_of_stock');
  const lowStock = inventoryAlerts.filter((a) => a.status === 'low_stock');

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Inventory Alerts"
        description="Items requiring immediate attention"
      />

      <div className="grid grid-cols-2 gap-4">
        <KPICard
          label="Out of Stock"
          value={outOfStock.length}
          icon={<PackageIcon size={18} />}
          iconColor="text-error-600 bg-error-50"
          subValue={outOfStock.length === 0 ? 'All clear' : 'Requires urgent restock'}
        />
        <KPICard
          label="Low Stock"
          value={lowStock.length}
          icon={<AlertTriangleIcon size={18} />}
          iconColor="text-warning-600 bg-warning-50"
          subValue={lowStock.length === 0 ? 'All clear' : 'Monitor closely'}
        />
      </div>

      {inventoryAlerts.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<CheckCircleIcon size={20} className="text-success-600" />}
              title="All inventory levels healthy"
              description="No items require attention right now"
            />
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200">
                    {['Product', 'Status', 'Current Stock', 'Reorder Level', 'Alert Age'].map((h, i) => (
                      <th
                        key={h}
                        className={`py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide ${
                          i >= 2 && i <= 3 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventoryAlerts.map((alert) => (
                    <tr
                      key={alert.id}
                      className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-medium text-neutral-900">{alert.productName}</td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={alert.status === 'out_of_stock' ? 'error' : 'warning'}
                          dot
                        >
                          {alert.status === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-neutral-900 tabular-nums">
                        {alert.currentStock}
                      </td>
                      <td className="py-3.5 px-4 text-right text-neutral-500 tabular-nums">
                        {alert.reorderLevel}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-neutral-400">
                        {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
