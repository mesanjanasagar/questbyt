import React, { useEffect } from 'react';
import {
  PageHeader, KPICard, Card, CardHeader, CardTitle, CardBody, EmptyState,
  MegaphoneIcon, DollarSignIcon, TrendingUpIcon,
} from '@pos/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useDashboardStore } from '../store/dashboardStore';
import { dashboardAPI } from '../api/dashboard';

const ROI_COLORS = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

export const CampaignsPage: React.FC = () => {
  const { topCampaigns, selectedStoreId, setTopCampaigns } = useDashboardStore();

  useEffect(() => {
    dashboardAPI
      .getCampaignROI(selectedStoreId || undefined)
      .then(setTopCampaigns)
      .catch(console.error);
  }, [selectedStoreId]);

  const totalRevenue = topCampaigns.reduce((s, c) => s + c.revenueGenerated, 0);
  const avgROI = topCampaigns.length > 0
    ? topCampaigns.reduce((s, c) => s + c.roi, 0) / topCampaigns.length
    : 0;

  const chartData = [...topCampaigns]
    .sort((a, b) => b.roi - a.roi)
    .map((c) => ({
      name: c.name.length > 16 ? c.name.slice(0, 14) + '…' : c.name,
      roi: Math.round(c.roi),
    }));

  if (topCampaigns.length === 0) {
    return (
      <div className="p-6">
        <PageHeader title="Campaign Performance" />
        <Card>
          <CardBody>
            <EmptyState
              icon={<MegaphoneIcon size={20} />}
              title="No campaign data available"
              description="Launch a campaign from the CRM Dashboard to see results here"
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Campaign Performance"
        description="ROI and revenue from all marketing campaigns"
      />

      <div className="grid grid-cols-3 gap-4">
        <KPICard
          label="Total Campaigns"
          value={topCampaigns.length}
          icon={<MegaphoneIcon size={18} />}
          iconColor="text-primary-600 bg-primary-50"
        />
        <KPICard
          label="Total Revenue"
          value={`$${totalRevenue.toFixed(0)}`}
          icon={<DollarSignIcon size={18} />}
          iconColor="text-success-600 bg-success-50"
        />
        <KPICard
          label="Avg ROI"
          value={`${avgROI.toFixed(0)}%`}
          icon={<TrendingUpIcon size={18} />}
          iconColor={avgROI > 100 ? 'text-success-600 bg-success-50' : 'text-warning-600 bg-warning-50'}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ROI Leaderboard</CardTitle>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 40)}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
              <XAxis
                type="number"
                unit="%"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                tick={{ fontSize: 12, fill: '#374151' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: number) => [`${v}%`, 'ROI']}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Bar dataKey="roi" radius={[0, 4, 4, 0]} barSize={20}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={ROI_COLORS[Math.min(i, ROI_COLORS.length - 1)]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardBody padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  {['Campaign', 'Sent', 'Revenue', 'ROI'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide ${
                        i === 0 ? 'text-left' : 'text-right'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...topCampaigns].sort((a, b) => b.roi - a.roi).map((c) => (
                  <tr
                    key={c.campaignId}
                    className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-neutral-900">{c.name}</td>
                    <td className="py-3 px-4 text-right text-neutral-600 tabular-nums">
                      {c.sentCount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-neutral-800 tabular-nums">
                      ${c.revenueGenerated.toFixed(0)}
                    </td>
                    <td className={`py-3 px-4 text-right font-bold tabular-nums ${
                      c.roi > 100
                        ? 'text-success-700'
                        : c.roi > 0
                        ? 'text-primary-700'
                        : 'text-error-600'
                    }`}>
                      {c.roi.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
