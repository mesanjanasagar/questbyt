import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray';
  icon?: string;
}

const colorMap = {
  blue: 'bg-blue-50 border-blue-200 text-blue-700',
  green: 'bg-green-50 border-green-200 text-green-700',
  yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
  red: 'bg-red-50 border-red-200 text-red-700',
  purple: 'bg-purple-50 border-purple-200 text-purple-700',
  gray: 'bg-gray-50 border-gray-200 text-gray-700',
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  sub,
  color = 'blue',
  icon,
}) => {
  return (
    <div className={`rounded-xl border-2 p-5 ${colorMap[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold uppercase tracking-wide opacity-70">{label}</p>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-sm mt-1 opacity-70">{sub}</p>}
    </div>
  );
};