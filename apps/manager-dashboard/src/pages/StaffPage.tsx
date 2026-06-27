import React, { useEffect } from 'react';
import { useDashboardStore } from '../store/dashboardStore';
import { dashboardAPI } from '../api/dashboard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { format, parseISO } from 'date-fns';

export const StaffPage: React.FC = () => {
  const { staffSummary, selectedStoreId, setStaffSummary } = useDashboardStore();

  useEffect(() => {
    if (!selectedStoreId) return;
    dashboardAPI
      .getStaffRecommendations(selectedStoreId)
      .then(setStaffSummary)
      .catch(console.error);
  }, [selectedStoreId]);

  const chartData = staffSummary.map((s) => ({
    date: format(parseISO(s.date), 'EEE MM/dd'),
    staff: s.recommendedStaffCount,
    orders: s.forecastedOrders,
  }));

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Staff & Demand Forecast</h2>

      {staffSummary.length === 0 ? (
        <div className="text-center text-gray-400 py-20">
          No forecast data available. Run demand forecasting first.
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">7-Day Forecast</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar yAxisId="left" dataKey="staff" name="Recommended Staff" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="orders" name="Forecasted Orders" fill="#93c5fd" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">Shift</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Recommended Staff</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">Forecasted Orders</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffSummary.map((s, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-800">{format(parseISO(s.date), 'EEE, MMM d')}</td>
                    <td className="px-5 py-3 capitalize text-gray-600">{s.shiftType}</td>
                    <td className="px-5 py-3 text-right font-bold text-blue-700">{s.recommendedStaffCount}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{s.forecastedOrders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};