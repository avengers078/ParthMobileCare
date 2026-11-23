import { NativeModules, Platform, Share } from 'react-native';
import { AppAlertService } from '../context/AlertContext';
import * as XLSX from 'xlsx';
import { StorageService } from './storageService';
import { SecondHandService } from './secondHandService';
import { StaffPerformanceService } from './staffPerformanceService';
import { DEFAULT_SHOP_CONFIG } from '../constants';
import { formatCurrency, getTodayDateString } from '../utils/format';
import { CustomerLead, AttendanceRecord, User, ShopConfig, SalarySlip, ReportDateRange } from '../types';

export interface ReportFilterOptions {
  dateRange?: ReportDateRange; // 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom'
  customStartDate?: string; // YYYY-MM-DD
  customEndDate?: string; // YYYY-MM-DD
  staffId?: string; // specific staff ID or 'all'
}

const { PdfModule } = NativeModules;

export interface ReportExportData {
  buySellStats: {
    totalPurchasedUnits: number;
    inStockCount: number;
    soldCount: number;
    totalPurchasedAmount: number;
    totalSalesAmount: number;
    totalProfit: number;
    averageMargin: number;
  };
  leadStats: {
    total: number;
    newCount: number;
    followUpCount: number;
    purchasedCount: number;
    lostCount: number;
    conversionRate: number;
  };
  attendanceSummary: {
    totalRecords: number;
    onTimePresent: number;
    lateArrivals: number;
    earlyExits: number;
    totalHours: number;
  };
  staffLeaderboard: Array<{
    id: string;
    name: string;
    role: string;
    designation: string;
    salesCount: number;
    salesAmount: number;
    targetAmount: number;
    percentAchieved: number;
    incentiveAmount: number;
  }>;
  reportingPeriod?: string;
}

