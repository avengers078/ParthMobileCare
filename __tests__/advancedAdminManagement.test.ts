import * as XLSX from 'xlsx';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'test_uid' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
  FirebaseService: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'test_uid' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
}));

import { ReportExportService } from '../src/services/reportExportService';
import { PayrollService } from '../src/services/payrollService';
import { AuditService } from '../src/services/auditService';
import { StorageService } from '../src/services/storageService';
import { User, SalarySlip } from '../src/types';
import { getTodayDateString } from '../src/utils/format';
import { Share } from 'react-native';

describe('Advanced Admin Mobile Management System (Phases 1-6)', () => {
  beforeAll(() => {
    jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' } as any);
  });
  const mockAdminUser: User = {
    id: 'admin_test_1',
    name: 'Parth Patel',
    email: 'admin@parthmobile.com',
    phone: '9876543210',
    role: 'admin',
    designation: 'Store Administrator',
    joinedDate: '2024-01-01',
    basicSalary: 50000,
    monthlyTarget: 500000,
    isActive: true,
  };

  const mockStaffUser: User = {
    id: 'staff_test_1',
    name: 'Suresh Kumar',
    email: 'suresh@parthmobile.com',
    phone: '9876543211',
    role: 'staff',
    designation: 'Sales Executive',
    joinedDate: '2024-02-01',
    basicSalary: 22000,
    monthlyTarget: 200000,
    isActive: true,
  };

  const mockInactiveStaff: User = {
    id: 'staff_test_2',
    name: 'Ramesh Patel',
    email: 'ramesh@parthmobile.com',
    phone: '9876543212',
    role: 'staff',
    designation: 'Sales Staff',
    joinedDate: '2024-03-01',
    basicSalary: 18000,
    monthlyTarget: 150000,
    isActive: false,
  };

  beforeEach(async () => {
    // Seed test users
    await StorageService.saveUser(mockAdminUser);
    await StorageService.saveUser(mockStaffUser);
    await StorageService.saveUser(mockInactiveStaff);
  });

  describe('Phase 1: Advanced Admin Reports and Exports', () => {
    it('accurately verifies date range filters (today, this_week, this_month, custom)', () => {
      const today = getTodayDateString();
      expect(ReportExportService.isDateInRange(today, { dateRange: 'today' })).toBe(true);
      expect(ReportExportService.isDateInRange('2020-01-01', { dateRange: 'today' })).toBe(false);

      expect(ReportExportService.isDateInRange(today, { dateRange: 'this_month' })).toBe(true);
      expect(ReportExportService.isDateInRange('2020-01-01', { dateRange: 'this_month' })).toBe(false);

      expect(
        ReportExportService.isDateInRange('2026-10-15', {
          dateRange: 'custom',
          customStartDate: '2026-10-01',
          customEndDate: '2026-10-31',
        })
      ).toBe(true);
      expect(
        ReportExportService.isDateInRange('2026-11-05', {
          dateRange: 'custom',
          customStartDate: '2026-10-01',
          customEndDate: '2026-10-31',
        })
      ).toBe(false);
    });

    it('generates real CSV export data without crashing', async () => {
      const res = await ReportExportService.exportToCsv(mockAdminUser, true, false, {
        dateRange: 'this_month',
      });
      expect(res.success).toBe(true);
      expect(res.filePath).toBeDefined();
    });

    it('generates category-specific CSV for sales and attendance', async () => {
      const salesCsv = await ReportExportService.exportToCsv(
        mockAdminUser,
        true,
        false,
        { dateRange: 'this_month' },
        'sales_profit'
      );
      expect(salesCsv.success).toBe(true);

      const attCsv = await ReportExportService.exportToCsv(
        mockAdminUser,
        true,
        false,
        { dateRange: 'this_month' },
        'attendance'
      );
      expect(attCsv.success).toBe(true);
    });

    it('generates multi-sheet Excel export for administrators', async () => {
      const res = await ReportExportService.exportToExcel(mockAdminUser, true, false, {
        dateRange: 'this_month',
      });
      expect(res.success).toBe(true);
      expect(res.filePath).toContain('.xlsx');
    });
  });

  describe('Phase 2: Staff Management Search, Sort, Filter & Pagination', () => {
    it('searches staff by name, phone and email', async () => {
      const allUsers = await StorageService.getAllUsers();

      // Search by phone
      const phoneMatch = allUsers.filter(u => u.phone.includes('9876543211'));
      expect(phoneMatch.length).toBeGreaterThanOrEqual(1);
      expect(phoneMatch[0].name).toBe('Suresh Kumar');

      // Search by email
      const emailMatch = allUsers.filter(u => u.email.toLowerCase().includes('suresh@parthmobile.com'));
      expect(emailMatch.length).toBeGreaterThanOrEqual(1);
    });

    it('filters staff by active/inactive status', async () => {
      const allUsers = await StorageService.getAllUsers();
      const activeOnly = allUsers.filter(u => u.isActive === true);
      const inactiveOnly = allUsers.filter(u => u.isActive === false);

      expect(activeOnly.some(u => u.id === mockStaffUser.id)).toBe(true);
      expect(inactiveOnly.some(u => u.id === mockInactiveStaff.id)).toBe(true);
    });

    it('sorts staff by salary descending and name ascending', () => {
      const users = [mockStaffUser, mockAdminUser, mockInactiveStaff];
      const sortedBySalary = [...users].sort((a, b) => b.basicSalary - a.basicSalary);
      expect(sortedBySalary[0].basicSalary).toBe(50000);
      expect(sortedBySalary[1].basicSalary).toBe(22000);
      expect(sortedBySalary[2].basicSalary).toBe(18000);

      const sortedByName = [...users].sort((a, b) => a.name.localeCompare(b.name));
      expect(sortedByName[0].name).toBe('Parth Patel');
    });
  });

  describe('Phase 3: Advanced Salary and Payroll', () => {
    const currentMonthKey = getTodayDateString().substring(0, 7);

    it('computes monthly payroll with total payable, paid, and pending', async () => {
      const payroll = await PayrollService.getMonthlyPayroll(currentMonthKey);
      expect(payroll.totalPayable).toBeGreaterThan(0);
      expect(payroll.totalStaffCount).toBeGreaterThanOrEqual(2);
      expect(payroll.totalPending).toBe(payroll.totalPayable - payroll.totalPaid);
      expect(payroll.slips.length).toBe(payroll.totalStaffCount);
    });

    it('rejects salary confirmation if invoked by non-admin or inactive account', async () => {
      const payroll = await PayrollService.getMonthlyPayroll(currentMonthKey);
      const targetSlip = payroll.slips[0];

      const failResult = await PayrollService.confirmPayment(targetSlip.id, mockStaffUser, {
        paymentDate: getTodayDateString(),
        paymentMethod: 'UPI',
      });
      expect(failResult.success).toBe(false);
      expect(failResult.error).toContain('Unauthorized');
    });

    it('confirms payment when authorized by active Admin and records audit entry', async () => {
      const payroll = await PayrollService.getMonthlyPayroll(currentMonthKey);
      const targetSlip = payroll.slips[0];

      const successResult = await PayrollService.confirmPayment(targetSlip.id, mockAdminUser, {
        paymentDate: getTodayDateString(),
        paymentMethod: 'UPI',
        paymentReference: 'UPI-98234-TEST',
        notes: 'Monthly payout approved by owner',
      });

      expect(successResult.success).toBe(true);
      expect(successResult.slip?.isPaid).toBe(true);
      expect(successResult.slip?.paymentMethod).toBe('UPI');
      expect(successResult.slip?.paidByAdminName).toBe('Parth Patel');

      // Verify audit entry was logged
      const logs = await AuditService.getLogsForRecord(targetSlip.id);
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs[0].actionType).toBe('salary_payment_confirmed');
      expect(logs[0].adminName).toBe('Parth Patel');
    });

    it('exports payroll sheets to Excel and CSV', async () => {
      const excelRes = await PayrollService.exportPayrollToExcel(currentMonthKey, mockAdminUser);
      expect(excelRes.success).toBe(true);

      const csvRes = await PayrollService.exportPayrollToCsv(currentMonthKey, mockAdminUser);
      expect(csvRes.success).toBe(true);
    });
  });

  describe('Phase 4: Aadhaar & KYC Document Security', () => {
    it('masks Aadhaar number digits by default', () => {
      const maskAadhaar = (num?: string): string => {
        if (!num) return 'Not Provided';
        const digits = num.replace(/\D/g, '');
        if (digits.length >= 4) {
          return `•••• •••• ${digits.slice(-4)}`;
        }
        return '•••• •••• ••••';
      };

      expect(maskAadhaar('123456789012')).toBe('•••• •••• 9012');
      expect(maskAadhaar('9876-5432-1098')).toBe('•••• •••• 1098');
      expect(maskAadhaar('')).toBe('Not Provided');
    });
  });

  describe('Phase 5: Admin Append-Only Audit Trail', () => {
    it('records and sanitizes sensitive values in audit logs', async () => {
      const entry = await AuditService.logAction({
        adminId: mockAdminUser.id,
        adminName: mockAdminUser.name,
        actionType: 'staff_create',
        targetRecordId: 'user_xyz',
        targetRecordTitle: 'Test Staff',
        details: 'Staff account provisioned',
        beforeValue: { password: 'secretPassword123', token: 'bearer-token-xyz' },
        afterValue: { name: 'Test Staff', email: 'test@pmc.com', role: 'staff' },
      });

      expect(entry.id).toBeDefined();
      expect(entry.adminName).toBe('Parth Patel');
      expect(entry.beforeValue?.password).toBe('[REDACTED]');
      expect(entry.beforeValue?.token).toBe('[REDACTED]');
      expect(entry.afterValue?.name).toBe('Test Staff');
    });

    it('filters audit logs by action type, target ID, and admin ID', async () => {
      await AuditService.logAction({
        adminId: mockAdminUser.id,
        adminName: mockAdminUser.name,
        actionType: 'settings_update',
        targetRecordId: 'shop_config',
        details: 'Store hours updated',
      });

      const settingsLogs = await AuditService.getLogs({ actionType: 'settings_update' });
      expect(settingsLogs.some(l => l.actionType === 'settings_update')).toBe(true);

      const staffLogs = await AuditService.getLogs({ actionType: 'staff_create' });
      expect(staffLogs.every(l => l.actionType === 'staff_create')).toBe(true);
    });

    it('provides human-readable labels for all action types', () => {
      expect(AuditService.getActionLabel('staff_create')).toBe('Staff Created');
      expect(AuditService.getActionLabel('salary_payment_confirmed')).toBe('Salary Payment Confirmed');
      expect(AuditService.getActionLabel('kyc_document_access')).toBe('KYC Document Accessed');
      expect(AuditService.getActionLabel('settings_update')).toBe('Store Settings Updated');
    });
  });
});
