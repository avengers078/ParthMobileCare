import { AttendanceRecord, GeoPoint, ShopConfig, User, FaceVerificationToken } from '../types';
import {
  calculateDistanceMeters,
  checkBusinessHours,
  calculateWorkingHours,
  isPunchInLate,
  isEarlyExit,
} from '../utils/geo';
import { getCurrentTimeString, getTodayDateString } from '../utils/format';
import { StorageService } from './storageService';
import { FaceRecognitionService } from './faceRecognitionService';
import { LocationService } from './locationService';
import { DeviceBindingService } from './deviceBindingService';
import { PermissionsAndroid, Platform } from 'react-native';

export interface PunchResult {
  success: boolean;
  message: string;
  record?: AttendanceRecord;
  currentDistanceMeters?: number;
  userCoords?: GeoPoint;
}

export class AttendanceService {
  /**
   * Request native runtime location permission on Android
   */
  static async requestLocationPermission(): Promise<boolean> {
    const status = await LocationService.requestLocationPermissions();
    return status.granted;
  }

  /**
   * Acquire live GPS position from device with multi-tier fallback (High Accuracy -> Network)
   */
  static async getCurrentPosition(options?: { freshOnly?: boolean; timeoutMs?: number }): Promise<GeoPoint> {
    return await LocationService.getCurrentLocation({
      requirePrecise: true,
      freshOnly: options?.freshOnly ?? false,
      maxAgeMs: options?.freshOnly ? 0 : 15000,
      timeoutMs: options?.timeoutMs ?? 15000,
      allowCachedFallback: !options?.freshOnly,
    });
  }

