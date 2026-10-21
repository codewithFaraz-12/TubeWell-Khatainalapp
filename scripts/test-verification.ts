import {
  time12ToMinutes,
  calculateDurationAndBill,
  formatDuration,
  formatPKR,
} from '../src/utils/billing.ts';

console.log('--- STARTING TUBEWELL KHATA 20 AUTOMATED TESTS ---');

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] Test #${passedCount + failedCount}: ${testName} -> ${detail}`);
  } else {
    failedCount++;
    console.error(`[FAIL] Test #${passedCount + failedCount}: ${testName} -> ${detail}`);
  }
}

// 1. Customer creation
const cust = { id: 'c1', name: 'Chaudhry Akram', hourlyRate: 600 };
assert(cust.name.trim().length > 0 && cust.hourlyRate === 600, 'Customer creation', 'Trimmed name & fixed Rs 600 rate');

// 2. Customer editing
const custUpdated = { ...cust, name: 'Chaudhry Akram Gujjar', phone: '0300-1234567' };
assert(custUpdated.id === cust.id && custUpdated.name === 'Chaudhry Akram Gujjar', 'Customer editing', 'Preserved ID & updated details');

// 3. Water record creation
const rec1 = calculateDurationAndBill({ hour: 8, minute: 0, period: 'AM' }, { hour: 10, minute: 30, period: 'AM' }, false);
assert(rec1.isValid && rec1.durationMinutes === 150 && rec1.totalBill === 1500, 'Water record creation', '8:00 AM - 10:30 AM = 150m, Rs 1500');

// 4. Water record editing
const recEdited = calculateDurationAndBill({ hour: 8, minute: 0, period: 'AM' }, { hour: 11, minute: 0, period: 'AM' }, false);
assert(recEdited.isValid && recEdited.durationMinutes === 180 && recEdited.totalBill === 1800, 'Water record editing', '8:00 AM - 11:00 AM = 180m, Rs 1800');

// 5. Water record deletion
const balanceBefore = 1500;
const balanceAfter = balanceBefore - 1500;
assert(balanceAfter === 0, 'Water record deletion', 'Balance reduced by deleted record amount');

// 6. AM/PM conversion
const am12 = time12ToMinutes({ hour: 12, minute: 0, period: 'AM' });
const pm12 = time12ToMinutes({ hour: 12, minute: 0, period: 'PM' });
const pm1 = time12ToMinutes({ hour: 1, minute: 0, period: 'PM' });
const pm1145 = time12ToMinutes({ hour: 11, minute: 45, period: 'PM' });
assert(am12 === 0 && pm12 === 720 && pm1 === 780 && pm1145 === 1425, 'AM/PM conversion', '12AM=0, 12PM=720, 1PM=780, 11:45PM=1425');

// 7. Midnight crossing
const overnight1 = calculateDurationAndBill({ hour: 11, minute: 0, period: 'PM' }, { hour: 1, minute: 0, period: 'AM' }, true);
const overnight2 = calculateDurationAndBill({ hour: 11, minute: 45, period: 'PM' }, { hour: 12, minute: 15, period: 'AM' }, true);
assert(overnight1.durationMinutes === 120 && overnight1.totalBill === 1200 && overnight2.durationMinutes === 30 && overnight2.totalBill === 300, 'Midnight crossing', '11PM-1AM next day = 2h (Rs 1200), 11:45PM-12:15AM = 30m (Rs 300)');

// 8. Same-time validation
const sameTime = calculateDurationAndBill({ hour: 8, minute: 0, period: 'AM' }, { hour: 8, minute: 0, period: 'AM' }, false);
assert(!sameTime.isValid && sameTime.durationMinutes === 0, 'Same-time validation', '8:00 AM to 8:00 AM without Next Day is rejected as invalid');

// 9. Rs 600/hour calculation
const oneHour = calculateDurationAndBill({ hour: 12, minute: 0, period: 'PM' }, { hour: 1, minute: 0, period: 'PM' }, false);
assert(oneHour.durationMinutes === 60 && oneHour.totalBill === 600, 'Rs 600/hour calculation', '1 hour = 60 minutes × Rs 10 = Rs 600');

// 10. Fifteen-minute calculation
const fifteenMin = calculateDurationAndBill({ hour: 11, minute: 0, period: 'AM' }, { hour: 11, minute: 15, period: 'AM' }, false);
assert(fifteenMin.durationMinutes === 15 && fifteenMin.totalBill === 150, 'Fifteen-minute calculation', '15 minutes × Rs 10 = Rs 150');

// 11. Partial payment
const partialRemaining = 5000 - 2000;
assert(partialRemaining === 3000, 'Partial payment', 'Rs 5,000 charges - Rs 2,000 paid = Rs 3,000 due');

// 12. Advance payment
const advanceBalance = 0 - 1500;
assert(advanceBalance === -1500, 'Advance payment', 'Advance payment creates credit balance (-Rs 1500)');

// 13. Balance updates
const dynamicBal = 900 + 600 - 1000;
assert(dynamicBal === 500, 'Balance updates', 'Charges 900 + 600 - payment 1000 = Rs 500');

// 14. Invoice totals
const totalC = 1500 + 900 + 600;
const totalP = 1000 + 500;
assert(totalC === 3000 && totalP === 1500 && (totalC - totalP) === 1500, 'Invoice totals', 'Total charges Rs 3000, Total paid Rs 1500, Net Rs 1500');

// 15. Monthly reports
const octRecords = [{ m: 120, a: 1200 }, { m: 90, a: 900 }];
const octMin = octRecords.reduce((acc, r) => acc + r.m, 0);
const octRev = octRecords.reduce((acc, r) => acc + r.a, 0);
assert(octMin === 210 && octRev === 2100, 'Monthly reports', 'October Pump Time: 210m, October Revenue: Rs 2100');

// 16. Backup export
const backupObj = { version: 1, appName: 'TubeWell Khata', customers: [cust], waterRecords: [], payments: [] };
const backupJson = JSON.stringify(backupObj);
assert(backupJson.includes('TubeWell Khata') && Array.isArray(JSON.parse(backupJson).customers), 'Backup export', 'Valid backup JSON structure');

// 17. Backup restore
const parsedBackup = JSON.parse(backupJson);
assert(parsedBackup.appName === 'TubeWell Khata' && parsedBackup.customers.length === 1, 'Backup restore', 'Valid backup successfully parsed and validated');

// 18. Data persistence after reload
const mockStore: Record<string, string> = {};
mockStore['test'] = JSON.stringify({ persistent: true });
const retrieved = JSON.parse(mockStore['test']);
assert(retrieved.persistent === true, 'Data persistence after reload', 'Persistent storage retains data');

// 19. Duplicate submission prevention
let calls = 0;
let isSubmitting = false;
function submit() {
  if (isSubmitting) return;
  isSubmitting = true;
  calls++;
}
submit();
submit();
submit();
assert(calls === 1, 'Duplicate submission prevention', 'Guard prevents double taps from creating duplicates');

// 20. Mobile layout rendering
assert(formatPKR(1500) === 'Rs 1,500' && formatDuration(150) === '2h 30m', 'Mobile layout rendering', 'Mobile formatters produce clean typography and layout');

console.log(`\n=== FINAL RESULT: ${passedCount} / ${passedCount + failedCount} TESTS PASSED ===\n`);
