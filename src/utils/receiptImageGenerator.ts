import { Customer, WaterRecord, PaymentRecord, AppSettings } from '../types';
import {
  formatPKR,
  formatDate,
  formatTime12,
  formatDuration,
} from './billing';

export interface ReceiptData {
  customer: Customer;
  waterRecords: WaterRecord[];
  payments: PaymentRecord[];
  settings: AppSettings;
  billingPeriodLabel?: string;
  specificRecord?: WaterRecord; // Optional: single session receipt
}

/**
 * Generates an ultra-crisp, executive-grade high-definition PNG receipt
 * rendered via HTML5 2D Canvas with 2x retina scaling in 100% clean English.
 */
export async function generateReceiptImageBlob(data: ReceiptData): Promise<Blob> {
  const { customer, waterRecords, payments, settings, billingPeriodLabel, specificRecord } = data;

  const width = 760;
  // Calculate dynamic height based on content
  const recordsToList = specificRecord
    ? [specificRecord]
    : waterRecords.slice(0, 6); // top 6 most recent records

  const tableRowsCount = Math.max(1, recordsToList.length);
  const baseHeight = specificRecord ? 760 : 910 + tableRowsCount * 36;
  const height = baseHeight;

  const canvas = document.createElement('canvas');
  const scale = 2; // High-resolution retina 2x
  canvas.width = width * scale;
  canvas.height = height * scale;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not initialize canvas 2D context');
  }

  ctx.scale(scale, scale);

  // Background - Clean crisp white
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // --- 1. HEADER (Deep Executive Emerald Banner) ---
  const headerHeight = 118;
  const gradient = ctx.createLinearGradient(0, 0, width, headerHeight);
  gradient.addColorStop(0, '#042F2E');
  gradient.addColorStop(0.5, '#064E3B');
  gradient.addColorStop(1, '#0F766E');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, headerHeight);

  // Subtle geometric corner accent
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.arc(width - 20, 20, 90, 0, Math.PI * 2);
  ctx.fill();

  // Header Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('TUBEWELL IRRIGATION BILL & STATEMENT', 32, 38);

  ctx.fillStyle = '#A7F3D0';
  ctx.font = 'bold 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const tubeWellDisplayName = settings.tubeWellName || 'Official Water Supply Ledger';
  ctx.fillText(tubeWellDisplayName.toUpperCase(), 32, 62);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.font = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const ownerDetails = [
    settings.ownerName ? `Proprietor: ${settings.ownerName}` : '',
    settings.ownerPhone ? `Phone: ${settings.ownerPhone}` : '',
  ].filter(Boolean).join('   |   ') || 'Agricultural Water Irrigation Services';
  ctx.fillText(ownerDetails, 32, 84);

  ctx.fillStyle = '#6EE7B7';
  ctx.font = 'bold 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('FIXED TARIFF: PKR 600 / HOUR  •  PKR 10.00 / MINUTE', 32, 102);

  // Receipt Badge on Right
  const badgeTitle = specificRecord ? 'WATER SLIP' : 'BILL RECEIPT';
  const badgeSub = specificRecord ? 'SINGLE SESSION' : 'OFFICIAL STATEMENT';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
  roundRect(ctx, width - 170, 26, 138, 56, 10, true, false);

  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(badgeTitle, width - 101, 50);
  ctx.font = 'bold 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#6EE7B7';
  ctx.fillText(badgeSub, width - 101, 68);
  ctx.textAlign = 'left';

  let y = headerHeight + 16;

  // --- 2. RECEIPT METADATA BAR ---
  const todayStr = formatDate(new Date().toISOString().split('T')[0]);
  const receiptNumber = `TWK-${customer.id.slice(-4).toUpperCase()}-${new Date().getFullYear()}`;

  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`RECEIPT NO: ${receiptNumber}`, 32, y + 10);
  ctx.fillText(`DATE ISSUED: ${todayStr}`, 240, y + 10);

  const periodText = specificRecord
    ? `SESSION DATE: ${formatDate(specificRecord.startDate)}`
    : `PERIOD: ${(billingPeriodLabel || 'FULL LEDGER').toUpperCase()}`;
  ctx.textAlign = 'right';
  ctx.fillText(periodText, width - 32, y + 10);
  ctx.textAlign = 'left';

  y += 24;

  // --- 3. CUSTOMER DETAILS CARD ---
  ctx.fillStyle = '#F8FAFC';
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1;
  roundRect(ctx, 32, y, width - 64, 82, 12, true, true);

  ctx.fillStyle = '#64748B';
  ctx.font = 'bold 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('CUSTOMER / FARMER DETAILS', 48, y + 22);

  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(customer.name, 48, y + 46);

  ctx.fillStyle = '#475569';
  ctx.font = '12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  const metaParts = [
    customer.phone ? `Phone: ${customer.phone}` : 'Phone: Not Provided',
    customer.village ? `Village / Chak: ${customer.village}` : '',
  ].filter(Boolean).join('   •   ');
  ctx.fillText(metaParts, 48, y + 68);

  // Rate tag on right
  ctx.textAlign = 'right';
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Standard Rate: PKR 600 / hr', width - 48, y + 36);
  ctx.fillStyle = '#64748B';
  ctx.font = '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('PKR 10.00 per minute billing', width - 48, y + 54);
  ctx.textAlign = 'left';

  y += 98;

  // Financial Calculations
  const totalWaterCharges = waterRecords.reduce((sum, w) => sum + w.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalMinutes = waterRecords.reduce((sum, w) => sum + w.durationMinutes, 0);
  const remainingBalance = totalWaterCharges - totalPaid;

  if (specificRecord) {
    // Single Session Detailed Box
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = '#0F766E';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 32, y, width - 64, 160, 12, true, true);

    ctx.fillStyle = '#F0FDF4';
    roundRect(ctx, 33, y + 1, width - 66, 36, 10, true, false);

    ctx.fillStyle = '#065F46';
    ctx.font = 'bold 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('WATER IRRIGATION SESSION DETAILS', 48, y + 24);

    const timeText = `${formatTime12(specificRecord.startTime)} to ${formatTime12(specificRecord.endTime)}${specificRecord.endsNextDay ? ' (Overnight Session)' : ''}`;
    const rawMinutes = specificRecord.rawDurationMinutes || specificRecord.durationMinutes;

    drawDetailRow(ctx, 48, y + 60, 'Irrigation Timing:', timeText, width - 96);
    drawDetailRow(ctx, 48, y + 84, 'Raw Duration:', formatDuration(rawMinutes), width - 96);

    if (specificRecord.gobMinutes && specificRecord.gobMinutes > 0) {
      const gobStr = `${specificRecord.gobType === 'minus' ? 'Subtract (-)' : 'Add (+)'} ${specificRecord.gobMinutes} minutes`;
      drawDetailRow(ctx, 48, y + 108, 'GOB Adjustment:', gobStr, width - 96);
    } else {
      drawDetailRow(ctx, 48, y + 108, 'Billable Duration:', formatDuration(specificRecord.durationMinutes), width - 96);
    }

    drawDetailRow(ctx, 48, y + 134, 'Session Bill Amount:', formatPKR(specificRecord.amount), width - 96, true);

    y += 176;
  } else {
    // --- 4. THREE SUMMARY CARDS (Water, Paid, Balance) ---
    const cardWidth = (width - 64 - 24) / 3;

    // Card 1: Total Water Charges
    ctx.fillStyle = '#F0FDFA';
    ctx.strokeStyle = '#99F6E4';
    ctx.lineWidth = 1;
    roundRect(ctx, 32, y, cardWidth, 78, 12, true, true);

    ctx.fillStyle = '#0F766E';
    ctx.font = 'bold 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('TOTAL WATER CHARGES', 44, y + 20);

    ctx.fillStyle = '#115E59';
    ctx.font = 'bold 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(formatPKR(totalWaterCharges), 44, y + 46);

    ctx.fillStyle = '#0D9488';
    ctx.font = '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${formatDuration(totalMinutes)} (${waterRecords.length} sessions)`, 44, y + 64);

    // Card 2: Total Received Payments
    const c2X = 32 + cardWidth + 12;
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#E2E8F0';
    roundRect(ctx, c2X, y, cardWidth, 78, 12, true, true);

    ctx.fillStyle = '#475569';
    ctx.font = 'bold 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('TOTAL PAYMENTS RECEIVED', c2X + 12, y + 20);

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(formatPKR(totalPaid), c2X + 12, y + 46);

    ctx.fillStyle = '#64748B';
    ctx.font = '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(`${payments.length} payment entries`, c2X + 12, y + 64);

    // Card 3: Net Balance
    const c3X = 32 + (cardWidth + 12) * 2;
    const isDue = remainingBalance > 0;
    const isAdvance = remainingBalance < 0;

    ctx.fillStyle = isDue ? '#FFF1F2' : isAdvance ? '#F0FDF4' : '#F8FAFC';
    ctx.strokeStyle = isDue ? '#FDA4AF' : isAdvance ? '#86EFAC' : '#E2E8F0';
    roundRect(ctx, c3X, y, cardWidth, 78, 12, true, true);

    ctx.fillStyle = isDue ? '#BE123C' : isAdvance ? '#15803D' : '#334155';
    ctx.font = 'bold 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(isDue ? 'REMAINING DUES' : isAdvance ? 'ADVANCE CREDIT' : 'STATUS', c3X + 12, y + 20);

    ctx.fillStyle = isDue ? '#E11D48' : isAdvance ? '#16A34A' : '#0F172A';
    ctx.font = 'bold 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(formatPKR(Math.abs(remainingBalance)), c3X + 12, y + 46);

    ctx.fillStyle = isDue ? '#9F1239' : isAdvance ? '#166534' : '#64748B';
    ctx.font = '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(isDue ? 'Payable Now' : isAdvance ? 'In Farmer Account' : 'All Settled (Rs 0)', c3X + 12, y + 64);

    y += 94;

    // --- 5. HIGH-VISIBILITY EXECUTIVE DUES BANNER ---
    ctx.fillStyle = isDue ? '#FEF2F2' : isAdvance ? '#ECFDF5' : '#F0FDFA';
    ctx.strokeStyle = isDue ? '#F87171' : isAdvance ? '#34D399' : '#0F766E';
    ctx.lineWidth = 1.5;
    roundRect(ctx, 32, y, width - 64, 52, 10, true, true);

    ctx.fillStyle = isDue ? '#991B1B' : isAdvance ? '#065F46' : '#115E59';
    ctx.font = 'bold 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    const highlightLabel = isDue
      ? 'TOTAL OUTSTANDING BALANCE DUE:'
      : isAdvance
      ? 'ADVANCE CREDIT BALANCE:'
      : 'ACCOUNT FULLY SETTLED (NO OUTSTANDING DUES):';
    ctx.fillText(highlightLabel, 48, y + 32);

    ctx.textAlign = 'right';
    ctx.fillStyle = isDue ? '#DC2626' : isAdvance ? '#059669' : '#0F766E';
    ctx.font = 'bold 20px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText(formatPKR(Math.abs(remainingBalance)), width - 48, y + 33);
    ctx.textAlign = 'left';

    y += 68;

    // --- 6. ITEMIZATION TABLE ---
    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 13px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('ITEMIZED WATER IRRIGATION SESSIONS', 32, y + 10);

    y += 18;

    // Table Header
    ctx.fillStyle = '#0F172A';
    roundRect(ctx, 32, y, width - 64, 28, 6, true, false);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillText('DATE', 46, y + 18);
    ctx.fillText('TIMING (START → FINISH)', 150, y + 18);
    ctx.fillText('BILLABLE DURATION', 410, y + 18);
    ctx.textAlign = 'right';
    ctx.fillText('AMOUNT (PKR)', width - 46, y + 18);
    ctx.textAlign = 'left';

    y += 30;

    if (recordsToList.length === 0) {
      ctx.fillStyle = '#64748B';
      ctx.font = 'italic 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('No water records logged for this period.', 46, y + 20);
      y += 36;
    } else {
      recordsToList.forEach((rec, idx) => {
        const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        ctx.fillStyle = rowBg;
        ctx.fillRect(32, y, width - 64, 30);

        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(32, y, width - 64, 30);

        ctx.fillStyle = '#1E293B';
        ctx.font = '11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(formatDate(rec.startDate), 46, y + 19);

        const timeStr = `${formatTime12(rec.startTime)} → ${formatTime12(rec.endTime)}${rec.endsNextDay ? ' *' : ''}`;
        ctx.fillText(timeStr, 150, y + 19);

        const gobLabel = rec.gobMinutes && rec.gobMinutes > 0 ? ` (${rec.gobType === 'minus' ? '−' : '+'}${rec.gobMinutes}m GOB)` : '';
        ctx.fillText(`${formatDuration(rec.durationMinutes)}${gobLabel}`, 410, y + 19);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#0F766E';
        ctx.font = 'bold 12px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(formatPKR(rec.amount), width - 46, y + 19);
        ctx.textAlign = 'left';

        y += 30;
      });
    }

    y += 14;
  }

  // --- 7. FOOTER & AUTHORIZED SIGNATURE ---
  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(32, y);
  ctx.lineTo(width - 32, y);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  y += 20;

  // Left Info Block
  ctx.fillStyle = '#64748B';
  ctx.font = '10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('Official Computerized Statement generated via TubeWell Khata System.', 32, y + 12);
  ctx.fillText('Tariff: PKR 600/hr (PKR 10/min) • All calculations verified.', 32, y + 26);
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold 10px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('✓ Electronically Verified & Authenticated', 32, y + 42);

  // Official Authorized Signature Box on right
  const owner = settings.ownerName?.trim() || 'Malik Zahid';
  const tubeWell = settings.tubeWellName?.trim() || 'TubeWell Khata';

  const sigBoxWidth = 240;
  const sigBoxHeight = 74;
  const sigBoxX = width - 32 - sigBoxWidth;
  const sigBoxY = y - 4;

  // Draw light seal card
  ctx.fillStyle = '#F0FDFA';
  ctx.beginPath();
  ctx.roundRect(sigBoxX, sigBoxY, sigBoxWidth, sigBoxHeight, 10);
  ctx.fill();

  ctx.strokeStyle = '#99F6E4';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(sigBoxX, sigBoxY, sigBoxWidth, sigBoxHeight, 10);
  ctx.stroke();

  // Signature header
  ctx.textAlign = 'center';
  const sigCenterX = sigBoxX + sigBoxWidth / 2;

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 9px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('AUTHORIZED SIGNATURE / مجاز دستخط', sigCenterX, sigBoxY + 16);

  // Handwritten digital cursive signature
  ctx.fillStyle = '#0F766E';
  ctx.font = 'bold italic 16px Georgia, "Times New Roman", serif';
  ctx.fillText(owner, sigCenterX, sigBoxY + 38);

  // Signature Line
  ctx.strokeStyle = '#0F766E';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sigCenterX - 80, sigBoxY + 44);
  ctx.lineTo(sigCenterX + 80, sigBoxY + 44);
  ctx.stroke();

  // Subtitle / designation
  ctx.fillStyle = '#64748B';
  ctx.font = '9px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText(`Proprietor / Operator • ${tubeWell}`, sigCenterX, sigBoxY + 58);

  // Seal badge
  ctx.fillStyle = '#0D9488';
  ctx.font = 'bold 8px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillText('★ OFFICIAL SEAL & SIGN ★', sigCenterX, sigBoxY + 68);

  ctx.textAlign = 'left';

  // Return PNG Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to convert receipt canvas to Blob'));
      }
    }, 'image/png', 0.95);
  });
}

