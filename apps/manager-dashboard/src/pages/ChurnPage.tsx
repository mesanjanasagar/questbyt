import React, { useEffect } from 'react';
import {
  PageHeader, KPICard, Card, CardBody, Button, Spinner,
  AlertTriangleIcon, AlertCircleIcon, UsersIcon, TrendingUpIcon, TrendingDownIcon,
} from '@pos/ui';
import { useDashboardStore } from '../store/dashboardStore';
import { dashboardAPI } from '../api/dashboard';

export const ChurnPage: React.FC = () => {
  const { churnAlert, selectedStoreId, setChurnAlert } = useDashboardStore();

  useEffect(() => {
    if (!selectedStoreId) return;
    dashboardAPI.getChurnAlert(selectedStoreId).then(setChurnAlert).catch(console.error);
  }, [selectedStoreId]);

  if (!churnAlert) {
    return (
      <div className="p-6">
        <PageHeader title="Churn Risk Overview" />
        <div className="flex items-center justify-center py-20">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  const weeklyPositive = churnAlert.weeklyChange <= 0;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Churn Risk Overview"
        description="Customer retention intelligence powered by Questbyt AI"
      />

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          label="At Risk"
          value={churnAlert.customersAtRisk}
          icon={<AlertTriangleIcon size={18} />}
          iconColor="text-warning-600 bg-warning-50"
        />
        <KPICard
          label="Critical Risk"
          value={churnAlert.criticalCount}
          icon={<AlertCircleIcon size={18} />}
          iconColor="text-error-600 bg-error-50"
        />
        <KPICard
          label="Churned"
          value={churnAlert.customersChurned}
          icon={<UsersIcon size={18} />}
          iconColor="text-neutral-500 bg-neutral-100"
        />
        <KPICard
          label="Weekly Change"
          value={`${churnAlert.weeklyChange >= 0 ? '+' : ''}${churnAlert.weeklyChange}`}
          trend={churnAlert.weeklyChange}
          trendLabel="vs last week"
          icon={weeklyPositive ? <TrendingDownIcon size={18} /> : <TrendingUpIcon size={18} />}
          iconColor={weeklyPositive ? 'text-success-600 bg-success-50' : 'text-error-600 bg-error-50'}
        />
      </div>

      {churnAlert.criticalCount > 0 && (
        <div className="bg-error-50 border border-error-200 rounded-xl p-5">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-error-100 flex items-center justify-center flex-shrink-0 mt-0.5">
              <AlertCircleIcon size={16} className="text-error-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-error-900 text-sm">Action Required</h3>
              <p className="text-sm text-error-700 mt-1">
                {churnAlert.criticalCount} customers are at critical churn risk. Launch a re-engagement
                campaign from the CRM Dashboard to recover these customers before they're lost.
              </p>
              <div className="mt-3">
                <a
                  href="http://localhost:5002/campaigns"
                  target="_blank"
                  rel="noreferrer"
                >
                  <Button variant="danger" size="sm">
                    Open CRM Campaigns →
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {churnAlert.customersAtRisk === 0 && churnAlert.criticalCount === 0 && (
        <Card>
          <CardBody>
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-xl bg-success-50 flex items-center justify-center mx-auto mb-3">
                <UsersIcon size={20} className="text-success-600" />
              </div>
              <p className="font-semibold text-neutral-700">Customer retention is healthy</p>
              <p className="text-sm text-neutral-500 mt-1">No customers are currently at churn risk</p>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
};
