import React, { useState, useRef, useId } from 'react';
import { useKhata } from '../context/KhataContext';
import { DriveRestoreModal } from '../components/DriveRestoreModal';
import {
  Settings,
  ShieldCheck,
  Moon,
  Sun,
  Download,
  Upload,
  Lock,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Phone,
  Cloud,
  CloudUpload,
  CloudCheck,
  LogOut,
  RefreshCw,
  FolderSync,
  Trash2,
  Check,
  WifiOff,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    exportDataJSON,
    exportEncryptedBackup,
    importDataJSON,
    resetAllData,
    customers,
    waterRecords,
    payments,
    // Google Cloud Sync
    googleUser,
    isGoogleConnected,
    syncStatus,
    lastCloudSyncAt,
    syncError,
    connectGoogle,
    disconnectGoogle,
    syncLocalRecordsToCloud,
    // Google Drive Disaster Recovery
    isCloudBackingUp,
    cloudBackupStatus,
    lastCloudBackupAt,
    performCloudBackup,
    toggleAutoCloudBackup,
  } = useKhata();

  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [isDriveRestoreOpen, setIsDriveRestoreOpen] = useState(false);
  const [isSigningInGoogle, setIsSigningInGoogle] = useState(false);
  const [isMigratingLocal, setIsMigratingLocal] = useState(false);
  const [isMigrateModalOpen, setIsMigrateModalOpen] = useState(false);

  // Operator profile fields
  const [tubeWellName, setTubeWellName] = useState(settings.tubeWellName || 'Farhan TubeWell');
  const [ownerName, setOwnerName] = useState(settings.ownerName || 'Farhan');
  const [ownerPhone, setOwnerPhone] = useState(settings.ownerPhone || '');

  const tubeWellNameInputId = useId();
  const ownerNameInputId = useId();
  const ownerPhoneInputId = useId();
  const fileInputId = useId();

  // PIN Lock State
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4500);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      tubeWellName: tubeWellName.trim(),
      ownerName: ownerName.trim(),
      ownerPhone: ownerPhone.trim(),
    });
    showNotification('success', 'Profile and TubeWell information updated successfully.');
  };

  const handleGoogleSignIn = async () => {
    setIsSigningInGoogle(true);
    try {
      const res = await connectGoogle();
      if (!res) return;
      showNotification(
        'success',
        `Signed in as ${res.user.email || 'your Google account'}. Your private khata is now synced to the cloud!`
      );
    } catch (err: unknown) {
      showNotification('error', err instanceof Error ? err.message : 'Google Sign-In failed.');
    } finally {
      setIsSigningInGoogle(false);
    }
  };

  const handleLocalSyncUpload = async () => {
    setIsMigratingLocal(true);
    try {
      const res = await syncLocalRecordsToCloud();
      if (res.success && res.counts) {
        const skippedMsg = res.skippedCount ? ` (${res.skippedCount} existing cloud records preserved)` : '';
        showNotification(
          'success',
          `Synced ${res.counts.customers} customers, ${res.counts.waterRecords} water records, and ${res.counts.payments} payments to Google Cloud!${skippedMsg}`
        );
        setIsMigrateModalOpen(false);
      } else {
        showNotification('error', res.error || 'Sync failed.');
      }
    } catch (e) {
      showNotification('error', e instanceof Error ? e.message : 'Sync failed.');
    } finally {
      setIsMigratingLocal(false);
    }
  };

  const handleManualDriveBackup = async () => {
    const res = await performCloudBackup(true);
    if (res.success) {
      showNotification(
        'success',
        'Google Drive Backup Verified: Encrypted backup saved to your private Google Drive!'
      );
    } else {
      showNotification('error', res.error || 'Google Drive backup failed.');
    }
  };

  const handleBackup = async () => {
    try {
      const jsonStr = await exportDataJSON();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `tubewell-khata-backup-${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', 'Backup JSON downloaded successfully.');
    } catch {
      showNotification('error', 'Failed to generate backup file.');
    }
  };

  const handleExportEncryptedFile = async () => {
    try {
      const encStr = await exportEncryptedBackup();
      const blob = new Blob([encStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `tubewell-khata-aes256-${dateStr}.enc`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification('success', 'AES-256 Encrypted backup downloaded.');
    } catch {
      showNotification('error', 'Failed to generate encrypted file.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const result = await importDataJSON(text);

      if (result.success) {
        showNotification(
          'success',
          `Restored: ${result.count.customers} farmers, ${result.count.waterRecords} water sessions, ${result.count.payments} payments.`
        );
      } else {
        showNotification('error', result.error || 'Failed to restore backup.');
      }
    } catch {
      showNotification('error', 'Invalid backup file format.');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSavePin = async () => {
    if (pinInput.length !== 4) {
      showNotification('error', 'PIN must be exactly 4 digits.');
      return;
    }
    await updateSettings({
      pinLock: {
        enabled: true,
        pin: pinInput,
      },
    });
    setPinInput('');
    setIsPinModalOpen(false);
    showNotification('success', 'Security PIN enabled.');
  };

  const handleDisablePin = async () => {
    await updateSettings({
      pinLock: {
        enabled: false,
        pin: '',
      },
    });
    showNotification('success', 'Security PIN disabled.');
  };

  const formatLastSync = (dateIso?: string | null) => {
    if (!dateIso) return 'Not synced yet';
    try {
      const d = new Date(dateIso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString();
    } catch {
      return dateIso;
    }
  };

  const getCleanSyncError = (rawError: string | null): string => {
    if (!rawError) return 'Check connection';
    try {
      const parsed = JSON.parse(rawError);
      if (parsed.error) {
        if (typeof parsed.error === 'string' && parsed.error.includes('Missing or insufficient permissions')) {
          return 'Cloud rules updated. Tap Retry Sync.';
        }
        return String(parsed.error);
      }
    } catch {
      // not JSON
    }
    return rawError;
  };

  return (
    <div className="flex flex-col min-h-full pb-28 max-w-xl mx-auto w-full px-4 pt-3.5 space-y-4">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center gap-2 shadow-md animate-in fade-in duration-200 ${
            notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
          }`}
        >
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          <span>{notification.message}</span>
        </div>
      )}

      {/* ---------------- 1. GOOGLE CLOUD SYNC (SIMPLE & AUTOMATIC) ---------------- */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border-2 border-teal-600/30 dark:border-teal-500/20 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-1.5">
            <Cloud className="w-4 h-4 text-[#087C71]" />
            Google Cloud Sync
          </span>

          {isGoogleConnected ? (
            syncStatus === 'synced' ? (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                Synced
              </span>
            ) : syncStatus === 'syncing' ? (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5 animate-spin text-[#087C71]" />
                Syncing...
              </span>
            ) : syncStatus === 'offline' ? (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <WifiOff className="w-3 h-3" />
                Offline
              </span>
            ) : (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300">
                Sync Error
              </span>
            )
          ) : (
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
              Not Connected
            </span>
          )}
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          One Google Account = One Private TubeWell Khata. Automatically syncs all your customer accounts, water hours, and payments to the cloud. If you lose or change your phone, just sign in with the same Google account to restore everything.
        </p>

        {!isGoogleConnected ? (
          /* Sign In with Google Button */
          <div className="pt-1">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isSigningInGoogle}
              className="w-full h-11 bg-white hover:bg-slate-50 active:bg-slate-100 border border-[#747775] text-[#1f1f1f] rounded-full font-semibold text-xs flex items-center justify-center gap-3 shadow-xs hover:shadow-sm transition-all disabled:opacity-60 cursor-pointer"
            >
              <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
              </svg>
              <span>{isSigningInGoogle ? 'Signing in...' : 'Sign in with Google'}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Connected Account & Sign Out */}
            <div className="p-3 bg-teal-50/70 dark:bg-teal-950/40 rounded-2xl border border-teal-200 dark:border-teal-900 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#087C71] text-white flex items-center justify-center font-bold text-xs shrink-0">
                  {(googleUser?.email || 'G')[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {googleUser?.displayName || 'Google Account'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {googleUser?.email}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={disconnectGoogle}
                className="px-2.5 py-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg text-xs font-semibold transition-all flex items-center gap-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>

            {/* Sync Status & Last Synced */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Sync Status:</span>
                <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
                  {syncStatus === 'synced' ? (
                    <span className="text-emerald-600 dark:text-emerald-400">✓ All records synced to cloud</span>
                  ) : syncStatus === 'syncing' ? (
                    <span className="text-teal-600 dark:text-teal-400">Syncing in progress...</span>
                  ) : syncStatus === 'offline' ? (
                    <span className="text-amber-600">Offline (Local changes will sync when online)</span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <span className="text-rose-600 font-semibold">{getCleanSyncError(syncError)}</span>
                      <button
                        type="button"
                        onClick={handleLocalSyncUpload}
                        disabled={isMigratingLocal}
                        className="px-2 py-0.5 rounded-lg bg-teal-100 hover:bg-teal-200 dark:bg-teal-950 dark:hover:bg-teal-900 text-[#087C71] dark:text-teal-300 font-bold border border-teal-300 dark:border-teal-800 transition-all cursor-pointer"
                      >
                        {isMigratingLocal ? 'Syncing...' : 'Retry Sync'}
                      </button>
                    </div>
                  )}
                </span>
              </div>

              <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-700/50 pt-1">
                <span className="font-semibold text-slate-500 dark:text-slate-400">Last Successful Sync:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {formatLastSync(lastCloudSyncAt)}
                </span>
              </div>
            </div>

            {/* One-tap Upload Local Records to Cloud (Safe Migration) */}
            <button
              type="button"
              onClick={() => setIsMigrateModalOpen(true)}
              className="w-full py-2.5 px-3 bg-[#087C71] hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-98 transition-all shadow-xs"
            >
              <CloudUpload className="w-4 h-4" />
              <span>Upload Local Records to Google Cloud ({customers.length} farmers)</span>
            </button>
          </div>
        )}
      </div>

      {/* ---------------- 2. OPTIONAL GOOGLE DRIVE BACKUP (DISASTER RECOVERY) ---------------- */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <CloudCheck className="w-4 h-4 text-[#087C71]" />
            Disaster Recovery (Encrypted Google Drive Backup)
          </span>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
            Optional
          </span>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
          Provides an independent, AES-256-GCM encrypted backup file stored directly in your private Google Drive for emergency recovery.
        </p>

        {isGoogleConnected ? (
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              onClick={handleManualDriveBackup}
              disabled={isCloudBackingUp}
              className="py-2.5 px-3 bg-[#087C71] hover:bg-teal-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs disabled:opacity-50"
            >
              {isCloudBackingUp ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              <span>{isCloudBackingUp ? 'Backing up...' : 'Backup to Drive'}</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDriveRestoreOpen(true)}
              className="py-2.5 px-3 bg-teal-50 dark:bg-teal-950/70 border border-teal-200 dark:border-teal-900/60 hover:bg-teal-100 rounded-xl text-xs font-bold text-[#087C71] dark:text-teal-400 flex items-center justify-center gap-1.5 active:scale-95 transition-all"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restore from Drive</span>
            </button>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 italic">
            Sign in with Google in the section above to use Google Drive backup.
          </p>
        )}
      </div>

      {/* ---------------- 3. OFFICIAL WATER TARIFF (LOCKED) ---------------- */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-[#087C71]" />
            Official Water Rate
          </span>
          <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-950 text-[#087C71] dark:text-teal-400">
            System Locked
          </span>
        </div>

        <div className="flex items-baseline justify-between pt-1">
          <div>
            <h3 className="text-2xl font-black text-slate-900 dark:text-white">
              Rs 600 <span className="text-sm font-semibold text-slate-500">/ hour</span>
            </h3>
            <p className="text-xs font-bold text-[#087C71] dark:text-teal-400">
              Rs 10.00 per minute
            </p>
          </div>
          <div className="text-right text-[11px] text-slate-400 max-w-[150px]">
            Formula: Total Minutes × 10. Strict integer calculation.
          </div>
        </div>
      </div>

      {/* ---------------- 4. DISPLAY THEME (DARK / LIGHT MODE) ---------------- */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            {settings.isDarkMode ? <Moon className="w-4 h-4 text-teal-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
            Theme &amp; Appearance (ڈارک / لائٹ موڈ)
          </span>
          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
              settings.isDarkMode
                ? 'bg-slate-800 text-teal-300 border border-slate-700'
                : 'bg-amber-100 text-amber-800 border border-amber-200'
            }`}
          >
            {settings.isDarkMode ? '🌙 Dark Active' : '☀️ Light Active'}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Mobile ki battery bachane aur raat ke waqt aasaani ke liye Dark Mode istemal karein.
        </p>

        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={() => updateSettings({ isDarkMode: false })}
            className={`py-3 px-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer border ${
              !settings.isDarkMode
                ? 'bg-teal-50 dark:bg-teal-950/80 border-[#087C71] text-[#087C71] dark:text-teal-300 shadow-xs ring-2 ring-teal-600/20'
                : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Sun className={`w-4 h-4 ${!settings.isDarkMode ? 'text-amber-500 fill-amber-400' : 'text-slate-400'}`} />
            <span>Light Mode (دن)</span>
          </button>

          <button
            type="button"
            onClick={() => updateSettings({ isDarkMode: true })}
            className={`py-3 px-3.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer border ${
              settings.isDarkMode
                ? 'bg-teal-950 border-teal-500 text-teal-300 shadow-xs ring-2 ring-teal-500/30'
                : 'bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Moon className={`w-4 h-4 ${settings.isDarkMode ? 'text-teal-300 fill-teal-400/40' : 'text-slate-400'}`} />
            <span>Dark Mode (رات)</span>
          </button>
        </div>
      </div>

      {/* ---------------- 4. BUSINESS & TUBEWELL PROFILE ---------------- */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Settings className="w-4 h-4 text-[#087C71]" />
          TubeWell &amp; Owner Profile
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-3.5">
          <div>
            <label htmlFor={tubeWellNameInputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              TubeWell Business Name:
            </label>
            <input
              id={tubeWellNameInputId}
              type="text"
              value={tubeWellName}
              onChange={(e) => setTubeWellName(e.target.value)}
              placeholder="e.g. Farhan TubeWell"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#087C71]"
            />
          </div>

          <div>
            <label htmlFor={ownerNameInputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Owner Name (Authorized Signature / مجاز دستخط):
            </label>
            <input
              id={ownerNameInputId}
              type="text"
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              placeholder="e.g. Malik Zahid"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#087C71]"
            />
            <p className="text-[11px] text-teal-700 dark:text-teal-400 mt-1 font-medium">
              Yeh naam tamam kisan bills, WhatsApp parchi aur receipts par &quot;Authorized Signature (مجاز دستخط)&quot; ke taur par digital dastkhat ban kar aayega.
            </p>
          </div>

          <div>
            <label htmlFor={ownerPhoneInputId} className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Contact Phone (Optional):
            </label>
            <input
              id={ownerPhoneInputId}
              type="tel"
              value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)}
              placeholder="e.g. 0300-1234567"
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-[#087C71]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-[#087C71] hover:bg-teal-800 text-white rounded-xl text-xs font-bold active:scale-98 transition-all shadow-xs"
          >
            Save Profile Information
          </button>
        </form>
      </div>

      {/* ---------------- 5. OFFLINE BACKUP (EXPORT / IMPORT JSON) ---------------- */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
          <Download className="w-4 h-4 text-[#087C71]" />
          Offline File Backup &amp; Restore
        </h3>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Save an offline JSON backup file directly to your phone storage.
        </p>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleBackup}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export File</span>
          </button>

          <label
            htmlFor={fileInputId}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-center gap-1.5 cursor-pointer text-center"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import File</span>
            <input
              id={fileInputId}
              ref={fileInputRef}
              type="file"
              accept=".json,.enc"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* ---------------- 6. SECURITY PIN LOCK ---------------- */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Lock className="w-4 h-4 text-[#087C71]" />
            Security PIN Protection
          </span>
          <span
            className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
              settings.pinLock?.enabled
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
            }`}
          >
            {settings.pinLock?.enabled ? 'Active' : 'Disabled'}
          </span>
        </div>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Require a 4-digit PIN to open the app on this phone.
        </p>

        {settings.pinLock?.enabled ? (
          <button
            type="button"
            onClick={handleDisablePin}
            className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 rounded-xl text-xs font-bold"
          >
            Disable PIN Lock
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setIsPinModalOpen(true)}
            className="w-full py-2.5 px-4 bg-[#087C71] text-white rounded-xl text-xs font-bold"
          >
            Enable 4-Digit PIN Lock
          </button>
        )}
      </div>

      {/* ---------------- 7. CLEAR ALL DATA (DANGER ZONE) ---------------- */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-xs border border-rose-200 dark:border-rose-950/70 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
          <Trash2 className="w-4 h-4" />
          Clear All Device Data
        </h3>

        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Permanently clear all local farmers, watering sessions, and payment records from this device.
        </p>

        <button
          type="button"
          onClick={() => setIsResetConfirmOpen(true)}
          className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
        >
          <Trash2 className="w-4 h-4 text-rose-600" />
          <span>Clear All Data</span>
        </button>
      </div>

      {/* Drive Restore Modal */}
      <DriveRestoreModal
        isOpen={isDriveRestoreOpen}
        onClose={() => setIsDriveRestoreOpen(false)}
        onSuccess={(msg) => showNotification('success', msg)}
      />

      {/* Migration Modal */}
      {isMigrateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-3.5 text-center">
            <div className="w-12 h-12 mx-auto bg-teal-50 dark:bg-teal-950 text-[#087C71] dark:text-teal-400 rounded-2xl flex items-center justify-center">
              <CloudUpload className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Upload Local Ledger to Cloud
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Safely copy your local records to your private Google account so any other phone you log into will have the exact same records.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-1 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Customers:</span>
                <span className="font-bold text-slate-900 dark:text-white">{customers.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Water Sessions:</span>
                <span className="font-bold text-slate-900 dark:text-white">{waterRecords.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payments:</span>
                <span className="font-bold text-slate-900 dark:text-white">{payments.length}</span>
              </div>
            </div>

            <p className="text-[11px] text-teal-800 dark:text-teal-300 font-semibold bg-teal-50 dark:bg-teal-950/50 p-2 rounded-xl">
              ✓ Local records on this device are strictly preserved and never deleted.
            </p>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsMigrateModalOpen(false)}
                disabled={isMigratingLocal}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleLocalSyncUpload}
                disabled={isMigratingLocal}
                className="flex-1 py-2.5 bg-[#087C71] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {isMigratingLocal ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                <span>{isMigratingLocal ? 'Uploading...' : 'Confirm Upload'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Setup Modal */}
      {isPinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-teal-50 dark:bg-teal-950/60 text-[#087C71] rounded-2xl flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Set 4-Digit Security PIN
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Enter 4 numbers to protect your TubeWell Khata ledger.
            </p>

            <input
              type="password"
              maxLength={4}
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-36 mx-auto text-center tracking-widest text-2xl font-black px-4 py-2 bg-slate-50 dark:bg-slate-800 border-2 border-teal-600 rounded-2xl mb-4 focus:outline-none"
              autoFocus
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPinInput('');
                  setIsPinModalOpen(false);
                }}
                className="flex-1 py-2 rounded-xl border border-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePin}
                className="flex-1 py-2 bg-[#087C71] text-white rounded-xl text-xs font-bold shadow-xs"
              >
                Save PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-12 h-12 mx-auto mb-3 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              Clear All Khata Data?
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              This will wipe all customer ledgers, watering sessions, and payment records from device memory.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await resetAllData();
                  setIsResetConfirmOpen(false);
                  showNotification('success', 'Database cleared.');
                }}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
