export interface Time12 {
  hour: number; // 1 to 12
  minute: number; // 0 to 59
  period: 'AM' | 'PM';
}

export interface Customer {
  id: string;
  name: string;
  phone?: string;
  village?: string;
  hourlyRate: number; // Fixed at 600
  createdAt: string; // ISO
  updatedAt: string; // ISO
  notes?: string;
}

export interface WaterRecord {
  id: string;
  customerId: string;
  startDate: string; // YYYY-MM-DD (CRITICAL: Strictly only Start Date)
  startTime: Time12;
  endTime: Time12 | null; // Null if tubewell is currently running
  endsNextDay: boolean; // Overnight watering checkbox
  durationMinutes: number; // Integer minutes (Final billable duration after GOB adjustment, 0 if running)
  rawDurationMinutes?: number; // Actual watering duration before GOB adjustment
  gobMinutes?: number; // GOB adjustment minutes
  gobType?: 'add' | 'minus'; // '+' Add or '-' Minus
  amount: number; // Integer Rupees = durationMinutes * 10
  status?: 'running' | 'completed'; // 'running' if tube-well is currently active
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentRecord {
  id: string;
  customerId: string;
  amount: number; // Integer Rupees
  date: string; // YYYY-MM-DD
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CloudBackupInfo {
  lastBackupAt?: string;
  lastBackupFileId?: string;
  isVerified?: boolean;
  userEmail?: string;
  autoBackupEnabled?: boolean;
  status?: 'idle' | 'backing-up' | 'verified' | 'error';
  errorMessage?: string;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'pending' | 'error';

export interface TodaySummary {
  todayDate: string;
  totalMinutes: number;
  totalWaterCharges: number;
  totalPayments: number;
  activeCustomerNames: string[];
  recordsCount: number;
  paymentsCount: number;
  recentActivities: Array<{
    id: string;
    time: string;
    text: string;
    type: 'water' | 'payment';
  }>;
}

export interface AppSettings {
  tubeWellName: string;
  ownerName: string;
  ownerPhone: string;
  hourlyRate: number; // Default 600
  perMinuteRate: number; // Default 10
  isDarkMode: boolean;
  language?: 'en' | 'ur';
  pinLock: {
    enabled: boolean;
    pin: string;
  };
  lastBackupDate?: string;
  cloudBackup?: CloudBackupInfo;
  lastCloudSyncAt?: string;
}

export interface CustomerBalanceSummary {
  customer: Customer;
  totalWaterCharges: number;
  totalPayments: number;
  balance: number; // positive = customer owes money (dues), negative = customer credit (advance)
  waterSessionsCount: number;
  totalWaterMinutes: number;
  lastActivityDate?: string;
}

export interface TestResult {
  id: number;
  name: string;
  description: string;
  passed: boolean;
  actual?: string;
  expected?: string;
  error?: string;
}
