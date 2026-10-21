import { Customer, WaterRecord, PaymentRecord, AppSettings } from '../types';

const DB_NAME = 'tubewell_khata_db';
const DB_VERSION = 1;

const STORES = {
  CUSTOMERS: 'customers',
  WATER_RECORDS: 'water_records',
  PAYMENTS: 'payments',
  SETTINGS: 'settings',
};

const LS_BACKUP_KEYS = {
  CUSTOMERS: 'tk_customers_v1',
  WATER_RECORDS: 'tk_water_records_v1',
  PAYMENTS: 'tk_payments_v1',
  SETTINGS: 'tk_settings_v1',
};

export const DEFAULT_SETTINGS: AppSettings = {
  tubeWellName: 'Farhan TubeWell',
  ownerName: 'Farhan',
  ownerPhone: '',
  hourlyRate: 600,
  perMinuteRate: 10,
  isDarkMode: false,
  pinLock: {
    enabled: false,
    pin: '',
  },
  cloudBackup: {
    autoBackupEnabled: true,
    status: 'idle',
  },
};

let dbInstance: IDBDatabase | null = null;

// Initialize IndexedDB with version upgrade handler
export async function getDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported in this environment'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('IndexedDB open error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORES.CUSTOMERS)) {
        db.createObjectStore(STORES.CUSTOMERS, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORES.WATER_RECORDS)) {
        const store = db.createObjectStore(STORES.WATER_RECORDS, { keyPath: 'id' });
        store.createIndex('customerId', 'customerId', { unique: false });
        store.createIndex('startDate', 'startDate', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.PAYMENTS)) {
        const store = db.createObjectStore(STORES.PAYMENTS, { keyPath: 'id' });
        store.createIndex('customerId', 'customerId', { unique: false });
        store.createIndex('date', 'date', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }
    };
  });
}

// Fallback / Dual-write to localStorage for bulletproof persistence
function syncToLocalStorage(key: string, data: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.warn('LocalStorage sync warning:', e);
  }
}

function getFromLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

// ---------------- CUSTOMERS ----------------

export async function getAllCustomers(): Promise<Customer[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.CUSTOMERS, 'readonly');
      const store = tx.objectStore(STORES.CUSTOMERS);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = (req.result || []) as Customer[];
        if (result.length > 0) {
          syncToLocalStorage(LS_BACKUP_KEYS.CUSTOMERS, result);
          resolve(result);
        } else {
          // Check local storage backup
          const lsData = getFromLocalStorage<Customer[]>(LS_BACKUP_KEYS.CUSTOMERS, []);
          resolve(lsData);
        }
      };
      req.onerror = () => {
        resolve(getFromLocalStorage<Customer[]>(LS_BACKUP_KEYS.CUSTOMERS, []));
      };
    });
  } catch {
    return getFromLocalStorage<Customer[]>(LS_BACKUP_KEYS.CUSTOMERS, []);
  }
}

export async function saveCustomer(customer: Customer): Promise<void> {
  const current = await getAllCustomers();
  const index = current.findIndex((c) => c.id === customer.id);
  const updated = [...current];
  if (index >= 0) {
    updated[index] = customer;
  } else {
    updated.push(customer);
  }
  syncToLocalStorage(LS_BACKUP_KEYS.CUSTOMERS, updated);

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.CUSTOMERS, 'readwrite');
      const store = tx.objectStore(STORES.CUSTOMERS);
      const req = store.put(customer);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB saveCustomer failed, saved to LocalStorage:', err);
  }
}

