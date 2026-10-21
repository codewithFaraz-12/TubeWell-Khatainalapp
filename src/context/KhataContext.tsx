import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { User } from 'firebase/auth';
import {
  Customer,
  WaterRecord,
  PaymentRecord,
  AppSettings,
  CustomerBalanceSummary,
  SyncStatus,
  TodaySummary,
} from '../types';
import * as dbService from '../services/db';
import {
  initAuth,
  googleSignIn,
  logout as authLogout,
  getAccessToken,
  getCurrentUser,
  requestDriveToken,
  auth,
} from '../services/auth';
import {
  uploadBackupToDrive,
  listBackupsFromDrive,
  downloadBackupFromDrive,
  deleteBackupFromDrive,
  DriveBackupFile,
} from '../services/driveBackup';
import { encryptBackup, decryptBackup, buildRecoverySeed } from '../utils/crypto';
import {
  subscribeToUserCustomers,
  subscribeToUserWaterRecords,
  subscribeToUserPayments,
  subscribeToUserSettings,
  cloudSaveCustomer,
  cloudDeleteCustomer,
  cloudSaveWaterRecord,
  cloudDeleteWaterRecord,
  cloudSavePayment,
  cloudDeletePayment,
  cloudSaveSettings,
  migrateLocalRecordsToUserCloud,
  testFirestoreConnection,
} from '../services/firestoreSync';

interface KhataContextType {
  customers: Customer[];
  waterRecords: WaterRecord[];
  payments: PaymentRecord[];
  settings: AppSettings;
  isLoading: boolean;
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
  selectedCustomer: Customer | null;
  customerSummaries: Record<string, CustomerBalanceSummary>;
  totalPreviousDues: number;
  totalCollectedPayments: number;
  totalWaterCharges: number;
  totalPumpMinutes: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filteredCustomers: Customer[];

  // CRUD actions
  addCustomer: (data: { name: string; phone?: string; village?: string }) => Promise<Customer>;
  editCustomer: (customer: Customer) => Promise<void>;
  removeCustomer: (id: string) => Promise<void>;

