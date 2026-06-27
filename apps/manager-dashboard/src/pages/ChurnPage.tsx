import React, { useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { dashboardAPI } from '../api/dashboard';
import { StatCard } from '../components/StatCard';

export const ChurnPage: React.FC = () => {
  const { churnAlert, selectedStoreId, setChurnAlert } = useDashboardStore();

  useEffect(() => {
    if (!selectedStoreId) return;
    dashboardAPI.getChurnAlert(selectedStoreId).then(setChurnAlert).catch(console.error);
  }, [selectedStoreId]);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Churn Risk Overview</h2>

      {!churnAlert ? (
        <div className="text-center text-gray-400 py-20">Loading churn data...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="At Risk" value={churnAlert.customersAtRisk} icon="⚠️" colorClass="bg-yellow-50 border-yellow-200" />
            <StatCard label="Critical" value={churnAlert.criticalCount} icon="🔴" colorClass="bg-red-50 border-red-200" />
            <StatCard label="Churned" value={churnAlert.customersChurned} icon="✗" colorClass="bg-gray-50 border-gray-200" />
            <StatCard
              label="Weekly Change"
              value={`${churnAlert.weeklyChange >= 0 ? '+' : ''}${churnAlert.weeklyChange}`}
              icon="📊"
              trend={churnAlert.weeklyChange}
            />
          </div>

          {churnAlert.criticalCount > 0 && (
            <div className="bg-red-50 border border-red-300 rounded-xl p-5">
              <h3 className="font-bold text-red-800 text-lg mb-2">Action Required</h3>
              <p className="text-red-700">
                {churnAlert.criticalCount} customers are at critical churn risk. Launch a re-engagement
                campaign from the CRM Dashboard to recover these customers.
              </p>
              
                href="http://localhost:5002/campaigns"
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
              <a>
                Open CRM Campaigns →
              </a>
            </div>
          )}
        </>
      )}
    </div>
  );
};