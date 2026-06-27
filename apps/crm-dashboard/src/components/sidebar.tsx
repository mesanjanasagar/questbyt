import React from 'react';
import { NavLink } from 'react-router-dom';

const navItems = [
  { path: '/', label: 'Overview', icon: '▦' },
  { path: '/customers', label: 'Customers', icon: '👥' },
  { path: '/segments', label: 'Segments', icon: '🏷' },
  { path: '/campaigns', label: 'Campaigns', icon: '📣' },
  { path: '/churn', label: 'Churn Risk', icon: '▲' },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-60 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-xl font-bold">QuantiByte CRM</h1>
        <p className="text-gray-400 text-sm mt-1">Customer Intelligence</p>
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
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700 text-gray-400 text-sm">
        <p>Store: {localStorage.getItem('storeName') || 'Default Store'}</p>
      </div>
    </aside>
  );
};