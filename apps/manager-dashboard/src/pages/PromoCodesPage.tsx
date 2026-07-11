import React, { useEffect, useState, useCallback } from 'react';
import {
  PageHeader, Card, CardBody, Button, Input, Badge, Modal,
  Table, EmptyState, Spinner, useToast,
  PlusIcon, TagIcon, TrashIcon, EditIcon,
} from '@pos/ui';
import type { Column } from '@pos/ui';
import { useAuth } from '../contexts/AuthContext';
import { promoCodesAPI, type PromoCode } from '../api/promoCodes';
import { usePermission } from '../hooks/usePermission';

const EMPTY_FORM = {
  code: '',
  description: '',
  discountType: 'percentage' as 'percentage' | 'fixed',
  discountValue: '',
  firstTimeCustomerOnly: false,
  minOrderAmount: '',
  maxUses: '',
  expiresAt: '',
};

export const PromoCodesPage: React.FC = () => {
  const { storeId } = useAuth();
  const { success, error: toastError } = useToast();
  const canManage = usePermission('promo:manage');

  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);

  const [formModal, setFormModal] = useState(false);
  const [editTarget, setEditTarget] = useState<PromoCode | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PromoCode | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => {
    if (!storeId) return;
    setLoading(true);
    promoCodesAPI.list(storeId)
      .then(setCodes)
      .catch(() => toastError('Failed to load promo codes'))
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setFormModal(true);
  };

  const openEdit = (c: PromoCode) => {
    setEditTarget(c);
    setForm({
      code: c.code,
      description: c.description ?? '',
      discountType: c.discountType,
      discountValue: String(c.discountValue),
      firstTimeCustomerOnly: c.firstTimeCustomerOnly,
      minOrderAmount: c.minOrderAmount != null ? String(c.minOrderAmount) : '',
      maxUses: c.maxUses != null ? String(c.maxUses) : '',
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : '',
    });
    setErrors({});
    setFormModal(true);
  };

  const handleSave = async () => {
    if (!storeId) return;
    const fe: Record<string, string> = {};
    if (!form.code.trim()) fe.code = 'Code is required';
    const value = parseFloat(form.discountValue);
    if (!form.discountValue || isNaN(value) || value <= 0) fe.discountValue = 'Enter a valid discount value';
    if (form.discountType === 'percentage' && value > 100) fe.discountValue = 'Percentage cannot exceed 100';
    if (Object.keys(fe).length > 0) { setErrors(fe); return; }

    setSaving(true);
    try {
      const payload = {
        description: form.description.trim() || undefined,
        discountType: form.discountType,
        discountValue: value,
        firstTimeCustomerOnly: form.firstTimeCustomerOnly,
        minOrderAmount: form.minOrderAmount ? parseFloat(form.minOrderAmount) : undefined,
        maxUses: form.maxUses ? parseInt(form.maxUses, 10) : undefined,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
      };
      if (editTarget) {
        const updated = await promoCodesAPI.update(editTarget.id, payload);
        setCodes((p) => p.map((c) => c.id === updated.id ? updated : c));
        success(`"${updated.code}" updated`);
      } else {
        const created = await promoCodesAPI.create({ storeId, code: form.code.trim(), ...payload });
        setCodes((p) => [created, ...p]);
        success(`"${created.code}" created`);
      }
      setFormModal(false);
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed to save promo code');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (c: PromoCode) => {
    try {
      const updated = await promoCodesAPI.update(c.id, { isActive: !c.isActive });
      setCodes((p) => p.map((x) => x.id === updated.id ? updated : x));
      success(updated.isActive ? `"${updated.code}" activated` : `"${updated.code}" deactivated`);
    } catch {
      toastError('Failed to update status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await promoCodesAPI.remove(deleteTarget.id);
      setCodes((p) => p.filter((c) => c.id !== deleteTarget.id));
      success(`"${deleteTarget.code}" deleted`);
      setDeleteTarget(null);
    } catch {
      toastError('Failed to delete promo code');
    } finally {
      setDeleting(false);
    }
  };

  const columns: Column<PromoCode>[] = [
    {
      key: 'code',
      header: 'Code',
      cell: (c) => (
        <div>
          <span className="font-mono font-bold text-neutral-900">{c.code}</span>
          {c.description && <p className="text-xs text-neutral-500 mt-0.5">{c.description}</p>}
        </div>
      ),
    },
    {
      key: 'discount',
      header: 'Discount',
      cell: (c) => (
        <span className="font-semibold text-neutral-800">
          {c.discountType === 'percentage' ? `${c.discountValue}%` : `AED ${c.discountValue.toFixed(2)}`}
        </span>
      ),
    },
    {
      key: 'eligibility',
      header: 'Eligibility',
      cell: (c) => c.firstTimeCustomerOnly
        ? <Badge variant="info">First-time customers</Badge>
        : <span className="text-neutral-400 text-xs">Anyone</span>,
    },
    {
      key: 'usage',
      header: 'Usage',
      headerClassName: 'text-right',
      className: 'text-right tabular-nums text-neutral-600',
      cell: (c) => c.maxUses ? `${c.usedCount} / ${c.maxUses}` : `${c.usedCount}`,
    },
    {
      key: 'expires',
      header: 'Expires',
      cell: (c) => c.expiresAt
        ? <span className="text-xs text-neutral-500">{new Date(c.expiresAt).toLocaleDateString()}</span>
        : <span className="text-xs text-neutral-400">Never</span>,
    },
    {
      key: 'status',
      header: 'Status',
      cell: (c) => (
        <button
          onClick={() => canManage && toggleActive(c)}
          disabled={!canManage}
          className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
            c.isActive ? 'bg-success-50 text-success-700' : 'bg-neutral-100 text-neutral-500'
          } ${canManage ? 'cursor-pointer hover:opacity-80' : ''}`}
        >
          {c.isActive ? 'Active' : 'Inactive'}
        </button>
      ),
    },
    {
      key: 'actions',
      header: '',
      headerClassName: 'text-right',
      className: 'text-right',
      cell: (c) => canManage ? (
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => openEdit(c)} className="p-1.5 text-neutral-400 hover:text-primary-600 rounded">
            <EditIcon size={15} />
          </button>
          <button onClick={() => setDeleteTarget(c)} className="p-1.5 text-neutral-400 hover:text-red-600 rounded">
            <TrashIcon size={15} />
          </button>
        </div>
      ) : null,
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Promo Codes"
        description="Create and manage discount codes cashiers can apply on the POS"
        actions={canManage ? (
          <Button variant="primary" size="sm" icon={<PlusIcon size={16} />} onClick={openCreate}>
            Add Promo Code
          </Button>
        ) : undefined}
      />

      <Card>
        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : codes.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={<TagIcon size={32} />}
              title="No promo codes yet"
              description="Create a code like WELCOME10 to offer first-time customers a discount at checkout."
            />
          </CardBody>
        ) : (
          <Table columns={columns} data={codes} keyExtractor={(c) => c.id} />
        )}
      </Card>

      <Modal
        isOpen={formModal}
        onClose={() => setFormModal(false)}
        title={editTarget ? `Edit ${editTarget.code}` : 'Add Promo Code'}
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setFormModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleSave}>
              {editTarget ? 'Save Changes' : 'Create'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Code *</label>
            <Input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="WELCOME10"
              disabled={!!editTarget}
              autoFocus
              className={errors.code ? 'border-red-400' : ''}
            />
            {errors.code && <p className="text-xs text-red-500 mt-1">{errors.code}</p>}
          </div>
          <div>
            <label className="field-label">Description</label>
            <Input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="10% off for new customers"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Discount Type *</label>
              <select
                className="input w-full"
                value={form.discountType}
                onChange={(e) => setForm({ ...form, discountType: e.target.value as 'percentage' | 'fixed' })}
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed amount (AED)</option>
              </select>
            </div>
            <div>
              <label className="field-label">Discount Value *</label>
              <Input
                type="number"
                value={form.discountValue}
                onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                placeholder={form.discountType === 'percentage' ? '10' : '25.00'}
                className={errors.discountValue ? 'border-red-400' : ''}
              />
              {errors.discountValue && <p className="text-xs text-red-500 mt-1">{errors.discountValue}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Min Order Amount</label>
              <Input
                type="number"
                value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: e.target.value })}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="field-label">Max Uses</label>
              <Input
                type="number"
                value={form.maxUses}
                onChange={(e) => setForm({ ...form, maxUses: e.target.value })}
                placeholder="Unlimited"
              />
            </div>
          </div>
          <div>
            <label className="field-label">Expires On</label>
            <Input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700 pt-1">
            <input
              type="checkbox"
              checked={form.firstTimeCustomerOnly}
              onChange={(e) => setForm({ ...form, firstTimeCustomerOnly: e.target.checked })}
              className="rounded"
            />
            Only valid for a customer's first order
          </label>
          {form.firstTimeCustomerOnly && (
            <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 text-xs text-neutral-600">
              A customer must be attached to the order on POS (via the Customer button) for this code to be
              accepted — it checks that store against their order history.
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Promo Code"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>Yes, Delete</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Delete <strong>{deleteTarget?.code}</strong>? Cashiers will no longer be able to apply it. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
};
