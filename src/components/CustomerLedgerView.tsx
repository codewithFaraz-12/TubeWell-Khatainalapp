import React, { useState } from 'react';
import { Customer, WaterRecord, PaymentRecord } from '../types';
import { useKhata } from '../context/KhataContext';
import {
  formatPKR,
  formatDate,
  formatTime12,
  formatDuration,
} from '../utils/billing';
import { AddWaterRecordModal } from './AddWaterRecordModal';
import { AddPaymentModal } from './AddPaymentModal';
import { AddCustomerModal } from './AddCustomerModal';
import { ConfirmModal } from './ConfirmModal';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import {
  ArrowLeft,
  Droplets,
  Plus,
  Share2,
  Trash2,
  Edit2,
  Phone,
  MapPin,
  Moon,
  Sun,
  DollarSign,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
  Image as ImageIcon,
} from 'lucide-react';

interface CustomerLedgerViewProps {
  customer: Customer;
  onBack: () => void;
  onOpenStatement?: (customerId: string) => void;
}

export const CustomerLedgerView: React.FC<CustomerLedgerViewProps> = ({
  customer,
  onBack,
  onOpenStatement,
}) => {
  const {
    waterRecords,
    payments,
    customerSummaries,
    removeWaterRecord,
    removePayment,
    removeCustomer,
    settings,
    updateSettings,
  } = useKhata();

  const [activeTab, setActiveTab] = useState<'all' | 'water' | 'payments'>('all');

  // Modals state
  const [isWaterModalOpen, setIsWaterModalOpen] = useState(false);
  const [waterToEdit, setWaterToEdit] = useState<WaterRecord | null>(null);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<PaymentRecord | null>(null);

  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptSpecificWater, setReceiptSpecificWater] = useState<WaterRecord | undefined>(undefined);

  // Deletion confirm modals
  const [deleteWaterTarget, setDeleteWaterTarget] = useState<WaterRecord | null>(null);
  const [deletePaymentTarget, setDeletePaymentTarget] = useState<PaymentRecord | null>(null);
  const [isDeleteCustomerConfirmOpen, setIsDeleteCustomerConfirmOpen] = useState(false);

  const handleOpenPhotoParchi = (waterRecord?: WaterRecord) => {
    setReceiptSpecificWater(waterRecord);
    setIsReceiptModalOpen(true);
  };

  const summary = customerSummaries[customer.id] || {
    totalWaterCharges: 0,
    totalPayments: 0,
    balance: 0,
    waterSessionsCount: 0,
    totalWaterMinutes: 0,
  };

  // Get customer specific records sorted latest first
  const custWaters = waterRecords
    .filter((w) => w.customerId === customer.id)
    .sort((a, b) => {
      const dateDiff = new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const custPayments = payments
    .filter((p) => p.customerId === customer.id)
    .sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  // Combined timeline items
  type TimelineItem =
    | { type: 'water'; data: WaterRecord; date: string }
    | { type: 'payment'; data: PaymentRecord; date: string };

  const timelineItems: TimelineItem[] = [
    ...custWaters.map((w) => ({ type: 'water' as const, data: w, date: w.startDate })),
    ...custPayments.map((p) => ({ type: 'payment' as const, data: p, date: p.date })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Quick WhatsApp Share generator
  const handleShareWhatsApp = () => {
    const tubeWell = settings.tubeWellName || 'TubeWell Khata';
    const balanceText =
      summary.balance > 0
        ? `*Remaining Dues:* ${formatPKR(summary.balance)}`
        : summary.balance < 0
        ? `*Advance Credit:* ${formatPKR(Math.abs(summary.balance))}`
        : `*Balance:* Settled (Rs 0)`;

    let message = `💧 *${tubeWell}* - Irrigation Statement\n`;
    message += `👤 *Customer:* ${customer.name}\n`;
    if (customer.phone) message += `📞 *Phone:* ${customer.phone}\n`;
    message += `🗓️ *Generated:* ${formatDate(new Date().toISOString().split('T')[0])}\n\n`;
    message += `📊 *Summary:*\n`;
    message += `• Total Water Charges: ${formatPKR(summary.totalWaterCharges)}\n`;
    message += `• Total Payments Received: ${formatPKR(summary.totalPayments)}\n`;
    message += `• Total Water Sessions: ${summary.waterSessionsCount} (${formatDuration(summary.totalWaterMinutes)})\n`;
    message += `${balanceText}\n\n`;

    if (custWaters.length > 0) {
      message += `🕒 *Recent Water Records:*\n`;
      custWaters.slice(0, 5).forEach((w, i) => {
        const gobStr = w.gobMinutes && w.gobMinutes > 0 ? ` [GOB: ${w.gobType === 'minus' ? '−' : '+'}${w.gobMinutes}m]` : '';
        message += `${i + 1}. ${formatDate(w.startDate)}: ${formatTime12(w.startTime)} - ${formatTime12(w.endTime)}${w.endsNextDay ? ' (Overnight)' : ''}${gobStr} | ${formatDuration(w.durationMinutes)} = ${formatPKR(w.amount)}\n`;
      });
    }

    message += `\n_Thank you for your business!_`;

    const encoded = encodeURIComponent(message);
    if (navigator.share) {
      navigator.share({
        title: `${customer.name} - TubeWell Khata Statement`,
        text: message,
      }).catch(() => {
        window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
      });
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }
  };

  return (
    <div className="flex flex-col min-h-full pb-24">
      {/* Top Header Bar */}
      <div className="sticky top-0 z-30 bg-[#087C71] text-white p-4 shadow-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-1 text-teal-100 hover:text-white hover:bg-white/10 rounded-full transition-all"
            aria-label="Back to customer list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-tight leading-tight">
              {customer.name}
            </h1>
            <p className="text-xs text-teal-100 flex items-center gap-2">
              {customer.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {customer.phone}
                </span>
              )}
              {customer.village && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {customer.village}
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => updateSettings({ isDarkMode: !settings.isDarkMode })}
            className="p-2 text-teal-100 hover:text-white hover:bg-white/10 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
            title={settings.isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label="Toggle Dark Mode"
          >
            {settings.isDarkMode ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-teal-100" />
            )}
          </button>
          <button
            type="button"
            onClick={() => handleOpenPhotoParchi()}
            className="p-2 text-teal-100 hover:text-white hover:bg-white/10 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            title="Official Bill Receipt"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsEditCustomerOpen(true)}
            className="p-2 text-teal-100 hover:text-white hover:bg-white/10 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer"
            title="Edit Customer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsDeleteCustomerConfirmOpen(true)}
            className="p-2 text-teal-200 hover:text-rose-200 hover:bg-rose-500/20 rounded-lg text-xs cursor-pointer"
            title="Delete Customer Ledger"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-2xl mx-auto w-full">
        {/* Customer Balance Summary Card */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Account Ledger Status
            </span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-[#087C71] dark:text-teal-400">
              Rate: Rs 600/hr
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 py-4 text-center">
            <div className="px-1">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Total Charges
              </span>
              <span className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-200 tabular-nums">
                {formatPKR(summary.totalWaterCharges)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {summary.waterSessionsCount} sessions
              </span>
            </div>

            <div className="px-1 border-x border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
                Total Paid
              </span>
              <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
                {formatPKR(summary.totalPayments)}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {custPayments.length} payments
              </span>
            </div>

            <div className="px-1">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block">
                Remaining Balance
              </span>
              <span
                className={`text-base sm:text-lg font-black tabular-nums block ${
                  summary.balance > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : summary.balance < 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {formatPKR(Math.abs(summary.balance))}
              </span>
              <span
                className={`text-[10px] font-bold uppercase ${
                  summary.balance > 0
                    ? 'text-rose-600 dark:text-rose-400'
                    : summary.balance < 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-slate-500'
                }`}
              >
                {summary.balance > 0
                  ? 'Due'
                  : summary.balance < 0
                  ? 'Advance'
                  : 'Settled'}
              </span>
            </div>
          </div>

          {/* Action Buttons: Add Water Record, Add Payment, Bill Receipt, WhatsApp Share */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => {
                setWaterToEdit(null);
                setIsWaterModalOpen(true);
              }}
              className="py-2.5 px-2 bg-gradient-to-br from-[#087C71] to-teal-800 hover:from-teal-800 hover:to-teal-900 text-white rounded-2xl font-bold text-xs shadow-md shadow-teal-900/20 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Droplets className="w-4 h-4 text-teal-100 fill-teal-100/40" />
              </div>
              <span className="mt-0.5">Add Water</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setPaymentToEdit(null);
                setIsPaymentModalOpen(true);
              }}
              className="py-2.5 px-2 bg-gradient-to-br from-emerald-600 to-emerald-800 hover:from-emerald-700 hover:to-emerald-900 text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-900/20 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all group cursor-pointer"
            >
              <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <DollarSign className="w-4 h-4 text-emerald-100 stroke-[2.5]" />
              </div>
              <span className="mt-0.5">Add Payment</span>
            </button>

            <button
              type="button"
              onClick={() => handleOpenPhotoParchi()}
              className="py-2.5 px-2 bg-gradient-to-br from-teal-700 to-teal-900 hover:from-teal-800 hover:to-teal-950 text-white rounded-2xl font-bold text-xs shadow-md shadow-teal-950/20 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all group cursor-pointer"
              title="Official Bill Receipt (PNG Image)"
            >
              <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <ImageIcon className="w-4 h-4 text-emerald-100" />
              </div>
              <span className="mt-0.5">Bill Receipt</span>
            </button>

            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="py-2.5 px-2 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-900/20 flex flex-col items-center justify-center gap-1 active:scale-95 transition-all group cursor-pointer"
              title="Share Statement via WhatsApp"
            >
              <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Share2 className="w-4 h-4 text-white" />
              </div>
              <span className="mt-0.5">WhatsApp Bill</span>
            </button>
          </div>

          {onOpenStatement && (
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={() => onOpenStatement(customer.id)}
                className="text-xs text-teal-700 dark:text-teal-400 font-bold hover:underline inline-flex items-center gap-1"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                View Full Printable Invoice &amp; PDF
              </button>
            </div>
          )}
        </div>

        {/* Tab Filters */}
        <div className="flex bg-slate-200 dark:bg-slate-800 p-1 rounded-2xl gap-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeTab === 'all'
                ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            All Activity ({timelineItems.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('water')}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeTab === 'water'
                ? 'bg-white dark:bg-slate-900 text-[#087C71] dark:text-teal-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Water ({custWaters.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`flex-1 py-2 rounded-xl transition-all ${
              activeTab === 'payments'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            Payments ({custPayments.length})
          </button>
        </div>

        {/* List of Records */}
        <div className="space-y-3">
          {/* WATER TAB OR ALL TAB */}
          {activeTab === 'water' && (
            <div className="space-y-3">
              {custWaters.length === 0 ? (
                <EmptyRecordsState
                  icon={Droplets}
                  title="No water records yet"
                  desc="Tap 'Add Water' above to record an irrigation session with Start Date, 12h AM/PM times, and automatic Rs 10/min billing."
                  onAction={() => {
                    setWaterToEdit(null);
                    setIsWaterModalOpen(true);
                  }}
                  actionLabel="Add Water Record"
                />
              ) : (
                custWaters.map((record) => (
                  <WaterRecordCard
                    key={record.id}
                    record={record}
                    onEdit={() => {
                      setWaterToEdit(record);
                      setIsWaterModalOpen(true);
                    }}
                    onDelete={() => setDeleteWaterTarget(record)}
                    onShareParchi={() => handleOpenPhotoParchi(record)}
                  />
                ))
              )}
            </div>
          )}

          {/* PAYMENTS TAB */}
          {activeTab === 'payments' && (
            <div className="space-y-3">
              {custPayments.length === 0 ? (
                <EmptyRecordsState
                  icon={DollarSign}
                  title="No payments received yet"
                  desc="Tap 'Add Payment' to log cash, JazzCash, or partial payments received from this customer."
                  onAction={() => {
                    setPaymentToEdit(null);
                    setIsPaymentModalOpen(true);
                  }}
                  actionLabel="Receive Payment"
                />
              ) : (
                custPayments.map((payment) => (
                  <PaymentRecordCard
                    key={payment.id}
                    payment={payment}
                    onEdit={() => {
                      setPaymentToEdit(payment);
                      setIsPaymentModalOpen(true);
                    }}
                    onDelete={() => setDeletePaymentTarget(payment)}
                  />
                ))
              )}
            </div>
          )}

          {/* COMBINED ALL ACTIVITY TAB */}
          {activeTab === 'all' && (
            <div className="space-y-3">
              {timelineItems.length === 0 ? (
                <EmptyRecordsState
                  icon={Droplets}
                  title="Ledger is empty"
                  desc="Start by adding irrigation sessions or recording advance payments."
                  onAction={() => {
                    setWaterToEdit(null);
                    setIsWaterModalOpen(true);
                  }}
                  actionLabel="Add First Water Record"
                />
              ) : (
                timelineItems.map((item) => {
                  if (item.type === 'water') {
                    return (
                      <WaterRecordCard
                        key={item.data.id}
                        record={item.data}
                        onEdit={() => {
                          setWaterToEdit(item.data);
                          setIsWaterModalOpen(true);
                        }}
                        onDelete={() => setDeleteWaterTarget(item.data)}
                        onShareParchi={() => handleOpenPhotoParchi(item.data)}
                      />
                    );
                  } else {
                    return (
                      <PaymentRecordCard
                        key={item.data.id}
                        payment={item.data}
                        onEdit={() => {
                          setPaymentToEdit(item.data);
                          setIsPaymentModalOpen(true);
                        }}
                        onDelete={() => setDeletePaymentTarget(item.data)}
                      />
                    );
                  }
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Floating Action Button for Rapid Entry */}
      <div className="fixed bottom-20 right-4 sm:right-6 z-40 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => {
            setWaterToEdit(null);
            setIsWaterModalOpen(true);
          }}
          className="w-14 h-14 rounded-full bg-[#087C71] hover:bg-teal-800 text-white shadow-xl shadow-teal-900/30 flex items-center justify-center active:scale-95 transition-all"
          title="Add Water Record"
        >
          <Droplets className="w-7 h-7 text-white" />
        </button>
      </div>

      {/* Add / Edit Water Record Modal */}
      <AddWaterRecordModal
        isOpen={isWaterModalOpen}
        onClose={() => {
          setIsWaterModalOpen(false);
          setWaterToEdit(null);
        }}
        initialCustomerId={customer.id}
        recordToEdit={waterToEdit}
      />

      {/* Add / Edit Payment Modal */}
      <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentToEdit(null);
        }}
        customerId={customer.id}
        paymentToEdit={paymentToEdit}
      />

      {/* Edit Customer Modal */}
      <AddCustomerModal
        isOpen={isEditCustomerOpen}
        onClose={() => setIsEditCustomerOpen(false)}
        customerToEdit={customer}
      />

      {/* Confirm Delete Water Record */}
      <ConfirmModal
        isOpen={!!deleteWaterTarget}
        title="Delete Water Record?"
        message={`Are you sure you want to delete the watering record for ${deleteWaterTarget ? formatDate(deleteWaterTarget.startDate) : ''} (${deleteWaterTarget ? formatPKR(deleteWaterTarget.amount) : ''})? This will immediately reduce the customer's total water bill.`}
        confirmLabel="Yes, Delete"
        onConfirm={async () => {
          if (deleteWaterTarget) {
            await removeWaterRecord(deleteWaterTarget.id);
            setDeleteWaterTarget(null);
          }
        }}
        onCancel={() => setDeleteWaterTarget(null)}
      />

      {/* Confirm Delete Payment */}
      <ConfirmModal
        isOpen={!!deletePaymentTarget}
        title="Delete Payment Record?"
        message={`Are you sure you want to delete this payment of ${deletePaymentTarget ? formatPKR(deletePaymentTarget.amount) : ''}? Customer's balance will increase accordingly.`}
        confirmLabel="Yes, Delete"
        onConfirm={async () => {
          if (deletePaymentTarget) {
            await removePayment(deletePaymentTarget.id);
            setDeletePaymentTarget(null);
          }
        }}
        onCancel={() => setDeletePaymentTarget(null)}
      />

      {/* Confirm Delete Customer Account */}
      <ConfirmModal
        isOpen={isDeleteCustomerConfirmOpen}
        title={`Delete Ledger for ${customer.name}?`}
        message="This will permanently delete this customer along with all their watering records and payment history. This action cannot be undone."
        confirmLabel="Permanently Delete"
        onConfirm={async () => {
          await removeCustomer(customer.id);
          setIsDeleteCustomerConfirmOpen(false);
          onBack();
        }}
        onCancel={() => setIsDeleteCustomerConfirmOpen(false)}
      />

      {/* Photo Parchi Receipt Preview & WhatsApp Share Modal */}
      <ReceiptPreviewModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setReceiptSpecificWater(undefined);
        }}
        customer={customer}
        waterRecords={custWaters}
        payments={custPayments}
        settings={settings}
        billingPeriodLabel="تمام کھاتہ (Full Ledger)"
        specificRecord={receiptSpecificWater}
      />
    </div>
  );
};

// Subcomponent: Individual Water Record Card
const WaterRecordCard: React.FC<{
  record: WaterRecord;
  onEdit: () => void;
  onDelete: () => void;
  onShareParchi?: () => void;
}> = ({ record, onEdit, onDelete, onShareParchi }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-teal-500/50 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-teal-50 to-teal-100 dark:from-teal-950 dark:to-teal-900/60 border border-teal-200 dark:border-teal-800 text-[#087C71] dark:text-teal-300 flex items-center justify-center shrink-0 shadow-xs">
            <Droplets className="w-5 h-5 fill-teal-100/50" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                {formatDate(record.startDate)}
              </span>
              {record.status === 'running' || !record.endTime ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 text-[10px] font-bold rounded-full border border-amber-300 dark:border-amber-800 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  Tubewell Running
                </span>
              ) : null}
              {record.endsNextDay && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 text-[10px] font-bold rounded-full border border-amber-200/80 dark:border-amber-900">
                  <Moon className="w-2.5 h-2.5" />
                  Overnight
                </span>
              )}
              {record.gobMinutes !== undefined && record.gobMinutes > 0 && (
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                  record.gobType === 'minus'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-900'
                    : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-900'
                }`}>
                  GOB: {record.gobType === 'minus' ? '−' : '+'}{record.gobMinutes}m
                </span>
              )}
            </div>

            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 mt-1">
              {formatTime12(record.startTime)} → {record.endTime ? formatTime12(record.endTime) : 'Running (Pending End Time)'}
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium flex items-center gap-1">
              <span>Duration:</span>
              <span className={`font-bold px-2 py-0.5 rounded-md ${
                !record.endTime || record.status === 'running'
                  ? 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950'
                  : 'text-[#087C71] dark:text-teal-300 bg-teal-50 dark:bg-teal-950'
              }`}>
                {!record.endTime || record.status === 'running' ? 'Active / In Progress' : formatDuration(record.durationMinutes)}
              </span>
              {record.endTime && <span className="text-slate-400">({record.durationMinutes} min)</span>}
            </div>

            {record.notes && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic bg-slate-50 dark:bg-slate-800/40 px-2 py-0.5 rounded-lg">
                Note: {record.notes}
              </p>
            )}

            {(!record.endTime || record.status === 'running') && (
              <button
                type="button"
                onClick={onEdit}
                className="mt-2 inline-flex items-center gap-1 px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-xs cursor-pointer"
              >
                <span>Set End Time & Complete Bill</span>
              </button>
            )}
          </div>
        </div>

        <div className="text-right shrink-0 pl-2">
          <div className="text-base sm:text-lg font-black text-slate-900 dark:text-white tabular-nums">
            {!record.endTime || record.status === 'running' ? (
              <span className="text-amber-600 dark:text-amber-400 text-sm font-bold">Active</span>
            ) : (
              formatPKR(record.amount)
            )}
          </div>
          <span className="text-[10px] text-teal-700 dark:text-teal-400 font-bold block">
            @ Rs 10/min
          </span>

          <div className="flex items-center justify-end gap-1 mt-2">
            {onShareParchi && (
              <button
                type="button"
                onClick={onShareParchi}
                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
                title="اس باری کی فوٹو پرچی (Photo Slip)"
              >
                <ImageIcon className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-slate-800 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
              title="Edit Record"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs transition-all active:scale-95 cursor-pointer"
              title="Delete Record"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Subcomponent: Individual Payment Record Card
const PaymentRecordCard: React.FC<{
  payment: PaymentRecord;
  onEdit: () => void;
  onDelete: () => void;
}> = ({ payment, onEdit, onDelete }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-xs border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 transition-all">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0 shadow-xs">
            <DollarSign className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                {formatDate(payment.date)}
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold rounded-full">
                Payment Received
              </span>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
              {payment.note ? payment.note : 'Cash payment'}
            </div>
          </div>
        </div>

        <div className="text-right shrink-0 pl-2">
          <div className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
            +{formatPKR(payment.amount)}
          </div>
          <span className="text-[10px] text-slate-400 font-semibold block">
            Credits Ledger
          </span>

          <div className="flex items-center justify-end gap-1 mt-2">
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 rounded-xl text-xs transition-all active:scale-95"
              title="Edit Payment"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs transition-all active:scale-95"
              title="Delete Payment"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const EmptyRecordsState: React.FC<{
  icon: React.ElementType;
  title: string;
  desc: string;
  onAction: () => void;
  actionLabel: string;
}> = ({ icon: Icon, title, desc, onAction, actionLabel }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 text-center border border-dashed border-slate-200 dark:border-slate-800">
      <div className="w-12 h-12 mx-auto mb-3 bg-teal-50 dark:bg-teal-950/50 text-[#087C71] dark:text-teal-400 rounded-2xl flex items-center justify-center">
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mb-4 leading-relaxed">
        {desc}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="px-4 py-2 bg-[#087C71] hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-sm inline-flex items-center gap-1.5 active:scale-95 transition-all"
      >
        <Plus className="w-4 h-4" />
        {actionLabel}
      </button>
    </div>
  );
};