export class ReportExportService {
  /**
   * Helper to check if a record timestamp/date matches selected filter
   */
  static isDateInRange(dateStr?: string, filterOptions?: ReportFilterOptions): boolean {
    if (!filterOptions || !filterOptions.dateRange) return true;
    if (!dateStr) return false;
    const cleanDate = dateStr.substring(0, 10);
    const today = getTodayDateString();

    switch (filterOptions.dateRange) {
      case 'today':
        return cleanDate === today;
      case 'this_week': {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); // Monday
        const startStr = startOfWeek.toISOString().substring(0, 10);
        return cleanDate >= startStr && cleanDate <= today;
      }
      case 'this_month': {
        const currentMonth = today.substring(0, 7);
        return cleanDate.startsWith(currentMonth);
      }
      case 'last_month': {
        const now = new Date();
        now.setMonth(now.getMonth() - 1);
        const lastMonth = now.toISOString().substring(0, 7);
        return cleanDate.startsWith(lastMonth);
      }
      case 'custom': {
        if (filterOptions.customStartDate && cleanDate < filterOptions.customStartDate) return false;
        if (filterOptions.customEndDate && cleanDate > filterOptions.customEndDate) return false;
        return true;
      }
      default:
        return true;
    }
  }

  /**
   * Aggregates live application data respecting current user role permissions and filters
   */
  static async getFullReportData(
    currentUser?: User | null,
    isAdmin: boolean = true,
    isManager: boolean = false,
    filterOptions?: ReportFilterOptions
  ): Promise<{
    summaryData: ReportExportData;
    purchases: any[];
    sales: any[];
    leads: CustomerLead[];
    attendance: AttendanceRecord[];
    salarySlips: SalarySlip[];
    users: User[];
    shopConfig: ShopConfig;
  }> {
    const shopConfig = (await StorageService.getShopConfig()) || DEFAULT_SHOP_CONFIG;
    let purchases = await StorageService.getPurchases();
    let sales = await StorageService.getSales();
    let leads = await StorageService.getLeads();
    let attendance = await StorageService.getAttendanceRecords();
    let salarySlips = await StorageService.getSalarySlips();
    const users = await StorageService.getAllUsers();
    const currentMonthKey = getTodayDateString().substring(0, 7);

    // Date range filtering
    if (filterOptions?.dateRange) {
      purchases = purchases.filter(p => this.isDateInRange(p.purchaseDate, filterOptions));
      sales = sales.filter(s => this.isDateInRange(s.saleDate, filterOptions));
      leads = leads.filter(l => this.isDateInRange(l.createdAt || l.updatedAt, filterOptions));
      attendance = attendance.filter(a => this.isDateInRange(a.date, filterOptions));
      if (filterOptions.dateRange === 'this_month') {
        salarySlips = salarySlips.filter(s => s.monthKey === currentMonthKey);
      }
    }

    // Staff-wise filtering
    const isPrivileged = isAdmin;
    if (!isPrivileged && currentUser) {
      sales = sales.filter(s => s.soldByStaffId === currentUser.id || s.soldByStaffName === currentUser.name);
      attendance = attendance.filter(a => a.userId === currentUser.id || a.userName === currentUser.name);
      leads = leads.filter(l => l.createdBy === currentUser.id || l.assignedTo === currentUser.id);
      salarySlips = salarySlips.filter(s => s.staffId === currentUser.id);
    } else if (filterOptions?.staffId && filterOptions.staffId !== 'all') {
      sales = sales.filter(s => s.soldByStaffId === filterOptions.staffId);
      purchases = purchases.filter(p => p.purchasedByStaffId === filterOptions.staffId);
      attendance = attendance.filter(a => a.userId === filterOptions.staffId);
      leads = leads.filter(l => l.assignedTo === filterOptions.staffId || l.createdBy === filterOptions.staffId);
      salarySlips = salarySlips.filter(s => s.staffId === filterOptions.staffId);
    }

    const totalPurchasedUnits = purchases.length;
    const inStockCount = purchases.filter(p => p.status === 'in_stock').length;
    const soldCount = sales.length;
    const totalPurchasedAmount = isPrivileged
      ? purchases.reduce((sum, p) => sum + (p.purchaseAmount || 0), 0)
      : 0;
    const totalSalesAmount = sales.reduce((sum, s) => sum + (s.sellingAmount || 0), 0);
    const totalProfit = sales.reduce((sum, s) => sum + (s.profitAmount || 0), 0);
    const averageMargin = totalSalesAmount > 0 ? Math.round((totalProfit / totalSalesAmount) * 100) : 0;

    const buySellStats = {
      totalPurchasedUnits,
      inStockCount,
      soldCount,
      totalPurchasedAmount,
      totalSalesAmount,
      totalProfit,
      averageMargin,
    };

    const purchasedLeads = leads.filter(l => l.status === 'purchased').length;
    const leadStats = {
      total: leads.length,
      newCount: leads.filter(l => l.status === 'new').length,
      followUpCount: leads.filter(l => l.status === 'follow_up').length,
      purchasedCount: purchasedLeads,
      lostCount: leads.filter(l => l.status === 'lost').length,
      conversionRate: leads.length > 0 ? Math.round((purchasedLeads / leads.length) * 100) : 0,
    };

    const lateCount = attendance.filter(a => a.isLate).length;
    const earlyCount = attendance.filter(a => a.isEarlyExit).length;
    const hours = attendance.reduce((sum, a) => sum + (a.totalHours || 0), 0);
    const attendanceSummary = {
      totalRecords: attendance.length,
      onTimePresent: attendance.filter(a => a.status === 'present' && !a.isLate).length,
      lateArrivals: lateCount,
      earlyExits: earlyCount,
      totalHours: Math.round(hours * 10) / 10,
    };

    const activeUsers = isPrivileged
      ? users.filter(u => u.isActive !== false)
      : users.filter(u => u.id === currentUser?.id);

    const allSales = await StorageService.getSales();
    const staffLeaderboard = await Promise.all(
      activeUsers.map(async u => {
        const uSales = allSales.filter(s => s.soldByStaffId === u.id || s.soldByStaffName === u.name);
        const uTotalSales = uSales.reduce((sum, s) => sum + (s.sellingAmount || 0), 0);
        const target = await StaffPerformanceService.getStaffTarget(u.id, currentMonthKey);
        return {
          id: u.id,
          name: u.name,
          role: u.role,
          designation: u.designation || (u.role === 'admin' ? 'Store Owner' : 'Sales Staff'),
          salesCount: uSales.length,
          salesAmount: uTotalSales,
          targetAmount: target.targetAmount,
          percentAchieved:
            target.targetAmount > 0
              ? Math.round((uTotalSales / target.targetAmount) * 100)
              : 0,
          incentiveAmount: target.calculatedIncentive || 0,
        };
      })
    );
    staffLeaderboard.sort((a, b) => b.salesAmount - a.salesAmount);

    const now = new Date();
    const currentMonthName = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    const reportingPeriod = `Month of ${currentMonthName} (As of ${now.toLocaleDateString('en-IN')})`;

    return {
      summaryData: {
        buySellStats,
        leadStats,
        attendanceSummary,
        staffLeaderboard,
        reportingPeriod,
      },
      purchases,
      sales,
      leads,
      attendance,
      salarySlips,
      users,
      shopConfig,
    };
  }

  /**
   * Generates a multi-sheet real .xlsx Excel workbook
   */
  static generateExcelWorkbook(data: {
    summaryData: ReportExportData;
    purchases: any[];
    sales: any[];
    leads: CustomerLead[];
    attendance: AttendanceRecord[];
    shopConfig: ShopConfig;
    isPrivileged?: boolean;
  }): { wb: XLSX.WorkBook; base64: string } {
    const { summaryData, purchases, sales, leads, attendance, shopConfig, isPrivileged = true } = data;
    const wb = XLSX.utils.book_new();

    // 1. Summary Sheet
    const summaryAoa: any[][] = [
      ['PARTH MOBILE CARE - STORE BUSINESS REPORT'],
      ['Shop Name:', shopConfig.shopName, 'GSTIN:', shopConfig.gstNumber || 'N/A'],
      ['Address:', shopConfig.shopAddress, 'Phone:', shopConfig.phone],
      ['Reporting Period:', summaryData.reportingPeriod || 'Current Month', 'Export Date:', new Date().toLocaleDateString('en-IN')],
      [],
      ['1. FINANCIAL & SALES SUMMARY'],
      ['Metric', 'Value', 'Notes'],
      ['Total Sales Revenue', summaryData.buySellStats.totalSalesAmount, 'Gross sales from second-hand device transactions'],
      ['Total Stock Purchase Cost', isPrivileged ? summaryData.buySellStats.totalPurchasedAmount : 'Restricted', 'Inventory procurement cost paid to sellers'],
      ['Net Gross Profit', isPrivileged ? summaryData.buySellStats.totalProfit : summaryData.buySellStats.totalProfit, 'Verified profit on completed sales'],
      ['Average Profit Margin', `${summaryData.buySellStats.averageMargin}%`, 'Margin realized on device sales'],
      ['Mobiles In Stock', summaryData.buySellStats.inStockCount, 'Active units currently available in shop'],
      ['Mobiles Sold', summaryData.buySellStats.soldCount, 'Total units sold to customers'],
      [],
      ['2. CUSTOMER LEADS & FUNNEL'],
      ['Funnel Stage', 'Count', 'Conversion Rate'],
      ['Total Leads Captured', summaryData.leadStats.total, '100% of pipeline inquiries'],
      ['Active Follow-Ups', summaryData.leadStats.followUpCount, 'Scheduled follow-ups or interested customers'],
      ['Converted Purchases', summaryData.leadStats.purchasedCount, `${summaryData.leadStats.conversionRate}% overall conversion`],
      ['Pipeline Conversion Rate', `${summaryData.leadStats.conversionRate}%`, 'Percentage of leads successfully purchased'],
      [],
      ['3. ATTENDANCE & DISCIPLINE'],
      ['Metric', 'Count / Hours', 'Discipline Benchmark'],
      ['Total Attendance Punches', summaryData.attendanceSummary.totalRecords, 'GPS verified geofence records'],
      ['On-Time Punches', summaryData.attendanceSummary.onTimePresent, 'Punched in before opening time'],
      ['Late Arrivals (>15m)', summaryData.attendanceSummary.lateArrivals, 'Punched in past grace limit'],
      ['Early Exits', summaryData.attendanceSummary.earlyExits, 'Punched out before closing time'],
      ['Total Working Hours', `${summaryData.attendanceSummary.totalHours} hrs`, 'Cumulative shop floor hours'],
      [
        'Punctuality Rate',
        summaryData.attendanceSummary.totalRecords > 0
          ? `${Math.round((summaryData.attendanceSummary.onTimePresent / summaryData.attendanceSummary.totalRecords) * 100)}%`
          : '100%',
        'On-time percentage across all punches',
      ],
    ];

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
    wsSummary['!cols'] = [{ wch: 30 }, { wch: 25 }, { wch: 45 }];
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

    // 2. Leads Sheet
    const leadRows = leads.map((l, index) => ({
      'S.No': index + 1,
      'Lead ID': l.id || '',
      'Customer Name': l.name || '',
      'Phone Number': l.phone || '',
      'Brand': l.interestedBrand || '',
      'Model Interested': l.interestedModel || '',
      'Budget (₹)': Number(l.budget) || 0,
      'Stage': (l.status || '').toUpperCase(),
      'Follow-Up Date': l.followUpDate || 'None',
      'Created By': l.createdByName || l.createdBy || 'Store Staff',
      'Created Date': l.createdAt ? l.createdAt.substring(0, 10) : 'N/A',
      'Remarks': l.remarks || '',
    }));
    const wsLeads = XLSX.utils.json_to_sheet(leadRows.length > 0 ? leadRows : [
      { 'S.No': 1, 'Customer Name': 'No leads recorded', 'Phone Number': '-', 'Brand': '-', 'Model Interested': '-', 'Budget (₹)': 0, 'Stage': '-' }
    ]);
    wsLeads['!cols'] = [
      { wch: 6 },
      { wch: 14 },
      { wch: 22 },
      { wch: 15 },
      { wch: 14 },
      { wch: 20 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 18 },
      { wch: 14 },
      { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, wsLeads, 'Leads');

    // 3. Attendance Sheet
    const attendanceRows = attendance.map((a, index) => ({
      'S.No': index + 1,
      'Staff Name': a.userName,
      'Staff ID': a.userId,
      'Date': a.date,
      'Punch In': a.punchInTime || 'N/A',
      'Punch Out': a.punchOutTime || 'N/A',
      'Status': a.status.toUpperCase(),
      'Late Arrival': a.isLate ? 'YES' : 'NO',
      'Early Exit': a.isEarlyExit ? 'YES' : 'NO',
      'Total Hours': a.totalHours ?? 0,
    }));
    const wsAttendance = XLSX.utils.json_to_sheet(attendanceRows.length > 0 ? attendanceRows : [
      { 'S.No': 1, 'Staff Name': 'No records', 'Staff ID': '-', 'Date': '-', 'Punch In': '-', 'Punch Out': '-', 'Status': '-' }
    ]);
    wsAttendance['!cols'] = [
      { wch: 6 },
      { wch: 20 },
      { wch: 15 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 10 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsAttendance, 'Attendance');

    // 4. Staff Performance Sheet
    const staffRows = summaryData.staffLeaderboard.map((s, index) => ({
      'Rank': `#${index + 1}`,
      'Staff Name': s.name,
      'Role': s.role.toUpperCase(),
      'Designation': s.designation,
      'Mobiles Sold': s.salesCount,
      'Total Sales Amount (₹)': s.salesAmount,
      'Monthly Target (₹)': s.targetAmount,
      '% Target Achieved': `${s.percentAchieved}%`,
      'Calculated Incentive (₹)': isPrivileged ? s.incentiveAmount : 'Restricted',
      'Status': s.percentAchieved >= 100 ? 'TARGET ACHIEVED' : `${s.salesCount} SOLD`,
    }));
    const wsStaff = XLSX.utils.json_to_sheet(staffRows.length > 0 ? staffRows : [
      { 'Rank': '#1', 'Staff Name': 'No staff records', 'Mobiles Sold': 0, 'Total Sales Amount (₹)': 0 }
    ]);
    wsStaff['!cols'] = [
      { wch: 8 },
      { wch: 22 },
      { wch: 12 },
      { wch: 20 },
      { wch: 14 },
      { wch: 22 },
      { wch: 20 },
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
    ];
    XLSX.utils.book_append_sheet(wb, wsStaff, 'Staff Performance');

    // 5. Inventory Sheet
    const purchaseRows = purchases.map((p, index) => ({
      'S.No': index + 1,
      'Purchase ID': p.id || '',
      'Brand': p.brand || '',
      'Model': p.model || '',
      'RAM / Storage': `${p.ram || 'N/A'} / ${p.storage || 'N/A'}`,
      'IMEI': p.imei || '',
      'Purchase Cost (₹)': isPrivileged ? (Number(p.purchaseAmount) || 0) : 'Restricted',
      'Purchase Date': p.purchaseDate || '',
      'Status': p.status ? p.status.toUpperCase() : 'IN_STOCK',
      'Supplier / Source': p.sellerName || 'Customer Walk-in',
      'Quality Tested': p.qualityScore ? `${p.qualityScore}/10` : 'Verified',
    }));
    const wsPurchases = XLSX.utils.json_to_sheet(purchaseRows.length > 0 ? purchaseRows : [
      { 'S.No': 1, 'Brand': 'No purchases recorded', 'Model': '-', 'IMEI': '-', 'Purchase Cost (₹)': 0 }
    ]);
    wsPurchases['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 14 },
      { wch: 12 },
      { wch: 22 },
      { wch: 16 },
    ];
    XLSX.utils.book_append_sheet(wb, wsPurchases, 'Inventory');

    // 6. Sales Sheet
    const salesRows = sales.map((s, index) => ({
      'S.No': index + 1,
      'Invoice No': s.invoiceNumber || '',
      'Brand & Model': `${s.brand || ''} ${s.model || ''}`.trim(),
      'IMEI': s.imei || '',
      'Selling Price (₹)': Number(s.sellingAmount) || 0,
      'Gross Profit (₹)': isPrivileged ? (Number(s.profitAmount) || 0) : 'Restricted',
      'Sale Date': s.saleDate || '',
      'Customer Name': s.buyerName || '',
      'Customer Phone': s.phone || '',
      'Sold By': s.soldByStaffName || 'Store Staff',
      'Payment Mode': s.paymentMethod || 'UPI / Cash',
    }));
    const wsSales = XLSX.utils.json_to_sheet(salesRows.length > 0 ? salesRows : [
      { 'S.No': 1, 'Invoice No': 'No sales records', 'Brand & Model': '-', 'IMEI': '-', 'Selling Price (₹)': 0 }
    ]);
    wsSales['!cols'] = [
      { wch: 6 },
      { wch: 16 },
      { wch: 24 },
      { wch: 18 },
      { wch: 16 },
      { wch: 16 },
      { wch: 14 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 14 },
    ];
    XLSX.utils.book_append_sheet(wb, wsSales, 'Sales');

    const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
    return { wb, base64 };
  }

  /**
   * Generates a printable A4 HTML report matching brand blue #194D9C
   */
  static generateReportHtml(summaryData: ReportExportData, shopConfig: ShopConfig, isPrivileged: boolean = true): string {
    const punctualityRate =
      summaryData.attendanceSummary.totalRecords > 0
        ? Math.round((summaryData.attendanceSummary.onTimePresent / summaryData.attendanceSummary.totalRecords) * 100)
        : 100;

    const staffRowsHtml = summaryData.staffLeaderboard
      .map(
        (st, idx) => `
      <tr>
        <td style="font-weight: 700; color: #194D9C;">#${idx + 1}</td>
        <td>
          <strong>${st.name}</strong><br>
          <span style="font-size: 11px; color: #64748B;">${st.designation}</span>
        </td>
        <td class="text-right"><strong>${st.salesCount}</strong></td>
        <td class="text-right"><strong>${formatCurrency(st.salesAmount)}</strong></td>
        <td class="text-right">${formatCurrency(st.targetAmount)}</td>
        <td class="text-right">
          <span class="badge ${st.percentAchieved >= 100 ? 'badge-success' : 'badge-info'}">
            ${st.percentAchieved}%
          </span>
        </td>
        ${
          isPrivileged
            ? `<td class="text-right" style="color: #16A34A; font-weight: 700;">+${formatCurrency(st.incentiveAmount)}</td>`
            : ''
        }
      </tr>
    `
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Parth Mobile Care - Business Performance Report</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 15mm;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      margin: 0;
      padding: 16px;
      background: #FFFFFF;
      font-size: 13px;
      line-height: 1.4;
    }
    .header-box {
      border-bottom: 3px solid #194D9C;
      padding-bottom: 12px;
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .shop-name {
      font-size: 24px;
      font-weight: 800;
      color: #194D9C;
      margin: 0;
      letter-spacing: -0.5px;
    }
    .shop-meta {
      font-size: 11px;
      color: #475569;
      margin-top: 3px;
    }
    .report-title-badge {
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      color: #194D9C;
      padding: 6px 14px;
      border-radius: 6px;
      text-align: right;
    }
    .period-title {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
    }
    .period-val {
      font-size: 13px;
      font-weight: 800;
      color: #194D9C;
      margin-top: 2px;
    }
    .section-title {
      font-size: 14px;
      font-weight: 800;
      color: #1E293B;
      border-left: 4px solid #194D9C;
      padding-left: 8px;
      margin-top: 18px;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .kpi-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 10px 12px;
    }
    .kpi-label {
      font-size: 10px;
      font-weight: 600;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .kpi-val {
      font-size: 17px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 3px;
    }
    .kpi-card.highlight {
      background: #F0FDF4;
      border-color: #DCFCE7;
    }
    .kpi-card.highlight .kpi-val {
      color: #15803D;
    }
    .kpi-card.primary {
      background: #EFF6FF;
      border-color: #DBEAFE;
    }
    .kpi-card.primary .kpi-val {
      color: #194D9C;
    }
    .inventory-strip {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      display: flex;
      justify-content: space-around;
      padding: 8px 12px;
      margin-bottom: 14px;
    }
    .inv-col {
      text-align: center;
    }
    .inv-col-label {
      font-size: 10px;
      color: #64748B;
      text-transform: uppercase;
      font-weight: 600;
    }
    .inv-col-val {
      font-size: 14px;
      font-weight: 800;
      color: #0F172A;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 14px;
      font-size: 12px;
    }
    th {
      background: #F1F5F9;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
      padding: 8px 10px;
      border-bottom: 2px solid #CBD5E1;
      text-align: left;
    }
    td {
      padding: 8px 10px;
      border-bottom: 1px solid #E2E8F0;
    }
    .text-right {
      text-align: right;
    }
    .badge {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
    }
    .badge-success {
      background: #DCFCE7;
      color: #15803D;
    }
    .badge-info {
      background: #EFF6FF;
      color: #194D9C;
    }
    .footer-section {
      margin-top: 30px;
      padding-top: 14px;
      border-top: 1px dashed #CBD5E1;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .stamp-box {
      border: 1px solid #16A34A;
      background: #F0FDF4;
      color: #15803D;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      display: inline-block;
    }
    .sign-area {
      text-align: right;
      min-width: 180px;
    }
    .sign-line {
      border-top: 1px solid #0F172A;
      margin-top: 36px;
      padding-top: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div class="header-box">
    <div>
      <h1 class="shop-name">${shopConfig.shopName}</h1>
      <div class="shop-meta">${shopConfig.shopAddress}</div>
      <div class="shop-meta">GSTIN: ${shopConfig.gstNumber || 'Unregistered'} | Phone: ${shopConfig.phone}</div>
    </div>
    <div class="report-title-badge">
      <div class="period-title">Business Analytics Report</div>
      <div class="period-val">${summaryData.reportingPeriod || 'Current Month'}</div>
    </div>
  </div>

  <!-- 1. Financial & Inventory Summary -->
  <div class="section-title">1. Financial & Buy/Sell Performance</div>
  <div class="kpi-grid">
    <div class="kpi-card highlight">
      <div class="kpi-label">Gross Profit</div>
      <div class="kpi-val">${formatCurrency(summaryData.buySellStats.totalProfit)}</div>
    </div>
    <div class="kpi-card primary">
      <div class="kpi-label">Avg Profit Margin</div>
      <div class="kpi-val">${summaryData.buySellStats.averageMargin}%</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Sales Revenue</div>
      <div class="kpi-val">${formatCurrency(summaryData.buySellStats.totalSalesAmount)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Purchase Cost</div>
      <div class="kpi-val">${isPrivileged ? formatCurrency(summaryData.buySellStats.totalPurchasedAmount) : 'Restricted'}</div>
    </div>
  </div>

  <div class="inventory-strip">
    <div class="inv-col">
      <div class="inv-col-label">Mobiles in Stock</div>
      <div class="inv-col-val" style="color: #15803D;">${summaryData.buySellStats.inStockCount} units</div>
    </div>
    <div class="inv-col" style="border-left: 1px solid #CBD5E1; padding-left: 20px;">
      <div class="inv-col-label">Mobiles Sold</div>
      <div class="inv-col-val" style="color: #194D9C;">${summaryData.buySellStats.soldCount} units</div>
    </div>
    <div class="inv-col" style="border-left: 1px solid #CBD5E1; padding-left: 20px;">
      <div class="inv-col-label">Lead Conversion</div>
      <div class="inv-col-val" style="color: #15803D;">${summaryData.leadStats.conversionRate}%</div>
    </div>
    <div class="inv-col" style="border-left: 1px solid #CBD5E1; padding-left: 20px;">
      <div class="inv-col-label">Store Punctuality</div>
      <div class="inv-col-val" style="color: #194D9C;">${punctualityRate}%</div>
    </div>
  </div>

  <!-- 2. Lead Pipeline & Conversion -->
  <div class="section-title">2. Customer Leads Funnel</div>
  <table>
    <thead>
      <tr>
        <th>Pipeline Stage</th>
        <th>Description</th>
        <th class="text-right">Count</th>
        <th class="text-right">Stage Share</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>Total Leads Captured</strong></td>
        <td>Registered walk-in and digital inquiries</td>
        <td class="text-right"><strong>${summaryData.leadStats.total}</strong></td>
        <td class="text-right">100%</td>
      </tr>
      <tr>
        <td><strong>Active Follow-Ups</strong></td>
        <td>Scheduled follow-ups or interested customers</td>
        <td class="text-right"><strong>${summaryData.leadStats.followUpCount}</strong></td>
        <td class="text-right">
          ${summaryData.leadStats.total > 0 ? Math.round((summaryData.leadStats.followUpCount / summaryData.leadStats.total) * 100) : 0}%
        </td>
      </tr>
      <tr>
        <td><strong>Converted Purchases</strong></td>
        <td>Inquiries successfully closed as mobile sales</td>
        <td class="text-right" style="color: #15803D;"><strong>${summaryData.leadStats.purchasedCount}</strong></td>
        <td class="text-right" style="color: #15803D; font-weight: 700;">${summaryData.leadStats.conversionRate}%</td>
      </tr>
    </tbody>
  </table>

  <!-- 3. Attendance Discipline -->
  <div class="section-title">3. Staff Attendance & Discipline (30m Geofence)</div>
  <div class="kpi-grid">
    <div class="kpi-card highlight">
      <div class="kpi-label">On-Time Punches</div>
      <div class="kpi-val">${summaryData.attendanceSummary.onTimePresent}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Late Arrivals (>15m)</div>
      <div class="kpi-val" style="color: #D97706;">${summaryData.attendanceSummary.lateArrivals}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Early Exits</div>
      <div class="kpi-val" style="color: #DC2626;">${summaryData.attendanceSummary.earlyExits}</div>
    </div>
    <div class="kpi-card primary">
      <div class="kpi-label">Total Store Hours</div>
      <div class="kpi-val">${summaryData.attendanceSummary.totalHours}h</div>
    </div>
  </div>

  <!-- 4. Staff Performance -->
  <div class="section-title">4. Staff Sales & Target Achievements</div>
  <table>
    <thead>
      <tr>
        <th>Rank</th>
        <th>Staff Member</th>
        <th class="text-right">Units Sold</th>
        <th class="text-right">Sales Amount (₹)</th>
        <th class="text-right">Target (₹)</th>
        <th class="text-right">Achievement</th>
        ${isPrivileged ? '<th class="text-right">Incentive (₹)</th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${staffRowsHtml || '<tr><td colspan="7" style="text-align: center; color: #64748B;">No staff sales records available.</td></tr>'}
    </tbody>
  </table>

  <!-- Footer Verification -->
  <div class="footer-section">
    <div>
      <div class="stamp-box">✓ DIGITALLY VERIFIED BY PARTH MOBILE CARE</div>
      <div style="font-size: 11px; color: #64748B; margin-top: 6px;">
        Generated on: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
    <div class="sign-area">
      <div class="sign-line">Authorized Signatory / Store Manager</div>
    </div>
  </div>
</body>
</html>
    `;
  }

  /**
   * Executes PDF export via native PrintManager or fallback
   */
  static async exportToPdf(summaryData: ReportExportData, shopConfig: ShopConfig, isPrivileged: boolean = true): Promise<boolean> {
    const html = this.generateReportHtml(summaryData, shopConfig, isPrivileged);
    const dateStr = getTodayDateString();
    const jobName = `Business_Report_${dateStr}`;

    if (Platform.OS === 'android' && PdfModule && typeof PdfModule.printHtml === 'function') {
      try {
        await PdfModule.printHtml(html, jobName);
        return true;
      } catch (e: any) {
        console.warn('Native PDF print error:', e);
      }
    }

    // Fallback: Share formatted text
    try {
      await Share.share({
        title: jobName,
        message: `Parth Mobile Care Business Report (${dateStr})\nRevenue: ${formatCurrency(summaryData.buySellStats.totalSalesAmount)}\nGross Profit: ${formatCurrency(summaryData.buySellStats.totalProfit)}\nIn Stock: ${summaryData.buySellStats.inStockCount} | Sold: ${summaryData.buySellStats.soldCount}`,
      });
      return true;
    } catch (e: any) {
      AppAlertService.showError('Share Error', e?.message || 'Could not share report.');
      return false;
    }
  }

  /**
   * Executes Excel (.xlsx) export via real workbook generation, saving to cache/downloads, and native sharing
   */
  static async exportToExcel(
    currentUser?: User | null,
    isAdmin: boolean = true,
    isManager: boolean = false,
    filterOptions?: ReportFilterOptions
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const isPrivileged = isAdmin;
      const data = await this.getFullReportData(currentUser, isAdmin, isManager, filterOptions);
      const { base64 } = this.generateExcelWorkbook({
        summaryData: data.summaryData,
        purchases: data.purchases,
        sales: data.sales,
        leads: data.leads,
        attendance: data.attendance,
        shopConfig: data.shopConfig,
        isPrivileged,
      });

      const dateStr = getTodayDateString();
      const fileName = `Parth_Mobile_Care_Business_Report_${dateStr}.xlsx`;
      const mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const shareTitle = 'Parth Mobile Care - Business Report (.xlsx)';

      // Primary Android flow: use native PdfModule.exportAndShareFile
      if (Platform.OS === 'android' && PdfModule && typeof PdfModule.exportAndShareFile === 'function') {
        const filePath = await PdfModule.exportAndShareFile(
          fileName,
          base64,
          mimeType,
          shareTitle
        );
        return { success: true, filePath };
      }

      // Fallback sharing for environments without exportAndShareFile
      await Share.share({
        title: fileName,
        message: `Parth Mobile Care Business Report (${fileName}) ready for export.`,
      });

      return { success: true, filePath: fileName };
    } catch (e: any) {
      console.warn('Excel export error:', e);
      return { success: false, error: e?.message || 'Failed to export Excel report' };
    }
  }

  /**
   * Executes CSV export via RFC 4180 format, base64 encoding, and native Android sharing
   */
  static async exportToCsv(
    currentUser?: User | null,
    isAdmin: boolean = true,
    isManager: boolean = false,
    filterOptions?: ReportFilterOptions,
    category?: 'overview' | 'sales_profit' | 'attendance' | 'leads' | 'purchases' | 'salary'
  ): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const isPrivileged = isAdmin;
      const data = await this.getFullReportData(currentUser, isAdmin, isManager, filterOptions);
      const dateStr = getTodayDateString();
      let csvContent = '';
      let fileName = `Parth_Mobile_Care_Report_${dateStr}.csv`;

      if (category === 'sales_profit') {
        fileName = `Parth_Mobile_Care_Sales_${dateStr}.csv`;
        const rows = data.sales.map((s, idx) => ({
          'S.No': idx + 1,
          'Invoice': s.invoiceNumber || '',
          'Brand': s.brand || '',
          'Model': s.model || '',
          'IMEI': s.imei || '',
          'Selling Amount': s.sellingAmount || 0,
          'Gross Profit': isPrivileged ? (s.profitAmount || 0) : 'Restricted',
          'Date': s.saleDate || '',
          'Customer': s.buyerName || '',
          'Sold By': s.soldByStaffName || '',
          'Payment Mode': s.paymentMethod || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'S.No': 1, 'Status': 'No sales records found' }]);
        csvContent = XLSX.utils.sheet_to_csv(ws);
      } else if (category === 'attendance') {
        fileName = `Parth_Mobile_Care_Attendance_${dateStr}.csv`;
        const rows = data.attendance.map((a, idx) => ({
          'S.No': idx + 1,
          'Staff Name': a.userName || '',
          'Date': a.date || '',
          'Status': (a.status || '').toUpperCase(),
          'Punch In': a.punchInTime || '-',
          'Punch Out': a.punchOutTime || '-',
          'Hours': a.totalHours || 0,
          'Late': a.isLate ? 'YES' : 'NO',
          'Early Exit': a.isEarlyExit ? 'YES' : 'NO',
        }));
        const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'S.No': 1, 'Status': 'No attendance records found' }]);
        csvContent = XLSX.utils.sheet_to_csv(ws);
      } else if (category === 'leads') {
        fileName = `Parth_Mobile_Care_Leads_${dateStr}.csv`;
        const rows = data.leads.map((l, idx) => ({
          'S.No': idx + 1,
          'Customer Name': l.name || '',
          'Phone': l.phone || '',
          'Brand': l.interestedBrand || '',
          'Model': l.interestedModel || '',
          'Budget': l.budget || 0,
          'Stage': (l.status || '').toUpperCase(),
          'Follow Up': l.followUpDate || '-',
          'Assigned To': l.assignedToName || l.createdByName || '',
        }));
        const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'S.No': 1, 'Status': 'No leads records found' }]);
        csvContent = XLSX.utils.sheet_to_csv(ws);
      } else if (category === 'salary') {
        fileName = `Parth_Mobile_Care_Salary_${dateStr}.csv`;
        const rows = data.salarySlips.map((s, idx) => ({
          'S.No': idx + 1,
          'Staff Name': s.staffName || '',
          'Designation': s.designation || '',
          'Month': s.month || '',
          'Basic Salary': s.basicSalary || 0,
          'Sales Incentive': s.salesIncentive || 0,
          'Attendance Bonus': s.attendanceBonus || 0,
          'Deductions': s.deductions || 0,
          'Net Salary': s.netSalary || 0,
          'Status': s.isPaid ? 'PAID' : 'PENDING',
        }));
        const ws = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 'S.No': 1, 'Status': 'No salary records found' }]);
        csvContent = XLSX.utils.sheet_to_csv(ws);
      } else {
        const { wb } = this.generateExcelWorkbook({
          summaryData: data.summaryData,
          purchases: data.purchases,
          sales: data.sales,
          leads: data.leads,
          attendance: data.attendance,
          shopConfig: data.shopConfig,
          isPrivileged,
        });
        const firstSheetName = wb.SheetNames[0];
        csvContent = XLSX.utils.sheet_to_csv(wb.Sheets[firstSheetName]);
      }

      const base64 = typeof btoa === 'function'
        ? btoa(unescape(encodeURIComponent(csvContent)))
        : Buffer.from(csvContent).toString('base64');
      const mimeType = 'text/csv';
      const shareTitle = `Parth Mobile Care - Report (${fileName})`;

      if (Platform.OS === 'android' && PdfModule && typeof PdfModule.exportAndShareFile === 'function') {
        const filePath = await PdfModule.exportAndShareFile(fileName, base64, mimeType, shareTitle);
        return { success: true, filePath };
      }

      await Share.share({
        title: fileName,
        message: csvContent,
      });

      return { success: true, filePath: fileName };
    } catch (e: any) {
      console.warn('CSV export error:', e);
      return { success: false, error: e?.message || 'Failed to export CSV report' };
    }
  }
}
