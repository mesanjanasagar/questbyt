import React, { useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  KPICard, Card, CardHeader, CardTitle, CardBody,
  PageHeader, Badge, Button,
  ReceiptIcon, DollarSignIcon, ActivityIcon, RefreshCwIcon,
  AlertTriangleIcon,
} from '@pos/ui';
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
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const totalOrders = stores.reduce((s, x) => s + x.ordersToday, 0);
  const totalRevenue = stores.reduce((s, x) => s + x.revenueToday, 0);
  const avgAOV = stores.length > 0
    ? stores.reduce((s, x) => s + x.avgOrderValue, 0) / stores.length
    : 0;
  const inProgress = stores.reduce((s, x) => s + x.ordersInProgress, 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Overview"
        description="Real-time performance across all locations"
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={load}
            icon={<RefreshCwIcon size={15} />}
          >
            {lastRefresh
              ? `Updated ${formatDistanceToNow(lastRefresh, { addSuffix: true })}`
              : 'Refresh'
            }
          </Button>
        }
      />

      {/* KPI Row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label="Orders Today"
          value={totalOrders}
          icon={<ReceiptIcon size={18} />}
          iconColor="text-primary-600 bg-primary-50"
        />
        <KPICard
          label="Revenue Today"
          value={`$${totalRevenue.toFixed(0)}`}
          icon={<DollarSignIcon size={18} />}
          iconColor="text-success-600 bg-success-50"
        />
        <KPICard
          label="Avg Order Value"
          value={`$${avgAOV.toFixed(2)}`}
          icon={<ActivityIcon size={18} />}
          iconColor="text-accent-600 bg-accent-50"
        />
        <KPICard
          label="In Progress"
          value={inProgress}
          icon={<RefreshCwIcon size={18} />}
          iconColor="text-warning-600 bg-warning-50"
        />
      </div>

      {/* Churn alert */}
      {churnAlert && (churnAlert.customersAtRisk > 0 || churnAlert.criticalCount > 0) && (
        <div className="bg-error-50 border border-error-200 rounded-xl p-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-error-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangleIcon size={16} className="text-error-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-error-800">
              {churnAlert.criticalCount} customers at critical churn risk
            </p>
            <p className="text-xs text-error-600 mt-0.5">
              {churnAlert.customersAtRisk} total at-risk · {churnAlert.customersChurned} churned this month
            </p>
          </div>
          <Button variant="danger" size="sm" onClick={() => window.location.href = '/churn'}>
            View
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <Card className="xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Revenue Trend</CardTitle>
              <div className="flex gap-1">
                {(['7d', '30d', '90d'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setRevenuePeriod(p)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      revenuePeriod === p
                        ? 'bg-primary-600 text-white'
                        : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenueChart} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => [`$${v.toFixed(0)}`, 'Revenue']}
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>

        {/* Campaign ROI leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign ROI</CardTitle>
          </CardHeader>
          <CardBody>
            {topCampaigns.length === 0 ? (
              <p className="text-neutral-400 text-sm">No campaign data</p>
            ) : (
              <div className="space-y-4">
                {topCampaigns.map((c, i) => (
                  <div key={c.campaignId} className="flex items-center gap-3">
                    <span className="text-sm font-bold text-neutral-300 w-4 text-center">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-sm font-medium text-neutral-800 truncate">{c.name}</p>
                        <span className="text-xs font-bold text-primary-700 ml-2 whitespace-nowrap">
                          {c.roi.toFixed(0)}%
                        </span>
                      </div>
                      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full transition-all"
                          style={{ width: `${Math.min(c.roi, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Multi-store breakdown */}
      {stores.length > 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Multi-Store Breakdown</CardTitle>
              <Badge variant="default">{stores.length} locations</Badge>
            </div>
          </CardHeader>
          <CardBody padding="none">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-100">
                    {['Store', 'Orders', 'Revenue', 'AOV', 'In Progress', 'Cancelled'].map((h) => (
                      <th
                        key={h}
                        className={`py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide ${
                          h === 'Store' ? 'text-left' : 'text-right'
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stores.map((s) => (
                    <tr key={s.storeId} className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors">
                      <td className="py-3 px-4 font-medium text-neutral-900">{s.storeName}</td>
                      <td className="py-3 px-4 text-right text-neutral-700">{s.ordersToday}</td>
                      <td className="py-3 px-4 text-right font-semibold text-neutral-800">${s.revenueToday.toFixed(0)}</td>
                      <td className="py-3 px-4 text-right text-neutral-600">${s.avgOrderValue.toFixed(2)}</td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-warning-700 font-medium">{s.ordersInProgress}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-error-600">{s.ordersCancelled}</span>
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
