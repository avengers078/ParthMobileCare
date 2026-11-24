import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Switch,
  ScrollView,
} from 'react-native';
import {
  Award,
  DollarSign,
  Mail,
  Phone,
  Plus,
  Shield,
  Target,
  UserCheck,
  UserX,
  Users,
  Camera,
  CheckSquare,
  Square,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Check,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  StatusBadge,
  Button,
  PrimaryButton,
  Input,
  SearchInput,
  FilterChip,
  ModalCard,
  SectionHeader,
  EmptyState,
  FaceRegistrationModal,
  FaceMonitoringModal,
  StaffDetailModal,
} from '../components';
import { User, UserRole, SalesTarget, FaceEnrollmentStatus } from '../types';
import { StorageService } from '../services/storageService';
import { StaffPerformanceService } from '../services/staffPerformanceService';
import { StaffProvisioningService } from '../services/staffProvisioningService';
import { AuditService } from '../services/auditService';
import { formatCurrency, getTodayDateString } from '../utils/format';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sanitizeMobileNumber, validateMobileNumber, getMobileNumberError } from '../utils/validation';
import { getFriendlyErrorMessage } from '../utils/errorHandler';
import { useAlert } from '../context/AlertContext';

interface StaffManagementScreenProps {
  navigation: any;
}

