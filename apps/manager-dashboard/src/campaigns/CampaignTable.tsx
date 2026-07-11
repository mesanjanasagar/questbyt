import { Badge, Spinner } from '@pos/ui';
import type { Campaign, CampaignStatus } from '@pos/shared-types';
import { CampaignActionsDropdown } from './CampaignActionsDropdown';

const STATUS_BADGE: Record<CampaignStatus, { label: string; variant: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info' | 'accent' }> = {
  draft:     { label: 'Draft',     variant: 'default' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  active:    { label: 'Active',    variant: 'success' },
  paused:    { label: 'Paused',    variant: 'warning' },
  completed: { label: 'Completed', variant: 'primary' },
  expired:   { label: 'Expired',   variant: 'error' },
  archived:  { label: 'Archived',  variant: 'default' },
};

const TYPE_LABEL: Record<string, string> = {
  percentage_discount: 'Percentage %',
  fixed_discount: 'Fixed Amount',
  bogo: 'BOGO',
  free_item: 'Free Item',
  loyalty_reward: 'Loyalty',
  birthday: 'Birthday',
  first_order: 'First Order',
  win_back: 'Win-back',
  churn_recovery: 'Churn Recovery',
  seasonal: 'Seasonal',
  festival: 'Festival',
  coupon: 'Coupon',
};

function fmt(n: number) {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

interface CampaignTableProps {
  campaigns: Campaign[];
  loading: boolean;
  selectedIds: Set<string>;
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
  onView: (c: Campaign) => void;
  onEdit: (c: Campaign) => void;
  onDuplicate: (c: Campaign) => void;
  onStatusChange: (c: Campaign, status: Campaign['status']) => void;
  onDelete: (c: Campaign) => void;
}

export function CampaignTable({
  campaigns,
  loading,
  selectedIds,
  onSelectAll,
  onSelectOne,
  onView,
  onEdit,
  onDuplicate,
  onStatusChange,
  onDelete,
}: CampaignTableProps) {
  const allSelected = campaigns.length > 0 && campaigns.every((c) => selectedIds.has(c.id));
  const someSelected = campaigns.some((c) => selectedIds.has(c.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size="lg" />
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
          <span className="text-2xl">📢</span>
        </div>
        <p className="text-sm font-medium text-neutral-700">No campaigns yet</p>
        <p className="text-xs text-neutral-400 mt-1">Create your first campaign to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200">
            <th className="py-3 px-4 w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => { if (el) el.indeterminate = someSelected && !allSelected; }}
                onChange={(e) => onSelectAll(e.target.checked)}
                className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
              />
            </th>
            {['Name', 'Type', 'Status', 'Start Date', 'End Date', 'Revenue', 'Orders', 'Customers', 'ROI', 'Usage', ''].map((h, i) => (
              <th
                key={h || i}
                className={`py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide whitespace-nowrap ${
                  i === 0 ? 'text-left' : i >= 5 && i <= 9 ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => {
            const badge = STATUS_BADGE[campaign.status] ?? { label: campaign.status, variant: 'default' as const };
            return (
              <tr
                key={campaign.id}
                onClick={() => onView(campaign)}
                className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 cursor-pointer transition-colors group"
              >
                <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(campaign.id)}
                    onChange={(e) => onSelectOne(campaign.id, e.target.checked)}
                    className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                </td>
                <td className="py-3 px-4">
                  <div>
                    <p className="font-medium text-neutral-900 leading-snug">{campaign.name}</p>
                    {campaign.couponCode && (
                      <p className="text-xs text-neutral-400 font-mono mt-0.5">{campaign.couponCode}</p>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-neutral-600 whitespace-nowrap">
                  {campaign.campaignType ? TYPE_LABEL[campaign.campaignType] ?? campaign.campaignType : '—'}
                </td>
                <td className="py-3 px-4">
                  <Badge variant={badge.variant} dot size="sm">{badge.label}</Badge>
                </td>
                <td className="py-3 px-4 text-neutral-500 whitespace-nowrap text-xs">
                  {campaign.validFrom ? new Date(campaign.validFrom).toLocaleDateString() : '—'}
                </td>
                <td className="py-3 px-4 text-neutral-500 whitespace-nowrap text-xs">
                  {campaign.validUntil ? new Date(campaign.validUntil).toLocaleDateString() : '—'}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-neutral-700 font-medium">
                  ${fmt(campaign.revenueGenerated)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-neutral-600">
                  {fmt(campaign.ordersCount)}
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-neutral-600">
                  {fmt(campaign.customersReached)}
                </td>
                <td className={`py-3 px-4 text-right tabular-nums font-semibold ${
                  campaign.roi > 100 ? 'text-success-700' : campaign.roi > 0 ? 'text-primary-700' : 'text-neutral-400'
                }`}>
                  {campaign.roi.toFixed(0)}%
                </td>
                <td className="py-3 px-4 text-right tabular-nums text-neutral-500 text-xs">
                  {campaign.usageCount}
                  {campaign.maxRedemptions ? `/${campaign.maxRedemptions}` : ''}
                </td>
                <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                  <CampaignActionsDropdown
                    campaign={campaign}
                    onView={() => onView(campaign)}
                    onEdit={() => onEdit(campaign)}
                    onDuplicate={() => onDuplicate(campaign)}
                    onStatusChange={(s) => onStatusChange(campaign, s)}
                    onDelete={() => onDelete(campaign)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
