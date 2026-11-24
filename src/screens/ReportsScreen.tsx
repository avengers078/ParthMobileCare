import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  StatusBadge,
  FilterChip,
  SectionHeader,
  EmptyState,
  AppIcon,
  ModalCard,
} from '../components';
import { StorageService } from '../services/storageService';
import { SecondHandService } from '../services/secondHandService';
import { StaffPerformanceService } from '../services/staffPerformanceService';
import { ReportExportService } from '../services/reportExportService';
import { PayrollService, PayrollSummary } from '../services/payrollService';
import { formatCurrency, getTodayDateString } from '../utils/format';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';
import { User, ReportDateRange } from '../types';

interface StaffLeaderboardItem {
  id: string;
  name: string;
  role: string;
  designation: string;
  salesCount: number;
  salesAmount: number;
  targetAmount: number;
  percentAchieved: number;
  incentiveAmount: number;
}

export const ReportsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();
  const { currentUser, isAdmin } = useAuth();
  const { showError, showSuccess } = useAlert();

  const [activeReport, setActiveReport] = useState<
    'sales_profit' | 'attendance' | 'leads' | 'salary' | 'staff_perf'
  >('sales_profit');

  // Filters State
  const [dateRange, setDateRange] = useState<ReportDateRange>('this_month');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [staffOptions, setStaffOptions] = useState<User[]>([]);

  const [buySellStats, setBuySellStats] = useState<any>({
    totalPurchasedUnits: 0,
    inStockCount: 0,
    soldCount: 0,
    totalPurchasedAmount: 0,
    totalSalesAmount: 0,
    totalProfit: 0,
    averageMargin: 0,
  });

  const [leadStats, setLeadStats] = useState({
    total: 0,
    newCount: 0,
    followUpCount: 0,
    purchasedCount: 0,
    lostCount: 0,
    conversionRate: 0,
  });

  const [attendanceSummary, setAttendanceSummary] = useState({
    totalRecords: 0,
    onTimePresent: 0,
    lateArrivals: 0,
    earlyExits: 0,
    totalHours: 0,
  });

  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(null);
  const [staffLeaderboard, setStaffLeaderboard] = useState<StaffLeaderboardItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Export State
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingType, setExportingType] = useState<'excel' | 'pdf' | 'csv' | null>(null);

  const loadAllReports = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const filterOpts = {
        dateRange,
        staffId: selectedStaffId,
      };

      // Parallelize all independent data fetches
      const currentMonthKey = getTodayDateString().substring(0, 7);
      const [fullData, users, payroll] = await Promise.all([
        ReportExportService.getFullReportData(currentUser, isAdmin, false, filterOpts),
        StorageService.getAllUsers(),
        PayrollService.getMonthlyPayroll(currentMonthKey),
      ]);

      setBuySellStats(fullData.summaryData.buySellStats);
      setLeadStats(fullData.summaryData.leadStats);
      setAttendanceSummary(fullData.summaryData.attendanceSummary);
      setStaffLeaderboard(fullData.summaryData.staffLeaderboard);

      const activeStaff = users.filter(u => u.isActive !== false);
      setStaffOptions(activeStaff);
      setPayrollSummary(payroll);
    } catch (e: any) {
      if (__DEV__) console.warn('Reports load error:', e);
      setLoadError(e?.message || 'Failed to aggregate business reports.');
    } finally {
      setIsLoading(false);
    }
  }, [dateRange, selectedStaffId, currentUser, isAdmin]);

  useEffect(() => {
    loadAllReports();
  }, [loadAllReports]);

  const handleExportExcel = async () => {
    setIsExporting(true);
    setExportingType('excel');
    try {
      const result = await ReportExportService.exportToExcel(currentUser, isAdmin, false, {
        dateRange,
        staffId: selectedStaffId,
      });
      if (!result.success) {
        showError('Export Failed', result.error || 'Failed to export Excel report.');
      } else {
        setExportModalVisible(false);
      }
    } catch (e: any) {
      showError('Export Failed', e?.message || 'An unexpected error occurred during Excel export.');
    } finally {
      setIsExporting(false);
      setExportingType(null);
    }
  };

  const handleExportCsv = async () => {
    setIsExporting(true);
    setExportingType('csv');
    try {
      const result = await ReportExportService.exportToCsv(
        currentUser,
        isAdmin,
        false,
        {
          dateRange,
          staffId: selectedStaffId,
        },
        activeReport as any
      );
      if (!result.success) {
        showError('Export Failed', result.error || 'Failed to export CSV report.');
      } else {
        setExportModalVisible(false);
      }
    } catch (e: any) {
      showError('Export Failed', e?.message || 'An unexpected error occurred during CSV export.');
    } finally {
      setIsExporting(false);
      setExportingType(null);
    }
  };

  const handleExportPdf = async () => {
    setIsExporting(true);
    setExportingType('pdf');
    try {
      const data = await ReportExportService.getFullReportData(currentUser, isAdmin, false, {
        dateRange,
        staffId: selectedStaffId,
      });
      const success = await ReportExportService.exportToPdf(data.summaryData, data.shopConfig, isAdmin);
      if (success) {
        setExportModalVisible(false);
      }
    } catch (e: any) {
      showError('Export Failed', e?.message || 'An unexpected error occurred during PDF export.');
    } finally {
      setIsExporting(false);
      setExportingType(null);
    }
  };

  const punctualityRate = useMemo(() =>
    attendanceSummary.totalRecords > 0
      ? Math.round((attendanceSummary.onTimePresent / attendanceSummary.totalRecords) * 100)
      : 100, [attendanceSummary.totalRecords, attendanceSummary.onTimePresent]);

  if (!isAdmin) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <AppHeader
          title="Reports"
          subtitle="Store Analytics & Summaries"
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl }}>
          <EmptyState
            title="Unauthorized Access"
            description="Reports and shop financial analytics are restricted to store administrators."
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      {/* 1. Header with Title, Subtitle, Theme Toggle & Admin Badge */}
      <AppHeader
        title="Reports"
        subtitle="Store Analytics & Summaries"
      />

      {/* 2. Horizontally Scrollable Category Tabs */}
      <View style={styles.tabsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reportTabs}
        >
          {[
            {
              key: 'sales_profit',
              label: 'Profit & Margins',
              icon: <AppIcon name="wallet" size={15} color={activeReport === 'sales_profit' ? '#FFFFFF' : colors.success} />,
            },
            {
              key: 'leads',
              label: 'Lead Funnel',
              icon: <AppIcon name="users" size={15} color={activeReport === 'leads' ? '#FFFFFF' : colors.primary} />,
            },
            {
              key: 'attendance',
              label: 'Attendance',
              icon: <AppIcon name="location" size={15} color={activeReport === 'attendance' ? '#FFFFFF' : colors.warning} />,
            },
            {
              key: 'salary',
              label: 'Salary & Payroll',
              icon: <AppIcon name="wallet" size={15} color={activeReport === 'salary' ? '#FFFFFF' : colors.accent} />,
            },
            {
              key: 'staff_perf',
              label: 'Performance',
              icon: <AppIcon name="analytics" size={15} color={activeReport === 'staff_perf' ? '#FFFFFF' : colors.primary} />,
            },
          ].map(t => (
            <FilterChip
              key={t.key}
              label={t.label}
              icon={t.icon}
              active={activeReport === t.key}
              onPress={() => setActiveReport(t.key as any)}
            />
          ))}
        </ScrollView>

        {/* Quick Date Range Filter */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.reportTabs, { marginTop: 6 }]}
        >
          {[
            { key: 'today', label: 'Today' },
            { key: 'this_week', label: 'This Week' },
            { key: 'this_month', label: 'This Month' },
            { key: 'last_month', label: 'Last Month' },
          ].map(d => (
            <FilterChip
              key={d.key}
              label={d.label}
              active={dateRange === d.key}
              onPress={() => setDateRange(d.key as any)}
            />
          ))}

          {/* Quick Staff Filter */}
          <FilterChip
            label={selectedStaffId === 'all' ? 'All Staff' : 'Selected Staff'}
            active={selectedStaffId !== 'all'}
            onPress={() => {
              // Cycle through staff or reset to all
              if (selectedStaffId === 'all' && staffOptions.length > 0) {
                setSelectedStaffId(staffOptions[0].id);
              } else {
                const curIdx = staffOptions.findIndex(s => s.id === selectedStaffId);
                if (curIdx >= 0 && curIdx < staffOptions.length - 1) {
                  setSelectedStaffId(staffOptions[curIdx + 1].id);
                } else {
                  setSelectedStaffId('all');
                }
              }
            }}
          />
        </ScrollView>
      </View>

      {/* 3. Main Content Container */}
      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Aggregating store performance metrics...
          </Text>
        </View>
      ) : loadError ? (
        <View style={styles.centeredState}>
          <EmptyState
            title="Unable to Load Reports"
            description={loadError}
            actionTitle="Try Again"
            onActionPress={loadAllReports}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* --- Tab 1: Profit & Margins --- */}
          {activeReport === 'sales_profit' && (
            <AppCard style={styles.cardWrapper}>
              <SectionHeader
                title="Profit & Margins"
                subtitle="Calculated from verified purchase and sale records"
                style={styles.sectionHeader}
              />

              {/* 2x2 Metric Grid */}
              <View style={styles.statGrid}>
                {/* Total Gross Profit */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4',
                      borderColor: isDark ? 'rgba(34,197,94,0.25)' : '#DCFCE7',
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.accent }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatCurrency(buySellStats.totalProfit)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Gross Profit
                  </Text>
                </View>

                {/* Average Margin */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF',
                      borderColor: isDark ? 'rgba(37,99,235,0.25)' : '#DBEAFE',
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.primary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {buySellStats.averageMargin}%
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Avg Profit Margin
                  </Text>
                </View>

                {/* Total Sales Revenue */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.text }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatCurrency(buySellStats.totalSalesAmount)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Total Sales Revenue
                  </Text>
                </View>

                {/* Total Purchase Cost */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.textSecondary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatCurrency(buySellStats.totalPurchasedAmount)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Total Purchase Cost
                  </Text>
                  <Text style={[styles.statSubLabel, { color: colors.textMuted }]}>
                    Stock Procurement
                  </Text>
                </View>
              </View>

              {/* Compact 2-Column Inventory Strip */}
              <View
                style={[
                  styles.summaryStrip,
                  {
                    borderTopColor: colors.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                  },
                ]}
              >
                <View style={styles.summaryCol}>
                  <Text style={[styles.summaryColLabel, { color: colors.textSecondary }]}>
                    Mobiles In Stock
                  </Text>
                  <Text style={[styles.summaryColVal, { color: colors.accent }]}>
                    {buySellStats.inStockCount} units
                  </Text>
                </View>

                <View style={[styles.summaryVDivider, { backgroundColor: colors.border }]} />

                <View style={styles.summaryCol}>
                  <Text style={[styles.summaryColLabel, { color: colors.textSecondary }]}>
                    Mobiles Sold
                  </Text>
                  <Text style={[styles.summaryColVal, { color: colors.text }]}>
                    {buySellStats.soldCount} units
                  </Text>
                </View>
              </View>
            </AppCard>
          )}

          {/* --- Tab 2: Lead Funnel --- */}
          {activeReport === 'leads' && (
            <AppCard style={styles.cardWrapper}>
              <SectionHeader
                title="Lead Funnel & Conversion"
                subtitle="Customer inquiry progression to completed sales"
                style={styles.sectionHeader}
              />

              {/* Consistently aligned 3-stage funnel cards */}
              <View style={styles.funnelList}>
                {/* Stage 1: Inquiries */}
                <View
                  style={[
                    styles.funnelRow,
                    {
                      backgroundColor: isDark ? 'rgba(37,99,235,0.08)' : '#EFF6FF',
                      borderColor: isDark ? 'rgba(37,99,235,0.2)' : '#DBEAFE',
                    },
                  ]}
                >
                  <View style={styles.funnelLeft}>
                    <View style={[styles.funnelStepNumber, { backgroundColor: colors.primary }]}>
                      <Text style={styles.funnelStepNumText}>1</Text>
                    </View>
                    <View style={styles.funnelTextContainer}>
                      <Text style={[styles.funnelTitle, { color: colors.text }]} numberOfLines={1}>
                        Total Leads
                      </Text>
                      <Text style={[styles.funnelSubtitle, { color: colors.textSecondary }]}>
                        Registered customer inquiries
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.funnelBadge, { backgroundColor: colors.primary }]}>
                    <Text style={styles.funnelBadgeText}>{leadStats.total}</Text>
                  </View>
                </View>

                {/* Stage 2: Active Follow-ups */}
                <View
                  style={[
                    styles.funnelRow,
                    {
                      backgroundColor: isDark ? 'rgba(245,158,11,0.08)' : '#FFFBEB',
                      borderColor: isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7',
                    },
                  ]}
                >
                  <View style={styles.funnelLeft}>
                    <View style={[styles.funnelStepNumber, { backgroundColor: colors.warning }]}>
                      <Text style={styles.funnelStepNumText}>2</Text>
                    </View>
                    <View style={styles.funnelTextContainer}>
                      <Text style={[styles.funnelTitle, { color: colors.text }]} numberOfLines={1}>
                        Pending / Active Follow-Ups
                      </Text>
                      <Text style={[styles.funnelSubtitle, { color: colors.textSecondary }]}>
                        Follow-up scheduled or interested
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.funnelBadge, { backgroundColor: colors.warning }]}>
                    <Text style={styles.funnelBadgeText}>{leadStats.followUpCount}</Text>
                  </View>
                </View>

                {/* Stage 3: Converted Purchases */}
                <View
                  style={[
                    styles.funnelRow,
                    {
                      backgroundColor: isDark ? 'rgba(34,197,94,0.08)' : '#F0FDF4',
                      borderColor: isDark ? 'rgba(34,197,94,0.2)' : '#DCFCE7',
                    },
                  ]}
                >
                  <View style={styles.funnelLeft}>
                    <View style={[styles.funnelStepNumber, { backgroundColor: colors.accent }]}>
                      <Text style={styles.funnelStepNumText}>3</Text>
                    </View>
                    <View style={styles.funnelTextContainer}>
                      <Text style={[styles.funnelTitle, { color: colors.text }]} numberOfLines={1}>
                        Converted Leads
                      </Text>
                      <Text style={[styles.funnelSubtitle, { color: colors.textSecondary }]}>
                        Completed device purchases
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.funnelBadge, { backgroundColor: colors.accent }]}>
                    <Text style={styles.funnelBadgeText}>{leadStats.purchasedCount}</Text>
                  </View>
                </View>
              </View>

              {/* Conversion Rate Card */}
              <View
                style={[
                  styles.conversionCard,
                  {
                    backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4',
                    borderColor: isDark ? 'rgba(34,197,94,0.25)' : '#BBF7D0',
                  },
                ]}
              >
                <View style={styles.conversionHeaderRow}>
                  <Text style={[styles.conversionRateLabel, { color: colors.textSecondary }]}>
                    Conversion Rate
                  </Text>
                  <Text style={[styles.conversionRateVal, { color: colors.accent }]}>
                    {leadStats.conversionRate}%
                  </Text>
                </View>
                <Text style={[styles.conversionExplainer, { color: colors.textSecondary }]}>
                  {leadStats.total > 0
                    ? `${leadStats.purchasedCount} of ${leadStats.total} leads converted into sales.`
                    : 'No customer leads recorded yet.'}
                </Text>
              </View>
            </AppCard>
          )}

          {/* --- Tab 3: Attendance --- */}
          {activeReport === 'attendance' && (
            <AppCard style={styles.cardWrapper}>
              <SectionHeader
                title="Attendance & Punctuality"
                subtitle="Store punctuality and GPS geofence tracking"
                style={styles.sectionHeader}
              />

              {/* 2x2 Metric Grid */}
              <View style={styles.statGrid}>
                {/* On-Time Punches */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4',
                      borderColor: isDark ? 'rgba(34,197,94,0.25)' : '#DCFCE7',
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.accent }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {attendanceSummary.onTimePresent}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    On-Time Punches
                  </Text>
                </View>

                {/* Late Arrivals */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB',
                      borderColor: isDark ? 'rgba(245,158,11,0.25)' : '#FEF3C7',
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.warning }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {attendanceSummary.lateArrivals}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Late Arrivals (&gt;15m)
                  </Text>
                </View>

                {/* Early Exits */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2',
                      borderColor: isDark ? 'rgba(239,68,68,0.25)' : '#FEE2E2',
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.danger }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {attendanceSummary.earlyExits}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Early Exits
                  </Text>
                </View>

                {/* Total Shop Hours */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF',
                      borderColor: isDark ? 'rgba(37,99,235,0.25)' : '#DBEAFE',
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.primary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {attendanceSummary.totalHours}h
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Total Working Hours
                  </Text>
                </View>
              </View>

              {/* Compact Punctuality Note */}
              <View
                style={[
                  styles.summaryStrip,
                  {
                    borderTopColor: colors.border,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                  },
                ]}
              >
                <View style={styles.summaryCol}>
                  <Text style={[styles.summaryColLabel, { color: colors.textSecondary }]}>
                    Total Records
                  </Text>
                  <Text style={[styles.summaryColVal, { color: colors.text }]}>
                    {attendanceSummary.totalRecords} punches
                  </Text>
                </View>

                <View style={[styles.summaryVDivider, { backgroundColor: colors.border }]} />

                <View style={styles.summaryCol}>
                  <Text style={[styles.summaryColLabel, { color: colors.textSecondary }]}>
                    Punctuality Rate
                  </Text>
                  <Text style={[styles.summaryColVal, { color: colors.accent }]}>
                    {punctualityRate}%
                  </Text>
                </View>
              </View>
            </AppCard>
          )}

          {/* --- Tab 4: Staff Performance --- */}
          {activeReport === 'staff_perf' && (
            <AppCard style={styles.cardWrapper}>
              <SectionHeader
                title="Staff Performance"
                subtitle="Sales achievements and targets for current month"
                style={styles.sectionHeader}
              />

              {staffLeaderboard.length === 0 ? (
                <View style={{ paddingVertical: SPACING.md }}>
                  <Text style={{ textAlign: 'center', color: colors.textSecondary, fontSize: 13 }}>
                    No staff members found.
                  </Text>
                </View>
              ) : (
                <View style={styles.staffListContainer}>
                  {staffLeaderboard.map((member, index) => {
                    const isTop = index === 0 && member.salesAmount > 0;
                    return (
                      <View
                        key={member.id}
                        style={[
                          styles.staffRow,
                          {
                            borderBottomColor: colors.border,
                            borderBottomWidth: index === staffLeaderboard.length - 1 ? 0 : 1,
                          },
                        ]}
                      >
                        {/* Rank Badge */}
                        <View
                          style={[
                            styles.rankBadge,
                            {
                              backgroundColor: isTop
                                ? (isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7')
                                : isDark
                                ? 'rgba(255,255,255,0.08)'
                                : '#F1F5F9',
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.rankText,
                              { color: isTop ? (isDark ? '#FBBF24' : '#B45309') : colors.textSecondary },
                            ]}
                          >
                            #{index + 1}
                          </Text>
                        </View>

                        {/* Employee Avatar Circle */}
                        <View style={[styles.avatarBox, { backgroundColor: colors.primary }]}>
                          <Text style={styles.avatarText}>
                            {member.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>

                        {/* Name & Role & Target */}
                        <View style={styles.staffInfo}>
                          <Text
                            style={[styles.staffName, { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {member.name}
                          </Text>
                          <Text
                            style={[styles.staffRoleText, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            {member.designation}
                          </Text>
                          <Text
                            style={[styles.staffTargetText, { color: colors.textSecondary }]}
                            numberOfLines={1}
                          >
                            Target: {formatCurrency(member.targetAmount)} ({member.percentAchieved}%)
                          </Text>
                        </View>

                        {/* Sales Figures & Achievement */}
                        <View style={styles.staffFigures}>
                          <Text
                            style={[
                              styles.staffSalesText,
                              { color: member.salesAmount > 0 ? colors.accent : colors.text },
                            ]}
                          >
                            {formatCurrency(member.salesAmount)}
                          </Text>
                          {member.incentiveAmount > 0 ? (
                            <Text style={[styles.staffIncentiveText, { color: colors.primary }]}>
                              +{formatCurrency(member.incentiveAmount)} inc.
                            </Text>
                          ) : null}
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                            {member.percentAchieved >= 100 ? (
                              <StatusBadge label="ACHIEVED" variant="success" size="small" />
                            ) : member.salesCount > 0 ? (
                              <StatusBadge label={`${member.salesCount} SOLD`} variant="info" size="small" />
                            ) : (
                              <Text style={[styles.staffAchievementText, { color: colors.textMuted }]}>
                                0 sales
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </AppCard>
          )}

          {/* --- Tab 4: Salary & Payroll --- */}
          {activeReport === 'salary' && (
            <AppCard style={styles.cardWrapper}>
              <SectionHeader
                title="Payroll & Salary Summary"
                subtitle="Calculated store payouts, incentives, and attendance"
                style={styles.sectionHeader}
              />

              {/* 2x2 Metric Grid */}
              <View style={styles.statGrid}>
                {/* Total Payable */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF',
                      borderColor: isDark ? 'rgba(37,99,235,0.25)' : '#DBEAFE',
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.primary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatCurrency(payrollSummary?.totalPayable || 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Total Net Salary
                  </Text>
                  <Text style={[styles.statSubLabel, { color: colors.textMuted }]}>
                    {payrollSummary?.totalStaffCount || 0} Staff Members
                  </Text>
                </View>

                {/* Total Paid */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(22,163,74,0.1)' : '#F0FDF4',
                      borderColor: isDark ? 'rgba(22,163,74,0.25)' : '#DCFCE7',
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.success }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatCurrency(payrollSummary?.totalPaid || 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Disbursed Payouts
                  </Text>
                  <Text style={[styles.statSubLabel, { color: colors.success }]}>
                    {payrollSummary?.paidStaffCount || 0} Confirmed
                  </Text>
                </View>

                {/* Total Pending */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(217,119,6,0.1)' : '#FFFBEB',
                      borderColor: isDark ? 'rgba(217,119,6,0.25)' : '#FEF3C7',
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.warning }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {formatCurrency(payrollSummary?.totalPending || 0)}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Pending Payouts
                  </Text>
                  <Text style={[styles.statSubLabel, { color: colors.warning }]}>
                    {payrollSummary?.pendingStaffCount || 0} Awaiting
                  </Text>
                </View>

                {/* Month Indicator */}
                <View
                  style={[
                    styles.statCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.statValue, { color: colors.text, fontSize: 15 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {payrollSummary?.monthName || 'Current Month'}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                    Payroll Cycle
                  </Text>
                  <Text style={[styles.statSubLabel, { color: colors.textMuted }]}>
                    Auto-generated slips
                  </Text>
                </View>
              </View>

              {/* Staff Breakdown List */}
              <View style={{ marginTop: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textSecondary, marginBottom: 8 }}>
                  STAFF SALARY BREAKDOWN
                </Text>
                {payrollSummary?.slips.map((slip, idx) => (
                  <View
                    key={slip.id || idx}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingVertical: 10,
                      borderBottomWidth: idx < (payrollSummary?.slips.length || 0) - 1 ? 1 : 0,
                      borderBottomColor: colors.border,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>
                        {slip.staffName}
                      </Text>
                      <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                        {slip.designation} • Base: {formatCurrency(slip.basicSalary)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accent }}>
                        {formatCurrency(slip.netSalary)}
                      </Text>
                      <StatusBadge
                        label={slip.isPaid ? 'PAID' : 'PENDING'}
                        variant={slip.isPaid ? 'success' : 'warning'}
                        size="small"
                      />
                    </View>
                  </View>
                ))}
              </View>
            </AppCard>
          )}

          {/* Bottom Export Note (compact secondary button) */}
          <TouchableOpacity
            style={[
              styles.bottomExportBar,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                borderColor: colors.border,
              },
            ]}
            onPress={() => setExportModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Share & Export Full Report"
          >
            <AppIcon name="upload" size={16} color={colors.primary} />
            <Text style={[styles.bottomExportText, { color: colors.primary }]}>
              Share & Export Full Report
            </Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* Export Format Selection Modal */}
      <ModalCard
        visible={exportModalVisible}
        onClose={() => !isExporting && setExportModalVisible(false)}
        title="Export Report"
        subtitle="Choose a format"
        scrollable={false}
        bodyStyle={styles.exportModalBody}
      >
        <View style={styles.exportModalContent}>
          {isExporting ? (
            <View style={styles.exportLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.exportLoadingText, { color: colors.text }]}>
                {exportingType === 'excel'
                  ? 'Generating Excel (.xlsx)...'
                  : exportingType === 'csv'
                  ? 'Generating CSV (.csv)...'
                  : 'Preparing PDF (.pdf)...'}
              </Text>
            </View>
          ) : (
            <View style={styles.exportOptionsRow}>
              {/* Option 1: Excel Card */}
              <TouchableOpacity
                style={[
                  styles.exportFormatCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleExportExcel}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Export as Excel"
              >
                <AppIcon name="file" size={24} color={colors.primary} />
                <Text
                  style={[styles.exportFormatTitle, { color: colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  Excel (.xlsx)
                </Text>
              </TouchableOpacity>

              {/* Option 2: CSV Card */}
              <TouchableOpacity
                style={[
                  styles.exportFormatCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleExportCsv}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Export as CSV"
              >
                <AppIcon name="file" size={24} color={colors.success} />
                <Text
                  style={[styles.exportFormatTitle, { color: colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  CSV (.csv)
                </Text>
              </TouchableOpacity>

              {/* Option 3: PDF Card */}
              <TouchableOpacity
                style={[
                  styles.exportFormatCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
                onPress={handleExportPdf}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Export as PDF"
              >
                <AppIcon name="analytics" size={24} color={colors.accent} />
                <Text
                  style={[styles.exportFormatTitle, { color: colors.text }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  PDF (.pdf)
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ModalCard>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabsSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.xs,
    paddingBottom: SPACING.xs,
  },
  reportTabs: {
    paddingBottom: SPACING.xs,
    paddingRight: SPACING.xl,
    gap: 8,
  },
  centeredState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: 90,
  },
  cardWrapper: {
    padding: 14,
    marginBottom: SPACING.md,
  },
  sectionHeader: {
    marginTop: 0,
    marginBottom: SPACING.sm,
  },

  // 2x2 Metric Grid
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginVertical: SPACING.xs,
  },
  statCard: {
    width: '48%',
    minWidth: 0,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 22,
  },
  statLabel: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 3,
    fontWeight: '600',
  },
  statSubLabel: {
    fontSize: 10,
    marginTop: 2,
    fontWeight: '500',
  },

  // Compact Summary Strip
  summaryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.sm,
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
  },
  summaryColLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 2,
  },
  summaryColVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryVDivider: {
    width: 1,
    height: 24,
  },

  // Lead Funnel
  funnelList: {
    gap: 8,
    marginVertical: SPACING.xs,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'space-between',
  },
  funnelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  funnelTextContainer: {
    flex: 1,
    minWidth: 0,
  },
  funnelStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  funnelStepNumText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  funnelTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  funnelSubtitle: {
    fontSize: 11,
    marginTop: 1,
  },
  funnelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    marginLeft: 8,
  },
  funnelBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  conversionCard: {
    padding: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.sm,
  },
  conversionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversionRateLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  conversionRateVal: {
    fontSize: 18,
    fontWeight: '800',
  },
  conversionExplainer: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },

  // Staff Leaderboard
  staffListContainer: {
    marginTop: SPACING.xs,
  },
  staffRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 11,
    fontWeight: '800',
  },
  avatarBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  staffInfo: {
    flex: 1,
    minWidth: 0,
  },
  staffName: {
    fontSize: 13,
    fontWeight: '700',
  },
  staffRoleText: {
    fontSize: 11,
    marginTop: 1,
  },
  staffTargetText: {
    fontSize: 11,
    marginTop: 2,
  },
  staffFigures: {
    alignItems: 'flex-end',
  },
  staffSalesText: {
    fontSize: 13,
    fontWeight: '800',
  },
  staffIncentiveText: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
  },
  staffAchievementText: {
    fontSize: 11,
  },

  // Bottom Export Button
  bottomExportBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.xs,
  },
  bottomExportText: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Export Modal Styles
  exportModalBody: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxxl,
  },
  exportModalContent: {
    width: '100%',
  },
  exportLoadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportLoadingText: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  exportOptionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  exportFormatCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  exportFormatTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
    textAlign: 'center',
  },
});
