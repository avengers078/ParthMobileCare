import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  StatusBadge,
  Button,
  PrimaryButton,
  FilterChip,
  SectionHeader,
  AppIcon,
} from '../components';
import { StorageService } from '../services/storageService';
import { SecondHandService } from '../services/secondHandService';
import { formatCurrency } from '../utils/format';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';

export const ReportsScreen: React.FC = () => {
  const { colors, isDark } = useTheme();

  const [activeReport, setActiveReport] = useState<
    'sales_profit' | 'attendance' | 'leads' | 'staff_perf'
  >('sales_profit');

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

  const loadAllReports = async () => {
    // 1. Buy & Sell financials
    const bs = await SecondHandService.getBuySellStats();
    setBuySellStats(bs);

    // 2. Leads stats
    const leads = await StorageService.getLeads();
    const purchased = leads.filter(l => l.status === 'purchased').length;
    const rate = leads.length > 0 ? Math.round((purchased / leads.length) * 100) : 0;
    setLeadStats({
      total: leads.length,
      newCount: leads.filter(l => l.status === 'new').length,
      followUpCount: leads.filter(l => l.status === 'follow_up').length,
      purchasedCount: purchased,
      lostCount: leads.filter(l => l.status === 'lost').length,
      conversionRate: rate,
    });

    // 3. Attendance records
    const attendance = await StorageService.getAttendanceRecords();
    const late = attendance.filter(a => a.isLate).length;
    const early = attendance.filter(a => a.isEarlyExit).length;
    const hours = attendance.reduce((acc, a) => acc + (a.totalHours || 0), 0);
    setAttendanceSummary({
      totalRecords: attendance.length,
      onTimePresent: attendance.filter(a => a.status === 'present' && !a.isLate).length,
      lateArrivals: late,
      earlyExits: early,
      totalHours: Math.round(hours * 10) / 10,
    });
  };

  useEffect(() => {
    loadAllReports();
  }, []);

  const handleExportReport = async () => {
    const reportText = `
========================================
     PARTH MOBILE CARE - BUSINESS REPORT
========================================
Date: ${new Date().toLocaleDateString('en-IN')}

1. FINANCIAL & BUY/SELL SUMMARY:
• Total Second-Hand Mobiles Bought: ${buySellStats.totalPurchasedUnits}
• Total Mobiles Sold:               ${buySellStats.soldCount}
• Mobiles Remaining in Stock:       ${buySellStats.inStockCount}
• Total Sales Revenue:              ${formatCurrency(buySellStats.totalSalesAmount)}
• Total Purchase Cost:              ${formatCurrency(buySellStats.totalPurchasedAmount)}
• Net Gross Profit:                 ${formatCurrency(buySellStats.totalProfit)}
• Average Margin:                   ${buySellStats.averageMargin}%

2. CUSTOMER LEADS CONVERSION:
• Total Inquiries/Leads:            ${leadStats.total}
• Active Follow-Ups:                ${leadStats.followUpCount}
• Completed Purchases:              ${leadStats.purchasedCount}
• Conversion Rate:                  ${leadStats.conversionRate}%

3. ATTENDANCE & DISCIPLINE:
• Total Punches:                    ${attendanceSummary.totalRecords}
• On-Time Punches:                  ${attendanceSummary.onTimePresent}
• Late Arrivals (>15m):             ${attendanceSummary.lateArrivals}
• Early Exits:                      ${attendanceSummary.earlyExits}
• Total Working Hours:              ${attendanceSummary.totalHours} hrs
========================================
`;
    try {
      await Share.share({
        title: 'Parth Mobile Care Full Report',
        message: reportText,
      });
    } catch (e: any) {
      Alert.alert('Share Error', e.message);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Reports"
        subtitle="Analytics & Overview"
        rightAction={
          <Button
            title="Export"
            icon={<AppIcon name="upload" size={16} color="#FFFFFF" />}
            onPress={handleExportReport}
            size="small"
            style={{ marginRight: 4 }}
          />
        }
      />

      {/* Tabs */}
      <View style={styles.tabsSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.reportTabs}
        >
          {[
            { key: 'sales_profit', label: 'Profit & Margins', icon: <AppIcon name="wallet" size={16} color={colors.success} /> },
            { key: 'leads', label: 'Lead Funnel', icon: <AppIcon name="users" size={16} color={colors.primary} /> },
            { key: 'attendance', label: 'Attendance Stats', icon: <AppIcon name="location" size={16} color={colors.warning} /> },
            { key: 'staff_perf', label: 'Leaderboard', icon: <AppIcon name="analytics" size={16} color={colors.primary} /> },
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
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* --- 1. Profit & Margin Reports --- */}
        {activeReport === 'sales_profit' && (
          <AppCard>
            <SectionHeader
              title="Gross Profit & Margin Analysis"
              subtitle="Real-time margin tracking across purchases and sales"
              style={{ marginTop: 0 }}
            />

            <View style={styles.grid2x2}>
              <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4', borderColor: isDark ? 'rgba(34,197,94,0.2)' : '#DCFCE7' }]}>
                <Text style={[styles.statVal, { color: colors.accent }]}>
                  {formatCurrency(buySellStats.totalProfit)}
                </Text>
                <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
                  Total Gross Profit
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF', borderColor: isDark ? 'rgba(37,99,235,0.2)' : '#DBEAFE' }]}>
                <Text style={[styles.statVal, { color: colors.primary }]}>
                  {buySellStats.averageMargin}%
                </Text>
                <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
                  Average Margin
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB', borderColor: isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7' }]}>
                <Text style={[styles.statVal, { color: colors.warning }]}>
                  {formatCurrency(buySellStats.totalSalesAmount)}
                </Text>
                <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
                  Total Revenue
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: colors.border }]}>
                <Text style={[styles.statVal, { color: colors.text }]}>
                  {formatCurrency(buySellStats.totalPurchasedAmount)}
                </Text>
                <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
                  Purchase Cost
                </Text>
              </View>
            </View>

            <View style={[styles.inventoryBreakdown, { borderTopColor: colors.border }]}>
              <View style={styles.breakdownRow}>
                <Text style={{ color: colors.textSecondary }}>Mobiles in Store Stock:</Text>
                <Text style={{ fontWeight: '700', color: colors.accent }}>
                  {buySellStats.inStockCount} units
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={{ color: colors.textSecondary }}>Total Mobiles Sold:</Text>
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {buySellStats.soldCount} units
                </Text>
              </View>
              <View style={styles.breakdownRow}>
                <Text style={{ color: colors.textSecondary }}>Inventory Turnover:</Text>
                <Text style={{ fontWeight: '700', color: colors.primary }}>
                  {buySellStats.totalPurchasedUnits > 0
                    ? `${Math.round((buySellStats.soldCount / buySellStats.totalPurchasedUnits) * 100)}%`
                    : '0%'}
                </Text>
              </View>
            </View>
          </AppCard>
        )}

        {/* --- 2. Lead Conversion Reports --- */}
        {activeReport === 'leads' && (
          <AppCard>
            <SectionHeader
              title="Lead Funnel & Conversion"
              subtitle="Customer inquiry conversion from walk-in to purchased sale"
              style={{ marginTop: 0 }}
            />

            <View style={styles.funnelContainer}>
              <View style={[styles.funnelStep, { backgroundColor: colors.primary }]}>
                <Text style={styles.funnelStepText}>Total Inquiries: {leadStats.total}</Text>
              </View>
              <View style={[styles.funnelStep, { backgroundColor: colors.warning, width: '85%' }]}>
                <Text style={styles.funnelStepText}>Follow-Ups Active: {leadStats.followUpCount}</Text>
              </View>
              <View style={[styles.funnelStep, { backgroundColor: colors.accent, width: '70%' }]}>
                <Text style={styles.funnelStepText}>Converted Purchases: {leadStats.purchasedCount}</Text>
              </View>
            </View>

            <View style={[styles.highlightBox, { backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4', borderColor: isDark ? 'rgba(34,197,94,0.2)' : '#BBF7D0' }]}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.accent }}>
                Conversion Rate: {leadStats.conversionRate}%
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                {leadStats.purchasedCount} out of {leadStats.total} inquiries converted into completed sales.
              </Text>
            </View>
          </AppCard>
        )}

        {/* --- 3. Attendance Reports --- */}
        {activeReport === 'attendance' && (
          <AppCard>
            <SectionHeader
              title="Attendance & Punctuality"
              subtitle="Strict 30m GPS validation metrics and shop opening hour punctuality"
              style={{ marginTop: 0 }}
            />

            <View style={styles.grid2x2}>
              <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4', borderColor: isDark ? 'rgba(34,197,94,0.2)' : '#DCFCE7' }]}>
                <Text style={[styles.statVal, { color: colors.accent }]}>
                  {attendanceSummary.onTimePresent}
                </Text>
                <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
                  On-Time Punches
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB', borderColor: isDark ? 'rgba(245,158,11,0.2)' : '#FEF3C7' }]}>
                <Text style={[styles.statVal, { color: colors.warning }]}>
                  {attendanceSummary.lateArrivals}
                </Text>
                <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
                  Late (&gt;15m)
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2', borderColor: isDark ? 'rgba(239,68,68,0.2)' : '#FEE2E2' }]}>
                <Text style={[styles.statVal, { color: colors.danger }]}>
                  {attendanceSummary.earlyExits}
                </Text>
                <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
                  Early Exits
                </Text>
              </View>

              <View style={[styles.statBox, { backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF', borderColor: isDark ? 'rgba(37,99,235,0.2)' : '#DBEAFE' }]}>
                <Text style={[styles.statVal, { color: colors.primary }]}>
                  {attendanceSummary.totalHours}h
                </Text>
                <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
                  Total Shop Hours
                </Text>
              </View>
            </View>
          </AppCard>
        )}

        {/* --- 4. Staff Performance --- */}
        {activeReport === 'staff_perf' && (
          <AppCard>
            <SectionHeader
              title="Staff Sales Leaderboard"
              subtitle="Individual performance and incentive contributions"
              style={{ marginTop: 0 }}
            />

            <View style={[styles.leaderboardRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: 15 }}>1. Ankit Verma</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Sales Exec • 2nd Hand Sales Specialist</Text>
              </View>
              <StatusBadge label="TOP PERFORMER" variant="success" size="small" />
            </View>

            <View style={[styles.leaderboardRow, { borderBottomColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: 15 }}>2. Pooja Mehta</Text>
                <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Customer Relationship • Lead Specialist</Text>
              </View>
              <StatusBadge label="HIGH RETENTION" variant="info" size="small" />
            </View>
          </AppCard>
        )}

        <PrimaryButton
          title="Export Full PDF / CSV Report"
          onPress={handleExportReport}
          size="large"
          style={{ marginTop: SPACING.lg }}
        />
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  tabsSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xs,
  },
  reportTabs: {
    paddingBottom: SPACING.xs,
    paddingRight: SPACING.xl,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: 100,
  },
  grid2x2: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  statBox: {
    width: '48%',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  statVal: {
    ...TYPOGRAPHY.h2,
    fontWeight: '800',
  },
  statTitle: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
  inventoryBreakdown: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  funnelContainer: {
    marginVertical: SPACING.md,
    alignItems: 'center',
  },
  funnelStep: {
    paddingVertical: 12,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    marginVertical: 4,
    width: '100%',
  },
  funnelStepText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
  highlightBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.sm,
    alignItems: 'center',
  },
  leaderboardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
});
