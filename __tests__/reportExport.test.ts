import * as XLSX from 'xlsx';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'test_uid' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
}));

import { ReportExportService } from '../src/services/reportExportService';
import { StorageService } from '../src/services/storageService';
import { DEFAULT_SHOP_CONFIG } from '../src/constants';
import { CustomerLead, AttendanceRecord, SecondHandPurchase, SecondHandSale, User } from '../src/types';

describe('ReportExportService - Excel (.xlsx) and PDF Export Tests', () => {
  beforeEach(async () => {
    await StorageService.seedInitialDataIfNeeded();
  });

  it('aggregates live report data with accurate financial, lead, and attendance totals', async () => {
    const data = await ReportExportService.getFullReportData(null, true, false);

    expect(data.summaryData).toBeDefined();
    expect(data.summaryData.buySellStats).toBeDefined();
    expect(typeof data.summaryData.buySellStats.totalSalesAmount).toBe('number');
    expect(typeof data.summaryData.buySellStats.totalProfit).toBe('number');
    expect(typeof data.summaryData.leadStats.total).toBe('number');
    expect(typeof data.summaryData.leadStats.conversionRate).toBe('number');
    expect(typeof data.summaryData.attendanceSummary.totalRecords).toBe('number');
    expect(Array.isArray(data.summaryData.staffLeaderboard)).toBe(true);
    expect(data.shopConfig).toBeDefined();
    expect(data.shopConfig.shopName).toContain('Parth');
  });

  it('generates a valid multi-sheet .xlsx Excel workbook that parses cleanly', () => {
    const mockSummary = {
      buySellStats: {
        totalPurchasedUnits: 5,
        inStockCount: 2,
        soldCount: 3,
        totalPurchasedAmount: 45000,
        totalSalesAmount: 60000,
        totalProfit: 15000,
        averageMargin: 33.3,
      },
      leadStats: {
        total: 10,
        newCount: 3,
        followUpCount: 4,
        purchasedCount: 2,
        lostCount: 1,
        conversionRate: 20,
      },
      attendanceSummary: {
        totalRecords: 12,
        onTimePresent: 10,
        lateArrivals: 1,
        earlyExits: 1,
        totalHours: 96,
      },
      staffLeaderboard: [
        {
          id: 'u1',
          name: 'Chetan Patel',
          role: 'admin',
          designation: 'Store Owner',
          salesCount: 3,
          salesAmount: 60000,
          targetAmount: 200000,
          percentAchieved: 30,
          incentiveAmount: 1200,
        },
      ],
      reportingPeriod: 'Month of October 2026',
    };

    const mockLeads: CustomerLead[] = [
      {
        id: 'lead-1',
        name: 'Rahul Sharma',
        phone: '9876543210',
        interestedBrand: 'Vivo',
        interestedModel: 'V50',
        budget: 25000,
        remarks: 'Wants blue color',
        status: 'follow_up',
        followUpDate: '2026-10-28',
        createdBy: 'u1',
        createdByName: 'Chetan Patel',
        createdAt: '2026-10-20T10:00:00Z',
        updatedAt: '2026-10-20T10:00:00Z',
        history: [],
      },
    ];

    const mockAttendance: AttendanceRecord[] = [
      {
        id: 'att-1',
        userId: 'u1',
        userName: 'Chetan Patel',
        userRole: 'admin',
        date: '2026-10-25',
        punchInTime: '09:55:00',
        punchOutTime: '21:00:00',
        status: 'present',
        isLate: false,
        isEarlyExit: false,
        totalHours: 11.0,
      },
    ];

    const mockSales: any[] = [
      {
        id: 'sale-1',
        purchaseRecordId: 'pur-1',
        invoiceNumber: 'INV-2026-001',
        brand: 'Vivo',
        model: 'V50',
        imei: '862910048123456',
        sellingAmount: 24999,
        profitAmount: 2999,
        buyerName: 'Amit Shah',
        phone: '9988776655',
        saleDate: '2026-10-24',
        paymentMethod: 'UPI',
        soldByStaffId: 'u1',
        soldByStaffName: 'Chetan Patel',
      },
    ];

    const { wb, base64 } = ReportExportService.generateExcelWorkbook({
      summaryData: mockSummary,
      purchases: [],
      sales: mockSales,
      leads: mockLeads,
      attendance: mockAttendance,
      shopConfig: DEFAULT_SHOP_CONFIG,
      isPrivileged: true,
    });

    expect(wb).toBeDefined();
    expect(base64).toBeDefined();
    expect(typeof base64).toBe('string');
    expect(base64.length).toBeGreaterThan(100);

    // Read back and validate with XLSX parser
    const parsedWb = XLSX.read(base64, { type: 'base64' });
    expect(parsedWb.SheetNames).toEqual([
      'Summary',
      'Leads',
      'Attendance',
      'Staff Performance',
      'Inventory',
      'Sales',
    ]);

    // Validate Summary sheet content
    const summarySheet = parsedWb.Sheets['Summary'];
    const summaryJson = XLSX.utils.sheet_to_json(summarySheet, { header: 1 }) as any[][];
    expect(summaryJson.length).toBeGreaterThan(5);
    expect(JSON.stringify(summaryJson)).toContain('PARTH MOBILE CARE');
    expect(JSON.stringify(summaryJson)).toContain('Total Sales Revenue');

    // Validate Leads sheet content
    const leadsSheet = parsedWb.Sheets['Leads'];
    const leadsJson = XLSX.utils.sheet_to_json(leadsSheet) as any[];
    expect(leadsJson.length).toBe(1);
    expect(leadsJson[0]['Customer Name']).toBe('Rahul Sharma');
    expect(leadsJson[0]['Model Interested']).toBe('V50');
    expect(leadsJson[0]['Budget (₹)']).toBe(25000);

    // Validate Sales sheet content
    const salesSheet = parsedWb.Sheets['Sales'];
    const salesJson = XLSX.utils.sheet_to_json(salesSheet) as any[];
    expect(salesJson.length).toBe(1);
    expect(salesJson[0]['Invoice No']).toBe('INV-2026-001');
    expect(salesJson[0]['Selling Price (₹)']).toBe(24999);
    expect(salesJson[0]['Gross Profit (₹)']).toBe(2999);
  });

  it('respects staff role restrictions and masks sensitive procurement and profit data in Excel', () => {
    const mockSummary = {
      buySellStats: {
        totalPurchasedUnits: 5,
        inStockCount: 2,
        soldCount: 3,
        totalPurchasedAmount: 45000,
        totalSalesAmount: 60000,
        totalProfit: 15000,
        averageMargin: 33.3,
      },
      leadStats: { total: 0, newCount: 0, followUpCount: 0, purchasedCount: 0, lostCount: 0, conversionRate: 0 },
      attendanceSummary: { totalRecords: 0, onTimePresent: 0, lateArrivals: 0, earlyExits: 0, totalHours: 0 },
      staffLeaderboard: [],
      reportingPeriod: 'Month of October 2026',
    };

    const mockSales: any[] = [
      {
        id: 'sale-1',
        purchaseRecordId: 'pur-1',
        invoiceNumber: 'INV-2026-001',
        brand: 'Samsung',
        model: 'A56',
        imei: '862910048123456',
        sellingAmount: 27999,
        profitAmount: 2999,
        buyerName: 'Karan Patel',
        phone: '9988776655',
        saleDate: '2026-10-24',
        paymentMethod: 'Cash',
        soldByStaffId: 'staff-2',
        soldByStaffName: 'Staff Member',
      },
    ];

    const { base64 } = ReportExportService.generateExcelWorkbook({
      summaryData: mockSummary,
      purchases: [],
      sales: mockSales,
      leads: [],
      attendance: [],
      shopConfig: DEFAULT_SHOP_CONFIG,
      isPrivileged: false, // Staff user
    });

    const parsedWb = XLSX.read(base64, { type: 'base64' });
    const summarySheet = parsedWb.Sheets['Summary'];
    const summaryText = JSON.stringify(XLSX.utils.sheet_to_json(summarySheet, { header: 1 }));
    expect(summaryText).toContain('Restricted');

    const salesSheet = parsedWb.Sheets['Sales'];
    const salesJson = XLSX.utils.sheet_to_json(salesSheet) as any[];
    expect(salesJson[0]['Gross Profit (₹)']).toBe('Restricted');
  });

  it('generates professional printable HTML with brand blue #194D9C and formatted tables for PDF', () => {
    const mockSummary = {
      buySellStats: {
        totalPurchasedUnits: 8,
        inStockCount: 3,
        soldCount: 5,
        totalPurchasedAmount: 85000,
        totalSalesAmount: 110000,
        totalProfit: 25000,
        averageMargin: 29.4,
      },
      leadStats: {
        total: 20,
        newCount: 5,
        followUpCount: 8,
        purchasedCount: 6,
        lostCount: 1,
        conversionRate: 30,
      },
      attendanceSummary: {
        totalRecords: 25,
        onTimePresent: 23,
        lateArrivals: 2,
        earlyExits: 0,
        totalHours: 200,
      },
      staffLeaderboard: [
        {
          id: 'u1',
          name: 'Pooja Mehta',
          role: 'staff',
          designation: 'Sales Executive',
          salesCount: 4,
          salesAmount: 88000,
          targetAmount: 150000,
          percentAchieved: 59,
          incentiveAmount: 1760,
        },
      ],
      reportingPeriod: 'Month of October 2026',
    };

    const html = ReportExportService.generateReportHtml(mockSummary, DEFAULT_SHOP_CONFIG, true);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('#194D9C'); // Brand blue
    expect(html).toContain(DEFAULT_SHOP_CONFIG.shopName);
    expect(html).toContain('₹25,000'); // Gross Profit
    expect(html).toContain('29.4%'); // Avg margin
    expect(html).toContain('Pooja Mehta');
    expect(html).toContain('Sales Executive');
    expect(html).toContain('30%'); // Conversion rate
    expect(html).toContain('200h'); // Store hours
    expect(html).toContain('DIGITALLY VERIFIED BY PARTH MOBILE CARE');
  });
});
