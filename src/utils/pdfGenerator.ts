import jsPDF from 'jspdf';
import { Customer, WaterRecord, PaymentRecord, AppSettings } from '../types';
import {
  formatPKR,
  formatDate,
  formatTime12,
  formatDuration,
} from './billing';

export interface InvoiceData {
  customer: Customer;
  waterRecords: WaterRecord[];
  payments: PaymentRecord[];
  settings: AppSettings;
  billingPeriodLabel: string;
}

export function generateInvoicePDF(data: InvoiceData): jsPDF {
  const { customer, waterRecords, payments, settings, billingPeriodLabel } = data;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const totalCharges = waterRecords.reduce((sum, w) => sum + w.amount, 0);
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const totalMinutes = waterRecords.reduce((sum, w) => sum + w.durationMinutes, 0);
  const remainingBalance = totalCharges - totalPaid;

  const primaryColor = [8, 124, 113]; // #087C71

  // Header background bar
  doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.rect(0, 0, 210, 36, 'F');

  // Header Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('TUBEWELL KHATA', 14, 18);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(settings.tubeWellName || 'Water Irrigation Billing Ledger', 14, 25);
  if (settings.ownerPhone) {
    doc.text(`Contact: ${settings.ownerPhone} | ${settings.ownerName}`, 14, 30);
  }

  // Invoice / Statement Badge on Right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('IRRIGATION INVOICE', 196, 18, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const todayStr = formatDate(new Date().toISOString().split('T')[0]);
  doc.text(`Date: ${todayStr}`, 196, 25, { align: 'right' });
  doc.text(`Period: ${billingPeriodLabel}`, 196, 30, { align: 'right' });

  // Customer Information Box
  let y = 46;
  doc.setDrawColor(220, 225, 230);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 182, 24, 2, 2, 'FD');

  doc.setTextColor(50, 60, 70);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('CUSTOMER / FARMER DETAILS', 18, y + 6);

  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text(customer.name, 18, y + 13);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  const phoneText = customer.phone ? `Phone: ${customer.phone}` : 'Phone: Not provided';
  const villageText = customer.village ? ` | Village: ${customer.village}` : '';
  doc.text(phoneText + villageText, 18, y + 19);

  // Rate info on right of customer box
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(`Tariff: Rs 600 / hr (Rs 10 / min)`, 192, y + 13, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Fixed Official Rate`, 192, y + 19, { align: 'right' });

  y += 32;

  // Table 1: Water Irrigation Records
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Water Irrigation Records', 14, y);

  y += 4;

  // Table header
  doc.setFillColor(235, 245, 243);
  doc.rect(14, y, 182, 8, 'F');
  doc.setFontSize(9);
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text('Date', 18, y + 5.5);
  doc.text('Start Time', 48, y + 5.5);
  doc.text('End Time', 80, y + 5.5);
  doc.text('Duration', 115, y + 5.5);
  doc.text('Rate', 148, y + 5.5);
  doc.text('Amount', 192, y + 5.5, { align: 'right' });

  y += 8;

  // Table rows
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);

  if (waterRecords.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(140, 150, 160);
    doc.text('No watering sessions recorded for this period.', 18, y + 6);
    y += 10;
  } else {
    waterRecords.forEach((record, index) => {
      // Check page break
      if (y > 250) {
        doc.addPage();
        y = 20;
      }

      if (index % 2 === 1) {
        doc.setFillColor(250, 252, 252);
        doc.rect(14, y, 182, 7, 'F');
      }

      doc.setFontSize(8.5);
      doc.text(formatDate(record.startDate), 18, y + 4.8);
      doc.text(formatTime12(record.startTime), 48, y + 4.8);

      const endDisplay = formatTime12(record.endTime) + (record.endsNextDay ? ' (+1d)' : '');
      doc.text(endDisplay, 80, y + 4.8);
      doc.text(formatDuration(record.durationMinutes), 115, y + 4.8);
      doc.text('Rs 10/min', 148, y + 4.8);

      doc.setFont('helvetica', 'bold');
      doc.text(formatPKR(record.amount), 192, y + 4.8, { align: 'right' });
      doc.setFont('helvetica', 'normal');

      y += 7;
    });
  }

  // Summary of Water charges row
  doc.setDrawColor(200, 210, 220);
  doc.line(14, y, 196, y);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`Total Water Sessions: ${waterRecords.length} (${formatDuration(totalMinutes)})`, 18, y);
  doc.text(`Total Water Charges: ${formatPKR(totalCharges)}`, 192, y, { align: 'right' });

  y += 10;

  // Payments Table if any
  if (payments.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text('Payments Received', 14, y);
    y += 4;

    doc.setFillColor(240, 253, 244);
    doc.rect(14, y, 182, 7, 'F');
    doc.setFontSize(8.5);
    doc.setTextColor(22, 101, 52);
    doc.text('Payment Date', 18, y + 4.8);
    doc.text('Note / Payment Method', 65, y + 4.8);
    doc.text('Paid Amount', 192, y + 4.8, { align: 'right' });

    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 41, 59);

    payments.forEach((pay) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.text(formatDate(pay.date), 18, y + 4.8);
      doc.text(pay.note || 'Cash payment', 65, y + 4.8);
      doc.setFont('helvetica', 'bold');
      doc.text(`-${formatPKR(pay.amount)}`, 192, y + 4.8, { align: 'right' });
      doc.setFont('helvetica', 'normal');
      y += 6.5;
    });

    doc.line(14, y, 196, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Paid: ${formatPKR(totalPaid)}`, 192, y, { align: 'right' });
    y += 8;
  }

  // Final Balance Box
  if (y > 230) {
    doc.addPage();
    y = 20;
  }

  y += 4;

  // Authorized Signature Box on left
  const owner = settings.ownerName?.trim() || 'Malik Zahid';
  const tubeWell = settings.tubeWellName?.trim() || 'TubeWell Khata';

  doc.setDrawColor(200, 220, 215);
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(14, y, 86, 32, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('AUTHORIZED SIGNATURE / تصدیق', 20, y + 8);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.text(owner, 20, y + 17);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Proprietor / Operator • ${tubeWell}`, 20, y + 23);
  doc.setTextColor(22, 101, 52);
  doc.setFont('helvetica', 'bold');
  doc.text('✓ Electronically Verified & Authenticated', 20, y + 28);

  doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
  doc.setFillColor(245, 252, 250);
  doc.roundedRect(110, y, 86, 32, 2, 2, 'FD');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 90, 100);
  doc.text('Total Water Charges:', 116, y + 8);
  doc.text(formatPKR(totalCharges), 190, y + 8, { align: 'right' });

  doc.text('Total Payments Received:', 116, y + 15);
  doc.text(`-${formatPKR(totalPaid)}`, 190, y + 15, { align: 'right' });

  doc.setDrawColor(200, 220, 215);
  doc.line(116, y + 18, 190, y + 18);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');

  if (remainingBalance > 0) {
    doc.setTextColor(190, 24, 24);
    doc.text('NET REMAINING DUE:', 116, y + 26);
    doc.text(formatPKR(remainingBalance), 190, y + 26, { align: 'right' });
  } else if (remainingBalance < 0) {
    doc.setTextColor(22, 101, 52);
    doc.text('CUSTOMER ADVANCE CREDIT:', 116, y + 26);
    doc.text(formatPKR(Math.abs(remainingBalance)), 190, y + 26, { align: 'right' });
  } else {
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('ACCOUNT FULLY SETTLED:', 116, y + 26);
    doc.text('Rs 0', 190, y + 26, { align: 'right' });
  }

  // Footer notes
  const footerY = 282;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(140, 150, 160);
  doc.text(
    'Computer-generated statement by TubeWell Khata — Official irrigation accounting app.',
    105,
    footerY,
    { align: 'center' }
  );

  return doc;
}