export const StaffManagementScreen: React.FC<StaffManagementScreenProps> = ({ navigation }) => {
  const { currentUser, isAdmin, sendPasswordReset } = useAuth();
  const { colors, isDark } = useTheme();
  const { showSuccess, showError, showWarning, showConfirm } = useAlert();
  const insets = useSafeAreaInsets();

  const [staffList, setStaffList] = useState<User[]>([]);
  const [targetsMap, setTargetsMap] = useState<Record<string, SalesTarget>>({});
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'salary'>('name');
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk Selection & Pagination
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  // Modals
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [targetModalVisible, setTargetModalVisible] = useState(false);
  const [faceRegModalVisible, setFaceRegModalVisible] = useState(false);
  const [faceMonitoringVisible, setFaceMonitoringVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [selectedDetailStaff, setSelectedDetailStaff] = useState<User | null>(null);
  const [templatesMap, setTemplatesMap] = useState<Record<string, FaceEnrollmentStatus>>({});
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add/Edit Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [designation, setDesignation] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [basicSalary, setBasicSalary] = useState('');
  const [monthlyTarget, setMonthlyTarget] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Target modal form
  const [targetAmount, setTargetAmount] = useState('');
  const [targetUnits, setTargetUnits] = useState('');
  const [incentivePercent, setIncentivePercent] = useState('');

  const nameInputRef = useRef<any>(null);
  const emailInputRef = useRef<any>(null);
  const phoneInputRef = useRef<any>(null);

  const loadStaffData = useCallback(async () => {
    const [users, templates] = await Promise.all([
      StorageService.getAllUsers(),
      StorageService.getFaceTemplates(),
    ]);
    setStaffList(users);

    const tmplMap: Record<string, FaceEnrollmentStatus> = {};
    let pendingCount = 0;

    templates.forEach(t => {
      const status: FaceEnrollmentStatus = t.approvalStatus === 'pending'
        ? 'pending_approval'
        : (t.approvalStatus || (t.status === 'active' ? 'approved' : 'not_enrolled'));
      tmplMap[t.userId] = status;
      if (status === 'pending_approval') pendingCount++;
    });

    setTemplatesMap(tmplMap);
    setPendingApprovalsCount(pendingCount);

    const monthKey = getTodayDateString().substring(0, 7);
    const targetResults = await Promise.all(
      users.map(u => StaffPerformanceService.getStaffTarget(u.id, monthKey))
    );
    const map: Record<string, SalesTarget> = {};
    users.forEach((u, i) => { map[u.id] = targetResults[i]; });
    setTargetsMap(map);
  }, []);

  useEffect(() => {
    loadStaffData();
  }, [loadStaffData]);

  const resetForm = () => {
    setName('');
    setEmail('');
    setPhone('');
    setPhoneError('');
    setDesignation('');
    setRole('staff');
    setBasicSalary('');
    setMonthlyTarget('');
    setIsActive(true);
    setSelectedStaff(null);
  };

  const handleOpenEdit = (staff: User) => {
    setSelectedStaff(staff);
    setName(staff.name);
    setEmail(staff.email);
    setPhone(staff.phone);
    setPhoneError('');
    setDesignation(staff.designation);
    setRole(staff.role);
    setBasicSalary(staff.basicSalary.toString());
    setMonthlyTarget(staff.monthlyTarget.toString());
    setIsActive(staff.isActive);
    setEditModalVisible(true);
  };

  const handleOpenTarget = (staff: User) => {
    setSelectedStaff(staff);
    const currentTgt = targetsMap[staff.id];
    setTargetAmount(currentTgt?.targetAmount?.toString() || staff.monthlyTarget.toString());
    setTargetUnits(currentTgt?.targetUnits?.toString() || '15');
    setIncentivePercent(currentTgt?.incentivePercent?.toString() || '2.0');
    setTargetModalVisible(true);
  };

  const handleSaveNewStaff = async () => {
    if (!name.trim()) {
      nameInputRef.current?.focus();
      showWarning('Validation Error', 'Full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      emailInputRef.current?.focus();
      showWarning('Validation Error', 'Valid email address is required.');
      return;
    }
    const phoneErr = getMobileNumberError(phone, true);
    if (phoneErr) {
      setPhoneError(phoneErr);
      phoneInputRef.current?.focus();
      showWarning('Validation Error', phoneErr);
      return;
    }
    setPhoneError('');

    setIsSubmitting(true);
    try {
      const sanitizedEmail = email.trim().toLowerCase();
      const sanitizedPhone = phone.trim();
      const staffRole = role;
      const staffDesignation = designation.trim() || (staffRole === 'admin' ? 'Store Administrator' : 'Sales Executive');
      const parsedSalary = parseFloat(basicSalary) || 20000;
      const parsedTarget = parseFloat(monthlyTarget) || 200000;

      // Call secure serverless Cloud Function (Firebase Admin SDK)
      const result = await StaffProvisioningService.provisionStaffAccount({
        name: name.trim(),
        email: sanitizedEmail,
        phone: sanitizedPhone,
        role: staffRole,
        designation: staffDesignation,
        basicSalary: parsedSalary,
        monthlyTarget: parsedTarget,
      });

      // Align local store cache with the server-generated Auth UID
      const newUser: User = {
        id: result.uid || `user_${Date.now()}`,
        name: result.name || name.trim(),
        email: result.email || sanitizedEmail,
        phone: sanitizedPhone,
        role: (result.role as UserRole) || staffRole,
        designation: staffDesignation,
        joinedDate: getTodayDateString(),
        basicSalary: parsedSalary,
        monthlyTarget: parsedTarget,
        isActive: true,
      };

      await StorageService.saveUser(newUser);

      // Record immutable audit entry
      await AuditService.logAction({
        adminId: currentUser?.id || 'admin',
        adminName: currentUser?.name || 'Administrator',
        actionType: 'staff_create',
        targetRecordId: newUser.id,
        targetRecordTitle: newUser.name,
        details: `Created staff account for ${newUser.name} (${newUser.role}) with salary ₹${newUser.basicSalary}`,
        afterValue: { name: newUser.name, email: newUser.email, role: newUser.role, basicSalary: newUser.basicSalary },
      });

      // Initialize initial sales target
      const monthKey = getTodayDateString().substring(0, 7);
      await StorageService.saveSalesTarget({
        id: `target_${newUser.id}_${monthKey}`,
        staffId: newUser.id,
        staffName: newUser.name,
        month: monthKey,
        targetAmount: newUser.monthlyTarget,
        achievedAmount: 0,
        targetUnits: 15,
        achievedUnits: 0,
        incentivePercent: 2.0,
        calculatedIncentive: 0,
      });

      setAddModalVisible(false);
      resetForm();
      await loadStaffData();

      // Ensure password setup email is delivered
      let emailMessage = '';
      if (result.emailDelivered) {
        emailMessage = `An invitation email has been sent to ${newUser.email}.`;
      } else {
        try {
          await sendPasswordReset(newUser.email);
          emailMessage = `A password setup email has been dispatched to ${newUser.email} via Firebase.`;
        } catch {
          emailMessage = `Account created. Staff member can use "Forgot Password" on the login screen with ${newUser.email} to set their password.`;
        }
      }

      showSuccess(
        'Staff Account Created',
        `Successfully provisioned account for ${newUser.name}.\n\nFirebase Auth UID:\n${result.uid}\n\n${emailMessage}`
      );
    } catch (err: any) {
      showError('Staff Creation Failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEditStaff = async () => {
    if (!isAdmin) {
      showWarning('Permission Required', "You don't have permission to perform this action. Please contact your administrator.");
      return;
    }
    if (!selectedStaff) return;
    if (!name.trim()) {
      showWarning('Validation Error', 'Full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      showWarning('Validation Error', 'Valid email address is required.');
      return;
    }
    const phoneErr = getMobileNumberError(phone, true);
    if (phoneErr) {
      setPhoneError(phoneErr);
      showWarning('Validation Error', phoneErr);
      return;
    }
    setPhoneError('');

    setIsSubmitting(true);
    try {
      // Synchronize active status with serverless backend for token revocation
      if (isActive !== selectedStaff.isActive) {
        await StaffProvisioningService.setStaffAccountStatus(selectedStaff.id, isActive);
      }

      const updatedUser: User = {
        ...selectedStaff,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        designation: designation.trim(),
        role,
        basicSalary: parseFloat(basicSalary) || selectedStaff.basicSalary,
        monthlyTarget: parseFloat(monthlyTarget) || selectedStaff.monthlyTarget,
        isActive,
      };

      await StorageService.saveUser(updatedUser);

      // Record immutable audit entry
      await AuditService.logAction({
        adminId: currentUser?.id || 'admin',
        adminName: currentUser?.name || 'Administrator',
        actionType: 'staff_edit',
        targetRecordId: updatedUser.id,
        targetRecordTitle: updatedUser.name,
        details: `Updated profile for ${updatedUser.name} (${updatedUser.role})`,
        beforeValue: {
          name: selectedStaff.name,
          designation: selectedStaff.designation,
          role: selectedStaff.role,
          isActive: selectedStaff.isActive,
          basicSalary: selectedStaff.basicSalary,
        },
        afterValue: {
          name: updatedUser.name,
          designation: updatedUser.designation,
          role: updatedUser.role,
          isActive: updatedUser.isActive,
          basicSalary: updatedUser.basicSalary,
        },
      });

      showSuccess('Profile Updated', 'Staff member profile updated successfully.');
      setEditModalVisible(false);
      resetForm();
      loadStaffData();
    } catch (err: any) {
      showError('Update Failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendInvitation = async () => {
    if (!isAdmin) {
      showWarning('Permission Required', "You don't have permission to perform this action. Please contact your administrator.");
      return;
    }
    if (!selectedStaff?.email) return;
    if (!selectedStaff.isActive) {
      showWarning('Account Inactive', 'Cannot generate an invitation for a deactivated account. Reactivate the account first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await StaffProvisioningService.resendStaffInvitation(selectedStaff.email);
      let emailNotice = '';
      if (res.emailDelivered) {
        emailNotice = `Invitation email delivered to ${selectedStaff.email}.`;
      } else {
        try {
          await sendPasswordReset(selectedStaff.email);
          emailNotice = `Password setup email dispatched to ${selectedStaff.email} via Firebase.`;
        } catch {
          emailNotice = `Invitation regenerated. Staff member can also use "Forgot Password" on the login screen with ${selectedStaff.email}.`;
        }
      }
      showSuccess('Invitation Sent', emailNotice);
    } catch (err: any) {
      showError('Invitation Failed', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveTarget = async () => {
    if (!isAdmin) {
      showWarning('Permission Required', "You don't have permission to perform this action. Please contact your administrator.");
      return;
    }
    if (!selectedStaff) return;
    const currentTgt = targetsMap[selectedStaff.id];
    const monthKey = getTodayDateString().substring(0, 7);

    const updatedTgt: SalesTarget = {
      id: currentTgt?.id || `target_${selectedStaff.id}_${monthKey}`,
      staffId: selectedStaff.id,
      staffName: selectedStaff.name,
      month: monthKey,
      targetAmount: parseFloat(targetAmount) || selectedStaff.monthlyTarget,
      achievedAmount: currentTgt?.achievedAmount || 0,
      targetUnits: parseInt(targetUnits, 10) || 15,
      achievedUnits: currentTgt?.achievedUnits || 0,
      incentivePercent: parseFloat(incentivePercent) || 2.0,
      calculatedIncentive: Math.round(
        ((currentTgt?.achievedAmount || 0) * (parseFloat(incentivePercent) || 2.0)) / 100
      ),
    };

    await StaffPerformanceService.updateStaffTarget(updatedTgt);
    showSuccess('Target Assigned', `Monthly sales target set for ${selectedStaff.name}.`);
    setTargetModalVisible(false);
    loadStaffData();
  };

  // --- Bulk Action Handlers ---
  const handleToggleSelectStaff = (id: string) => {
    setSelectedStaffIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleBulkActivate = async () => {
    if (selectedStaffIds.length === 0 || isSubmitting) return;
    showConfirm({
      title: 'Activate Staff Accounts?',
      message: `Are you sure you want to activate ${selectedStaffIds.length} staff account(s)?`,
      confirmText: 'Activate',
      cancelText: 'Cancel',
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          await StaffProvisioningService.bulkSetStaffAccountStatus(selectedStaffIds, true);
          for (const id of selectedStaffIds) {
            const user = staffList.find(u => u.id === id);
            if (user) {
              await StorageService.saveUser({ ...user, isActive: true });
            }
          }
          await AuditService.logAction({
            adminId: currentUser?.id || 'admin',
            adminName: currentUser?.name || 'Administrator',
            actionType: 'staff_bulk_action',
            targetRecordId: 'bulk_activate',
            targetRecordTitle: `${selectedStaffIds.length} Staff Activated`,
            details: `Bulk activated ${selectedStaffIds.length} staff account(s)`,
          });
          showSuccess('Success', `${selectedStaffIds.length} staff account(s) activated successfully.`);
          setSelectedStaffIds([]);
          setIsBulkMode(false);
          await loadStaffData();
        } catch (err: any) {
          showError('Bulk Action Failed', err);
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  };

  const handleBulkDeactivate = async () => {
    if (selectedStaffIds.length === 0 || isSubmitting) return;
    showConfirm({
      title: 'Deactivate Staff Accounts?',
      message: 'The selected staff members will no longer be able to access their accounts. Do you want to continue?',
      confirmText: 'Deactivate',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          await StaffProvisioningService.bulkSetStaffAccountStatus(selectedStaffIds, false);
          for (const id of selectedStaffIds) {
            const user = staffList.find(u => u.id === id);
            if (user) {
              await StorageService.saveUser({ ...user, isActive: false });
            }
          }
          await AuditService.logAction({
            adminId: currentUser?.id || 'admin',
            adminName: currentUser?.name || 'Administrator',
            actionType: 'staff_bulk_action',
            targetRecordId: 'bulk_deactivate',
            targetRecordTitle: `${selectedStaffIds.length} Staff Deactivated`,
            details: `Bulk deactivated ${selectedStaffIds.length} staff account(s)`,
          });
          showSuccess('Success', `${selectedStaffIds.length} staff account(s) deactivated successfully.`);
          setSelectedStaffIds([]);
          setIsBulkMode(false);
          await loadStaffData();
        } catch (err: any) {
          showError('Bulk Action Failed', err);
        } finally {
          setIsSubmitting(false);
        }
      },
    });
  };

  const filteredStaff = useMemo(() => staffList.filter(u => {
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && u.isActive) ||
      (filterStatus === 'inactive' && !u.isActive);
    const q = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.phone.includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.designation && u.designation.toLowerCase().includes(q));
    return matchesRole && matchesStatus && matchesQuery;
  }), [staffList, filterRole, filterStatus, searchQuery]);

  const sortedStaff = useMemo(() => [...filteredStaff].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'date') return (b.joinedDate || '').localeCompare(a.joinedDate || '');
    if (sortBy === 'salary') return b.basicSalary - a.basicSalary;
    return 0;
  }), [filteredStaff, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sortedStaff.length / PAGE_SIZE));
  const paginatedStaff = useMemo(() => sortedStaff.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [sortedStaff, page]);

  if (!isAdmin) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <AppHeader
          title="Staff Management"
          subtitle="Roles, Salaries & Sales Targets"
          showBack
          onBack={() => navigation.goBack()}
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl }}>
          <EmptyState
            title="Unauthorized Access"
            description="Only store administrators are authorized to view team salaries and manage staff records."
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Staff Management"
        subtitle="Roles, Salaries & Sales Targets"
        showBack
        onBack={() => navigation.goBack()}
      />

      {/* Search Bar */}
      <View style={styles.topSearchSection}>
        <SearchInput
          placeholder="Search staff by name, phone, designation..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          onClear={() => setSearchQuery('')}
        />
      </View>

      {/* Role & Status & Sort Filter Bar */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {['all', 'admin', 'staff'].map(roleItem => (
            <FilterChip
              key={roleItem}
              label={
                roleItem === 'all'
                  ? `All Roles (${staffList.length})`
                  : roleItem.toUpperCase()
              }
              active={filterRole === roleItem}
              onPress={() => {
                setFilterRole(roleItem);
                setPage(1);
              }}
            />
          ))}

          {/* Status Filters */}
          <FilterChip
            label={filterStatus === 'all' ? 'Status: All' : filterStatus === 'active' ? 'Active Only' : 'Inactive Only'}
            active={filterStatus !== 'all'}
            onPress={() => {
              setFilterStatus(prev => (prev === 'all' ? 'active' : prev === 'active' ? 'inactive' : 'all'));
              setPage(1);
            }}
          />

          {/* Sort Option */}
          <FilterChip
            icon={<ArrowUpDown size={12} color={colors.primary} />}
            label={`Sort: ${sortBy.toUpperCase()}`}
            active={sortBy !== 'name'}
            onPress={() => {
              setSortBy(prev => (prev === 'name' ? 'date' : prev === 'date' ? 'salary' : 'name'));
              setPage(1);
            }}
          />

          {/* Bulk Select Mode Toggle */}
          <FilterChip
            icon={isBulkMode ? <CheckSquare size={13} color="#FFFFFF" /> : <Square size={13} color={colors.primary} />}
            label={isBulkMode ? `Selecting (${selectedStaffIds.length})` : 'Multi-Select'}
            active={isBulkMode}
            onPress={() => {
              setIsBulkMode(prev => !prev);
              setSelectedStaffIds([]);
            }}
          />

          {/* Payroll Dashboard Shortcut */}
          <FilterChip
            icon={<DollarSign size={13} color={colors.accent} />}
            label="Payroll & Payouts"
            active={false}
            onPress={() => navigation.navigate('Payroll')}
          />

          {/* Biometric Face Monitoring & Approvals */}
          <FilterChip
            icon={<Camera size={13} color={pendingApprovalsCount > 0 ? '#E65100' : colors.primary} />}
            label={pendingApprovalsCount > 0 ? `Face Monitoring (${pendingApprovalsCount} Pending)` : 'Face Monitoring'}
            active={pendingApprovalsCount > 0}
            onPress={() => setFaceMonitoringVisible(true)}
          />
        </ScrollView>
      </View>

      {/* Bulk Action Bar (Visible when bulk mode active and items selected) */}
      {isBulkMode && selectedStaffIds.length > 0 && (
        <View style={[styles.bulkActionBar, { backgroundColor: isDark ? 'rgba(25, 77, 156, 0.2)' : '#EFF6FF', borderColor: colors.primary }]}>
          <Text style={[styles.bulkActionText, { color: colors.text }]}>
            {selectedStaffIds.length} staff selected
          </Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity
              style={[styles.bulkBtn, { backgroundColor: colors.success }]}
              onPress={handleBulkActivate}
            >
              <Text style={styles.bulkBtnText}>Activate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bulkBtn, { backgroundColor: colors.danger }]}
              onPress={handleBulkDeactivate}
            >
              <Text style={styles.bulkBtnText}>Deactivate</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Staff List */}
      <FlatList
        data={paginatedStaff}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const tgt = targetsMap[item.id];
          const percentAchieved =
            tgt && tgt.targetAmount > 0
              ? Math.round((tgt.achievedAmount / tgt.targetAmount) * 100)
              : 0;
          const isSelected = selectedStaffIds.includes(item.id);

          return (
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                if (isBulkMode) {
                  handleToggleSelectStaff(item.id);
                } else {
                  setSelectedDetailStaff(item);
                  setDetailModalVisible(true);
                }
              }}
            >
              <AppCard style={[styles.staffCard, isSelected && { borderColor: colors.primary, borderWidth: 1.5 }]}>
                <View style={styles.cardHeader}>
                  {isBulkMode && (
                    <TouchableOpacity
                      onPress={() => handleToggleSelectStaff(item.id)}
                      style={{ marginRight: 8, justifyContent: 'center' }}
                    >
                      {isSelected ? (
                        <CheckSquare size={20} color={colors.primary} />
                      ) : (
                        <Square size={20} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  )}
                  <View style={[styles.avatarBox, { backgroundColor: colors.primary }]}>
                    <Text style={styles.avatarText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <View style={styles.headerInfo}>
                    <View style={styles.nameRow}>
                      <Text style={[styles.staffName, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <StatusBadge
                        label={item.isActive ? 'ACTIVE' : 'INACTIVE'}
                        variant={item.isActive ? 'success' : 'danger'}
                        size="small"
                      />
                    </View>

                    <View style={styles.subHeaderRow}>
                      <Text style={[styles.staffDesignation, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.designation} • <Text style={{ textTransform: 'capitalize' }}>{item.role}</Text>
                      </Text>
                      {(() => {
                        const status = templatesMap[item.id] || (item.hasFaceRegistered ? 'approved' : 'not_enrolled');
                        if (status === 'approved') {
                          return <StatusBadge label="FACE APPROVED" variant="success" size="small" />;
                        }
                        if (status === 'pending_approval') {
                          return <StatusBadge label="PENDING APPROVAL" variant="warning" size="small" />;
                        }
                        if (status === 'rejected') {
                          return <StatusBadge label="FACE REJECTED" variant="danger" size="small" />;
                        }
                        return <StatusBadge label="NO FACE" variant="neutral" size="small" />;
                      })()}
                    </View>
                  </View>
                </View>

                {/* Contact & Financial Details */}
                <View style={[styles.infoGrid, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                      BASIC SALARY
                    </Text>
                    <Text
                      style={[styles.infoVal, { color: colors.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {formatCurrency(item.basicSalary)}
                    </Text>
                  </View>

                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                      MONTHLY TARGET
                    </Text>
                    <Text
                      style={[styles.infoVal, { color: colors.primary }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {formatCurrency(tgt?.targetAmount || item.monthlyTarget)}
                    </Text>
                  </View>

                  <View style={styles.infoCol}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                      ACHIEVED
                    </Text>
                    <Text
                      style={[styles.infoVal, { color: percentAchieved >= 100 ? colors.success : colors.warning }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {percentAchieved}%
                    </Text>
                  </View>
                </View>

                {/* Card Actions */}
                <View style={styles.actionsRow}>
                  <TouchableOpacity
                    style={[
                      styles.actionBtn,
                      {
                        borderColor: templatesMap[item.id] === 'pending_approval' ? '#FF9800' : colors.primary,
                        backgroundColor: templatesMap[item.id] === 'pending_approval'
                          ? '#FFF3E0'
                          : (isDark ? 'rgba(25, 77, 156, 0.15)' : '#EAF2FF'),
                      },
                    ]}
                    onPress={() => {
                      if (templatesMap[item.id] === 'pending_approval') {
                        setFaceMonitoringVisible(true);
                      } else {
                        setSelectedStaff(item);
                        setFaceRegModalVisible(true);
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <Camera
                      size={13}
                      color={templatesMap[item.id] === 'pending_approval' ? '#E65100' : colors.primary}
                      style={{ marginRight: 3 }}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { color: templatesMap[item.id] === 'pending_approval' ? '#E65100' : colors.primary },
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      {templatesMap[item.id] === 'pending_approval'
                        ? 'Review Face'
                        : (templatesMap[item.id] === 'approved' || item.hasFaceRegistered ? 'Manage Face' : 'Register Face')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
                    onPress={() => handleOpenTarget(item)}
                    activeOpacity={0.7}
                  >
                    <Target size={13} color={colors.textSecondary} style={{ marginRight: 3 }} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      Target
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
                    onPress={() => handleOpenEdit(item)}
                    activeOpacity={0.7}
                  >
                    <Shield size={13} color={colors.textSecondary} style={{ marginRight: 3 }} />
                    <Text
                      style={[styles.actionBtnText, { color: colors.text }]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                    >
                      Edit Profile
                    </Text>
                  </TouchableOpacity>
                </View>
              </AppCard>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                disabled={page <= 1}
                onPress={() => setPage(p => Math.max(1, p - 1))}
                style={[styles.pageBtn, page <= 1 && { opacity: 0.4 }]}
              >
                <ChevronLeft size={16} color={colors.text} />
                <Text style={[styles.pageBtnText, { color: colors.text }]}>Prev</Text>
              </TouchableOpacity>

              <Text style={[styles.pageInfoText, { color: colors.textSecondary }]}>
                Page {page} of {totalPages} ({sortedStaff.length} Total)
              </Text>

              <TouchableOpacity
                disabled={page >= totalPages}
                onPress={() => setPage(p => Math.min(totalPages, p + 1))}
                style={[styles.pageBtn, page >= totalPages && { opacity: 0.4 }]}
              >
                <Text style={[styles.pageBtnText, { color: colors.text }]}>Next</Text>
                <ChevronRight size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Users size={32} color={colors.textMuted} />}
            title="No Staff Found"
            description={
              searchQuery
                ? `No staff members match "${searchQuery}".`
                : 'No staff members registered under this filter.'
            }
            actionTitle="+ Add Staff Member"
            onActionPress={() => setAddModalVisible(true)}
          />
        }
      />

      {/* Floating Action Button (FAB) for Add Staff */}
      {isAdmin ? (
        <TouchableOpacity
          style={[
            styles.fab,
            {
              backgroundColor: colors.primary,
              bottom: Math.max(insets.bottom, 24) + 16,
            },
          ]}
          onPress={() => setAddModalVisible(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add Staff"
        >
          <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
          <Text style={styles.fabText} numberOfLines={1}>
            Add Staff
          </Text>
        </TouchableOpacity>
      ) : null}

      {/* Add Staff Modal */}
      <ModalCard
        visible={addModalVisible}
        onClose={() => setAddModalVisible(false)}
        title="Add Staff Member"
        subtitle="Create staff account with role and compensation"
      >
        <Input
          ref={nameInputRef}
          label="Full Name *"
          placeholder="e.g. Ramesh Patel"
          autoCapitalize="words"
          returnKeyType="next"
          value={name}
          onChangeText={setName}
        />
        <Input
          ref={emailInputRef}
          label="Email Address *"
          placeholder="staff@parthmobile.com"
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="next"
          value={email}
          onChangeText={setEmail}
        />
        <Input
          ref={phoneInputRef}
          label="Mobile Number *"
          placeholder="Enter 10-digit mobile number"
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={(val) => {
            const clean = sanitizeMobileNumber(val);
            setPhone(clean);
            setPhoneError(validateMobileNumber(clean, true, true, val));
          }}
          onBlur={() => {
            setPhoneError(getMobileNumberError(phone, true));
          }}
          error={phoneError}
        />
        <Input
          label="Designation"
          placeholder="e.g. Senior Sales Executive"
          value={designation}
          onChangeText={setDesignation}
        />

        {/* Role Selection */}
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>System Role *</Text>
        <View style={styles.roleChipsRow}>
          {(['staff', 'admin'] as UserRole[]).map(r => (
            <FilterChip
              key={r}
              label={r.toUpperCase()}
              active={role === r}
              onPress={() => setRole(r)}
            />
          ))}
        </View>

        <Input
          label="Basic Salary (₹ / month)"
          placeholder="20000"
          keyboardType="numeric"
          value={basicSalary}
          onChangeText={setBasicSalary}
        />
        <Input
          label="Monthly Sales Target (₹)"
          placeholder="200000"
          keyboardType="numeric"
          value={monthlyTarget}
          onChangeText={setMonthlyTarget}
        />

        <PrimaryButton
          title={isSubmitting ? 'Provisioning Staff...' : 'Register Staff'}
          icon={!isSubmitting ? <Check size={18} color="#FFFFFF" strokeWidth={2.5} /> : undefined}
          onPress={handleSaveNewStaff}
          size="large"
          loading={isSubmitting}
          disabled={isSubmitting}
          style={{ marginTop: SPACING.lg }}
        />
      </ModalCard>

      {/* Edit Staff Modal */}
      <ModalCard
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        title="Edit Staff Member"
        subtitle={selectedStaff?.name || ''}
      >
        <Input
          label="Full Name *"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          returnKeyType="next"
        />
        <Input
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          returnKeyType="next"
        />
        <Input
          label="Mobile Number *"
          placeholder="Enter 10-digit mobile number"
          value={phone}
          onChangeText={(val) => {
            const clean = sanitizeMobileNumber(val);
            setPhone(clean);
            setPhoneError(validateMobileNumber(clean, true, true, val));
          }}
          onBlur={() => {
            setPhoneError(getMobileNumberError(phone, true));
          }}
          keyboardType="phone-pad"
          maxLength={10}
          error={phoneError}
          returnKeyType="next"
        />
        <Input
          label="Designation"
          value={designation}
          onChangeText={setDesignation}
          autoCapitalize="words"
          returnKeyType="done"
        />

        {/* Role Selection */}
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>System Role</Text>
        <View style={styles.roleChipsRow}>
          {(['staff', 'admin'] as UserRole[]).map(r => (
            <FilterChip
              key={r}
              label={r.toUpperCase()}
              active={role === r}
              onPress={() => setRole(r)}
            />
          ))}
        </View>

        <Input
          label="Basic Salary (₹ / month)"
          value={basicSalary}
          onChangeText={setBasicSalary}
          keyboardType="numeric"
        />

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Active Account</Text>
          <Switch
            value={isActive}
            onValueChange={setIsActive}
            trackColor={{ false: '#767577', true: colors.primary }}
          />
        </View>

        <Button
          title="Resend Password Setup Invitation"
          variant="outline"
          onPress={handleResendInvitation}
          disabled={isSubmitting}
          style={{ marginTop: SPACING.md }}
        />

        <PrimaryButton
          title={isSubmitting ? 'Saving Changes...' : 'Save Changes'}
          onPress={handleSaveEditStaff}
          size="large"
          loading={isSubmitting}
          disabled={isSubmitting}
          style={{ marginTop: SPACING.md }}
        />
      </ModalCard>

      {/* Assign Sales Target Modal */}
      <ModalCard
        visible={targetModalVisible}
        onClose={() => setTargetModalVisible(false)}
        title="Sales Target & Incentive"
        subtitle={`Configure monthly target for ${selectedStaff?.name}`}
      >
        <Input
          label="Target Sales Amount (₹) *"
          placeholder="200000"
          keyboardType="numeric"
          value={targetAmount}
          onChangeText={setTargetAmount}
        />
        <Input
          label="Target Units to Sell"
          placeholder="15"
          keyboardType="numeric"
          value={targetUnits}
          onChangeText={setTargetUnits}
        />
        <Input
          label="Incentive Rate (%)"
          placeholder="2.0"
          keyboardType="numeric"
          value={incentivePercent}
          onChangeText={setIncentivePercent}
        />

        <PrimaryButton
          title="Save Sales Target"
          onPress={handleSaveTarget}
          size="large"
          style={{ marginTop: SPACING.md }}
        />
      </ModalCard>

      {/* Staff Biometric Face Registration Modal */}
      <FaceRegistrationModal
        visible={faceRegModalVisible}
        staff={selectedStaff}
        currentUserId={currentUser?.id || 'admin'}
        onSuccess={() => {
          loadStaffData();
        }}
        onClose={() => setFaceRegModalVisible(false)}
      />

      {/* Staff 6-Tab Comprehensive Detail Modal */}
      <StaffDetailModal
        visible={detailModalVisible}
        staff={selectedDetailStaff}
        onClose={() => setDetailModalVisible(false)}
        onEdit={staff => {
          setDetailModalVisible(false);
          handleOpenEdit(staff);
        }}
        onSetTarget={staff => {
          setDetailModalVisible(false);
          handleOpenTarget(staff);
        }}
        onFaceRegister={staff => {
          setDetailModalVisible(false);
          setSelectedStaff(staff);
          setFaceRegModalVisible(true);
        }}
        onResendInvite={staff => {
          setSelectedStaff(staff);
          handleResendInvitation();
        }}
      />

      {/* Admin Biometric Face Monitoring & Approvals Modal */}
      {currentUser && (
        <FaceMonitoringModal
          visible={faceMonitoringVisible}
          currentAdmin={currentUser}
          onClose={() => setFaceMonitoringVisible(false)}
          onRefresh={loadStaffData}
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  topSearchSection: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
  },
  filterBar: {
    paddingVertical: SPACING.xs,
  },
  filterScroll: {
    paddingHorizontal: SPACING.lg,
    paddingRight: SPACING.xxl,
    gap: SPACING.sm,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 130,
  },
  staffCard: {
    marginBottom: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  avatarBox: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  staffName: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 16,
    flex: 1,
    marginRight: 6,
  },
  staffDesignation: {
    ...TYPOGRAPHY.caption,
    flex: 1,
    marginRight: 6,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
    gap: 6,
  },
  infoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    marginBottom: SPACING.sm,
  },
  infoCol: {
    alignItems: 'center',
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 2,
  },
  infoLabel: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  infoVal: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  actionBtnText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
  },
  formLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    marginTop: SPACING.sm,
  },
  roleChipsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginVertical: SPACING.xs,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.sm,
  },
  switchLabel: {
    ...TYPOGRAPHY.bodyBold,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: RADIUS.full,
    ...SHADOWS.floating,
    elevation: 8,
    zIndex: 99,
  },
  fabText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
    flexShrink: 0,
  },
  bulkActionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
    borderWidth: 1,
    marginHorizontal: SPACING.lg,
    marginBottom: 4,
    borderRadius: RADIUS.md,
  },
  bulkActionText: {
    fontSize: 12,
    fontWeight: '700',
  },
  bulkBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.sm,
  },
  bulkBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 6,
    marginTop: 8,
  },
  pageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.sm,
    gap: 4,
  },
  pageBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pageInfoText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