  /**
   * Perform Punch In
   * Strictly enforces:
   * 1. Must be within shop radius (e.g. 30 meters)
   * 2. Must be within official business hours (after opening time)
   * 3. Must have valid cryptographic face recognition verification token
   */
  static async punchIn(
    user: User,
    shopConfig: ShopConfig,
    providedCoords?: GeoPoint,
    verificationToken?: FaceVerificationToken
  ): Promise<PunchResult> {
    const today = getTodayDateString();
    const timeNow = getCurrentTimeString();

    // 1. User Account & Status Validation
    if (!user || !user.id) {
      return { success: false, message: 'Authentication required. No active session.' };
    }
    if (user.isActive === false) {
      const reason = 'Staff account is inactive or disabled. Attendance rejected.';
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_in',
        status: 'blocked',
        reason,
      });
      return { success: false, message: reason };
    }

    // 2. Business Hours Validation
    const hoursCheck = checkBusinessHours(
      shopConfig.openingTime,
      shopConfig.closingTime
    );

    if (!hoursCheck.canPunchIn) {
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_in',
        status: 'blocked',
        reason: hoursCheck.message,
      });
      return {
        success: false,
        message: hoursCheck.message,
      };
    }

    // 3. Real-Time GPS Coordinates & Geo-Fencing
    let coords: GeoPoint;
    try {
      coords = providedCoords || (await this.getCurrentPosition());
    } catch (gpsError: any) {
      const errorMsg = gpsError?.message || 'Could not acquire GPS position for punch in.';
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_in',
        status: 'blocked',
        reason: errorMsg,
      });
      return {
        success: false,
        message: `GPS check required: ${errorMsg}`,
      };
    }

    const shopCoords: GeoPoint = {
      latitude: shopConfig.latitude,
      longitude: shopConfig.longitude,
    };

    const distance = calculateDistanceMeters(coords, shopCoords);

    if (distance > shopConfig.allowedRadiusMeters) {
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_in',
        status: 'blocked',
        reason: `Geo-fence violation (${distance.toFixed(1)}m > ${shopConfig.allowedRadiusMeters}m)`,
        distanceMeters: distance,
      });
      return {
        success: false,
        currentDistanceMeters: distance,
        userCoords: coords,
        message: 'You are too far from the shop. Please reach the shop location and refresh GPS.',
      };
    }

    // 4. Attendance State Transition: Check existing today's record
    const existingRecords = await StorageService.getAttendanceRecords(user.id);
    const todayRecord = existingRecords.find(r => r.date === today);

    if (todayRecord && todayRecord.punchInTime) {
      return {
        success: false,
        message: `You have already punched in today at ${todayRecord.punchInTime}.`,
        record: todayRecord,
      };
    }

    // 5. Biometric Face Enrollment & Admin Approval Validation
    const bioStatus = await FaceRecognitionService.getBiometricEnrollmentStatus(user);
    if (!bioStatus.canVerify) {
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_in',
        status: 'blocked',
        reason: bioStatus.message,
      });
      return { success: false, message: bioStatus.message };
    }

    // 6. Cryptographic Server-Side Face Recognition Token Validation
    const tokenValidation = await FaceRecognitionService.validateVerificationToken(
      verificationToken,
      user.id,
      'punch_in'
    );

    if (!tokenValidation.valid) {
      await StorageService.recordVerificationFailure(user.id, tokenValidation.reason || 'Face verification failed.');
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_in',
        status: 'failed',
        reason: tokenValidation.reason,
        similarityScore: verificationToken?.similarityScore,
        livenessScore: verificationToken?.livenessScore,
        distanceMeters: distance,
      });
      return {
        success: false,
        currentDistanceMeters: distance,
        userCoords: coords,
        message: tokenValidation.reason || 'Face verification failed.',
      };
    }

    // Single-use token consumption
    await StorageService.consumeVerificationToken(verificationToken!.tokenId);
    await StorageService.resetVerificationFailures(user.id);

    // 7. Hardware Device Binding Validation
    const deviceCheck = await DeviceBindingService.checkDeviceStatus(user);
    if (!deviceCheck.canPunch) {
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_in',
        status: 'blocked',
        reason: deviceCheck.message,
      });
      return { success: false, message: deviceCheck.message };
    }

    // 8. Late Arrival Check
    const isLate = isPunchInLate(timeNow, shopConfig.openingTime, 15);

    const newRecord: AttendanceRecord = {
      id: `att_${user.id}_${today}`,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      date: today,
      timestamp: new Date().toISOString(),
      punchInTime: timeNow,
      punchInCoords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        distanceMeters: distance,
        accuracyMeters: coords.accuracy,
        timestamp: new Date().toISOString(),
        isMocked: coords.isMocked,
      },
      status: isLate ? 'late' : 'present',
      totalHours: 0,
      isLate,
      isEarlyExit: false,
      verificationMethod: 'face_recognition',
      faceVerificationScore: verificationToken?.similarityScore,
      faceLivenessScore: verificationToken?.livenessScore,
      faceVerificationTokenId: verificationToken?.tokenId,
      deviceId: deviceCheck.currentDeviceId,
    };

    await StorageService.saveAttendanceRecord(newRecord);

    await StorageService.addAttendanceAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'punch_in',
      status: 'success',
      similarityScore: verificationToken?.similarityScore,
      livenessScore: verificationToken?.livenessScore,
      distanceMeters: distance,
      notes: `Punch In Verified via Face Recognition at ${timeNow}`,
    });

    await StorageService.addNotification({
      userId: user.id,
      title: 'Punch In Recorded',
      body: `Punched in with Face Recognition at ${timeNow} (${distance.toFixed(1)}m from shop). Status: ${
        isLate ? 'Late Arrival' : 'On Time'
      }`,
      type: 'attendance',
      relatedId: newRecord.id,
    });

    return {
      success: true,
      message: `Punch In successful at ${timeNow}! (${distance.toFixed(1)}m from shop)`,
      record: newRecord,
      currentDistanceMeters: distance,
      userCoords: coords,
    };
  }

  /**
   * Perform Punch Out
   * Strictly enforces:
   * 1. Must have already punched in
   * 2. Must be within shop radius
   * 3. Must be before closing time
   * 4. Must have valid cryptographic face recognition verification token
   */
  static async punchOut(
    user: User,
    shopConfig: ShopConfig,
    providedCoords?: GeoPoint,
    verificationToken?: FaceVerificationToken
  ): Promise<PunchResult> {
    const today = getTodayDateString();
    const timeNow = getCurrentTimeString();

    // 1. User Account & Status Validation
    if (!user || !user.id) {
      return { success: false, message: 'Authentication required. No active session.' };
    }
    if (user.isActive === false) {
      const reason = 'Staff account is inactive or disabled. Attendance rejected.';
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_out',
        status: 'blocked',
        reason,
      });
      return { success: false, message: reason };
    }

    // 2. Business Hours Validation
    const hoursCheck = checkBusinessHours(
      shopConfig.openingTime,
      shopConfig.closingTime
    );

    if (!hoursCheck.canPunchOut) {
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_out',
        status: 'blocked',
        reason: hoursCheck.message,
      });
      return {
        success: false,
        message: hoursCheck.message,
      };
    }

    // 3. Attendance State Transition: Fetch today's punch in
    const existingRecords = await StorageService.getAttendanceRecords(user.id);
    const todayRecord = existingRecords.find(r => r.date === today);

    if (!todayRecord || !todayRecord.punchInTime) {
      return {
        success: false,
        message: 'No Punch In record found for today. You must Punch In first.',
      };
    }

    if (todayRecord.punchOutTime) {
      return {
        success: false,
        message: `You have already punched out today at ${todayRecord.punchOutTime}.`,
        record: todayRecord,
      };
    }

    // 4. Real-Time GPS Coordinates & Geo-Fencing
    let coords: GeoPoint;
    try {
      coords = providedCoords || (await this.getCurrentPosition());
    } catch (gpsError: any) {
      const errorMsg = gpsError?.message || 'Could not acquire GPS position for punch out.';
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_out',
        status: 'blocked',
        reason: errorMsg,
      });
      return {
        success: false,
        message: `GPS check required: ${errorMsg}`,
      };
    }

    const shopCoords: GeoPoint = {
      latitude: shopConfig.latitude,
      longitude: shopConfig.longitude,
    };

    const distance = calculateDistanceMeters(coords, shopCoords);

    if (distance > shopConfig.allowedRadiusMeters) {
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_out',
        status: 'blocked',
        reason: `Geo-fence violation (${distance.toFixed(1)}m > ${shopConfig.allowedRadiusMeters}m)`,
        distanceMeters: distance,
      });
      return {
        success: false,
        currentDistanceMeters: distance,
        userCoords: coords,
        message: 'You are too far from the shop. Please reach the shop location and refresh GPS.',
      };
    }

    // 5. Biometric Face Enrollment & Admin Approval Validation
    const bioStatus = await FaceRecognitionService.getBiometricEnrollmentStatus(user);
    if (!bioStatus.canVerify) {
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_out',
        status: 'blocked',
        reason: bioStatus.message,
      });
      return { success: false, message: bioStatus.message };
    }

    // 6. Cryptographic Server-Side Face Recognition Token Validation
    const tokenValidation = await FaceRecognitionService.validateVerificationToken(
      verificationToken,
      user.id,
      'punch_out'
    );

    if (!tokenValidation.valid) {
      await StorageService.recordVerificationFailure(user.id, tokenValidation.reason || 'Face verification failed.');
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_out',
        status: 'failed',
        reason: tokenValidation.reason,
        similarityScore: verificationToken?.similarityScore,
        livenessScore: verificationToken?.livenessScore,
        distanceMeters: distance,
      });
      return {
        success: false,
        currentDistanceMeters: distance,
        userCoords: coords,
        message: tokenValidation.reason || 'Face verification failed.',
      };
    }

    // Single-use token consumption
    await StorageService.consumeVerificationToken(verificationToken!.tokenId);
    await StorageService.resetVerificationFailures(user.id);

    // 7. Hardware Device Binding Validation
    const deviceCheck = await DeviceBindingService.checkDeviceStatus(user);
    if (!deviceCheck.canPunch) {
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'punch_out',
        status: 'blocked',
        reason: deviceCheck.message,
      });
      return { success: false, message: deviceCheck.message };
    }

    // 8. Calculate working hours & sequence verification
    const workingHours = calculateWorkingHours(todayRecord.punchInTime, timeNow);
    const early = isEarlyExit(timeNow, shopConfig.closingTime, 30);

    const updatedRecord: AttendanceRecord = {
      ...todayRecord,
      timestamp: new Date().toISOString(),
      punchOutTime: timeNow,
      punchOutCoords: {
        latitude: coords.latitude,
        longitude: coords.longitude,
        distanceMeters: distance,
        accuracyMeters: coords.accuracy,
        timestamp: new Date().toISOString(),
        isMocked: coords.isMocked,
      },
      totalHours: workingHours,
      isEarlyExit: early,
      status: workingHours < 4 ? 'half_day' : todayRecord.status,
      verificationMethod: 'face_recognition',
      faceVerificationScore: verificationToken?.similarityScore,
      faceLivenessScore: verificationToken?.livenessScore,
      faceVerificationTokenId: verificationToken?.tokenId,
      deviceId: deviceCheck.currentDeviceId,
    };

    await StorageService.saveAttendanceRecord(updatedRecord);

    await StorageService.addAttendanceAuditLog({
      userId: user.id,
      userName: user.name,
      action: 'punch_out',
      status: 'success',
      similarityScore: verificationToken?.similarityScore,
      livenessScore: verificationToken?.livenessScore,
      distanceMeters: distance,
      notes: `Punch Out Verified via Face Recognition at ${timeNow}. Hours: ${workingHours}`,
    });

    await StorageService.addNotification({
      userId: user.id,
      title: 'Punch Out Recorded',
      body: `Punched out with Face Recognition at ${timeNow}. Total working time: ${workingHours} hrs.`,
      type: 'attendance',
      relatedId: updatedRecord.id,
    });

    return {
      success: true,
      message: `Punch Out recorded successfully! Worked: ${workingHours} hours.`,
      record: updatedRecord,
      currentDistanceMeters: distance,
      userCoords: coords,
    };
  }

  /**
   * Get attendance statistics for a given user or all users
   */
  static async getAttendanceStats(
    userId?: string,
    monthKey: string = getTodayDateString().substring(0, 7)
  ) {
    const records = await StorageService.getAttendanceRecords(userId);
    const monthRecords = records.filter(r => r.date.startsWith(monthKey));

    const totalDays = monthRecords.length;
    const presentCount = monthRecords.filter(r => r.status === 'present').length;
    const lateCount = monthRecords.filter(r => r.isLate).length;
    const halfDayCount = monthRecords.filter(r => r.status === 'half_day').length;
    const earlyExitCount = monthRecords.filter(r => r.isEarlyExit).length;
    const totalWorkingHours = monthRecords.reduce((acc, r) => acc + (r.totalHours || 0), 0);

    return {
      monthKey,
      totalDays,
      presentCount,
      lateCount,
      halfDayCount,
      earlyExitCount,
      totalWorkingHours: Math.round(totalWorkingHours * 10) / 10,
      records: monthRecords,
    };
  }
}
