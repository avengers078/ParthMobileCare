import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useAlert } from '../context/AlertContext';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  StatusBadge,
  Input,
  PrimaryButton,
  Button,
  ModalCard,
  SectionHeader,
  EmptyState,
  AppIcon,
} from '../components';
import { CheckCircle2, Check } from 'lucide-react-native';
import { SalarySlip } from '../types';
import { PayrollService, PayrollSummary } from '../services/payrollService';
import { StorageService } from '../services/storageService';
import { PdfService } from '../services/pdfService';
import { DEFAULT_SHOP_CONFIG } from '../constants';
import { formatCurrency, getTodayDateString } from '../utils/format';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';

interface PayrollScreenProps {
  navigation: any;
}

export const PayrollScreen: React.FC<PayrollScreenProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { currentUser, isAdmin } = useAuth();
  const { showError, showSuccess, showWarning } = useAlert();

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(
    getTodayDateString().substring(0, 7)
  );
  const [payrollData, setPayrollData] = useState<PayrollSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Payment Confirmation Modal State
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedSlip, setSelectedSlip] = useState<SalarySlip | null>(null);
  const [paymentDate, setPaymentDate] = useState(getTodayDateString());
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Bank Transfer'>('UPI');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadPayroll = async () => {
    setIsLoading(true);
    try {
      const summary = await PayrollService.getMonthlyPayroll(selectedMonthKey);
      setPayrollData(summary);
    } catch (e: any) {
      showError('Payroll Failed', e?.message || 'Failed to load payroll data.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPayroll();
  }, [selectedMonthKey]);

  const handlePrevMonth = () => {
    const [year, month] = selectedMonthKey.split('-').map(Number);
    const date = new Date(year, month - 2, 1);
    const newKey = date.toISOString().substring(0, 7);
    setSelectedMonthKey(newKey);
  };

  const handleNextMonth = () => {
    const [year, month] = selectedMonthKey.split('-').map(Number);
    const date = new Date(year, month, 1);
    const newKey = date.toISOString().substring(0, 7);
    setSelectedMonthKey(newKey);
  };

  const handleOpenPaymentModal = (slip: SalarySlip) => {
    setSelectedSlip(slip);
    setPaymentDate(getTodayDateString());
    setPaymentMethod('UPI');
    setPaymentRef('');
    setPaymentNotes('');
    setConfirmModalVisible(true);
  };

  const handleConfirmPayment = async () => {
    if (!currentUser || !isAdmin) {
      showWarning('Unauthorized', 'Only store administrators can confirm payroll payouts.');
      return;
    }
    if (!selectedSlip) return;

    setIsSubmitting(true);
    try {
      const res = await PayrollService.confirmPayment(selectedSlip.id, currentUser, {
        paymentDate,
        paymentMethod,
        paymentReference: paymentRef,
        notes: paymentNotes,
      });

      if (!res.success) {
        showError('Payment Failed', res.error || 'Failed to confirm salary payment.');
      } else {
        showSuccess(
          'Payment Recorded',
          `Salary of ${formatCurrency(selectedSlip.netSalary)} for ${selectedSlip.staffName} marked as PAID via ${paymentMethod}.`
        );
        setConfirmModalVisible(false);
        loadPayroll();
      }
    } catch (e: any) {
      showError('Payment Failed', e?.message || 'Could not record payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPdf = async (slip: SalarySlip) => {
    const shopConfig = (await StorageService.getShopConfig()) || DEFAULT_SHOP_CONFIG;
    await PdfService.printOrSavePdf(slip, shopConfig);
  };

  const handleExportExcel = async () => {
    if (!currentUser) return;
    const res = await PayrollService.exportPayrollToExcel(selectedMonthKey, currentUser);
    if (!res.success) {
      showError('Export Failed', res.error || 'Failed to export Excel payroll sheet.');
    }
  };

  const handleExportCsv = async () => {
    if (!currentUser) return;
    const res = await PayrollService.exportPayrollToCsv(selectedMonthKey, currentUser);
    if (!res.success) {
      showError('Export Failed', res.error || 'Failed to export CSV payroll.');
    }
  };

  if (!isAdmin) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <AppHeader
          title="Salary & Payroll"
          subtitle="Monthly salary & payouts"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl }}>
          <EmptyState
            title="Unauthorized Access"
            description="Store payroll management is strictly restricted to store administrators."
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Salary & Payroll"
        subtitle="Monthly salary & payouts"
        showBack
        onBack={() => navigation.goBack()}
      />

      {/* Month Navigation & Action Bar */}
      <View style={[styles.monthBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.navArrowBtn} onPress={handlePrevMonth}>
          <AppIcon name="chevron-left" size={18} color={colors.primary} />
        </TouchableOpacity>

        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.monthTitleText, { color: colors.text }]}>
            {payrollData?.monthName || selectedMonthKey}
          </Text>
          <Text style={[styles.monthSubtitleText, { color: colors.textSecondary }]}>
            Payroll Cycle ({selectedMonthKey})
          </Text>
        </View>

        <TouchableOpacity style={styles.navArrowBtn} onPress={handleNextMonth}>
          <AppIcon name="chevron-right" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Export Quick Bar */}
      <View style={styles.exportBar}>
        <TouchableOpacity
          style={[styles.exportBtn, { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(25, 77, 156, 0.15)' : '#EAF2FF' }]}
          onPress={handleExportExcel}
        >
          <AppIcon name="file" size={13} color={colors.primary} />
          <Text style={[styles.exportBtnText, { color: colors.primary }]}>Export Excel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.exportBtn, { borderColor: colors.success, backgroundColor: isDark ? 'rgba(22, 163, 74, 0.15)' : '#F0FDF4' }]}
          onPress={handleExportCsv}
        >
          <AppIcon name="file" size={13} color={colors.success} />
          <Text style={[styles.exportBtnText, { color: colors.success }]}>Export CSV</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Computing staff payroll & attendance bonuses...
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* KPI Dashboard */}
          <View style={styles.kpiGrid}>
            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF',
                  borderColor: isDark ? 'rgba(37,99,235,0.25)' : '#DBEAFE',
                },
              ]}
            >
              <Text style={[styles.kpiVal, { color: colors.primary }]}>
                {formatCurrency(payrollData?.totalPayable || 0)}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Net Payable</Text>
              <Text style={[styles.kpiSub, { color: colors.textMuted }]}>
                {payrollData?.totalStaffCount || 0} Staff Members
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: isDark ? 'rgba(22,163,74,0.1)' : '#F0FDF4',
                  borderColor: isDark ? 'rgba(22,163,74,0.25)' : '#DCFCE7',
                },
              ]}
            >
              <Text style={[styles.kpiVal, { color: colors.success }]}>
                {formatCurrency(payrollData?.totalPaid || 0)}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Total Paid Out</Text>
              <Text style={[styles.kpiSub, { color: colors.success }]}>
                {payrollData?.paidStaffCount || 0} Confirmed
              </Text>
            </View>

            <View
              style={[
                styles.kpiCard,
                {
                  backgroundColor: isDark ? 'rgba(217,119,6,0.1)' : '#FFFBEB',
                  borderColor: isDark ? 'rgba(217,119,6,0.25)' : '#FEF3C7',
                },
              ]}
            >
              <Text style={[styles.kpiVal, { color: colors.warning }]}>
                {formatCurrency(payrollData?.totalPending || 0)}
              </Text>
              <Text style={[styles.kpiLabel, { color: colors.textSecondary }]}>Pending Payment</Text>
              <Text style={[styles.kpiSub, { color: colors.warning }]}>
                {payrollData?.pendingStaffCount || 0} Remaining
              </Text>
            </View>
          </View>

          {/* Staff Slips Section */}
          <SectionHeader
            title="Staff Payroll Slips"
            subtitle="Individual earnings, deductions and disbursements"
            style={{ marginTop: SPACING.md, marginBottom: SPACING.sm }}
          />

          {payrollData?.slips.length === 0 ? (
            <EmptyState
              title="No Staff Accounts Found"
              description="No active staff members are eligible for payroll in this month."
            />
          ) : (
            payrollData?.slips.map((slip, idx) => (
              <AppCard key={slip.id || idx} style={styles.slipCard}>
                <View style={styles.slipHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.slipStaffName, { color: colors.text }]}>{slip.staffName}</Text>
                    <Text style={[styles.slipStaffRole, { color: colors.textSecondary }]}>
                      {slip.designation} • {slip.presentDays}/{slip.totalWorkingDays} days present
                    </Text>
                  </View>
                  <StatusBadge
                    label={slip.isPaid ? 'PAID' : 'PENDING'}
                    variant={slip.isPaid ? 'success' : 'warning'}
                  />
                </View>

                {/* Salary Components Breakdown */}
                <View style={[styles.slipGrid, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                  <View style={styles.slipCol}>
                    <Text style={[styles.slipColLabel, { color: colors.textMuted }]}>BASIC</Text>
                    <Text style={[styles.slipColVal, { color: colors.text }]}>
                      {formatCurrency(slip.basicSalary)}
                    </Text>
                  </View>
                  <View style={styles.slipCol}>
                    <Text style={[styles.slipColLabel, { color: colors.textMuted }]}>INCENTIVE</Text>
                    <Text style={[styles.slipColVal, { color: colors.success }]}>
                      +{formatCurrency(slip.salesIncentive)}
                    </Text>
                  </View>
                  <View style={styles.slipCol}>
                    <Text style={[styles.slipColLabel, { color: colors.textMuted }]}>BONUS</Text>
                    <Text style={[styles.slipColVal, { color: colors.success }]}>
                      +{formatCurrency(slip.attendanceBonus)}
                    </Text>
                  </View>
                  <View style={styles.slipCol}>
                    <Text style={[styles.slipColLabel, { color: colors.textMuted }]}>DEDUCTIONS</Text>
                    <Text style={[styles.slipColVal, { color: colors.danger }]}>
                      -{formatCurrency(slip.deductions)}
                    </Text>
                  </View>
                </View>

                {/* Net Total & Actions */}
                <View style={styles.slipFooter}>
                  <View>
                    <Text style={[styles.netTotalLabel, { color: colors.textSecondary }]}>NET SALARY</Text>
                    <Text style={[styles.netTotalVal, { color: colors.primary }]}>
                      {formatCurrency(slip.netSalary)}
                    </Text>
                  </View>

                  <View style={styles.slipActionRow}>
                    <TouchableOpacity
                      style={[styles.smallActionBtn, { borderColor: colors.border }]}
                      onPress={() => handleDownloadPdf(slip)}
                    >
                      <AppIcon name="file" size={13} color={colors.text} />
                      <Text style={[styles.smallActionText, { color: colors.text }]}>PDF Slip</Text>
                    </TouchableOpacity>

                    {!slip.isPaid ? (
                      <TouchableOpacity
                        style={[styles.smallActionBtn, { borderColor: colors.success, backgroundColor: isDark ? 'rgba(22, 163, 74, 0.15)' : '#F0FDF4' }]}
                        onPress={() => handleOpenPaymentModal(slip)}
                      >
                        <AppIcon name="check" size={13} color={colors.success} />
                        <Text style={[styles.smallActionText, { color: colors.success }]}>Mark Paid</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={{ alignItems: 'flex-end' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <CheckCircle2 size={12} color={colors.success} />
                          <Text style={{ fontSize: 11, color: colors.success, fontWeight: '700' }}>
                            Paid on {slip.paymentDate || 'Recorded'}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 10, color: colors.textMuted }}>
                          via {slip.paymentMethod || 'Store'}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </AppCard>
            ))
          )}
        </ScrollView>
      )}

      {/* Payment Confirmation Modal */}
      <ModalCard
        visible={confirmModalVisible}
        onClose={() => setConfirmModalVisible(false)}
        title="Confirm Salary Payment"
        subtitle={`Disburse payout for ${selectedSlip?.staffName}`}
      >
        <View style={styles.modalContent}>
          <View style={[styles.amountBox, { backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF', borderColor: colors.primary }]}>
            <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>Net Take Home Payout</Text>
            <Text style={[styles.amountVal, { color: colors.primary }]}>
              {formatCurrency(selectedSlip?.netSalary || 0)}
            </Text>
          </View>

          <Input
            label="Payment Date (YYYY-MM-DD) *"
            value={paymentDate}
            onChangeText={setPaymentDate}
          />

          <Text style={[styles.formLabel, { color: colors.textSecondary }]}>Payment Method *</Text>
          <View style={styles.methodRow}>
            {(['UPI', 'Cash', 'Bank Transfer'] as const).map(m => (
              <TouchableOpacity
                key={m}
                style={[
                  styles.methodBtn,
                  {
                    borderColor: paymentMethod === m ? colors.primary : colors.border,
                    backgroundColor: paymentMethod === m ? colors.primaryLight : 'transparent',
                  },
                ]}
                onPress={() => setPaymentMethod(m)}
              >
                <Text
                  style={[
                    styles.methodBtnText,
                    { color: paymentMethod === m ? colors.primary : colors.text },
                  ]}
                >
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label="Transaction Reference / Cheque No."
            placeholder="e.g. UPI Ref 3029102919"
            value={paymentRef}
            onChangeText={setPaymentRef}
          />

          <Input
            label="Payment Notes"
            placeholder="Optional notes or remarks"
            value={paymentNotes}
            onChangeText={setPaymentNotes}
          />

          <PrimaryButton
            title={isSubmitting ? 'Confirming Payment...' : 'Confirm & Record Payment'}
            icon={!isSubmitting ? <Check size={18} color="#FFFFFF" strokeWidth={2.5} /> : undefined}
            onPress={handleConfirmPayment}
            loading={isSubmitting}
            disabled={isSubmitting}
            size="large"
            style={{ marginTop: SPACING.md }}
          />
        </View>
      </ModalCard>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  navArrowBtn: {
    padding: 8,
  },
  monthTitleText: {
    fontSize: 15,
    fontWeight: '800',
  },
  monthSubtitleText: {
    fontSize: 11,
    marginTop: 1,
  },
  exportBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 8,
  },
  exportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  exportBtnText: {
    fontSize: 12,
    fontWeight: '700',
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
    padding: SPACING.lg,
    paddingBottom: 90,
  },
  kpiGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: SPACING.sm,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 10,
    alignItems: 'center',
  },
  kpiVal: {
    fontSize: 15,
    fontWeight: '800',
  },
  kpiLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 9.5,
    marginTop: 1,
  },
  slipCard: {
    padding: 14,
    marginBottom: SPACING.md,
  },
  slipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  slipStaffName: {
    fontSize: 14,
    fontWeight: '700',
  },
  slipStaffRole: {
    fontSize: 11,
    marginTop: 2,
  },
  slipGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  slipCol: {
    alignItems: 'center',
  },
  slipColLabel: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  slipColVal: {
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  slipFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  netTotalLabel: {
    fontSize: 9.5,
    fontWeight: '600',
  },
  netTotalVal: {
    fontSize: 16,
    fontWeight: '800',
  },
  slipActionRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  smallActionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  modalContent: {
    paddingBottom: SPACING.md,
  },
  amountBox: {
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  amountLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  amountVal: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  formLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 6,
  },
  methodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  methodBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  methodBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

