import React from 'react';
import { Home, FileText, BarChart3, Settings } from 'lucide-react';
import { useKhata } from '../context/KhataContext';
import { getT } from '../utils/translations';

export type TabType = 'home' | 'invoices' | 'insights' | 'settings';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onSelectTab }) => {
  const { settings } = useKhata();
  const t = getT(settings.language);

  const tabs = [
    { id: 'home' as TabType, label: t.home, icon: Home },
    { id: 'invoices' as TabType, label: t.invoices, icon: FileText },
    { id: 'insights' as TabType, label: t.insights, icon: BarChart3 },
    { id: 'settings' as TabType, label: t.settings, icon: Settings },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/92 dark:bg-slate-900/92 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800/80 safe-area-pb shadow-2xl shadow-slate-900/10">
      <div className="max-w-md mx-auto flex items-center justify-around px-3 py-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center py-1 rounded-2xl transition-all duration-200 active:scale-95 relative ${
                isActive
                  ? 'text-[#087C71] dark:text-teal-400 font-extrabold'
                  : 'text-slate-400 dark:text-slate-500 font-medium hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {isActive && (
                <span className="absolute -top-2 w-7 h-1 bg-[#087C71] dark:bg-teal-400 rounded-full shadow-sm shadow-teal-500/50" />
              )}
              <div
                className={`p-1.5 rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-teal-50 dark:bg-teal-950/70 text-[#087C71] dark:text-teal-400 shadow-xs scale-105'
                    : 'bg-transparent'
                }`}
              >
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'stroke-[2.5]' : 'stroke-2'
                  }`}
                />
              </div>
              <span className="text-[11px] mt-0.5 tracking-tight leading-tight">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
