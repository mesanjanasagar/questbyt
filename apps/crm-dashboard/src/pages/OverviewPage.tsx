import React, { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { StatCard } from '../components/StatCard';
import { useCRMStore } from '../store/crmStore';
import { customersAPI } from '../api/customers';
import { churnAPI } from '../api/churn';

const SEGMENT_COLORS: Record<string, string> = {
  VIP: '#7c3aed',
  Loyal: '#2563eb',
  New: '#16a34a',
  'At-Risk': '#d97706',
  Churned: '#dc2626',
};

const TIER_COLORS: Record<string, string> = {
  Platinum: '#94a3b8',
  Gold: '#f59e0b',
  Silver: '#9ca3af',
  Bronze: '#b45309',
};

export const OverviewPage: React.FC = () => {
  const { metrics, segments, tiers, churnSummary, setMetrics, setSegments, setTiers, setChurnScores } =
    useCRMStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [m, s, t, churnData] = await Promise.all([
          customersAPI.getMetrics(),
          customersAPI.getSegments(),
          customersAPI.getTiers(),
          churnAPI.getScores(),
        ]);
        setMetrics(m);
        setSegments(s);
        setTiers(t);
        setChurnScores(churnData, {
          total: churnData.length,
          critical: churnData.filter((c) => c.riskLevel === 'critical').length,
          high: churnData.filter((c) => c.riskLevel === 'high').length,
          medium: churnData.filter((c) => c.riskLevel === 'medium').length,
          low: churnData.filter((c) => c.riskLevel === 'low').length,
        });
      } catch (err) {
        console.error('Failed to load overview:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-xl">
        Loading...
      </div>
    );
  }

  const segmentChartData = segments.map((s) => ({
    name: s.segment,
    value: s.count,
    fill: SEGMENT_COLORS[s.segment] ?? '#6b7280',
  }));

  const tierChartData = tiers.map((t) => ({
    name: t.tier,
    count: t.count,
    fill: TIER_COLORS[t.tier] ?? '#6b7280',
  }));

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">CRM Overview</h2>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Customers"
          value={metrics?.totalCustomers?.toLocaleString() ?? '–'}
          icon="👥"
          color="blue"
        />
        <StatCard
          label="New This Month"
          value={metrics?.newThisMonth?.toLocaleString() ?? '–'}
          icon="🆕"
          color="green"
        />
        <StatCard
          label="At-Risk"
          value={metrics?.atRisk?.toLocaleString() ?? '–'}
          sub="Need re-engagement"
          icon="⚠️"
          color="yellow"
        />
        <StatCard
          label="Churned"
          value={metrics?.churned?.toLocaleString() ?? '–'}
          sub="30+ days inactive"
          icon="❌"
          color="red"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="VIP Customers"
          value={metrics?.vip?.toLocaleString() ?? '–'}
          sub="Top spenders"
          icon="💎"
          color="purple"
        />
        <StatCard
          label="Avg Lifetime Value"
          value={
            metrics?.avgLifetimeValue != null
              ? `$${metrics.avgLifetimeValue.toFixed(2)}`
              : '–'
          }
          icon="💰"
          color="blue"
        />
      </div>

      {/* Churn Summary */}
      {churnSummary && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Churn Risk Distribution</h3>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Critical', count: churnSummary.critical, color: 'bg-red-100 text-red-700 border-red-200' },
              { label: 'High', count: churnSummary.high, color: 'bg-orange-100 text-orange-700 border-orange-200' },
              { label: 'Medium', count: churnSummary.medium, color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
              { label: 'Low', count: churnSummary.low, color: 'bg-green-100 text-green-700 border-green-200' },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg border p-3 text-center ${item.color}`}>
                <p className="text-2xl font-bold">{item.count}</p>
                <p className="text-sm font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Segment Pie */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Customer Segments</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={segmentChartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {segmentChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Tier Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Loyalty Tier Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={tierChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {tierChartData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};