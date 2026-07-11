import { SearchIcon, FilterIcon, XIcon } from '@pos/ui';
import type { CampaignStatus, CampaignType } from '@pos/shared-types';

const STATUSES: { value: CampaignStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'expired', label: 'Expired' },
  { value: 'archived', label: 'Archived' },
];

const CAMPAIGN_TYPES: { value: CampaignType; label: string }[] = [
  { value: 'percentage_discount', label: 'Percentage Discount' },
  { value: 'fixed_discount', label: 'Fixed Amount' },
  { value: 'bogo', label: 'BOGO' },
  { value: 'free_item', label: 'Free Item' },
  { value: 'loyalty_reward', label: 'Loyalty Reward' },
  { value: 'birthday', label: 'Birthday' },
  { value: 'first_order', label: 'First Order' },
  { value: 'win_back', label: 'Win-back' },
  { value: 'churn_recovery', label: 'Churn Recovery' },
  { value: 'seasonal', label: 'Seasonal' },
  { value: 'festival', label: 'Festival' },
  { value: 'coupon', label: 'Coupon' },
];

export interface CampaignFilterState {
  search: string;
  status: string;
  campaignType: string;
}

interface CampaignFiltersProps {
  filters: CampaignFilterState;
  onChange: (filters: CampaignFilterState) => void;
}

export function CampaignFilters({ filters, onChange }: CampaignFiltersProps) {
  const hasActiveFilters = filters.status || filters.campaignType;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
        <input
          type="text"
          placeholder="Search campaigns, codes..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 placeholder:text-neutral-400"
        />
      </div>

      <div className="flex items-center gap-2">
        <FilterIcon size={14} className="text-neutral-400" />
        <select
          value={filters.status}
          onChange={(e) => onChange({ ...filters, status: e.target.value })}
          className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 text-neutral-700"
        >
          <option value="">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          value={filters.campaignType}
          onChange={(e) => onChange({ ...filters, campaignType: e.target.value })}
          className="text-sm border border-neutral-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 text-neutral-700"
        >
          <option value="">All Types</option>
          {CAMPAIGN_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={() => onChange({ ...filters, status: '', campaignType: '' })}
            className="flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-700 px-2 py-2 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <XIcon size={13} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
