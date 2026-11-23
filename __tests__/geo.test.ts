import {
  calculateDistanceMeters,
  isWithinShopRadius,
  checkBusinessHours,
  isPunchInLate,
  isEarlyExit,
  calculateWorkingHours,
  parseTimeToMinutes,
} from '../src/utils/geo';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    getAuth: jest.fn(),
    getFirestore: jest.fn(),
    getStorage: jest.fn(),
  },
}));

import { AttendanceService } from '../src/services/attendanceService';
import { StorageService } from '../src/services/storageService';
import { FaceRecognitionService } from '../src/services/faceRecognitionService';
import { getTodayDateString } from '../src/utils/format';
import { ShopConfig, User } from '../src/types';

describe('Geo-Fencing & Business Hours Logic', () => {
  const shopLocation = { latitude: 21.1702, longitude: 72.8311 };

  test('calculates accurate distance in meters between two GPS coordinates', () => {
    // Exactly at shop location
    const exactDistance = calculateDistanceMeters(shopLocation, shopLocation);
    expect(exactDistance).toBe(0);

    // Coordinate slightly offset (~20-25 meters)
    const nearbyLocation = { latitude: 21.17038, longitude: 72.8311 };
    const distance = calculateDistanceMeters(shopLocation, nearbyLocation);
    expect(distance).toBeGreaterThan(15);
    expect(distance).toBeLessThan(30);
  });

  test('validates radius check (30 meters rule and boundary conditions)', () => {
    // 15 meters away (well inside)
    const inside = isWithinShopRadius(
      { latitude: 21.1703, longitude: 72.8311 },
      shopLocation,
      30
    );
    expect(inside.inside).toBe(true);
    expect(inside.distanceMeters).toBeLessThan(30);

    // 500 meters away (well outside)
    const outside = isWithinShopRadius(
      { latitude: 21.175, longitude: 72.835 },
      shopLocation,
      30
    );
    expect(outside.inside).toBe(false);
    expect(outside.distanceMeters).toBeGreaterThan(500);

    // Boundary condition: exactly at radius
    expect(isWithinShopRadius(shopLocation, shopLocation, 0).inside).toBe(true);
  });

  test('correctly parses 12h AM/PM and 24h time strings to minutes from midnight', () => {
    expect(parseTimeToMinutes('00:00')).toBe(0);
    expect(parseTimeToMinutes('10:00')).toBe(600);
    expect(parseTimeToMinutes('10:00 AM')).toBe(600);
    expect(parseTimeToMinutes('12:00 PM')).toBe(720);
    expect(parseTimeToMinutes('01:30 PM')).toBe(810);
    expect(parseTimeToMinutes('21:00')).toBe(1260);
    expect(parseTimeToMinutes('09:00 PM')).toBe(1260);
    expect(parseTimeToMinutes('12:00 AM')).toBe(0);
  });

  test('validates business hours punch restrictions & boundary conditions', () => {
    // 09:30 AM (before 10:00 AM opening) -> blocked
    const earlyMorning = new Date();
    earlyMorning.setHours(9, 30, 0, 0);
    const beforeOpenCheck = checkBusinessHours('10:00', '21:00', earlyMorning);
    expect(beforeOpenCheck.canPunchIn).toBe(false);
    expect(beforeOpenCheck.canPunchOut).toBe(false);
    expect(beforeOpenCheck.isWithinHours).toBe(false);
    expect(beforeOpenCheck.message).toContain('disabled before opening');

    // Exactly 10:00 AM (opening boundary) -> allowed
    const openingMoment = new Date();
    openingMoment.setHours(10, 0, 0, 0);
    const openCheck = checkBusinessHours('10:00', '21:00', openingMoment);
    expect(openCheck.canPunchIn).toBe(true);
    expect(openCheck.canPunchOut).toBe(true);
    expect(openCheck.isWithinHours).toBe(true);

    // 02:00 PM (during business hours) -> allowed
    const midday = new Date();
    midday.setHours(14, 0, 0, 0);
    const middayCheck = checkBusinessHours('10:00', '21:00', midday);
    expect(middayCheck.canPunchIn).toBe(true);
    expect(middayCheck.canPunchOut).toBe(true);
    expect(middayCheck.isWithinHours).toBe(true);

    // Exactly 21:00 (closing boundary) -> allowed
    const closingMoment = new Date();
    closingMoment.setHours(21, 0, 0, 0);
    const closeCheck = checkBusinessHours('10:00', '21:00', closingMoment);
    expect(closeCheck.canPunchIn).toBe(true);
    expect(closeCheck.canPunchOut).toBe(true);
    expect(closeCheck.isWithinHours).toBe(true);

    // 09:05 PM (after 09:00 PM closing) -> blocked
    const lateNight = new Date();
    lateNight.setHours(21, 5, 0, 0);
    const afterCloseCheck = checkBusinessHours('10:00', '21:00', lateNight);
    expect(afterCloseCheck.canPunchOut).toBe(false);
    expect(afterCloseCheck.canPunchIn).toBe(false);
    expect(afterCloseCheck.isWithinHours).toBe(false);
    expect(afterCloseCheck.message).toContain('disabled after closing');
  });

  test('tracks late arrival (15m grace) and early exit (30m threshold)', () => {
    // 10:14 AM is on-time (within 15m grace)
    expect(isPunchInLate('10:14', '10:00', 15)).toBe(false);

    // 10:16 AM is late (> 15m grace)
    expect(isPunchInLate('10:16', '10:00', 15)).toBe(true);

    // 20:25 (08:25 PM) is an early exit (> 30m before 21:00 closing)
    expect(isEarlyExit('20:25', '21:00', 30)).toBe(true);

    // 20:35 (08:35 PM) is NOT an early exit (within 30m of closing)
    expect(isEarlyExit('20:35', '21:00', 30)).toBe(false);
  });

  test('calculates working hours and guards against invalid sequences', () => {
    // Normal shift: 10:00 to 19:30 = 9.5 hours
    const hours = calculateWorkingHours('10:00', '19:30');
    expect(hours).toBe(9.5);

    // Impossible sequence: out time equal or earlier than in time -> 0 hours
    expect(calculateWorkingHours('18:00', '10:00')).toBe(0);
    expect(calculateWorkingHours('10:00', '10:00')).toBe(0);
  });
});

