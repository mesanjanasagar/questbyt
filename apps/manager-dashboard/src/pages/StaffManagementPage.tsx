import React, { useEffect, useState, useCallback } from 'react';
import {
  PageHeader, Card, CardBody, Button, Input, Badge, Modal,
  Table, EmptyState, Spinner, useToast,
  PlusIcon, EditIcon, TrashIcon, UserCheckIcon,
} from '@pos/ui';
import type { Column } from '@pos/ui';
import { useAuth } from '../contexts/AuthContext';
import { staffAPI, userAPI, branchAPI, type StaffProfile, type UserRecord, type Branch } from '../api/management';
import { usePermission, useIsAdmin } from '../hooks/usePermission';
import { ROLE_LABELS } from '../utils/permissions';
import { format } from 'date-fns';

interface StaffRow extends StaffProfile {
  user?: UserRecord;
}

const ROLE_VARIANT: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'default'> = {
  admin: 'error' as any, manager: 'primary', cashier: 'success', kitchen: 'warning', waiter: 'info',
};

export const StaffManagementPage: React.FC = () => {
  const { storeId } = useAuth();
  const { success, error: toastError } = useToast();
  const isAdmin    = useIsAdmin();
  const canCreate  = usePermission('staff:create');
  const canEdit    = usePermission('staff:edit');
  const canDelete  = usePermission('staff:delete');

  const [staff, setStaff]       = useState<StaffRow[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading]   = useState(true);

  const [createModal, setCreateModal] = useState(false);
  const [editModal, setEditModal]     = useState(false);
  const [editTarget, setEditTarget]   = useState<StaffRow | null>(null);
  const [saving, setSaving]           = useState(false);

  const [roleFilter, setRoleFilter]     = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const [createForm, setCreateForm] = useState({ username: '', email: '', password: '', role: 'cashier', branchId: '', position: '', employeeNumber: '' });
  const [editForm, setEditForm]     = useState({ branchId: '', position: '', employeeNumber: '' });
  const [createErrors, setCreateErrors] = useState<Record<string, string>>({});
  const [editErrors, setEditErrors]     = useState<Record<string, string>>({});

  const loadData = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const [staffList, userList, branchList] = await Promise.all([
        staffAPI.list(storeId),
        userAPI.list(storeId),
        branchAPI.list(storeId),
      ]);
      const userMap = Object.fromEntries(userList.map((u) => [u.id, u]));
      setStaff(staffList.map((s) => ({ ...s, user: userMap[s.userId] })));
      setBranches(branchList);
    } catch (e: any) {
      console.error('[StaffManagementPage] loadData failed:', e?.response?.data ?? e?.message ?? e);
      toastError(
        e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed to load staff data',
      );
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => { loadData(); }, [loadData]);

  const extractFieldErrors = (e: any): Record<string, string> => {
    const details = e?.response?.data?.details;
    if (!Array.isArray(details)) return {};
    return Object.fromEntries(details.map((d: any) => [d.path, d.message]));
  };

  const openCreate = () => {
    setCreateForm({ username: '', email: '', password: '', role: 'cashier', branchId: branches[0]?.id ?? '', position: '', employeeNumber: `EMP${String(staff.length + 1).padStart(3, '0')}` });
    setCreateErrors({});
    setCreateModal(true);
  };

  const openEdit = (row: StaffRow) => {
    setEditTarget(row);
    setEditForm({ branchId: row.branchId ?? '', position: row.position ?? '', employeeNumber: row.employeeNumber });
    setEditErrors({});
    setEditModal(true);
  };

  const handleCreate = async () => {
    if (!storeId) return;
    setCreateErrors({});
    setSaving(true);
    try {
      const newUser = await userAPI.create({
        storeId,
        username: createForm.username,
        email: createForm.email || undefined,
        password: createForm.password,
        role: createForm.role,
      });
      await staffAPI.create(storeId, {
        userId: newUser.id,
        branchId: createForm.branchId || undefined,
        employeeNumber: createForm.employeeNumber,
        position: createForm.position || undefined,
      });
      success(`${newUser.username} added to team`);
      setCreateModal(false);
      loadData();
    } catch (e: any) {
      const fe = extractFieldErrors(e);
      if (Object.keys(fe).length > 0) {
        setCreateErrors(fe);
      } else {
        // Prefer human-readable .message over opaque error codes (auth-service returns both)
        toastError(
          e?.response?.data?.message ?? e?.response?.data?.error ?? e?.message ?? 'Failed to create staff member',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    setEditErrors({});
    setSaving(true);
    try {
      const updated = await staffAPI.update(editTarget.id, { branchId: editForm.branchId || null, position: editForm.position, employeeNumber: editForm.employeeNumber });
      setStaff((p) => p.map((s) => s.id === editTarget.id ? { ...s, ...updated } : s));
      success('Staff profile updated');
      setEditModal(false);
    } catch (e: any) {
      const fe = extractFieldErrors(e);
      if (Object.keys(fe).length > 0) {
        setEditErrors(fe);
      } else {
        toastError(
          e?.response?.data?.message ?? e?.response?.data?.error ?? 'Failed to update staff profile',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: StaffRow) => {
    if (!confirm(`Remove ${row.user?.username ?? 'this staff member'} from the team?`)) return;
    try {
      await staffAPI.delete(row.id);
      setStaff((p) => p.filter((s) => s.id !== row.id));
      success('Staff profile removed');
    } catch {
      toastError('Failed to remove staff member');
    }
  };

  const toggleStatus = async (row: StaffRow) => {
    if (!row.user) return;
    const newStatus = row.user.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await userAPI.updateStatus(row.user.id, newStatus);
      setStaff((p) => p.map((s) => s.id === row.id ? { ...s, user: updated } : s));
      success(`${row.user.username} ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
    } catch {
      toastError('Failed to update status');
    }
  };

  const branchName = (id?: string) => branches.find((b) => b.id === id)?.name ?? '—';

  const filtered = staff.filter((s) => {
    if (roleFilter && s.user?.role !== roleFilter) return false;
    if (branchFilter && s.branchId !== branchFilter) return false;
    return true;
  });

  const columns: Column<StaffRow>[] = [
    {
      key: 'name', header: 'Staff Member',
      cell: (s) => (
        <div>
          <p className="font-medium text-neutral-900">{s.user?.username ?? '—'}</p>
          {s.user?.email && <p className="text-xs text-neutral-500">{s.user.email}</p>}
        </div>
      ),
    },
    {
      key: 'role', header: 'Role',
      cell: (s) => s.user?.role ? <Badge variant={ROLE_VARIANT[s.user.role] ?? 'default'}>{ROLE_LABELS[s.user.role as keyof typeof ROLE_LABELS] ?? s.user.role}</Badge> : null,
    },
    { key: 'branch', header: 'Branch', cell: (s) => <span className="text-sm text-neutral-700">{branchName(s.branchId)}</span> },
    { key: 'empno', header: 'Employee #', cell: (s) => <code className="text-xs bg-neutral-100 px-2 py-0.5 rounded">{s.employeeNumber}</code> },
    { key: 'position', header: 'Position', cell: (s) => s.position ?? <span className="text-neutral-400">—</span> },
    {
      key: 'status', header: 'Status',
      cell: (s) => (
        <button onClick={() => toggleStatus(s)} className="cursor-pointer">
          <Badge variant={s.user?.status === 'active' ? 'success' : 'default'} dot>
            {s.user?.status ?? '—'}
          </Badge>
        </button>
      ),
    },
    {
      key: 'login', header: 'Last Login',
      cell: (s) => s.user?.lastLogin
        ? <span className="text-xs text-neutral-500">{format(new Date(s.user.lastLogin), 'dd MMM, HH:mm')}</span>
        : <span className="text-xs text-neutral-400">Never</span>,
    },
    {
      key: 'actions', header: '',
      cell: (s) => (
        <div className="flex items-center gap-1">
          {canEdit && <Button variant="ghost" size="xs" onClick={() => openEdit(s)}><EditIcon size={14} /></Button>}
          {canDelete && isAdmin && <Button variant="ghost" size="xs" onClick={() => handleDelete(s)}><TrashIcon size={14} /></Button>}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Staff Management"
        description="Manage team members, roles, and branch assignments"
        actions={canCreate ? (
          <Button variant="primary" size="sm" onClick={openCreate}>
            <PlusIcon size={16} className="mr-1.5" /> Add Staff Member
          </Button>
        ) : undefined}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select className="input text-sm py-1.5" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input text-sm py-1.5" value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)}>
          <option value="">All Branches</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        {(roleFilter || branchFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setRoleFilter(''); setBranchFilter(''); }}>Clear</Button>
        )}
        <span className="ml-auto text-sm text-neutral-500">{filtered.length} members</span>
      </div>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <Table
              columns={columns}
              data={filtered}
              keyExtractor={(s) => s.id}
              emptyState={<EmptyState icon={<UserCheckIcon size={32} />} title="No staff members" description="Add your first team member to get started." />}
            />
          )}
        </CardBody>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Add Staff Member" size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleCreate}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Username *</label>
              <Input value={createForm.username} onChange={(e) => { setCreateForm({ ...createForm, username: e.target.value }); setCreateErrors((p) => ({ ...p, username: '' })); }} placeholder="john.doe" autoFocus className={createErrors.username ? 'border-red-400' : ''} />
              {createErrors.username && <p className="text-xs text-red-500 mt-1">{createErrors.username}</p>}
            </div>
            <div>
              <label className="field-label">Email</label>
              <Input type="email" value={createForm.email} onChange={(e) => { setCreateForm({ ...createForm, email: e.target.value }); setCreateErrors((p) => ({ ...p, email: '' })); }} className={createErrors.email ? 'border-red-400' : ''} />
              {createErrors.email && <p className="text-xs text-red-500 mt-1">{createErrors.email}</p>}
            </div>
          </div>
          <div>
            <label className="field-label">Password *</label>
            <Input type="password" value={createForm.password} onChange={(e) => { setCreateForm({ ...createForm, password: e.target.value }); setCreateErrors((p) => ({ ...p, password: '' })); }} placeholder="Min 8 characters" className={createErrors.password ? 'border-red-400' : ''} />
            {createErrors.password && <p className="text-xs text-red-500 mt-1">{createErrors.password}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Role *</label>
              <select className="input w-full" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
                {Object.entries(ROLE_LABELS).filter(([v]) => v !== 'admin' || isAdmin).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Branch</label>
              <select className="input w-full" value={createForm.branchId} onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}>
                <option value="">— No branch —</option>
                {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Employee #</label>
              <Input value={createForm.employeeNumber} onChange={(e) => { setCreateForm({ ...createForm, employeeNumber: e.target.value }); setCreateErrors((p) => ({ ...p, employeeNumber: '' })); }} className={createErrors.employeeNumber ? 'border-red-400' : ''} />
              {createErrors.employeeNumber && <p className="text-xs text-red-500 mt-1">{createErrors.employeeNumber}</p>}
            </div>
            <div>
              <label className="field-label">Position</label>
              <Input value={createForm.position} onChange={(e) => setCreateForm({ ...createForm, position: e.target.value })} placeholder="Head Chef, Senior Cashier…" />
            </div>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editModal} onClose={() => setEditModal(false)} title={`Edit — ${editTarget?.user?.username}`} size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setEditModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Branch Assignment</label>
            <select className="input w-full" value={editForm.branchId} onChange={(e) => setEditForm({ ...editForm, branchId: e.target.value })}>
              <option value="">— No branch —</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label">Employee #</label>
            <Input value={editForm.employeeNumber} onChange={(e) => { setEditForm({ ...editForm, employeeNumber: e.target.value }); setEditErrors((p) => ({ ...p, employeeNumber: '' })); }} className={editErrors.employeeNumber ? 'border-red-400' : ''} />
            {editErrors.employeeNumber && <p className="text-xs text-red-500 mt-1">{editErrors.employeeNumber}</p>}
          </div>
          <div>
            <label className="field-label">Position</label>
            <Input value={editForm.position} onChange={(e) => setEditForm({ ...editForm, position: e.target.value })} placeholder="Head Chef, Senior Cashier…" />
          </div>
        </div>
      </Modal>
    </div>
  );
};
