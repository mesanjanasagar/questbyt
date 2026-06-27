import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
  trend?: number;
  colorClass?: string;
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, sub, icon, trend, colorClass = 'bg-white border-gray-200' }) => (
  <div className={`rounded-xl border p-5 ${colorClass} shadow-sm`}>
    <div className="flex items-center justify-between mb-2">
      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{label}</p>
      {icon && <span className="text-xl">{icon}</span>}
    </div>
    <p className="text-3xl font-bold text-gray-900">{value}</p>
    <div className="flex items-center gap-2 mt-1">
      {sub && <p className="text-sm text-gray-500">{sub}</p>}
      {trend != null && (
        <span className={`text-sm font-semibold ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
          {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
        </span>
      )}
    </div>
  </div>
);