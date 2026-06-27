import React, { useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { dashboardAPI } from '../api/dashboard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

export const CampaignsPage: React.FC = () => {
  const { topCampaigns, selectedStoreId, setTopCampaigns } = useDashboardStore();

  useEffect(() => {
    dashboardAPI
      .getCampaignROI(selectedStoreId || undefined)
      .then(setTopCampaigns)
      .catch(console.error);
  }, [selectedStoreId]);

  const chartData = [...topCampaigns]
    .sort((a, b) => b.roi - a.roi)
    .map((c) => ({ name: c.name.slice(0, 14), roi: Math.round(c.roi), revenue: Math.round(c.revenueGenerated) }));

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Campaign Performance</h2>

      {topCampaigns.length === 0 ? (
        <div className="text-center text-gray-400 py-20">No campaign data available</div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500 font-semibold uppercase">Total Campaigns</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{topCampaigns.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500 font-semibold uppercase">Total Revenue</p>
              <p className="text-3xl font-bold text-green-700 mt-1">
                ${topCampaigns.reduce((s, c) => s + c.revenueGenerated, 0).toFixed(0)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <p className="text-sm text-gray-500 font-semibold uppercase">Avg ROI</p>
              <p className="text-3xl font-bold text-blue-700 mt-1">
                {topCampaigns.length > 0
                  ? (topCampaigns.reduce((s, c) => s + c.roi, 0) / topCampaigns.length).toFixed(0)
                  : 0}%
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">ROI Leaderboard</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
                <XAxis type="number" unit="%" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: number) => [`${v}%`, 'ROI']} />
                <Bar dataKey="roi" radius={[0, 4, 4, 0]}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? '#1d4ed8' : i < 3 ? '#3b82f6' : '#93c5fd'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Campaign</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Sent</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Revenue</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[...topCampaigns].sort((a, b) => b.roi - a.roi).map((c) => (
                  <tr key={c.campaignId} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-900">{c.name}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{c.sentCount.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-800">${c.revenueGenerated.toFixed(0)}</td>
                    <td className={`px-5 py-3 text-right font-bold ${c.roi > 100 ? 'text-green-700' : c.roi > 0 ? 'text-blue-700' : 'text-red-600'}`}>
                      {c.roi.toFixed(0)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};