import React, { useState, useMemo } from 'react';
import { useKhata } from '../context/KhataContext';
import {
  formatPKR,
  formatDuration,
  formatDate,
} from '../utils/billing';
import {
  BarChart3,
  Calendar,
  Clock,
  Droplets,
  DollarSign,
  Users,
  TrendingUp,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

export const InsightsView: React.FC<{
  onSelectCustomer?: (customerId: string) => void;
}> = ({ onSelectCustomer }) => {
  const { customers, waterRecords, payments, customerSummaries } = useKhata();

  // Filter: 'all', or '2026-10', etc.
  const [selectedMonth, setSelectedMonth] = useState<string>('all');

  // Extract all available months from actual saved data
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    waterRecords.forEach((w) => {
      if (w.startDate && w.startDate.length >= 7) set.add(w.startDate.substring(0, 7));
    });
    payments.forEach((p) => {
      if (p.date && p.date.length >= 7) set.add(p.date.substring(0, 7));
    });
    return Array.from(set).sort().reverse();
  }, [waterRecords, payments]);

  // Filter records based on selected month
  const filteredWaters = useMemo(() => {
    if (selectedMonth === 'all') return waterRecords;
    return waterRecords.filter((w) => w.startDate.startsWith(selectedMonth));
  }, [waterRecords, selectedMonth]);

  const filteredPayments = useMemo(() => {
    if (selectedMonth === 'all') return payments;
    return payments.filter((p) => p.date.startsWith(selectedMonth));
  }, [payments, selectedMonth]);

  // Real calculated analytics metrics
  const totalPumpMinutes = filteredWaters.reduce((sum, w) => sum + w.durationMinutes, 0);
  const totalWaterCharges = filteredWaters.reduce((sum, w) => sum + w.amount, 0);
  const totalPaymentsCollected = filteredPayments.reduce((sum, p) => sum + p.amount, 0);

  // Active customers: customers who have watering records in this period
  const activeCustomerIds = new Set(filteredWaters.map((w) => w.customerId));
  const activeCustomersCount = activeCustomerIds.size;

  // Real outstanding dues (sum of positive customer balances from real data)
  const totalOutstandingDues = Object.values(customerSummaries).reduce((acc, curr) => {
    return curr.balance > 0 ? acc + curr.balance : acc;
  }, 0);

  // Customer-wise usage ranking for this period
  const customerBreakdown = useMemo(() => {
    return customers.map((c) => {
      const custWaters = filteredWaters.filter((w) => w.customerId === c.id);
      const custPays = filteredPayments.filter((p) => p.customerId === c.id);
      const minutes = custWaters.reduce((sum, w) => sum + w.durationMinutes, 0);
      const charges = custWaters.reduce((sum, w) => sum + w.amount, 0);
      const paid = custPays.reduce((sum, p) => sum + p.amount, 0);
      const lifetimeBalance = customerSummaries[c.id]?.balance || 0;

      return {
        customer: c,
        minutes,
        charges,
        paid,
        sessionsCount: custWaters.length,
        lifetimeBalance,
      };
    }).sort((a, b) => b.charges - a.charges);
  }, [customers, filteredWaters, filteredPayments, customerSummaries]);

  // Monthly breakdown for trend chart (last 6 months with real data)
  const monthlyTrendData = useMemo(() => {
    const monthsMap: Record<string, { month: string; minutes: number; charges: number; paid: number }> = {};

    waterRecords.forEach((w) => {
      const m = w.startDate.substring(0, 7);
      if (!monthsMap[m]) {
        monthsMap[m] = { month: m, minutes: 0, charges: 0, paid: 0 };
      }
      monthsMap[m].minutes += w.durationMinutes;
      monthsMap[m].charges += w.amount;
    });

    payments.forEach((p) => {
      const m = p.date.substring(0, 7);
      if (!monthsMap[m]) {
        monthsMap[m] = { month: m, minutes: 0, charges: 0, paid: 0 };
      }
      monthsMap[m].paid += p.amount;
    });

    return Object.values(monthsMap).sort((a, b) => a.month.localeCompare(b.month));
  }, [waterRecords, payments]);

  const maxCharges = Math.max(...monthlyTrendData.map((d) => d.charges), 1000);

  return (
    <div className="flex flex-col min-h-full pb-24 max-w-2xl mx-auto w-full px-4 pt-3 space-y-4">
      {/* Filter Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-sm border border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#087C71]" />
            TubeWell Analytics &amp; Reports
          </h2>
          <p className="text-xs text-slate-500">
            Calculated strictly from real irrigation &amp; billing logs
          </p>
        </div>

        <div>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none"
          >
            <option value="all">All Time</option>
            {availableMonths.map((m) => {
              const [y, mo] = m.split('-');
              const d = new Date(Number(y), Number(mo) - 1, 1);
              return (
                <option key={m} value={m}>
                  {d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total Pump Hours */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Pump Hours
            </span>
            <Clock className="w-4 h-4 text-[#087C71]" />
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">
            {formatDuration(totalPumpMinutes)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">
            {filteredWaters.length} watering sessions
          </p>
        </div>

        {/* Total Water Charges */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Water Charges
            </span>
            <Droplets className="w-4 h-4 text-[#087C71]" />
          </div>
          <div className="text-2xl font-black text-[#087C71] dark:text-teal-400 tabular-nums">
            {formatPKR(totalWaterCharges)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">
            Tariff @ Rs 600/hr (Rs 10/min)
          </p>
        </div>

        {/* Total Payments Collected */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Payments In
            </span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatPKR(totalPaymentsCollected)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">
            {filteredPayments.length} recorded receipts
          </p>
        </div>

        {/* Total Outstanding Dues */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">
              Total Dues
            </span>
            <TrendingUp className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">
            {formatPKR(totalOutstandingDues)}
          </div>
          <p className="text-[10px] text-slate-500 mt-1 font-medium">
            Uncollected balance
          </p>
        </div>
      </div>

      {/* Customer Activity Snapshot */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs flex items-center justify-around text-center">
        <div>
          <span className="text-xs font-medium text-slate-400 block">Total Farmers</span>
          <span className="text-xl font-black text-slate-800 dark:text-white">
            {customers.length}
          </span>
        </div>
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
        <div>
          <span className="text-xs font-medium text-slate-400 block">Active in Period</span>
          <span className="text-xl font-black text-[#087C71] dark:text-teal-400">
            {activeCustomersCount}
          </span>
        </div>
        <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
        <div>
          <span className="text-xs font-medium text-slate-400 block">Net Period Flow</span>
          <span className="text-xl font-black text-slate-800 dark:text-white tabular-nums">
            {formatPKR(totalWaterCharges - totalPaymentsCollected)}
          </span>
        </div>
      </div>

      {/* Monthly Revenue & Usage Visual Chart */}
      {monthlyTrendData.length > 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                Monthly Billing &amp; Usage Trend
              </h3>
              <p className="text-[11px] text-slate-400">
                Water charges (Teal) vs Payments collected (Emerald)
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            {monthlyTrendData.map((d) => {
              const chargePercent = Math.min(100, Math.round((d.charges / maxCharges) * 100));
              const paidPercent = Math.min(100, Math.round((d.paid / maxCharges) * 100));
              const [y, m] = d.month.split('-');
              const dateObj = new Date(Number(y), Number(m) - 1, 1);
              const monthLabel = dateObj.toLocaleDateString('en-US', { month: 'short' });

              return (
                <div key={d.month} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>
                      {monthLabel} {y} ({formatDuration(d.minutes)})
                    </span>
                    <span className="tabular-nums">
                      Billed: {formatPKR(d.charges)} | Paid: {formatPKR(d.paid)}
                    </span>
                  </div>

                  {/* Dual Bar */}
                  <div className="space-y-1">
                    <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${Math.max(4, chargePercent)}%` }}
                        className="h-full bg-[#087C71] rounded-full transition-all duration-500"
                        title={`Charges: ${formatPKR(d.charges)}`}
                      />
                    </div>
                    <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                      <div
                        style={{ width: `${Math.max(4, paidPercent)}%` }}
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        title={`Payments: ${formatPKR(d.paid)}`}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Customer-Wise Usage Summary Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
            Customer-Wise Irrigation Summary
          </h3>
          <span className="text-[11px] text-slate-400">Ranked by usage</span>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {customerBreakdown.map((row) => (
            <div
              key={row.customer.id}
              onClick={() => onSelectCustomer && onSelectCustomer(row.customer.id)}
              className="py-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/60 dark:hover:bg-slate-800/40 rounded-xl px-2 transition-all"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {row.customer.name}
                </h4>
                <p className="text-[11px] text-slate-400">
                  {row.sessionsCount} sessions • {formatDuration(row.minutes)}
                </p>
              </div>

              <div className="text-right">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 tabular-nums">
                  Billed: {formatPKR(row.charges)}
                </div>
                <div
                  className={`text-[11px] font-black tabular-nums ${
                    row.lifetimeBalance > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : row.lifetimeBalance < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-400'
                  }`}
                >
                  {row.lifetimeBalance > 0
                    ? `Due: ${formatPKR(row.lifetimeBalance)}`
                    : row.lifetimeBalance < 0
                    ? `Advance: ${formatPKR(Math.abs(row.lifetimeBalance))}`
                    : 'Settled'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
