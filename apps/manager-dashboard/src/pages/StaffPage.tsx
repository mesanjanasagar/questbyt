import React, { useEffect } from 'react';
import {
  PageHeader, Card, CardHeader, CardTitle, CardBody, EmptyState, KPICard,
  UsersIcon, CalendarIcon,
} from '@pos/ui';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { useDashboardStore } from '../store/dashboardStore';
import { dashboardAPI } from '../api/dashboard';

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

  const totalStaff = staffSummary.reduce((s, x) => s + x.recommendedStaffCount, 0);
  const totalOrders = staffSummary.reduce((s, x) => s + x.forecastedOrders, 0);
  const peakDay = staffSummary.reduce(
    (peak, s) => (s.recommendedStaffCount > (peak?.recommendedStaffCount ?? 0) ? s : peak),
    staffSummary[0],
  );

  if (staffSummary.length === 0) {
    return (
      <div className="p-6">
        <PageHeader title="Staff & Demand Forecast" />
        <Card>
          <CardBody>
            <EmptyState
              icon={<UsersIcon size={20} />}
              title="No forecast data available"
              description="Run demand forecasting to see staffing recommendations"
            />
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Staff & Demand Forecast"
        description="AI-driven staffing recommendations based on predicted demand"
      />

      <div className="grid grid-cols-3 gap-4">
        <KPICard
          label="Total Staff (7d)"
          value={totalStaff}
          icon={<UsersIcon size={18} />}
          iconColor="text-primary-600 bg-primary-50"
        />
        <KPICard
          label="Forecasted Orders (7d)"
          value={totalOrders.toLocaleString()}
          icon={<CalendarIcon size={18} />}
          iconColor="text-accent-600 bg-accent-50"
        />
        <KPICard
          label="Peak Day"
          value={peakDay ? format(parseISO(peakDay.date), 'EEE, MMM d') : '—'}
          subValue={peakDay ? `${peakDay.recommendedStaffCount} staff needed` : ''}
          icon={<CalendarIcon size={18} />}
          iconColor="text-warning-600 bg-warning-50"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>7-Day Staffing Forecast</CardTitle>
        </CardHeader>
        <CardBody>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
              <Bar yAxisId="left" dataKey="staff" name="Recommended Staff" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="orders" name="Forecasted Orders" fill="#bfdbfe" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardBody>
      </Card>

      <Card>
        <CardBody padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200">
                  {['Date', 'Shift', 'Recommended Staff', 'Forecasted Orders'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-3 px-4 text-xs font-semibold text-neutral-500 uppercase tracking-wide ${
                        i >= 2 ? 'text-right' : 'text-left'
                      }`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {staffSummary.map((s, i) => (
                  <tr
                    key={i}
                    className="border-b border-neutral-50 last:border-0 hover:bg-neutral-50 transition-colors"
                  >
                    <td className="py-3 px-4 font-medium text-neutral-800">
                      {format(parseISO(s.date), 'EEE, MMM d')}
                    </td>
                    <td className="py-3 px-4 capitalize text-neutral-600">{s.shiftType}</td>
                    <td className="py-3 px-4 text-right font-bold text-primary-700 tabular-nums">
                      {s.recommendedStaffCount}
                    </td>
                    <td className="py-3 px-4 text-right text-neutral-700 tabular-nums">
                      {s.forecastedOrders}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
};
