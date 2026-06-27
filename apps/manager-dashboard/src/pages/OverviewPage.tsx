import React, { useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar,
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { useDashboardStore } from '../store/dashboardStore';
import { dashboardAPI } from '../api/dashboard';
import { formatDistanceToNow } from 'date-fns';

export const OverviewPage: React.FC = () => {
  const {
    stores, selectedStoreId, revenuePeriod,
    revenueChart, churnAlert, topCampaigns, lastRefresh,
    setStores, setRevenueChart, setChurnAlert, setTopCampaigns,
    setRevenuePeriod, setLastRefresh,
  } = useDashboardStore();

  const load = useCallback(async () => {
    try {
      const [storeData, revenue, churn, campaigns] = await Promise.all([
        dashboardAPI.getStoreMetrics(selectedStoreId || undefined),
        dashboardAPI.getRevenueChart(selectedStoreId, revenuePeriod),
        dashboardAPI.getChurnAlert(selectedStoreId),
        dashboardAPI.getCampaignROI(selectedStoreId || undefined),
      ]);
      setStores(storeData);
      setRevenueChart(revenue);
      setChurnAlert(churn);
      setTopCampaigns(campaigns.slice(0, 5));
      setLastRefresh();
    } catch (err) {
      console.error('Failed to load overview:', err);
    }
  }, [selectedStoreId, revenuePeriod]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [load]);

  // Aggregate across stores
  const totalOrders = stores.reduce((s, x) => s + x.ordersToday, 0);
  const totalRevenue = stores.reduce((s, x) => s + x.revenueToday, 0);
  const avgAOV = stores.length > 0
    ? stores.reduce((s, x) => s + x.avgOrderValue, 0) / stores.length
    : 0;
  const inProgress = stores.reduce((s, x) => s + x.ordersInProgress, 0);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Overview</h2>
        {lastRefresh && (
          <p className="text-sm text-gray-400">
            Updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Orders Today" value={totalOrders} icon="🧾" colorClass="bg-blue-50 border-blue-200" />
        <StatCard label="Revenue Today" value={`$$${totalRevenue.toFixed(0)}`} icon="💰" colorClass="bg-green-50 border-green-200" />
        <StatCard label="Avg Order Value" value={`$$${avgAOV.toFixed(2)}`} icon="📊" />
        <StatCard label="In Progress" value={inProgress} icon="🔄" colorClass="bg-yellow-50 border-yellow-200" />
      </div>

      {/* Churn alert banner */}
      {churnAlert && (churnAlert.customersAtRisk > 0 || churnAlert.criticalCount > 0) && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
          <span className="text-3xl">⚠️</span>
          <div>
            <p className="font-semibold text-red-800">
              {churnAlert.criticalCount} customers at critical churn risk
            </p>
            <p className="text-sm text-red-600">
              {churnAlert.customersAtRisk} total at-risk · {churnAlert.customersChurned} churned
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800">Revenue Trend</h3>
            <div className="flex gap-2">
              {(['7d', '30d', '90d'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setRevenuePeriod(p)}
                  className={`px-3 py-1 rounded text-sm font-medium transition ${
                    revenuePeriod === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={revenueChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(0)}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Campaign ROI leaderboard */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Campaign ROI</h3>
          {topCampaigns.length === 0 ? (
            <p className="text-gray-400 text-sm">No campaign data</p>
          ) : (
            <div className="space-y-3">
              {topCampaigns.map((c, i) => (
                <div key={c.campaignId} className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-400 w-6">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate text-sm">{c.name}</p>
                    <div className="h-1.5 bg-gray-100 rounded-full mt-1">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${Math.min(c.roi, 100)}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-blue-700 whitespace-nowrap">
                    {c.roi.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-store breakdown */}
      {stores.length > 1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Multi-Store Breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 px-3 font-semibold text-gray-600">Store</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Orders</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Revenue</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">AOV</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">In Progress</th>
                  <th className="text-right py-2 px-3 font-semibold text-gray-600">Cancelled</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stores.map((s) => (
                  <tr key={s.storeId} className="hover:bg-gray-50">
                    <td className="py-3 px-3 font-medium text-gray-900">{s.storeName}</td>
                    <td className="py-3 px-3 text-right text-gray-700">{s.ordersToday}</td>
                    <td className="py-3 px-3 text-right font-medium text-gray-800">${s.revenueToday.toFixed(0)}</td>
                    <td className="py-3 px-3 text-right text-gray-700">{s.avgOrderValue.toFixed(2)}</td>
                    <td className="py-3 px-3 text-right text-yellow-700 font-medium">{s.ordersInProgress}</td>
                    <td className="py-3 px-3 text-right text-red-600">{s.ordersCancelled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};