export async function deleteCustomer(id: string): Promise<void> {
  const current = await getAllCustomers();
  const updated = current.filter((c) => c.id !== id);
  syncToLocalStorage(LS_BACKUP_KEYS.CUSTOMERS, updated);

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [STORES.CUSTOMERS, STORES.WATER_RECORDS, STORES.PAYMENTS],
        'readwrite'
      );
      tx.objectStore(STORES.CUSTOMERS).delete(id);

      // Also cascade delete customer water records and payments
      const waterStore = tx.objectStore(STORES.WATER_RECORDS);
      const waterReq = waterStore.getAll();
      waterReq.onsuccess = () => {
        const records = (waterReq.result || []) as WaterRecord[];
        records.filter((r) => r.customerId === id).forEach((r) => waterStore.delete(r.id));
      };

      const paymentStore = tx.objectStore(STORES.PAYMENTS);
      const payReq = paymentStore.getAll();
      payReq.onsuccess = () => {
        const payments = (payReq.result || []) as PaymentRecord[];
        payments.filter((p) => p.customerId === id).forEach((p) => paymentStore.delete(p.id));
      };

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB deleteCustomer error:', err);
  }

  // Also clean in LocalStorage
  const lsWaters = getFromLocalStorage<WaterRecord[]>(LS_BACKUP_KEYS.WATER_RECORDS, []);
  syncToLocalStorage(
    LS_BACKUP_KEYS.WATER_RECORDS,
    lsWaters.filter((w) => w.customerId !== id)
  );

  const lsPays = getFromLocalStorage<PaymentRecord[]>(LS_BACKUP_KEYS.PAYMENTS, []);
  syncToLocalStorage(
    LS_BACKUP_KEYS.PAYMENTS,
    lsPays.filter((p) => p.customerId !== id)
  );
}

// ---------------- WATER RECORDS ----------------

export async function getAllWaterRecords(): Promise<WaterRecord[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.WATER_RECORDS, 'readonly');
      const store = tx.objectStore(STORES.WATER_RECORDS);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = (req.result || []) as WaterRecord[];
        if (result.length > 0) {
          syncToLocalStorage(LS_BACKUP_KEYS.WATER_RECORDS, result);
          resolve(result);
        } else {
          resolve(getFromLocalStorage<WaterRecord[]>(LS_BACKUP_KEYS.WATER_RECORDS, []));
        }
      };
      req.onerror = () => {
        resolve(getFromLocalStorage<WaterRecord[]>(LS_BACKUP_KEYS.WATER_RECORDS, []));
      };
    });
  } catch {
    return getFromLocalStorage<WaterRecord[]>(LS_BACKUP_KEYS.WATER_RECORDS, []);
  }
}

export async function saveWaterRecord(record: WaterRecord): Promise<void> {
  const current = await getAllWaterRecords();
  const index = current.findIndex((r) => r.id === record.id);
  const updated = [...current];
  if (index >= 0) {
    updated[index] = record;
  } else {
    updated.push(record);
  }
  syncToLocalStorage(LS_BACKUP_KEYS.WATER_RECORDS, updated);

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.WATER_RECORDS, 'readwrite');
      const store = tx.objectStore(STORES.WATER_RECORDS);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB saveWaterRecord error:', err);
  }
}

export async function deleteWaterRecord(id: string): Promise<void> {
  const current = await getAllWaterRecords();
  const updated = current.filter((r) => r.id !== id);
  syncToLocalStorage(LS_BACKUP_KEYS.WATER_RECORDS, updated);

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.WATER_RECORDS, 'readwrite');
      const store = tx.objectStore(STORES.WATER_RECORDS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB deleteWaterRecord error:', err);
  }
}

// ---------------- PAYMENTS ----------------

export async function getAllPayments(): Promise<PaymentRecord[]> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.PAYMENTS, 'readonly');
      const store = tx.objectStore(STORES.PAYMENTS);
      const req = store.getAll();
      req.onsuccess = () => {
        const result = (req.result || []) as PaymentRecord[];
        if (result.length > 0) {
          syncToLocalStorage(LS_BACKUP_KEYS.PAYMENTS, result);
          resolve(result);
        } else {
          resolve(getFromLocalStorage<PaymentRecord[]>(LS_BACKUP_KEYS.PAYMENTS, []));
        }
      };
      req.onerror = () => {
        resolve(getFromLocalStorage<PaymentRecord[]>(LS_BACKUP_KEYS.PAYMENTS, []));
      };
    });
  } catch {
    return getFromLocalStorage<PaymentRecord[]>(LS_BACKUP_KEYS.PAYMENTS, []);
  }
}

