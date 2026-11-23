import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Pencil, Target, Camera, KeyRound } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import {
  ModalCard,
  StatusBadge,
  AppIcon,
  FilterChip,
  EmptyState,
} from '../components';
import {
  User,
  AttendanceRecord,
  CustomerLead,
  SecondHandSale,
  SalarySlip,
  AdminAuditEntry,
} from '../types';
import { StorageService } from '../services/storageService';
import { StaffPerformanceService } from '../services/staffPerformanceService';
import { AuditService } from '../services/auditService';
import { formatCurrency, getTodayDateString } from '../utils/format';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';

interface StaffDetailModalProps {
  visible: boolean;
  staff: User | null;
  onClose: () => void;
  onEdit?: (staff: User) => void;
  onSetTarget?: (staff: User) => void;
  onFaceRegister?: (staff: User) => void;
  onResendInvite?: (staff: User) => void;
  onToggleStatus?: (staff: User) => void;
}

type DetailTab = 'overview' | 'attendance' | 'leads' | 'sales' | 'salary' | 'activity';

export const StaffDetailModal: React.FC<StaffDetailModalProps> = ({
  visible,
  staff,
  onClose,
  onEdit,
  onSetTarget,
  onFaceRegister,
  onResendInvite,
  onToggleStatus,
}) => {
  const { colors, isDark } = useTheme();
  const { currentUser, isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [isLoading, setIsLoading] = useState(false);

  // Loaded Sub-Data
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leads, setLeads] = useState<CustomerLead[]>([]);
  const [sales, setSales] = useState<SecondHandSale[]>([]);
  const [salarySlip, setSalarySlip] = useState<SalarySlip | null>(null);
  const [auditLogs, setAuditLogs] = useState<AdminAuditEntry[]>([]);

  useEffect(() => {
    if (visible && staff) {
      loadStaffSubData();
    }
  }, [visible, staff]);

  const loadStaffSubData = async () => {
    if (!staff) return;
    setIsLoading(true);
    try {
      const currentMonthKey = getTodayDateString().substring(0, 7);

      // 1. Attendance
      const allAtt = await StorageService.getAttendanceRecords();
      const staffAtt = allAtt.filter(a => a.userId === staff.id);
      setAttendance(staffAtt);

      // 2. Leads
      const allLeads = await StorageService.getLeads();
      const staffLeads = allLeads.filter(
        l => l.assignedTo === staff.id || l.createdBy === staff.id
      );
      setLeads(staffLeads);

      // 3. Sales
      const allSales = await StorageService.getSales();
      const staffSales = allSales.filter(
        s => s.soldByStaffId === staff.id || s.soldByStaffName === staff.name
      );
      setSales(staffSales);

      // 4. Salary
      const slip = await StaffPerformanceService.getSalarySlip(staff, currentMonthKey);
      setSalarySlip(slip);

      // 5. Activity Audit History
      const logs = await AuditService.getLogsForRecord(staff.id);
      setAuditLogs(logs);
    } catch (e: any) {
      console.warn('Error loading staff details:', e);
    } finally {
      setIsLoading(false);
    }
  };

  if (!staff) return null;

  return (
    <ModalCard
      visible={visible}
      onClose={onClose}
      title={staff.name}
      subtitle={`${staff.designation} • ${staff.role.toUpperCase()}`}
      bodyStyle={styles.modalBody}
    >
      {/* 6 Tabs Bar */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBar}
        >
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'attendance', label: `Attendance (${attendance.length})` },
            { key: 'leads', label: `Leads (${leads.length})` },
            { key: 'sales', label: `Sales (${sales.length})` },
            { key: 'salary', label: 'Salary Slip' },
            { key: 'activity', label: `Audit Log (${auditLogs.length})` },
          ].map(t => (
            <FilterChip
              key={t.key}
              label={t.label}
              active={activeTab === t.key}
              onPress={() => setActiveTab(t.key as DetailTab)}
            />
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <View style={styles.loaderBox}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.loaderText, { color: colors.textSecondary }]}>
            Loading employee record...
          </Text>
        </View>
      ) : (
        <View style={styles.tabContent}>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <View style={styles.tabPane}>
              {/* Profile Header Card */}
              <View
                style={[
                  styles.infoSection,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.rowItem}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Account Status</Text>
                  <StatusBadge
                    label={staff.isActive ? 'ACTIVE ACCOUNT' : 'DEACTIVATED'}
                    variant={staff.isActive ? 'success' : 'danger'}
                  />
                </View>

                <View style={styles.rowItem}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Email Address</Text>
                  <Text style={[styles.fieldVal, { color: colors.text }]}>{staff.email}</Text>
                </View>

                <View style={styles.rowItem}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Phone Number</Text>
                  <Text style={[styles.fieldVal, { color: colors.text }]}>{staff.phone}</Text>
                </View>

                <View style={styles.rowItem}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date Joined</Text>
                  <Text style={[styles.fieldVal, { color: colors.text }]}>{staff.joinedDate || 'Store Founding'}</Text>
                </View>

                <View style={styles.rowItem}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Base Monthly Salary</Text>
                  <Text style={[styles.fieldVal, { color: colors.accent, fontWeight: '800' }]}>
                    {formatCurrency(staff.basicSalary)}
                  </Text>
                </View>

                <View style={styles.rowItem}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Sales Target</Text>
                  <Text style={[styles.fieldVal, { color: colors.primary, fontWeight: '800' }]}>
                    {formatCurrency(staff.monthlyTarget)}
                  </Text>
                </View>

                <View style={styles.rowItem}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Face Biometrics</Text>
                  {(() => {
                    const st = staff.faceEnrollmentStatus || (staff.hasFaceRegistered ? 'approved' : 'not_enrolled');
                    if (st === 'approved') return <StatusBadge label="APPROVED" variant="success" />;
                    if (st === 'pending_approval') return <StatusBadge label="PENDING APPROVAL" variant="warning" />;
                    if (st === 'rejected') return <StatusBadge label="REJECTED" variant="danger" />;
                    return <StatusBadge label="NOT ENROLLED" variant="neutral" />;
                  })()}
                </View>

                {staff.faceApprovedAt && (
                  <View style={styles.rowItem}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Face Approved</Text>
                    <Text style={[styles.fieldVal, { color: colors.text }]}>
                      {new Date(staff.faceApprovedAt).toLocaleDateString()}
                    </Text>
                  </View>
                )}

                {staff.faceRejectionReason && (
                  <View style={styles.rowItem}>
                    <Text style={[styles.fieldLabel, { color: '#C62828' }]}>Rejection Reason</Text>
                    <Text style={[styles.fieldVal, { color: '#C62828' }]}>
                      {staff.faceRejectionReason}
                    </Text>
                  </View>
                )}
              </View>

              {/* Action Buttons */}
              <View style={styles.actionGrid}>
                {onEdit && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(25, 77, 156, 0.15)' : '#EAF2FF' }]}
                    onPress={() => onEdit(staff)}
                  >
                    <Pencil size={14} color={colors.primary} />
                    <Text style={[styles.modalActionText, { color: colors.primary }]}>Edit Profile</Text>
                  </TouchableOpacity>
                )}

                {onSetTarget && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { borderColor: colors.accent, backgroundColor: isDark ? 'rgba(217, 119, 6, 0.15)' : '#FFFBEB' }]}
                    onPress={() => onSetTarget(staff)}
                  >
                    <Target size={14} color={colors.accent} />
                    <Text style={[styles.modalActionText, { color: colors.accent }]}>Set Target</Text>
                  </TouchableOpacity>
                )}

                {onFaceRegister && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(25, 77, 156, 0.15)' : '#EAF2FF' }]}
                    onPress={() => onFaceRegister(staff)}
                  >
                    <Camera size={14} color={colors.primary} />
                    <Text style={[styles.modalActionText, { color: colors.primary }]}>Register Face</Text>
                  </TouchableOpacity>
                )}

                {onResendInvite && (
                  <TouchableOpacity
                    style={[styles.modalActionBtn, { borderColor: colors.border }]}
                    onPress={() => onResendInvite(staff)}
                  >
                    <KeyRound size={14} color={colors.text} />
                    <Text style={[styles.modalActionText, { color: colors.text }]}>Resend Password</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* TAB 2: ATTENDANCE */}
          {activeTab === 'attendance' && (
            <View style={styles.tabPane}>
              {attendance.length === 0 ? (
                <EmptyState
                  title="No Attendance Punches"
                  description="This staff member has not recorded any geofenced punches yet."
                />
              ) : (
                attendance.slice(0, 30).map((a, idx) => (
                  <View
                    key={a.id || idx}
                    style={[
                      styles.listItem,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>{a.date}</Text>
                      <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                        In: {a.punchInTime || '-'} • Out: {a.punchOutTime || '-'} • {a.totalHours} hrs
                      </Text>
                    </View>
                    <StatusBadge
                      label={a.status.toUpperCase()}
                      variant={a.status === 'present' ? 'success' : a.isLate ? 'warning' : 'danger'}
                      size="small"
                    />
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 3: LEADS */}
          {activeTab === 'leads' && (
            <View style={styles.tabPane}>
              {leads.length === 0 ? (
                <EmptyState
                  title="No Assigned Leads"
                  description="No customer inquiries are currently assigned to or created by this staff member."
                />
              ) : (
                leads.slice(0, 30).map((l, idx) => (
                  <View
                    key={l.id || idx}
                    style={[
                      styles.listItem,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>{l.name}</Text>
                      <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                        {l.interestedBrand} {l.interestedModel} • Budget: {formatCurrency(l.budget)}
                      </Text>
                    </View>
                    <StatusBadge
                      label={l.status.toUpperCase()}
                      variant={l.status === 'purchased' ? 'success' : l.status === 'lost' ? 'danger' : 'info'}
                      size="small"
                    />
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 4: SALES */}
          {activeTab === 'sales' && (
            <View style={styles.tabPane}>
              {sales.length === 0 ? (
                <EmptyState
                  title="No Device Sales"
                  description="This staff member has not recorded any second-hand device sales yet."
                />
              ) : (
                sales.slice(0, 30).map((s, idx) => (
                  <View
                    key={s.id || idx}
                    style={[
                      styles.listItem,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>
                        {s.brand} {s.model}
                      </Text>
                      <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                        Invoice: {s.invoiceNumber} • Date: {s.saleDate}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: colors.accent }}>
                      {formatCurrency(s.sellingAmount)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* TAB 5: SALARY */}
          {activeTab === 'salary' && (
            <View style={styles.tabPane}>
              {salarySlip ? (
                <View
                  style={[
                    styles.infoSection,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View style={styles.rowItem}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Month Cycle</Text>
                    <Text style={[styles.fieldVal, { color: colors.text }]}>{salarySlip.month}</Text>
                  </View>
                  <View style={styles.rowItem}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Basic Salary</Text>
                    <Text style={[styles.fieldVal, { color: colors.text }]}>
                      {formatCurrency(salarySlip.basicSalary)}
                    </Text>
                  </View>
                  <View style={styles.rowItem}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Attendance Bonus</Text>
                    <Text style={[styles.fieldVal, { color: colors.success }]}>
                      +{formatCurrency(salarySlip.attendanceBonus)}
                    </Text>
                  </View>
                  <View style={styles.rowItem}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Sales Incentive</Text>
                    <Text style={[styles.fieldVal, { color: colors.success }]}>
                      +{formatCurrency(salarySlip.salesIncentive)}
                    </Text>
                  </View>
                  <View style={styles.rowItem}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Deductions</Text>
                    <Text style={[styles.fieldVal, { color: colors.danger }]}>
                      -{formatCurrency(salarySlip.deductions)}
                    </Text>
                  </View>
                  <View style={[styles.rowItem, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.text, fontWeight: '800', fontSize: 14 }]}>
                      Net Salary Payable
                    </Text>
                    <Text style={[styles.fieldVal, { color: colors.primary, fontWeight: '800', fontSize: 16 }]}>
                      {formatCurrency(salarySlip.netSalary)}
                    </Text>
                  </View>
                  <View style={[styles.rowItem, { marginTop: 6 }]}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Payment Status</Text>
                    <StatusBadge
                      label={salarySlip.isPaid ? 'PAID' : 'PENDING CONFIRMATION'}
                      variant={salarySlip.isPaid ? 'success' : 'warning'}
                    />
                  </View>
                </View>
              ) : (
                <EmptyState
                  title="No Salary Slip Available"
                  description="Monthly payroll slip has not been computed for this cycle."
                />
              )}
            </View>
          )}

          {/* TAB 6: ACTIVITY HISTORY AUDIT */}
          {activeTab === 'activity' && (
            <View style={styles.tabPane}>
              {auditLogs.length === 0 ? (
                <EmptyState
                  title="No Audit Entries"
                  description="No recorded administrative actions on this staff profile yet."
                />
              ) : (
                auditLogs.map((log, idx) => (
                  <View
                    key={log.id || idx}
                    style={[
                      styles.listItem,
                      {
                        borderBottomColor: colors.border,
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.itemTitle, { color: colors.text }]}>
                        {AuditService.getActionLabel(log.actionType)}
                      </Text>
                      <Text style={[styles.itemSub, { color: colors.textSecondary }]}>
                        By: {log.adminName} • {new Date(log.timestamp).toLocaleString('en-IN')}
                      </Text>
                      {log.details ? (
                        <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
                          {log.details}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))
              )}
            </View>
          )}
        </View>
      )}
    </ModalCard>
  );
};

const styles = StyleSheet.create({
  modalBody: {
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    paddingBottom: SPACING.xxl + 8,
  },
  tabBarWrapper: {
    marginHorizontal: -SPACING.md,
    marginBottom: 12,
  },
  tabBar: {
    paddingHorizontal: SPACING.md,
    paddingRight: SPACING.xl,
    gap: 8,
  },
  loaderBox: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loaderText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabContent: {
    flexGrow: 1,
  },
  tabPane: {
    paddingBottom: 28,
  },
  infoSection: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 14,
    gap: 10,
  },
  rowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  fieldVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  modalActionBtn: {
    flex: 1,
    minWidth: '45%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  modalActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  listItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  itemSub: {
    fontSize: 11,
    marginTop: 2,
  },
});

