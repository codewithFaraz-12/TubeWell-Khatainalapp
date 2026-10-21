import React, { useState, useEffect } from 'react';
import { useKhata } from '../context/KhataContext';
import { DriveBackupFile } from '../services/driveBackup';
import {
  Cloud,
  RotateCcw,
  Trash2,
  X,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  ShieldCheck,
  FileCheck,
  Loader2,
  HardDrive,
  Users,
  Droplets,
  CreditCard,
} from 'lucide-react';

interface DriveRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const DriveRestoreModal: React.FC<DriveRestoreModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { listCloudBackups, restoreFromCloud, deleteCloudBackup, googleUser } = useKhata();

  const [backups, setBackups] = useState<DriveBackupFile[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Confirmation dialogs
  const [confirmRestoreFile, setConfirmRestoreFile] = useState<DriveBackupFile | null>(null);
  const [confirmDeleteFile, setConfirmDeleteFile] = useState<DriveBackupFile | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchBackups = async () => {
    setIsLoadingList(true);
    setError(null);
    try {
      const files = await listCloudBackups();
      setBackups(files);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch cloud backups from Google Drive');
    } finally {
      setIsLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirmRestore = async () => {
    if (!confirmRestoreFile) return;
    setIsProcessing(true);
    try {
      const result = await restoreFromCloud(confirmRestoreFile.id);
      if (result.success) {
        onSuccess(
          `Successfully restored ${result.count?.customers || 0} customers, ${result.count?.waterRecords || 0} water sessions, and ${result.count?.payments || 0} payments from Google Drive!`
        );
        setConfirmRestoreFile(null);
        onClose();
      } else {
        setError(result.error || 'Failed to restore backup.');
        setConfirmRestoreFile(null);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Restore error');
      setConfirmRestoreFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDeleteFile) return;
    setIsProcessing(true);
    try {
      await deleteCloudBackup(confirmDeleteFile.id);
      setBackups((prev) => prev.filter((b) => b.id !== confirmDeleteFile.id));
      setConfirmDeleteFile(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup from Google Drive');
      setConfirmDeleteFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatFileSize = (bytesStr?: string) => {
    const bytes = Number(bytesStr || 0);
    if (!bytes) return '< 1 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const formatDateTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 bg-[#087C71] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold leading-tight">
                Google Drive Backups
              </h3>
              <p className="text-[11px] text-teal-100 flex items-center gap-1">
                <span>Account:</span>
                <span className="font-semibold">{googleUser?.email || 'Connected'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 text-rose-700 dark:text-rose-300 rounded-2xl text-xs font-medium flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-1">
            <span className="font-semibold">
              Available Cloud Versions ({backups.length})
            </span>
            <button
              type="button"
              onClick={fetchBackups}
              disabled={isLoadingList}
              className="text-[#087C71] dark:text-teal-400 font-bold hover:underline flex items-center gap-1 disabled:opacity-50"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isLoadingList ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoadingList ? (
            <div className="p-12 text-center text-xs text-slate-500 space-y-2">
              <Loader2 className="w-6 h-6 border-[#087C71] text-[#087C71] animate-spin mx-auto" />
              <p>Fetching encrypted versions from your Google Drive...</p>
            </div>
          ) : backups.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 space-y-2">
              <HardDrive className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                No Cloud Backups Found in Google Drive
              </p>
              <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                Tap &ldquo;Backup Now&rdquo; in settings to upload your first encrypted snapshot.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {backups.map((b, index) => {
                const isLatest = index === 0;
                const custCount = b.properties?.customerCount;
                const waterCount = b.properties?.waterRecordCount;
                const payCount = b.properties?.paymentCount;

                return (
                  <div
                    key={b.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isLatest
                        ? 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-200 dark:border-teal-800'
                        : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {formatDateTime(b.createdTime)}
                          </span>
                          {isLatest && (
                            <span className="px-2 py-0.2 bg-[#087C71] text-white rounded-full text-[9px] font-bold tracking-wider uppercase">
                              Latest
                            </span>
                          )}
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded font-bold flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3" />
                            Verified
                          </span>
                        </div>

                        {/* Counts badges */}
                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-slate-600 dark:text-slate-300">
                          {custCount !== undefined && (
                            <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-semibold">
                              <Users className="w-3 h-3 text-[#087C71]" />
                              {custCount} Customers
                            </span>
                          )}
                          {waterCount !== undefined && (
                            <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-semibold">
                              <Droplets className="w-3 h-3 text-[#087C71]" />
                              {waterCount} Sessions
                            </span>
                          )}
                          {payCount !== undefined && (
                            <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md font-semibold">
                              <CreditCard className="w-3 h-3 text-emerald-600" />
                              {payCount} Payments
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400">
                            Size: {formatFileSize(b.size)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setConfirmRestoreFile(b)}
                          className="px-3 py-1.5 bg-[#087C71] hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition-all shadow-xs"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteFile(b)}
                          title="Delete snapshot from Drive"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            Close
          </button>
        </div>

        {/* Explicit Confirmation Dialog for Restore (Destructive Overwrite) */}
        {confirmRestoreFile && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 mx-auto bg-teal-50 dark:bg-teal-950 text-[#087C71] rounded-2xl flex items-center justify-center">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Restore Khata From Google Drive?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This will download and decrypt the backup from{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {formatDateTime(confirmRestoreFile.createdTime)}
                </strong>
                . Current device records will be replaced with this cloud snapshot.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setConfirmRestoreFile(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmRestore}
                  className="flex-1 py-2.5 bg-[#087C71] hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Restore</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Explicit Confirmation Dialog for Deleting Backup from Drive */}
        {confirmDeleteFile && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 text-center space-y-3">
              <div className="w-12 h-12 mx-auto bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                Delete Google Drive Backup?
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to permanently delete this backup snapshot from{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {formatDateTime(confirmDeleteFile.createdTime)}
                </strong>{' '}
                from your Google Drive? This cannot be undone.
              </p>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setConfirmDeleteFile(null)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleConfirmDelete}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                >
                  {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Delete File</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
