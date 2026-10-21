import React, { useState, useId, useMemo, useEffect } from 'react';
import { WaterRecord, Time12 } from '../types';
import { useKhata } from '../context/KhataContext';
import { TimePicker12 } from './TimePicker12';
import {
  calculateDurationAndBill,
  formatDuration,
  formatPKR,
  getCurrentDateString,
  time12ToMinutes,
} from '../utils/billing';
import {
  X,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Droplets,
  Sparkles,
  User,
  Clock,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';

interface AddWaterRecordModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialCustomerId?: string;
  recordToEdit?: WaterRecord | null;
  onSaved?: (record: WaterRecord) => void;
}

export const AddWaterRecordModal: React.FC<AddWaterRecordModalProps> = ({
  isOpen,
  onClose,
  initialCustomerId,
  recordToEdit,
  onSaved,
}) => {
  const { customers, addWaterRecord, editWaterRecord, setSelectedCustomerId } = useKhata();

  // State
  const [customerId, setCustomerId] = useState<string>(
    recordToEdit?.customerId || initialCustomerId || (customers[0]?.id ?? '')
  );

  // STRICT REQUIREMENT: Only ONE date field, called Start Date. DO NOT ADD AN END DATE FIELD.
  const [startDate, setStartDate] = useState<string>(
    recordToEdit?.startDate || getCurrentDateString()
  );

  // NO DEFAULT TIME: strictly null (00:00) unless editing an existing record
  const [startTime, setStartTime] = useState<Time12 | null>(null);
  const [endTime, setEndTime] = useState<Time12 | null>(null);

  // GOB Minutes adjustment: + Add or - Minus
  const [gobMinutes, setGobMinutes] = useState<number | ''>('');
  const [gobType, setGobType] = useState<'add' | 'minus'>('minus');

  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const customerSelectId = useId();
  const startDateInputId = useId();
  const gobInputId = useId();
  const notesTextareaId = useId();

  // Whenever modal opens or recordToEdit changes, strictly reset to NO DEFAULT TIME (00) for new records
  useEffect(() => {
    if (isOpen) {
      if (recordToEdit) {
        setCustomerId(recordToEdit.customerId);
        setStartDate(recordToEdit.startDate);
        setStartTime(recordToEdit.startTime);
        setEndTime(recordToEdit.endTime);
        setGobMinutes(
          recordToEdit.gobMinutes !== undefined && recordToEdit.gobMinutes > 0
            ? recordToEdit.gobMinutes
            : ''
        );
        setGobType(recordToEdit.gobType || 'minus');
        setNotes(recordToEdit.notes || '');
      } else {
        setCustomerId(initialCustomerId || (customers[0]?.id ?? ''));
        setStartDate(getCurrentDateString());
        // STRICT: No default time, 00 / unselected initially
        setStartTime(null);
        setEndTime(null);
        setGobMinutes('');
        setGobType('minus');
        setNotes('');
      }
      setErrorMessage(null);
      setSubmitSuccess(false);
      setIsSubmitting(false);
    }
  }, [isOpen, recordToEdit, initialCustomerId, customers]);

  // Live calculation of duration and bill with GOB adjustment
  const calculation = useMemo(() => {
    const cleanGob = typeof gobMinutes === 'number' && gobMinutes > 0 ? gobMinutes : 0;
    if (!startTime) {
      return {
        isValid: false,
        durationMinutes: 0,
        rawDurationMinutes: 0,
        gobMinutes: cleanGob,
        gobType,
        totalBill: 0,
        formattedDuration: '00:00',
        formattedBill: 'Rs 0',
        isPendingSelection: true,
        isRunning: false,
        errorMessage: 'Please select Start Time.',
      };
    }

    // When End Time is not set, allow saving as active running tubewell session
    if (!endTime) {
      return {
        isValid: true,
        durationMinutes: 0,
        rawDurationMinutes: 0,
        gobMinutes: cleanGob,
        gobType,
        totalBill: 0,
        formattedDuration: 'Motor Running...',
        formattedBill: 'Active Session',
        isPendingSelection: false,
        isRunning: true,
        errorMessage: undefined,
      };
    }

    const isOvernight = time12ToMinutes(endTime) < time12ToMinutes(startTime);
    const res = calculateDurationAndBill(startTime, endTime, isOvernight, cleanGob, gobType);
    return {
      ...res,
      isPendingSelection: false,
      isRunning: false,
    };
  }, [startTime, endTime, gobMinutes, gobType]);

  if (!isOpen) return null;

  const handleResetBothTimes = () => {
    setStartTime(null);
    setEndTime(null);
    setGobMinutes('');
    setGobType('minus');
    setErrorMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent duplicate submission

    if (!customerId) {
      setErrorMessage('Please select a customer first.');
      return;
    }

    if (!startDate) {
      setErrorMessage('Please choose a Start Date.');
      return;
    }

    if (!startTime) {
      setErrorMessage('Please select Start Time.');
      return;
    }

    const isRunningSession = !endTime;
    const cleanGob = typeof gobMinutes === 'number' && gobMinutes > 0 ? gobMinutes : 0;

    if (!isRunningSession && !calculation.isValid) {
      setErrorMessage(calculation.errorMessage || 'Invalid time duration.');
      return;
    }

    const isOvernight = endTime ? time12ToMinutes(endTime) < time12ToMinutes(startTime) : false;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (recordToEdit) {
        // Edit existing record
        const updatedRecord: WaterRecord = {
          ...recordToEdit,
          customerId,
          startDate,
          startTime,
          endTime: endTime || null,
          endsNextDay: isRunningSession ? false : isOvernight,
          durationMinutes: isRunningSession ? 0 : calculation.durationMinutes,
          rawDurationMinutes: isRunningSession ? 0 : calculation.rawDurationMinutes,
          gobMinutes: cleanGob > 0 ? cleanGob : undefined,
          gobType: cleanGob > 0 ? gobType : undefined,
          amount: isRunningSession ? 0 : calculation.totalBill,
          status: isRunningSession ? 'running' : 'completed',
          notes: notes.trim() || undefined,
          updatedAt: new Date().toISOString(),
        };
        await editWaterRecord(updatedRecord);
        setSubmitSuccess(true);
        setTimeout(() => {
          setIsSubmitting(false);
          setSubmitSuccess(false);
          if (onSaved) onSaved(updatedRecord);
          onClose();
        }, 500);
      } else {
        // Create new record
        const newRecord = await addWaterRecord({
          customerId,
          startDate,
          startTime,
          endTime: endTime || null,
          endsNextDay: isRunningSession ? false : isOvernight,
          durationMinutes: isRunningSession ? 0 : calculation.durationMinutes,
          rawDurationMinutes: isRunningSession ? 0 : calculation.rawDurationMinutes,
          gobMinutes: cleanGob > 0 ? cleanGob : undefined,
          gobType: cleanGob > 0 ? gobType : undefined,
          amount: isRunningSession ? 0 : calculation.totalBill,
          status: isRunningSession ? 'running' : 'completed',
          notes: notes.trim() || undefined,
        });

        // Set active customer to open ledger
        setSelectedCustomerId(customerId);
        setSubmitSuccess(true);
        setTimeout(() => {
          setIsSubmitting(false);
          setSubmitSuccess(false);
          if (onSaved) onSaved(newRecord);
          onClose();
        }, 500);
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save water record.');
    }
  };

  const cleanGobMinutes = typeof gobMinutes === 'number' && gobMinutes > 0 ? gobMinutes : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#087C71] to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl backdrop-blur-xs">
              <Droplets className="w-6 h-6 text-teal-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {recordToEdit ? 'Edit Water Record' : 'Add Water Record'}
              </h2>
              <p className="text-xs text-teal-100 font-medium">
                Fixed Rate: Rs 600/hr (Rs 10/min)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-4">
          {/* Customer Selection */}
          <div>
            <label htmlFor={customerSelectId} className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Select Customer <span className="text-rose-500">*</span>
            </label>
            <select
              id={customerSelectId}
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full px-3.5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium text-sm focus:border-teal-600 focus:outline-none"
            >
              {customers.length === 0 ? (
                <option value="">No customers found — Add customer first</option>
              ) : (
                customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} {c.village ? `— ${c.village}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* STRICT REQUIREMENT: Only ONE date field, called Start Date. DO NOT ADD AN END DATE FIELD. */}
          <div>
            <label htmlFor={startDateInputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Start Date <span className="text-rose-500">*</span>
            </label>
            <input
              id={startDateInputId}
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full px-3.5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>

          {/* Time Picker Section (Start Time & End Time - NO DEFAULT TIME, 00:00 initially) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-600" />
                Watering Time (12h AM/PM)
              </span>
              {(startTime || endTime || cleanGobMinutes > 0) && (
                <button
                  type="button"
                  onClick={handleResetBothTimes}
                  className="text-[11px] text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset All</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <TimePicker12
                  label="Start Time"
                  value={startTime}
                  onChange={setStartTime}
                  helperText="Time when tubewell boring was started"
                />
              </div>

              <div>
                <TimePicker12
                  label="End Time"
                  value={endTime}
                  onChange={setEndTime}
                  helperText="Time when tubewell stopped (leave empty if running)"
                />
              </div>
            </div>
          </div>

          {/* GOB Minutes Section (+ Add / − Minus) */}
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <label
                htmlFor={gobInputId}
                className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                GOB Minutes
              </label>
              {cleanGobMinutes > 0 && (
                <button
                  type="button"
                  onClick={() => setGobMinutes('')}
                  className="text-[11px] text-slate-400 hover:text-rose-500 font-semibold cursor-pointer"
                >
                  Clear GOB
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Small Input Box */}
              <div className="relative">
                <input
                  id={gobInputId}
                  type="number"
                  min="0"
                  max="300"
                  step="1"
                  value={gobMinutes === '' ? '' : gobMinutes}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setGobMinutes('');
                    } else {
                      const parsed = parseInt(val, 10);
                      setGobMinutes(isNaN(parsed) || parsed < 0 ? '' : parsed);
                    }
                  }}
                  placeholder="0"
                  className="w-24 sm:w-28 px-3 py-2 bg-white dark:bg-slate-900 border-2 border-slate-200 dark:border-slate-700 focus:border-teal-600 rounded-xl font-bold text-center text-slate-900 dark:text-white text-base focus:outline-none tabular-nums"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                  min
                </span>
              </div>

              {/* Two Options: + Add and − Minus */}
              <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-700/60 p-1 gap-1">
                <button
                  type="button"
                  onClick={() => setGobType('add')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    gobType === 'add'
                      ? 'bg-teal-700 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 hover:bg-white/50 dark:hover:bg-slate-600'
                  }`}
                >
                  <span>+ Add</span>
                </button>
                <button
                  type="button"
                  onClick={() => setGobType('minus')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                    gobType === 'minus'
                      ? 'bg-rose-600 text-white shadow-xs'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 hover:bg-white/50 dark:hover:bg-slate-600'
                  }`}
                >
                  <span>− Minus</span>
                </button>
              </div>

              {/* Quick presets for common GOB minutes */}
              <div className="flex items-center gap-1 text-[11px] ml-auto">
                <span className="text-slate-400 font-medium">Quick:</span>
                {[5, 10, 15].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setGobMinutes(m)}
                    className={`px-2 py-1 rounded-md font-semibold text-xs transition-colors cursor-pointer ${
                      gobMinutes === m
                        ? 'bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-200 border border-teal-300'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-teal-500'
                    }`}
                  >
                    {m}m
                  </button>
                ))}
              </div>
            </div>

            {/* Active GOB indicator if minutes entered */}
            {cleanGobMinutes > 0 && calculation.rawDurationMinutes !== undefined && calculation.rawDurationMinutes > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-200/80 dark:border-slate-700/80 flex flex-wrap items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300">
                <span>
                  Actual: <strong className="text-slate-900 dark:text-white">{formatDuration(calculation.rawDurationMinutes)}</strong>
                </span>
                <span className={gobType === 'minus' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-teal-600 dark:text-teal-400 font-bold'}>
                  GOB: {gobType === 'minus' ? '−' : '+'}{cleanGobMinutes} min
                </span>
                <span>
                  Final: <strong className="text-[#087C71] dark:text-teal-300 font-bold">{formatDuration(calculation.durationMinutes)}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Live Calculated Duration and Total Bill Box */}
          <div
            className={`p-4 rounded-2xl border-2 transition-all ${
              calculation.isPendingSelection
                ? 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                : calculation.isValid
                ? 'bg-emerald-50/60 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200'
                : 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-950 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center justify-between pb-2 border-b border-black/5 dark:border-white/5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                Live Billing Calculation
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10">
                Rate: Rs 10/min (Rs 600/hr)
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {cleanGobMinutes > 0 ? 'Final Duration (with GOB)' : 'Total Duration'}
                </p>
                <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight tabular-nums">
                  {calculation.isValid ? calculation.formattedDuration : '00:00'}
                </div>
                {calculation.isValid && (
                  <p className="text-[11px] text-slate-500 font-medium">
                    ({calculation.durationMinutes} integer minutes)
                    {cleanGobMinutes > 0 && calculation.rawDurationMinutes !== undefined && (
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Actual: {formatDuration(calculation.rawDurationMinutes)} ({calculation.rawDurationMinutes}m) {gobType === 'minus' ? '−' : '+'} {cleanGobMinutes}m GOB
                      </span>
                    )}
                  </p>
                )}
              </div>

              <div className="text-right">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Final Bill
                </p>
                <div className="text-2xl font-black text-[#087C71] dark:text-teal-400 tracking-tight tabular-nums">
                  {calculation.isValid ? calculation.formattedBill : 'Rs 0'}
                </div>
                {calculation.isValid && (
                  <p className="text-[11px] text-slate-500 font-medium">
                    {calculation.durationMinutes} min × Rs 10
                  </p>
                )}
              </div>
            </div>

            {calculation.isRunning && (
              <div className="mt-3 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 p-2.5 rounded-xl font-medium border border-amber-200 dark:border-amber-800">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span>
                  Tubewell is currently running. Tap Save below, and enter End Time when the boring stops.
                </span>
              </div>
            )}

            {calculation.isPendingSelection && !calculation.isRunning && (
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 p-2.5 rounded-xl font-medium">
                <Clock className="w-4 h-4 shrink-0 text-teal-600" />
                <span>{calculation.errorMessage}</span>
              </div>
            )}

            {!calculation.isPendingSelection && !calculation.isValid && !calculation.isRunning && (
              <div className="mt-3 flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300 bg-rose-100/60 dark:bg-rose-900/30 p-2.5 rounded-xl">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{calculation.errorMessage}</span>
              </div>
            )}
          </div>

          {/* Optional notes */}
          <div>
            <label htmlFor={notesTextareaId} className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              id={notesTextareaId}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. North wheat field, pump operator note"
              rows={2}
              className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:border-teal-600 focus:outline-none"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Success message banner */}
          {submitSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                {calculation.isRunning
                  ? 'Tubewell session saved! Enter End Time when the boring stops.'
                  : 'Water record successfully recorded! Updating ledger...'}
              </span>
            </div>
          )}

          {/* Enter & Save Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={
                isSubmitting ||
                !startTime ||
                (!calculation.isRunning && !calculation.isValid) ||
                customers.length === 0
              }
              className={`w-full py-3.5 px-4 text-white font-bold text-base rounded-2xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed ${
                calculation.isRunning
                  ? 'bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 shadow-amber-900/20'
                  : 'bg-gradient-to-r from-[#087C71] via-teal-700 to-teal-800 hover:from-teal-800 hover:to-teal-900 shadow-teal-900/20'
              } disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-700`}
            >
              {isSubmitting ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving Record...
                </>
              ) : calculation.isRunning ? (
                <>
                  <Droplets className="w-5 h-5 fill-white" />
                  Save (Tubewell Running)
                </>
              ) : recordToEdit && (recordToEdit.status === 'running' || !recordToEdit.endTime) ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Stop Tubewell &amp; Complete Bill
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  {recordToEdit ? 'Update Record' : 'Enter & Save'}
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-500 mt-2">
              {calculation.isRunning
                ? 'Saves Start Time now. You can enter End Time when the boring stops.'
                : 'Instantly updates Customer Balance, Home Previous Dues, Invoices, and Insights'}
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};
