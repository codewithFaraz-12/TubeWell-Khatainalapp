import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  collection,
  onSnapshot,
  setDoc,
  deleteDoc,
  getDoc,
  getDocs,
  getDocFromServer,
  Unsubscribe,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { auth } from './auth';
import {
  Customer,
  WaterRecord,
  PaymentRecord,
  AppSettings,
} from '../types';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID if configured, or default
export const firestoreDb =
  firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
    ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
    : getFirestore(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): Error {
  const errMessage = error instanceof Error ? error.message : String(error);
  const user = auth.currentUser;
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
      isAnonymous: user?.isAnonymous,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return new Error(JSON.stringify(errInfo));
}

/**
 * Strips all undefined fields recursively to prevent Firestore SDK error:
 * "Function setDoc() called with invalid data. Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(data: T): Record<string, unknown> {
  const clean = (val: unknown): unknown => {
    if (val === undefined) return undefined;
    if (val === null || typeof val !== 'object') return val;
    if (Array.isArray(val)) {
      return val.map(clean).filter((v) => v !== undefined);
    }
    const res: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        const cleanedVal = clean(v);
        if (cleanedVal !== undefined) {
          res[k] = cleanedVal;
        }
      }
    }
    return res;
  };
  return (clean(data) as Record<string, unknown>) || {};
}

// Skill constraint: Test connection to Firestore on initialization
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is operating in offline mode.');
    }
    return false;
  }
}

// ---------------- USER-ISOLATED REALTIME SNAPSHOT LISTENERS ----------------
// ONE GOOGLE ACCOUNT = ONE PRIVATE TUBEWELL KHATA

export function subscribeToUserCustomers(
  uid: string,
  onCustomersChange: (customers: Customer[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(firestoreDb, `users/${uid}/customers`);
  return onSnapshot(
    colRef,
    (snap) => {
      const items: Customer[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as Customer);
      });
      onCustomersChange(items);
    },
    (err) => {
      onError(handleFirestoreError(err, OperationType.GET, `users/${uid}/customers`));
    }
  );
}

export function subscribeToUserWaterRecords(
  uid: string,
  onWaterRecordsChange: (records: WaterRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(firestoreDb, `users/${uid}/water_records`);
  return onSnapshot(
    colRef,
    (snap) => {
      const items: WaterRecord[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as WaterRecord);
      });
      onWaterRecordsChange(items);
    },
    (err) => {
      onError(handleFirestoreError(err, OperationType.GET, `users/${uid}/water_records`));
    }
  );
}

export function subscribeToUserPayments(
  uid: string,
  onPaymentsChange: (payments: PaymentRecord[]) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const colRef = collection(firestoreDb, `users/${uid}/payments`);
  return onSnapshot(
    colRef,
    (snap) => {
      const items: PaymentRecord[] = [];
      snap.forEach((docSnap) => {
        items.push(docSnap.data() as PaymentRecord);
      });
      onPaymentsChange(items);
    },
    (err) => {
      onError(handleFirestoreError(err, OperationType.GET, `users/${uid}/payments`));
    }
  );
}

export function subscribeToUserSettings(
  uid: string,
  onSettingsChange: (settings: Partial<AppSettings>) => void,
  onError: (err: Error) => void
): Unsubscribe {
  const docRef = doc(firestoreDb, `users/${uid}/settings`, 'profile');
  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        onSettingsChange(snap.data() as Partial<AppSettings>);
      }
    },
    (err) => {
      onError(handleFirestoreError(err, OperationType.GET, `users/${uid}/settings/profile`));
    }
  );
}

// ---------------- USER-ISOLATED CLOUD CRUD OPERATIONS ----------------

export async function cloudSaveCustomer(uid: string, customer: Customer): Promise<void> {
  const path = `users/${uid}/customers/${customer.id}`;
  const docRef = doc(firestoreDb, `users/${uid}/customers`, customer.id);
  try {
    await setDoc(docRef, sanitizeForFirestore(customer));
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function cloudDeleteCustomer(uid: string, customerId: string): Promise<void> {
  const path = `users/${uid}/customers/${customerId}`;
  const docRef = doc(firestoreDb, `users/${uid}/customers`, customerId);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    throw handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function cloudSaveWaterRecord(uid: string, record: WaterRecord): Promise<void> {
  const path = `users/${uid}/water_records/${record.id}`;
  const docRef = doc(firestoreDb, `users/${uid}/water_records`, record.id);
  try {
    await setDoc(docRef, sanitizeForFirestore(record));
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function cloudDeleteWaterRecord(uid: string, recordId: string): Promise<void> {
  const path = `users/${uid}/water_records/${recordId}`;
  const docRef = doc(firestoreDb, `users/${uid}/water_records`, recordId);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    throw handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function cloudSavePayment(uid: string, payment: PaymentRecord): Promise<void> {
  const path = `users/${uid}/payments/${payment.id}`;
  const docRef = doc(firestoreDb, `users/${uid}/payments`, payment.id);
  try {
    await setDoc(docRef, sanitizeForFirestore(payment));
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function cloudDeletePayment(uid: string, paymentId: string): Promise<void> {
  const path = `users/${uid}/payments/${paymentId}`;
  const docRef = doc(firestoreDb, `users/${uid}/payments`, paymentId);
  try {
    await deleteDoc(docRef);
  } catch (err) {
    throw handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export async function cloudSaveSettings(uid: string, settings: Partial<AppSettings>): Promise<void> {
  const path = `users/${uid}/settings/profile`;
  const docRef = doc(firestoreDb, `users/${uid}/settings`, 'profile');
  try {
    await setDoc(docRef, sanitizeForFirestore(settings), { merge: true });
  } catch (err) {
    throw handleFirestoreError(err, OperationType.WRITE, path);
  }
}

// ---------------- SAFE ONE-ACCOUNT DATA MIGRATION & RECOVERY ----------------

/**
 * Fetch all cloud records for recovery on a new device with the same Google Account
 */
