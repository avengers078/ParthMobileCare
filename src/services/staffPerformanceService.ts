import { SalarySlip, SalesTarget, User } from '../types';
import { StorageService } from './storageService';
import { getTodayDateString } from '../utils/format';

export class StaffPerformanceService {
  /**
   * Get or initialize monthly sales target for staff
   */
  static async getStaffTarget(staffId: string, monthKey: string = getTodayDateString().substring(0, 7)): Promise<SalesTarget> {
    const targets = await StorageService.getSalesTargets(monthKey);
    let target = targets.find(t => t.staffId === staffId);

    if (!target) {
      const users = await StorageService.getAllUsers();
      const staffUser = users.find(u => u.id === staffId);

      // Default target assignment based on staff profile
      target = {
        id: `target_${staffId}_${monthKey}`,
        staffId,
        staffName: staffUser?.name || 'Staff Member',
        month: monthKey,
        targetAmount: staffUser?.monthlyTarget || 200000,
        achievedAmount: 0,
        targetUnits: 15,
        achievedUnits: 0,
        incentivePercent: 2.0, // 2% incentive on sales above target
        calculatedIncentive: 0,
      };

      // Calculate actual sales made by this staff this month
      const sales = await StorageService.getSales();
      const monthSales = sales.filter(s => s.soldByStaffId === staffId && s.saleDate.startsWith(monthKey));

      target.achievedAmount = monthSales.reduce((sum, s) => sum + s.sellingAmount, 0);
      target.achievedUnits = monthSales.length;

      // Incentive: if achieved > 50% of target, start calculating incentive
      if (target.achievedAmount > 0) {
        target.calculatedIncentive = Math.round((target.achievedAmount * target.incentivePercent) / 100);
      }

      await StorageService.saveSalesTarget(target);
    }

    return target;
  }

  /**
   * Update staff target configuration (Admin/Manager action)
   */
  static async updateStaffTarget(target: SalesTarget): Promise<void> {
    await StorageService.saveSalesTarget(target);
  }

  /**
   * Generate official Salary Slip for Staff
   */
  static async generateSalarySlip(
    staff: User,
    monthKey: string = getTodayDateString().substring(0, 7)
  ): Promise<SalarySlip> {
    const target = await this.getStaffTarget(staff.id, monthKey);
    const attendanceRecords = await StorageService.getAttendanceRecords(staff.id);
    const monthAttendance = attendanceRecords.filter(r => r.date.startsWith(monthKey));

    const totalWorkingDays = 26; // Standard monthly working days
    const presentDays = monthAttendance.filter(r => r.status === 'present' || r.status === 'late').length;
    const lateDays = monthAttendance.filter(r => r.isLate).length;

    // Deductions for unpaid leaves (if presentDays < workingDays)
    const perDaySalary = staff.basicSalary / totalWorkingDays;
    const absentDays = Math.max(0, totalWorkingDays - presentDays);
    const attendanceDeductions = Math.round(absentDays * perDaySalary * 0.5); // 50% deduction on leaves
    const attendanceBonus = lateDays === 0 && presentDays >= 24 ? 2000 : 0; // Punctuality bonus

    const salesIncentive = target.calculatedIncentive || 0;
    const netSalary = Math.round(staff.basicSalary + salesIncentive + attendanceBonus - attendanceDeductions);

    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const [year, monthNum] = monthKey.split('-');
    const monthName = `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`;

    const slip: SalarySlip = {
      id: `slip_${staff.id}_${monthKey}`,
      staffId: staff.id,
      staffName: staff.name,
      designation: staff.designation || 'Staff',
      month: monthName,
      monthKey,
      basicSalary: staff.basicSalary || 20000,
      salesIncentive,
      attendanceBonus,
      deductions: attendanceDeductions,
      netSalary,
      totalWorkingDays,
      presentDays,
      lateDays,
      salesAchieved: target.achievedAmount,
      generatedDate: getTodayDateString(),
      isPaid: false,
    };

    return slip;
  }

  /**
   * Fetch official salary slip for a staff member and month
   * Returns null if no record exists for that period or prior to joinedDate
   */
  static async getSalarySlip(
    staff: User,
    monthKey: string = getTodayDateString().substring(0, 7)
  ): Promise<SalarySlip | null> {
    const currentMonthKey = getTodayDateString().substring(0, 7);

    // If month is prior to employee's joining date or in the future
    if (staff.joinedDate && monthKey < staff.joinedDate.substring(0, 7)) {
      return null;
    }
    if (monthKey > currentMonthKey) {
      return null;
    }

    // 1. Check storage for an archived/approved salary slip
    const storedSlip = await StorageService.getSalarySlipForStaffAndMonth(staff.id, monthKey);
    if (storedSlip) {
      return storedSlip;
    }

    // 2. If it's the current ongoing month, dynamically compute current progress
    if (monthKey === currentMonthKey) {
      return this.generateSalarySlip(staff, monthKey);
    }

    // Past month with no official record issued
    return null;
  }
}
