import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Camera,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  Smartphone,
  Calendar,
  UserCheck,
  AlertTriangle,
  History,
  X,
  FileEdit,
} from 'lucide-react-native';
import { User, FaceTemplate, AttendanceAuditLog, FaceEnrollmentStatus } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { StorageService } from '../services/storageService';
import { FaceRecognitionService } from '../services/faceRecognitionService';
import { AuditService } from '../services/auditService';
import { SPACING, RADIUS, TYPOGRAPHY } from '../theme';
import { ModalCard, Input, Button, PrimaryButton, FilterChip } from '../components';

interface FaceMonitoringModalProps {
  visible: boolean;
  currentAdmin: User;
  onClose: () => void;
  onRefresh?: () => void;
}

type FilterOption = 'all' | 'pending' | 'approved' | 'rejected' | 'not_enrolled';

export const FaceMonitoringModal: React.FC<FaceMonitoringModalProps> = ({
  visible,
  currentAdmin,
  onClose,
  onRefresh,
}) => {
  const { colors } = useTheme();
  const { showSuccess, showError, showWarning, showConfirm } = useAlert();

  const [staffList, setStaffList] = useState<User[]>([]);
  const [templatesMap, setTemplatesMap] = useState<Record<string, FaceTemplate>>({});
  const [auditLogs, setAuditLogs] = useState<AttendanceAuditLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Rejection Dialog State
  const [rejectionTarget, setRejectionTarget] = useState<User | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Staff History Detail Modal State
  const [selectedStaffHistory, setSelectedStaffHistory] = useState<User | null>(null);

  // Manual Attendance Correction Modal State
  const [correctingStaff, setCorrectingStaff] = useState<User | null>(null);
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionTime, setCorrectionTime] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [users, templates, logs] = await Promise.all([
        StorageService.getAllUsers(),
        StorageService.getFaceTemplates(),
        StorageService.getAttendanceAuditLogs(),
      ]);

      const map: Record<string, FaceTemplate> = {};
      templates.forEach(t => {
        // Map latest template per user
        if (!map[t.userId] || new Date(t.registeredAt) > new Date(map[t.userId].registeredAt)) {
          map[t.userId] = t;
        }
      });

      setStaffList(users);
      setTemplatesMap(map);
      setAuditLogs(logs);
    } catch (e) {
      console.warn('Error loading face monitoring data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible]);

  const handleApprove = async (staff: User) => {
    showConfirm({
      title: 'Approve Face Enrollment',
      message: `Authorize biometric face attendance for ${staff.name}? This will activate face-based Punch In/Out.`,
      confirmText: 'Approve',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setActionLoading(true);
        try {
          const res = await FaceRecognitionService.approveEnrollment({
            userId: staff.id,
            adminId: currentAdmin.id,
            adminName: currentAdmin.name,
          });

          if (!res.success) {
            showError('Approval Failed', res.error || 'Failed to approve enrollment.');
            return;
          }

          await AuditService.logAction({
            adminId: currentAdmin.id,
            adminName: currentAdmin.name,
            actionType: 'enrollment_approve',
            targetRecordId: staff.id,
            targetRecordTitle: staff.name,
            details: `Approved face enrollment for ${staff.name}`,
            afterValue: { status: 'approved' },
          });

          showSuccess('Enrollment Approved', `Face attendance for ${staff.name} is now active.`);
          await loadData();
          onRefresh?.();
        } catch (err: any) {
          showError('Approval Error', err?.message || 'Approval failed.');
        } finally {
          setActionLoading(false);
        }
      },
    });
  };

  const handleConfirmReject = async () => {
    if (!rejectionTarget) return;
    if (!rejectionReason.trim()) {
      showWarning('Reason Required', 'Please provide a clear reason for rejecting the face enrollment.');
      return;
    }

    setActionLoading(true);
    try {
      const res = await FaceRecognitionService.rejectEnrollment({
        userId: rejectionTarget.id,
        adminId: currentAdmin.id,
        adminName: currentAdmin.name,
        reason: rejectionReason.trim(),
      });

      if (!res.success) {
        showError('Rejection Failed', res.error || 'Failed to reject enrollment.');
        return;
      }

      await AuditService.logAction({
        adminId: currentAdmin.id,
        adminName: currentAdmin.name,
        actionType: 'enrollment_reject',
        targetRecordId: rejectionTarget.id,
        targetRecordTitle: rejectionTarget.name,
        details: `Rejected face enrollment for ${rejectionTarget.name}. Reason: ${rejectionReason.trim()}`,
        afterValue: { status: 'rejected', reason: rejectionReason.trim() },
      });

      showSuccess('Enrollment Rejected', `Enrollment for ${rejectionTarget.name} has been marked rejected.`);
      setRejectionTarget(null);
      setRejectionReason('');
      await loadData();
      onRefresh?.();
    } catch (err: any) {
      showError('Rejection Error', err?.message || 'Rejection failed.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleManualAttendanceCorrection = async () => {
    if (!correctingStaff) return;
    if (!correctionReason.trim()) {
      showWarning('Reason Required', 'Please provide an audit justification for manual attendance entry.');
      return;
    }

    setActionLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const timeStr = correctionReason.trim() ? (correctionTime.trim() || '10:00:00') : '10:00:00';

      const record = {
        id: `att_${correctingStaff.id}_${today}`,
        userId: correctingStaff.id,
        userName: correctingStaff.name,
        userRole: correctingStaff.role,
        date: today,
        timestamp: new Date().toISOString(),
        punchInTime: timeStr,
        status: 'present' as const,
        totalHours: 8,
        isLate: false,
        isEarlyExit: false,
        verificationMethod: 'manual_override' as const,
        notes: `Admin Manual Review Override by ${currentAdmin.name}: ${correctionReason.trim()}`,
      };

      await StorageService.updateAttendanceRecord(record);
      await StorageService.resetVerificationFailures(correctingStaff.id);

      await StorageService.addAttendanceAuditLog({
        userId: correctingStaff.id,
        userName: correctingStaff.name,
        action: 'attendance_corrected',
        status: 'success',
        adminId: currentAdmin.id,
        adminName: currentAdmin.name,
        notes: `Manual Attendance Granted: ${correctionReason.trim()}`,
      });

      await AuditService.logAction({
        adminId: currentAdmin.id,
        adminName: currentAdmin.name,
        actionType: 'attendance_correction',
        targetRecordId: record.id,
        targetRecordTitle: correctingStaff.name,
        details: `Manual attendance override for ${correctingStaff.name}. Reason: ${correctionReason.trim()}`,
        afterValue: { punchInTime: timeStr, status: 'present' },
      });

      showSuccess('Attendance Corrected', `Manual present record created for ${correctingStaff.name}.`);
      setCorrectingStaff(null);
      setCorrectionReason('');
      setCorrectionTime('');
      await loadData();
      onRefresh?.();
    } catch (err: any) {
      showError('Correction Error', err?.message || 'Attendance correction failed.');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter and search
  const filteredStaff = staffList.filter(staff => {
    const tmpl = templatesMap[staff.id];
    const status: FaceEnrollmentStatus = tmpl
      ? (tmpl.approvalStatus === 'pending' ? 'pending_approval' : (tmpl.approvalStatus || 'approved'))
      : (staff.faceEnrollmentStatus || 'not_enrolled');

    // Status filter
    if (activeFilter === 'pending' && status !== 'pending_approval') return false;
    if (activeFilter === 'approved' && status !== 'approved') return false;
    if (activeFilter === 'rejected' && status !== 'rejected') return false;
    if (activeFilter === 'not_enrolled' && status !== 'not_enrolled') return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = staff.name.toLowerCase().includes(q);
      const matchEmail = staff.email.toLowerCase().includes(q);
      const matchPhone = staff.phone.includes(q);
      if (!matchName && !matchEmail && !matchPhone) return false;
    }
    return true;
  });

  const pendingCount = staffList.filter(s => {
    const tmpl = templatesMap[s.id];
    return tmpl?.approvalStatus === 'pending';
  }).length;

  const renderBadge = (status: FaceEnrollmentStatus) => {
    switch (status) {
      case 'approved':
        return (
          <View style={[styles.badge, { backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
            <CheckCircle2 size={12} color="#2E7D32" />
            <Text style={[styles.badgeText, { color: '#2E7D32' }]}>Approved</Text>
          </View>
        );
      case 'pending_approval':
        return (
          <View style={[styles.badge, { backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
            <Clock size={12} color="#E65100" />
            <Text style={[styles.badgeText, { color: '#E65100' }]}>Pending Approval</Text>
          </View>
        );
      case 'rejected':
        return (
          <View style={[styles.badge, { backgroundColor: '#FFEBEE', borderColor: '#F44336' }]}>
            <XCircle size={12} color="#C62828" />
            <Text style={[styles.badgeText, { color: '#C62828' }]}>Rejected</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.badge, { backgroundColor: '#ECEFF1', borderColor: '#B0BEC5' }]}>
            <Camera size={12} color="#546E7A" />
            <Text style={[styles.badgeText, { color: '#546E7A' }]}>Not Enrolled</Text>
          </View>
        );
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleRow}>
            <ShieldCheck size={22} color={colors.primary} />
            <View>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Biometric Enrollment & Monitoring</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                Admin Verification & Compliance Center
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
            <X size={22} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Filter & Search Bar */}
        <View style={[styles.filterBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Search size={16} color={colors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="Search staff by name, email, or phone..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.filterScroll, { paddingRight: 24, gap: 8 }]}>
            <FilterChip
              label="All"
              count={staffList.length}
              active={activeFilter === 'all'}
              onPress={() => setActiveFilter('all')}
            />

            <FilterChip
              label="Pending"
              count={pendingCount}
              active={activeFilter === 'pending'}
              onPress={() => setActiveFilter('pending')}
            />

            <FilterChip
              label="Approved"
              active={activeFilter === 'approved'}
              onPress={() => setActiveFilter('approved')}
            />

            <FilterChip
              label="Rejected"
              active={activeFilter === 'rejected'}
              onPress={() => setActiveFilter('rejected')}
            />

            <FilterChip
              label="Not Enrolled"
              active={activeFilter === 'not_enrolled'}
              onPress={() => setActiveFilter('not_enrolled')}
            />
          </ScrollView>
        </View>

        {/* Staff List */}
        {loading ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading biometric records...</Text>
          </View>
        ) : (
          <FlatList
            data={filteredStaff}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const tmpl = templatesMap[item.id];
              const status: FaceEnrollmentStatus = tmpl
                ? (tmpl.approvalStatus === 'pending' ? 'pending_approval' : (tmpl.approvalStatus || 'approved'))
                : (item.faceEnrollmentStatus || 'not_enrolled');
              const failedAttempts = item.failedVerificationAttempts || 0;

              return (
                <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  {/* Card Header */}
                  <View style={styles.cardHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.staffName, { color: colors.text }]}>{item.name}</Text>
                      <Text style={[styles.staffSubtitle, { color: colors.textSecondary }]}>
                        {item.designation} • {item.role.toUpperCase()}
                      </Text>
                    </View>
                    {renderBadge(status)}
                  </View>

                  {/* Account & Enrollment Details */}
                  <View style={[styles.metaGrid, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                    <View style={styles.metaRow}>
                      <Calendar size={13} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        Created: {item.joinedDate || 'N/A'} {item.createdBy ? `(by ${item.createdBy.slice(0, 8)}...)` : ''}
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <Smartphone size={13} color={colors.textSecondary} />
                      <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                        Device: {tmpl?.deviceInfo?.platform ? `${tmpl.deviceInfo.platform} Native` : 'Encrypted on-device'}
                      </Text>
                    </View>

                    {tmpl?.registeredAt && (
                      <View style={styles.metaRow}>
                        <Clock size={13} color={colors.textSecondary} />
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                          Enrolled: {new Date(tmpl.registeredAt).toLocaleDateString()} ({tmpl.sampleCount || 3} live samples)
                        </Text>
                      </View>
                    )}

                    {tmpl?.approvedByAdminName && (
                      <View style={styles.metaRow}>
                        <UserCheck size={13} color="#2E7D32" />
                        <Text style={[styles.metaText, { color: '#2E7D32' }]}>
                          Approved by {tmpl.approvedByAdminName} on{' '}
                          {tmpl.approvedAt ? new Date(tmpl.approvedAt).toLocaleDateString() : ''}
                        </Text>
                      </View>
                    )}

                    {tmpl?.rejectionReason && (
                      <View style={styles.metaRow}>
                        <ShieldAlert size={13} color="#C62828" />
                        <Text style={[styles.metaText, { color: '#C62828' }]}>
                          Rejection Reason: {tmpl.rejectionReason}
                        </Text>
                      </View>
                    )}

                    {failedAttempts > 0 && (
                      <View style={[styles.metaRow, { backgroundColor: '#FFF3E0', padding: 6, borderRadius: 6 }]}>
                        <AlertTriangle size={13} color="#E65100" />
                        <Text style={[styles.metaText, { color: '#E65100', fontWeight: '600' }]}>
                          {failedAttempts} Failed Verification Attempt{failedAttempts > 1 ? 's' : ''}:{' '}
                          {item.lastFailedVerificationReason || 'Spoofing or low liveness score'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Actions */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={[styles.btnOutline, { borderColor: colors.border }]}
                      onPress={() => setSelectedStaffHistory(item)}
                    >
                      <History size={14} color={colors.primary} />
                      <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Audit History</Text>
                    </TouchableOpacity>

                    {status === 'pending_approval' && (
                      <>
                        <TouchableOpacity
                          style={[styles.btnAction, { backgroundColor: '#C62828' }]}
                          disabled={actionLoading}
                          onPress={() => {
                            setRejectionTarget(item);
                            setRejectionReason('');
                          }}
                        >
                          <Text style={styles.btnActionText}>Reject</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.btnAction, { backgroundColor: '#2E7D32' }]}
                          disabled={actionLoading}
                          onPress={() => handleApprove(item)}
                        >
                          <Text style={styles.btnActionText}>Approve</Text>
                        </TouchableOpacity>
                      </>
                    )}

                    {failedAttempts >= 3 && (
                      <TouchableOpacity
                        style={[styles.btnAction, { backgroundColor: '#194D9C' }]}
                        onPress={() => {
                          setCorrectingStaff(item);
                          setCorrectionReason('');
                          setCorrectionTime('');
                        }}
                      >
                        <FileEdit size={13} color="#fff" />
                        <Text style={styles.btnActionText}>Manual Review</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.centerContainer}>
                <Camera size={40} color={colors.textSecondary} />
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No staff records matching filter.</Text>
              </View>
            }
          />
        )}

        {/* Rejection Reason Modal */}
        <ModalCard
          visible={Boolean(rejectionTarget)}
          onClose={() => setRejectionTarget(null)}
          title="Reject Face Enrollment"
          subtitle={`State reason for rejecting ${rejectionTarget?.name}'s biometric enrollment`}
        >
          <Input
            label="Rejection Reason *"
            placeholder="e.g. Image too blurry, glare on face, failed liveness, spoof suspected..."
            value={rejectionReason}
            onChangeText={setRejectionReason}
            multiline
            numberOfLines={3}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setRejectionTarget(null)}
              style={{ flex: 1 }}
            />
            <Button
              title="Confirm Rejection"
              variant="danger"
              loading={actionLoading}
              onPress={handleConfirmReject}
              style={{ flex: 1 }}
            />
          </View>
        </ModalCard>

        {/* Manual Attendance Review Modal */}
        <ModalCard
          visible={Boolean(correctingStaff)}
          onClose={() => setCorrectingStaff(null)}
          title="Manual Attendance Review"
          subtitle={`Grant authorized manual attendance for ${correctingStaff?.name}`}
        >
          <Input
            label="Punch In Time (HH:MM:SS) *"
            placeholder="10:00:00"
            value={correctionTime}
            onChangeText={setCorrectionTime}
          />
          <Input
            label="Audit Justification *"
            placeholder="e.g. Camera lens smudge confirmed on site, physical presence verified by Store Manager."
            value={correctionReason}
            onChangeText={setCorrectionReason}
            multiline
            numberOfLines={3}
          />
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => setCorrectingStaff(null)}
              style={{ flex: 1 }}
            />
            <PrimaryButton
              title="Approve Attendance"
              loading={actionLoading}
              onPress={handleManualAttendanceCorrection}
              style={{ flex: 1 }}
            />
          </View>
        </ModalCard>

        {/* Staff Biometric History Detail Modal */}
        <Modal visible={Boolean(selectedStaffHistory)} animationType="slide">
          <SafeAreaView edges={['top', 'bottom', 'left', 'right']} style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
              <View style={styles.headerTitleRow}>
                <History size={20} color={colors.primary} />
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                  {selectedStaffHistory?.name} — Biometric Audit
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedStaffHistory(null)}>
                <X size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
              <View style={[styles.infoBanner, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[styles.bannerTitle, { color: colors.text }]}>Tamper-Proof Audit Trail</Text>
                <Text style={[styles.bannerDesc, { color: colors.textSecondary }]}>
                  All biometric enrollment submissions, administrator approvals, re-enrollments, and punch verifications are logged immutably.
                </Text>
              </View>

              {auditLogs
                .filter(l => l.userId === selectedStaffHistory?.id)
                .map(log => (
                  <View
                    key={log.id}
                    style={[
                      styles.auditLogCard,
                      {
                        backgroundColor: colors.card,
                        borderColor: log.status === 'failed' ? '#FFCDD2' : colors.border,
                      },
                    ]}
                  >
                    <View style={styles.auditHeader}>
                      <Text style={[styles.auditAction, { color: colors.text }]}>
                        {log.action.toUpperCase().replace(/_/g, ' ')}
                      </Text>
                      <Text
                        style={[
                          styles.auditStatus,
                          {
                            color:
                              log.status === 'success'
                                ? '#2E7D32'
                                : log.status === 'failed'
                                ? '#C62828'
                                : '#E65100',
                          },
                        ]}
                      >
                        {log.status.toUpperCase()}
                      </Text>
                    </View>

                    <Text style={[styles.auditTime, { color: colors.textSecondary }]}>
                      {new Date(log.timestamp).toLocaleString()}
                    </Text>

                    {log.reason && (
                      <Text style={[styles.auditDetail, { color: '#C62828' }]}>Reason: {log.reason}</Text>
                    )}

                    {log.notes && (
                      <Text style={[styles.auditDetail, { color: colors.textSecondary }]}>{log.notes}</Text>
                    )}

                    {log.similarityScore !== undefined && (
                      <Text style={[styles.auditScore, { color: colors.text }]}>
                        Match Score: {Math.round(log.similarityScore * 100)}% | Liveness:{' '}
                        {log.livenessScore ? Math.round(log.livenessScore * 100) : 0}%
                      </Text>
                    )}
                  </View>
                ))}

              {auditLogs.filter(l => l.userId === selectedStaffHistory?.id).length === 0 && (
                <Text style={[styles.emptyText, { color: colors.textSecondary, marginTop: 40 }]}>
                  No biometric audit logs recorded for this staff member yet.
                </Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerSubtitle: { fontSize: 11 },
  closeBtn: { padding: 4 },
  filterBar: { padding: 12, gap: 10, borderBottomWidth: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  filterScroll: { flexDirection: 'row', gap: 8 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterChipText: { fontSize: 12, color: '#666', fontWeight: '500' },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  listContent: { padding: 12, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  staffName: { fontSize: 15, fontWeight: '700' },
  staffSubtitle: { fontSize: 12, marginTop: 2 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  metaGrid: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 8, gap: 6 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12 },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, alignItems: 'center' },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 6,
  },
  btnOutlineText: { fontSize: 12, fontWeight: '600' },
  btnAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  btnActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, gap: 10 },
  loadingText: { fontSize: 14 },
  emptyText: { textAlign: 'center', fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: { borderWidth: 1, borderRadius: 12, padding: 18, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalSubtitle: { fontSize: 13, lineHeight: 18 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  modalInputSmall: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 13,
  },
  inputLabel: { fontSize: 12, fontWeight: '600' },
  modalBtns: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 4 },
  modalBtnCancel: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderRadius: 6 },
  modalBtnConfirm: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6 },
  infoBanner: { padding: 12, borderWidth: 1, borderRadius: 8, gap: 4 },
  bannerTitle: { fontSize: 13, fontWeight: '700' },
  bannerDesc: { fontSize: 12, lineHeight: 16 },
  auditLogCard: { borderWidth: 1, borderRadius: 8, padding: 12, gap: 4 },
  auditHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  auditAction: { fontSize: 13, fontWeight: '700' },
  auditStatus: { fontSize: 11, fontWeight: '700' },
  auditTime: { fontSize: 11 },
  auditDetail: { fontSize: 12, marginTop: 2 },
  auditScore: { fontSize: 11, fontWeight: '600', marginTop: 4 },
});