export async function savePayment(payment: PaymentRecord): Promise<void> {
  const current = await getAllPayments();
  const index = current.findIndex((p) => p.id === payment.id);
  const updated = [...current];
  if (index >= 0) {
    updated[index] = payment;
  } else {
    updated.push(payment);
  }
  syncToLocalStorage(LS_BACKUP_KEYS.PAYMENTS, updated);

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.PAYMENTS, 'readwrite');
      const store = tx.objectStore(STORES.PAYMENTS);
      const req = store.put(payment);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB savePayment error:', err);
  }
}

export async function deletePayment(id: string): Promise<void> {
  const current = await getAllPayments();
  const updated = current.filter((p) => p.id !== id);
  syncToLocalStorage(LS_BACKUP_KEYS.PAYMENTS, updated);

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.PAYMENTS, 'readwrite');
      const store = tx.objectStore(STORES.PAYMENTS);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB deletePayment error:', err);
  }
}

// ---------------- SETTINGS ----------------

export async function getSettings(): Promise<AppSettings> {
  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.SETTINGS, 'readonly');
      const store = tx.objectStore(STORES.SETTINGS);
      const req = store.get('app_settings');
      req.onsuccess = () => {
        if (req.result && req.result.data) {
          const s = req.result.data as AppSettings;
          if (!s.tubeWellName || s.tubeWellName === 'Al-Madina TubeWell & Irrigation') {
            s.tubeWellName = 'Farhan TubeWell';
          }
          syncToLocalStorage(LS_BACKUP_KEYS.SETTINGS, s);
          resolve(s);
        } else {
          const ls = getFromLocalStorage<AppSettings>(LS_BACKUP_KEYS.SETTINGS, DEFAULT_SETTINGS);
          if (!ls.tubeWellName || ls.tubeWellName === 'Al-Madina TubeWell & Irrigation') {
            ls.tubeWellName = 'Farhan TubeWell';
          }
          resolve(ls);
        }
      };
      req.onerror = () => {
        resolve(getFromLocalStorage<AppSettings>(LS_BACKUP_KEYS.SETTINGS, DEFAULT_SETTINGS));
      };
    });
  } catch {
    return getFromLocalStorage<AppSettings>(LS_BACKUP_KEYS.SETTINGS, DEFAULT_SETTINGS);
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  syncToLocalStorage(LS_BACKUP_KEYS.SETTINGS, settings);
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readwrite');
      const store = tx.objectStore(STORES.SETTINGS);
      const req = store.put({ key: 'app_settings', data: settings });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('IndexedDB saveSettings error:', err);
  }
}

// ---------------- BACKUP & RESTORE ----------------

export interface BackupPayload {
  version: 1;
  appName: 'TubeWell Khata';
  exportedAt: string;
  customers: Customer[];
  waterRecords: WaterRecord[];
  payments: PaymentRecord[];
  settings: AppSettings;
}

export async function exportBackup(): Promise<string> {
  const [customers, waterRecords, payments, settings] = await Promise.all([
    getAllCustomers(),
    getAllWaterRecords(),
    getAllPayments(),
    getSettings(),
  ]);

  const payload: BackupPayload = {
    version: 1,
    appName: 'TubeWell Khata',
    exportedAt: new Date().toISOString(),
    customers,
    waterRecords,
    payments,
    settings,
  };

  return JSON.stringify(payload, null, 2);
}

