import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
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
  FilterChip,
  ModalCard,
  SectionHeader,
  EmptyState,
  FaceRegistrationModal,
} from '../components';
import { User, UserRole, SalesTarget } from '../types';
import { StorageService } from '../services/storageService';
import { StaffPerformanceService } from '../services/staffPerformanceService';
import { formatCurrency, getTodayDateString } from '../utils/format';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  MOBILE_NUMBER_ERROR_MESSAGE,
  getMobileNumberError,
  sanitizeMobileNumber,
  validateMobileNumber,
} from '../utils/validation';

interface StaffManagementScreenProps {
  navigation: any;
}

export const StaffManagementScreen: React.FC<StaffManagementScreenProps> = ({ navigation }) => {
  const { currentUser, isAdmin } = useAuth();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [staffList, setStaffList] = useState<User[]>([]);
  const [targetsMap, setTargetsMap] = useState<Record<string, SalesTarget>>({});
  const [filterRole, setFilterRole] = useState<string>('all');

  // Modals
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [targetModalVisible, setTargetModalVisible] = useState(false);
  const [faceRegModalVisible, setFaceRegModalVisible] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [templatesMap, setTemplatesMap] = useState<Record<string, boolean>>({});

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

  const loadStaffData = async () => {
    const users = await StorageService.getAllUsers();
    setStaffList(users);

    const templates = await StorageService.getFaceTemplates();
    const tmplMap: Record<string, boolean> = {};
    templates.forEach(t => {
      if (t.status === 'active') {
        tmplMap[t.userId] = true;
      }
    });
    setTemplatesMap(tmplMap);

    const monthKey = getTodayDateString().substring(0, 7);
    const map: Record<string, SalesTarget> = {};
    for (const u of users) {
      const tgt = await StaffPerformanceService.getStaffTarget(u.id, monthKey);
      map[u.id] = tgt;
    }
    setTargetsMap(map);
  };

  useEffect(() => {
    loadStaffData();
  }, []);

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
      Alert.alert('Validation Error', 'Full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'Valid email address is required.');
      return;
    }
    const phoneErr = getMobileNumberError(phone, true);
    if (phoneErr) {
      setPhoneError(phoneErr);
      Alert.alert('Validation Error', phoneErr);
      return;
    }
    setPhoneError('');

    const newUser: User = {
      id: `user_staff_${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      role,
      designation: designation.trim() || (role === 'manager' ? 'Floor Manager' : 'Sales Executive'),
      joinedDate: getTodayDateString(),
      basicSalary: parseFloat(basicSalary) || 20000,
      monthlyTarget: parseFloat(monthlyTarget) || 200000,
      isActive: true,
    };

    await StorageService.saveUser(newUser);

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

    Alert.alert('Staff Added', `${newUser.name} has been added to the store system.`);
    setAddModalVisible(false);
    resetForm();
    loadStaffData();
  };

  const handleSaveEditStaff = async () => {
    if (!selectedStaff) return;
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Full name is required.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      Alert.alert('Validation Error', 'Valid email address is required.');
      return;
    }
    const phoneErr = getMobileNumberError(phone, true);
    if (phoneErr) {
      setPhoneError(phoneErr);
      Alert.alert('Validation Error', phoneErr);
      return;
    }
    setPhoneError('');

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
    Alert.alert('Updated', 'Staff member profile updated successfully.');
    setEditModalVisible(false);
    resetForm();
    loadStaffData();
  };

  const handleSaveTarget = async () => {
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
    Alert.alert('Target Assigned', `Monthly sales target set for ${selectedStaff.name}.`);
    setTargetModalVisible(false);
    loadStaffData();
  };

  const filteredStaff = staffList.filter(u => {
    if (filterRole === 'all') return true;
    return u.role === filterRole;
  });

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Staff Management"
        subtitle="Roles, Salaries & Sales Targets"
        showBack
        onBack={() => navigation.goBack()}
      />

      {/* Role Filter Chips */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['all', 'admin', 'manager', 'staff']}
          keyExtractor={item => item}
          contentContainerStyle={styles.filterScroll}
          renderItem={({ item }) => (
            <FilterChip
              label={
                item === 'all'
                  ? `All Staff (${staffList.length})`
                  : item.toUpperCase()
              }
              active={filterRole === item}
              onPress={() => setFilterRole(item)}
            />
          )}
        />
      </View>

      {/* Staff List */}
      <FlatList
        data={filteredStaff}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const tgt = targetsMap[item.id];
          const percentAchieved =
            tgt && tgt.targetAmount > 0
              ? Math.round((tgt.achievedAmount / tgt.targetAmount) * 100)
              : 0;

          return (
            <AppCard style={styles.staffCard}>
              <View style={styles.cardHeader}>
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <StatusBadge
                        label={templatesMap[item.id] || item.hasFaceRegistered ? 'FACE ON' : 'NO FACE'}
                        variant={templatesMap[item.id] || item.hasFaceRegistered ? 'success' : 'warning'}
                        size="small"
                      />
                      <StatusBadge
                        label={item.isActive ? 'ACTIVE' : 'INACTIVE'}
                        variant={item.isActive ? 'success' : 'danger'}
                        size="small"
                      />
                    </View>
                  </View>
                  <Text style={[styles.staffDesignation, { color: colors.textSecondary }]}>
                    {item.designation} • <Text style={{ textTransform: 'capitalize' }}>{item.role}</Text>
                  </Text>
                </View>
              </View>

              {/* Contact & Financial Details */}
              <View style={[styles.infoGrid, { borderTopColor: colors.border, borderBottomColor: colors.border }]}>
                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>BASIC SALARY</Text>
                  <Text style={[styles.infoVal, { color: colors.text }]}>
                    {formatCurrency(item.basicSalary)}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>MONTHLY TARGET</Text>
                  <Text style={[styles.infoVal, { color: colors.primary }]}>
                    {formatCurrency(tgt?.targetAmount || item.monthlyTarget)}
                  </Text>
                </View>

                <View style={styles.infoCol}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>ACHIEVED</Text>
                  <Text style={[styles.infoVal, { color: percentAchieved >= 100 ? colors.success : colors.warning }]}>
                    {percentAchieved}%
                  </Text>
                </View>
              </View>

              {/* Card Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.primary, backgroundColor: isDark ? 'rgba(25, 77, 156, 0.15)' : '#EAF2FF' }]}
                  onPress={() => {
                    setSelectedStaff(item);
                    setFaceRegModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Camera size={13} color={colors.primary} style={{ marginRight: 3 }} />
                  <Text style={[styles.actionBtnText, { color: colors.primary }]}>
                    {templatesMap[item.id] || item.hasFaceRegistered ? 'Manage Face' : 'Register Face'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
                  onPress={() => handleOpenTarget(item)}
                  activeOpacity={0.7}
                >
                  <Target size={13} color={colors.textSecondary} style={{ marginRight: 3 }} />
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>
                    Target
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
                  onPress={() => handleOpenEdit(item)}
                  activeOpacity={0.7}
                >
                  <Shield size={13} color={colors.textSecondary} style={{ marginRight: 3 }} />
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>
                    Edit Profile
                  </Text>
                </TouchableOpacity>
              </View>
            </AppCard>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            icon={<Users size={32} color={colors.textMuted} />}
            title="No Staff Found"
            description="No staff members registered under this filter."
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
          label="Full Name *"
          placeholder="e.g. Ramesh Patel"
          value={name}
          onChangeText={setName}
        />
        <Input
          label="Email Address *"
          placeholder="staff@parthmobile.com"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />
        <Input
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
          {(['staff', 'manager', 'admin'] as UserRole[]).map(r => (
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
          title="✓ Register Staff"
          onPress={handleSaveNewStaff}
          size="large"
          style={{ marginTop: SPACING.md }}
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
        />
        <Input
          label="Email Address"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
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
        />
        <Input
          label="Designation"
          value={designation}
          onChangeText={setDesignation}
        />

        {/* Role Selection */}
        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>System Role</Text>
        <View style={styles.roleChipsRow}>
          {(['staff', 'manager', 'admin'] as UserRole[]).map(r => (
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

        <PrimaryButton
          title="Save Changes"
          onPress={handleSaveEditStaff}
          size="large"
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
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  filterBar: {
    paddingVertical: SPACING.xs,
  },
  filterScroll: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  listContent: {
    padding: SPACING.lg,
    paddingBottom: 96,
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
    marginTop: 2,
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
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: RADIUS.full,
    ...SHADOWS.floating,
    elevation: 8,
    zIndex: 99,
  },
  fabText: {
    ...TYPOGRAPHY.button,
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
    flexShrink: 0,
  },
});

