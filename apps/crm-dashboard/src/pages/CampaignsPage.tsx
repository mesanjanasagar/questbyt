import React, { useEffect, useState } from 'react';
import { useCRMStore } from '../store/crmStore';
import { campaignsAPI } from '../api/campaigns';
import { Campaign, CampaignPerformance, CustomerSegment } from '../types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const STATUS_BADGE: Record<Campaign['status'], string> = {
  draft: 'bg-gray-100 text-gray-700',
  active: 'bg-green-100 text-green-700',
  paused: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
};

export const CampaignsPage: React.FC = () => {
  const { campaigns, campaignTotal, setCampaigns } = useCRMStore();
  const [performance, setPerformance] = useState<CampaignPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'promotional',
    targetSegment: 'At-Risk' as CustomerSegment,
    message: '',
    channel: 'email',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [data, perf] = await Promise.all([
          campaignsAPI.getCampaigns({ limit: 50 }),
          campaignsAPI.getPerformance(),
        ]);
        setCampaigns(data.data, data.total);
        setPerformance(perf);
      } catch (err) {
        console.error('Failed to load campaigns:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const handleCreate = async () => {
    if (!newCampaign.name || !newCampaign.message) return;
    setCreating(true);
    try {
      const created = await campaignsAPI.createCampaign(newCampaign);
      setCampaigns([created, ...campaigns], campaignTotal + 1);
      setShowCreate(false);
      setNewCampaign({ name: '', type: 'promotional', targetSegment: 'At-Risk', message: '', channel: 'email' });
    } catch (err) {
      console.error('Failed to create campaign:', err);
    } finally {
      setCreating(false);
    }
  };

  const roiChartData = performance
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 8)
    .map((p) => ({ name: p.name.slice(0, 12), roi: p.roi }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Campaigns</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          + New Campaign
        </button>
      </div>

      {/* ROI Chart */}
      {roiChartData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-lg font-semibold mb-4 text-gray-800">Campaign ROI Leaderboard</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={roiChartData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" unit="%" />
              <YAxis type="category" dataKey="name" width={90} />
              <Tooltip formatter={(v) => `${v}%`} />
              <Bar dataKey="roi" radius={[0, 4, 4, 0]}>
                {roiChartData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#2563eb' : i < 3 ? '#60a5fa' : '#93c5fd'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Campaigns List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Campaign</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Target</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Sent</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Delivered</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Click Rate</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">No campaigns yet</td>
                </tr>
              ) : (
                campaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-500">{c.type}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-700">{c.targetSegment}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-gray-700">{c.sentCount.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right text-gray-700">{c.deliveredCount.toLocaleString()}</td>
                    <td className="px-5 py-4 text-right text-gray-700">
                      {(c.clickRate * 100).toFixed(1)}%
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-gray-800">
                      ${c.revenue.toFixed(0)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-xl font-bold text-gray-800">New Campaign</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Name</label>
              <input
                type="text"
                value={newCampaign.name}
                onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g. Win-back At-Risk Customers"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target Segment</label>
              <select
                value={newCampaign.targetSegment}
                onChange={(e) => setNewCampaign({ ...newCampaign, targetSegment: e.target.value as CustomerSegment })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="At-Risk">At-Risk</option>
                <option value="Churned">Churned</option>
                <option value="VIP">VIP</option>
                <option value="Loyal">Loyal</option>
                <option value="New">New</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Channel</label>
              <select
                value={newCampaign.channel}
                onChange={(e) => setNewCampaign({ ...newCampaign, channel: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                <option value="email">Email</option>
                <option value="sms">SMS</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="push">Push Notification</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
              <textarea
                value={newCampaign.message}
                onChange={(e) => setNewCampaign({ ...newCampaign, message: e.target.value })}
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter campaign message..."
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 border border-gray-300 rounded-lg py-2 font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 font-medium disabled:opacity-60"
              >
                {creating ? 'Creating...' : 'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};