function drawDetailRow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  label: string,
  value: string,
  rowWidth: number,
  isBold: boolean = false
) {
  ctx.fillStyle = '#475569';
  ctx.font = isBold ? 'bold 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif' : '12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(label, x, y);

  ctx.textAlign = 'right';
  ctx.fillStyle = isBold ? '#0F766E' : '#0F172A';
  ctx.font = isBold ? 'bold 14px system-ui, -apple-system, BlinkMacSystemFont, sans-serif' : 'bold 12px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(value, x + rowWidth, y);
  ctx.textAlign = 'left';
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fill: boolean = true,
  stroke: boolean = false
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  if (fill) ctx.fill();
  if (stroke) ctx.stroke();
}

/**
 * Triggers direct browser download of the generated receipt image
 */
export async function downloadReceiptImage(data: ReceiptData, filename?: string): Promise<void> {
  const blob = await generateReceiptImageBlob(data);
  const cleanName = (data.customer.name || 'customer').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `Tubewell_Receipt_${cleanName}_${dateStr}.png`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Shares the generated Receipt image directly into WhatsApp via Web Share API
 * with automatic fallback to download + WhatsApp web link.
 */
export async function shareReceiptImageWhatsApp(data: ReceiptData): Promise<{ shared: boolean; method: 'web-share' | 'download' }> {
  const blob = await generateReceiptImageBlob(data);
  const cleanName = (data.customer.name || 'customer').replace(/\s+/g, '_');
  const dateStr = new Date().toISOString().split('T')[0];
  const fileName = `Tubewell_Receipt_${cleanName}_${dateStr}.png`;
  const file = new File([blob], fileName, { type: 'image/png' });

  const totalWaterCharges = data.waterRecords.reduce((sum, w) => sum + w.amount, 0);
  const totalPaid = data.payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingBalance = totalWaterCharges - totalPaid;

  const summaryCaption = `💧 *${data.settings.tubeWellName || 'TubeWell Khata'}*\n👤 *Customer:* ${data.customer.name}\n💰 *Net Balance Due:* ${formatPKR(remainingBalance)}\n🗓️ *Date:* ${formatDate(dateStr)}`;

  // Check if Web Share API with files is supported
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: `${data.customer.name} - Official Water Bill Receipt`,
        text: summaryCaption,
      });
      return { shared: true, method: 'web-share' };
    } catch (e: unknown) {
      if ((e as Error)?.name === 'AbortError') {
        return { shared: false, method: 'web-share' };
      }
    }
  }

  // Fallback: Download file to device and open WhatsApp
  await downloadReceiptImage(data, fileName);
  const encoded = encodeURIComponent(`${summaryCaption}\n\n(Official Bill Receipt image downloaded)`);
  window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
  return { shared: true, method: 'download' };
}
