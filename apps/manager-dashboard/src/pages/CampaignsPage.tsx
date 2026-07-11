import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  PageHeader, Card, CardBody, CardHeader, CardTitle,
  KPICard,
  MegaphoneIcon, DollarSignIcon, TrendingUpIcon, PlusIcon,
  TrashIcon, DownloadIcon, CheckIcon, AlertTriangleIcon,
  Modal,
} from '@pos/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { useDashboardStore } from '../store/dashboardStore';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../api/dashboard';
import { campaignAPI } from '../api/management';
import type { Campaign, CampaignStatus } from '@pos/shared-types';
import { CampaignTable } from '../campaigns/CampaignTable';
import { CampaignFilters, type CampaignFilterState } from '../campaigns/CampaignFilters';
import { CampaignFormModal } from '../campaigns/CampaignFormModal';
import { CampaignAnalyticsModal } from '../campaigns/CampaignAnalyticsModal';

const ROI_COLORS = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'];

type ConfirmAction =
  | { type: 'delete'; campaign: Campaign }
  | { type: 'archive'; campaign: Campaign }
  | { type: 'stop'; campaign: Campaign }
  | { type: 'bulk_delete'; ids: string[] }
  | { type: 'bulk_archive'; ids: string[] };

interface PaginationState {
  page: number;
  totalPages: number;
  total: number;
}

