import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
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
  FaceRegistrationModal,
} from '../components';
import { DeviceBindingModal } from '../components/DeviceBindingModal';
import { StorageService } from '../services/storageService';
import { AttendanceService } from '../services/attendanceService';
import { FaceRecognitionService } from '../services/faceRecognitionService';
import { DeviceBindingService, DeviceBindingCheckResult } from '../services/deviceBindingService';
import { LocationService, LocationStatus } from '../services/locationService';
import { calculateDistanceMeters, checkBusinessHours } from '../utils/geo';
import { AttendanceRecord, GeoPoint, FaceVerificationToken } from '../types';
import { formatDate, formatTime, getTodayDateString } from '../utils/format';
import { RADIUS, SPACING, TYPOGRAPHY, SHADOWS } from '../theme';
import {
  ShieldCheck,
  Clock,
  AlertTriangle,
  Download,
  MapPin,
  CheckCircle2,
  RotateCw,
  Smartphone,
  Navigation,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
} from 'lucide-react-native';

export const AttendanceScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { currentUser } = useAuth();
  const { colors, isDark } = useTheme();
  const { showSuccess, showError, showWarning, showInfo } = useAlert();
  const { config } = useShopConfig();

  const [selectedPeriod, setSelectedPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  // GPS & Punch State
  const [currentCoords, setCurrentCoords] = useState<GeoPoint | null>(null);
  const [distanceMeters, setDistanceMeters] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(true);
  const [lastLocationUpdateTime, setLastLocationUpdateTime] = useState<number | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const gpsRequestIdRef = useRef<number>(0);
  const [isPunching, setIsPunching] = useState<boolean>(false);
  const isPunchingRef = useRef(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);

  // Face Recognition Modal State
  const [faceModalVisible, setFaceModalVisible] = useState(false);
  const [faceModalAction, setFaceModalAction] = useState<'punch_in' | 'punch_out'>('punch_in');
  const [faceRecoveryModalVisible, setFaceRecoveryModalVisible] = useState(false);
  const [bioEnrollmentStatus, setBioEnrollmentStatus] = useState<any>(null);

  // Device Binding State
  const [deviceModalVisible, setDeviceModalVisible] = useState(false);
  const [deviceStatus, setDeviceStatus] = useState<DeviceBindingCheckResult | null>(null);

  const [stats, setStats] = useState({
    totalDays: 0,
    presentCount: 0,
    lateCount: 0,
    halfDayCount: 0,
    earlyExitCount: 0,
    totalWorkingHours: 0,
  });

  const shopCoords: GeoPoint = useMemo(() => ({
    latitude: config.latitude,
    longitude: config.longitude,
  }), [config.latitude, config.longitude]);

  const locationState = useMemo(() => LocationService.evaluateLocationState(
    currentCoords,
    shopCoords,
    config.allowedRadiusMeters,
    isLocating,
    gpsError,
    60
  ), [currentCoords, shopCoords, config.allowedRadiusMeters, isLocating, gpsError]);

  const businessHours = useMemo(
    () => checkBusinessHours(config.openingTime, config.closingTime),
    [config.openingTime, config.closingTime]
  );

  const fetchLiveLocation = async (isManualRefresh: boolean = false): Promise<GeoPoint | null> => {
    const reqId = ++gpsRequestIdRef.current;
    setIsLocating(true);
    setGpsError(null);

    try {
      const pos = await AttendanceService.getCurrentPosition({
        freshOnly: isManualRefresh,
        timeoutMs: 15000,
      });

      if (reqId !== gpsRequestIdRef.current) return null;

      setCurrentCoords(pos);
      setLastLocationUpdateTime(pos.timestamp || Date.now());

      const dist = calculateDistanceMeters(pos, shopCoords);
      setDistanceMeters(dist);
      return pos;
    } catch (e: any) {
      if (reqId !== gpsRequestIdRef.current) return null;
      console.warn('GPS location error:', e);
      setGpsError(e.message || 'Could not acquire GPS position.');
      setCurrentCoords(null);
      setDistanceMeters(null);
      return null;
    } finally {
      if (reqId === gpsRequestIdRef.current) {
        setIsLocating(false);
      }
    }
  };

  const loadAttendance = async () => {
    if (!currentUser?.id) return;

    const allRecords = await StorageService.getAttendanceRecords(currentUser.id);
    const today = getTodayDateString();
    const currentMonth = today.substring(0, 7);

    const todayRec = allRecords.find(r => r.date === today && r.userId === currentUser.id);
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

    if (currentUser) {
      try {
        const dCheck = await DeviceBindingService.checkDeviceStatus(currentUser);
        setDeviceStatus(dCheck);
      } catch (dErr) {
        // ignore
      }
      try {
        const bCheck = await FaceRecognitionService.getBiometricEnrollmentStatus(currentUser);
        setBioEnrollmentStatus(bCheck);
      } catch (bErr) {
        // ignore
      }
    }
  };

  useEffect(() => {
    fetchLiveLocation(false);
    loadAttendance();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.latitude, config.longitude, config.allowedRadiusMeters, selectedPeriod, currentUser?.id]);

  const isInsideRadius = locationState.isInside;

  const handlePunchIn = async () => {
    if (!currentUser || isPunching || isPunchingRef.current) return;
    isPunchingRef.current = true;

    try {
      // 0. Hardware Device Binding Validation
      const dCheck = await DeviceBindingService.checkDeviceStatus(currentUser);
      setDeviceStatus(dCheck);
      if (!dCheck.canPunch) {
        if (
          dCheck.status === 'DEVICE_MISMATCH' ||
          dCheck.status === 'UNREGISTERED' ||
          dCheck.status === 'PENDING_APPROVAL' ||
          dCheck.status === 'REJECTED'
        ) {
          setDeviceModalVisible(true);
        } else {
          showError('Device Verification Failed', dCheck.message);
        }
        return;
      }

      // 1. Business Hours Validation
      const hoursCheck = checkBusinessHours(config.openingTime, config.closingTime);
      if (!hoursCheck.canPunchIn) {
        showWarning('Store Closed', hoursCheck.message);
        return;
      }

      // 2. GPS Location & Geofence Verification
      if (isLocating) {
        showInfo('Acquiring Location', 'Please wait a moment while your GPS position is being acquired.');
        return;
      }

      let coordsToUse = currentCoords;
      if (!coordsToUse || !locationState.canPunch) {
        coordsToUse = await fetchLiveLocation(true);
      }

      const activeLocState = coordsToUse
        ? LocationService.evaluateLocationState(
            coordsToUse,
            shopCoords,
            config.allowedRadiusMeters,
            false,
            null,
            60
          )
        : locationState;

      if (!activeLocState.canPunch) {
        if (activeLocState.status === 'LOW_ACCURACY') {
          showWarning('Weak GPS Signal', activeLocState.message);
        } else if (activeLocState.status === 'OUTSIDE_GEOFENCE') {
          showWarning('Outside Shop Area', activeLocState.message);
        } else if (activeLocState.status === 'LOCATION_DISABLED') {
          showWarning('Location Turned Off', activeLocState.message);
        } else if (activeLocState.status === 'PERMISSION_DENIED') {
          showWarning('Permission Required', activeLocState.message);
        } else {
          showWarning('GPS Signal Notice', activeLocState.message);
        }
        return;
      }

      // 3. Biometric Registration & Approval Check
      const bioStatus = await FaceRecognitionService.getBiometricEnrollmentStatus(currentUser);
      setBioEnrollmentStatus(bioStatus);
      if (!bioStatus.canVerify) {
        if (bioStatus.state === 'REJECTED' || bioStatus.state === 'ENROLLMENT_REJECTED') {
          showError('Enrollment Rejected', bioStatus.message);
        } else if (bioStatus.state === 'ENROLLMENT_PENDING' || bioStatus.state === 'ENROLLMENT_PENDING_REVIEW') {
          showWarning('Enrollment Pending Approval', bioStatus.message);
        } else if (
          bioStatus.state === 'APPROVED_TEMPLATE_MISSING' ||
          bioStatus.state === 'APPROVED_BUT_TEMPLATE_MISSING' ||
          bioStatus.state === 'ENROLLMENT_DATA_MISSING' ||
          bioStatus.state === 'VERSION_MISMATCH' ||
          bioStatus.state === 'RE_ENROLLMENT_REQUIRED'
        ) {
          setFaceRecoveryModalVisible(true);
        } else {
          setFaceRecoveryModalVisible(true);
        }
        return;
      }

      // 4. Open Face Verification Viewfinder
      setFaceModalAction('punch_in');
      setFaceModalVisible(true);
    } finally {
      isPunchingRef.current = false;
    }
  };

  const handlePunchOut = async () => {
    if (!currentUser || isPunching || isPunchingRef.current) return;
    isPunchingRef.current = true;

    try {
      // 0. Hardware Device Binding Validation
      const dCheck = await DeviceBindingService.checkDeviceStatus(currentUser);
      setDeviceStatus(dCheck);
      if (!dCheck.canPunch) {
        if (
          dCheck.status === 'DEVICE_MISMATCH' ||
          dCheck.status === 'UNREGISTERED' ||
          dCheck.status === 'PENDING_APPROVAL' ||
          dCheck.status === 'REJECTED'
        ) {
          setDeviceModalVisible(true);
        } else {
          showError('Device Verification Failed', dCheck.message);
        }
        return;
      }

      if (!todayRecord || !todayRecord.punchInTime) {
        showWarning('No Punch In Record', 'You must Punch In first before you can Punch Out.');
        return;
      }

      if (todayRecord.punchOutTime) {
        showInfo('Already Punched Out', `You have already punched out today at ${todayRecord.punchOutTime}.`);
        return;
      }

      // 1. Business Hours Validation
      const hoursCheck = checkBusinessHours(config.openingTime, config.closingTime);
      if (!hoursCheck.canPunchOut) {
        showWarning('Store Closed', hoursCheck.message);
        return;
      }

      // 2. GPS Location & Geofence Verification
      if (isLocating) {
        showInfo('Acquiring Location', 'Please wait a moment while your GPS position is being acquired.');
        return;
      }

      let coordsToUse = currentCoords;
      if (!coordsToUse || !locationState.canPunch) {
        coordsToUse = await fetchLiveLocation(true);
      }

      const activeLocState = coordsToUse
        ? LocationService.evaluateLocationState(
            coordsToUse,
            shopCoords,
            config.allowedRadiusMeters,
            false,
            null,
            60
          )
        : locationState;

      if (!activeLocState.canPunch) {
        if (activeLocState.status === 'LOW_ACCURACY') {
          showWarning('Weak GPS Signal', activeLocState.message);
        } else if (activeLocState.status === 'OUTSIDE_GEOFENCE') {
          showWarning('Outside Shop Area', activeLocState.message);
        } else if (activeLocState.status === 'LOCATION_DISABLED') {
          showWarning('Location Turned Off', activeLocState.message);
        } else if (activeLocState.status === 'PERMISSION_DENIED') {
          showWarning('Permission Required', activeLocState.message);
        } else {
          showWarning('GPS Signal Notice', activeLocState.message);
        }
        return;
      }

      // 3. Biometric Registration & Approval Check
      const bioStatus = await FaceRecognitionService.getBiometricEnrollmentStatus(currentUser);
      setBioEnrollmentStatus(bioStatus);
      if (!bioStatus.canVerify) {
        if (bioStatus.state === 'REJECTED' || bioStatus.state === 'ENROLLMENT_REJECTED') {
          showError('Enrollment Rejected', bioStatus.message);
        } else if (bioStatus.state === 'ENROLLMENT_PENDING' || bioStatus.state === 'ENROLLMENT_PENDING_REVIEW') {
          showWarning('Enrollment Pending Approval', bioStatus.message);
        } else if (
          bioStatus.state === 'APPROVED_TEMPLATE_MISSING' ||
          bioStatus.state === 'APPROVED_BUT_TEMPLATE_MISSING' ||
          bioStatus.state === 'ENROLLMENT_DATA_MISSING' ||
          bioStatus.state === 'VERSION_MISMATCH' ||
          bioStatus.state === 'RE_ENROLLMENT_REQUIRED'
        ) {
          setFaceRecoveryModalVisible(true);
        } else {
          setFaceRecoveryModalVisible(true);
        }
        return;
      }

      // 4. Open Face Verification Viewfinder
      setFaceModalAction('punch_out');
      setFaceModalVisible(true);
    } finally {
      isPunchingRef.current = false;
    }
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
          showSuccess('Attendance Recorded', `Punch In Successful — ${punchTime}`);
        } else {
          showError('Punch In Blocked', result.message);
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
          showSuccess(
            'Attendance Recorded',
            `Punch Out Successful — ${punchTime}\nTotal Working Time: ${result.record.totalHours} hrs`
          );
        } else {
          showError('Punch Out Blocked', result.message);
        }
      }
    } catch (e: any) {
      showError('Error', e.message || 'Failed to process biometric attendance.');
    } finally {
      setIsPunching(false);
    }
  };

  const handleExport = async () => {
    if (records.length === 0) {
      showInfo('No Records', 'No attendance logs found to export.');
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
      showError('Export Error', e);
    }
  };

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <AppHeader
        title="Attendance"
        subtitle="Daily shop check-in & hours"
        showBack={Boolean(navigation?.canGoBack?.())}
        onBack={() => navigation?.goBack?.()}
        actionRow={
          <View style={styles.headerActionRow}>
            <TouchableOpacity
              style={[
                styles.headerActionBtn,
                { borderColor: colors.border, backgroundColor: isDark ? colors.surface : colors.borderLight },
              ]}
              onPress={handleExport}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Export attendance logs"
            >
              <Download size={18} color={colors.primary} strokeWidth={2.2} />
              <Text style={[styles.headerActionBtnText, { color: colors.primary }]}>
                Export
              </Text>
            </TouchableOpacity>
          </View>
        }
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Staff Device Binding Alert Banner */}
        {deviceStatus && deviceStatus.status !== 'APPROVED' && (
          <TouchableOpacity
            style={[
              styles.pendingBanner,
              {
                backgroundColor: deviceStatus.status === 'PENDING_APPROVAL' ? '#FFF8E1' : '#FFEBEE',
                borderColor: deviceStatus.status === 'PENDING_APPROVAL' ? '#FFB300' : '#EF5350',
              },
            ]}
            onPress={() => setDeviceModalVisible(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Device authorization status banner"
          >
            <View
              style={[
                styles.pendingBannerIconWrap,
                {
                  backgroundColor:
                    deviceStatus.status === 'PENDING_APPROVAL' ? '#FFE082' : '#FFCDD2',
                },
              ]}
            >
              <Smartphone
                size={16}
                color={deviceStatus.status === 'PENDING_APPROVAL' ? '#E65100' : '#C62828'}
              />
            </View>
            <View style={styles.pendingBannerTextCol}>
              <Text
                style={[
                  styles.pendingBannerTitle,
                  { color: deviceStatus.status === 'PENDING_APPROVAL' ? '#E65100' : '#C62828' },
                ]}
              >
                {deviceStatus.status === 'DEVICE_MISMATCH'
                  ? 'Unrecognized Phone'
                  : deviceStatus.status === 'PENDING_APPROVAL'
                  ? 'Approval Pending'
                  : deviceStatus.status === 'REJECTED'
                  ? 'Device Rejected'
                  : 'Phone Not Registered'}
              </Text>
              <Text
                style={[
                  styles.pendingBannerSubtitle,
                  { color: deviceStatus.status === 'PENDING_APPROVAL' ? '#795548' : '#B71C1C' },
                ]}
              >
                {deviceStatus.status === 'DEVICE_MISMATCH'
                  ? 'Tap to request authorization for attendance'
                  : deviceStatus.status === 'PENDING_APPROVAL'
                  ? 'Waiting for admin approval'
                  : deviceStatus.status === 'REJECTED'
                  ? 'Tap to submit a new request'
                  : 'Tap to register this phone'}
              </Text>
            </View>
            <View
              style={[
                styles.pendingBannerPill,
                {
                  backgroundColor:
                    deviceStatus.status === 'PENDING_APPROVAL' ? '#FFE0B2' : '#FFCDD2',
                },
              ]}
            >
              <Text
                style={[
                  styles.pendingBannerAction,
                  {
                    color:
                      deviceStatus.status === 'PENDING_APPROVAL' ? '#E65100' : '#C62828',
                  },
                ]}
              >
                Manage
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Face Pending Approval Banner */}
        {(bioEnrollmentStatus?.state === 'ENROLLMENT_PENDING' ||
          bioEnrollmentStatus?.state === 'ENROLLMENT_PENDING_REVIEW' ||
          bioEnrollmentStatus?.detailedState === 'ENROLLMENT_PENDING' ||
          bioEnrollmentStatus?.detailedState === 'RECOVERY_PENDING') && (
          <View
            style={[
              styles.pendingBanner,
              {
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB',
                borderColor: isDark ? 'rgba(245, 158, 11, 0.35)' : '#FDE68A',
              },
            ]}
          >
            <View
              style={[
                styles.pendingBannerIconWrap,
                { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7' },
              ]}
            >
              <Clock size={18} color="#D97706" />
            </View>
            <View style={styles.pendingBannerTextCol}>
              <Text style={[styles.pendingBannerTitle, { color: '#D97706' }]}>
                {bioEnrollmentStatus?.detailedState === 'RECOVERY_PENDING'
                  ? 'Face Recovery Pending Approval'
                  : 'Face Approval Pending'}
              </Text>
              <Text style={[styles.pendingBannerSubtitle, { color: colors.textSecondary }]}>
                {bioEnrollmentStatus?.detailedState === 'RECOVERY_PENDING'
                  ? 'Your face recovery has been submitted for Admin verification. Punch In/Out is paused until approved.'
                  : 'Your face template has been submitted for Admin approval. Punch In is locked until approved.'}
              </Text>
            </View>
            <View style={[styles.pendingBannerPill, { backgroundColor: '#F59E0B' }]}>
              <Text style={[styles.pendingBannerAction, { color: '#FFFFFF' }]}>Pending</Text>
            </View>
          </View>
        )}

        {/* Biometric Missing Banner for Approved Accounts */}
        {(bioEnrollmentStatus?.state === 'APPROVED_TEMPLATE_MISSING' ||
          bioEnrollmentStatus?.state === 'APPROVED_BUT_TEMPLATE_MISSING' ||
          bioEnrollmentStatus?.state === 'ENROLLMENT_DATA_MISSING' ||
          bioEnrollmentStatus?.state === 'RE_ENROLLMENT_REQUIRED' ||
          bioEnrollmentStatus?.state === 'VERSION_MISMATCH') && (
          <TouchableOpacity
            style={[
              styles.pendingBanner,
              {
                backgroundColor: isDark ? 'rgba(239, 68, 68, 0.12)' : '#FEF2F2',
                borderColor: isDark ? 'rgba(239, 68, 68, 0.35)' : '#FECACA',
              },
            ]}
            onPress={() => setFaceRecoveryModalVisible(true)}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.pendingBannerIconWrap,
                { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' },
              ]}
            >
              <ShieldAlert size={18} color={colors.danger} />
            </View>
            <View style={styles.pendingBannerTextCol}>
              <Text style={[styles.pendingBannerTitle, { color: colors.danger }]}>
                Face Setup Required on This Phone
              </Text>
              <Text style={[styles.pendingBannerSubtitle, { color: colors.textSecondary }]}>
                {bioEnrollmentStatus?.state === 'VERSION_MISMATCH'
                  ? 'Biometric model updated. Tap to update your face template.'
                  : 'Your account is approved, but face data is missing on this phone. Tap to set up face verification.'}
              </Text>
            </View>
            <View style={[styles.pendingBannerPill, { backgroundColor: colors.danger }]}>
              <Text style={[styles.pendingBannerAction, { color: '#FFFFFF' }]}>Enroll</Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Section 1: Attendance Status Card */}
        <AppCard>
          <View style={styles.cardHeaderRow}>
            <View>
              <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                TODAY'S STATUS
              </Text>
              <Text style={[styles.mainStatusText, { color: colors.text }]}>
                {todayRecord && todayRecord.punchInTime
                  ? todayRecord.punchOutTime
                    ? 'Shift Finished'
                    : 'Checked In'
                  : 'Not Checked In Yet'}
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
        <AppCard>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MapPin size={18} color={colors.primary} style={{ marginRight: 6 }} />
              <Text style={[styles.cardTitle, { color: colors.text }]}>Shop Location Status</Text>
            </View>
            <TouchableOpacity
              onPress={() => fetchLiveLocation(true)}
              style={[
                styles.refreshLocationBtn,
                { borderColor: colors.border, backgroundColor: isDark ? colors.surface : colors.borderLight },
              ]}
              disabled={isLocating}
              activeOpacity={0.7}
            >
              {isLocating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <RotateCw size={12} color={colors.primary} />
                  <Text style={[styles.refreshText, { color: colors.primary }]}>Refresh GPS</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Geo Status Indicator Banner */}
          <View
            style={[
              styles.geoIndicatorBox,
              {
                backgroundColor: isLocating
                  ? isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF'
                  : locationState.status === 'INSIDE_GEOFENCE'
                  ? isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4'
                  : locationState.status === 'OUTSIDE_GEOFENCE' || locationState.status === 'LOW_ACCURACY'
                  ? isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB'
                  : isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2',
                borderColor: isLocating
                  ? colors.primary
                  : locationState.status === 'INSIDE_GEOFENCE'
                  ? isDark ? 'rgba(34,197,94,0.3)' : '#BBF7D0'
                  : locationState.status === 'OUTSIDE_GEOFENCE' || locationState.status === 'LOW_ACCURACY'
                  ? isDark ? 'rgba(245,158,11,0.3)' : '#FDE68A'
                  : isDark ? 'rgba(239,68,68,0.3)' : '#FECACA',
              },
            ]}
          >
            {isLocating ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 10 }} />
            ) : locationState.status === 'INSIDE_GEOFENCE' ? (
              <CheckCircle2 size={20} color={colors.success} style={{ marginRight: 10 }} />
            ) : locationState.status === 'OUTSIDE_GEOFENCE' || locationState.status === 'LOW_ACCURACY' ? (
              <AlertTriangle size={20} color={colors.warning} style={{ marginRight: 10 }} />
            ) : (
              <AlertTriangle size={20} color={colors.danger} style={{ marginRight: 10 }} />
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  styles.geoIndicatorTitle,
                  {
                    color: isLocating
                      ? colors.primary
                      : locationState.status === 'INSIDE_GEOFENCE'
                      ? colors.success
                      : locationState.status === 'OUTSIDE_GEOFENCE' || locationState.status === 'LOW_ACCURACY'
                      ? colors.warning
                      : colors.danger,
                  },
                ]}
              >
                {isLocating
                  ? 'Checking your location...'
                  : locationState.status === 'INSIDE_GEOFENCE'
                  ? "You're inside the shop area"
                  : locationState.status === 'OUTSIDE_GEOFENCE'
                  ? "You're outside the shop area"
                  : locationState.status === 'LOW_ACCURACY'
                  ? 'GPS signal is weak'
                  : locationState.status === 'PERMISSION_DENIED'
                  ? 'Location permission required'
                  : locationState.status === 'LOCATION_DISABLED'
                  ? 'Location service turned off'
                  : 'Location notice'}
              </Text>
              <Text style={[styles.geoIndicatorSub, { color: colors.textSecondary }]}>
                {isLocating
                  ? 'Checking your location...'
                  : locationState.status === 'INSIDE_GEOFENCE'
                  ? `Distance: ${Math.round(distanceMeters || 0)}m from shop`
                  : locationState.status === 'OUTSIDE_GEOFENCE'
                  ? `You're ${Math.max(0, Math.round((distanceMeters || 0) - config.allowedRadiusMeters))}m beyond the allowed ${config.allowedRadiusMeters}m radius`
                  : locationState.status === 'LOW_ACCURACY'
                  ? 'GPS signal is weak. Please move to an open area and refresh your location.'
                  : locationState.status === 'PERMISSION_DENIED'
                  ? 'Location permission is required for attendance. Please enable precise location.'
                  : locationState.status === 'LOCATION_DISABLED'
                  ? 'Device location service is disabled. Please turn on GPS.'
                  : locationState.message}
              </Text>
            </View>
          </View>

          {/* Collapsible Diagnostics Section (Technical Details for Admin / Debugging) */}
          <TouchableOpacity
            style={[styles.diagToggleRow, { borderTopColor: colors.border }]}
            onPress={() => setShowDiagnostics(!showDiagnostics)}
            activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Navigation size={13} color={colors.textSecondary} />
              <Text style={[styles.diagToggleText, { color: colors.textSecondary }]}>
                Technical Details
              </Text>
            </View>
            {showDiagnostics ? (
              <ChevronUp size={14} color={colors.textSecondary} />
            ) : (
              <ChevronDown size={14} color={colors.textSecondary} />
            )}
          </TouchableOpacity>

          {showDiagnostics && (
            <View style={[styles.diagCardBody, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC' }]}>
              <View style={styles.diagRow}>
                <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Current GPS</Text>
                <Text style={[styles.diagValMono, { color: colors.text }]}>
                  {currentCoords
                    ? `${currentCoords.latitude.toFixed(6)}, ${currentCoords.longitude.toFixed(6)}`
                    : isLocating
                    ? 'Detecting...'
                    : 'Unavailable'}
                </Text>
              </View>

              <View style={styles.diagRow}>
                <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Shop GPS Target</Text>
                <Text style={[styles.diagValMono, { color: colors.text }]}>
                  {`${shopCoords.latitude.toFixed(6)}, ${shopCoords.longitude.toFixed(6)}`}
                </Text>
              </View>

              <View style={styles.diagRow}>
                <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Distance to Shop</Text>
                <Text
                  style={[
                    styles.diagValMono,
                    {
                      color:
                        distanceMeters !== null && distanceMeters <= config.allowedRadiusMeters
                          ? colors.success
                          : colors.warning,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {distanceMeters !== null
                    ? `${Math.round(distanceMeters)}m (Allowed: ${config.allowedRadiusMeters}m)`
                    : '--'}
                </Text>
              </View>

              <View style={styles.diagRow}>
                <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>GPS Accuracy</Text>
                <Text style={[styles.diagValMono, { color: colors.text }]}>
                  {currentCoords?.accuracy !== undefined && currentCoords.accuracy !== null
                    ? `±${Math.round(currentCoords.accuracy)}m ${
                        currentCoords.accuracy <= 60 ? '(Good)' : '(Weak signal)'
                      }`
                    : '--'}
                </Text>
              </View>

              <View style={styles.diagRow}>
                <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Last GPS Update</Text>
                <Text style={[styles.diagValMono, { color: colors.textSecondary }]}>
                  {lastLocationUpdateTime
                    ? new Date(lastLocationUpdateTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })
                    : '--:--'}
                </Text>
              </View>

              <View style={styles.diagRow}>
                <Text style={[styles.diagLabel, { color: colors.textSecondary }]}>Geofence Status</Text>
                <Text
                  style={[
                    styles.diagValMono,
                    {
                      color: locationState.canPunch ? colors.success : colors.warning,
                      fontWeight: '700',
                    },
                  ]}
                >
                  {locationState.status}
                </Text>
              </View>
            </View>
          )}

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

        {/* Section 3: Punch Actions (Large Buttons min 48px, 50/50 flex) */}
        <View style={styles.punchActionsContainer}>
          <PrimaryButton
            title={isPunching ? 'Verifying...' : 'Punch In'}
            icon={<Clock size={18} color="#FFFFFF" />}
            onPress={handlePunchIn}
            disabled={
              isPunching ||
              (!!todayRecord?.punchInTime && !todayRecord?.punchOutTime)
            }
            loading={isPunching}
            size="large"
            style={styles.largePunchButton}
          />
          <Button
            title={isPunching ? 'Verifying...' : 'Punch Out'}
            icon={<Clock size={18} color={colors.primary} />}
            onPress={handlePunchOut}
            variant="outline"
            disabled={
              isPunching ||
              !todayRecord?.punchInTime ||
              !!todayRecord?.punchOutTime
            }
            loading={isPunching}
            size="large"
            style={styles.largePunchButton}
          />
        </View>

        {/* Section 4: Working Hours Summary */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text
              style={[styles.statValue, { color: colors.success }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {stats.presentCount}
            </Text>
            <Text style={[styles.statTitle, { color: colors.textSecondary }]} numberOfLines={1}>
              Present Days
            </Text>
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text
              style={[styles.statValue, { color: colors.warning }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {stats.lateCount}
            </Text>
            <Text style={[styles.statTitle, { color: colors.textSecondary }]} numberOfLines={1}>
              Late Arrivals
            </Text>
          </View>

          <View style={[styles.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text
              style={[styles.statValue, { color: colors.primary }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {stats.totalWorkingHours}h
            </Text>
            <Text style={[styles.statTitle, { color: colors.textSecondary }]} numberOfLines={1}>
              Total Hours
            </Text>
          </View>
        </View>

        {/* Section 5: Attendance History */}
        <SectionHeader
          title="Attendance History"
          subtitle={
            records.length > 0
              ? `${records.length} record${records.length > 1 ? 's' : ''} in ${selectedPeriod}`
              : 'Recent check-ins & shifts'
          }
        />

        {/* Dedicated Full-Width Segmented Period Switcher */}
        <View
          style={[
            styles.periodSegmentContainer,
            {
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
              borderColor: isDark ? colors.border : '#E2E8F0',
            },
          ]}
        >
          {(['daily', 'weekly', 'monthly'] as const).map(tab => {
            const isActive = selectedPeriod === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.periodSegmentTab,
                  isActive && {
                    backgroundColor: colors.primary,
                    ...SHADOWS.subtle,
                  },
                ]}
                onPress={() => setSelectedPeriod(tab)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${tab.charAt(0).toUpperCase() + tab.slice(1)} attendance`}
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  style={[
                    styles.periodSegmentText,
                    {
                      color: isActive ? '#FFFFFF' : colors.textSecondary,
                      fontWeight: isActive ? '700' : '600',
                    },
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
          onEnrollFace={() => {
            setFaceModalVisible(false);
            setFaceRecoveryModalVisible(true);
          }}
        />
      )}

      {currentUser && (
        <DeviceBindingModal
          visible={deviceModalVisible}
          currentUser={currentUser}
          onClose={() => setDeviceModalVisible(false)}
          onUpdated={loadAttendance}
        />
      )}

      {currentUser && (
        <FaceRegistrationModal
          visible={faceRecoveryModalVisible}
          staff={currentUser}
          currentUserId={currentUser.id}
          onSuccess={async () => {
            setFaceRecoveryModalVisible(false);
            showSuccess(
              'Face Recovery Submitted',
              'Your face recovery has been submitted for Administrator review. Punch In and Punch Out will be enabled once your store administrator verifies and approves this face.'
            );
            await loadAttendance();
          }}
          onClose={() => setFaceRecoveryModalVisible(false)}
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
  headerActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    width: '100%',
  },
  headerActionBtn: {
    flex: 1,
    height: 46,
    minHeight: 44,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  headerActionBtnText: {
    ...TYPOGRAPHY.bodyBold,
    fontSize: 14,
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
  diagToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: SPACING.sm,
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  diagToggleText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
  },
  diagCardBody: {
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    marginVertical: SPACING.xs,
    gap: 6,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagLabel: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 11,
  },
  diagValMono: {
    ...TYPOGRAPHY.captionSmall,
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '600',
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
    minWidth: 0,
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
  periodSegmentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    padding: 3,
    marginBottom: SPACING.md,
  },
  periodSegmentTab: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: RADIUS.full,
  },
  periodSegmentText: {
    fontSize: 13,
    letterSpacing: 0.1,
  },
  staffChips: {
    marginBottom: SPACING.md,
  },
  staffChipsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingRight: SPACING.xl,
    paddingBottom: 2,
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
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm + 2,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
    gap: SPACING.sm,
  },
  pendingBannerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBannerTextCol: {
    flex: 1,
    gap: 1,
  },
  pendingBannerTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingBannerSubtitle: {
    fontSize: 11,
    fontWeight: '500',
  },
  pendingBannerPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
  },
  pendingBannerAction: {
    fontSize: 12,
    fontWeight: '700',
  },
});