export async function importBackup(
  jsonString: string,
  mode: 'safe-merge' | 'replace' = 'safe-merge'
): Promise<{
  success: boolean;
  count: { customers: number; waterRecords: number; payments: number };
  newerPreservedCount?: number;
  error?: string;
}> {
  try {
    const parsed = JSON.parse(jsonString) as Partial<BackupPayload>;

    // Strict validation
    if (parsed.appName !== 'TubeWell Khata' && !parsed.customers) {
      return {
        success: false,
        count: { customers: 0, waterRecords: 0, payments: 0 },
        error: 'Invalid backup file: Not a recognized TubeWell Khata backup.',
      };
    }

    if (!Array.isArray(parsed.customers) || !Array.isArray(parsed.waterRecords)) {
      return {
        success: false,
        count: { customers: 0, waterRecords: 0, payments: 0 },
        error: 'Invalid backup data format: Missing customers or water records list.',
      };
    }

    const incomingCustomers = parsed.customers;
    const incomingWater = parsed.waterRecords;
    const incomingPayments = Array.isArray(parsed.payments) ? parsed.payments : [];
    const incomingSettings = parsed.settings || DEFAULT_SETTINGS;

    let finalCustomers: Customer[] = [];
    let finalWater: WaterRecord[] = [];
    let finalPayments: PaymentRecord[] = [];
    let newerPreserved = 0;

    if (mode === 'safe-merge') {
      // Fetch existing records from local DB
      const [existingCusts, existingWater, existingPays] = await Promise.all([
        getAllCustomers(),
        getAllWaterRecords(),
        getAllPayments(),
      ]);

      // 1. Safe Customer Merge
      const custMap = new Map<string, Customer>();
      existingCusts.forEach((c) => custMap.set(c.id, c));
      incomingCustomers.forEach((c) => {
        const exist = custMap.get(c.id);
        if (!exist) {
          custMap.set(c.id, c);
        } else {
          const incomingTime = new Date(c.updatedAt || 0).getTime();
          const existTime = new Date(exist.updatedAt || 0).getTime();
          if (incomingTime >= existTime) {
            custMap.set(c.id, c);
          } else {
            newerPreserved++;
          }
        }
      });
      finalCustomers = Array.from(custMap.values());

      // 2. Safe Water Record Merge
      const waterMap = new Map<string, WaterRecord>();
      existingWater.forEach((w) => waterMap.set(w.id, w));
      incomingWater.forEach((w) => {
        const exist = waterMap.get(w.id);
        if (!exist) {
          waterMap.set(w.id, w);
        } else {
          const incomingTime = new Date(w.updatedAt || 0).getTime();
          const existTime = new Date(exist.updatedAt || 0).getTime();
          if (incomingTime >= existTime) {
            waterMap.set(w.id, w);
          } else {
            newerPreserved++;
          }
        }
      });
      finalWater = Array.from(waterMap.values());

      // 3. Safe Payment Merge
      const payMap = new Map<string, PaymentRecord>();
      existingPays.forEach((p) => payMap.set(p.id, p));
      incomingPayments.forEach((p) => {
        const exist = payMap.get(p.id);
        if (!exist) {
          payMap.set(p.id, p);
        } else {
          const incomingTime = new Date(p.updatedAt || 0).getTime();
          const existTime = new Date(exist.updatedAt || 0).getTime();
          if (incomingTime >= existTime) {
            payMap.set(p.id, p);
          } else {
            newerPreserved++;
          }
        }
      });
      finalPayments = Array.from(payMap.values());
    } else {
      // Explicit full replace
      finalCustomers = incomingCustomers;
      finalWater = incomingWater;
      finalPayments = incomingPayments;
    }

    // Save merged data in localStorage
    syncToLocalStorage(LS_BACKUP_KEYS.CUSTOMERS, finalCustomers);
    syncToLocalStorage(LS_BACKUP_KEYS.WATER_RECORDS, finalWater);
    syncToLocalStorage(LS_BACKUP_KEYS.PAYMENTS, finalPayments);
    if (incomingSettings) {
      syncToLocalStorage(LS_BACKUP_KEYS.SETTINGS, incomingSettings);
    }

    // Save in IndexedDB
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [STORES.CUSTOMERS, STORES.WATER_RECORDS, STORES.PAYMENTS, STORES.SETTINGS],
        'readwrite'
      );

      const custStore = tx.objectStore(STORES.CUSTOMERS);
      custStore.clear();
      finalCustomers.forEach((c) => custStore.put(c));

      const waterStore = tx.objectStore(STORES.WATER_RECORDS);
      waterStore.clear();
      finalWater.forEach((w) => waterStore.put(w));

      const payStore = tx.objectStore(STORES.PAYMENTS);
      payStore.clear();
      finalPayments.forEach((p) => payStore.put(p));

      const settingsStore = tx.objectStore(STORES.SETTINGS);
      settingsStore.put({ key: 'app_settings', data: incomingSettings });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    return {
      success: true,
      count: {
        customers: finalCustomers.length,
        waterRecords: finalWater.length,
        payments: finalPayments.length,
      },
      newerPreservedCount: newerPreserved,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to parse JSON backup file';
    return {
      success: false,
      count: { customers: 0, waterRecords: 0, payments: 0 },
      error: errorMsg,
    };
  }
}

