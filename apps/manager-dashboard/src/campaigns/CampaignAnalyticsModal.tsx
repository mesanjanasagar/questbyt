import React, { useEffect, useState } from 'react';
import {
  Modal, Badge, Spinner,
  TrendingUpIcon, DollarSignIcon, UsersIcon, ShoppingCartIcon, ZapIcon,
} from '@pos/ui';
import {
  BarChart, Bar, XAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import { campaignAPI } from '../api/management';
import type { Campaign, CampaignStats } from '@pos/shared-types';

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent' }> = {
  draft:     { label: 'Draft',     variant: 'default' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  active:    { label: 'Active',    variant: 'success' },
  paused:    { label: 'Paused',    variant: 'warning' },
  completed: { label: 'Completed', variant: 'primary' },
  expired:   { label: 'Expired',   variant: 'error' },
  archived:  { label: 'Archived',  variant: 'default' },
};

const TYPE_LABEL: Record<string, string> = {
  percentage_discount: 'Percentage Discount',
  fixed_discount: 'Fixed Amount',
  bogo: 'Buy One Get One',
  free_item: 'Free Item',
  loyalty_reward: 'Loyalty Reward',
  birthday: 'Birthday',
  first_order: 'First Order',
  win_back: 'Win-back',
  churn_recovery: 'Churn Recovery',
  seasonal: 'Seasonal',
  festival: 'Festival',
  coupon: 'Coupon',
};

interface CampaignAnalyticsModalProps {
  campaign: Campaign | null;
  onClose: () => void;
}

interface KPI {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

export function CampaignAnalyticsModal({ campaign, onClose }: CampaignAnalyticsModalProps) {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (!campaign) return;
    setStats(null);
    setLoadingStats(true);
    campaignAPI.getStats(campaign.id)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false));
  }, [campaign?.id]);

  if (!campaign) return null;

  const badge = STATUS_BADGE[campaign.status] ?? { label: campaign.status, variant: 'default' as const };

  const kpis: KPI[] = [
    {
      label: 'Revenue Generated',
      value: `$${campaign.revenueGenerated.toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
      icon: <DollarSignIcon size={16} />,
      color: 'text-success-600 bg-success-50',
    },
    {
      label: 'Orders',
      value: campaign.ordersCount.toLocaleString(),
      icon: <ShoppingCartIcon size={16} />,
      color: 'text-primary-600 bg-primary-50',
    },
    {
      label: 'Customers Reached',
      value: campaign.customersReached.toLocaleString(),
      icon: <UsersIcon size={16} />,
      color: 'text-info-600 bg-info-50',
    },
    {
      label: 'ROI',
      value: `${campaign.roi.toFixed(0)}%`,
      icon: <TrendingUpIcon size={16} />,
      color: campaign.roi > 100 ? 'text-success-600 bg-success-50' : 'text-warning-600 bg-warning-50',
    },
  ];

  const deliveryData = stats
    ? [
        { name: 'Sent', value: stats.totalSent, fill: '#2563eb' },
        { name: 'Failed', value: stats.totalFailed, fill: '#ef4444' },
        { name: 'Skipped', value: stats.totalSkipped, fill: '#9ca3af' },
      ]
    : [];

  return (
    <Modal isOpen={!!campaign} onClose={onClose} title="Campaign Analytics" size="full">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">{campaign.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              {campaign.campaignType && (
                <span className="text-xs text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">
                  {TYPE_LABEL[campaign.campaignType] ?? campaign.campaignType}
                </span>
              )}
              {campaign.couponCode && (
                <span className="text-xs font-mono text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full border border-primary-100">
                  {campaign.couponCode}
                </span>
              )}
            </div>
            {campaign.description && (
              <p className="text-sm text-neutral-500 mt-2">{campaign.description}</p>
            )}
          </div>
          <Badge variant={badge.variant} dot>{badge.label}</Badge>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="bg-neutral-50 rounded-xl p-3">
              <div className={`inline-flex p-1.5 rounded-lg mb-2 ${kpi.color}`}>
                {kpi.icon}
              </div>
              <p className="text-lg font-bold text-neutral-900">{kpi.value}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Campaign Details */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm bg-neutral-50 rounded-xl p-4">
          {campaign.discountValue != null && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Discount</span>
              <span className="font-medium text-neutral-800">
                {campaign.discountType === 'percentage' ? `${campaign.discountValue}%` : `$${campaign.discountValue}`}
                {campaign.maxDiscount != null && ` (max $${campaign.maxDiscount})`}
              </span>
            </div>
          )}
          {campaign.minOrderAmount != null && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Min. Order</span>
              <span className="font-medium text-neutral-800">${campaign.minOrderAmount}</span>
            </div>
          )}
          {campaign.validFrom && (
            <div className="flex justify-between">
              <span className="text-neutral-500">Start Date</span>
              <span className="font-medium text-neutral-800">{new Date(campaign.validFrom).toLocaleDateString()}</span>
            </div>
          )}
          {campaign.validUntil && (
            <div className="flex justify-between">
              <span className="text-neutral-500">End Date</span>
              <span className="font-medium text-neutral-800">{new Date(campaign.validUntil).toLocaleDateString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-neutral-500">Usage</span>
            <span className="font-medium text-neutral-800">
              {campaign.usageCount}
              {campaign.maxRedemptions ? ` / ${campaign.maxRedemptions}` : ' (unlimited)'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Per Customer</span>
            <span className="font-medium text-neutral-800">
              {campaign.usagePerCustomer} time{campaign.usagePerCustomer !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Priority</span>
            <span className="font-medium text-neutral-800">{campaign.priority}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-neutral-500">Created</span>
            <span className="font-medium text-neutral-800">{new Date(campaign.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Delivery Stats (messaging campaigns) */}
        {loadingStats && <div className="flex justify-center py-4"><Spinner /></div>}
        {stats && (stats.totalSent + stats.totalFailed + stats.totalSkipped) > 0 && (
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Message Delivery</p>
            <div className="flex items-center gap-4 text-sm mb-3">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary-500" />
                <span className="text-neutral-600">Sent: <strong>{stats.totalSent}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-error-500" />
                <span className="text-neutral-600">Failed: <strong>{stats.totalFailed}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-neutral-400" />
                <span className="text-neutral-600">Skipped: <strong>{stats.totalSkipped}</strong></span>
              </div>
              <div className="ml-auto flex items-center gap-1 text-xs text-neutral-400">
                <ZapIcon size={12} />
                Last 30d: {stats.last30DaysSent}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={deliveryData} margin={{ left: 0, right: 0, top: 0, bottom: 0 }}>
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {deliveryData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </Modal>
  );
}
