import React, { useEffect } from 'react';
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
      <h2 className="text-2xl font-bold text-gray-800">Inventory Alerts</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-red-600 uppercase">Out of Stock</p>
          <p className="text-4xl font-bold text-red-700 mt-1">{outOfStock.length}</p>
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-yellow-600 uppercase">Low Stock</p>
          <p className="text-4xl font-bold text-yellow-700 mt-1">{lowStock.length}</p>
        </div>
      </div>

      {inventoryAlerts.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <p className="text-2xl mb-2">✅</p>
          <p className="text-green-800 font-semibold">All inventory levels healthy</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Product</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Current Stock</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Reorder Level</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Alert Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inventoryAlerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4 font-medium text-gray-900">{alert.productName}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        alert.status === 'out_of_stock'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {alert.status === 'out_of_stock' ? 'Out of Stock' : 'Low Stock'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-gray-900">{alert.currentStock}</td>
                  <td className="px-5 py-4 text-right text-gray-500">{alert.reorderLevel}</td>
                  <td className="px-5 py-4 text-sm text-gray-500">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};