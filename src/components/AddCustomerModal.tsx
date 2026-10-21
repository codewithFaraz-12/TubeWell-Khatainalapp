import React, { useState, useEffect, useId } from 'react';
import { Customer } from '../types';
import { useKhata } from '../context/KhataContext';
import { X, UserPlus, Phone, MapPin, CheckCircle, ShieldCheck } from 'lucide-react';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerToEdit?: Customer | null;
  onSaved?: (customer: Customer) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  customerToEdit,
  onSaved,
}) => {
  const { addCustomer, editCustomer, setSelectedCustomerId } = useKhata();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [village, setVillage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nameInputId = useId();
  const phoneInputId = useId();
  const rateInputId = useId();

  useEffect(() => {
    if (customerToEdit) {
      setName(customerToEdit.name);
      setPhone(customerToEdit.phone || '');
      setVillage(customerToEdit.village || '');
    } else {
      setName('');
      setPhone('');
      setVillage('');
    }
    setError(null);
  }, [customerToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Customer Name is required and cannot be blank.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (customerToEdit) {
        const updated: Customer = {
          ...customerToEdit,
          name: trimmed,
          phone: phone.trim() || undefined,
          village: village.trim() || undefined,
        };
        await editCustomer(updated);
        setIsSubmitting(false);
        if (onSaved) onSaved(updated);
        onClose();
      } else {
        const created = await addCustomer({
          name: trimmed,
          phone: phone.trim() || undefined,
          village: village.trim() || undefined,
        });
        setIsSubmitting(false);
        // Automatically open the new customer's account / ledger
        setSelectedCustomerId(created.id);
        if (onSaved) onSaved(created);
        onClose();
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : 'Error saving customer.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#087C71] text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/15 rounded-2xl">
              <UserPlus className="w-6 h-6 text-teal-100" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {customerToEdit ? 'Edit Customer' : 'Add New Customer'}
              </h2>
              <p className="text-xs text-teal-100">
                Creates an individual ledger for tracking water bills
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {/* Customer Name (Required) */}
          <div>
            <label htmlFor={nameInputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
              Customer Name <span className="text-rose-500">*</span>
            </label>
            <input
              id={nameInputId}
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Chaudhry Akram Gujjar"
              className="w-full px-3.5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium text-sm focus:border-teal-600 focus:outline-none"
              autoFocus
            />
          </div>

          {/* Phone Number (Optional) */}
          <div>
            <label htmlFor={phoneInputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Phone Number (Optional)
            </label>
            <input
              id={phoneInputId}
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 0300-1234567"
              className="w-full px-3.5 py-3 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-medium text-sm focus:border-teal-600 focus:outline-none"
            />
          </div>



          {/* Hourly Rate: Rs 600 (Fixed, Read-only as specified) */}
          <div>
            <label htmlFor={rateInputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              Hourly Rate (Fixed)
            </label>
            <div className="relative">
              <input
                id={rateInputId}
                type="text"
                readOnly
                value="Rs 600 / hour (Rs 10 / minute)"
                className="w-full px-3.5 py-3 bg-slate-100 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 font-bold text-sm cursor-not-allowed select-none"
              />
              <span className="absolute right-3.5 top-3.5 px-2 py-0.5 bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-[10px] font-bold rounded">
                LOCKED
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Standard official irrigation tariff in TubeWell Khata
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">
              {error}
            </div>
          )}

          {/* Action Buttons */}
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
              disabled={isSubmitting}
              className="flex-1 py-3 px-4 bg-[#087C71] hover:bg-teal-800 disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow-lg shadow-teal-900/20 active:scale-95 transition-all flex items-center justify-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" />
              {customerToEdit ? 'Save Changes' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
