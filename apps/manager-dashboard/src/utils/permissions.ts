export type Permission =
  | 'restaurants:view' | 'restaurants:edit' | 'restaurants:manage'
  | 'branches:view' | 'branches:create' | 'branches:edit' | 'branches:delete'
  | 'staff:view' | 'staff:create' | 'staff:edit' | 'staff:delete' | 'staff:assign'
  | 'tables:view' | 'tables:create' | 'tables:edit' | 'tables:delete'
  | 'users:view' | 'users:create' | 'users:edit' | 'users:delete' | 'users:assign'
  | 'orders:view' | 'orders:manage'
  | 'inventory:view' | 'inventory:create' | 'inventory:edit' | 'inventory:manage'
  | 'menus:view' | 'menus:create' | 'menus:edit' | 'menus:delete'
  | 'reports:view'
  | 'access_control:view' | 'access_control:manage';

const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  admin: [
    'restaurants:view', 'restaurants:edit', 'restaurants:manage',
    'branches:view', 'branches:create', 'branches:edit', 'branches:delete',
    'staff:view', 'staff:create', 'staff:edit', 'staff:delete', 'staff:assign',
    'tables:view', 'tables:create', 'tables:edit', 'tables:delete',
    'users:view', 'users:create', 'users:edit', 'users:delete', 'users:assign',
    'orders:view', 'orders:manage',
    'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:manage',
    'menus:view', 'menus:create', 'menus:edit', 'menus:delete',
    'reports:view',
    'access_control:view', 'access_control:manage',
  ],
  manager: [
    'restaurants:view', 'restaurants:edit',
    'branches:view', 'branches:create', 'branches:edit',
    'staff:view', 'staff:create', 'staff:edit', 'staff:assign',
    'tables:view', 'tables:create', 'tables:edit', 'tables:delete',
    'users:view', 'users:create',
    'orders:view', 'orders:manage',
    'inventory:view', 'inventory:create', 'inventory:edit', 'inventory:manage',
    'menus:view', 'menus:create', 'menus:edit', 'menus:delete',
    'reports:view',
    'access_control:view',
  ],
  cashier: ['orders:view', 'orders:manage', 'menus:view', 'tables:view', 'inventory:view'],
  kitchen: ['orders:view', 'orders:manage', 'menus:view', 'inventory:view'],
  waiter:  ['orders:view', 'menus:view', 'tables:view', 'tables:edit'],
};

export function hasPermission(role: string | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function getRolePermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export const ALL_ROLES = ['admin', 'manager', 'cashier', 'kitchen', 'waiter'] as const;
export type RoleName = typeof ALL_ROLES[number];

export const ROLE_LABELS: Record<RoleName, string> = {
  admin: 'Admin',
  manager: 'Manager',
  cashier: 'Cashier',
  kitchen: 'Kitchen',
  waiter: 'Waiter',
};

export const MODULE_PERMISSIONS: Array<{
  module: string;
  permissions: Permission[];
}> = [
  { module: 'Restaurant',     permissions: ['restaurants:view', 'restaurants:edit', 'restaurants:manage'] },
  { module: 'Branches',       permissions: ['branches:view', 'branches:create', 'branches:edit', 'branches:delete'] },
  { module: 'Staff',          permissions: ['staff:view', 'staff:create', 'staff:edit', 'staff:delete', 'staff:assign'] },
  { module: 'Tables',         permissions: ['tables:view', 'tables:create', 'tables:edit', 'tables:delete'] },
  { module: 'Users',          permissions: ['users:view', 'users:create', 'users:edit', 'users:delete', 'users:assign'] },
  { module: 'Orders',         permissions: ['orders:view', 'orders:manage'] },
  { module: 'Inventory',      permissions: ['inventory:view', 'inventory:create', 'inventory:edit', 'inventory:manage'] },
  { module: 'Menus',          permissions: ['menus:view', 'menus:create', 'menus:edit', 'menus:delete'] },
  { module: 'Reports',        permissions: ['reports:view'] },
  { module: 'Access Control', permissions: ['access_control:view', 'access_control:manage'] },
];
