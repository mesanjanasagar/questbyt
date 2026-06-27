import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Overview', icon: '📊' },
  { path: '/orders', label: 'Orders', icon: '🧾' },
  { path: '/inventory', label: 'Inventory', icon: '📦' },
  { path: '/staff', label: 'Staff & Forecast', icon: '👥' },
  { path: '/campaigns', label: 'Campaigns', icon: '📣' },
  { path: '/churn', label: 'Churn Risk', icon: '⚠️' },
];

export const Sidebar: React.FC = () => (
  <aside className="w-60 bg-slate-900 text-white min-h-screen flex flex-col">
    <div className="p-6 border-b border-slate-700">
      <h1 className="text-xl font-bold">QuantiByte</h1>
      <p className="text-slate-400 text-sm mt-1">Manager Dashboard</p>
    </div>
    <nav className="flex-1 p-4 space-y-1">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          className={({ isActive }) =>
            `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              isActive
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <span>{item.icon}</span>
          <span className="font-medium">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  </aside>
);