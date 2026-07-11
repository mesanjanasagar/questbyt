import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  Sidebar, ToastProvider, FullPageSpinner,
  LayoutDashboardIcon, ReceiptIcon, PackageIcon,
  UsersIcon, MegaphoneIcon, AlertTriangleIcon,
  BuildingIcon, GitBranchIcon, LayoutGridIcon, UserCheckIcon, ShieldIcon, UtensilsIcon, TagIcon,
} from '@pos/ui';
import type { NavGroup } from '@pos/ui';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { LoginPage } from './pages/LoginPage';
import { OnboardingWizard } from './pages/onboarding/OnboardingWizard';
import { OverviewPage } from './pages/OverviewPage';
import { OrdersPage } from './pages/OrdersPage';
import { InventoryPage } from './pages/InventoryPage';
import { StaffPage } from './pages/StaffPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { PromoCodesPage } from './pages/PromoCodesPage';
import { ChurnPage } from './pages/ChurnPage';
import { RestaurantPage } from './pages/RestaurantPage';
import { BranchesPage } from './pages/BranchesPage';
import { StaffManagementPage } from './pages/StaffManagementPage';
import { TablesPage } from './pages/TablesPage';
import { UsersPage } from './pages/UsersPage';
import { AccessControlPage } from './pages/AccessControlPage';
import { MenuPage } from './pages/MenuPage';
import { onboardingAPI } from './api/onboarding';
import { hasPermission } from './utils/permissions';

function buildNavGroups(role: string | undefined): NavGroup[] {
  const groups: NavGroup[] = [
    {
      items: [
        { path: '/',          label: 'Overview',        icon: <LayoutDashboardIcon size={18} />, exact: true },
        { path: '/orders',    label: 'Orders',          icon: <ReceiptIcon size={18} /> },
        { path: '/inventory', label: 'Inventory',       icon: <PackageIcon size={18} /> },
        { path: '/menu',      label: 'Menu',            icon: <UtensilsIcon size={18} /> },
        { path: '/staff',     label: 'Staff Forecast',  icon: <UsersIcon size={18} /> },
      ],
    },
    {
      label: 'Growth',
      items: [
        { path: '/campaigns',    label: 'Campaigns',    icon: <MegaphoneIcon size={18} /> },
        { path: '/promo-codes',  label: 'Promo Codes',  icon: <TagIcon size={18} /> },
        { path: '/churn',        label: 'Churn Risk',   icon: <AlertTriangleIcon size={18} /> },
      ],
    },
  ];

  const manageItems = [];
  if (hasPermission(role, 'restaurants:view'))
    manageItems.push({ path: '/restaurant',  label: 'Restaurant',  icon: <BuildingIcon size={18} /> });
  if (hasPermission(role, 'branches:view'))
    manageItems.push({ path: '/branches',    label: 'Branches',    icon: <GitBranchIcon size={18} /> });
  if (hasPermission(role, 'staff:view'))
    manageItems.push({ path: '/staff-management', label: 'Staff',  icon: <UsersIcon size={18} /> });
  if (hasPermission(role, 'tables:view'))
    manageItems.push({ path: '/tables',      label: 'Tables',      icon: <LayoutGridIcon size={18} /> });

  if (manageItems.length > 0) groups.push({ label: 'Manage', items: manageItems });

  const adminItems = [];
  if (hasPermission(role, 'users:view'))
    adminItems.push({ path: '/users',         label: 'Users',          icon: <UserCheckIcon size={18} /> });
  if (hasPermission(role, 'access_control:view'))
    adminItems.push({ path: '/access-control', label: 'Access Control', icon: <ShieldIcon size={18} /> });

  if (adminItems.length > 0) groups.push({ label: 'Admin', items: adminItems });

  return groups;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RequirePermission({ permission, children }: { permission: Parameters<typeof hasPermission>[1]; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!hasPermission(user?.role, permission)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center gap-3">
        <ShieldIcon size={40} className="text-neutral-300" />
        <p className="text-neutral-500 font-medium">Access Denied</p>
        <p className="text-sm text-neutral-400">You don't have permission to view this page.</p>
      </div>
    );
  }
  return <>{children}</>;
}

function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { storeId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!storeId) {
      if (location.pathname !== '/onboarding') navigate('/onboarding', { replace: true });
      setChecking(false);
      return;
    }
    onboardingAPI.getState(storeId).then((state) => {
      if (!state.isComplete && location.pathname !== '/onboarding') {
        navigate('/onboarding', { replace: true });
      }
    }).catch(() => {}).finally(() => setChecking(false));
  }, [storeId, navigate, location.pathname]);

  if (checking) return <FullPageSpinner />;
  return <>{children}</>;
}

function DashboardShell() {
  const { user, logout } = useAuth();
  const navGroups = buildNavGroups(user?.role);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        appName="Questbyt"
        appDescription="Manager Dashboard"
        navGroups={navGroups}
        username={user?.username ?? 'Manager'}
        userRole={user?.role ?? ''}
        onLogout={logout}
      />
      <main className="flex-1 overflow-y-auto bg-neutral-50">
        <Routes>
          <Route path="/"                element={<OverviewPage />} />
          <Route path="/orders"          element={<OrdersPage />} />
          <Route path="/inventory"       element={<InventoryPage />} />
          <Route path="/menu"            element={<MenuPage />} />
          <Route path="/staff"           element={<StaffPage />} />
          <Route path="/campaigns"       element={<CampaignsPage />} />
          <Route path="/promo-codes"     element={<PromoCodesPage />} />
          <Route path="/churn"           element={<ChurnPage />} />

          <Route path="/restaurant" element={
            <RequirePermission permission="restaurants:view"><RestaurantPage /></RequirePermission>
          } />
          <Route path="/branches" element={
            <RequirePermission permission="branches:view"><BranchesPage /></RequirePermission>
          } />
          <Route path="/staff-management" element={
            <RequirePermission permission="staff:view"><StaffManagementPage /></RequirePermission>
          } />
          <Route path="/tables" element={
            <RequirePermission permission="tables:view"><TablesPage /></RequirePermission>
          } />
          <Route path="/users" element={
            <RequirePermission permission="users:view"><UsersPage /></RequirePermission>
          } />
          <Route path="/access-control" element={
            <RequirePermission permission="access_control:view"><AccessControlPage /></RequirePermission>
          } />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <FullPageSpinner />;

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/onboarding" element={<RequireAuth><OnboardingWizard /></RequireAuth>} />
      <Route path="/*" element={
        <RequireAuth>
          <OnboardingGuard>
            <DashboardShell />
          </OnboardingGuard>
        </RequireAuth>
      } />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
