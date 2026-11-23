import {
  calculateDistanceMeters,
  isValidCoordinate,
  isWithinShopRadius,
} from '../src/utils/geo';
import { LocationService, LocationStatus } from '../src/services/locationService';
import { StorageService } from '../src/services/storageService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SHOP_CONFIG } from '../src/constants';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    getAuth: jest.fn(),
    getFirestore: jest.fn(),
    getStorage: jest.fn(),
  },
}));

describe('GEOFENCING & GPS LOCATION COMPREHENSIVE TEST SUITE', () => {
  const ahmedabadShop = { latitude: 23.032588, longitude: 72.661115 };
  const suratCoords = { latitude: 21.1702, longitude: 72.8311 };

  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('1. Coordinate Validation (isValidCoordinate)', () => {
    it('accepts valid geographic coordinates', () => {
      expect(isValidCoordinate(23.032588, 72.661115)).toBe(true);
      expect(isValidCoordinate(0.1, 0.1)).toBe(true);
      expect(isValidCoordinate(-33.8688, 151.2093)).toBe(true);
      expect(isValidCoordinate(90, 180)).toBe(true);
      expect(isValidCoordinate(-90, -180)).toBe(true);
    });

    it('rejects Null Island (0, 0)', () => {
      expect(isValidCoordinate(0, 0)).toBe(false);
    });

    it('rejects NaN and non-numeric inputs', () => {
      expect(isValidCoordinate(NaN, 72.661115)).toBe(false);
      expect(isValidCoordinate(23.032588, NaN)).toBe(false);
      expect(isValidCoordinate(undefined as any, 72.661115)).toBe(false);
      expect(isValidCoordinate(null as any, 72.661115)).toBe(false);
    });

    it('rejects Infinite coordinates', () => {
      expect(isValidCoordinate(Infinity, 72.661115)).toBe(false);
      expect(isValidCoordinate(23.032588, -Infinity)).toBe(false);
    });

    it('rejects out-of-bounds latitude (< -90 or > 90)', () => {
      expect(isValidCoordinate(90.0001, 72.661115)).toBe(false);
      expect(isValidCoordinate(-91, 72.661115)).toBe(false);
    });

    it('rejects out-of-bounds longitude (< -180 or > 180)', () => {
      expect(isValidCoordinate(23.032588, 180.0001)).toBe(false);
      expect(isValidCoordinate(23.032588, -180.0001)).toBe(false);
    });
  });

  describe('2. Haversine Distance Calculation', () => {
    it('calculates 0 meters for identical coordinates', () => {
      expect(calculateDistanceMeters(ahmedabadShop, ahmedabadShop)).toBe(0);
    });

    it('is strictly symmetric (A to B === B to A)', () => {
      const d1 = calculateDistanceMeters(ahmedabadShop, suratCoords);
      const d2 = calculateDistanceMeters(suratCoords, ahmedabadShop);
      expect(d1).toBe(d2);
    });

    it('accurately reproduces the ~207.8 km distance between Ahmedabad and Surat', () => {
      const distance = calculateDistanceMeters(ahmedabadShop, suratCoords);
      // Expected ~207.8 km (207,827 metres using WGS-84 sphere R=6,371,000m)
      expect(distance).toBeGreaterThan(206000);
      expect(distance).toBeLessThan(209000);
      expect(Math.round(distance)).toBe(207827);
    });

    it('calculates micro-distances within 30m accurately', () => {
      // 0.0001 degrees latitude is ~11.1 meters
      const offsetPos = { latitude: ahmedabadShop.latitude + 0.0001, longitude: ahmedabadShop.longitude };
      const dist = calculateDistanceMeters(ahmedabadShop, offsetPos);
      expect(dist).toBeGreaterThan(10);
      expect(dist).toBeLessThan(12);
    });

    it('throws descriptive error for invalid coordinates', () => {
      expect(() => calculateDistanceMeters(null as any, ahmedabadShop)).toThrow();
      expect(() => calculateDistanceMeters(ahmedabadShop, { latitude: 0, longitude: 0 })).toThrow();
    });
  });

  describe('3. Geofence & Accuracy Rule Verification (isWithinShopRadius)', () => {
    it('permits punch when user is 10m away with good accuracy (15m)', () => {
      const userPos = {
        latitude: ahmedabadShop.latitude + 0.00008,
        longitude: ahmedabadShop.longitude,
        accuracy: 15,
      };
      const result = isWithinShopRadius(userPos, ahmedabadShop, 30, 60);
      expect(result.inside).toBe(true);
      expect(result.distanceMeters).toBeLessThan(15);
      expect(result.accuracyAcceptable).toBe(true);
    });

    it('blocks punch when distance exceeds allowed radius (e.g. 45m with 30m limit)', () => {
      const userPos = {
        latitude: ahmedabadShop.latitude + 0.00045, // ~50m away
        longitude: ahmedabadShop.longitude,
        accuracy: 10,
      };
      const result = isWithinShopRadius(userPos, ahmedabadShop, 30, 60);
      expect(result.inside).toBe(false);
      expect(result.distanceMeters).toBeGreaterThan(30);
    });

    it('blocks punch when accuracy is weak (> 60m) even if coordinates fall inside radius', () => {
      const userPos = {
        latitude: ahmedabadShop.latitude,
        longitude: ahmedabadShop.longitude,
        accuracy: 120, // weak accuracy (e.g. cell tower only)
      };
      const result = isWithinShopRadius(userPos, ahmedabadShop, 30, 60);
      expect(result.inside).toBe(false);
      expect(result.accuracyAcceptable).toBe(false);
      expect(result.reason).toContain('accuracy is too weak');
    });

    it('guards against null / undefined coordinates', () => {
      const result = isWithinShopRadius(null, ahmedabadShop, 30);
      expect(result.inside).toBe(false);
      expect(result.reason).toContain('Invalid coordinates');
    });
  });

  describe('4. Location State Evaluation (evaluateLocationState)', () => {
    it('returns LOCATING state when locating flag is true', () => {
      const state = LocationService.evaluateLocationState(null, ahmedabadShop, 30, true, null);
      expect(state.status).toBe(LocationStatus.LOCATING);
      expect(state.canPunch).toBe(false);
    });

    it('returns PERMISSION_DENIED when permission error is passed', () => {
      const state = LocationService.evaluateLocationState(
        null,
        ahmedabadShop,
        30,
        false,
        'User denied location permission'
      );
      expect(state.status).toBe(LocationStatus.PERMISSION_DENIED);
      expect(state.canPunch).toBe(false);
    });

    it('returns LOCATION_DISABLED when device GPS is disabled', () => {
      const state = LocationService.evaluateLocationState(
        null,
        ahmedabadShop,
        30,
        false,
        'Device location service is disabled'
      );
      expect(state.status).toBe(LocationStatus.LOCATION_DISABLED);
      expect(state.canPunch).toBe(false);
    });

    it('returns LOCATION_TIMEOUT when request timed out', () => {
      const state = LocationService.evaluateLocationState(
        null,
        ahmedabadShop,
        30,
        false,
        'Location request timed out after 15s'
      );
      expect(state.status).toBe(LocationStatus.LOCATION_TIMEOUT);
      expect(state.canPunch).toBe(false);
    });

    it('returns LOW_ACCURACY when GPS fix accuracy is worse than threshold', () => {
      const userPos = {
        latitude: ahmedabadShop.latitude,
        longitude: ahmedabadShop.longitude,
        accuracy: 85,
      };
      const state = LocationService.evaluateLocationState(userPos, ahmedabadShop, 30, false, null, 60);
      expect(state.status).toBe(LocationStatus.LOW_ACCURACY);
      expect(state.canPunch).toBe(false);
    });

    it('returns INSIDE_GEOFENCE when within 30m with good accuracy', () => {
      const userPos = {
        latitude: ahmedabadShop.latitude + 0.00005,
        longitude: ahmedabadShop.longitude,
        accuracy: 12,
      };
      const state = LocationService.evaluateLocationState(userPos, ahmedabadShop, 30, false, null, 60);
      expect(state.status).toBe(LocationStatus.INSIDE_GEOFENCE);
      expect(state.canPunch).toBe(true);
    });

    it('returns OUTSIDE_GEOFENCE when 207km away in Surat', () => {
      const userPos = {
        latitude: suratCoords.latitude,
        longitude: suratCoords.longitude,
        accuracy: 15,
      };
      const state = LocationService.evaluateLocationState(userPos, ahmedabadShop, 30, false, null, 60);
      expect(state.status).toBe(LocationStatus.OUTSIDE_GEOFENCE);
      expect(state.canPunch).toBe(false);
      expect(state.distanceMeters).toBeGreaterThan(200000);
    });
  });

  describe('5. Storage & Shop Config Synchronization', () => {
    it('StorageService.getShopConfig purges stale Surat coordinates from storage', async () => {
      // Simulate old cached config in AsyncStorage with Surat coordinates
      const staleSuratConfig = {
        ...DEFAULT_SHOP_CONFIG,
        latitude: 21.1702,
        longitude: 72.8311,
      };
      await AsyncStorage.setItem('@pmc_shop_config', JSON.stringify(staleSuratConfig));

      const config = await StorageService.getShopConfig();
      expect(config.latitude).toBe(23.032588);
      expect(config.longitude).toBe(72.661115);
      expect(config.allowedRadiusMeters).toBe(30);

      // Verify AsyncStorage was overwritten with sanitized config
      const refreshedRaw = await AsyncStorage.getItem('@pmc_shop_config');
      const refreshedParsed = JSON.parse(refreshedRaw || '{}');
      expect(refreshedParsed.latitude).toBe(23.032588);
    });
  });
});
