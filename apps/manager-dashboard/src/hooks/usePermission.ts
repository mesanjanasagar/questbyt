import { useAuth } from '../contexts/AuthContext';
import { hasPermission, type Permission } from '../utils/permissions';

export function usePermission(permission: Permission): boolean {
  const { user } = useAuth();
  return hasPermission(user?.role, permission);
}

export function useRole(): string | undefined {
  const { user } = useAuth();
  return user?.role;
}

export function useIsAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === 'admin';
}

export function useIsManagerOrAdmin(): boolean {
  const { user } = useAuth();
  return user?.role === 'admin' || user?.role === 'manager';
}
