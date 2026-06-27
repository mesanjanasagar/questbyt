import React, { useEffect, useState } from 'react';
import { useCRMStore } from '../store/crmStore';
import { customersAPI } from '../api/customers';
import { Customer, CustomerSegment, LoyaltyTier } from '../types';
import { formatDistanceToNow } from 'date-fns';

const SEGMENT_BADGE: Record<CustomerSegment, string> = {
  VIP: 'bg-purple-100 text-purple-800',
  Loyal: 'bg-blue-100 text-blue-800',
  New: 'bg-green-100 text-green-800',
  'At-Risk': 'bg-yellow-100 text-yellow-800',
  Churned: 'bg-red-100 text-red-800',
};

const TIER_BADGE: Record<LoyaltyTier, string> = {
  Platinum: 'bg-gray-100 text-gray-800',
  Gold: 'bg-amber-100 text-amber-800',
  Silver: 'bg-slate-100 text-slate-700',
  Bronze: 'bg-orange-100 text-orange-800',
};

export const CustomersPage: React.FC = () => {
  const { customers, customerTotal, segmentFilter, searchQuery, setCustomers, setSegmentFilter, setSearchQuery } =
    useCRMStore();
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await customersAPI.getCustomers({
          segment: segmentFilter !== 'all' ? segmentFilter : undefined,
          search: searchQuery || undefined,
          page,
          limit,
        });
        setCustomers(data.data, data.total);
      } catch (err) {
        console.error('Failed to load customers:', err);
      } finally {
        setLoading(false);
      }
    };

    const debounce = setTimeout(load, 300);
    return () => clearTimeout(debounce);
  }, [segmentFilter, searchQuery, page]);

  const totalPages = Math.ceil(customerTotal / limit);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-800">
          Customers <span className="text-gray-400 text-lg">({customerTotal.toLocaleString()})</span>
        </h2>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search name, email, phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <select
          value={segmentFilter}
          onChange={(e) => setSegmentFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Segments</option>
          <option value="VIP">VIP</option>
          <option value="Loyal">Loyal</option>
          <option value="New">New</option>
          <option value="At-Risk">At-Risk</option>
          <option value="Churned">Churned</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Customer</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Segment</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Tier</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Orders</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Total Spend</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600">Last Order</th>
                <th className="text-right px-5 py-3 font-semibold text-gray-600">Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    Loading...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-10 text-gray-400">
                    No customers found
                  </td>
                </tr>
              ) : (
                customers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{customer.name}</p>
                      <p className="text-gray-500 text-xs">{customer.email ?? customer.phone ?? '–'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${SEGMENT_BADGE[customer.segment]}`}
                      >
                        {customer.segment}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${TIER_BADGE[customer.loyaltyTier]}`}
                      >
                        {customer.loyaltyTier}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right text-gray-700">{customer.totalOrders}</td>
                    <td className="px-5 py-4 text-right font-medium text-gray-800">
                      ${customer.totalSpend.toFixed(2)}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {customer.lastOrderAt
                        ? formatDistanceToNow(new Date(customer.lastOrderAt), { addSuffix: true })
                        : 'Never'}
                    </td>
                    <td className="px-5 py-4 text-right text-gray-700">
                      {customer.loyaltyPoints.toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-white"
              >
                Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 rounded border border-gray-300 text-sm disabled:opacity-40 hover:bg-white"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};