// ---------------- SEED SAMPLE DATA ----------------

export async function seedSampleData(): Promise<void> {
  const sampleCustomers: Customer[] = [
    {
      id: 'cust_sample_1',
      name: 'Chaudhry Akram Gujjar',
      phone: '0300-8451234',
      village: 'Chak 42-RB',
      hourlyRate: 600,
      createdAt: '2026-10-01T08:00:00.000Z',
      updatedAt: '2026-10-01T08:00:00.000Z',
    },
    {
      id: 'cust_sample_2',
      name: 'Malik Tariq Mehmood',
      phone: '0321-7654321',
      village: 'Kot Momin',
      hourlyRate: 600,
      createdAt: '2026-10-02T09:00:00.000Z',
      updatedAt: '2026-10-02T09:00:00.000Z',
    },
    {
      id: 'cust_sample_3',
      name: 'Mian Aslam Javed',
      phone: '0345-9876543',
      village: 'Bhalwal',
      hourlyRate: 600,
      createdAt: '2026-10-03T10:00:00.000Z',
      updatedAt: '2026-10-03T10:00:00.000Z',
    },
    {
      id: 'cust_sample_4',
      name: 'Rana Shahid Iqbal',
      phone: '0312-5544332',
      village: 'Chak 15-SB',
      hourlyRate: 600,
      createdAt: '2026-10-04T11:00:00.000Z',
      updatedAt: '2026-10-04T11:00:00.000Z',
    },
  ];

  const sampleWaterRecords: WaterRecord[] = [
    // Chaudhry Akram: 8:00 AM to 10:30 AM (2h 30m = 150m, Rs 1500)
    {
      id: 'rec_sample_1',
      customerId: 'cust_sample_1',
      startDate: '2026-10-10',
      startTime: { hour: 8, minute: 0, period: 'AM' },
      endTime: { hour: 10, minute: 30, period: 'AM' },
      endsNextDay: false,
      durationMinutes: 150,
      amount: 1500,
      notes: 'Cotton field east wing',
      createdAt: '2026-10-10T11:00:00.000Z',
      updatedAt: '2026-10-10T11:00:00.000Z',
    },
    // Chaudhry Akram: 11:00 PM to 1:00 AM (Overnight, 2h = 120m, Rs 1200)
    {
      id: 'rec_sample_2',
      customerId: 'cust_sample_1',
      startDate: '2026-10-12',
      startTime: { hour: 11, minute: 0, period: 'PM' },
      endTime: { hour: 1, minute: 0, period: 'AM' },
      endsNextDay: true,
      durationMinutes: 120,
      amount: 1200,
      notes: 'Overnight wheat field watering',
      createdAt: '2026-10-13T02:00:00.000Z',
      updatedAt: '2026-10-13T02:00:00.000Z',
    },
    // Malik Tariq: 9:15 AM to 10:45 AM (1h 30m = 90m, Rs 900)
    {
      id: 'rec_sample_3',
      customerId: 'cust_sample_2',
      startDate: '2026-10-11',
      startTime: { hour: 9, minute: 15, period: 'AM' },
      endTime: { hour: 10, minute: 45, period: 'AM' },
      endsNextDay: false,
      durationMinutes: 90,
      amount: 900,
      notes: 'Sugarcane plot 3',
      createdAt: '2026-10-11T11:00:00.000Z',
      updatedAt: '2026-10-11T11:00:00.000Z',
    },
    // Malik Tariq: 12:00 PM to 1:00 PM (1h = 60m, Rs 600)
    {
      id: 'rec_sample_4',
      customerId: 'cust_sample_2',
      startDate: '2026-10-14',
      startTime: { hour: 12, minute: 0, period: 'PM' },
      endTime: { hour: 1, minute: 0, period: 'PM' },
      endsNextDay: false,
      durationMinutes: 60,
      amount: 600,
      notes: 'Vegetable nursery',
      createdAt: '2026-10-14T13:30:00.000Z',
      updatedAt: '2026-10-14T13:30:00.000Z',
    },
    // Mian Aslam: 11:00 AM to 11:15 AM (15m, Rs 150)
    {
      id: 'rec_sample_5',
      customerId: 'cust_sample_3',
      startDate: '2026-10-15',
      startTime: { hour: 11, minute: 0, period: 'AM' },
      endTime: { hour: 11, minute: 15, period: 'AM' },
      endsNextDay: false,
      durationMinutes: 15,
      amount: 150,
      notes: 'Quick orchard fill',
      createdAt: '2026-10-15T11:30:00.000Z',
      updatedAt: '2026-10-15T11:30:00.000Z',
    },
  ];

  const samplePayments: PaymentRecord[] = [
    // Chaudhry Akram paid Rs 1,000 against total Rs 2,700 (Remaining due: Rs 1,700)
    {
      id: 'pay_sample_1',
      customerId: 'cust_sample_1',
      amount: 1000,
      date: '2026-10-14',
      note: 'Partial cash payment received at tube-well',
      createdAt: '2026-10-14T14:00:00.000Z',
      updatedAt: '2026-10-14T14:00:00.000Z',
    },
    // Malik Tariq paid Rs 1,500 in full (Total charges Rs 1,500, balance: 0)
    {
      id: 'pay_sample_2',
      customerId: 'cust_sample_2',
      amount: 1500,
      date: '2026-10-15',
      note: 'Full settlement via JazzCash / Cash',
      createdAt: '2026-10-15T16:00:00.000Z',
      updatedAt: '2026-10-15T16:00:00.000Z',
    },
    // Rana Shahid paid Rs 1,000 Advance credit (Total charges Rs 0, balance: -1000)
    {
      id: 'pay_sample_3',
      customerId: 'cust_sample_4',
      amount: 1000,
      date: '2026-10-16',
      note: 'Advance deposit for upcoming wheat season watering',
      createdAt: '2026-10-16T12:00:00.000Z',
      updatedAt: '2026-10-16T12:00:00.000Z',
    },
  ];

  for (const c of sampleCustomers) await saveCustomer(c);
  for (const w of sampleWaterRecords) await saveWaterRecord(w);
  for (const p of samplePayments) await savePayment(p);
}

export async function clearAllData(): Promise<void> {
  syncToLocalStorage(LS_BACKUP_KEYS.CUSTOMERS, []);
  syncToLocalStorage(LS_BACKUP_KEYS.WATER_RECORDS, []);
  syncToLocalStorage(LS_BACKUP_KEYS.PAYMENTS, []);

  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [STORES.CUSTOMERS, STORES.WATER_RECORDS, STORES.PAYMENTS],
        'readwrite'
      );
      tx.objectStore(STORES.CUSTOMERS).clear();
      tx.objectStore(STORES.WATER_RECORDS).clear();
      tx.objectStore(STORES.PAYMENTS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('clearAllData error:', err);
  }
}
