import { StorageService } from './storageService';
import { StaffPerformanceService } from './staffPerformanceService';
import { AuditService } from './auditService';
import { SalarySlip, User, ShopConfig } from '../types';
import { DEFAULT_SHOP_CONFIG } from '../constants';
import { getTodayDateString } from '../utils/format';
import * as XLSX from 'xlsx';
import { NativeModules, Platform, Share } from 'react-native';

const { PdfModule } = NativeModules;

export interface PayrollSummary {
  monthKey: string;
  monthName: string;
  totalPayable: number;
  totalPaid: number;
  totalPending: number;
  totalStaffCount: number;
  paidStaffCount: number;
  pendingStaffCount: number;
  slips: SalarySlip[];
}

export class PayrollService {
  /**
   * Loads or automatically generates payroll slips for all active staff for a given month
   */
  static async getMonthlyPayroll(monthKey: string): Promise<PayrollSummary> {
    const users = await StorageService.getAllUsers();
    const activeStaff = users.filter(u => u.isActive !== false);

    // Fetch existing slips from storage
    const allSlips = await StorageService.getSalarySlips();
    const monthSlips: SalarySlip[] = [];

    for (const staff of activeStaff) {
      let slip = allSlips.find(s => s.staffId === staff.id && s.monthKey === monthKey);
      if (!slip) {
        // Auto-compute draft slip for the staff member
        slip = await StaffPerformanceService.generateSalarySlip(staff, monthKey);
        await StorageService.saveSalarySlip(slip);
      }
      monthSlips.push(slip);
    }

    const totalPayable = monthSlips.reduce((sum, s) => sum + (s.netSalary || 0), 0);
    const paidSlips = monthSlips.filter(s => s.isPaid);
    const totalPaid = paidSlips.reduce((sum, s) => sum + (s.netSalary || 0), 0);
    const totalPending = totalPayable - totalPaid;

    // Format human month name (e.g. "October 2026")
    const [year, month] = monthKey.split('-');
    const dateObj = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const monthName = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

    return {
      monthKey,
      monthName,
      totalPayable,
      totalPaid,
      totalPending,
      totalStaffCount: activeStaff.length,
      paidStaffCount: paidSlips.length,
      pendingStaffCount: activeStaff.length - paidSlips.length,
      slips: monthSlips,
    };
  }