describe('Attendance Service Workflow & Sequence Integrity', () => {
  const mockShopConfig: ShopConfig = {
    shopName: 'Parth Mobile Care',
    tagline: 'Test Store',
    shopAddress: 'Surat',
    phone: '9876543210',
    alternatePhone: '9876543211',
    email: 'test@parth.com',
    gstNumber: '24ABCDE1234F1Z5',
    latitude: 21.1702,
    longitude: 72.8311,
    allowedRadiusMeters: 30,
    openingTime: '00:00', // Open all day for deterministic test execution
    closingTime: '23:59',
  };

  const mockUser: User = {
    id: 'test_emp_001',
    name: 'Test Staff',
    email: 'staff@parth.com',
    phone: '9876543210',
    role: 'staff',
    designation: 'Technician',
    joinedDate: '2024-01-01',
    basicSalary: 25000,
    monthlyTarget: 200000,
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('blocks Punch In when outside the 30m allowed radius', async () => {
    const farAwayCoords = { latitude: 21.1800, longitude: 72.8400 }; // ~1.4 km away
    const token = FaceRecognitionService.generateVerificationToken(
      mockUser.id,
      'punch_in',
      0.95,
      0.98,
      ['blink', 'smile']
    );

    const result = await AttendanceService.punchIn(
      mockUser,
      mockShopConfig,
      farAwayCoords,
      token
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('You are too far from the shop. Please reach the shop location and refresh GPS.');
  });

  test('blocks Punch Out when outside the permitted radius', async () => {
    const farAwayCoords = { latitude: 21.1800, longitude: 72.8400 };
    const token = FaceRecognitionService.generateVerificationToken(
      mockUser.id,
      'punch_out',
      0.95,
      0.98,
      ['blink', 'smile']
    );

    // Mock that user had punched in
    jest.spyOn(StorageService, 'getAttendanceRecords').mockResolvedValueOnce([
      {
        id: 'att_test_emp_001_today',
        userId: mockUser.id,
        userName: mockUser.name,
        userRole: mockUser.role,
        date: getTodayDateString(),
        punchInTime: '10:00:00',
        status: 'present',
        totalHours: 0,
        isLate: false,
        isEarlyExit: false,
      },
    ]);

    const result = await AttendanceService.punchOut(
      mockUser,
      mockShopConfig,
      farAwayCoords,
      token
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('You are too far from the shop. Please reach the shop location and refresh GPS.');
  });

  test('blocks Punch Out without a prior Punch In', async () => {
    jest.spyOn(StorageService, 'getAttendanceRecords').mockResolvedValueOnce([]);

    const shopCoords = { latitude: 21.1702, longitude: 72.8311 };
    const token = FaceRecognitionService.generateVerificationToken(
      mockUser.id,
      'punch_out',
      0.95,
      0.98,
      ['blink', 'smile']
    );

    const result = await AttendanceService.punchOut(
      mockUser,
      mockShopConfig,
      shopCoords,
      token
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('No Punch In record found for today');
  });

  test('blocks duplicate Punch In on the same date', async () => {
    const today = getTodayDateString();
    jest.spyOn(StorageService, 'getAttendanceRecords').mockResolvedValueOnce([
      {
        id: `att_${mockUser.id}_${today}`,
        userId: mockUser.id,
        userName: mockUser.name,
        userRole: mockUser.role,
        date: today,
        punchInTime: '10:05:00',
        status: 'present',
        totalHours: 0,
        isLate: false,
        isEarlyExit: false,
      },
    ]);

    const shopCoords = { latitude: 21.1702, longitude: 72.8311 };
    const token = FaceRecognitionService.generateVerificationToken(
      mockUser.id,
      'punch_in',
      0.95,
      0.98,
      ['blink', 'smile']
    );

    const result = await AttendanceService.punchIn(
      mockUser,
      mockShopConfig,
      shopCoords,
      token
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain('already punched in today');
  });
});