export async function fetchAllCloudRecords(uid: string): Promise<{
  customers: Customer[];
  waterRecords: WaterRecord[];
  payments: PaymentRecord[];
  settings?: Partial<AppSettings>;
}> {
  try {
    const custSnap = await getDocs(collection(firestoreDb, `users/${uid}/customers`));
    const customers: Customer[] = [];
    custSnap.forEach((d) => customers.push(d.data() as Customer));

    const waterSnap = await getDocs(collection(firestoreDb, `users/${uid}/water_records`));
    const waterRecords: WaterRecord[] = [];
    waterSnap.forEach((d) => waterRecords.push(d.data() as WaterRecord));

    const paySnap = await getDocs(collection(firestoreDb, `users/${uid}/payments`));
    const payments: PaymentRecord[] = [];
    paySnap.forEach((d) => payments.push(d.data() as PaymentRecord));

    const settingsDoc = await getDoc(doc(firestoreDb, `users/${uid}/settings`, 'profile'));
    const settings = settingsDoc.exists() ? (settingsDoc.data() as Partial<AppSettings>) : undefined;

    return {
      customers,
      waterRecords,
      payments,
      settings,
    };
  } catch (err) {
    throw handleFirestoreError(err, OperationType.GET, `users/${uid}`);
  }
}

/**
 * Non-destructive safe migration from local device to user's private cloud.
 * - Filters out sample data (never uploads dummy records).
 * - Checks existing cloud documents to prevent duplicate writes and avoid overwriting newer cloud data.
 * - Preserves all records on both device and cloud.
 */
export async function migrateLocalRecordsToUserCloud(
  uid: string,
  customers: Customer[],
  waterRecords: WaterRecord[],
  payments: PaymentRecord[],
  settings?: AppSettings
): Promise<{
  success: boolean;
  counts: { customers: number; waterRecords: number; payments: number };
  skippedCount: number;
  error?: string;
}> {
  try {
    const cleanCustomers = customers.filter((c) => !c.id.startsWith('cust_sample_'));
    const cleanWater = waterRecords.filter((w) => !w.id.startsWith('rec_sample_'));
    const cleanPayments = payments.filter((p) => !p.id.startsWith('pay_sample_'));

    let custCount = 0;
    let waterCount = 0;
    let payCount = 0;
    let skippedCount = 0;

    for (const c of cleanCustomers) {
      try {
        const existingDoc = await getDoc(doc(firestoreDb, `users/${uid}/customers`, c.id));
        if (existingDoc.exists()) {
          const cloudItem = existingDoc.data() as Customer;
          // If cloud data is newer or identical, do NOT overwrite cloud data
          if (cloudItem.updatedAt && cloudItem.updatedAt >= c.updatedAt) {
            skippedCount++;
            continue;
          }
        }
      } catch {
        // If doc check fails, proceed with safe setDoc
      }
      await cloudSaveCustomer(uid, c);
      custCount++;
    }

    for (const w of cleanWater) {
      try {
        const existingDoc = await getDoc(doc(firestoreDb, `users/${uid}/water_records`, w.id));
        if (existingDoc.exists()) {
          const cloudItem = existingDoc.data() as WaterRecord;
          if (cloudItem.updatedAt && cloudItem.updatedAt >= w.updatedAt) {
            skippedCount++;
            continue;
          }
        }
      } catch {
        // proceed
      }
      await cloudSaveWaterRecord(uid, w);
      waterCount++;
    }

    for (const p of cleanPayments) {
      try {
        const existingDoc = await getDoc(doc(firestoreDb, `users/${uid}/payments`, p.id));
        if (existingDoc.exists()) {
          const cloudItem = existingDoc.data() as PaymentRecord;
          if (cloudItem.updatedAt && cloudItem.updatedAt >= p.updatedAt) {
            skippedCount++;
            continue;
          }
        }
      } catch {
        // proceed
      }
      await cloudSavePayment(uid, p);
      payCount++;
    }

    if (settings) {
      await cloudSaveSettings(uid, {
        tubeWellName: settings.tubeWellName,
        ownerName: settings.ownerName,
        ownerPhone: settings.ownerPhone,
        hourlyRate: settings.hourlyRate,
      });
    }

    return {
      success: true,
      counts: {
        customers: custCount,
        waterRecords: waterCount,
        payments: payCount,
      },
      skippedCount,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      counts: { customers: 0, waterRecords: 0, payments: 0 },
      skippedCount: 0,
      error: msg,
    };
  }
}
