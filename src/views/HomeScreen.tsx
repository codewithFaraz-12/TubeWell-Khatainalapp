import React from 'react';
import { Customer, WaterRecord } from '../types';
import { useKhata } from '../context/KhataContext';
import { formatPKR, formatDuration, formatTime12, formatDate } from '../utils/billing';
import { getT } from '../utils/translations';
import {
  Search,
  UserPlus,
  ChevronRight,
  Phone,
  MapPin,
  TrendingUp,
  Droplets,
  Users,
  Clock,
  CheckCircle2,
  Sparkles,
  Play,
  Square,
} from 'lucide-react';

interface HomeScreenProps {
  onOpenCustomer: (customer: Customer) => void;
  onOpenAddCustomer: () => void;
  onOpenAddWater: (customerId?: string, recordToEdit?: WaterRecord) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onOpenCustomer,
  onOpenAddCustomer,
  onOpenAddWater,
}) => {
  const {
    filteredCustomers,
    customers,
    waterRecords,
    customerSummaries,
    totalPreviousDues,
    totalCollectedPayments,
    totalPumpMinutes,
    searchQuery,
    setSearchQuery,
    settings,
  } = useKhata();

  const t = getT(settings.language);
  const displayedCustomers = filteredCustomers;
  const activeRunningSessions = waterRecords.filter(
    (w) => w.status === 'running' || !w.endTime
  );

  return (
    <div className="flex flex-col min-h-full pb-24 max-w-xl mx-auto w-full px-4 pt-3.5 space-y-4">
      {/* 1. Hero Previous Dues Summary Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#06635A] via-[#087C71] to-[#0A8E82] rounded-3xl p-5 text-white shadow-xl shadow-teal-950/15 border border-white/10">
        {/* Subtle decorative background water rings */}
        <div className="absolute -right-8 -bottom-8 w-40 h-40 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute right-10 -top-10 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] uppercase font-extrabold tracking-wider text-teal-100 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-teal-300" />
              {t.totalOutstanding}
            </span>
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-xs border border-white/20">
              {t.liveTotal}
            </span>
          </div>

          <div className="flex items-baseline gap-2.5">
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white tabular-nums drop-shadow-xs">
              {formatPKR(totalPreviousDues)}
            </h2>
            <span className="text-xs text-teal-200 font-bold uppercase tracking-wider">
              {t.previousDues}
            </span>
          </div>

          <p className="text-xs text-teal-100/90 font-medium leading-relaxed">
            {t.unpaidSummary} ({customers.length} {settings.language === 'ur' ? 'گاہک' : 'customers'})
          </p>

          {/* Quick Stats Grid inside Hero Card */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/15 text-center">
            <div className="bg-white/10 rounded-2xl p-2 backdrop-blur-xs border border-white/10">
              <span className="text-[10px] uppercase font-bold text-teal-200 block">
                {t.totalPumped}
              </span>
              <span className="text-xs sm:text-sm font-black text-white mt-0.5 block">
                {formatDuration(totalPumpMinutes)}
              </span>
            </div>

            <div className="bg-white/10 rounded-2xl p-2 backdrop-blur-xs border border-white/10">
              <span className="text-[10px] uppercase font-bold text-teal-200 block">
                {t.totalCollected}
              </span>
              <span className="text-xs sm:text-sm font-black text-white mt-0.5 block">
                {formatPKR(totalCollectedPayments)}
              </span>
            </div>

            <div className="bg-white/10 rounded-2xl p-2 backdrop-blur-xs border border-white/10">
              <span className="text-[10px] uppercase font-bold text-teal-200 block">
                {t.fixedTariff}
              </span>
              <span className="text-xs sm:text-sm font-black text-white mt-0.5 block">
                Rs 600/hr
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Tubewell Running Sessions Alert */}
      {activeRunningSessions.length > 0 && (
        <div className="bg-amber-500/10 border-2 border-amber-500/30 rounded-3xl p-4 text-slate-900 dark:text-white space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
              Tubewell Currently Running
            </span>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
              {activeRunningSessions.length} active
            </span>
          </div>
          {activeRunningSessions.map((rec) => {
            const cust = customers.find((c) => c.id === rec.customerId);
            return (
              <div
                key={rec.id}
                className="bg-white dark:bg-slate-900 rounded-2xl p-3 border border-amber-200 dark:border-amber-900/40 flex items-center justify-between shadow-xs"
              >
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {cust?.name || 'Customer'}
                  </h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-amber-600" />
                    Started at {formatTime12(rec.startTime)} ({formatDate(rec.startDate)})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenAddWater(rec.customerId, rec)}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all shadow-xs cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-white" />
                  <span>Stop & End</span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Quick Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onOpenAddCustomer}
          className="py-3.5 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 rounded-2xl shadow-xs flex items-center justify-center gap-2.5 text-slate-800 dark:text-white font-bold text-xs active:scale-[0.98] transition-all group"
        >
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/80 text-[#087C71] dark:text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
            <UserPlus className="w-4 h-4 stroke-[2.5]" />
          </div>
          <span className="tracking-tight">{t.addCustomer}</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenAddWater()}
          className="py-3.5 px-4 bg-gradient-to-r from-[#087C71] to-teal-700 hover:from-teal-800 hover:to-teal-900 text-white rounded-2xl shadow-md shadow-teal-900/20 flex items-center justify-center gap-2.5 font-bold text-xs active:scale-[0.98] transition-all group"
        >
          <div className="w-8 h-8 rounded-xl bg-white/20 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
            <Droplets className="w-4 h-4 fill-white/30" />
          </div>
          <span className="tracking-tight">{t.addWaterRecord}</span>
        </button>
      </div>

      {/* 3. Search Bar */}
      <div className="relative">
        <div className="absolute left-3.5 top-3 text-slate-400">
          <Search className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t.searchPlaceholder}
          className="w-full pl-10 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white font-medium focus:border-teal-600 focus:outline-none shadow-xs transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* 4. Customer List Header */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-[#087C71]" />
            {settings.language === 'ur'
              ? `کسان اور کھاتے (${displayedCustomers.length})`
              : `Customers & Ledgers (${displayedCustomers.length})`}
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            {t.tapToOpen}
          </span>
        </div>

        {/* Empty State */}
        {displayedCustomers.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-dashed border-slate-200 dark:border-slate-800">
            <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-teal-50 dark:bg-teal-950 text-[#087C71] flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-1">
              {searchQuery
                ? settings.language === 'ur'
                  ? 'کوئی گاہک نہیں ملا'
                  : 'No matching customers found'
                : settings.language === 'ur'
                ? 'ابھی تک کوئی گاہک نہیں'
                : 'No customers yet'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs mx-auto">
              {searchQuery
                ? `No customers match "${searchQuery}".`
                : 'Add your first customer to start tracking irrigation time and billing.'}
            </p>
            <button
              type="button"
              onClick={onOpenAddCustomer}
              className="py-2.5 px-4 bg-[#087C71] hover:bg-teal-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-teal-900/15"
            >
              <UserPlus className="w-4 h-4" />
              {t.addCustomer}
            </button>
          </div>
        ) : (
          displayedCustomers.map((customer) => {
            const summary = customerSummaries[customer.id];
            const balance = summary ? summary.balance : 0;
            const sessionsCount = summary ? summary.waterSessionsCount : 0;

            return (
              <div
                key={customer.id}
                onClick={() => onOpenCustomer(customer)}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-teal-500/60 dark:hover:border-teal-600 transition-all cursor-pointer active:scale-[0.99] group"
              >
                <div className="flex items-center justify-between">
                  {/* Left: Customer Info */}
                  <div className="flex items-start gap-3 min-w-0 pr-2">
                    <div className="w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900/60 border border-teal-200/80 dark:border-teal-800 text-[#087C71] dark:text-teal-300 flex items-center justify-center font-black text-sm uppercase shadow-xs">
                      {customer.name.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate group-hover:text-[#087C71] transition-colors">
                        {customer.name}
                      </h3>

                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {customer.phone && (
                          <span className="flex items-center gap-1 truncate font-medium">
                            <Phone className="w-3 h-3 shrink-0 text-slate-400" />
                            {customer.phone}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1.5 text-[11px] font-semibold">
                        <span className="text-[#087C71] dark:text-teal-400 bg-teal-50 dark:bg-teal-950/80 px-2 py-0.5 rounded-lg border border-teal-200/50 dark:border-teal-900/50">
                          Rs 600/hr
                        </span>
                        <span className="text-slate-400 font-medium">
                          {sessionsCount} {settings.language === 'ur' ? 'باریاں' : 'sessions'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Balance & Chevron */}
                  <div className="flex items-center gap-2 shrink-0 text-right">
                    <div>
                      <div className="text-base sm:text-lg font-black tabular-nums">
                        {balance > 0 ? (
                          <span className="text-rose-600 dark:text-rose-400">
                            {formatPKR(balance)}
                          </span>
                        ) : balance < 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            {formatPKR(Math.abs(balance))}
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400">
                            Rs 0
                          </span>
                        )}
                      </div>

                      <span
                        className={`text-[10px] font-extrabold uppercase block tracking-wider mt-0.5 ${
                          balance > 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : balance < 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {balance > 0
                          ? t.due
                          : balance < 0
                          ? t.advance
                          : t.settled}
                      </span>
                    </div>

                    <div className="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:bg-[#087C71] transition-all">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
