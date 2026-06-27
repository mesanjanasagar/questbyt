import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { OverviewPage } from './pages/OverviewPage';
import { OrdersPage } from './pages/OrdersPage';
import { InventoryPage } from './pages/InventoryPage';
import { StaffPage } from './pages/StaffPage';
import { CampaignsPage } from './pages/CampaignsPage';
import { ChurnPage } from './pages/ChurnPage';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-50 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/staff" element={<StaffPage />} />
            <Route path="/campaigns" element={<CampaignsPage />} />
            <Route path="/churn" element={<ChurnPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;