import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { GeoPoint } from '../types';
import { calculateDistanceMeters, isValidCoordinate } from '../utils/geo';

export const LocationStatus = {
  LOCATING: 'LOCATING' as const,
  GOOD_ACCURACY: 'GOOD_ACCURACY' as const,
  LOW_ACCURACY: 'LOW_ACCURACY' as const,
  INSIDE_GEOFENCE: 'INSIDE_GEOFENCE' as const,
  OUTSIDE_GEOFENCE: 'OUTSIDE_GEOFENCE' as const,
  PERMISSION_DENIED: 'PERMISSION_DENIED' as const,
  LOCATION_DISABLED: 'LOCATION_DISABLED' as const,
  LOCATION_TIMEOUT: 'LOCATION_TIMEOUT' as const,
};

export type LocationStatus = (typeof LocationStatus)[keyof typeof LocationStatus];

export interface LocationPermissionStatus {
  granted: boolean;
  isPrecise: boolean;
  canAskAgain: boolean;
  message?: string;
}

export interface LocationOptions {
  requirePrecise?: boolean;
  freshOnly?: boolean;
  maxAgeMs?: number;
  timeoutMs?: number;
  maxAllowedAccuracyMeters?: number;
  allowCachedFallback?: boolean;
}

export class LocationService {
  private static lastValidPosition: GeoPoint | null = null;
  private static activeRequestPromise: Promise<GeoPoint> | null = null;

  /**
   * Validates whether a GPS fix meets freshness and accuracy thresholds.
   */
  static validateAttendanceFix(
    fix: GeoPoint,
    maxAccuracyMeters: number = 60,
    maxAgeMs: number = 5 * 60 * 1000
  ): { valid: boolean; reason?: string } {
    if (!fix || !isValidCoordinate(fix.latitude, fix.longitude)) {
      return { valid: false, reason: 'Invalid coordinates' };
    }
    if (fix.accuracy !== undefined && fix.accuracy > maxAccuracyMeters) {
      return {
        valid: false,
        reason: `GPS accuracy is too low (±${Math.round(fix.accuracy)}m > ±${maxAccuracyMeters}m).`,
      };
    }
    if (fix.timestamp && Date.now() - fix.timestamp > maxAgeMs) {
      return {
        valid: false,
        reason: 'GPS fix is stale (older than allowed freshness threshold).',
      };
    }
    return { valid: true };
  }

