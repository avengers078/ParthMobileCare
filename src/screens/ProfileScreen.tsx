import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
  Share,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useShopConfig } from '../context/ShopConfigContext';
import {
  ScreenContainer,
  AppHeader,
  AppCard,
  StatusBadge,
  Button,
  PrimaryButton,
  Input,
  FilterChip,
  SectionHeader,
  AppIcon,
  ModalCard,
} from '../components';
import { AttendanceService } from '../services/attendanceService';
import { StaffPerformanceService } from '../services/staffPerformanceService';
import { PdfService } from '../services/pdfService';
import { SalarySlip, ShopConfig, SalesTarget } from '../types';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';
import { formatCurrency, getTodayDateString } from '../utils/format';

export const ProfileScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { currentUser, role, isAdmin, logout } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();
  const { config, updateConfig } = useShopConfig();

  // Active section tab: 'account' | 'performance' | 'shop_config'
  const [activeSection, setActiveSection] = useState<'account' | 'performance' | 'shop_config'>('account');

  // Shop config state
  const [latitude, setLatitude] = useState(config.latitude.toString());
  const [longitude, setLongitude] = useState(config.longitude.toString());
  const [radius, setRadius] = useState(config.allowedRadiusMeters.toString());
  const [openingTime, setOpeningTime] = useState(config.openingTime);
  const [closingTime, setClosingTime] = useState(config.closingTime);
  const [isSaving, setIsSaving] = useState(false);
  const [isDetectingGps, setIsDetectingGps] = useState(false);

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

  useEffect(() => {
    if (currentUser) {
      StaffPerformanceService.getSalarySlip(currentUser, selectedMonthKey)
        .then(setSalarySlip)
        .catch(err => {
          console.warn('Error loading slip:', err);
          setSalarySlip(null);
        });

      StaffPerformanceService.getStaffTarget(currentUser.id, selectedMonthKey)
        .then(setSalesTarget)
        .catch(err => console.warn('Error loading target:', err));
    }
    setLatitude(config.latitude.toString());
    setLongitude(config.longitude.toString());
    setRadius(config.allowedRadiusMeters.toString());
    setOpeningTime(config.openingTime);
    setClosingTime(config.closingTime);
  }, [config, currentUser, selectedMonthKey]);

  const handleSetCurrentGpsAsShop = async () => {
    setIsDetectingGps(true);
    try {
      const pos = await AttendanceService.getCurrentPosition();
      setLatitude(pos.latitude.toFixed(6));
      setLongitude(pos.longitude.toFixed(6));
      Alert.alert(
        'GPS Captured',
        `Current coordinates (${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}) set as Shop Center!`
      );
    } catch (e: any) {
      Alert.alert('GPS Error', e.message || 'Could not fetch current coordinates.');
    } finally {
      setIsDetectingGps(false);
    }
  };

  const handleSaveShopConfig = async () => {
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    const rad = parseFloat(radius);

    if (isNaN(lat) || isNaN(lon) || isNaN(rad)) {
      Alert.alert('Validation Error', 'Please enter valid GPS coordinates and radius.');
      return;
    }

    setIsSaving(true);
    try {
      const newConfig: ShopConfig = {
        ...config,
        latitude: lat,
        longitude: lon,
        allowedRadiusMeters: rad,
        openingTime: openingTime.trim(),
        closingTime: closingTime.trim(),
      };
      await updateConfig(newConfig);
      Alert.alert('Settings Saved', 'Shop Geo-fencing & timing rules updated successfully!');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdfSalarySlip = async () => {
    if (!salarySlip) return;
    try {
      await PdfService.printOrSavePdf(salarySlip, config);
    } catch (e: any) {
      Alert.alert('PDF Error', e.message || 'Could not generate PDF.');
    }
  };

  const handleShareSalarySlip = async () => {
    if (!salarySlip) return;
    const message = `PARTH MOBILE CARE - SALARY STATEMENT\nEmployee: ${salarySlip.staffName}\nMonth: ${salarySlip.month}\nNet Pay: ${formatCurrency(salarySlip.netSalary)}\nWorking Days: ${salarySlip.totalWorkingDays} | Present: ${salarySlip.presentDays}\nBasic: ${formatCurrency(salarySlip.basicSalary)} | Incentive: +${formatCurrency(salarySlip.salesIncentive)}`;
    try {
      await Share.share({ title: `Salary Slip - ${salarySlip.staffName}`, message });
    } catch (e: any) {
      Alert.alert('Error', e.message);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader title="My Profile" subtitle="Account & Store Settings" />

      {/* Hero Profile Banner */}
      <View style={[styles.heroCard, { backgroundColor: colors.card, borderColor: colors.border }, SHADOWS.card]}>
        <View style={[styles.avatarBig, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarBigText}>
            {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : 'U'}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: SPACING.md }}>
          <Text style={[styles.profileName, { color: colors.text }]}>
            {currentUser?.name}
          </Text>
          <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
            {currentUser?.designation} • {currentUser?.email}
          </Text>
          <View style={styles.roleRow}>
            <StatusBadge label={role.toUpperCase()} variant={role === 'admin' ? 'danger' : 'primary'} size="small" />
            <Text style={[styles.phoneText, { color: colors.textMuted }]}>
              +91 {currentUser?.phone}
            </Text>
          </View>
        </View>
      </View>

      {/* Pill Section Switcher */}
      <View style={styles.sectionPills}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillsScroll}>
          {[
            { key: 'account', label: 'Account', icon: 'user', iconColor: colors.primary },
            { key: 'performance', label: 'Targets & Salary', icon: 'analytics', iconColor: colors.warning },
            { key: 'shop_config', label: 'Shop Geo-Fence', icon: 'location', iconColor: colors.success },
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* --- 1. Account Settings --- */}
        {activeSection === 'account' && (
          <>
            <AppCard>
              <View style={styles.settingRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    Dark Theme
                  </Text>
                  <Text style={[styles.settingSub, { color: colors.textSecondary }]}>
                    {isDark ? 'Dark SaaS mode active' : 'Clean light mode active'}
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggleTheme}
                  trackColor={{ false: '#CBD5E1', true: colors.primary }}
                />
              </View>
            </AppCard>

            <AppCard>
              <SectionHeader title="Store Information" style={{ marginTop: 0 }} />
              <View style={styles.infoRowContainer}>
                <Text style={[styles.infoRowText, { color: colors.textSecondary }]}>
                  Store Name: <Text style={{ color: colors.text, fontWeight: '700' }}>{config.shopName}</Text>
                </Text>
                <Text style={[styles.infoRowText, { color: colors.textSecondary }]}>
                  Address: <Text style={{ color: colors.text, fontWeight: '600' }}>{config.shopAddress}</Text>
                </Text>
                <Text style={[styles.infoRowText, { color: colors.textSecondary }]}>
                  GST Number: <Text style={{ color: colors.text, fontWeight: '600' }}>{config.gstNumber}</Text>
                </Text>
              </View>
            </AppCard>

            {(isAdmin || role === 'manager') && (
              <AppCard>
                <SectionHeader title="Team Administration" style={{ marginTop: 0 }} />
                <Text style={[styles.settingSub, { color: colors.textSecondary, marginBottom: SPACING.md }]}>
                  Manage staff members, roles, basic salaries, and monthly sales targets.
                </Text>
                <Button
                  title="Manage Staff & Sales Targets"
                  onPress={() => navigation?.navigate('StaffManagement')}
                  variant="secondary"
                  size="large"
                />
              </AppCard>
            )}

            <Button
              title="Sign Out of Account"
              icon={<AppIcon name="upload" size={16} color="#FFFFFF" />}
              onPress={() => {
                Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: logout },
                ]);
              }}
              variant="danger"
              size="large"
              style={{ marginTop: SPACING.md }}
            />
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
                      <Text style={[styles.targetLabel, { color: colors.textMuted }]}>TARGET</Text>
                      <Text style={[styles.targetVal, { color: colors.text }]}>
                        {formatCurrency(salesTarget.targetAmount)}
                      </Text>
                    </View>

                    <View style={styles.targetCol}>
                      <Text style={[styles.targetLabel, { color: colors.textMuted }]}>ACHIEVED</Text>
                      <Text style={[styles.targetVal, { color: colors.primary }]}>
                        {formatCurrency(salesTarget.achievedAmount)}
                      </Text>
                    </View>

                    <View style={styles.targetCol}>
                      <Text style={[styles.targetLabel, { color: colors.textMuted }]}>STATUS</Text>
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
                      >
                        {salesTarget.targetAmount > 0
                          ? `${Math.round((salesTarget.achievedAmount / salesTarget.targetAmount) * 100)}%`
                          : '0%'}
                      </Text>
                    </View>

                    <View style={styles.targetCol}>
                      <Text style={[styles.targetLabel, { color: colors.textMuted }]}>REMAINING</Text>
                      <Text style={[styles.targetVal, { color: colors.danger }]}>
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

        {/* --- 3. Shop Geo-Fence Configuration (Admin Controlled) --- */}
        {activeSection === 'shop_config' && (
          <AppCard highlightBorder={isAdmin}>
            <View style={styles.headerBetween}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>
                Shop Geo-Fence & Timings
              </Text>
              <StatusBadge label={isAdmin ? 'ADMIN ACCESS' : 'READ ONLY'} variant={isAdmin ? 'primary' : 'neutral'} size="small" />
            </View>

            <Text style={[styles.settingSub, { color: colors.textSecondary, marginBottom: SPACING.md }]}>
              Staff punch in/out is permitted only within this GPS radius and store operating hours.
            </Text>

            <Input
              label="Shop Center Latitude"
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numeric"
              editable={isAdmin}
            />

            <Input
              label="Shop Center Longitude"
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numeric"
              editable={isAdmin}
            />

            {isAdmin && (
              <Button
                title={isDetectingGps ? 'Locating...' : 'Use My Current Location as Shop Center'}
                icon={<AppIcon name="location" size={16} color={colors.primary} />}
                onPress={handleSetCurrentGpsAsShop}
                variant="outline"
                loading={isDetectingGps}
                style={{ marginVertical: SPACING.xs }}
              />
            )}

            <Input
              label="Allowed Attendance Radius (Meters) *"
              placeholder="30"
              value={radius}
              onChangeText={setRadius}
              keyboardType="numeric"
              helperText="Staff outside 30m will be rejected."
              editable={isAdmin}
            />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.md }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Opening Time"
                  value={openingTime}
                  onChangeText={setOpeningTime}
                  editable={isAdmin}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Closing Time"
                  value={closingTime}
                  onChangeText={setClosingTime}
                  editable={isAdmin}
                />
              </View>
            </View>

            {isAdmin && (
              <PrimaryButton
                title={isSaving ? 'Saving...' : 'Save Geo-Fence Rules'}
                icon={<AppIcon name="check" size={16} color="#FFFFFF" />}
                onPress={handleSaveShopConfig}
                loading={isSaving}
                size="large"
                style={{ marginTop: SPACING.md }}
              />
            )}
          </AppCard>
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
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    padding: SPACING.lg,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
  },
  avatarBig: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBigText: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: '800',
  },
  profileName: {
    ...TYPOGRAPHY.h2,
    fontSize: 18,
  },
  profileEmail: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  roleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: SPACING.xs,
    gap: SPACING.sm,
  },
  phoneText: {
    ...TYPOGRAPHY.captionSmall,
  },
  sectionPills: {
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  pillsScroll: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xs,
    gap: SPACING.xs,
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
    paddingVertical: SPACING.xs,
  },
  targetCol: {
    alignItems: 'center',
    flex: 1,
  },
  targetLabel: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 9.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  targetVal: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 13,
  },
  monthSelectorContainer: {
    marginVertical: SPACING.sm,
  },
  selectorLabel: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  monthChipsScroll: {
    paddingVertical: 2,
    gap: SPACING.sm,
  },
  salaryActionsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  emptySalaryBox: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.sm,
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
    ...TYPOGRAPHY.bodyBold,
    marginBottom: SPACING.xs,
    textAlign: 'center',
  },
  emptySalaryText: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingTitle: {
    ...TYPOGRAPHY.bodyBold,
  },
  settingSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  cardTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 16,
  },
  headerBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  infoRowContainer: {
    gap: 6,
  },
  infoRowText: {
    ...TYPOGRAPHY.body,
    fontSize: 14,
  },
  salaryBox: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginVertical: SPACING.sm,
  },
  salaryItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  dividerLine: {
    height: 1,
    marginVertical: SPACING.sm,
  },
  slipHeader: {
    alignItems: 'center',
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    marginBottom: SPACING.md,
  },
  slipShopName: {
    ...TYPOGRAPHY.h2,
    fontWeight: '800',
  },
  slipAddress: {
    ...TYPOGRAPHY.caption,
    textAlign: 'center',
    marginTop: 2,
  },
  slipGst: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 2,
  },
  slipMetaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  slipMetaItem: {
    width: '50%',
    padding: 6,
  },
  slipMetaLbl: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 9.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  slipMetaVal: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 13,
  },
  slipTable: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginVertical: SPACING.xs,
  },
  slipTableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  slipColText: {
    ...TYPOGRAPHY.body,
    fontSize: 13.5,
  },
  slipColVal: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
  },
  slipTotalLbl: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 15,
  },
  slipTotalVal: {
    ...TYPOGRAPHY.h3,
    fontWeight: '800',
  },
  sealRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  sealCol: {
    flex: 1,
  },
  sealText: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 10,
  },
  sealColRight: {
    alignItems: 'flex-end',
  },
  sealSignText: {
    ...TYPOGRAPHY.bodyBold,
    fontStyle: 'italic',
    textDecorationLine: 'underline',
  },
  sealSub: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 10,
    marginTop: 2,
  },
});
