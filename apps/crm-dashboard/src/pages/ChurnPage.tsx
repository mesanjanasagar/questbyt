import React, { useEffect, useState } from 'react';
import { useCRMStore } from '../store/crmStore';
import { churnAPI } from '../api/churn';
import { ChurnScore, RiskLevel } from '../types';
import { formatDistanceToNow } from 'date-fns';

const RISK_BADGE: Record<RiskLevel, string> = {
  critical: 'bg-red-100 text-red-800 border border-red-300',
  high: 'bg-orange-100 text-orange-800 border border-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  low: 'bg-green-100 text-green-800 border border-green-300',
};

const SCORE_COLOR = (score: number) => {
  if (score >= 0.7) return 'text-red-600';
  if (score >= 0.5) return 'text-orange-600';
  if (score >= 0.3) return 'text-yellow-600';
  return 'text-green-600';
};

export const ChurnPage: React.FC = () => {
  const { churnScores, churnSummary, setChurnScores } = useCRMStore();
  const [loading, setLoading] = useState(true);
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [triggering, setTriggering] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const scores = await churnAPI.getScores(riskFilter !== 'all' ? riskFilter : undefined);
        const summary = {
          total: scores.length,
          critical: scores.filter((c) => c.riskLevel === 'critical').length,
          high: scores.filter((c) => c.riskLevel === 'high').length,
          medium: scores.filter((c) => c.riskLevel === 'medium').length,
          low: scores.filter((c) => c.riskLevel === 'low').length,
        };
        setChurnScores(scores, summary);
      } catch (err) {
        console.error('Failed to load churn data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [riskFilter]);

  const handleTriggerScoring = async () => {
    setTriggering(true);
    try {
      await churnAPI.triggerScoring();
    } catch (err) {
      console.error('Failed to trigger scoring:', err);
    } finally {
      setTriggering(false);
    }
  };

  const filtered = riskFilter === 'all'
    ? churnScores
    : churnScores.filter((s) => s.riskLevel === riskFilter);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">Churn Risk</h2>
        <button
          onClick={handleTriggerScoring}
          disabled={triggering}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-60"
        >
          {triggering ? 'Scoring...' : 'Run Scoring Now'}
        </button>
      </div>

      {/* Risk Summary */}
      {churnSummary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Critical Risk', count: churnSummary.critical, color: 'red' as const },
            { label: 'High Risk', count: churnSummary.high, color: 'yellow' as const },
            { label: 'Medium Risk', count: churnSummary.medium, color: 'gray' as const },
            { label: 'Low Risk', count: churnSummary.low, color: 'green' as const },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => setRiskFilter(item.label.split(' ')[0].toLowerCase())}
              className={`rounded-xl border-2 p-4 text-left hover:shadow-md transition ${
                riskFilter === item.label.split(' ')[0].toLowerCase()
                  ? 'border-blue-500 ring-2 ring-blue-200'
                  : 'border-gray-200'
              }`}
            >
              <p className="text-sm font-semibold text-gray-600">{item.label}</p>
              <p className="text-3xl font-bold text-gray-900 mt-1">{item.count}</p>
            </button>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2">
        {['all', 'critical', 'high', 'medium', 'low'].map((f) => (
          <button
            key={f}
            onClick={() => setRiskFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
              riskFilter === f
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Customer ID</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Risk Level</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Churn Score</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Last Order</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">Freq. Trend</th>
              <th className="text-right px-5 py-3 font-semibold text-gray-600">AOV Trend</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Calculated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-10 text-gray-400">No data for this risk level</td>
              </tr>
            ) : (
              filtered.map((score) => (
                <tr key={score.customerId} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3 font-mono text-xs text-gray-600">
                    {score.customerId.slice(0, 8)}...
                  </td>
                  <td className="px-5 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${RISK_BADGE[score.riskLevel]}`}>
                      {score.riskLevel}
                    </span>
                  </td>
                  <td className={`px-5 py-3 text-right font-bold ${SCORE_COLOR(score.churnScore)}`}>
                    {(score.churnScore * 100).toFixed(0)}%
                  </td>
                  <td className="px-5 py-3 text-right text-gray-700">
                    {score.lastOrderDays !== null ? `${score.lastOrderDays}d ago` : '–'}
                  </td>
                  <td className={`px-5 py-3 text-right font-medium ${score.frequencyTrend < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {score.frequencyTrend >= 0 ? '+' : ''}{(score.frequencyTrend * 100).toFixed(0)}%
                  </td>
                  <td className={`px-5 py-3 text-right font-medium ${score.avgOrderValueTrend < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {score.avgOrderValueTrend >= 0 ? '+' : ''}{(score.avgOrderValueTrend * 100).toFixed(0)}%
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {formatDistanceToNow(new Date(score.calculatedAt), { addSuffix: true })}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};