import React, { useState, useEffect } from 'react';
import { Modal, Spinner } from '@pos/ui';
import { campaignAPI } from '../api/management';
import type { Campaign, CreateCampaignRequest, UpdateCampaignRequest, CampaignType } from '@pos/shared-types';

const CAMPAIGN_TYPES: { value: CampaignType; label: string; hasDiscount: boolean }[] = [
  { value: 'percentage_discount', label: 'Percentage Discount', hasDiscount: true },
  { value: 'fixed_discount',      label: 'Fixed Amount',        hasDiscount: true },
  { value: 'bogo',                label: 'BOGO',                hasDiscount: false },
  { value: 'free_item',           label: 'Free Item',           hasDiscount: false },
  { value: 'loyalty_reward',      label: 'Loyalty Reward',      hasDiscount: true },
  { value: 'birthday',            label: 'Birthday',            hasDiscount: true },
  { value: 'first_order',         label: 'First Order',         hasDiscount: true },
  { value: 'win_back',            label: 'Win-back',            hasDiscount: true },
  { value: 'churn_recovery',      label: 'Churn Recovery',      hasDiscount: true },
  { value: 'seasonal',            label: 'Seasonal',            hasDiscount: true },
  { value: 'festival',            label: 'Festival',            hasDiscount: true },
  { value: 'coupon',              label: 'Coupon',              hasDiscount: true },
];

interface FormState {
  name: string;
  description: string;
  campaignType: CampaignType | '';
  couponCode: string;
  discountType: 'percentage' | 'fixed' | '';
  discountValue: string;
  maxDiscount: string;
  minOrderAmount: string;
  validFrom: string;
  validUntil: string;
  maxRedemptions: string;
  usagePerCustomer: string;
  priority: string;
  status: Campaign['status'];
}

function toForm(c?: Campaign): FormState {
  if (!c) return {
    name: '', description: '', campaignType: '', couponCode: '',
    discountType: '', discountValue: '', maxDiscount: '', minOrderAmount: '',
    validFrom: '', validUntil: '', maxRedemptions: '', usagePerCustomer: '1',
    priority: '0', status: 'draft',
  };
  return {
    name: c.name,
    description: c.description ?? '',
    campaignType: c.campaignType ?? '',
    couponCode: c.couponCode ?? '',
    discountType: c.discountType ?? '',
    discountValue: c.discountValue != null ? String(c.discountValue) : '',
    maxDiscount: c.maxDiscount != null ? String(c.maxDiscount) : '',
    minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : '',
    validFrom: c.validFrom ? c.validFrom.slice(0, 10) : '',
    validUntil: c.validUntil ? c.validUntil.slice(0, 10) : '',
    maxRedemptions: c.maxRedemptions != null ? String(c.maxRedemptions) : '',
    usagePerCustomer: String(c.usagePerCustomer ?? 1),
    priority: String(c.priority ?? 0),
    status: c.status,
  };
}

interface CampaignFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign?: Campaign;
  storeId: string;
  onSaved: (c: Campaign) => void;
}

export function CampaignFormModal({ isOpen, onClose, campaign, storeId, onSaved }: CampaignFormModalProps) {
  const isEdit = !!campaign;
  const [form, setForm] = useState<FormState>(toForm(campaign));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setForm(toForm(campaign));
      setError('');
    }
  }, [isOpen, campaign?.id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const selectedType = CAMPAIGN_TYPES.find((t) => t.value === form.campaignType);
  const showDiscount = selectedType?.hasDiscount ?? false;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Campaign name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload: Omit<CreateCampaignRequest, 'storeId'> & Partial<{ storeId: string }> = {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        campaignType: (form.campaignType as CampaignType) || undefined,
        couponCode: form.couponCode.trim() || undefined,
        discountType: (form.discountType as 'percentage' | 'fixed') || undefined,
        discountValue: form.discountValue ? parseFloat(form.discountValue) : undefined,
        maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
        minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : undefined,
        validFrom: form.validFrom ? new Date(form.validFrom).toISOString() : undefined,
        validUntil: form.validUntil ? new Date(form.validUntil + 'T23:59:59').toISOString() : undefined,
        maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions) : undefined,
        usagePerCustomer: parseInt(form.usagePerCustomer) || 1,
        priority: parseInt(form.priority) || 0,
        status: form.status,
      };

      let saved: Campaign;
      if (isEdit && campaign) {
        saved = await campaignAPI.update(campaign.id, payload as UpdateCampaignRequest);
      } else {
        saved = await campaignAPI.create({ ...payload, storeId } as CreateCampaignRequest);
      }
      onSaved(saved);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to save campaign');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Campaign' : 'New Campaign'}
      size="full"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            form="campaign-form"
            type="submit"
            disabled={saving}
            className="btn-primary flex items-center gap-2 px-5 py-2 text-sm"
          >
            {saving && <Spinner size="sm" />}
            {isEdit ? 'Save Changes' : 'Create Campaign'}
          </button>
        </>
      }
    >
      <form id="campaign-form" onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="text-sm text-error-700 bg-error-50 border border-error-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {/* Name & Status */}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Campaign Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Summer Sale 20%"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => set('status', e.target.value as Campaign['status'])}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 bg-white"
            >
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
              <option value="expired">Expired</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Brief description of this campaign..."
            rows={2}
            className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 resize-none"
          />
        </div>

        {/* Campaign Type */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Campaign Type</label>
            <select
              value={form.campaignType}
              onChange={(e) => {
                set('campaignType', e.target.value as CampaignType | '');
                set('discountType', '');
              }}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 bg-white"
            >
              <option value="">Select type...</option>
              {CAMPAIGN_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Coupon Code</label>
            <input
              type="text"
              value={form.couponCode}
              onChange={(e) => set('couponCode', e.target.value.toUpperCase())}
              placeholder="e.g. SUMMER20"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 font-mono uppercase"
            />
          </div>
        </div>

        {/* Discount fields */}
        {showDiscount && (
          <div className="grid grid-cols-3 gap-4 bg-neutral-50 rounded-xl p-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Discount Type</label>
              <select
                value={form.discountType}
                onChange={(e) => set('discountType', e.target.value as 'percentage' | 'fixed' | '')}
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 bg-white"
              >
                <option value="">None</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount ($)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">
                Discount Value {form.discountType === 'percentage' ? '(%)' : form.discountType === 'fixed' ? '($)' : ''}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discountValue}
                onChange={(e) => set('discountValue', e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1">Max Discount ($)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.maxDiscount}
                onChange={(e) => set('maxDiscount', e.target.value)}
                placeholder="No cap"
                className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
              />
            </div>
          </div>
        )}

        {/* Dates & Limits */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Start Date</label>
            <input
              type="date"
              value={form.validFrom}
              onChange={(e) => set('validFrom', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">End Date</label>
            <input
              type="date"
              value={form.validUntil}
              onChange={(e) => set('validUntil', e.target.value)}
              min={form.validFrom || undefined}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400 bg-white"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Min. Order Amount ($)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.minOrderAmount}
              onChange={(e) => set('minOrderAmount', e.target.value)}
              placeholder="No minimum"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Max Total Redemptions</label>
            <input
              type="number"
              min="1"
              value={form.maxRedemptions}
              onChange={(e) => set('maxRedemptions', e.target.value)}
              placeholder="Unlimited"
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Uses per Customer</label>
            <input
              type="number"
              min="1"
              value={form.usagePerCustomer}
              onChange={(e) => set('usagePerCustomer', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1">Priority</label>
            <input
              type="number"
              min="0"
              value={form.priority}
              onChange={(e) => set('priority', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-400"
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