export const CampaignsPage: React.FC = () => {
  const { topCampaigns, setTopCampaigns } = useDashboardStore();
  const { storeId } = useAuth();

  // Campaign list state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState<PaginationState>({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState<CampaignFilterState>({ search: '', status: '', campaignType: '' });
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state
  const [viewingCampaign, setViewingCampaign] = useState<Campaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Analytics KPIs from dashboard
  useEffect(() => {
    dashboardAPI
      .getCampaignROI(storeId || undefined)
      .then(setTopCampaigns)
      .catch(console.error);
  }, [storeId]);

  const loadCampaigns = useCallback(
    async (page = 1, currentFilters = filters) => {
      if (!storeId) return;
      setLoading(true);
      try {
        const result = await campaignAPI.list(storeId, {
          page,
          limit: 20,
          status: currentFilters.status || undefined,
          campaignType: currentFilters.campaignType || undefined,
          search: currentFilters.search || undefined,
        });
        setCampaigns(result.data);
        setPagination({ page: result.page, totalPages: result.totalPages, total: result.total });
        setSelectedIds(new Set());
      } catch (err) {
        console.error('Failed to load campaigns:', err);
      } finally {
        setLoading(false);
      }
    },
    [storeId, filters],
  );

  useEffect(() => {
    loadCampaigns(1, filters);
  }, [storeId, filters.status, filters.campaignType]);

  function handleSearchChange(newFilters: CampaignFilterState) {
    setFilters(newFilters);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (newFilters.search !== filters.search) {
      searchTimerRef.current = setTimeout(() => loadCampaigns(1, newFilters), 300);
    } else {
      loadCampaigns(1, newFilters);
    }
  }

  async function handleStatusChange(campaign: Campaign, status: CampaignStatus) {
    if (status === 'archived') {
      setConfirmAction({ type: 'archive', campaign });
      return;
    }
    if (status === 'completed') {
      setConfirmAction({ type: 'stop', campaign });
      return;
    }
    try {
      const updated = await campaignAPI.update(campaign.id, { status });
      setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  }

  async function handleDuplicate(campaign: Campaign) {
    try {
      const copy = await campaignAPI.duplicate(campaign.id);
      setCampaigns((prev) => [copy, ...prev]);
    } catch (err) {
      console.error('Failed to duplicate:', err);
    }
  }

  function handleDelete(campaign: Campaign) {
    setConfirmAction({ type: 'delete', campaign });
  }

  async function executeConfirm() {
    if (!confirmAction) return;
    setConfirming(true);
    try {
      if (confirmAction.type === 'delete') {
        await campaignAPI.delete(confirmAction.campaign.id);
        setCampaigns((prev) => prev.filter((c) => c.id !== confirmAction.campaign.id));
      } else if (confirmAction.type === 'archive' || confirmAction.type === 'stop') {
        const status: CampaignStatus = confirmAction.type === 'archive' ? 'archived' : 'completed';
        const updated = await campaignAPI.update(confirmAction.campaign.id, { status });
        setCampaigns((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      } else if (confirmAction.type === 'bulk_delete') {
        for (const id of confirmAction.ids) {
          await campaignAPI.delete(id);
        }
        setCampaigns((prev) => prev.filter((c) => !confirmAction.ids.includes(c.id)));
        setSelectedIds(new Set());
      } else if (confirmAction.type === 'bulk_archive') {
        await campaignAPI.bulkUpdateStatus(confirmAction.ids, 'archived');
        setCampaigns((prev) =>
          prev.map((c) => confirmAction.ids.includes(c.id) ? { ...c, status: 'archived' as CampaignStatus } : c),
        );
        setSelectedIds(new Set());
      }
      setConfirmAction(null);
    } catch (err) {
      console.error('Confirm action failed:', err);
    } finally {
      setConfirming(false);
    }
  }

  async function handleBulkStart() {
    const ids = Array.from(selectedIds);
    try {
      await campaignAPI.bulkUpdateStatus(ids, 'active');
      setCampaigns((prev) =>
        prev.map((c) => ids.includes(c.id) ? { ...c, status: 'active' as CampaignStatus } : c),
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk start failed:', err);
    }
  }

  async function handleBulkPause() {
    const ids = Array.from(selectedIds);
    try {
      await campaignAPI.bulkUpdateStatus(ids, 'paused');
      setCampaigns((prev) =>
        prev.map((c) => ids.includes(c.id) ? { ...c, status: 'paused' as CampaignStatus } : c),
      );
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Bulk pause failed:', err);
    }
  }

  function openCreate() {
    setEditingCampaign(undefined);
    setFormOpen(true);
  }

  function openEdit(campaign: Campaign) {
    setEditingCampaign(campaign);
    setFormOpen(true);
  }

  function handleSaved(saved: Campaign) {
    if (editingCampaign) {
      setCampaigns((prev) => prev.map((c) => (c.id === saved.id ? saved : c)));
    } else {
      setCampaigns((prev) => [saved, ...prev]);
    }
  }

  // Dashboard KPI derivations
  const totalRevenue = topCampaigns.reduce((s, c) => s + c.revenueGenerated, 0);
  const avgROI = topCampaigns.length > 0
    ? topCampaigns.reduce((s, c) => s + c.roi, 0) / topCampaigns.length
    : 0;
  const chartData = [...topCampaigns]
    .sort((a, b) => b.roi - a.roi)
    .slice(0, 5)
    .map((c) => ({
      name: c.name.length > 16 ? c.name.slice(0, 14) + '…' : c.name,
      roi: Math.round(c.roi),
    }));

  const selectedCount = selectedIds.size;
  const confirmLabels: Record<ConfirmAction['type'], { title: string; body: string; btn: string; danger: boolean }> = {
    delete: {
      title: 'Delete Campaign',
      body: `"${(confirmAction as any)?.campaign?.name}" will be permanently deleted. This cannot be undone.`,
      btn: 'Delete',
      danger: true,
    },
    archive: {
      title: 'Archive Campaign',
      body: `"${(confirmAction as any)?.campaign?.name}" will be archived and deactivated.`,
      btn: 'Archive',
      danger: false,
    },
    stop: {
      title: 'Stop Campaign',
      body: `"${(confirmAction as any)?.campaign?.name}" will be stopped and marked as completed.`,
      btn: 'Stop Campaign',
      danger: false,
    },
    bulk_delete: {
      title: `Delete ${(confirmAction as any)?.ids?.length ?? 0} Campaigns`,
      body: 'Selected campaigns will be permanently deleted. This cannot be undone.',
      btn: 'Delete All',
      danger: true,
    },
    bulk_archive: {
      title: `Archive ${(confirmAction as any)?.ids?.length ?? 0} Campaigns`,
      body: 'Selected campaigns will be archived and deactivated.',
      btn: 'Archive All',
      danger: false,
    },
  };
  const confirmMeta = confirmAction ? confirmLabels[confirmAction.type] : null;

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Campaigns"
        description="Create and manage promotional campaigns"
        actions={
          <button
            onClick={openCreate}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
          >
            <PlusIcon size={15} />
            New Campaign
          </button>
        }
      />

      {/* Analytics KPI row */}
      {topCampaigns.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <KPICard
            label="Total Campaigns (Analytics)"
            value={topCampaigns.length}
            icon={<MegaphoneIcon size={18} />}
            iconColor="text-primary-600 bg-primary-50"
          />
          <KPICard
            label="Total Revenue"
            value={`$${totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`}
            icon={<DollarSignIcon size={18} />}
            iconColor="text-success-600 bg-success-50"
          />
          <KPICard
            label="Avg ROI"
            value={`${avgROI.toFixed(0)}%`}
            icon={<TrendingUpIcon size={18} />}
            iconColor={avgROI > 100 ? 'text-success-600 bg-success-50' : 'text-warning-600 bg-warning-50'}
          />
        </div>
      )}

      {/* ROI chart (collapsed if no data) */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader><CardTitle>ROI Leaderboard</CardTitle></CardHeader>
          <CardBody>
            <ResponsiveContainer width="100%" height={Math.max(100, chartData.length * 36)}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40, top: 0, bottom: 0 }}>
                <XAxis type="number" unit="%" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12, fill: '#374151' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, 'ROI']}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="roi" radius={[0, 4, 4, 0]} barSize={18}>
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={ROI_COLORS[Math.min(i, ROI_COLORS.length - 1)]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* Campaign Management Table */}
      <Card>
        <CardBody padding="none">
          <div className="px-4 py-3 border-b border-neutral-100 space-y-3">
            {/* Filters */}
            <CampaignFilters filters={filters} onChange={handleSearchChange} />

            {/* Bulk actions */}
            {selectedCount > 0 && (
              <div className="flex items-center gap-2 py-2 px-3 bg-primary-50 rounded-xl border border-primary-100">
                <span className="text-xs font-medium text-primary-700">
                  {selectedCount} selected
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={handleBulkStart}
                    className="flex items-center gap-1.5 text-xs font-medium text-success-700 hover:text-success-800 px-2.5 py-1.5 rounded-lg hover:bg-success-100 transition-colors"
                  >
                    <CheckIcon size={13} /> Start
                  </button>
                  <button
                    onClick={handleBulkPause}
                    className="flex items-center gap-1.5 text-xs font-medium text-warning-700 hover:text-warning-800 px-2.5 py-1.5 rounded-lg hover:bg-warning-100 transition-colors"
                  >
                    ⏸ Pause
                  </button>
                  <button
                    onClick={() => setConfirmAction({ type: 'bulk_archive', ids: Array.from(selectedIds) })}
                    className="flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-800 px-2.5 py-1.5 rounded-lg hover:bg-neutral-200 transition-colors"
                  >
                    <DownloadIcon size={13} /> Archive
                  </button>
                  <button
                    onClick={() => setConfirmAction({ type: 'bulk_delete', ids: Array.from(selectedIds) })}
                    className="flex items-center gap-1.5 text-xs font-medium text-error-600 hover:text-error-800 px-2.5 py-1.5 rounded-lg hover:bg-error-50 transition-colors"
                  >
                    <TrashIcon size={13} /> Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          <CampaignTable
            campaigns={campaigns}
            loading={loading}
            selectedIds={selectedIds}
            onSelectAll={(checked) => {
              if (checked) setSelectedIds(new Set(campaigns.map((c) => c.id)));
              else setSelectedIds(new Set());
            }}
            onSelectOne={(id, checked) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (checked) next.add(id);
                else next.delete(id);
                return next;
              });
            }}
            onView={setViewingCampaign}
            onEdit={openEdit}
            onDuplicate={handleDuplicate}
            onStatusChange={handleStatusChange}
            onDelete={handleDelete}
          />

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100">
              <span className="text-xs text-neutral-500">
                {pagination.total} campaign{pagination.total !== 1 ? 's' : ''}
              </span>
              <div className="flex items-center gap-1">
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => loadCampaigns(p)}
                    className={`w-7 h-7 text-xs rounded-lg transition-colors ${
                      p === pagination.page
                        ? 'bg-primary-600 text-white font-semibold'
                        : 'text-neutral-600 hover:bg-neutral-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Create / Edit Modal */}
      <CampaignFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        campaign={editingCampaign}
        storeId={storeId ?? ''}
        onSaved={handleSaved}
      />

      {/* Analytics View Modal */}
      <CampaignAnalyticsModal
        campaign={viewingCampaign}
        onClose={() => setViewingCampaign(null)}
      />

      {/* Confirmation Dialog */}
      {confirmAction && confirmMeta && (
        <Modal
          isOpen={!!confirmAction}
          onClose={() => !confirming && setConfirmAction(null)}
          title={confirmMeta.title}
          size="sm"
          footer={
            <>
              <button
                onClick={() => setConfirmAction(null)}
                disabled={confirming}
                className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={executeConfirm}
                disabled={confirming}
                className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                  confirmMeta.danger
                    ? 'bg-error-600 text-white hover:bg-error-700'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}
              >
                {confirming ? 'Please wait…' : confirmMeta.btn}
              </button>
            </>
          }
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 p-2 rounded-full flex-shrink-0 ${confirmMeta.danger ? 'bg-error-50' : 'bg-warning-50'}`}>
              <AlertTriangleIcon size={18} className={confirmMeta.danger ? 'text-error-600' : 'text-warning-600'} />
            </div>
            <p className="text-sm text-neutral-600 leading-relaxed">{confirmMeta.body}</p>
          </div>
        </Modal>
      )}
    </div>
  );
};