  /**
   * Checks and requests runtime location permissions (FINE and COARSE) on Android.
   */
  static async requestLocationPermissions(): Promise<LocationPermissionStatus> {
    if (Platform.OS !== 'android') {
      return { granted: true, isPrecise: true, canAskAgain: true };
    }

    try {
      // 1. Check if permissions are already granted
      const hasFine = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const hasCoarse = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );

      if (hasFine) {
        return { granted: true, isPrecise: true, canAskAgain: true };
      }

      if (hasCoarse) {
        // Coarse is granted, but fine was not; request fine for geofence precision
        const fineResult = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Precise Location Required',
            message:
              'Parth Mobile Care requires precise GPS location to verify that you are physically within the shop attendance boundary.',
            buttonPositive: 'Grant Precise',
            buttonNegative: 'Keep Approximate',
          }
        );
        const fineGranted = fineResult === PermissionsAndroid.RESULTS.GRANTED;
        return {
          granted: true,
          isPrecise: fineGranted,
          canAskAgain: fineResult !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
          message: fineGranted
            ? undefined
            : 'Approximate location granted. Shop geofence requires Precise Location to verify attendance.',
        };
      }

      // 2. Request both permissions simultaneously (standard Android 12+ dialog)
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      const fineGranted =
        granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;
      const coarseGranted =
        granted['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED;

      if (fineGranted) {
        return { granted: true, isPrecise: true, canAskAgain: true };
      }

      if (coarseGranted) {
        return {
          granted: true,
          isPrecise: false,
          canAskAgain: true,
          message: 'Approximate location granted. Precise Location is required for shop geo-fencing.',
        };
      }

      const isPermanentlyDenied =
        granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        granted['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN;

      return {
        granted: false,
        isPrecise: false,
        canAskAgain: !isPermanentlyDenied,
        message: isPermanentlyDenied
          ? 'Location permission is permanently denied. Please enable Location in Android App Settings.'
          : 'Location permission was denied. Location access is required for shop attendance.',
      };
    } catch (e: any) {
      console.warn('[LocationService] Permission request exception:', e);
      return {
        granted: false,
        isPrecise: false,
        canAskAgain: true,
        message: e?.message || 'Error checking location permissions.',
      };
    }
  }

  /**
   * Executes a raw Geolocation position query wrapped in a Promise
   */
  private static queryProvider(
    highAccuracy: boolean,
    timeoutMs: number,
    maximumAgeMs: number
  ): Promise<GeoPoint> {
    const geo = Geolocation || (typeof navigator !== 'undefined' ? (navigator as any)?.geolocation : null);
    if (!geo) {
      return Promise.reject(new Error('Device location engine is not available.'));
    }

    return new Promise((resolve, reject) => {
      geo.getCurrentPosition(
        position => {
          const coords = position.coords;
          const timestamp = position.timestamp || Date.now();

          // Reject invalid or uninitialized coordinates
          if (!isValidCoordinate(coords.latitude, coords.longitude)) {
            return reject(new Error('Invalid GPS coordinates received from location provider.'));
          }

          const point: GeoPoint = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            accuracy: coords.accuracy,
            isMocked: Boolean((coords as any).mocked),
            timestamp,
            isPrecise: (coords.accuracy ?? 999) <= 50,
            isCached: false,
          };

          resolve(point);
        },
        error => {
          reject(error);
        },
        {
          enableHighAccuracy: highAccuracy,
          timeout: timeoutMs,
          maximumAge: maximumAgeMs,
        }
      );
    });
  }

  /**
   * Acquires live GPS coordinates with multi-tier fallback:
   * 1. Try High Accuracy (GPS Satellites) with 12s timeout.
   * 2. If satellite signal is weak/indoors, immediately try Balanced/Network provider with 10s timeout.
   * 3. Validates coordinate bounds and freshness.
   */
  /**
   * Returns the most recent valid GPS fix acquired during this session (if available).
   */
  static getLastKnownPosition(): GeoPoint | null {
    return this.lastValidPosition;
  }

  static async getCurrentLocation(options?: LocationOptions): Promise<GeoPoint> {
    // If a request is already running and freshOnly is false, share the active promise
    if (!options?.freshOnly && this.activeRequestPromise) {
      return this.activeRequestPromise;
    }

    const task = this.executeLocationAcquisition(options);
    this.activeRequestPromise = task;

    try {
      const result = await task;
      this.lastValidPosition = result;
      return result;
    } finally {
      this.activeRequestPromise = null;
    }
  }

  private static async executeLocationAcquisition(options?: LocationOptions): Promise<GeoPoint> {
    const isFresh = options?.freshOnly ?? false;
    const opts: LocationOptions = {
      requirePrecise: true,
      freshOnly: isFresh,
      timeoutMs: options?.timeoutMs ?? (isFresh ? 8000 : 6000),
      maxAgeMs: isFresh ? 0 : (options?.maxAgeMs ?? 15000),
      maxAllowedAccuracyMeters: options?.maxAllowedAccuracyMeters ?? 60,
      allowCachedFallback: isFresh ? false : (options?.allowCachedFallback ?? true),
      ...options,
    };

    // 0. Fast-path: Return fresh cached fix immediately if available (< 60s) and freshOnly is false
    if (opts.allowCachedFallback && !isFresh && this.lastValidPosition) {
      const ageMs = Date.now() - (this.lastValidPosition.timestamp || 0);
      if (ageMs < 60000) {
        return {
          ...this.lastValidPosition,
          isCached: true,
        };
      }
    }

    // 1. Verify and request permissions
    const perm = await this.requestLocationPermissions();
    if (!perm.granted) {
      throw new Error(perm.message || 'Location permission denied. Please grant permission to continue.');
    }

    let lastError: any = null;

    // 2. Tier 1: High Accuracy (GPS Satellite / Fused Provider)
    try {
      const highAccPoint = await this.queryProvider(true, opts.timeoutMs!, opts.maxAgeMs!);
      return highAccPoint;
    } catch (e: any) {
      lastError = e;
      if (__DEV__) console.warn('[LocationService] Tier 1 (High Accuracy) failed or timed out:', e?.message || e);
    }

    // 3. Tier 2: Balanced / Network Provider Fallback (Crucial indoors where satellites cannot penetrate)
    try {
      const networkPoint = await this.queryProvider(false, 4000, isFresh ? 0 : 30000);
      return networkPoint;
    } catch (e: any) {
      lastError = e;
      if (__DEV__) console.warn('[LocationService] Tier 2 (Network fallback) failed:', e?.message || e);
    }

    // 4. Tier 3: Cached Fix Fallback (if fix is up to 3 minutes old as emergency fallback)
    if (opts.allowCachedFallback && !isFresh && this.lastValidPosition) {
      const ageMs = Date.now() - (this.lastValidPosition.timestamp || 0);
      if (ageMs < 180000) {
        return {
          ...this.lastValidPosition,
          isCached: true,
        };
      }
    }

    // 5. Translate errors into friendly, actionable explanations
    if (lastError?.code === 1) {
      throw new Error('Location permission was denied. Please allow location access in your device settings.');
    }
    if (lastError?.code === 2) {
      throw new Error('Device location is turned off. Please enable GPS / Location in your Android quick settings.');
    }
    if (lastError?.code === 3) {
      throw new Error(
        'GPS signal timed out. Weak satellite signal detected. Please move near a window or outdoors and tap Refresh GPS.'
      );
    }

    throw new Error(lastError?.message || 'Could not determine GPS coordinates. Please check your signal and retry.');
  }

  /**
   * Evaluates the full location and geofence state for attendance
   */
  static evaluateLocationState(
    pos: GeoPoint | null,
    shopCoords: GeoPoint,
    allowedRadiusMeters: number,
    isLocating: boolean,
    errorMsg?: string | null,
    maxAccuracyMeters: number = 60
  ): {
    status: LocationStatus;
    distanceMeters: number | null;
    message: string;
    isInside: boolean;
    canPunch: boolean;
  } {
    if (isLocating) {
      return {
        status: 'LOCATING',
        distanceMeters: null,
        message: 'Finding your current location. Please wait...',
        isInside: false,
        canPunch: false,
      };
    }

    if (errorMsg) {
      const errLower = errorMsg.toLowerCase();
      if (errLower.includes('permission') || errLower.includes('denied')) {
        return {
          status: 'PERMISSION_DENIED',
          distanceMeters: null,
          message: 'Location permission is required to mark attendance.',
          isInside: false,
          canPunch: false,
        };
      }
      if (errLower.includes('turned off') || errLower.includes('disabled') || errLower.includes('provider')) {
        return {
          status: 'LOCATION_DISABLED',
          distanceMeters: null,
          message: 'Device location is turned off. Please enable GPS in device settings.',
          isInside: false,
          canPunch: false,
        };
      }
      if (errLower.includes('timed out') || errLower.includes('timeout') || errLower.includes('signal')) {
        return {
          status: 'LOCATION_TIMEOUT',
          distanceMeters: null,
          message: 'GPS signal timed out. Please step outdoors or near a window and refresh.',
          isInside: false,
          canPunch: false,
        };
      }

      return {
        status: 'LOCATION_TIMEOUT',
        distanceMeters: null,
        message: errorMsg,
        isInside: false,
        canPunch: false,
      };
    }

    if (!pos || !isValidCoordinate(pos.latitude, pos.longitude)) {
      return {
        status: 'LOCATING',
        distanceMeters: null,
        message: 'Acquiring GPS location fix...',
        isInside: false,
        canPunch: false,
      };
    }

    let distance: number;
    try {
      distance = calculateDistanceMeters(pos, shopCoords);
    } catch {
      return {
        status: 'LOCATION_TIMEOUT',
        distanceMeters: null,
        message: 'Unable to calculate distance from shop coordinates.',
        isInside: false,
        canPunch: false,
      };
    }

    // Check GPS accuracy
    const accuracy = pos.accuracy ?? 10;
    if (accuracy > maxAccuracyMeters) {
      return {
        status: 'LOW_ACCURACY',
        distanceMeters: distance,
        message: `Your GPS signal is weak (±${Math.round(accuracy)}m). Accuracy must be within ±${maxAccuracyMeters}m. Please move to an open area and refresh.`,
        isInside: false,
        canPunch: false,
      };
    }

    // Check Geofence with GPS accuracy tolerance buffer
    const accuracyTolerance = Math.min(Math.max(accuracy * 0.4, 0), 20);
    const effectiveRadius = allowedRadiusMeters + accuracyTolerance;

    if (distance <= effectiveRadius) {
      return {
        status: 'INSIDE_GEOFENCE',
        distanceMeters: distance,
        message: 'You are within the shop attendance area.',
        isInside: true,
        canPunch: true,
      };
    }

    return {
      status: 'OUTSIDE_GEOFENCE',
      distanceMeters: distance,
      message: `You are outside the shop attendance area (${Math.round(distance)}m from shop, allowed: ${allowedRadiusMeters}m). Please reach the shop and try again.`,
      isInside: false,
      canPunch: false,
    };
  }
}
