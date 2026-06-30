import React from 'react';
import { PageHeader, Card, CardHeader, CardTitle, CardBody, Badge } from '@pos/ui';
import { CheckIcon } from '@pos/ui';
import { MODULE_PERMISSIONS, ROLE_LABELS, ALL_ROLES, hasPermission } from '../utils/permissions';

const PERMISSION_LABELS: Record<string, string> = {
  view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete',
  manage: 'Manage', assign: 'Assign',
};

function getAction(permission: string): string {
  return permission.split(':')[1] ?? permission;
}

const ROLE_DESCRIPTIONS: Record<string, { color: string; description: string }> = {
  admin:   { color: 'bg-red-100 text-red-700',     description: 'Full access to all modules. Can manage users, roles, and system settings.' },
  manager: { color: 'bg-primary-100 text-primary-700', description: 'Operational control. Can manage staff, menus, inventory, and view reports.' },
  cashier: { color: 'bg-success-100 text-success-700', description: 'POS terminal access. Can process orders and payments.' },
  kitchen: { color: 'bg-warning-100 text-warning-700', description: 'Kitchen display access. Views and updates order status.' },
  waiter:  { color: 'bg-info-100 text-info-700',   description: 'Floor access. Creates orders and manages table status.' },
};

export const AccessControlPage: React.FC = () => {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <PageHeader
        title="Access Control"
        description="Role-based permissions define what each user type can see and do"
      />

      {/* Role Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {ALL_ROLES.map((role) => {
          const info = ROLE_DESCRIPTIONS[role];
          return (
            <Card key={role} className="border border-neutral-200">
              <CardBody className="p-4">
                <div className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold mb-3 ${info.color}`}>
                  {ROLE_LABELS[role]}
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">{info.description}</p>
              </CardBody>
            </Card>
          );
        })}
      </div>

      {/* Permission Matrix */}
      <Card>
        <CardHeader>
          <CardTitle>Permission Matrix</CardTitle>
          <p className="text-sm text-neutral-500 mt-1">Permissions are enforced on both frontend (visibility) and backend (API). They cannot be modified per-user.</p>
        </CardHeader>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 border-b border-neutral-200">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide w-48">Module</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide">Actions</th>
                  {ALL_ROLES.map((r) => (
                    <th key={r} className="text-center px-4 py-3 text-xs font-semibold text-neutral-500 uppercase tracking-wide min-w-[80px]">
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {MODULE_PERMISSIONS.map(({ module, permissions }) => (
                  <tr key={module} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-neutral-800">{module}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-1">
                        {permissions.map((p) => {
                          const action = getAction(p);
                          return (
                            <span key={p} className="text-xs bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                              {PERMISSION_LABELS[action] ?? action}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    {ALL_ROLES.map((role) => {
                      const granted = permissions.filter((p) => hasPermission(role, p));
                      const total   = permissions.length;
                      const allGranted  = granted.length === total;
                      const someGranted = granted.length > 0 && !allGranted;
                      return (
                        <td key={role} className="px-4 py-4 text-center">
                          {allGranted ? (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-success-100 text-success-700">
                              <CheckIcon size={14} />
                            </span>
                          ) : someGranted ? (
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-warning-100 text-warning-700 text-xs font-semibold">
                                {granted.length}/{total}
                              </span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-neutral-100 text-neutral-400 text-base leading-none">
                              –
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      {/* Branch-Based Access Note */}
      <Card>
        <CardHeader><CardTitle>Branch-Based Access Rules</CardTitle></CardHeader>
        <CardBody className="space-y-3 text-sm text-neutral-700">
          <div className="flex gap-3 items-start">
            <Badge variant="primary">Admin</Badge>
            <span>Sees data across all branches. No branch restrictions.</span>
          </div>
          <div className="flex gap-3 items-start">
            <Badge variant="default">Manager</Badge>
            <span>Sees all branches by default. Can be scoped to a specific branch via staff profile assignment.</span>
          </div>
          <div className="flex gap-3 items-start">
            <Badge variant="success">Cashier / Kitchen / Waiter</Badge>
            <span>Automatically scoped to their assigned branch only. Cannot access data from other branches.</span>
          </div>
          <div className="mt-4 bg-neutral-50 border border-neutral-200 rounded-lg p-4 text-xs text-neutral-600">
            Branch assignment is set in <strong>Staff Management → Edit Staff → Branch Assignment</strong>. Users without a branch assignment default to the main branch.
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
