import React from 'react';
import { useKhata } from '../context/KhataContext';
import { Droplets, BookOpen, Moon, Sun, Plus, Globe, RefreshCw, WifiOff, Cloud, Check } from 'lucide-react';

export const Header: React.FC<{
  onOpenQuickWater?: () => void;
}> = ({ onOpenQuickWater }) => {
  const {
    settings,
    updateSettings,
    syncStatus,
    isOffline,
    isGoogleConnected,
  } = useKhata();

  const toggleDarkMode = () => {
    updateSettings({ isDarkMode: !settings.isDarkMode });
  };

  const isUrdu = settings.language === 'ur';

  return (
    <header className="sticky top-0 z-30 bg-gradient-to-r from-[#066158] via-[#087C71] to-[#0A8F82] text-white px-4 py-3 shadow-md shadow-teal-950/15 backdrop-blur-md border-b border-teal-600/30">
      <div className="max-w-2xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-white/25 to-white/10 backdrop-blur-md flex items-center justify-center border border-white/30 shadow-lg shadow-teal-900/30 transition-transform active:scale-95">
              <Droplets className="w-5 h-5 text-teal-200 fill-teal-100/50 drop-shadow-sm" />
              <div className="absolute -bottom-1 -right-1 bg-white text-[#087C71] p-1 rounded-full shadow-md">
                <BookOpen className="w-2.5 h-2.5 stroke-[3]" />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h1 className="text-base sm:text-lg font-black tracking-tight leading-none text-white drop-shadow-xs">
                {isUrdu ? 'ٹیوب ویل کھاتہ' : 'TubeWell Khata'}
              </h1>

              {/* Simple Cloud Sync Status Pill */}
              {isGoogleConnected ? (
                syncStatus === 'synced' ? (
                  <span className="text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 bg-emerald-500/30 text-emerald-100 rounded-md border border-emerald-400/40 flex items-center gap-1">
                    <Check className="w-2.5 h-2.5 text-emerald-300" />
                    <span>SYNCED</span>
                  </span>
                ) : syncStatus === 'syncing' ? (
                  <span className="text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 bg-teal-400/30 text-teal-100 rounded-md border border-teal-300/40 flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                    <span>SYNCING</span>
                  </span>
                ) : isOffline || syncStatus === 'offline' ? (
                  <span className="text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 bg-amber-500/30 text-amber-100 rounded-md border border-amber-400/40 flex items-center gap-1">
                    <WifiOff className="w-2.5 h-2.5" />
                    <span>OFFLINE</span>
                  </span>
                ) : (
                  <span className="text-[9px] uppercase font-extrabold tracking-wider px-2 py-0.5 bg-rose-500/30 text-rose-100 rounded-md border border-rose-400/40 flex items-center gap-1">
                    <span>RETRY</span>
                  </span>
                )
              ) : (
                <span className="text-[9px] uppercase font-extrabold tracking-wider px-1.5 py-0.5 bg-white/20 text-teal-100 rounded-md border border-white/20">
                  OFFLINE
                </span>
              )}
            </div>

            <p className="text-[11px] text-teal-100/90 font-medium leading-tight mt-0.5 flex items-center gap-1.5">
              <span className="truncate max-w-[140px] sm:max-w-[200px]">
                {settings.tubeWellName || (isUrdu ? 'پانی کا کھاتہ' : 'Irrigation Ledger')}
              </span>
              <span className="inline-block w-1 h-1 rounded-full bg-teal-300"></span>
              <span className="text-teal-200 font-bold whitespace-nowrap">Rs 600/hr</span>
            </p>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2">
          {/* Language Toggle Pill */}
          <button
            type="button"
            onClick={() =>
              updateSettings({ language: isUrdu ? 'en' : 'ur' })
            }
            className="flex items-center gap-1 px-2.5 py-1.5 bg-white/15 hover:bg-white/25 active:scale-95 text-white rounded-xl text-xs font-bold transition-all border border-white/25 shadow-xs"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-teal-200" />
            <span>{isUrdu ? 'English' : 'اردو'}</span>
          </button>

          {/* Dark Mode */}
          <button
            type="button"
            onClick={toggleDarkMode}
            className="p-2 text-teal-100 hover:text-white bg-white/10 hover:bg-white/20 active:scale-95 rounded-xl transition-all border border-white/15"
            title={settings.isDarkMode ? 'Light mode' : 'Dark mode'}
            aria-label="Toggle dark mode"
          >
            {settings.isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-300 fill-amber-300/30" />
            ) : (
              <Moon className="w-4 h-4 text-teal-100" />
            )}
          </button>

          {/* Quick Water Button */}
          {onOpenQuickWater && (
            <button
              type="button"
              onClick={onOpenQuickWater}
              className="px-3 py-1.5 bg-white hover:bg-teal-50 text-[#087C71] active:scale-95 rounded-xl text-xs font-black shadow-md shadow-black/15 flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{isUrdu ? 'پانی' : 'Water'}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
