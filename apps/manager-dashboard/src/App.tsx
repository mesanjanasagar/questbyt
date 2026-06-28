import { BrowserRouter, Routes, Route } from 'react-router-dom';
import {
  Sidebar, ToastProvider,
  LayoutDashboardIcon, ReceiptIcon, PackageIcon,
  UsersIcon, MegaphoneIcon, AlertTriangleIcon,
} from '@pos/ui';
import type { NavGroup } from '@pos/ui';
import { OverviewPage } from './pages/OverviewPage';
import { OrdersPage } from './pages/OrdersPage';
import { InventoryPage } from './pages/InventoryPage';
import { StaffPage } from './pages/StaffPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { ChurnPage } from './pages/ChurnPage';

const navGroups: NavGroup[] = [
  {
    items: [
      { path: '/',          label: 'Overview',       icon: <LayoutDashboardIcon size={18} />, exact: true },
      { path: '/orders',    label: 'Orders',         icon: <ReceiptIcon size={18} /> },
      { path: '/inventory', label: 'Inventory',      icon: <PackageIcon size={18} /> },
      { path: '/staff',     label: 'Staff & Forecast', icon: <UsersIcon size={18} /> },
    ],
  },
  {
    label: 'Growth',
    items: [
      { path: '/campaigns', label: 'Campaigns',  icon: <MegaphoneIcon size={18} /> },
      { path: '/churn',     label: 'Churn Risk', icon: <AlertTriangleIcon size={18} /> },
    ],
  },
];

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar
            appName="Questbyt"
            appDescription="Manager Dashboard"
            navGroups={navGroups}
            username="Manager"
            userRole="Store Manager"
          />
          <main className="flex-1 overflow-y-auto bg-neutral-50">
            <Routes>
              <Route path="/"          element={<OverviewPage />} />
              <Route path="/orders"    element={<OrdersPage />} />
              <Route path="/inventory" element={<InventoryPage />} />
              <Route path="/staff"     element={<StaffPage />} />
              <Route path="/campaigns" element={<CampaignsPage />} />
              <Route path="/churn"     element={<ChurnPage />} />
            </Routes>
          </main>
        </div>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
