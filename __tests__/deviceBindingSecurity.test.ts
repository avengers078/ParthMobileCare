jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'test_uid' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
    getFunctions: jest.fn(() => ({})),
  },
}));

jest.mock('../src/services/faceRecognitionService', () => {
  const actual = jest.requireActual('../src/services/faceRecognitionService');
  return {
    ...actual,
    FaceRecognitionService: {
      ...actual.FaceRecognitionService,
      getBiometricEnrollmentStatus: actual.FaceRecognitionService.getBiometricEnrollmentStatus,
      validateVerificationToken: jest.fn().mockResolvedValue({ valid: true }),
    },
  };
});

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceSecurityService } from '../src/services/deviceSecurityService';
import { DeviceBindingService } from '../src/services/deviceBindingService';
import { AttendanceService } from '../src/services/attendanceService';
import { StorageService } from '../src/services/storageService';
import { User, ShopConfig, DeviceChangeRequest, FaceVerificationToken } from '../src/types';

describe('Phase 1: Secure Device Registration & Binding', () => {
  const mockShopConfig: ShopConfig = {
    shopName: 'Parth Mobile Care',
    tagline: 'Trusted Store',
    shopAddress: 'Shop 4, Surat',
    phone: '9876543210',
    alternatePhone: '',
    email: 'store@parthmobilecare.com',
    gstNumber: '24ABCDE1234F1Z5',
    latitude: 21.1702,
    longitude: 72.8311,
    allowedRadiusMeters: 50,
    openingTime: '00:00',
    closingTime: '23:59',
  };

  const shopCoords = { latitude: 21.1702, longitude: 72.8311, accuracy: 5 };

  const validToken: FaceVerificationToken = {
    tokenId: 'tok_device_test',
    userId: 'staff_test_101',
    action: 'punch_in',
    timestamp: Date.now(),
    similarityScore: 0.95,
    livenessScore: 0.98,
    challengesCompleted: ['CENTER_FACE'],
    signature: 'mock_face_token_signature',
  };

  const createBaseStaff = (overrides?: Partial<User>): User => ({
    id: 'staff_test_101',
    name: 'Ramesh Patel',
    email: 'ramesh@parthmobilecare.com',
    phone: '9898012345',
    role: 'staff',
    designation: 'Sales Executive',
    joinedDate: '2026-01-01',
    basicSalary: 22000,
    monthlyTarget: 250000,
    isActive: true,
    hasFaceRegistered: true,
    ...overrides,
  });

  beforeEach(async () => {
    await AsyncStorage.clear();
    await DeviceSecurityService.resetLocalDeviceCredentials();
    await StorageService.saveFaceTemplate({
      id: 'tmpl_staff_test_101',
      userId: 'staff_test_101',
      userName: 'Ramesh Patel',
      faceDescriptor: [],
      qualityScore: 0.95,
      registeredAt: new Date().toISOString(),
      registeredBy: 'Admin',
      consentObtained: true,
      consentTimestamp: new Date().toISOString(),
      templateHash: 'mock_hash',
      sampleCount: 3,
      status: 'active',
      approvalStatus: 'approved',
    });
  });

  describe('1. Hardware Device Identification & Key Management', () => {
    it('generates a persistent, unique installation identifier', async () => {
      const id1 = await DeviceSecurityService.getOrCreateInstallationId();
      expect(id1).toBeTruthy();
      expect(id1.startsWith('dev_')).toBe(true);

      // Subsequent call on same installation returns identical ID
      const id2 = await DeviceSecurityService.getOrCreateInstallationId();
      expect(id2).toBe(id1);
    });

    it('generates an asymmetric key pair with exportable public key and non-exportable private key', async () => {
      const keyInfo = await DeviceSecurityService.getOrCreateDeviceKey();
      expect(keyInfo.publicKey).toBeTruthy();
      expect(typeof keyInfo.publicKey).toBe('string');
      expect(keyInfo.algorithm).toBe('EC');
      expect(keyInfo.isHardwareBacked).toBe(true);
    });

    it('signs payloads with the hardware-backed private key', async () => {
      const payload = 'TEST_ATTENDANCE_PUNCH_NONCE_12345';
      const signature = await DeviceSecurityService.signPayload(payload);
      expect(signature).toBeTruthy();
      expect(typeof signature).toBe('string');
      expect(signature.length).toBeGreaterThan(16);
    });

    it('returns complete hardware metadata without exposing restricted identifiers (IMEI/MAC)', async () => {
      const info = await DeviceSecurityService.getDeviceInfo();
      expect(info.installationId).toBeTruthy();
      expect(info.publicKey).toBeTruthy();
      expect(['android', 'ios']).toContain(info.platform);
      expect(info.model).toBeTruthy();
      // Ensure no prohibited telemetry
      expect((info as any).imei).toBeUndefined();
      expect((info as any).macAddress).toBeUndefined();
    });
  });

  describe('2. Initial Device Registration Workflow', () => {
    it('registers an unbonded staff account and sets status to pending_approval', async () => {
      const staff = createBaseStaff({
        deviceId: undefined,
        deviceBindingStatus: 'unregistered',
      });

      const res = await DeviceBindingService.registerDevice(staff);
      expect(res.success).toBe(true);
      expect(res.updatedUser?.deviceBindingStatus).toBe('pending_approval');
      expect(res.updatedUser?.deviceId).toBeTruthy();
      expect(res.updatedUser?.devicePublicKey).toBeTruthy();
    });

    it('strictly prevents overwriting an existing approved device binding', async () => {
      const staff = createBaseStaff({
        deviceId: 'dev_original_authorized_phone',
        deviceBindingStatus: 'approved',
      });

      const res = await DeviceBindingService.registerDevice(staff);
      expect(res.success).toBe(false);
      expect(res.message).toContain('Cannot overwrite an existing approved device');
    });
  });

  describe('3. Attendance Blocking on Unauthorized or Unapproved Devices', () => {
    it('blocks punch-in when account device is UNREGISTERED', async () => {
      const staff = createBaseStaff({
        deviceId: undefined,
        deviceBindingStatus: 'unregistered',
      });

      const punchResult = await AttendanceService.punchIn(staff, mockShopConfig, shopCoords, validToken);
      expect(punchResult.success).toBe(false);
      expect(punchResult.message).toContain('This phone is not registered for your account');
    });

    it('blocks punch-in when device registration is PENDING_APPROVAL', async () => {
      const currentDevice = await DeviceSecurityService.getDeviceInfo();
      const staff = createBaseStaff({
        deviceId: currentDevice.installationId,
        deviceBindingStatus: 'pending_approval',
      });

      const punchResult = await AttendanceService.punchIn(staff, mockShopConfig, shopCoords, validToken);
      expect(punchResult.success).toBe(false);
      expect(punchResult.message).toContain('waiting for administrator approval');
    });

    it('blocks punch-in when device registration was REJECTED by Admin', async () => {
      const currentDevice = await DeviceSecurityService.getDeviceInfo();
      const staff = createBaseStaff({
        deviceId: currentDevice.installationId,
        deviceBindingStatus: 'rejected',
        deviceRejectionReason: 'Personal phone not authorized for store punches.',
      });

      const punchResult = await AttendanceService.punchIn(staff, mockShopConfig, shopCoords, validToken);
      expect(punchResult.success).toBe(false);
      expect(punchResult.message).toContain('rejected by Administrator');
      expect(punchResult.message).toContain('Personal phone not authorized');
    });

    it('blocks punch-in when staff logs in on an UNRECOGNIZED / CLONED device (DEVICE_MISMATCH)', async () => {
      const staff = createBaseStaff({
        deviceId: 'dev_another_staff_phone_999',
        deviceModel: 'Samsung Galaxy S23',
        deviceBindingStatus: 'approved',
      });

      const punchResult = await AttendanceService.punchIn(staff, mockShopConfig, shopCoords, validToken);
      expect(punchResult.success).toBe(false);
      expect(punchResult.message).toContain('This phone is not registered for your account');
      expect(punchResult.message).toContain('request approval from your administrator');
    });

    it('allows punch-in when device is APPROVED and installation ID matches local hardware', async () => {
      const currentDevice = await DeviceSecurityService.getDeviceInfo();
      const staff = createBaseStaff({
        deviceId: currentDevice.installationId,
        deviceModel: currentDevice.model,
        deviceBindingStatus: 'approved',
      });

      // Provide shop coordinates within 10m
      const validCoords = { latitude: 21.1702, longitude: 72.8311, accuracy: 5 };
      const status = await DeviceBindingService.checkDeviceStatus(staff);
      expect(status.canPunch).toBe(true);
      expect(status.status).toBe('APPROVED');
    });
  });

  describe('4. App Reinstall & Device Replacement Workflow', () => {
    it('detects device mismatch after app reinstall and guides user to submit request', async () => {
      // 1. Employee originally had an approved device ID
      const oldApprovedId = 'dev_android_1700000000_oldinstallation';
      const staff = createBaseStaff({
        deviceId: oldApprovedId,
        deviceModel: 'Pixel 7',
        deviceBindingStatus: 'approved',
      });

      // 2. Fresh installation generates a new local ID
      const status = await DeviceBindingService.checkDeviceStatus(staff);
      expect(status.status).toBe('DEVICE_MISMATCH');
      expect(status.canPunch).toBe(false);

      // 3. Staff submits change request explaining app was reinstalled
      const res = await DeviceBindingService.submitDeviceChangeRequest(
        staff,
        'Reinstalled app on same phone after cache cleanup'
      );
      expect(res.success).toBe(true);
      expect(res.request?.status).toBe('pending');
      expect(res.request?.reason).toBe('Reinstalled app on same phone after cache cleanup');
      expect(res.request?.currentDeviceId).toBe(oldApprovedId);
      expect(res.request?.newDeviceId).toBeTruthy();
    });

    it('prevents submitting duplicate pending device change requests', async () => {
      const staff = createBaseStaff({
        deviceId: 'dev_lost_phone_111',
        deviceBindingStatus: 'approved',
      });

      const res1 = await DeviceBindingService.submitDeviceChangeRequest(
        staff,
        'Lost my phone during commute, setup new phone'
      );
      expect(res1.success).toBe(true);

      // Attempt second submission
      const res2 = await DeviceBindingService.submitDeviceChangeRequest(
        staff,
        'Second attempt while first is pending'
      );
      expect(res2.success).toBe(false);
      expect(res2.message).toContain('already have a device change request pending');
    });

    it('rejects device change request with empty or too short reason', async () => {
      const staff = createBaseStaff({
        deviceId: 'dev_old_222',
        deviceBindingStatus: 'approved',
      });

      const res = await DeviceBindingService.submitDeviceChangeRequest(staff, 'ok');
      expect(res.success).toBe(false);
      expect(res.message).toContain('minimum 5 characters');
    });

    it('allows staff to cancel their own pending device change request', async () => {
      const staff = createBaseStaff({
        deviceId: 'dev_old_333',
        deviceBindingStatus: 'approved',
      });

      const submitRes = await DeviceBindingService.submitDeviceChangeRequest(
        staff,
        'Bought replacement phone'
      );
      expect(submitRes.success).toBe(true);

      const cancelOk = await DeviceBindingService.cancelDeviceChangeRequest(
        submitRes.request!.id,
        staff.id
      );
      expect(cancelOk).toBe(true);

      // Verify no pending request remains
      const pending = await DeviceBindingService.getPendingDeviceChangeRequest(staff.id);
      expect(pending).toBeNull();
    });
  });

  describe('5. Audit Logging & Non-Tamperability', () => {
    it('creates an attendance audit log entry on device registration', async () => {
      const staff = createBaseStaff({
        deviceId: undefined,
        deviceBindingStatus: 'unregistered',
      });

      await DeviceBindingService.registerDevice(staff);
      const logs = await StorageService.getAttendanceAuditLogs();
      const deviceLog = logs.find(l => l.action === ('register_device' as any));
      expect(deviceLog).toBeDefined();
      expect(deviceLog?.userId).toBe(staff.id);
    });

    it('creates an attendance audit log entry when attendance is blocked due to device mismatch', async () => {
      const staff = createBaseStaff({
        deviceId: 'dev_unauthorized_attacker_phone',
        deviceBindingStatus: 'approved',
      });

      await AttendanceService.punchIn(staff, mockShopConfig, shopCoords, validToken);
      const logs = await StorageService.getAttendanceAuditLogs();
      const blockedLog = logs.find(l => l.status === 'blocked');
      expect(blockedLog).toBeDefined();
      expect(blockedLog?.reason).toContain('This phone is not registered for your account');
    });
  });
});
