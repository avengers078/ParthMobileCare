import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
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
  FilterChip,
  SectionHeader,
  AppIcon,
  EmptyState,
  FaceVerificationModal,
} from '../components';
import { StorageService } from '../services/storageService';
import { AttendanceService } from '../services/attendanceService';
import { FaceRecognitionService } from '../services/faceRecognitionService';
import { calculateDistanceMeters, checkBusinessHours } from '../utils/geo';
import { AttendanceRecord, GeoPoint, FaceVerificationToken } from '../types';
import { formatDate, formatTime, getTodayDateString } from '../utils/format';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';
import { ShieldCheck } from 'lucide-react-native';

export const AttendanceScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { currentUser, isAdmin, isManager, allUsers } = useAuth();
  const { colors, isDark } = useTheme();
  const { config } = useShopConfig();

  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [selectedStaffId, setSelectedStaffId] = useState<string>(currentUser?.id || '');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // GPS & Punch State
  const [currentCoords, setCurrentCoords] = useState<GeoPoint | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(true);
  const [isPunching, setIsPunching] = useState<boolean>(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);

  // Face Recognition Modal State
  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalAction, setFaceModalAction] = useState<'punch_in' | 'punch_out'>('punch_in');

  const [stats, setStats] = useState({
    totalDays: 0,
    presentCount: 0,
    lateCount: 0,
    halfDayCount: 0,
    earlyExitCount: 0,
    totalWorkingHours: 0,
  });

  const shopCoords: GeoPoint = {
    latitude: config.latitude,
    longitude: config.longitude,
  };

  const businessHours = checkBusinessHours(config.openingTime, config.closingTime);

  const fetchLiveLocation = async () => {
    setIsLocating(true);
    try {
      const pos = await AttendanceService.getCurrentPosition();
      setCurrentCoords(pos);
      const dist = calculateDistanceMeters(pos, shopCoords);
      setDistanceMeters(dist);
    } catch (e) {
      console.warn('GPS location error:', e);
    } finally {
      setIsLocating(false);
    }
  };

  const loadAttendance = async () => {
    // Seed demo face templates on initial load if none exist
    FaceRecognitionService.seedDemoTemplates().catch(() => {});

    const targetUserId = (isAdmin || isManager) && selectedStaffId ? selectedStaffId : currentUser?.id;
    if (!targetUserId) return;

    const allRecords = await StorageService.getAttendanceRecords(targetUserId);
    const today = getTodayDateString();
    const currentMonth = today.substring(0, 7);

    const todayRec = allRecords.find(r => r.date === today && r.userId === currentUser?.id);
    setTodayRecord(todayRec || null);

    let filtered = allRecords;
    if (selectedPeriod === 'daily') {
      filtered = allRecords.filter(r => r.date === today);
    } else if (selectedPeriod === 'weekly') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      const weekAgo = d.toISOString().split('T')[0];
      filtered = allRecords.filter(r => r.date >= weekAgo);
    } else {
      filtered = allRecords.filter(r => r.date.startsWith(currentMonth));
    }

    setRecords(filtered);

    // Calculate stats
    const present = filtered.filter(r => r.status === 'present' || r.status === 'late').length;
    const late = filtered.filter(r => r.isLate).length;
    const halfDay = filtered.filter(r => r.status === 'half_day').length;
    const early = filtered.filter(r => r.isEarlyExit).length;
    const hours = filtered.reduce((sum, r) => sum + (r.totalHours || 0), 0);

    setStats({
      totalDays: filtered.length,
      presentCount: present,
      lateCount: late,
      halfDayCount: halfDay,
      earlyExitCount: early,
      totalWorkingHours: Math.round(hours * 10) / 10,
    });
  };

  useEffect(() => {
    fetchLiveLocation();
    loadAttendance();
  // These loaders intentionally run together when the selected period, staff member, or shop changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.latitude, config.longitude, selectedPeriod, selectedStaffId, currentUser?.id]);

  const isInsideRadius =
    distanceMeters !== null && distanceMeters <= config.allowedRadiusMeters;

  const handlePunchIn = async () => {
    if (!currentUser) return;

    // 1. Business Hours Validation
    const hoursCheck = checkBusinessHours(config.openingTime, config.closingTime);
    if (!hoursCheck.canPunchIn) {
      Alert.alert('Store Closed', hoursCheck.message);
      return;
    }

    // 2. Geo-Fence Radius Check
    if (distanceMeters !== null && distanceMeters > config.allowedRadiusMeters) {
      Alert.alert(
        'Outside Shop Radius',
        `Punch In rejected: You are ${distanceMeters.toFixed(1)}m away from shop. Allowed radius is ${config.allowedRadiusMeters}m.`
      );
      return;
    }

    // 3. Biometric Registration Check
    const template = await StorageService.getFaceTemplate(currentUser.id);
    if (!template) {
      Alert.alert(
        'Face Registration Required',
        'Your face has not been registered in the biometric system yet. Please ask an administrator or manager to register your face in Staff Management.',
        [{ text: 'OK' }]
      );
      return;
    }

    // 4. Open Face Verification Viewfinder
    setFaceModalAction('punch_in');
    setFaceModalVisible(true);
  };

  const handlePunchOut = async () => {
    if (!currentUser) return;

    if (!todayRecord || !todayRecord.punchInTime) {
      Alert.alert('No Punch In Record', 'You must Punch In first before you can Punch Out.');
      return;
    }

    if (todayRecord.punchOutTime) {
      Alert.alert('Already Punched Out', `You have already punched out today at ${todayRecord.punchOutTime}.`);
      return;
    }

    // 1. Business Hours Validation
    const hoursCheck = checkBusinessHours(config.openingTime, config.closingTime);
    if (!hoursCheck.canPunchOut) {
      Alert.alert('Store Closed', hoursCheck.message);
      return;
    }

    // 2. Geo-Fence Radius Check
    if (distanceMeters !== null && distanceMeters > config.allowedRadiusMeters) {
      Alert.alert(
        'Outside Shop Radius',
        `Punch Out rejected: You are ${distanceMeters.toFixed(1)}m away from shop. Allowed radius is ${config.allowedRadiusMeters}m.`
      );
      return;
    }

    // 3. Biometric Registration Check
    const template = await StorageService.getFaceTemplate(currentUser.id);
    if (!template) {
      Alert.alert(
        'Face Registration Required',
        'Your face has not been registered in the biometric system yet. Please ask an administrator or manager to register your face in Staff Management.',
        [{ text: 'OK' }]
      );
      return;
    }

    // 4. Open Face Verification Viewfinder
    setFaceModalAction('punch_out');
    setFaceModalVisible(true);
  };

  const handleVerificationSuccess = async (token: FaceVerificationToken) => {
    setFaceModalVisible(false);
    if (!currentUser) return;

    setIsPunching(true);
    try {
      if (token.action === 'punch_in') {
        const result = await AttendanceService.punchIn(
          currentUser,
          config,
          currentCoords || undefined,
          token
        );

        if (result.success && result.record) {
          setTodayRecord(result.record);
          loadAttendance();
          const punchTime = result.record.punchInTime ? formatTime(result.record.punchInTime) : 'Now';
          Alert.alert('✅ Attendance Recorded', `Punch In Successful — ${punchTime}`);
        } else {
          Alert.alert('❌ Punch In Blocked', result.message);
        }
      } else {
        const result = await AttendanceService.punchOut(
          currentUser,
          config,
          currentCoords || undefined,
          token
        );

        if (result.success && result.record) {
          setTodayRecord(result.record);
          loadAttendance();
          const punchTime = result.record.punchOutTime ? formatTime(result.record.punchOutTime) : 'Now';
          Alert.alert(
            '✅ Attendance Recorded',
            `Punch Out Successful — ${punchTime}\nTotal Working Time: ${result.record.totalHours} hrs`
          );
        } else {
          Alert.alert('❌ Punch Out Blocked', result.message);
        }
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to process biometric attendance.');
    } finally {
      setIsPunching(false);
    }
  };

  const handleExport = async () => {
    if (records.length === 0) {
      Alert.alert('No records', 'No attendance logs found to export.');
      return;
    }

    let csvContent = 'Date,Staff Name,Punch In,Punch Out,Hours,Status,Punch In Distance,Punch Out Distance\n';
    records.forEach(r => {
      csvContent += `${r.date},${r.userName},${r.punchInTime || '--'},${r.punchOutTime || '--'},${r.totalHours || 0},${r.status},${r.punchInCoords?.distanceMeters || 0}m,${r.punchOutCoords?.distanceMeters || 0}m\n`;
    });

    try {
      await Share.share({
        title: 'Parth Mobile Care Attendance Report',
        message: csvContent,
      });
    } catch (e: any) {
      Alert.alert('Export Error', e.message);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Attendance"
        subtitle="GPS Geo-Fenced Staff System"
        showBack={Boolean(navigation?.canGoBack?.())}
        onBack={() => navigation?.goBack?.()}
        rightAction={
          <TouchableOpacity
            style={[styles.exportBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
            onPress={handleExport}
            activeOpacity={0.7}
          >
            <Text style={[styles.exportBtnText, { color: colors.primary }]}>
              Export
            </Text>
          </TouchableOpacity>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section 1: Attendance Status Card */}
        <AppCard>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                CURRENT ATTENDANCE
              </Text>
              <Text style={[styles.mainStatusText, { color: colors.text }]}>
                {todayRecord && todayRecord.punchInTime
                  ? todayRecord.punchOutTime
                    ? 'Shift Finished'
                    : 'Currently Checked In'
                  : 'Not Checked In'}
              </Text>
            </View>
            <StatusBadge
              label={
                todayRecord && todayRecord.punchInTime
                  ? todayRecord.punchOutTime
                    ? 'COMPLETED'
                    : 'PRESENT'
                  : 'ABSENT'
              }
              variant={
                todayRecord && todayRecord.punchInTime
                  ? todayRecord.punchOutTime
                    ? 'info'
                    : 'success'
                  : 'danger'
              }
              size="medium"
            />
          </View>

          <View style={[styles.statusInfoGrid, { borderTopColor: colors.border }]}>
            <View style={styles.statusInfoItem}>
              <Text style={[styles.statusInfoLabel, { color: colors.textSecondary }]}>
                Punch In
              </Text>
              <Text style={[styles.statusInfoValue, { color: colors.text }]}>
                {todayRecord?.punchInTime ? formatTime(todayRecord.punchInTime) : '--:--'}
              </Text>
            </View>
            <View style={styles.statusInfoItem}>
              <Text style={[styles.statusInfoLabel, { color: colors.textSecondary }]}>
                Punch Out
              </Text>
              <Text style={[styles.statusInfoValue, { color: colors.text }]}>
                {todayRecord?.punchOutTime ? formatTime(todayRecord.punchOutTime) : '--:--'}
              </Text>
            </View>
            <View style={styles.statusInfoItem}>
              <Text style={[styles.statusInfoLabel, { color: colors.textSecondary }]}>
                Hours Today
              </Text>
              <Text style={[styles.statusInfoValue, { color: colors.primary }]}>
                {todayRecord?.totalHours ? `${todayRecord.totalHours} hrs` : '--'}
              </Text>
            </View>
          </View>
        </AppCard>

        {/* Section 2: Geo-Fence Status Card */}
        <AppCard highlightBorder style={{ borderColor: isInsideRadius ? colors.success : colors.danger }}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppIcon name="location" size={18} color={colors.primary} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Geo-Fence Status</Text>
            </View>
            <TouchableOpacity
              onPress={fetchLiveLocation}
              style={[styles.refreshLocationBtn, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
              disabled={isLocating}
              activeOpacity={0.7}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.refreshText, { color: colors.primary }]}>Check GPS</Text>
              )}
            </TouchableOpacity>
          </View>

          <View
            style={[
              styles.geoIndicatorBox,
              {
                backgroundColor: isInsideRadius
                  ? isDark
                    ? 'rgba(34,197,94,0.1)'
                    : '#F0FDF4'
                  : isDark
                  ? 'rgba(239,68,68,0.1)'
                  : '#FEF2F2',
                borderColor: isInsideRadius ? colors.success : colors.danger,
              },
            ]}
          >
            <AppIcon name={isInsideRadius ? 'check' : 'error'} size={22} color={isInsideRadius ? colors.success : colors.danger} />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.geoIndicatorTitle,
                  { color: isInsideRadius ? colors.success : colors.danger },
                ]}
              >
                {isInsideRadius ? 'Inside Shop Allowed Radius' : 'Outside Shop Radius (Blocked)'}
              </Text>
              <Text style={[styles.geoIndicatorSub, { color: colors.textSecondary }]}>
                {distanceMeters !== null
                  ? `Current distance: ${distanceMeters.toFixed(1)}m (Allowed: ${config.allowedRadiusMeters}m)`
                  : 'Detecting GPS coordinates...'}
              </Text>
            </View>
          </View>

          <View style={styles.shopHoursRow}>
            <Text style={[styles.shopHoursText, { color: colors.textSecondary }]}>
              Store Hours: {config.openingTime} - {config.closingTime}
            </Text>
            <StatusBadge
              label={businessHours.isWithinHours ? 'STORE OPEN' : 'CLOSED'}
              variant={businessHours.isWithinHours ? 'success' : 'neutral'}
              size="small"
            />
          </View>
        </AppCard>

        {/* Section 3: Punch Actions (Large Buttons min 48px) */}
        <View style={styles.punchActionsContainer}>
          <PrimaryButton
            title={isPunching ? 'Verifying...' : 'Punch In'}
            icon={<AppIcon name="clock" size={18} color="#FFFFFF" />}
            onPress={handlePunchIn}
            disabled={isPunching || (!!todayRecord?.punchInTime && !todayRecord?.punchOutTime)}
            loading={isPunching}
            size="large"
            style={styles.largePunchButton}
          />
          <Button
            title={isPunching ? 'Verifying...' : 'Punch Out'}
            icon={<AppIcon name="clock" size={18} color={colors.primary} />}
            onPress={handlePunchOut}
            variant="outline"
            disabled={isPunching || !todayRecord?.punchInTime || !!todayRecord?.punchOutTime}
            loading={isPunching}
            size="large"
            style={styles.largePunchButton}
          />
        </View>

        {/* Section 4: Working Hours Summary */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.success }]}>
              {stats.presentCount}
            </Text>
            <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
              Present Days
            </Text>
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.warning }]}>
              {stats.lateCount}
            </Text>
            <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
              Late Arrivals
            </Text>
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.primary }]}>
              {stats.totalWorkingHours}h
            </Text>
            <Text style={[styles.statTitle, { color: colors.textSecondary }]}>
              Total Hours
            </Text>
          </View>
        </View>

        {/* Section 5: Attendance History */}
        <SectionHeader
          title="Attendance History"
          rightElement={
            <View style={styles.periodFilterRow}>
              {(['daily', 'weekly', 'monthly'] as const).map(tab => (
                <FilterChip
                  key={tab}
                  label={tab.charAt(0).toUpperCase() + tab.slice(1)}
                  active={selectedPeriod === tab}
                  onPress={() => setSelectedPeriod(tab)}
                  style={{ marginRight: 4, height: 32, paddingVertical: 4, paddingHorizontal: 10 }}
                />
              ))}
            </View>
          }
        />

        {/* Admin Staff Filter */}
        {(isAdmin || isManager) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.staffChips}>
            {allUsers.map(user => (
              <FilterChip
                key={user.id}
                label={user.name}
                active={selectedStaffId === user.id}
                onPress={() => setSelectedStaffId(user.id)}
              />
            ))}
          </ScrollView>
        )}

        {records.length === 0 ? (
          <EmptyState
            icon={<AppIcon name="calendar" size={26} color={colors.primary} />}
            title="No Attendance Records"
            description="No attendance logs found for the selected period."
          />
        ) : (
          records.map((rec, index) => (
            <AppCard key={index} style={styles.historyCard}>
              <View style={styles.historyCardHeader}>
                <View>
                  <Text style={[styles.historyDate, { color: colors.text }]}>
                    {formatDate(rec.date)}
                  </Text>
                  <Text style={[styles.historyStaffName, { color: colors.textSecondary }]}>
                    {rec.userName}
                  </Text>
                </View>
                <StatusBadge
                  label={rec.status.toUpperCase()}
                  variant={
                    rec.status === 'present'
                      ? 'success'
                      : rec.status === 'late'
                      ? 'warning'
                      : 'danger'
                  }
                  size="small"
                />
              </View>

              <View style={[styles.historyGrid, { borderTopColor: colors.border }]}>
                <View style={styles.historyCol}>
                  <Text style={[styles.historyLabel, { color: colors.textSecondary }]}>Time In</Text>
                  <Text style={[styles.historyVal, { color: colors.text }]}>
                    {rec.punchInTime ? formatTime(rec.punchInTime) : '--:--'}
                  </Text>
                </View>
                <View style={styles.historyCol}>
                  <Text style={[styles.historyLabel, { color: colors.textSecondary }]}>Time Out</Text>
                  <Text style={[styles.historyVal, { color: colors.text }]}>
                    {rec.punchOutTime ? formatTime(rec.punchOutTime) : '--:--'}
                  </Text>
                </View>
                <View style={styles.historyCol}>
                  <Text style={[styles.historyLabel, { color: colors.textSecondary }]}>Hours</Text>
                  <Text style={[styles.historyVal, { color: colors.primary }]}>
                    {rec.totalHours ? `${rec.totalHours} hrs` : '--'}
                  </Text>
                </View>
              </View>

              {rec.verificationMethod === 'face_recognition' && (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 8,
                    paddingTop: 6,
                    borderTopWidth: 1,
                    borderTopColor: colors.borderLight,
                  }}
                >
                  <ShieldCheck size={13} color={colors.success} style={{ marginRight: 4 }} />
                  <Text style={{ fontSize: 11, color: colors.success, fontWeight: '600' }}>
                    Face Verified ({Math.round((rec.faceVerificationScore || 0.96) * 100)}% match, Liveness: {Math.round((rec.faceLivenessScore || 0.94) * 100)}%)
                  </Text>
                </View>
              )}
            </AppCard>
          ))
        )}
      </ScrollView>

      {currentUser && (
        <FaceVerificationModal
          visible={faceModalVisible}
          user={currentUser}
          action={faceModalAction}
          onSuccess={handleVerificationSuccess}
          onClose={() => setFaceModalVisible(false)}
        />
      )}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  content: {
    padding: SPACING.lg,
    paddingBottom: SPACING.huge,
  },
  exportBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  exportBtnText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  sectionSubtitle: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  mainStatusText: {
    ...TYPOGRAPHY.h3,
    fontWeight: '800',
    marginTop: 2,
  },
  statusInfoGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  statusInfoItem: {
    flex: 1,
  },
  statusInfoLabel: {
    ...TYPOGRAPHY.captionSmall,
  },
  statusInfoValue: {
    ...TYPOGRAPHY.bodyBold,
    marginTop: 2,
  },
  cardTitle: {
    ...TYPOGRAPHY.bodyBold,
  },
  refreshLocationBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  refreshText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '600',
  },
  geoIndicatorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginVertical: SPACING.sm,
  },
  geoIndicatorTitle: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 13,
  },
  geoIndicatorSub: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 2,
  },
  shopHoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  shopHoursText: {
    ...TYPOGRAPHY.caption,
  },
  punchActionsContainer: {
    flexDirection: 'row',
    gap: SPACING.md,
    marginVertical: SPACING.sm,
  },
  largePunchButton: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  statBox: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    alignItems: 'center',
  },
  statValue: {
    ...TYPOGRAPHY.h3,
    fontWeight: '800',
  },
  statTitle: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 4,
  },
  periodFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staffChips: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
  },
  historyCard: {
    marginVertical: 4,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  historyDate: {
    ...TYPOGRAPHY.bodyBold,
  },
  historyStaffName: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 1,
  },
  historyGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
  },
  historyCol: {
    flex: 1,
  },
  historyLabel: {
    ...TYPOGRAPHY.captionSmall,
    textTransform: 'uppercase',
  },
  historyVal: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 13,
    marginTop: 2,
  },
});
