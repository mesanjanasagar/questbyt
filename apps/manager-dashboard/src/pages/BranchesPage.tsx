import React, { useEffect, useState, useCallback } from 'react';
import {
  PageHeader, Card, CardBody, Button, Input, Badge, Modal,
  Table, EmptyState, Spinner, useToast,
  PlusIcon, EditIcon, ChevronDownIcon, ChevronRightIcon,
} from '@pos/ui';
import type { Column } from '@pos/ui';
import { useAuth } from '../contexts/AuthContext';
import { branchAPI, type Branch, type DiningArea } from '../api/management';
import { usePermission } from '../hooks/usePermission';

const EMPTY_BRANCH = { branchCode: '', name: '', phone: '', email: '', timezone: 'Asia/Dubai', isMain: false };

export const BranchesPage: React.FC = () => {
  const { storeId } = useAuth();
  const { success, error: toastError } = useToast();
  const canCreate = usePermission('branches:create');
  const canEdit   = usePermission('branches:edit');

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [areas, setAreas]       = useState<Record<string, DiningArea[]>>({});

  const [branchModal, setBranchModal] = useState(false);
  const [editTarget, setEditTarget]   = useState<Branch | null>(null);
  const [form, setForm] = useState(EMPTY_BRANCH);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [areaModal, setAreaModal]   = useState(false);
  const [areaForBranch, setAreaForBranch] = useState<string | null>(null);
  const [areaForm, setAreaForm]     = useState({ name: '', description: '', floorNumber: '' });
  const [areaFieldErrors, setAreaFieldErrors] = useState<Record<string, string>>();

  const loadBranches = useCallback(() => {
    if (!storeId) return;
    setLoading(true);
    branchAPI.list(storeId)
      .then(setBranches)
      .catch(() => toastError('Failed to load branches'))
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => { loadBranches(); }, [loadBranches]);

  const toggleExpand = async (branchId: string) => {
    const nowExpanded = !expanded[branchId];
    setExpanded((p) => ({ ...p, [branchId]: nowExpanded }));
    if (nowExpanded && !areas[branchId]) {
      const list = await branchAPI.getDiningAreas(branchId).catch(() => []);
      setAreas((p) => ({ ...p, [branchId]: list }));
    }
  };

  const extractFieldErrors = (e: any): Record<string, string> => {
    const details = e?.response?.data?.details;
    if (!Array.isArray(details)) return {};
    return Object.fromEntries(details.map((d: any) => [d.path, d.message]));
  };

  const openCreate = () => {
    setEditTarget(null);
    setForm(EMPTY_BRANCH);
    setFieldErrors({});
    setBranchModal(true);
  };
  const openEdit = (b: Branch) => {
    setEditTarget(b);
    setForm({ branchCode: b.branchCode, name: b.name, phone: b.phone ?? '', email: b.email ?? '', timezone: b.timezone, isMain: b.isMain });
    setFieldErrors({});
    setBranchModal(true);
  };

  const cleanForm = (f: typeof EMPTY_BRANCH) => ({
    branchCode: f.branchCode,
    name: f.name,
    phone: f.phone || undefined,
    email: f.email || undefined,
    timezone: f.timezone || undefined,
    isMain: f.isMain,
  });

  const saveBranch = async () => {
    if (!storeId) return;
    setFieldErrors({});
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await branchAPI.update(editTarget.id, cleanForm(form));
        setBranches((p) => p.map((b) => b.id === editTarget.id ? updated : b));
      } else {
        const created = await branchAPI.create({ storeId, ...cleanForm(form) });
        setBranches((p) => [...p, created]);
      }
      success(editTarget ? 'Branch updated' : 'Branch created');
      setBranchModal(false);
    } catch (e: any) {
      const fe = extractFieldErrors(e);
      if (Object.keys(fe).length > 0) {
        setFieldErrors(fe);
      } else {
        toastError(e?.response?.data?.error ?? e?.response?.data?.message ?? 'Failed to save branch');
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleBranchStatus = async (b: Branch) => {
    try {
      const updated = await branchAPI.setStatus(b.id, !b.isActive);
      setBranches((p) => p.map((br) => br.id === b.id ? updated : br));
      success(updated.isActive ? 'Branch activated' : 'Branch deactivated');
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to update branch status');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await branchAPI.remove(deleteTarget.id);
      setBranches((p) => p.filter((b) => b.id !== deleteTarget.id));
      setAreas((p) => { const next = { ...p }; delete next[deleteTarget.id]; return next; });
      success(`"${deleteTarget.name}" deleted`);
      setDeleteTarget(null);
    } catch (e: any) {
      toastError(e?.response?.data?.error ?? 'Failed to delete branch');
    } finally {
      setDeleting(false);
    }
  };

  const saveArea = async () => {
    if (!storeId || !areaForBranch) return;
    setAreaFieldErrors({});
    setSaving(true);
    try {
      const created = await branchAPI.createDiningArea(areaForBranch, {
        storeId,
        name: areaForm.name,
        description: areaForm.description || undefined,
        floorNumber: areaForm.floorNumber ? Number(areaForm.floorNumber) : undefined,
      });
      setAreas((p) => ({ ...p, [areaForBranch]: [...(p[areaForBranch] ?? []), created] }));
      success('Dining area added');
      setAreaModal(false);
    } catch (e: any) {
      const fe = extractFieldErrors(e);
      if (Object.keys(fe).length > 0) {
        setAreaFieldErrors(fe);
      } else {
        toastError(e?.response?.data?.error ?? e?.response?.data?.message ?? 'Failed to add dining area');
      }
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<Branch>[] = [
    {
      key: 'expand', header: '',
      cell: (b) => (
        <button onClick={() => toggleExpand(b.id)} className="p-1 text-neutral-400 hover:text-neutral-600">
          {expanded[b.id] ? <ChevronDownIcon size={16} /> : <ChevronRightIcon size={16} />}
        </button>
      ), width: '40px',
    },
    { key: 'name', header: 'Branch Name', cell: (b) => <span className="font-medium text-neutral-900">{b.name}</span> },
    { key: 'code', header: 'Code', cell: (b) => <code className="text-xs bg-neutral-100 px-2 py-0.5 rounded">{b.branchCode}</code> },
    { key: 'phone', header: 'Phone', cell: (b) => b.phone ?? <span className="text-neutral-400">—</span> },
    { key: 'main', header: '', cell: (b) => b.isMain ? <Badge variant="primary">Main</Badge> : null },
    { key: 'status', header: 'Status', cell: (b) => <Badge variant={b.isActive ? 'success' : 'default'}>{b.isActive ? 'Active' : 'Inactive'}</Badge> },
    {
      key: 'actions', header: '',
      cell: (b) => (
        <div className="flex items-center gap-1">
          {canEdit && (
            <>
              <Button variant="ghost" size="xs" onClick={() => openEdit(b)} title="Edit"><EditIcon size={14} /></Button>
              <Button variant="ghost" size="xs" onClick={() => { setAreaForBranch(b.id); setAreaForm({ name: '', description: '', floorNumber: '' }); setAreaModal(true); }} title="Add dining area">
                + Area
              </Button>
              <Button variant="ghost" size="xs" onClick={() => toggleBranchStatus(b)} title={b.isActive ? 'Deactivate' : 'Activate'} className={b.isActive ? 'text-amber-600' : 'text-emerald-600'}>
                {b.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </>
          )}
          {canEdit && (
            <Button variant="ghost" size="xs" onClick={() => setDeleteTarget(b)} title="Delete" className="text-red-500">
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="Branch Management"
        description="Manage your restaurant locations and dining areas"
        actions={canCreate ? (
          <Button variant="primary" size="sm" icon={<PlusIcon size={16} />} onClick={openCreate}>
            Add Branch
          </Button>
        ) : undefined}
      />

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <>
              <Table
                columns={columns}
                data={branches}
                keyExtractor={(b) => b.id}
                emptyState={<EmptyState title="No branches yet" description="Add your first branch to get started." />}
              />
              {/* Dining areas sub-rows */}
              {branches.map((b) => expanded[b.id] && (
                <div key={b.id + '-areas'} className="border-t border-neutral-100 bg-neutral-50 px-6 py-4">
                  <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Dining Areas — {b.name}</p>
                  {!areas[b.id] ? (
                    <Spinner size="sm" />
                  ) : areas[b.id].length === 0 ? (
                    <p className="text-sm text-neutral-400">No dining areas yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {areas[b.id].map((a) => (
                        <div key={a.id} className="bg-white border border-neutral-200 rounded-lg px-3 py-2 text-sm">
                          <p className="font-medium text-neutral-800">{a.name}</p>
                          {a.floorNumber && <p className="text-xs text-neutral-500">Floor {a.floorNumber}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </CardBody>
      </Card>

      {/* Branch modal */}
      <Modal
        isOpen={branchModal}
        onClose={() => setBranchModal(false)}
        title={editTarget ? 'Edit Branch' : 'Add Branch'}
        size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setBranchModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={saveBranch}>
              {editTarget ? 'Save Changes' : 'Create Branch'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Branch Name *</label>
              <Input value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setFieldErrors((p) => ({ ...p, name: '' })); }} placeholder="Main Branch" className={fieldErrors.name ? 'border-red-400' : ''} />
              {fieldErrors.name && <p className="text-xs text-red-500 mt-1">{fieldErrors.name}</p>}
            </div>
            <div>
              <label className="field-label">Branch Code *</label>
              <Input value={form.branchCode} onChange={(e) => { setForm({ ...form, branchCode: e.target.value.toUpperCase() }); setFieldErrors((p) => ({ ...p, branchCode: '' })); }} placeholder="BR001" className={fieldErrors.branchCode ? 'border-red-400' : ''} />
              {fieldErrors.branchCode && <p className="text-xs text-red-500 mt-1">{fieldErrors.branchCode}</p>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Phone</label>
              <Input value={form.phone} onChange={(e) => { setForm({ ...form, phone: e.target.value }); setFieldErrors((p) => ({ ...p, phone: '' })); }} placeholder="+971 50 000 0000" className={fieldErrors.phone ? 'border-red-400' : ''} />
              {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
            </div>
            <div>
              <label className="field-label">Email</label>
              <Input type="email" value={form.email} onChange={(e) => { setForm({ ...form, email: e.target.value }); setFieldErrors((p) => ({ ...p, email: '' })); }} className={fieldErrors.email ? 'border-red-400' : ''} />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
            </div>
          </div>
          <div>
            <label className="field-label">Timezone</label>
            <Input value={form.timezone} onChange={(e) => { setForm({ ...form, timezone: e.target.value }); setFieldErrors((p) => ({ ...p, timezone: '' })); }} placeholder="Asia/Dubai" className={fieldErrors.timezone ? 'border-red-400' : ''} />
            {fieldErrors.timezone && <p className="text-xs text-red-500 mt-1">{fieldErrors.timezone}</p>}
          </div>
          <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
            <input type="checkbox" checked={form.isMain} onChange={(e) => setForm({ ...form, isMain: e.target.checked })} className="rounded" />
            Set as main branch
          </label>
        </div>
      </Modal>

      {/* Dining area modal */}
      <Modal
        isOpen={areaModal}
        onClose={() => setAreaModal(false)}
        title="Add Dining Area"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setAreaModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={saveArea}>Add Area</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Area Name *</label>
            <Input value={areaForm.name} onChange={(e) => { setAreaForm({ ...areaForm, name: e.target.value }); setAreaFieldErrors((p) => ({ ...p, name: '' })); }} placeholder="Ground Floor, Terrace…" className={areaFieldErrors?.name ? 'border-red-400' : ''} />
            {areaFieldErrors?.name && <p className="text-xs text-red-500 mt-1">{areaFieldErrors.name}</p>}
          </div>
          <div>
            <label className="field-label">Description</label>
            <Input value={areaForm.description} onChange={(e) => setAreaForm({ ...areaForm, description: e.target.value })} />
          </div>
          <div>
            <label className="field-label">Floor Number</label>
            <Input type="number" value={areaForm.floorNumber} onChange={(e) => setAreaForm({ ...areaForm, floorNumber: e.target.value })} placeholder="1" />
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Branch"
        size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="danger" size="sm" loading={deleting} onClick={handleDelete}>Delete Branch</Button>
          </>
        }
      >
        <p className="text-sm text-neutral-700">
          Are you sure you want to delete <strong>{deleteTarget?.name}</strong>? This will permanently remove the branch, all dining areas, and table records. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
};
