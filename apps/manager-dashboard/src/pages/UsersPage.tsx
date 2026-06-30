import React, { useEffect, useState, useCallback } from 'react';
import {
  PageHeader, Card, CardBody, Button, Input, Badge, Modal,
  Table, EmptyState, Spinner, useToast,
  UserCheckIcon, PlusIcon, KeyIcon, ShieldIcon,
} from '@pos/ui';
import type { Column } from '@pos/ui';
import { useAuth } from '../contexts/AuthContext';
import { userAPI, type UserRecord } from '../api/management';
import { useIsAdmin, usePermission } from '../hooks/usePermission';
import { ROLE_LABELS, ALL_ROLES } from '../utils/permissions';
import { format } from 'date-fns';

const ROLE_VARIANT: Record<string, string> = {
  admin: 'error', manager: 'primary', cashier: 'success', kitchen: 'warning', waiter: 'info',
};
const STATUS_VARIANT: Record<string, 'success' | 'default' | 'error'> = {
  active: 'success', inactive: 'default', suspended: 'error',
};

export const UsersPage: React.FC = () => {
  const { storeId } = useAuth();
  const { success, error: toastError } = useToast();
  const isAdmin   = useIsAdmin();
  const canCreate = usePermission('users:create');
  const canEdit   = usePermission('users:edit');

  const [users, setUsers]   = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const [createModal, setCreateModal]   = useState(false);
  const [roleModal, setRoleModal]       = useState(false);
  const [pwModal, setPwModal]           = useState(false);
  const [targetUser, setTargetUser]     = useState<UserRecord | null>(null);
  const [saving, setSaving]             = useState(false);
  const [roleFilter, setRoleFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]             = useState('');

  const [createForm, setCreateForm] = useState({ username: '', email: '', password: '', role: 'cashier' });
  const [newRole, setNewRole]       = useState('');
  const [newPw, setNewPw]           = useState('');
  const [confirmPw, setConfirmPw]   = useState('');

  const load = useCallback(() => {
    if (!storeId) return;
    setLoading(true);
    userAPI.list(storeId)
      .then(setUsers)
      .catch(() => toastError('Failed to load users'))
      .finally(() => setLoading(false));
  }, [storeId]);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter((u) => {
    if (roleFilter && u.role !== roleFilter) return false;
    if (statusFilter && u.status !== statusFilter) return false;
    if (search && !u.username.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleCreate = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      const user = await userAPI.create({ storeId, ...createForm, email: createForm.email || undefined });
      setUsers((p) => [...p, user]);
      success(`User ${user.username} created`);
      setCreateModal(false);
    } catch (e: any) {
      toastError(e?.response?.data?.message ?? 'Failed to create user');
    } finally {
      setSaving(false);
    }
  };

  const handleRoleChange = async () => {
    if (!targetUser || !newRole) return;
    setSaving(true);
    try {
      const updated = await userAPI.updateRole(targetUser.id, newRole);
      setUsers((p) => p.map((u) => u.id === updated.id ? updated : u));
      success(`Role updated to ${ROLE_LABELS[newRole as keyof typeof ROLE_LABELS]}`);
      setRoleModal(false);
    } catch {
      toastError('Failed to update role');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!targetUser) return;
    if (newPw !== confirmPw) { toastError('Passwords do not match'); return; }
    if (newPw.length < 8) { toastError('Password must be at least 8 characters'); return; }
    setSaving(true);
    try {
      await userAPI.resetPassword(targetUser.id, newPw);
      success('Password reset successfully');
      setPwModal(false);
      setNewPw(''); setConfirmPw('');
    } catch {
      toastError('Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (user: UserRecord) => {
    const next = user.status === 'active' ? 'inactive' : 'active';
    try {
      const updated = await userAPI.updateStatus(user.id, next);
      setUsers((p) => p.map((u) => u.id === updated.id ? updated : u));
      success(`${user.username} ${next === 'active' ? 'activated' : 'deactivated'}`);
    } catch {
      toastError('Failed to update status');
    }
  };

  const columns: Column<UserRecord>[] = [
    {
      key: 'user', header: 'User',
      cell: (u) => (
        <div>
          <p className="font-medium text-neutral-900">{u.username}</p>
          {u.email && <p className="text-xs text-neutral-500">{u.email}</p>}
        </div>
      ),
    },
    {
      key: 'role', header: 'Role',
      cell: (u) => <Badge variant={(ROLE_VARIANT[u.role] ?? 'default') as any}>{ROLE_LABELS[u.role as keyof typeof ROLE_LABELS] ?? u.role}</Badge>,
    },
    {
      key: 'status', header: 'Status',
      cell: (u) => (
        <button onClick={() => canEdit && toggleStatus(u)} className={canEdit ? 'cursor-pointer' : 'cursor-default'}>
          <Badge variant={STATUS_VARIANT[u.status] ?? 'default'} dot>{u.status}</Badge>
        </button>
      ),
    },
    {
      key: 'created', header: 'Created',
      cell: (u) => <span className="text-xs text-neutral-500">{format(new Date(u.createdAt), 'dd MMM yyyy')}</span>,
    },
    {
      key: 'last_login', header: 'Last Login',
      cell: (u) => u.lastLogin
        ? <span className="text-xs text-neutral-500">{format(new Date(u.lastLogin), 'dd MMM, HH:mm')}</span>
        : <span className="text-xs text-neutral-400">Never</span>,
    },
    {
      key: 'actions', header: '',
      cell: (u) => (
        <div className="flex items-center gap-1">
          {isAdmin && (
            <Button variant="ghost" size="xs" title="Change role"
              onClick={() => { setTargetUser(u); setNewRole(u.role); setRoleModal(true); }}>
              <ShieldIcon size={14} />
            </Button>
          )}
          {canEdit && (
            <Button variant="ghost" size="xs" title="Reset password"
              onClick={() => { setTargetUser(u); setNewPw(''); setConfirmPw(''); setPwModal(true); }}>
              <KeyIcon size={14} />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <PageHeader
        title="User Management"
        description="Create users, assign roles, and manage account access"
        actions={canCreate ? (
          <Button variant="primary" size="sm" onClick={() => { setCreateForm({ username: '', email: '', password: '', role: 'cashier' }); setCreateModal(true); }}>
            <PlusIcon size={16} className="mr-1.5" /> Create User
          </Button>
        ) : undefined}
      />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input placeholder="Search username or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <select className="input text-sm py-1.5" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
          <option value="">All Roles</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select className="input text-sm py-1.5" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>
        {(search || roleFilter || statusFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); }}>Clear</Button>
        )}
        <span className="ml-auto text-sm text-neutral-500">{filtered.length} users</span>
      </div>

      <Card>
        <CardBody className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Spinner size="lg" /></div>
          ) : (
            <Table columns={columns} data={filtered} keyExtractor={(u) => u.id}
              emptyState={<EmptyState icon={<UserCheckIcon size={32} />} title="No users found" description="Create your first user to get started." />}
            />
          )}
        </CardBody>
      </Card>

      {/* Create User Modal */}
      <Modal isOpen={createModal} onClose={() => setCreateModal(false)} title="Create User" size="md"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setCreateModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleCreate}>Create User</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="field-label">Username *</label>
              <Input value={createForm.username} onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })} autoFocus />
            </div>
            <div>
              <label className="field-label">Email</label>
              <Input type="email" value={createForm.email} onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="field-label">Password *</label>
            <Input type="password" value={createForm.password} onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })} placeholder="Min 8 characters" />
          </div>
          <div>
            <label className="field-label">Role *</label>
            <select className="input w-full" value={createForm.role} onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}>
              {ALL_ROLES.filter((r) => r !== 'admin' || isAdmin).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
          </div>
          <div className="bg-neutral-50 rounded-lg p-3 text-xs text-neutral-600">
            The user will be able to log in immediately using these credentials. Assign them to a branch from the Staff Management page.
          </div>
        </div>
      </Modal>

      {/* Change Role Modal */}
      <Modal isOpen={roleModal} onClose={() => setRoleModal(false)} title={`Change Role — ${targetUser?.username}`} size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setRoleModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handleRoleChange}>Apply Role</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-600">Select the new role for <strong>{targetUser?.username}</strong>. This takes effect on their next login.</p>
          <div className="grid grid-cols-1 gap-2">
            {ALL_ROLES.map((r) => (
              <button key={r} onClick={() => setNewRole(r)}
                className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm transition-colors ${newRole === r ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-neutral-200 hover:border-neutral-300'}`}>
                <span className="font-medium">{ROLE_LABELS[r]}</span>
                {newRole === r && <span className="text-primary-600">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal isOpen={pwModal} onClose={() => setPwModal(false)} title={`Reset Password — ${targetUser?.username}`} size="sm"
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setPwModal(false)}>Cancel</Button>
            <Button variant="primary" size="sm" loading={saving} onClick={handlePasswordReset}>Reset Password</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">New Password</label>
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="Min 8 characters" autoFocus />
          </div>
          <div>
            <label className="field-label">Confirm Password</label>
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
};