  /**
   * Confirms payment of a staff salary slip.
   * STRICT: Never mark paid unless authorized Admin confirms. Records an immutable audit log.
   */
  static async confirmPayment(
    slipId: string,
    adminUser: User,
    paymentDetails: {
      paymentDate: string;
      paymentMethod: 'Cash' | 'UPI' | 'Bank Transfer';
      paymentReference?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; slip?: SalarySlip; error?: string }> {
    if (!adminUser || adminUser.role !== 'admin' || adminUser.isActive === false) {
      return { success: false, error: 'Unauthorized: Only active store administrators can confirm payroll payments.' };
    }

    const slips = await StorageService.getSalarySlips();
    const index = slips.findIndex(s => s.id === slipId);
    if (index === -1) {
      return { success: false, error: 'Salary slip record not found.' };
    }

    const existingSlip = slips[index];
    const beforeState = { isPaid: existingSlip.isPaid, paymentDate: existingSlip.paymentDate };

    const updatedSlip: SalarySlip = {
      ...existingSlip,
      isPaid: true,
      paymentDate: paymentDetails.paymentDate || getTodayDateString(),
      paymentMethod: paymentDetails.paymentMethod,
      paymentReference: paymentDetails.paymentReference || '',
      paymentNotes: paymentDetails.notes || '',
      paidByAdminId: adminUser.id,
      paidByAdminName: adminUser.name,
    };

    slips[index] = updatedSlip;
    await StorageService.saveSalarySlip(updatedSlip);

    // Record immutable audit entry
    await AuditService.logAction({
      adminId: adminUser.id,
      adminName: adminUser.name,
      actionType: 'salary_payment_confirmed',
      targetRecordId: updatedSlip.id,
      targetRecordTitle: `${updatedSlip.staffName} - ${updatedSlip.month}`,
      details: `Paid ₹${updatedSlip.netSalary} via ${paymentDetails.paymentMethod} on ${updatedSlip.paymentDate}. Reference: ${paymentDetails.paymentReference || 'N/A'}`,
      beforeValue: beforeState,
      afterValue: {
        isPaid: true,
        paymentDate: updatedSlip.paymentDate,
        paymentMethod: updatedSlip.paymentMethod,
        netSalary: updatedSlip.netSalary,
      },
    });

    return { success: true, slip: updatedSlip };
  }

  /**
   * Exports monthly payroll sheet to Excel (.xlsx) and triggers native share
   */
  static async exportPayrollToExcel(
    monthKey: string,
    adminUser: User
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const summary = await this.getMonthlyPayroll(monthKey);
      const shopConfig = (await StorageService.getShopConfig()) || DEFAULT_SHOP_CONFIG;

      const wb = XLSX.utils.book_new();

      const rows = summary.slips.map((s, idx) => ({
        'S.No': idx + 1,
        'Staff Name': s.staffName,
        'Designation': s.designation,
        'Month': s.month,
        'Working Days': s.totalWorkingDays,
        'Present Days': s.presentDays,
        'Late Days': s.lateDays,
        'Basic Salary (₹)': s.basicSalary,
        'Attendance Bonus (₹)': s.attendanceBonus,
        'Sales Incentive (₹)': s.salesIncentive,
        'Deductions (₹)': s.deductions,
        'Net Salary (₹)': s.netSalary,
        'Status': s.isPaid ? 'PAID' : 'PENDING',
        'Payment Date': s.paymentDate || '-',
        'Payment Method': s.paymentMethod || '-',
        'Confirmed By': s.paidByAdminName || '-',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [
        { wch: 6 },
        { wch: 20 },
        { wch: 18 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 12 },
        { wch: 16 },
        { wch: 18 },
        { wch: 18 },
        { wch: 16 },
        { wch: 16 },
        { wch: 12 },
        { wch: 14 },
        { wch: 16 },
        { wch: 18 },
      ];

      XLSX.utils.book_append_sheet(wb, ws, `Payroll_${monthKey}`);

      const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      const fileName = `Parth_Mobile_Care_Payroll_${monthKey}.xlsx`;
      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const shareTitle = `Parth Mobile Care - Payroll ${summary.monthName}`;

      if (Platform.OS === 'android' && PdfModule && typeof PdfModule.exportAndShareFile === 'function') {
        const filePath = await PdfModule.exportAndShareFile(fileName, base64, mimeType, shareTitle);
        return { success: true, filePath };
      }

      await Share.share({
        title: fileName,
        message: `Payroll Summary for ${summary.monthName}\nTotal Payable: ₹${summary.totalPayable}\nPaid: ₹${summary.totalPaid}\nPending: ₹${summary.totalPending}`,
      });

      return { success: true, filePath: fileName };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to export payroll sheet.' };
    }
  }

  /**
   * Exports monthly payroll sheet to CSV format
   */
  static async exportPayrollToCsv(
    monthKey: string,
    adminUser: User
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const summary = await this.getMonthlyPayroll(monthKey);
      const rows = summary.slips.map((s, idx) => ({
        'S.No': idx + 1,
        'Staff Name': s.staffName,
        'Designation': s.designation,
        'Month': s.month,
        'Basic Salary': s.basicSalary,
        'Attendance Bonus': s.attendanceBonus,
        'Sales Incentive': s.salesIncentive,
        'Deductions': s.deductions,
        'Net Salary': s.netSalary,
        'Status': s.isPaid ? 'PAID' : 'PENDING',
        'Payment Date': s.paymentDate || '-',
        'Payment Mode': s.paymentMethod || '-',
      }));

      const ws = XLSX.utils.json_to_sheet(rows);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const base64 = typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(csv))) : Buffer.from(csv).toString('base64');

      const fileName = `Parth_Mobile_Care_Payroll_${monthKey}.csv`;
      const mimeType = 'text/csv';
      const shareTitle = `Parth Mobile Care - Payroll CSV ${summary.monthName}`;

      if (Platform.OS === 'android' && PdfModule && typeof PdfModule.exportAndShareFile === 'function') {
        const filePath = await PdfModule.exportAndShareFile(fileName, base64, mimeType, shareTitle);
        return { success: true, filePath };
      }

      await Share.share({
        title: fileName,
        message: csv,
      });

      return { success: true, filePath: fileName };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Failed to export payroll CSV.' };
    }
  }
}

