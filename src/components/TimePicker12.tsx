import React, { useState } from 'react';
import { Time12 } from '../types';
import { formatTime12, getCurrentTime12 } from '../utils/billing';
import { Clock, Check, ChevronUp, ChevronDown, RotateCcw, Plus, Minus, Zap } from 'lucide-react';

interface TimePicker12Props {
  label: string;
  value: Time12 | null;
  onChange: (time: Time12 | null) => void;
  helperText?: string;
}

export const TimePicker12: React.FC<TimePicker12Props> = ({
  label,
  value,
  onChange,
  helperText,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // When value is null, NO default hour or minute is pre-selected (starts as null / 00)
  const [selectedHour, setSelectedHour] = useState<number | null>(value?.hour ?? null);
  const [selectedMinute, setSelectedMinute] = useState<number | null>(value?.minute ?? null);
  const [selectedPeriod, setSelectedPeriod] = useState<'AM' | 'PM'>(value?.period ?? 'AM');

  // Minute selection mode: 'all' (0-59) or 'step5' (5-min intervals)
  const [minuteViewMode, setMinuteViewMode] = useState<'all' | 'step5'>('all');

  const openModal = () => {
    setSelectedHour(value?.hour ?? null);
    setSelectedMinute(value?.minute ?? null);
    setSelectedPeriod(value?.period ?? 'AM');
    setMinuteViewMode('all');
    setIsOpen(true);
  };

  const handleApply = () => {
    if (selectedHour === null || selectedMinute === null) {
      return;
    }
    onChange({
      hour: selectedHour,
      minute: selectedMinute,
      period: selectedPeriod,
    });
    setIsOpen(false);
  };

  const handleClearTo00 = () => {
    setSelectedHour(null);
    setSelectedMinute(null);
    onChange(null);
    setIsOpen(false);
  };

  const handleSetCurrentTime = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const now = getCurrentTime12();
    setSelectedHour(now.hour);
    setSelectedMinute(now.minute);
    setSelectedPeriod(now.period);
    onChange(now);
  };

  const handleSetCurrentTimeInModal = () => {
    const now = getCurrentTime12();
    setSelectedHour(now.hour);
    setSelectedMinute(now.minute);
    setSelectedPeriod(now.period);
  };

  const adjustHour = (delta: number) => {
    setSelectedHour((prev) => {
      if (prev === null) {
        return delta > 0 ? 1 : 12;
      }
      let h = prev + delta;
      if (h > 12) h = 1;
      if (h < 1) h = 12;
      return h;
    });
  };

  const adjustMinute = (delta: number) => {
    setSelectedMinute((prev) => {
      if (prev === null) {
        return delta > 0 ? (delta === 1 ? 0 : delta) : 59;
      }
      let m = (prev + delta) % 60;
      if (m < 0) m += 60;
      return m;
    });
  };

  // Direct typing handler for Minute (0 - 59)
  const handleMinuteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setSelectedMinute(null);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      if (parsed < 0) {
        setSelectedMinute(0);
      } else if (parsed > 59) {
        setSelectedMinute(59);
      } else {
        setSelectedMinute(parsed);
      }
    }
  };

  // Direct typing handler for Hour (1 - 12)
  const handleHourChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      setSelectedHour(null);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      if (parsed < 1) {
        setSelectedHour(1);
      } else if (parsed > 12) {
        setSelectedHour(12);
      } else {
        setSelectedHour(parsed);
      }
    }
  };

  const commonMinutes = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];
  const allMinutes = Array.from({ length: 60 }, (_, i) => i); // 0, 1, 2, 3, 4, 5, ... 59
  const hours12 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const hasValue = value !== null;
  const isCompleteSelection = selectedHour !== null && selectedMinute !== null;

  // Header display in modal
  const modalDisplayTime = () => {
    if (selectedHour === null && selectedMinute === null) {
      return '00:00 --';
    }
    const h = selectedHour !== null ? selectedHour.toString() : '00';
    const m = selectedMinute !== null ? selectedMinute.toString().padStart(2, '0') : '00';
    return `${h}:${m} ${selectedPeriod}`;
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
          {label}
        </label>
        {hasValue && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            className="text-[11px] text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
            title="Reset to 00"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset (00)</span>
          </button>
        )}
      </div>

      {/* Main trigger container */}
      <div
        role="button"
        tabIndex={0}
        onClick={openModal}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openModal();
          }
        }}
        className={`w-full flex items-center justify-between px-3.5 py-3 bg-white dark:bg-slate-800 border-2 rounded-2xl shadow-xs transition-all text-left focus:outline-none focus:ring-2 focus:ring-teal-500/20 active:scale-[0.99] cursor-pointer ${
          hasValue
            ? 'border-teal-600/70 dark:border-teal-500/70 ring-1 ring-teal-500/10'
            : 'border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`p-2 rounded-xl transition-colors ${
              hasValue
                ? 'bg-teal-50 dark:bg-teal-950/70 text-[#087C71] dark:text-teal-400'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
            }`}
          >
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div
              className={`text-xl font-black tracking-tight tabular-nums ${
                hasValue
                  ? 'text-slate-900 dark:text-white'
                  : 'text-slate-400 dark:text-slate-500'
              }`}
            >
              {hasValue ? formatTime12(value) : '00:00'}
            </div>
            <div className="text-[11px] text-slate-400 font-medium">
              {hasValue
                ? value.period === 'AM'
                  ? 'Morning / Night'
                  : 'Afternoon / Evening'
                : 'No time selected'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleSetCurrentTime}
            title="Set to current live time"
            className="text-[11px] font-bold px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 dark:hover:bg-amber-900/50 flex items-center gap-1 active:scale-95 transition-all cursor-pointer shadow-xs"
          >
            <Clock className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Set to Now</span>
          </button>
          <span
            className={`text-xs font-bold px-2.5 py-1 rounded-xl transition-colors ${
              hasValue
                ? 'bg-slate-100 dark:bg-slate-700 text-[#087C71] dark:text-teal-300'
                : 'bg-[#087C71] text-white shadow-xs'
            }`}
          >
            {hasValue ? 'Change' : 'Set Time'}
          </span>
        </div>
      </div>

      {helperText && (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helperText}</p>
      )}

      {/* Touch-Friendly 12-Hour Modal Picker */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full max-w-sm sm:max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 bg-[#087C71] text-white flex items-center justify-between shrink-0">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-teal-100 font-bold">
                  Select {label}
                </p>
                <h3 className="text-2xl font-black tracking-tight tabular-nums">
                  {modalDisplayTime()}
                </h3>
              </div>
              <div className="flex bg-teal-800/80 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('AM')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    selectedPeriod === 'AM'
                      ? 'bg-white text-[#087C71] shadow-xs'
                      : 'text-teal-100 hover:text-white'
                  }`}
                >
                  AM
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('PM')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                    selectedPeriod === 'PM'
                      ? 'bg-white text-[#087C71] shadow-xs'
                      : 'text-teal-100 hover:text-white'
                  }`}
                >
                  PM
                </button>
              </div>
            </div>

            {/* Quick Live Time Bar in Modal */}
            <div className="px-4 py-2 bg-teal-900/40 dark:bg-slate-800 border-b border-teal-700/30 dark:border-slate-700 flex items-center justify-between text-xs shrink-0">
              <span className="text-teal-100 dark:text-teal-300 font-medium flex items-center gap-1 text-[11px]">
                <Clock className="w-3 h-3" /> Current Live Time
              </span>
              <button
                type="button"
                onClick={handleSetCurrentTimeInModal}
                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-lg flex items-center gap-1 active:scale-95 transition-all shadow-xs cursor-pointer text-xs"
              >
                <Zap className="w-3.5 h-3.5 fill-slate-950" />
                <span>Set to Current Time</span>
              </button>
            </div>

            {/* Stepper display & precision controls */}
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                {/* Hour control */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => adjustHour(1)}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl active:scale-95 cursor-pointer"
                    title="+1 Hour"
                  >
                    <ChevronUp className="w-6 h-6" />
                  </button>

                  <input
                    type="number"
                    min="1"
                    max="12"
                    value={selectedHour !== null ? selectedHour : ''}
                    placeholder="00"
                    onChange={handleHourChange}
                    onFocus={(e) => e.target.select()}
                    className={`text-2xl sm:text-3xl font-extrabold my-1 tabular-nums w-14 sm:w-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-0.5 focus:border-teal-500 focus:outline-none ${
                      selectedHour !== null
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => adjustHour(-1)}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl active:scale-95 cursor-pointer"
                    title="-1 Hour"
                  >
                    <ChevronDown className="w-6 h-6" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-500 uppercase mt-0.5">Hour (1-12)</span>
                </div>

                <span className="text-3xl font-black text-slate-400 mb-5">:</span>

                {/* Minute control - single minute adjustments */}
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => adjustMinute(1)}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl active:scale-95 cursor-pointer"
                    title="+1 Minute"
                  >
                    <ChevronUp className="w-6 h-6" />
                  </button>

                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={selectedMinute !== null ? selectedMinute : ''}
                    placeholder="00"
                    onChange={handleMinuteChange}
                    onFocus={(e) => e.target.select()}
                    className={`text-2xl sm:text-3xl font-extrabold my-1 tabular-nums w-14 sm:w-16 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-0.5 focus:border-teal-500 focus:outline-none ${
                      selectedMinute !== null
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-300 dark:text-slate-600'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => adjustMinute(-1)}
                    className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl active:scale-95 cursor-pointer"
                    title="-1 Minute"
                  >
                    <ChevronDown className="w-6 h-6" />
                  </button>
                  <span className="text-[11px] font-bold text-slate-500 uppercase mt-0.5">Minute (0-59)</span>
                </div>

                {/* AM/PM indicator */}
                <div className="flex flex-col items-center mb-5 pl-1 sm:pl-2">
                  <span className="text-lg sm:text-xl font-black text-[#087C71] dark:text-teal-400 bg-teal-50 dark:bg-teal-950/70 px-3 py-1.5 rounded-xl border border-teal-200 dark:border-teal-800">
                    {selectedPeriod}
                  </span>
                </div>
              </div>

              {/* Minute quick stepper shortcuts (-5m, -1m, +1m, +5m) */}
              <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-center gap-1.5 sm:gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">Fine Tune:</span>
                <button
                  type="button"
                  onClick={() => adjustMinute(-5)}
                  className="px-2 py-1 bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  title="Subtract 5 minutes"
                >
                  -5m
                </button>
                <button
                  type="button"
                  onClick={() => adjustMinute(-1)}
                  className="px-2 py-1 bg-slate-200/80 dark:bg-slate-700/80 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-0.5"
                  title="Subtract 1 minute"
                >
                  <Minus className="w-3 h-3" /> 1m
                </button>
                <button
                  type="button"
                  onClick={() => adjustMinute(1)}
                  className="px-2 py-1 bg-teal-100 dark:bg-teal-950/80 hover:bg-teal-200 text-teal-800 dark:text-teal-200 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-0.5"
                  title="Add 1 minute"
                >
                  <Plus className="w-3 h-3" /> 1m
                </button>
                <button
                  type="button"
                  onClick={() => adjustMinute(5)}
                  className="px-2 py-1 bg-teal-100 dark:bg-teal-950/80 hover:bg-teal-200 text-teal-800 dark:text-teal-200 rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer"
                  title="Add 5 minutes"
                >
                  +5m
                </button>
              </div>
            </div>

            {/* Quick Grid Selector */}
            <div className="p-3 sm:p-4 space-y-4 overflow-y-auto flex-1">
              {/* Hour Grid (1 to 12) */}
              <div>
                <p className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5 flex items-center justify-between">
                  <span>1. Select Hour:</span>
                  {selectedHour === null ? (
                    <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                      Not Selected
                    </span>
                  ) : (
                    <span className="text-[11px] font-bold text-[#087C71] dark:text-teal-400">
                      Hour {selectedHour}
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-6 gap-1.5">
                  {hours12.map((h) => {
                    const isSelected = selectedHour === h;
                    return (
                      <button
                        key={h}
                        type="button"
                        onClick={() => setSelectedHour(h)}
                        className={`h-9 text-xs sm:text-sm font-bold rounded-xl transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#087C71] text-white shadow-sm ring-2 ring-[#087C71]/30 scale-105'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        {h}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Minute Selection Section (Allows picking ANY minute 0-59: 1, 2, 3, 4, 5, etc.) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <span>2. Select Minute:</span>
                    {selectedMinute !== null ? (
                      <span className="text-[11px] font-bold text-[#087C71] dark:text-teal-400">
                        :{selectedMinute.toString().padStart(2, '0')} min
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                        Not Selected
                      </span>
                    )}
                  </p>

                  {/* Toggle between All Minutes (0-59) and 5-min intervals */}
                  <div className="inline-flex rounded-lg bg-slate-200 dark:bg-slate-800 p-0.5 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setMinuteViewMode('all')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        minuteViewMode === 'all'
                          ? 'bg-white dark:bg-slate-700 text-[#087C71] dark:text-teal-300 font-bold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      All (0-59)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMinuteViewMode('step5')}
                      className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                        minuteViewMode === 'step5'
                          ? 'bg-white dark:bg-slate-700 text-[#087C71] dark:text-teal-300 font-bold shadow-xs'
                          : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                      }`}
                    >
                      5-Min Quick
                    </button>
                  </div>
                </div>

                {/* Quick shortcuts for standard quarters */}
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400">Presets:</span>
                  {[0, 15, 30, 45].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSelectedMinute(m)}
                      className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                        selectedMinute === m
                          ? 'bg-[#087C71] text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      :{m.toString().padStart(2, '0')}
                    </button>
                  ))}
                </div>

                {/* VIEW 1: All Minutes 00 to 59 in a responsive 10-column grid */}
                {minuteViewMode === 'all' && (
                  <div>
                    <div className="grid grid-cols-10 gap-1 p-1 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 max-h-48 overflow-y-auto">
                      {allMinutes.map((m) => {
                        const isSelected = selectedMinute === m;
                        const isMultipleOf5 = m % 5 === 0;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setSelectedMinute(m)}
                            className={`h-7 sm:h-8 text-[11px] font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center ${
                              isSelected
                                ? 'bg-[#087C71] text-white font-bold shadow-sm scale-105 z-10'
                                : isMultipleOf5
                                ? 'bg-teal-50 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 font-bold border border-teal-200 dark:border-teal-800/60 hover:bg-teal-100'
                                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                            }`}
                            title={`Minute :${m.toString().padStart(2, '0')}`}
                          >
                            {m.toString().padStart(2, '0')}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 text-center">
                      Tap any minute 0 to 59 or type directly in the box above
                    </p>
                  </div>
                )}

                {/* VIEW 2: 5-Minute Quick Intervals */}
                {minuteViewMode === 'step5' && (
                  <div className="grid grid-cols-6 gap-1.5">
                    {commonMinutes.map((m) => {
                      const isSelected = selectedMinute === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setSelectedMinute(m)}
                          className={`h-9 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-[#087C71] text-white shadow-sm ring-2 ring-[#087C71]/30 scale-105'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          :{m.toString().padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3 sm:p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleClearTo00}
                className="py-2.5 px-3 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/40 active:scale-95 transition-all flex items-center justify-center gap-1 cursor-pointer"
                title="Reset to 00:00"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset (00)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="py-2.5 px-3 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 active:scale-95 transition-all cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleApply}
                disabled={!isCompleteSelection}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#087C71] hover:bg-teal-800 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-teal-700/20 active:scale-95 transition-all flex items-center justify-center gap-1.5 disabled:cursor-not-allowed cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{isCompleteSelection ? 'Done' : 'Select hour & minute'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
