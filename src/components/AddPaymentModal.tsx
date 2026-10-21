import React, { useState, useEffect, useId } from 'react';
import { Customer, PaymentRecord } from '../types';
import { useKhata } from '../context/KhataContext';
import { getCurrentDateString, formatPKR } from '../utils/billing';
import { X, DollarSign, Calendar, FileText, CheckCircle2 } from 'lucide-react';

interface AddPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: string;
  paymentToEdit?: PaymentRecord | null;
  onSaved?: () => void;
}

export const AddPaymentModal: React.FC<AddPaymentModalProps> = ({
  isOpen,
  onClose,
  customerId,
  paymentToEdit,
  onSaved,
}) => {
  const { customers, customerSummaries, addPayment, editPayment } = useKhata();

  const customer = customers.find((c) => c.id === customerId);
  const summary = customerSummaries[customerId];

  const [amountStr, setAmountStr] = useState<string>('');
  const [date, setDate] = useState<string>(getCurrentDateString());
  const [note, setNote] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const amountInputId = useId();
  const dateInputId = useId();

  useEffect(() => {
    if (paymentToEdit) {
      setAmountStr(paymentToEdit.amount.toString());
      setDate(paymentToEdit.date);
      setNote(paymentToEdit.note || '');
    } else {
      setAmountStr('');
      setDate(getCurrentDateString());
      setNote('');
    }
    setError(null);
  }, [paymentToEdit, isOpen]);

  if (!isOpen || !customer) return null;

  const currentBalance = summary ? summary.balance : 0;
  const numAmount = parseInt(amountStr, 10) || 0;

  // New balance preview
  let projectedBalance = currentBalance;
  if (paymentToEdit) {
    projectedBalance = currentBalance + paymentToEdit.amount - numAmount;
  } else {
    projectedBalance = currentBalance - numAmount;
  }

  const handleQuickFillDue = () => {
    if (currentBalance > 0) {
      setAmountStr(currentBalance.toString());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (!numAmount || numAmount <= 0) {
      setError('Please enter a valid payment amount greater than Rs 0.');
      return;
    }

    if (!date) {
      setError('Please select a payment date.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (paymentToEdit) {
        const updated: PaymentRecord = {
          ...paymentToEdit,
          amount: numAmount,
          date,
          note: note.trim() || undefined,
        };
        await editPayment(updated);
      } else {
        await addPayment({
          customerId,
          amount: numAmount,
          date,
          note: note.trim() || undefined,
        });
      }

      setIsSubmitting(false);
      if (onSaved) onSaved();
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Failed to save payment.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl">
              <DollarSign className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {paymentToEdit ? 'Edit Payment' : 'Receive Payment'}
              </h2>
              <p className="text-xs text-emerald-100 font-medium">{customer.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Status Banner */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
              Current Ledger Balance
            </span>
            <div className="text-lg font-bold text-slate-900 dark:text-white">
              {currentBalance > 0 ? (
                <span className="text-amber-600 dark:text-amber-400">
                  Due: {formatPKR(currentBalance)}
                </span>
              ) : currentBalance < 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Advance: {formatPKR(Math.abs(currentBalance))}
                </span>
              ) : (
                <span className="text-slate-600 dark:text-slate-400">Settled (Rs 0)</span>
              )}
            </div>
          </div>

          {currentBalance > 0 && (
            <button
              type="button"
              onClick={handleQuickFillDue}
              className="px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 text-xs font-bold rounded-xl hover:bg-emerald-200 transition-all active:scale-95"
            >
              Pay Full Due
            </button>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Payment Amount */}
          <div>
            <label htmlFor={amountInputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Amount Received (PKR) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-3.5 text-base font-bold text-slate-400">
                Rs
              </span>
              <input
                id={amountInputId}
                type="number"
                min="1"
                step="1"
                required
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="e.g. 1500"
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-bold text-lg focus:border-emerald-600 focus:outline-none tabular-nums"
                autoFocus
              />
            </div>
            {/* Quick buttons */}
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400">Quick:</span>
              {[500, 1000, 1500, 2000, 3000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmountStr(amt.toString())}
                  className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 text-slate-700 dark:text-slate-300 text-[11px] font-semibold rounded-lg"
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Payment Date */}
          <div>
            <label htmlFor={dateInputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-emerald-600" />
              Payment Date <span className="text-rose-500">*</span>
            </label>
            <input
              id={dateInputId}
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3.5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium text-sm focus:border-emerald-600 focus:outline-none"
            />
          </div>



          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-semibold text-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || numAmount <= 0}
              className="flex-1 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-900/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              Save Payment
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
