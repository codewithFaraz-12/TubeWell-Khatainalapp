import { Time12 } from '../types';

export const FIXED_HOURLY_RATE = 600;
export const FIXED_MINUTE_RATE = 10; // Rs 600 / 60 minutes = Rs 10 per minute

/**
 * Converts a 12-hour Time object into total minutes from start of the day (00:00 = 0, 23:59 = 1439).
 * - 12:00 AM -> 0
 * - 12:30 AM -> 30
 * - 1:00 AM -> 60
 * - 11:45 AM -> 705
 * - 12:00 PM -> 720
 * - 12:30 PM -> 750
 * - 1:00 PM -> 780
 * - 11:00 PM -> 1380
 * - 11:45 PM -> 1425
 */
export function time12ToMinutes(time: Time12): number {
  let hour = time.hour;
  if (time.period === 'AM') {
    if (hour === 12) {
      hour = 0;
    }
  } else {
    // PM
    if (hour !== 12) {
      hour += 12;
    }
  }
  return hour * 60 + time.minute;
}

/**
 * Converts minutes since midnight back into Time12
 */
export function minutesToTime12(totalMinutes: number): Time12 {
  const normalized = ((totalMinutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(normalized / 60);
  const minute = normalized % 60;
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  let hour = h24 % 12;
  if (hour === 0) hour = 12;

  return { hour, minute, period };
}

export interface CalculationResult {
  isValid: boolean;
  durationMinutes: number; // Final billable duration
  rawDurationMinutes?: number; // Actual watering duration before GOB adjustment
  gobMinutes?: number;
  gobType?: 'add' | 'minus';
  totalBill: number;
  formattedDuration: string;
  formattedBill: string;
  errorMessage?: string;
}

/**
 * Calculate irrigation duration and bill strictly according to the TubeWell Khata formula:
 * Total Bill = Final Total Minutes × 10 (Rs 600/hour).
 * Supports GOB Minutes adjustment (+ Add or − Minus).
 */
export function calculateDurationAndBill(
  startTime: Time12,
  endTime: Time12,
  endsNextDay: boolean = false,
  gobMinutes: number = 0,
  gobType: 'add' | 'minus' = 'minus'
): CalculationResult {
  const startMinutes = time12ToMinutes(startTime);
  let endMinutes = time12ToMinutes(endTime);

  // Automatically handle overnight watering if endTime is earlier than startTime (spanning across midnight)
  if (endsNextDay || endMinutes < startMinutes) {
    endMinutes += 1440; // Add 24 hours
  }

  const rawDurationMinutes = endMinutes - startMinutes;

  if (rawDurationMinutes === 0) {
    return {
      isValid: false,
      durationMinutes: 0,
      rawDurationMinutes: 0,
      gobMinutes: 0,
      gobType,
      totalBill: 0,
      formattedDuration: '0m',
      formattedBill: 'Rs 0',
      errorMessage: 'Start and End time cannot be the same. Watering duration must be at least 1 minute.',
    };
  }

  if (rawDurationMinutes < 0) {
    return {
      isValid: false,
      durationMinutes: 0,
      rawDurationMinutes,
      gobMinutes: 0,
      gobType,
      totalBill: 0,
      formattedDuration: 'Invalid',
      formattedBill: 'Rs 0',
      errorMessage: 'Invalid time duration.',
    };
  }

  if (rawDurationMinutes > 1440) {
    return {
      isValid: false,
      durationMinutes: rawDurationMinutes,
      rawDurationMinutes,
      gobMinutes: 0,
      gobType,
      totalBill: 0,
      formattedDuration: 'Invalid (> 24h)',
      formattedBill: 'Rs 0',
      errorMessage: 'Single watering session cannot exceed 24 hours (1,440 minutes).',
    };
  }

  // Calculate GOB adjustment
  const cleanGob = Math.max(0, Math.floor(Number(gobMinutes) || 0));
  let finalDurationMinutes = rawDurationMinutes;

  if (cleanGob > 0) {
    if (gobType === 'minus') {
      finalDurationMinutes = rawDurationMinutes - cleanGob;
    } else {
      finalDurationMinutes = rawDurationMinutes + cleanGob;
    }
  }

  if (finalDurationMinutes <= 0) {
    return {
      isValid: false,
      durationMinutes: 0,
      rawDurationMinutes,
      gobMinutes: cleanGob,
      gobType,
      totalBill: 0,
      formattedDuration: '0m',
      formattedBill: 'Rs 0',
      errorMessage: `GOB Minus (${cleanGob}m) exceeds or equals duration (${rawDurationMinutes}m). Final duration must be at least 1 minute.`,
    };
  }

  // Integer rupees formula: Final Total Minutes × 10 (Rs 600/hour)
  const totalBill = finalDurationMinutes * FIXED_MINUTE_RATE;

  return {
    isValid: true,
    durationMinutes: finalDurationMinutes,
    rawDurationMinutes,
    gobMinutes: cleanGob,
    gobType,
    totalBill,
    formattedDuration: formatDuration(finalDurationMinutes),
    formattedBill: formatPKR(totalBill),
  };
}

/**
 * Formats duration in minutes into a clean human readable string:
 * e.g. 150m -> "2h 30m", 90m -> "1h 30m", 15m -> "15m", 60m -> "1h"
 */
export function formatDuration(minutes: number): string {
  if (minutes < 0) return 'Invalid';
  if (minutes === 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;

  if (hours === 0) {
    return `${remainingMins}m`;
  }
  if (remainingMins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMins}m`;
}

/**
 * Formats Time12 into standard 12-hour string (e.g. "8:00 AM", "10:30 AM", "11:45 PM")
 */
export function formatTime12(time?: Time12 | null): string {
  if (!time) return 'In Progress (Running)';
  const minStr = time.minute.toString().padStart(2, '0');
  return `${time.hour}:${minStr} ${time.period}`;
}

/**
 * Formats currency in Pakistani Rupees (PKR)
 * e.g. 1500 -> "Rs 1,500"
 */
export function formatPKR(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const absAmount = Math.abs(Math.round(amount));
  return `${sign}Rs ${absAmount.toLocaleString('en-PK')}`;
}

/**
 * Formats a date string (YYYY-MM-DD) into readable form:
 * e.g. "2026-10-18" -> "18 Oct 2026"
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const [year, month, day] = dateStr.split('-').map(Number);
    if (!year || !month || !day) return dateStr;
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

/**
 * Gets current date formatted as YYYY-MM-DD in local time
 */
export function getCurrentDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets current time in 12-hour format rounded to nearest 5 minutes
 */
export function getCurrentTime12(): Time12 {
  const now = new Date();
  let hours = now.getHours();
  const period: 'AM' | 'PM' = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;

  const minutes = now.getMinutes();

  return {
    hour: hours,
    minute: minutes,
    period,
  };
}
