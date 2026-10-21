import React, { useEffect, useState } from 'react';
import { Customer, WaterRecord, PaymentRecord, AppSettings } from '../types';
import {
  generateReceiptImageBlob,
  downloadReceiptImage,
  shareReceiptImageWhatsApp,
} from '../utils/receiptImageGenerator';
import {
  X,
  Share2,
  Download,
  Image as ImageIcon,
  CheckCircle2,
  Loader2,
  Copy,
  Phone,
} from 'lucide-react';
import { formatPKR, formatDate } from '../utils/billing';

interface ReceiptPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  waterRecords: WaterRecord[];
  payments: PaymentRecord[];
  settings: AppSettings;
  billingPeriodLabel?: string;
  specificRecord?: WaterRecord;
}

export const ReceiptPreviewModal: React.FC<ReceiptPreviewModalProps> = ({
  isOpen,
  onClose,
  customer,
  waterRecords,
  payments,
  settings,
  billingPeriodLabel,
  specificRecord,
}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);
  const [isSharing, setIsSharing] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Generate Image Blob whenever modal opens
  useEffect(() => {
    let active = true;
    let currentObjectUrl: string | null = null;

    if (isOpen) {
      setIsGenerating(true);
      setErrorMessage(null);

      generateReceiptImageBlob({
        customer,
        waterRecords,
        payments,
        settings,
        billingPeriodLabel,
        specificRecord,
      })
        .then((blob) => {
          if (!active) return;
          currentObjectUrl = URL.createObjectURL(blob);
          setImageUrl(currentObjectUrl);
          setIsGenerating(false);
        })
        .catch((err) => {
          if (!active) return;
          setIsGenerating(false);
          setErrorMessage(err instanceof Error ? err.message : 'Failed to generate receipt image');
        });
    }

    return () => {
      active = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [isOpen, customer, waterRecords, payments, settings, billingPeriodLabel, specificRecord]);

  if (!isOpen) return null;

  const totalCharges = waterRecords.reduce((sum, w) => sum + w.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = totalCharges - totalPaid;

  const handleShareWhatsApp = async () => {
    try {
      setIsSharing(true);
      await shareReceiptImageWhatsApp({
        customer,
        waterRecords,
        payments,
        settings,
        billingPeriodLabel,
        specificRecord,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to share to WhatsApp');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      await downloadReceiptImage({
        customer,
        waterRecords,
        payments,
        settings,
        billingPeriodLabel,
        specificRecord,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to download receipt');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyText = () => {
    const tubeWell = settings.tubeWellName || 'TubeWell Khata';
    const text = `🧾 *${tubeWell} - Official Bill Receipt*\n👤 Customer: ${customer.name}\n💰 Net Balance Due: ${formatPKR(remainingBalance)}\n📅 Date: ${formatDate(new Date().toISOString().split('T')[0])}\nTariff: Rs 600/hr (Rs 10/min)`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-auto flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="p-4 bg-gradient-to-r from-[#042F2E] via-[#064E3B] to-[#0F766E] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl">
              <ImageIcon className="w-5 h-5 text-teal-200" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight">
                {specificRecord ? 'Water Session Bill Slip' : 'Official Bill Receipt'}
              </h2>
              <p className="text-xs text-emerald-100 font-medium">
                {customer.name} • Net Balance: {formatPKR(remainingBalance)}
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

        {/* Modal Content - Live Image Preview */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col items-center justify-center bg-slate-100 dark:bg-slate-950/60 min-h-[300px]">
          {isGenerating ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-9 h-9 text-[#0F766E] animate-spin" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                Generating Official Bill Receipt...
              </p>
              <p className="text-xs text-slate-500">Creating high-resolution executive statement...</p>
            </div>
          ) : errorMessage ? (
            <div className="p-4 text-center text-rose-600 bg-rose-50 dark:bg-rose-950/30 rounded-2xl border border-rose-200 dark:border-rose-900">
              <p className="font-semibold text-sm">{errorMessage}</p>
            </div>
          ) : imageUrl ? (
            <div className="w-full flex flex-col items-center">
              <div className="relative group max-w-full rounded-2xl overflow-hidden shadow-lg border border-slate-200 dark:border-slate-800 bg-white">
                <img
                  src={imageUrl}
                  alt="Official Water Bill Receipt"
                  className="w-full h-auto max-h-[55vh] object-contain select-none"
                />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2 text-center">
                ✨ Official high-definition receipt ready to share or save.
              </p>
            </div>
          ) : null}
        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            {/* Primary WhatsApp Share */}
            <button
              type="button"
              onClick={handleShareWhatsApp}
              disabled={isGenerating || isSharing || !imageUrl}
              className="py-3 px-3 bg-[#25D366] hover:bg-[#20BD5A] active:scale-95 disabled:opacity-50 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
            >
              {isSharing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Share2 className="w-4 h-4" />
              )}
              <span>Share to WhatsApp</span>
            </button>

            {/* Download PNG */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isGenerating || isDownloading || !imageUrl}
              className="py-3 px-3 bg-[#0F766E] hover:bg-teal-800 active:scale-95 disabled:opacity-50 text-white rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-teal-700/20 transition-all cursor-pointer"
            >
              {isDownloading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Download Receipt</span>
            </button>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleCopyText}
              className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold flex items-center gap-1.5 p-1 cursor-pointer"
            >
              {isCopied ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-600">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Statement Summary</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold p-1 cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
