import React from 'react';
import { KDSFilter } from '../types';

interface FilterBarProps {
  filter: KDSFilter;
  onFilterChange: (filter: KDSFilter) => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({ filter, onFilterChange }) => {
  return (
    <div className="bg-white shadow-md p-4 flex gap-4 flex-wrap">
      <div>
        <label className="block text-sm font-semibold mb-1">Order Type</label>
        <select
          value={filter.orderType}
          onChange={(e) => onFilterChange({ ...filter, orderType: e.target.value as any })}
          className="border border-gray-300 rounded px-3 py-2"
        >
          <option value="all">All Orders</option>
          <option value="dine-in">Dine-In</option>
          <option value="takeout">Takeout</option>
          <option value="delivery">Delivery</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-semibold mb-1">Station</label>
        <select
          value={filter.station}
          onChange={(e) => onFilterChange({ ...filter, station: e.target.value as any })}
          className="border border-gray-300 rounded px-3 py-2"
        >
          <option value="all">All Stations</option>
          <option value="grill">Grill</option>
          <option value="fryer">Fryer</option>
          <option value="bar">Bar</option>
          <option value="general">General</option>
        </select>
      </div>
    </div>
  );
};