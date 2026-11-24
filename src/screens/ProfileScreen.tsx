import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Share,
  TouchableOpacity,
  Keyboard,
  Platform,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { useShopConfig } from '../context/ShopConfigContext';
import { Phone, Mail, Camera } from 'lucide-react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import { CloudinaryService } from '../services/cloudinaryService';
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
  ModalCard,
} from '../components';
import { DeviceBindingModal } from '../components/DeviceBindingModal';
import { StaffPerformanceService } from '../services/staffPerformanceService';
import { PdfService } from '../services/pdfService';
import { SalarySlip, SalesTarget } from '../types';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';
import { formatCurrency, getTodayDateString } from '../utils/format';

interface InfoRowProps {
  icon: any;
  label: string;
  value?: string | null;
  colors: any;
  isDark: boolean;
  isLast?: boolean;
  onPress?: () => void;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value, colors, isDark, isLast = false, onPress }) => {
  if (!value) return null;
  const content = (
    <View
      style={[
        styles.infoRow,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.borderLight,
        },
      ]}
    >
      <View
        style={[
          styles.infoIconWrap,
          { backgroundColor: isDark ? 'rgba(25, 77, 156, 0.2)' : 'rgba(25, 77, 156, 0.08)' },
        ]}
      >
        <AppIcon name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={2}>
          {value}
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

interface ActionRowProps {
  icon: any;
  title: string;
  subtitle?: string;
  onPress: () => void;
  colors: any;
  isDark: boolean;
  isLast?: boolean;
}

const ActionRow: React.FC<ActionRowProps> = ({
  icon,
  title,
  subtitle,
  onPress,
  colors,
  isDark,
  isLast = false,
}) => {
  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={[
        styles.actionRow,
        !isLast && {
          borderBottomWidth: 1,
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.borderLight,
        },
      ]}
    >
      <View
        style={[
          styles.infoIconWrap,
          { backgroundColor: isDark ? 'rgba(25, 77, 156, 0.2)' : 'rgba(25, 77, 156, 0.08)' },
        ]}
      >
        <AppIcon name={icon} size={16} color={colors.primary} />
      </View>
      <View style={styles.actionContent}>
        <Text style={[styles.actionTitle, { color: colors.text }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.actionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      <AppIcon name="chevron-right" size={16} color={colors.textMuted} />
    </TouchableOpacity>
  );
};

export const ProfileScreen: React.FC<{ navigation?: any }> = () => {
  const { currentUser, role, logout, sendPasswordReset, updateUserProfile } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { showSuccess, showError, showConfirm } = useAlert();
  const { config } = useShopConfig();

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const handlePickAvatar = async () => {
    try {
      const res = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
      });

      if (res.didCancel || !res.assets || res.assets.length === 0 || !res.assets[0].uri) {
        return;
      }

      const file = res.assets[0];
      const check = CloudinaryService.validateImageMeta(file.type || 'image/jpeg', file.fileSize);
      if (!check.valid) {
        showError('Invalid Image', check.error || 'Please choose an image under 5 MB.');
        return;
      }

      if (!CloudinaryService.isConfigured()) {
        showError(
          'Cloud Storage Disconnected',
          'Profile avatar cloud upload is temporarily paused until a new storage account is connected.'
        );
        return;
      }

      setIsUploadingAvatar(true);
      const uploadRes = await CloudinaryService.uploadImage(file.uri, {
        folder: 'avatars',
        tags: ['staff_avatar', currentUser?.id || 'staff'],
      });

      if (uploadRes.success && uploadRes.secureUrl) {
        await updateUserProfile({ avatarUrl: uploadRes.secureUrl });
        showSuccess('Avatar Updated', 'Your profile picture has been updated.');
      } else {
        showError('Upload Failed', uploadRes.error || 'Could not upload avatar.');
      }
    } catch (err: any) {
      showError('Error', err?.message || 'Failed to select image.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Active section tab: 'account' | 'performance' (Staff-only app)
  const [activeSection, setActiveSection] = useState<'account' | 'performance'>('account');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Performance & Month-wise Salary slip
  const availableMonths = useMemo(() => {
    const list: Array<{ key: string; label: string }> = [];
    const now = new Date();
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const key = `${y}-${m}`;
      const label = `${monthNames[d.getMonth()]} ${y}`;
      list.push({ key, label });
    }
    return list;
  }, []);

  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(getTodayDateString().substring(0, 7));
  const [salarySlip, setSalarySlip] = useState<SalarySlip | null>(null);
  const [salesTarget, setSalesTarget] = useState<SalesTarget | null>(null);
  const [salaryModalVisible, setSalaryModalVisible] = useState(false);
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);

  useEffect(() => {
    if (currentUser) {
      StaffPerformanceService.getSalarySlip(currentUser, selectedMonthKey)
        .then(setSalarySlip)
        .catch(err => {
          if (__DEV__) console.warn('Error loading slip:', err);
          setSalarySlip(null);
        });

      StaffPerformanceService.getStaffTarget(currentUser.id, selectedMonthKey)
        .then(setSalesTarget)
        .catch(err => { if (__DEV__) console.warn('Error loading target:', err); });
    }
  }, [currentUser, selectedMonthKey]);

  const handleDownloadPdfSalarySlip = async () => {
    if (!salarySlip) return;
    try {
      await PdfService.printOrSavePdf(salarySlip, config);
    } catch (e: any) {
      showError('PDF Error', e.message || 'Could not generate PDF.');
    }
  };

  const handleShareSalarySlip = async () => {
    if (!salarySlip) return;
    const message = `PARTH MOBILE CARE - SALARY STATEMENT\nEmployee: ${salarySlip.staffName}\nMonth: ${salarySlip.month}\nNet Pay: ${formatCurrency(salarySlip.netSalary)}\nWorking Days: ${salarySlip.totalWorkingDays} | Present: ${salarySlip.presentDays}\nBasic: ${formatCurrency(salarySlip.basicSalary)} | Incentive: +${formatCurrency(salarySlip.salesIncentive)}`;
    try {
      await Share.share({ title: `Salary Slip - ${salarySlip.staffName}`, message });
    } catch (e: any) {
      showError('Error', e.message);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="My Profile"
        subtitle="Staff account & performance targets"
        rightAction={
          <TouchableOpacity
            onPress={toggleTheme}
            style={[
              styles.headerThemeBtn,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                borderColor: colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            accessibilityHint="Toggles between light and dark mode"
            activeOpacity={0.7}
          >
            <AppIcon
              name={isDark ? 'sun' : 'moon'}
              size={18}
              color={isDark ? '#FBBF24' : colors.primary}
            />
          </TouchableOpacity>
        }
      />

      {/* Hero Profile Banner */}
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: colors.card,
            borderColor: isDark ? colors.border : '#E2E8F0',
          },
          SHADOWS.card,
        ]}
      >
        {/* Top Row: Avatar on left, Name/Designation in middle, Staff badge at top-right */}
        <View style={styles.heroTopRow}>
          <View style={{ position: 'relative' }}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handlePickAvatar}
              disabled={isUploadingAvatar}
              style={[
                styles.avatar,
                {
                  backgroundColor: colors.primary,
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : '#E2E8F0',
                  overflow: 'hidden',
                },
              ]}
            >
              {isUploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : currentUser?.avatarUrl ? (
                <Image
                  source={{ uri: CloudinaryService.getDeviceThumbnailUrl(currentUser.avatarUrl) }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'S'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handlePickAvatar}
              disabled={isUploadingAvatar}
              activeOpacity={0.7}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                backgroundColor: colors.primary,
                borderRadius: 11,
                width: 22,
                height: 22,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 2,
                borderColor: colors.card,
              }}
            >
              <Camera size={11} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.heroIdentityCol}>
            <View style={styles.heroNameBadgeRow}>
              <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                {currentUser?.name || 'Staff Member'}
              </Text>
              <StatusBadge
                label="Staff"
                variant="neutral"
                size="small"
              />
            </View>
            <Text style={[styles.profileDesignation, { color: colors.textSecondary }]} numberOfLines={1}>
              {currentUser?.designation || 'Sales & Service Specialist'}
            </Text>
          </View>
        </View>

        {/* Bottom Row: Phone number and Email address */}
        <View style={[styles.heroContactRow, { borderTopColor: isDark ? colors.border : '#F1F5F9' }]}>
          <View style={styles.heroContactItem}>
            <Phone size={14} color={colors.primary} />
            <Text style={[styles.heroContactText, { color: colors.textSecondary }]}>
              +91 {currentUser?.phone || '—'}
            </Text>
          </View>
          {currentUser?.email ? (
            <View style={styles.heroContactItem}>
              <Mail size={14} color={colors.primary} />
              <Text style={[styles.heroContactText, { color: colors.textSecondary }]} numberOfLines={1}>
                {currentUser.email}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Pill Section Switcher */}
      <View style={styles.sectionPills}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {[
            { key: 'account', label: 'Account', icon: 'user', iconColor: colors.primary },
            { key: 'performance', label: 'Targets & Salary', icon: 'analytics', iconColor: colors.warning },
          ].map(tab => {
            const isActive = activeSection === tab.key;
            return (
              <FilterChip
                key={tab.key}
                label={tab.label}
                icon={<AppIcon name={tab.icon as any} size={16} color={isActive ? '#FFFFFF' : tab.iconColor} />}
                active={isActive}
                onPress={() => setActiveSection(tab.key as any)}
              />
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          keyboardHeight > 0 && { paddingBottom: keyboardHeight + SPACING.xxl + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* --- 1. Account Settings --- */}
        {activeSection === 'account' && (
          <>
            {/* Account Information Card */}
            <AppCard>
              <SectionHeader
                title="Account Information"
                subtitle="Your staff profile"
                style={{ marginTop: 0 }}
              />
              <View style={styles.cardContent}>
                <InfoRow
                  icon="user"
                  label="Full Name"
                  value={currentUser?.name}
                  colors={colors}
                  isDark={isDark}
                />
                <InfoRow
                  icon="phone"
                  label="Mobile Number"
                  value={currentUser?.phone ? `+91 ${currentUser.phone}` : null}
                  colors={colors}
                  isDark={isDark}
                />
                <InfoRow
                  icon="message"
                  label="Email Address"
                  value={currentUser?.email}
                  colors={colors}
                  isDark={isDark}
                />
                <InfoRow
                  icon="tag"
                  label="Role & Designation"
                  value={`Staff • ${currentUser?.designation || 'Sales & Support'}`}
                  colors={colors}
                  isDark={isDark}
                />
                {currentUser?.joinedDate ? (
                  <InfoRow
                    icon="calendar"
                    label="Joined Date"
                    value={currentUser.joinedDate}
                    colors={colors}
                    isDark={isDark}
                  />
                ) : null}
                {currentUser?.hasFaceRegistered !== undefined ? (
                  <InfoRow
                    icon="check"
                    label="Biometric Verification"
                    value={currentUser.hasFaceRegistered ? 'Enrolled & Verified' : 'Face Not Enrolled'}
                    colors={colors}
                    isDark={isDark}
                  />
                ) : null}
                <InfoRow
                  icon="phone"
                  label="Linked Phone"
                  value={
                    currentUser?.deviceBindingStatus === 'approved'
                      ? `Approved (${currentUser.deviceModel || 'Phone'})`
                      : currentUser?.deviceBindingStatus === 'pending_approval'
                      ? 'Pending Admin Approval'
                      : currentUser?.deviceBindingStatus === 'rejected'
                      ? 'Registration Rejected'
                      : 'Device Not Bound'
                  }
                  colors={colors}
                  isDark={isDark}
                  onPress={() => setDeviceModalVisible(true)}
                  isLast
                />
              </View>
            </AppCard>

            {/* Store Information (Read Only) */}
            <AppCard>
              <SectionHeader
                title="Store Details"
                subtitle="Shop address & hours"
                style={{ marginTop: 0 }}
              />
              <View style={styles.cardContent}>
                <InfoRow
                  icon="home"
                  label="Shop Name"
                  value={config.shopName}
                  colors={colors}
                  isDark={isDark}
                />
                <InfoRow
                  icon="location"
                  label="Address"
                  value={config.shopAddress}
                  colors={colors}
                  isDark={isDark}
                />
                <InfoRow
                  icon="tag"
                  label="GST Number"
                  value={config.gstNumber}
                  colors={colors}
                  isDark={isDark}
                />
                <InfoRow
                  icon="clock"
                  label="Operating Hours"
                  value={`${config.openingTime} – ${config.closingTime}`}
                  colors={colors}
                  isDark={isDark}
                  isLast
                />
              </View>
            </AppCard>

            {/* Account Actions */}
            <AppCard>
              <SectionHeader
                title="Account Actions"
                subtitle="Security & Session Management"
                style={{ marginTop: 0 }}
              />
              <View style={styles.cardContent}>
                <ActionRow
                  icon="settings"
                  title="Reset Password"
                  subtitle={`Send reset link to ${currentUser?.email || 'registered email'}`}
                  onPress={() => {
                    showConfirm({
                      title: 'Reset Password',
                      message: `Send a password reset email to ${currentUser?.email}?`,
                      confirmText: 'Send Link',
                      cancelText: 'Cancel',
                      onConfirm: async () => {
                        try {
                          if (currentUser?.email) {
                            await sendPasswordReset(currentUser.email);
                            showSuccess(
                              'Email Sent',
                              `Password reset link has been sent to ${currentUser.email}. Please check your inbox.`
                            );
                          }
                        } catch (e: any) {
                          showError('Error', e);
                        }
                      },
                    });
                  }}
                  colors={colors}
                  isDark={isDark}
                  isLast
                />
              </View>
            </AppCard>

            {/* Logout Card */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => {
                showConfirm({
                  title: 'Sign Out',
                  message: 'Are you sure you want to sign out of your account?',
                  confirmText: 'Sign Out',
                  cancelText: 'Cancel',
                  destructive: true,
                  onConfirm: logout,
                });
              }}
              accessibilityRole="button"
              accessibilityLabel="Sign Out"
              style={[
                styles.logoutCard,
                {
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
                  borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FECACA',
                },
              ]}
            >
              <View
                style={[
                  styles.infoIconWrap,
                  { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' },
                ]}
              >
                <AppIcon name="upload" size={16} color="#DC2626" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.logoutTitle}>Sign Out</Text>
                <Text style={[styles.logoutSub, { color: isDark ? '#FCA5A5' : '#B91C1C' }]}>
                  Securely end your current session
                </Text>
              </View>
              <AppIcon name="chevron-right" size={16} color="#DC2626" />
            </TouchableOpacity>
          </>
        )}

        {/* --- 2. Targets & Salary Slips --- */}
        {activeSection === 'performance' && (
          <>
            {/* Section A: Sales Targets */}
            <AppCard>
              <View style={styles.headerBetween}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    Sales Targets
                  </Text>
                  <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                    Target vs actual sales performance
                  </Text>
                </View>
                <StatusBadge
                  label={salarySlip?.month || selectedMonthKey}
                  variant="primary"
                  size="small"
                />
              </View>

              {salesTarget ? (
                <View style={styles.targetMetricsBox}>
                  <View style={[styles.targetProgressContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }]}>
                    <View
                      style={[
                        styles.targetProgressBar,
                        {
                          backgroundColor:
                            (salesTarget.targetAmount > 0 && (salesTarget.achievedAmount / salesTarget.targetAmount) >= 1)
                              ? colors.success
                              : colors.primary,
                          width: `${Math.min(
                            100,
                            salesTarget.targetAmount > 0
                              ? Math.round((salesTarget.achievedAmount / salesTarget.targetAmount) * 100)
                              : 0
                          )}%`,
                        },
                      ]}
                    />
                  </View>

                  <View style={styles.targetGrid}>
                    <View style={styles.targetCol}>
                      <Text style={[styles.targetLabel, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                        TARGET
                      </Text>
                      <Text
                        style={[styles.targetVal, { color: colors.text }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {formatCurrency(salesTarget.targetAmount)}
                      </Text>
                    </View>

                    <View style={styles.targetCol}>
                      <Text style={[styles.targetLabel, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                        ACHIEVED
                      </Text>
                      <Text
                        style={[styles.targetVal, { color: colors.primary }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {formatCurrency(salesTarget.achievedAmount)}
                      </Text>
                    </View>

                    <View style={styles.targetCol}>
                      <Text style={[styles.targetLabel, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                        STATUS
                      </Text>
                      <Text
                        style={[
                          styles.targetVal,
                          {
                            color:
                              salesTarget.targetAmount > 0 && (salesTarget.achievedAmount / salesTarget.targetAmount) >= 1
                                ? colors.success
                                : colors.warning,
                          },
                        ]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {salesTarget.targetAmount > 0
                          ? `${Math.round((salesTarget.achievedAmount / salesTarget.targetAmount) * 100)}%`
                          : '0%'}
                      </Text>
                    </View>

                    <View style={styles.targetCol}>
                      <Text style={[styles.targetLabel, { color: colors.textMuted }]} numberOfLines={1} adjustsFontSizeToFit>
                        REMAINING
                      </Text>
                      <Text
                        style={[styles.targetVal, { color: colors.danger }]}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.7}
                      >
                        {formatCurrency(Math.max(0, salesTarget.targetAmount - salesTarget.achievedAmount))}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </AppCard>

            {/* Section B: Salary & Payslips */}
            <AppCard>
              <View style={styles.headerBetween}>
                <View>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    Salary & Payslips
                  </Text>
                  <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                    Choose month to review and download official slip
                  </Text>
                </View>
              </View>

              {/* Month & Year Horizontal Selector */}
              <View style={styles.monthSelectorContainer}>
                <Text style={[styles.selectorLabel, { color: colors.textSecondary }]}>
                  Select Salary Month:
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.monthChipsScroll}
                >
                  {availableMonths.map((m) => (
                    <FilterChip
                      key={m.key}
                      label={m.label}
                      active={selectedMonthKey === m.key}
                      onPress={() => setSelectedMonthKey(m.key)}
                    />
                  ))}
                </ScrollView>
              </View>

              {salarySlip ? (
                <>
                  <View
                    style={[
                      styles.salaryBox,
                      {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View style={styles.salaryItemRow}>
                      <Text style={{ color: colors.textSecondary }}>Basic Pay:</Text>
                      <Text style={{ fontWeight: '700', color: colors.text }}>
                        {formatCurrency(salarySlip.basicSalary)}
                      </Text>
                    </View>
                    <View style={styles.salaryItemRow}>
                      <Text style={{ color: colors.textSecondary }}>Sales Incentive:</Text>
                      <Text style={{ fontWeight: '700', color: colors.accent }}>
                        +{formatCurrency(salarySlip.salesIncentive)}
                      </Text>
                    </View>
                    <View style={styles.salaryItemRow}>
                      <Text style={{ color: colors.textSecondary }}>Attendance Bonus:</Text>
                      <Text style={{ fontWeight: '700', color: colors.accent }}>
                        +{formatCurrency(salarySlip.attendanceBonus)}
                      </Text>
                    </View>
                    <View style={styles.salaryItemRow}>
                      <Text style={{ color: colors.textSecondary }}>Deductions:</Text>
                      <Text style={{ fontWeight: '700', color: colors.danger }}>
                        -{formatCurrency(salarySlip.deductions)}
                      </Text>
                    </View>

                    <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />

                    <View style={styles.salaryItemRow}>
                      <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>
                        Net Take Home:
                      </Text>
                      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.primary }}>
                        {formatCurrency(salarySlip.netSalary)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.salaryActionsRow}>
                    <Button
                      title="View Salary Slip"
                      icon={<AppIcon name="file" size={16} color={colors.primary} />}
                      onPress={() => setSalaryModalVisible(true)}
                      variant="outline"
                      size="large"
                      style={{ flex: 1 }}
                    />
                    <PrimaryButton
                      title="Download PDF"
                      icon={<AppIcon name="file" size={16} color="#FFFFFF" />}
                      onPress={handleDownloadPdfSalarySlip}
                      size="large"
                      style={{ flex: 1 }}
                    />
                  </View>
                </>
              ) : (
                <View
                  style={[
                    styles.emptySalaryBox,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.emptyIconCircle,
                      { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#EFF6FF' },
                    ]}
                  >
                    <AppIcon name="file" size={24} color={colors.primary} />
                  </View>
                  <Text style={[styles.emptySalaryTitle, { color: colors.text }]}>
                    No Salary Statement Available
                  </Text>
                  <Text style={[styles.emptySalaryText, { color: colors.textSecondary }]}>
                    No salary record has been issued for{' '}
                    {availableMonths.find((m) => m.key === selectedMonthKey)?.label || selectedMonthKey}. Statements are generated at the end of each payroll cycle.
                  </Text>
                </View>
              )}
            </AppCard>
          </>
        )}
      </ScrollView>

      {/* Formal Salary Statement Modal */}
      <ModalCard
        visible={salaryModalVisible}
        onClose={() => setSalaryModalVisible(false)}
        title="Official Salary Statement"
        subtitle={salarySlip?.month || ''}
      >
        {salarySlip && (
          <View>
            {/* Letterhead Header */}
            <View style={[styles.slipHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.slipShopName, { color: colors.primary }]}>
                {config.shopName}
              </Text>
              <Text style={[styles.slipAddress, { color: colors.textSecondary }]}>
                {config.shopAddress}
              </Text>
              <Text style={[styles.slipGst, { color: colors.textMuted }]}>
                GSTIN: {config.gstNumber} • Phone: {config.phone}
              </Text>
            </View>

            {/* Employee Meta Box */}
            <View style={[styles.slipMetaGrid, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: colors.border }]}>
              <View style={styles.slipMetaItem}>
                <Text style={[styles.slipMetaLbl, { color: colors.textMuted }]}>EMPLOYEE NAME</Text>
                <Text style={[styles.slipMetaVal, { color: colors.text }]}>{salarySlip.staffName}</Text>
              </View>
              <View style={styles.slipMetaItem}>
                <Text style={[styles.slipMetaLbl, { color: colors.textMuted }]}>DESIGNATION</Text>
                <Text style={[styles.slipMetaVal, { color: colors.text }]}>{salarySlip.designation}</Text>
              </View>
              <View style={styles.slipMetaItem}>
                <Text style={[styles.slipMetaLbl, { color: colors.textMuted }]}>WORKING DAYS</Text>
                <Text style={[styles.slipMetaVal, { color: colors.text }]}>{salarySlip.totalWorkingDays} Days (Present: {salarySlip.presentDays})</Text>
              </View>
              <View style={styles.slipMetaItem}>
                <Text style={[styles.slipMetaLbl, { color: colors.textMuted }]}>SALES VOLUME</Text>
                <Text style={[styles.slipMetaVal, { color: colors.primary }]}>{formatCurrency(salarySlip.salesAchieved)}</Text>
              </View>
            </View>

            {/* Earnings Breakdown */}
            <SectionHeader title="Salary & Incentive Breakdown" />
            <View style={[styles.slipTable, { borderColor: colors.border }]}>
              <View style={[styles.slipTableRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.slipColText, { color: colors.textSecondary }]}>Basic Monthly Salary</Text>
                <Text style={[styles.slipColVal, { color: colors.text }]}>{formatCurrency(salarySlip.basicSalary)}</Text>
              </View>
              <View style={[styles.slipTableRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.slipColText, { color: colors.textSecondary }]}>Sales Incentive Bonus</Text>
                <Text style={[styles.slipColVal, { color: colors.accent }]}>+{formatCurrency(salarySlip.salesIncentive)}</Text>
              </View>
              <View style={[styles.slipTableRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.slipColText, { color: colors.textSecondary }]}>Punctuality & Attendance Bonus</Text>
                <Text style={[styles.slipColVal, { color: colors.accent }]}>+{formatCurrency(salarySlip.attendanceBonus)}</Text>
              </View>
              <View style={[styles.slipTableRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.slipColText, { color: colors.textSecondary }]}>Leave / Absence Deductions</Text>
                <Text style={[styles.slipColVal, { color: colors.danger }]}>-{formatCurrency(salarySlip.deductions)}</Text>
              </View>

              <View style={[styles.slipTableRow, { backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF' }]}>
                <Text style={[styles.slipTotalLbl, { color: colors.text }]}>Net Disbursed Salary</Text>
                <Text style={[styles.slipTotalVal, { color: colors.primary }]}>{formatCurrency(salarySlip.netSalary)}</Text>
              </View>
            </View>

            {/* Authorization Seal */}
            <View style={styles.sealRow}>
              <View style={styles.sealCol}>
                <Text style={[styles.sealText, { color: colors.textMuted }]}>Generated on: {salarySlip.generatedDate}</Text>
                <Text style={[styles.sealText, { color: colors.textMuted }]}>Computer Generated Statement</Text>
              </View>
              <View style={styles.sealColRight}>
                <Text style={[styles.sealSignText, { color: colors.text }]}>Parth Patel</Text>
                <Text style={[styles.sealSub, { color: colors.textMuted }]}>Authorized Store Signatory</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: SPACING.md }}>
              <PrimaryButton
                title="Download / Save PDF"
                icon={<AppIcon name="file" size={16} color="#FFFFFF" />}
                onPress={handleDownloadPdfSalarySlip}
                size="large"
                style={{ flex: 1 }}
              />
              <Button
                title="Share Text"
                icon={<AppIcon name="upload" size={16} color={colors.primary} />}
                onPress={handleShareSalarySlip}
                variant="outline"
                size="large"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}
      </ModalCard>

      {currentUser && (
        <DeviceBindingModal
          visible={deviceModalVisible}
          currentUser={currentUser}
          onClose={() => setDeviceModalVisible(false)}
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  headerThemeBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroCard: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  heroIdentityCol: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  heroNameBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  profileName: {
    fontSize: 19,
    fontWeight: '600',
    flex: 1,
    letterSpacing: -0.3,
  },
  profileDesignation: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 3,
  },
  heroContactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  heroContactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroContactText: {
    fontSize: 13,
    fontWeight: '500',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: SPACING.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 10.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  infoValue: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
  },
  actionSubtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  logoutCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.md,
  },
  logoutTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
    color: '#DC2626',
  },
  logoutSub: {
    ...TYPOGRAPHY.caption,
    fontSize: 11,
    marginTop: 1,
  },
  cardContent: {
    marginTop: SPACING.xs,
  },
  sectionPills: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  pillsScroll: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    paddingRight: SPACING.xl,
    gap: SPACING.sm,
    alignItems: 'center',
  },
  content: {
    padding: SPACING.md,
    paddingBottom: 90,
  },
  cardTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
  },
  headerBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  settingSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  targetMetricsBox: {
    marginTop: SPACING.sm,
  },
  targetProgressContainer: {
    height: 8,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  targetProgressBar: {
    height: '100%',
    borderRadius: RADIUS.full,
  },
  targetGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.xs,
  },
  targetCol: {
    flex: 1,
    alignItems: 'center',
  },
  targetLabel: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  targetVal: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 13,
  },
  monthSelectorContainer: {
    marginBottom: SPACING.md,
  },
  selectorLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  monthChipsScroll: {
    gap: SPACING.xs,
    paddingRight: SPACING.xl,
  },
  salaryBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  salaryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 5,
  },
  dividerLine: {
    height: 1,
    marginVertical: SPACING.sm,
  },
  salaryActionsRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  emptySalaryBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xl,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emptySalaryTitle: {
    ...TYPOGRAPHY.h3,
    fontSize: 15,
    marginBottom: 4,
  },
  emptySalaryText: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    lineHeight: 18,
  },
  slipHeader: {
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    marginBottom: SPACING.md,
    alignItems: 'center',
  },
  slipShopName: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
    textAlign: 'center',
  },
  slipAddress: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    marginTop: 2,
  },
  slipGst: {
    ...TYPOGRAPHY.captionSmall,
    textAlign: 'center',
    marginTop: 2,
  },
  slipMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  slipMetaItem: {
    width: '50%',
    paddingVertical: 4,
  },
  slipMetaLbl: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 9.5,
    fontWeight: '700',
  },
  slipMetaVal: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    marginTop: 1,
  },
  slipTable: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: SPACING.md,
  },
  slipTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: 8,
  },
  slipColText: {
    ...TYPOGRAPHY.caption,
  },
  slipColVal: {
    ...TYPOGRAPHY.bodySmall,
    fontWeight: '600',
  },
  slipTotalLbl: {
    ...TYPOGRAPHY.bodyBold,
  },
  slipTotalVal: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
  },
  sealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  sealCol: {
    flex: 1,
  },
  sealColRight: {
    alignItems: 'flex-end',
  },
  sealText: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 9.5,
  },
  sealSignText: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 13,
  },
  sealSub: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 10,
  },
});
