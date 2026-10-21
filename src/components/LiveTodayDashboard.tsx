import React, { useState } from 'react';
import { useKhata } from '../context/KhataContext';
import { formatPKR, formatDuration } from '../utils/billing';
import {
  Clock,
  Droplets,
  ChevronDown,
  ChevronUp,
  Activity,
  Users,
} from 'lucide-react';

export const LiveTodayDashboard: React.FC = () => {
  const { todaySummary, settings } = useKhata();
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const isUrdu = settings.language === 'ur';

  const {
    todayDate,
    totalMinutes,
    totalWaterCharges,
    totalPayments,
    activeCustomerNames,
    recordsCount,
    paymentsCount,
    recentActivities,
  } = todaySummary;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-xs border border-slate-200/90 dark:border-slate-800 space-y-3 transition-all">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-[#087C71] dark:text-teal-400 flex items-center justify-center font-bold">
            <Activity className="w-4 h-4 text-[#087C71]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white tracking-tight">
                {isUrdu ? 'آج کا کھاتہ' : "Today's Ledger Summary"}
              </h3>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">
              {todayDate} • {recordsCount} {isUrdu ? 'باریاں' : 'sessions'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 transition-colors"
          title="Toggle Details"
        >
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Quick 3-Metric Summary Bar */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-2.5 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
            {isUrdu ? 'آج کا وقت' : 'Today Water'}
          </span>
          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block tabular-nums">
            {formatDuration(totalMinutes)}
          </span>
          <span className="text-[9px] text-[#087C71] dark:text-teal-400 font-bold block mt-0.5">
            {formatPKR(totalWaterCharges)}
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-2.5 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
            {isUrdu ? 'آج کی وصولی' : 'Received'}
          </span>
          <span className="text-xs sm:text-sm font-black text-emerald-600 dark:text-emerald-400 block tabular-nums">
            {formatPKR(totalPayments)}
          </span>
          <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
            {paymentsCount} {isUrdu ? 'ادائیگیاں' : 'paid'}
          </span>
        </div>

        <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-2.5 border border-slate-100 dark:border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
            {isUrdu ? 'کسان' : 'Farmers'}
          </span>
          <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white block tabular-nums">
            {activeCustomerNames.length}
          </span>
          <span className="text-[9px] text-slate-400 font-medium block mt-0.5">
            {isUrdu ? 'پانی لینے والے' : 'active today'}
          </span>
        </div>
      </div>

      {/* Expanded Details: Active Farmers & Recent Entries */}
      {isExpanded && (
        <div className="space-y-2.5 pt-1 border-t border-slate-100 dark:border-slate-800">
          {/* Active Customers Chips */}
          {activeCustomerNames.length > 0 && (
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                {isUrdu ? 'آج پانی لینے والے کسان:' : 'Farmers Active Today:'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {activeCustomerNames.map((name) => (
                  <span
                    key={name}
                    className="px-2 py-0.5 bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-900/60 text-[#087C71] dark:text-teal-300 rounded-lg text-xs font-bold"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activities List */}
          <div>
            <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400 mb-1.5">
              <span>{isUrdu ? 'آج کی تفصیل:' : 'Today Details:'}</span>
              <span>{recentActivities.length} items</span>
            </div>

            {recentActivities.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2.5 bg-slate-50 dark:bg-slate-800/40 rounded-xl">
                {isUrdu
                  ? 'آج کوئی پانی یا ادائیگی ریکارڈ نہیں ہوئی۔'
                  : 'No watering sessions or payments recorded today yet.'}
              </p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-0.5">
                {recentActivities.map((act) => (
                  <div
                    key={act.id}
                    className="p-2 bg-slate-50/80 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          act.type === 'water' ? 'bg-[#087C71]' : 'bg-emerald-500'
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="font-bold text-slate-800 dark:text-white truncate text-[11px]">
                          {act.text}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400 shrink-0">{act.time}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
