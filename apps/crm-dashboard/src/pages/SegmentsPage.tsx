import React, { useEffect, useState } from 'react';
import { useCRMStore } from '../store/crmStore';
import { customersAPI } from '../api/customers';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { CustomerSegment } from '../types';

const SEGMENT_COLORS: Record<CustomerSegment, string> = {
  VIP: '#7c3aed',
  Loyal: '#2563eb',
  New: '#16a34a',
  'At-Risk': '#d97706',
  Churned: '#dc2626',
};

const SEGMENT_DESCRIPTIONS: Record<CustomerSegment, string> = {
  VIP: 'Top-tier spenders with high order frequency and AOV',
  Loyal: 'Regular customers with consistent ordering patterns',
  New: 'Customers who joined in the last 30 days',
  'At-Risk': 'Previously active customers showing decline signals',
  Churned: 'Customers inactive for 30+ days',
};

export const SegmentsPage: React.FC = () => {
  const { segments, tiers, setSegments, setTiers } = useCRMStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [s, t] = await Promise.all([customersAPI.getSegments(), customersAPI.getTiers()]);
        setSegments(s);
        setTiers(t);
      } catch (err) {
        console.error('Failed to load segments:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const total = segments.reduce((sum, s) => sum + s.count, 0);

  const tierChartData = tiers.map((t) => ({
    name: t.tier,
    count: t.count,
    points: t.totalPoints,
  }));

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Customer Segments</h2>

      {loading ? (
        <div className="text-center text-gray-400 py-20">Loading...</div>
      ) : (
        <>
          {/* Segment Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((seg) => (
              <div
                key={seg.segment}
                className="bg-white rounded-xl border-2 border-gray-200 p-5 hover:shadow-md transition"
                style={{ borderLeftColor: SEGMENT_COLORS[seg.segment], borderLeftWidth: 4 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-800">{seg.segment}</h3>
                  <span
                    className="text-2xl font-bold"
                    style={{ color: SEGMENT_COLORS[seg.segment] }}
                  >
                    {seg.count.toLocaleString()}
                  </span>
                </div>

                <p className="text-sm text-gray-500 mb-3">{SEGMENT_DESCRIPTIONS[seg.segment]}</p>

                <div className="flex justify-between text-sm">
                  <div>
                    <p className="text-gray-500">% of Total</p>
                    <p className="font-semibold text-gray-800">
                      {total > 0 ? ((seg.count / total) * 100).toFixed(1) : 0}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500">Avg Spend</p>
                    <p className="font-semibold text-gray-800">${seg.avgSpend.toFixed(2)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500">Avg Orders</p>
                    <p className="font-semibold text-gray-800">{seg.avgOrders.toFixed(1)}</p>
                  </div>
                </div>

                {/* Proportion Bar */}
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: total > 0 ? `${(seg.count / total) * 100}%` : '0%',
                      backgroundColor: SEGMENT_COLORS[seg.segment],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Loyalty Tiers */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-semibold mb-4 text-gray-800">Loyalty Tier Breakdown</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={tierChartData}>
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" name="Customers" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>

              <div className="space-y-3">
                {tiers.map((t) => (
                  <div key={t.tier} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-gray-800">{t.tier}</p>
                      <p className="text-xs text-gray-500">{t.count.toLocaleString()} customers</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-800">
                        {t.totalPoints.toLocaleString()} pts
                      </p>
                      <p className="text-xs text-gray-500">total points</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};