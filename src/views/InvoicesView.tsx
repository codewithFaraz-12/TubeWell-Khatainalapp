import React, { useState, useMemo } from 'react';
import { Customer } from '../types';
import { useKhata } from '../context/KhataContext';
import {
  formatPKR,
  formatDate,
  formatTime12,
  formatDuration,
} from '../utils/billing';
import { getT } from '../utils/translations';
import { generateInvoicePDF } from '../utils/pdfGenerator';
import { ReceiptPreviewModal } from '../components/ReceiptPreviewModal';
import {
  FileText,
  Download,
  Share2,
  Printer,
  Calendar,
  CheckCircle2,
  Droplets,
  DollarSign,
  User,
  Clock,
  Sparkles,
  ChevronDown,
  Image as ImageIcon,
} from 'lucide-react';

export const InvoicesView: React.FC<{
  initialCustomerId?: string | null;
}> = ({ initialCustomerId }) => {
  const { customers, waterRecords, payments, settings } = useKhata();
  const t = getT(settings.language);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    initialCustomerId || (customers[0]?.id ?? '')
  );

  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  // Available months extracted from water records
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    waterRecords.forEach((w) => {
      if (w.startDate && w.startDate.length >= 7) {
        set.add(w.startDate.substring(0, 7)); // YYYY-MM
      }
    });
    return Array.from(set).sort().reverse();
  }, [waterRecords]);

  const activeCustomer =
    customers.find((c) => c.id === selectedCustomerId) || customers[0];

  // Filtered records for this customer and month
  const customerWaterRecords = useMemo(() => {
    if (!activeCustomer) return [];
    return waterRecords
      .filter((w) => {
        if (w.customerId !== activeCustomer.id) return false;
        if (selectedMonth !== 'all' && !w.startDate.startsWith(selectedMonth))
          return false;
        return true;
      })
      .sort(
        (a, b) =>
          new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
      );
  }, [waterRecords, activeCustomer, selectedMonth]);

  const customerPayments = useMemo(() => {
    if (!activeCustomer) return [];
    return payments
      .filter((p) => {
        if (p.customerId !== activeCustomer.id) return false;
        if (selectedMonth !== 'all' && !p.date.startsWith(selectedMonth))
          return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [payments, activeCustomer, selectedMonth]);

  // Totals
  const totalWaterMinutes = customerWaterRecords.reduce(
    (sum, w) => sum + w.durationMinutes,
    0
  );
  const totalWaterBill = customerWaterRecords.reduce(
    (sum, w) => sum + w.amount,
    0
  );
  const totalPaid = customerPayments.reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = totalWaterBill - totalPaid;

  const billingPeriodLabel =
    selectedMonth === 'all'
      ? settings.language === 'ur'
        ? 'تمام ریکارڈ (مکمل کھاتہ)'
        : 'All Time (Full Ledger)'
      : (() => {
          const [y, m] = selectedMonth.split('-');
          const d = new Date(Number(y), Number(m) - 1, 1);
          return d.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          });
        })();

  const handleDownloadPDF = async () => {
    if (!activeCustomer) return;
    try {
      setIsGeneratingPDF(true);
      const doc = generateInvoicePDF({
        customer: activeCustomer,
        waterRecords: customerWaterRecords,
        payments: customerPayments,
        settings,
        billingPeriodLabel,
      });

      const safeName = activeCustomer.name.replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `TubeWell_Invoice_${safeName}_${selectedMonth}.pdf`;
      doc.save(filename);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (e) {
      console.error('Failed to generate PDF:', e);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    if (!activeCustomer) return;
    let message = `🧾 *${settings.tubeWellName || 'Farhan TubeWell'}*\n`;
    message += `🌾 *Irrigation Bill & Statement*\n\n`;
    message += `👤 *Customer Name:* ${activeCustomer.name}\n`;
    if (activeCustomer.phone) message += `📞 *Phone:* ${activeCustomer.phone}\n`;
    message += `📅 *Billing Period:* ${billingPeriodLabel}\n`;
    message += `⏱️ *Total Duration:* ${formatDuration(totalWaterMinutes)}\n`;
    message += `💧 *Total Water Bill:* ${formatPKR(totalWaterBill)}\n`;
    message += `💵 *Amount Paid:* ${formatPKR(totalPaid)}\n`;
    message += `\n*NET BALANCE DUE:* ${
      remainingBalance > 0
        ? `${formatPKR(remainingBalance)} (Payable)`
        : remainingBalance < 0
        ? `${formatPKR(Math.abs(remainingBalance))} (Advance Credit)`
        : 'Rs 0 (Fully Settled)'
    }\n\n`;
    message += `_Date Issued: ${formatDate(
      new Date().toISOString().split('T')[0]
    )}_\n`;
    message += `_Thank you for your business!_`;

    const encoded = encodeURIComponent(message);
    if (navigator.share) {
      navigator
        .share({
          title: `Bill - ${activeCustomer.name}`,
          text: message,
        })
        .catch(() => {
          window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
        });
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }
  };

  if (customers.length === 0) {
    return (
      <div className="p-8 text-center max-w-md mx-auto my-auto">
        <FileText className="w-12 h-12 mx-auto text-slate-400 mb-2" />
        <h2 className="text-base font-bold text-slate-800 dark:text-white">
          {settings.language === 'ur'
            ? 'کوئی گاہک موجود نہیں'
            : 'No Customers Available'}
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          {settings.language === 'ur'
            ? 'ہوم سکرین پر جا کر نیا گاہک شامل کریں۔'
            : 'Add a customer on Home screen to see their bill.'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full pb-24 max-w-xl mx-auto w-full px-4 pt-3 space-y-4">
      {/* 1. Super Simple Customer & Month Picker */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-4 shadow-xs border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
          <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <User className="w-4 h-4 text-[#087C71]" />
            {settings.language === 'ur' ? 'کسان کا بل منتخب کریں' : 'Select Farmer Bill'}
          </span>
          <span className="text-[11px] font-bold text-[#087C71] dark:text-teal-400 bg-teal-50 dark:bg-teal-950 px-2 py-0.5 rounded-lg">
            Rs 600/hr
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {/* Customer Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              {settings.language === 'ur' ? 'گاہک کا نام:' : 'Customer Name:'}
            </label>
            <div className="relative">
              <select
                value={activeCustomer?.id || ''}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#087C71] appearance-none"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>
          </div>

          {/* Month Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
              {settings.language === 'ur' ? 'بل کا مہینہ / تاریخ:' : 'Billing Period:'}
            </label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full pl-3.5 pr-8 py-2.5 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-[#087C71] appearance-none"
              >
                <option value="all">
                  {settings.language === 'ur'
                    ? 'تمام تاریخیں (مکمل کھاتہ)'
                    : 'All Time (Full Ledger)'}
                </option>
                {availableMonths.map((m) => {
                  const [y, mo] = m.split('-');
                  const d = new Date(Number(y), Number(mo) - 1, 1);
                  const label = d.toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  });
                  return (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  );
                })}
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Action Buttons: WhatsApp, Photo Parchi, Download PDF, Print */}
        <div className="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={handleShareWhatsApp}
            className="py-3 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-emerald-900/15 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>{settings.language === 'ur' ? 'واٹس ایپ میسج' : 'WhatsApp'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsReceiptModalOpen(true)}
            className="py-3 px-2 bg-gradient-to-r from-teal-700 to-teal-800 hover:from-teal-800 hover:to-teal-900 text-white rounded-2xl font-bold text-xs shadow-md shadow-teal-900/15 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <ImageIcon className="w-4 h-4" />
            <span>Bill Receipt</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF}
            className="py-3 px-2 bg-[#087C71] hover:bg-teal-800 text-white rounded-2xl font-bold text-xs shadow-md shadow-teal-900/15 flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>
              {isGeneratingPDF
                ? settings.language === 'ur'
                  ? 'بن رہا ہے...'
                  : 'Preparing...'
                : settings.language === 'ur'
                ? 'پی ڈی ایف'
                : 'PDF'}
            </span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="py-3 px-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            title="Print"
          >
            <Printer className="w-4 h-4" />
            <span>پرنٹ</span>
          </button>
        </div>

        {downloadSuccess && (
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs flex items-center gap-2 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {settings.language === 'ur'
                ? 'بل کی پی ڈی ایف فائل کامیابی سے ڈاؤنلوڈ ہو گئی!'
                : 'Invoice PDF downloaded successfully!'}
            </span>
          </div>
        )}
      </div>

      {/* 2. Beautiful & Simple Digital Bill Receipt */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden print:border-none print:shadow-none">
        {/* Receipt Header Banner */}
        <div className="bg-gradient-to-r from-[#087C71] to-teal-800 text-white p-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Droplets className="w-5 h-5 text-teal-200" />
              <h2 className="text-xl font-black tracking-tight">
                {settings.tubeWellName || 'TubeWell Khata'}
              </h2>
            </div>
            <p className="text-xs text-teal-100 font-medium mt-0.5">
              {settings.ownerName ? `${settings.ownerName}` : 'Water Irrigation Ledger'}
              {settings.ownerPhone ? ` • ${settings.ownerPhone}` : ''}
            </p>
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-white/20 rounded-md text-white">
              {settings.language === 'ur' ? 'پانی کا بل' : 'INVOICE'}
            </span>
            <p className="text-xs text-teal-100 mt-1 font-medium">
              {formatDate(new Date().toISOString().split('T')[0])}
            </p>
          </div>
        </div>

        {/* Customer & Period Info Strip */}
        <div className="p-4 bg-teal-50/60 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              {settings.language === 'ur' ? 'کسان کا نام' : 'Farmer Name'}
            </span>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {activeCustomer?.name}
            </h3>
            {activeCustomer?.phone && (
              <p className="text-xs text-slate-500">{activeCustomer.phone}</p>
            )}
          </div>

          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
              {settings.language === 'ur' ? 'بل کی مدت' : 'Period'}
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {billingPeriodLabel}
            </span>
            <p className="text-[10px] text-teal-700 dark:text-teal-400 font-bold">
              Rs 10 / min
            </p>
          </div>
        </div>

        {/* Big 3-Card Summary Grid */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 dark:divide-slate-800 border-b border-slate-100 dark:border-slate-800 text-center py-4 bg-white dark:bg-slate-900">
          <div className="px-2">
            <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
              {settings.language === 'ur' ? 'کل وقت' : 'Total Time'}
            </span>
            <span className="text-base sm:text-lg font-black text-slate-800 dark:text-slate-100 tabular-nums">
              {formatDuration(totalWaterMinutes)}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {customerWaterRecords.length} {settings.language === 'ur' ? 'باریاں' : 'sessions'}
            </span>
          </div>

          <div className="px-2">
            <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
              {settings.language === 'ur' ? 'کل بل' : 'Total Charges'}
            </span>
            <span className="text-base sm:text-lg font-black text-[#087C71] dark:text-teal-400 tabular-nums">
              {formatPKR(totalWaterBill)}
            </span>
            <span className="text-[10px] text-slate-400 block">
              @ Rs 600/hr
            </span>
          </div>

          <div className="px-2">
            <span className="text-[11px] font-semibold text-slate-400 block mb-0.5">
              {settings.language === 'ur' ? 'وصول رقم' : 'Paid'}
            </span>
            <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400 tabular-nums">
              {formatPKR(totalPaid)}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {customerPayments.length} {settings.language === 'ur' ? 'ادائیگیاں' : 'payments'}
            </span>
          </div>
        </div>

        {/* Prominent Net Payable Box */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/40">
          <div
            className={`p-4 rounded-2xl border-2 flex items-center justify-between ${
              remainingBalance > 0
                ? 'bg-rose-50/80 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                : remainingBalance < 0
                ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                : 'bg-teal-50/80 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/60 text-teal-900 dark:text-teal-200'
            }`}
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider block">
                {remainingBalance > 0
                  ? settings.language === 'ur'
                    ? 'صاف بقایا رقم (واجب الادا)'
                    : 'Net Outstanding Due'
                  : remainingBalance < 0
                  ? settings.language === 'ur'
                    ? 'کسان کی ایڈوانس رقم'
                    : 'Customer Advance Credit'
                  : settings.language === 'ur'
                  ? 'کھاتہ کی حالت'
                  : 'Account Status'}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                {remainingBalance > 0
                  ? settings.language === 'ur'
                    ? 'یہ رقم کسان سے وصول طلب ہے'
                    : 'Pending payment from farmer'
                  : remainingBalance < 0
                  ? settings.language === 'ur'
                    ? 'ایڈوانس رقم کھاتے میں جمع ہے'
                    : 'Credit advance in account'
                  : settings.language === 'ur'
                  ? 'تمام بل ادا ہو چکے ہیں'
                  : 'All bills settled'}
              </p>
            </div>

            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black tabular-nums tracking-tight">
                {remainingBalance > 0
                  ? formatPKR(remainingBalance)
                  : remainingBalance < 0
                  ? formatPKR(Math.abs(remainingBalance))
                  : 'Rs 0'}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Simple Clean List of Watering Sessions (Mobile Card List instead of wide table) */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              {settings.language === 'ur' ? 'پانی کی باریوں کی تفصیل' : 'Water Sessions Detail'}
            </span>
            <span className="text-[11px] text-slate-400">
              {customerWaterRecords.length} {settings.language === 'ur' ? 'ریکارڈ' : 'records'}
            </span>
          </div>

          {customerWaterRecords.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              {settings.language === 'ur'
                ? 'اس مدت میں کوئی پانی کا ریکارڈ درج نہیں۔'
                : 'No watering sessions recorded for this period.'}
            </div>
          ) : (
            <div className="space-y-2">
              {customerWaterRecords.map((w, index) => (
                <div
                  key={w.id}
                  className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-950 text-[#087C71] dark:text-teal-300 flex items-center justify-center font-bold text-[11px]">
                      {index + 1}
                    </span>
                    <div>
                      <div className="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                        <span>{formatDate(w.startDate)}</span>
                        {w.endsNextDay && (
                          <span className="text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-1.5 py-0.2 rounded font-bold">
                            Overnight
                          </span>
                        )}
                        {w.gobMinutes !== undefined && w.gobMinutes > 0 && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            w.gobType === 'minus'
                              ? 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300'
                              : 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300'
                          }`}>
                            GOB: {w.gobType === 'minus' ? '−' : '+'}{w.gobMinutes}m
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatTime12(w.startTime)} → {formatTime12(w.endTime)} (
                        <strong className="text-slate-700 dark:text-slate-300 font-semibold">
                          {formatDuration(w.durationMinutes)}
                        </strong>
                        )
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-slate-900 dark:text-white tabular-nums">
                      {formatPKR(w.amount)}
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {w.durationMinutes} min
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 4. Simple Payments History List if any */}
        {customerPayments.length > 0 && (
          <div className="p-4 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 block">
              {settings.language === 'ur' ? 'وصول شدہ ادائیگیاں' : 'Payments Received'}
            </span>

            <div className="space-y-1.5">
              {customerPayments.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/50 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {formatDate(p.date)}
                    </span>
                  </div>
                  <span className="font-black text-emerald-700 dark:text-emerald-400 tabular-nums">
                    -{formatPKR(p.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Receipt Footer */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-100 dark:border-slate-800 text-center text-[11px] text-slate-400">
          {settings.language === 'ur'
            ? 'کمپیوٹرائزڈ کھاتہ بل — ٹیوب ویل کھاتہ'
            : 'Computerized Statement — TubeWell Khata'}
        </div>
      </div>

      {/* Photo Parchi Receipt Preview & WhatsApp Share Modal */}
      {activeCustomer && (
        <ReceiptPreviewModal
          isOpen={isReceiptModalOpen}
          onClose={() => setIsReceiptModalOpen(false)}
          customer={activeCustomer}
          waterRecords={customerWaterRecords}
          payments={customerPayments}
          settings={settings}
          billingPeriodLabel={billingPeriodLabel}
        />
      )}
    </div>
  );
};