  addWaterRecord: (record: Omit<WaterRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<WaterRecord>;
  editWaterRecord: (record: WaterRecord) => Promise<void>;
  removeWaterRecord: (id: string) => Promise<void>;

  addPayment: (payment: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PaymentRecord>;
  editPayment: (payment: PaymentRecord) => Promise<void>;
  removePayment: (id: string) => Promise<void>;

  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  loadSampleData: () => Promise<void>;
  resetAllData: () => Promise<void>;
  exportDataJSON: () => Promise<string>;
  exportEncryptedBackup: () => Promise<string>;
  importDataJSON: (jsonStr: string) => Promise<{ success: boolean; count: { customers: number; waterRecords: number; payments: number }; error?: string }>;
  refreshData: () => Promise<void>;

  // Google Cloud Sync (Single Google Account = Single Private Khata)
  googleUser: User | null;
  isGoogleConnected: boolean;
  syncStatus: SyncStatus;
  lastCloudSyncAt: string | null;
  syncError: string | null;
  isOffline: boolean;
  connectGoogle: () => Promise<{ user: User; accessToken: string } | null>;
  disconnectGoogle: () => Promise<void>;
  syncLocalRecordsToCloud: () => Promise<{
    success: boolean;
    counts?: { customers: number; waterRecords: number; payments: number };
    skippedCount?: number;
    error?: string;
  }>;
  isMigrationPromptOpen: boolean;
  setIsMigrationPromptOpen: (open: boolean) => void;
  confirmMigration: () => Promise<{ success: boolean; counts?: { customers: number; waterRecords: number; payments: number }; error?: string }>;
  cancelMigration: () => void;

  // Today Summary Dashboard
  todaySummary: TodaySummary;

  // Google Drive Disaster Recovery (Optional)
  isCloudBackingUp: boolean;
  cloudBackupStatus: 'idle' | 'backing-up' | 'verified' | 'error';
  lastCloudBackupAt: string | null;
  cloudBackupError: string | null;
  performCloudBackup: (isManual?: boolean) => Promise<{ success: boolean; error?: string; fileId?: string }>;
  restoreFromCloud: (fileId: string, mode?: 'safe-merge' | 'replace') => Promise<{ success: boolean; count?: { customers: number; waterRecords: number; payments: number }; newerPreservedCount?: number; error?: string }>;
  listCloudBackups: () => Promise<DriveBackupFile[]>;
  deleteCloudBackup: (fileId: string) => Promise<void>;
  toggleAutoCloudBackup: (enabled: boolean) => Promise<void>;
}

const KhataContext = createContext<KhataContextType | undefined>(undefined);

export const KhataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [waterRecords, setWaterRecords] = useState<WaterRecord[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => {
    let initialDark = false;
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('tubewell_dark_mode');
        if (stored !== null) {
          initialDark = stored === 'true';
        } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
          initialDark = true;
        }
      }
    } catch {}
    return {
      ...dbService.DEFAULT_SETTINGS,
      isDarkMode: initialDark,
    };
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Google Auth & Cloud Sync State
  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('offline');
  const [lastCloudSyncAt, setLastCloudSyncAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [isMigrationPromptOpen, setIsMigrationPromptOpen] = useState<boolean>(false);

  // Google Drive Backup State
  const [isCloudBackingUp, setIsCloudBackingUp] = useState<boolean>(false);
  const [cloudBackupStatus, setCloudBackupStatus] = useState<'idle' | 'backing-up' | 'verified' | 'error'>('idle');
  const [lastCloudBackupAt, setLastCloudBackupAt] = useState<string | null>(null);
  const [cloudBackupError, setCloudBackupError] = useState<string | null>(null);

  const autoBackupTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isSyncingRef = useRef<boolean>(false);

  // Network connection listener
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setSyncStatus((prev) => (prev === 'offline' ? 'synced' : prev));
    };
    const handleOffline = () => {
      setIsOffline(true);
      setSyncStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setIsOffline(true);
      setSyncStatus('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Initial load from local device database
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      let custs = await dbService.getAllCustomers();
      let waters = await dbService.getAllWaterRecords();
      let pays = await dbService.getAllPayments();
      const loadedSettings = await dbService.getSettings();

      // Clean leftover sample records if any
      const hasSampleData =
        custs.some((c) => c.id.startsWith('cust_sample_')) ||
        waters.some((w) => w.id.startsWith('rec_sample_')) ||
        pays.some((p) => p.id.startsWith('pay_sample_'));

      if (hasSampleData) {
        custs = custs.filter((c) => !c.id.startsWith('cust_sample_'));
        waters = waters.filter((w) => !w.id.startsWith('rec_sample_'));
        pays = pays.filter((p) => !p.id.startsWith('pay_sample_'));
        await dbService.clearAllData();
        for (const c of custs) await dbService.saveCustomer(c);
        for (const w of waters) await dbService.saveWaterRecord(w);
        for (const p of pays) await dbService.savePayment(p);
      }

      setCustomers(custs);
      setWaterRecords(waters);
      try {
        const stored = localStorage.getItem('tubewell_dark_mode');
        if (stored !== null) {
          loadedSettings.isDarkMode = stored === 'true';
        }
      } catch {}
      setSettings(loadedSettings);

      if (loadedSettings.cloudBackup?.lastBackupAt) {
        setLastCloudBackupAt(loadedSettings.cloudBackup.lastBackupAt);
        if (loadedSettings.cloudBackup.isVerified) {
          setCloudBackupStatus('verified');
        }
      }
      if (loadedSettings.lastCloudSyncAt) {
        setLastCloudSyncAt(loadedSettings.lastCloudSyncAt);
      }
    } catch (err) {
      console.error('Failed to load local Khata data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    testFirestoreConnection();
  }, [loadData]);

  // Auth state listener
  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        if (navigator.onLine) setSyncStatus('synced');
      },
      () => {
        setGoogleUser(null);
        setSyncStatus(navigator.onLine ? 'synced' : 'offline');
      }
    );
    return () => {
      unsubscribe();
    };
  }, []);

  // Dark mode
  useEffect(() => {
    const isDark = Boolean(settings.isDarkMode);
    if (isDark) {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
    }
    try {
      localStorage.setItem('tubewell_dark_mode', isDark ? 'true' : 'false');
    } catch {}

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#022c22' : '#087C71');
    }
  }, [settings.isDarkMode]);

  // ---------------- USER-ISOLATED AUTOMATIC FIRESTORE SYNCHRONIZATION ----------------
  // ONE GOOGLE ACCOUNT = ONE PRIVATE TUBEWELL KHATA
  useEffect(() => {
    if (!googleUser || !googleUser.uid) {
      return;
    }

    // Guard: Only subscribe when Firebase Auth is ready and authenticated
    if (!auth.currentUser || auth.currentUser.uid !== googleUser.uid) {
      return;
    }

    const uid = googleUser.uid;
    setSyncStatus('syncing');

    let unsubCustomers: (() => void) | undefined;
    let unsubWater: (() => void) | undefined;
    let unsubPayments: (() => void) | undefined;
    let unsubSettings: (() => void) | undefined;

    try {
      // 1. Private Customers (Safe Merge with Timestamp Conflict Resolution - NEVER deletes local records)
      unsubCustomers = subscribeToUserCustomers(
        uid,
        (cloudCustomers) => {
          setCustomers((prev) => {
            const map = new Map<string, Customer>();
            // Keep all local customers intact
            prev.forEach((loc) => map.set(loc.id, loc));
            // Merge cloud customers safely
            cloudCustomers.forEach((cloudItem) => {
              const existing = map.get(cloudItem.id);
              if (!existing) {
                map.set(cloudItem.id, cloudItem);
                dbService.saveCustomer(cloudItem).catch(() => {});
              } else {
                // Conflict resolution: compare updatedAt timestamps
                const cloudTime = new Date(cloudItem.updatedAt || 0).getTime();
                const localTime = new Date(existing.updatedAt || 0).getTime();
                if (cloudTime >= localTime) {
                  map.set(cloudItem.id, cloudItem);
                  dbService.saveCustomer(cloudItem).catch(() => {});
                }
              }
            });
            return Array.from(map.values());
          });

          const nowIso = new Date().toISOString();
          setLastCloudSyncAt(nowIso);
          setSyncStatus('synced');
          setSyncError(null);
        },
        (err) => {
          console.warn('Customer cloud sync warning:', err);
          setSyncStatus(navigator.onLine ? 'error' : 'offline');
          setSyncError(err.message);
        }
      );

      // 2. Private Water Records (Safe Merge - NEVER deletes local records)
      unsubWater = subscribeToUserWaterRecords(
        uid,
        (cloudWater) => {
          setWaterRecords((prev) => {
            const map = new Map<string, WaterRecord>();
            prev.forEach((loc) => map.set(loc.id, loc));
            cloudWater.forEach((cloudItem) => {
              const existing = map.get(cloudItem.id);
              if (!existing) {
                map.set(cloudItem.id, cloudItem);
                dbService.saveWaterRecord(cloudItem).catch(() => {});
              } else {
                const cloudTime = new Date(cloudItem.updatedAt || 0).getTime();
                const localTime = new Date(existing.updatedAt || 0).getTime();
                if (cloudTime >= localTime) {
                  map.set(cloudItem.id, cloudItem);
                  dbService.saveWaterRecord(cloudItem).catch(() => {});
                }
              }
            });
            return Array.from(map.values());
          });

          const nowIso = new Date().toISOString();
          setLastCloudSyncAt(nowIso);
          setSyncStatus('synced');
        },
        (err) => {
          console.warn('Water cloud sync warning:', err);
          setSyncStatus(navigator.onLine ? 'error' : 'offline');
        }
      );

      // 3. Private Payments (Safe Merge - NEVER deletes local records)
      unsubPayments = subscribeToUserPayments(
        uid,
        (cloudPayments) => {
          setPayments((prev) => {
            const map = new Map<string, PaymentRecord>();
            prev.forEach((loc) => map.set(loc.id, loc));
            cloudPayments.forEach((cloudItem) => {
              const existing = map.get(cloudItem.id);
              if (!existing) {
                map.set(cloudItem.id, cloudItem);
                dbService.savePayment(cloudItem).catch(() => {});
              } else {
                const cloudTime = new Date(cloudItem.updatedAt || 0).getTime();
                const localTime = new Date(existing.updatedAt || 0).getTime();
                if (cloudTime >= localTime) {
                  map.set(cloudItem.id, cloudItem);
                  dbService.savePayment(cloudItem).catch(() => {});
                }
              }
            });
            return Array.from(map.values());
          });

          const nowIso = new Date().toISOString();
          setLastCloudSyncAt(nowIso);
          setSyncStatus('synced');
        },
        (err) => {
          console.warn('Payment cloud sync warning:', err);
          setSyncStatus(navigator.onLine ? 'error' : 'offline');
        }
      );

      // 4. Private Settings
      unsubSettings = subscribeToUserSettings(
        uid,
        (cloudSettings) => {
          if (cloudSettings) {
            setSettings((prev) => {
              const updated = { ...prev, ...cloudSettings };
              dbService.saveSettings(updated).catch(() => {});
              return updated;
            });
          }
        },
        (err) => {
          console.warn('Settings cloud sync warning:', err);
        }
      );
    } catch (e) {
      console.warn('Firestore subscription failed:', e);
      setSyncStatus(navigator.onLine ? 'error' : 'offline');
    }

    return () => {
      unsubCustomers?.();
      unsubWater?.();
      unsubPayments?.();
      unsubSettings?.();
    };
  }, [googleUser]);

  // ---------------- TODAY'S LIVE SUMMARY ----------------
  const todaySummary: TodaySummary = useMemo(() => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const todayStr = `${yyyy}-${mm}-${dd}`;

    const custMap = new Map(customers.map((c) => [c.id, c.name]));

    const todayWaters = waterRecords.filter((w) => w.startDate === todayStr);
    const todayPayments = payments.filter((p) => p.date === todayStr);

    const totalMinutes = todayWaters.reduce((acc, w) => acc + w.durationMinutes, 0);
    const totalWaterCharges = todayWaters.reduce((acc, w) => acc + w.amount, 0);
    const totalPaymentsAmt = todayPayments.reduce((acc, p) => acc + p.amount, 0);

    const activeCustNamesSet = new Set<string>();
    todayWaters.forEach((w) => {
      const name = custMap.get(w.customerId);
      if (name) activeCustNamesSet.add(name);
    });

    const recentActivities: TodaySummary['recentActivities'] = [];

    todayWaters.forEach((w) => {
      const cName = custMap.get(w.customerId) || 'Customer';
      recentActivities.push({
        id: `act_${w.id}`,
        time: `${w.startTime.hour}:${String(w.startTime.minute).padStart(2, '0')} ${w.startTime.period}`,
        text: `${cName} • ${w.durationMinutes}m water (${w.amount} Rs)`,
        type: 'water',
      });
    });

    todayPayments.forEach((p) => {
      const cName = custMap.get(p.customerId) || 'Customer';
      recentActivities.push({
        id: `act_${p.id}`,
        time: p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Today',
        text: `${cName} • Paid ${p.amount} Rs`,
        type: 'payment',
      });
    });

    return {
      todayDate: todayStr,
      totalMinutes,
      totalWaterCharges,
      totalPayments: totalPaymentsAmt,
      activeCustomerNames: Array.from(activeCustNamesSet),
      recordsCount: todayWaters.length,
      paymentsCount: todayPayments.length,
      recentActivities,
    };
  }, [customers, waterRecords, payments]);

  // ---------------- GOOGLE SIGN IN & OUT ----------------
  const connectGoogle = async () => {
    const result = await googleSignIn();
    if (!result) return null;
    setGoogleUser(result.user);
    setSyncStatus('syncing');

    // Safe migration check: prompt user before uploading existing local records
    if (result.user.uid) {
      try {
        const currentCustomers = await dbService.getAllCustomers();
        const currentWaters = await dbService.getAllWaterRecords();
        const currentPayments = await dbService.getAllPayments();

        const nonSampleCusts = currentCustomers.filter((c) => !c.id.startsWith('cust_sample_'));
        const nonSampleWater = currentWaters.filter((w) => !w.id.startsWith('rec_sample_'));
        const nonSamplePays = currentPayments.filter((p) => !p.id.startsWith('pay_sample_'));

        if (nonSampleCusts.length > 0 || nonSampleWater.length > 0 || nonSamplePays.length > 0) {
          // Require explicit user confirmation before migrating local records to cloud
          setIsMigrationPromptOpen(true);
        } else {
          const nowIso = new Date().toISOString();
          setLastCloudSyncAt(nowIso);
          setSyncStatus('synced');
        }
      } catch (e) {
        console.warn('Initial cloud sync check:', e);
      }
    }

    return result;
  };

  const confirmMigration = async () => {
    setIsMigrationPromptOpen(false);
    return await syncLocalRecordsToCloud();
  };

  const cancelMigration = () => {
    setIsMigrationPromptOpen(false);
    setSyncStatus('synced');
  };

  const disconnectGoogle = async () => {
    await authLogout();
    setGoogleUser(null);
    setSyncStatus(navigator.onLine ? 'synced' : 'offline');
  };

  // Safe manual upload of local records to Google Cloud
  const syncLocalRecordsToCloud = async () => {
    if (!googleUser || !googleUser.uid) {
      return { success: false, error: 'Sign in with Google required before cloud synchronization.' };
    }
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const res = await migrateLocalRecordsToUserCloud(
        googleUser.uid,
        customers,
        waterRecords,
        payments,
        settings
      );
      if (res.success) {
        const nowIso = new Date().toISOString();
        setLastCloudSyncAt(nowIso);
        setSyncStatus('synced');
        setSyncError(null);
        await updateSettings({ lastCloudSyncAt: nowIso });
      } else {
        setSyncStatus('error');
        setSyncError(res.error || 'Cloud synchronization failed');
      }
      return res;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSyncStatus('error');
      setSyncError(msg);
      return { success: false, error: msg };
    }
  };

  // ---------------- OPTIONAL GOOGLE DRIVE BACKUP (DISASTER RECOVERY) ----------------
  const performCloudBackup = useCallback(
    async (isManual: boolean = false): Promise<{ success: boolean; error?: string; fileId?: string }> => {
      let token = await getAccessToken();
      const user = googleUser || getCurrentUser();

      if (!user) {
        if (isManual) {
          return { success: false, error: 'Google Account is not connected. Please Sign in with Google first.' };
        }
        return { success: false, error: 'Not authenticated' };
      }

      if (!token) {
        try {
          token = await requestDriveToken();
        } catch (tokenErr: unknown) {
          const msg = tokenErr instanceof Error ? tokenErr.message : String(tokenErr);
          return { success: false, error: msg };
        }
      }

      if (isSyncingRef.current) {
        return { success: false, error: 'Backup already in progress.' };
      }

      isSyncingRef.current = true;
      setIsCloudBackingUp(true);
      setCloudBackupStatus('backing-up');
      setCloudBackupError(null);

      try {
        const [currentCustomers, currentWaters, currentPayments, currentSettings] = await Promise.all([
          dbService.getAllCustomers(),
          dbService.getAllWaterRecords(),
          dbService.getAllPayments(),
          dbService.getSettings(),
        ]);

        const payload: dbService.BackupPayload = {
          version: 1,
          appName: 'TubeWell Khata',
          exportedAt: new Date().toISOString(),
          customers: currentCustomers,
          waterRecords: currentWaters,
          payments: currentPayments,
          settings: currentSettings,
        };

        const keySeed = buildRecoverySeed(
          currentSettings.pinLock?.pin || '',
          user.email || '',
          user.uid
        );
        const envelope = await encryptBackup(payload, keySeed, user.email || undefined);
        const encryptedJsonString = JSON.stringify(envelope, null, 2);

        const timestampIso = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `tubewell_khata_backup_${timestampIso}.json.enc`;

        const result = await uploadBackupToDrive(token, encryptedJsonString, fileName, {
          customerCount: String(currentCustomers.length),
          waterRecordCount: String(currentWaters.length),
          paymentCount: String(currentPayments.length),
          exportedAt: payload.exportedAt,
          userUid: user.uid,
          userEmail: user.email || '',
        });

        const nowIso = new Date().toISOString();
        setLastCloudBackupAt(nowIso);
        setCloudBackupStatus('verified');
        setCloudBackupError(null);

        const updatedSettings: AppSettings = {
          ...currentSettings,
          cloudBackup: {
            ...currentSettings.cloudBackup,
            lastBackupAt: nowIso,
            lastBackupFileId: result.file.id,
            isVerified: true,
            userEmail: user.email || '',
            autoBackupEnabled: currentSettings.cloudBackup?.autoBackupEnabled !== false,
            status: 'verified',
          },
        };
        await dbService.saveSettings(updatedSettings);
        setSettings(updatedSettings);

        return { success: true, fileId: result.file.id };
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Google Drive backup failed';
        console.error('Cloud backup error:', err);
        setCloudBackupStatus('error');
        setCloudBackupError(errorMsg);
        return { success: false, error: errorMsg };
      } finally {
        setIsCloudBackingUp(false);
        isSyncingRef.current = false;
      }
    },
    [googleUser]
  );

  const toggleAutoCloudBackup = async (enabled: boolean) => {
    const updated: AppSettings = {
      ...settings,
      cloudBackup: {
        ...settings.cloudBackup,
        autoBackupEnabled: enabled,
      },
    };
    await dbService.saveSettings(updated);
    setSettings(updated);
  };

  const listCloudBackups = async (): Promise<DriveBackupFile[]> => {
    let token = await getAccessToken();
    if (!token) {
      token = await requestDriveToken();
    }
    return await listBackupsFromDrive(token);
  };

  const deleteCloudBackup = async (fileId: string): Promise<void> => {
    let token = await getAccessToken();
    if (!token) {
      token = await requestDriveToken();
    }
    await deleteBackupFromDrive(token, fileId);
  };

  const restoreFromCloud = async (
    fileId: string,
    mode: 'safe-merge' | 'replace' = 'safe-merge'
  ): Promise<{
    success: boolean;
    count?: { customers: number; waterRecords: number; payments: number };
    newerPreservedCount?: number;
    error?: string;
  }> => {
    let token = await getAccessToken();
    if (!token) {
      token = await requestDriveToken();
    }
    const user = googleUser || getCurrentUser();
    if (!token || !user) {
      return { success: false, error: 'Google Drive is not connected.' };
    }

    try {
      setIsLoading(true);
      const rawContent = await downloadBackupFromDrive(token, fileId);

      const primarySeed = buildRecoverySeed(
        settings.pinLock?.pin || '',
        user.email || '',
        user.uid
      );

      const fallbackSeeds = [
        buildRecoverySeed('', user.email || '', user.uid),
        buildRecoverySeed('0000', user.email || '', user.uid),
        user.uid,
        user.email || '',
        (user.email || '').toLowerCase().trim(),
        'tubewell_khata_device_key',
      ];

      const payload = await decryptBackup(rawContent, primarySeed, fallbackSeeds);

      const res = await dbService.importBackup(JSON.stringify(payload), mode);
      if (res.success) {
        await loadData();
      }
      return res;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to restore backup from Google Drive';
      return { success: false, error: errorMsg };
    } finally {
      setIsLoading(false);
    }
  };

  const exportEncryptedBackup = async (): Promise<string> => {
    const user = googleUser || getCurrentUser();
    const keySeed = user
      ? buildRecoverySeed(settings.pinLock?.pin || '', user.email || '', user.uid)
      : 'tubewell_khata_device_key';
    const jsonStr = await dbService.exportBackup();
    const payload = JSON.parse(jsonStr) as dbService.BackupPayload;
    const envelope = await encryptBackup(payload, keySeed, user?.email || undefined);
    return JSON.stringify(envelope, null, 2);
  };

  // ---------------- CALCULATIONS & BALANCES ----------------
  const customerSummaries = useMemo(() => {
    const map: Record<string, CustomerBalanceSummary> = {};

    customers.forEach((cust) => {
      const custWaters = waterRecords.filter((w) => w.customerId === cust.id);
      const custPayments = payments.filter((p) => p.customerId === cust.id);

      const totalWaterCharges = custWaters.reduce((sum, w) => sum + w.amount, 0);
      const totalPayments = custPayments.reduce((sum, p) => sum + p.amount, 0);
      const totalWaterMinutes = custWaters.reduce((sum, w) => sum + w.durationMinutes, 0);
      const balance = totalWaterCharges - totalPayments;

      const allDates = [
        ...custWaters.map((w) => w.startDate),
        ...custPayments.map((p) => p.date),
      ].sort();
      const lastActivityDate = allDates.length > 0 ? allDates[allDates.length - 1] : undefined;

      map[cust.id] = {
        customer: cust,
        totalWaterCharges,
        totalPayments,
        balance,
        waterSessionsCount: custWaters.length,
        totalWaterMinutes,
        lastActivityDate,
      };
    });

    return map;
  }, [customers, waterRecords, payments]);

  const totalPreviousDues = useMemo(() => {
    return Object.values(customerSummaries).reduce((acc, curr) => {
      return curr.balance > 0 ? acc + curr.balance : acc;
    }, 0);
  }, [customerSummaries]);

  const totalCollectedPayments = useMemo(() => {
    return payments.reduce((acc, p) => acc + p.amount, 0);
  }, [payments]);

  const totalWaterCharges = useMemo(() => {
    return waterRecords.reduce((acc, w) => acc + w.amount, 0);
  }, [waterRecords]);

  const totalPumpMinutes = useMemo(() => {
    return waterRecords.reduce((acc, w) => acc + w.durationMinutes, 0);
  }, [waterRecords]);

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.village && c.village.toLowerCase().includes(q))
    );
  }, [customers, searchQuery]);

  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // ---------------- CRUD ACTIONS (LOCAL DUAL-WRITE + AUTOMATIC CLOUD SYNC) ----------------
  const addCustomer = async (data: { name: string; phone?: string; village?: string }): Promise<Customer> => {
    const trimmedName = data.name.trim();
    if (!trimmedName) throw new Error('Customer name cannot be blank.');

    const newCustomer: Customer = {
      id: `cust_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: trimmedName,
      phone: data.phone?.trim() || undefined,
      village: data.village?.trim() || undefined,
      hourlyRate: 600, // Fixed
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Immediate local write (100% offline-ready, instant UI)
    await dbService.saveCustomer(newCustomer);
    setCustomers((prev) => [newCustomer, ...prev]);

    // 2. Automatic Cloud Sync if logged in
    if (googleUser && googleUser.uid) {
      cloudSaveCustomer(googleUser.uid, newCustomer).catch((err) =>
        console.warn('Background customer cloud save error:', err)
      );
    }

    return newCustomer;
  };

  const editCustomer = async (customer: Customer): Promise<void> => {
    const trimmedName = customer.name.trim();
    if (!trimmedName) throw new Error('Customer name cannot be blank.');

    const updated: Customer = {
      ...customer,
      name: trimmedName,
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveCustomer(updated);
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));

    if (googleUser && googleUser.uid) {
      cloudSaveCustomer(googleUser.uid, updated).catch((err) =>
        console.warn('Background customer cloud edit error:', err)
      );
    }
  };

  const removeCustomer = async (id: string): Promise<void> => {
    await dbService.deleteCustomer(id);
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setWaterRecords((prev) => prev.filter((w) => w.customerId !== id));
    setPayments((prev) => prev.filter((p) => p.customerId !== id));
    if (selectedCustomerId === id) setSelectedCustomerId(null);

    if (googleUser && googleUser.uid) {
      cloudDeleteCustomer(googleUser.uid, id).catch((err) =>
        console.warn('Background customer cloud delete error:', err)
      );
    }
  };

  const addWaterRecord = async (
    record: Omit<WaterRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<WaterRecord> => {
    const newRecord: WaterRecord = {
      ...record,
      id: `wrec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveWaterRecord(newRecord);
    setWaterRecords((prev) => [newRecord, ...prev]);

    if (googleUser && googleUser.uid) {
      cloudSaveWaterRecord(googleUser.uid, newRecord).catch((err) =>
        console.warn('Background water cloud save error:', err)
      );
    }

    return newRecord;
  };

  const editWaterRecord = async (record: WaterRecord): Promise<void> => {
    const updated: WaterRecord = {
      ...record,
      updatedAt: new Date().toISOString(),
    };

    await dbService.saveWaterRecord(updated);
    setWaterRecords((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));

    if (googleUser && googleUser.uid) {
      cloudSaveWaterRecord(googleUser.uid, updated).catch((err) =>
        console.warn('Background water cloud edit error:', err)
      );
    }
  };

  const removeWaterRecord = async (id: string): Promise<void> => {
    await dbService.deleteWaterRecord(id);
    setWaterRecords((prev) => prev.filter((r) => r.id !== id));

    if (googleUser && googleUser.uid) {
      cloudDeleteWaterRecord(googleUser.uid, id).catch((err) =>
        console.warn('Background water cloud delete error:', err)
      );
    }
  };

  const addPayment = async (
    payment: Omit<PaymentRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<PaymentRecord> => {
    const newPayment: PaymentRecord = {
      ...payment,
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.savePayment(newPayment);
    setPayments((prev) => [newPayment, ...prev]);

    if (googleUser && googleUser.uid) {
      cloudSavePayment(googleUser.uid, newPayment).catch((err) =>
        console.warn('Background payment cloud save error:', err)
      );
    }

    return newPayment;
  };

  const editPayment = async (payment: PaymentRecord): Promise<void> => {
    const updated: PaymentRecord = {
      ...payment,
      updatedAt: new Date().toISOString(),
    };

    await dbService.savePayment(updated);
    setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));

    if (googleUser && googleUser.uid) {
      cloudSavePayment(googleUser.uid, updated).catch((err) =>
        console.warn('Background payment cloud edit error:', err)
      );
    }
  };

  const removePayment = async (id: string): Promise<void> => {
    await dbService.deletePayment(id);
    setPayments((prev) => prev.filter((p) => p.id !== id));

    if (googleUser && googleUser.uid) {
      cloudDeletePayment(googleUser.uid, id).catch((err) =>
        console.warn('Background payment cloud delete error:', err)
      );
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>): Promise<void> => {
    if (newSettings.isDarkMode !== undefined) {
      if (newSettings.isDarkMode) {
        document.documentElement.classList.add('dark');
        document.body.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.body.classList.remove('dark');
      }
      try {
        localStorage.setItem('tubewell_dark_mode', newSettings.isDarkMode ? 'true' : 'false');
      } catch {}
      const metaThemeColor = document.querySelector('meta[name="theme-color"]');
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', newSettings.isDarkMode ? '#022c22' : '#087C71');
      }
    }

    const updated: AppSettings = {
      ...settings,
      ...newSettings,
    };
    await dbService.saveSettings(updated);
    setSettings(updated);

    if (googleUser && googleUser.uid) {
      cloudSaveSettings(googleUser.uid, updated).catch((err) =>
        console.warn('Background settings cloud save error:', err)
      );
    }
  };

  const loadSampleData = async (): Promise<void> => {
    await dbService.clearAllData();
    await dbService.seedSampleData();
    await loadData();
  };

  const resetAllData = async (): Promise<void> => {
    await dbService.clearAllData();
    setCustomers([]);
    setWaterRecords([]);
    setPayments([]);
    setSelectedCustomerId(null);
  };

  const exportDataJSON = async (): Promise<string> => {
    return await dbService.exportBackup();
  };

  const importDataJSON = async (
    jsonStr: string
  ): Promise<{
    success: boolean;
    count: { customers: number; waterRecords: number; payments: number };
    error?: string;
  }> => {
    const result = await dbService.importBackup(jsonStr);
    if (result.success) {
      await loadData();
    }
    return result;
  };

  const value: KhataContextType = {
    customers,
    waterRecords,
    payments,
    settings,
    isLoading,
    selectedCustomerId,
    setSelectedCustomerId,
    selectedCustomer,
    customerSummaries,
    totalPreviousDues,
    totalCollectedPayments,
    totalWaterCharges,
    totalPumpMinutes,
    searchQuery,
    setSearchQuery,
    filteredCustomers,
    addCustomer,
    editCustomer,
    removeCustomer,
    addWaterRecord,
    editWaterRecord,
    removeWaterRecord,
    addPayment,
    editPayment,
    removePayment,
    updateSettings,
    loadSampleData,
    resetAllData,
    exportDataJSON,
    exportEncryptedBackup,
    importDataJSON,
    refreshData: loadData,

    // Google Cloud Sync
    googleUser,
    isGoogleConnected: !!googleUser,
    syncStatus,
    lastCloudSyncAt,
    syncError,
    isOffline,
    connectGoogle,
    disconnectGoogle,
    syncLocalRecordsToCloud,
    isMigrationPromptOpen,
    setIsMigrationPromptOpen,
    confirmMigration,
    cancelMigration,

    // Today Summary Dashboard
    todaySummary,

    // Google Drive Disaster Recovery
    isCloudBackingUp,
    cloudBackupStatus,
    lastCloudBackupAt,
    cloudBackupError,
    performCloudBackup,
    restoreFromCloud,
    listCloudBackups,
    deleteCloudBackup,
    toggleAutoCloudBackup,
  };

  return <KhataContext.Provider value={value}>{children}</KhataContext.Provider>;
};

export const useKhata = (): KhataContextType => {
  const context = useContext(KhataContext);
  if (!context) {
    throw new Error('useKhata must be used within a KhataProvider');
  }
  return context;
};
