import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { FaceRecognitionService } from '../src/services/faceRecognitionService';
import { StorageService } from '../src/services/storageService';
import { LocationService } from '../src/services/locationService';
import { User, ShopConfig, GeoPoint } from '../src/types';
import { AttendanceScreen } from '../src/screens/AttendanceScreen';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'test_staff_uid_1' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
    getFunctions: jest.fn(() => ({})),
  },
}));

const mockConfig: ShopConfig = {
  latitude: 23.032588,
  longitude: 72.861115,
  allowedRadiusMeters: 30,
  shopName: 'Parth Mobile Care',
  tagline: 'Trusted Mobile Repair & Sales',
  shopAddress: 'Ahmedabad, Gujarat',
  phone: '9824018382',
  alternatePhone: '9824018382',
  email: 'parthmobilecare07@gmail.com',
  gstNumber: '24ABCDE1234F1Z5',
  openingTime: '10:00',
  closingTime: '21:00',
};

let mockShopConfig = { ...mockConfig };

jest.mock('../src/context/ShopConfigContext', () => ({
  useShopConfig: () => ({
    config: mockShopConfig,
    updateConfig: jest.fn(),
    refreshConfig: jest.fn(),
  }),
}));

const mockUser: User = {
  id: 'test_staff_uid_1',
  name: 'Chetan Luhar',
  email: 'chetanluhar65@gmail.com',
  phone: '9824018382',
  role: 'staff',
  designation: 'Sales Executive',
  joinedDate: '2026-01-01',
  basicSalary: 20000,
  monthlyTarget: 200000,
  isActive: true,
  hasFaceRegistered: true,
  faceEnrollmentStatus: 'approved',
  createdAt: '2026-01-01',
};

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockUser,
    isAdmin: false,
    isManager: false,
    allUsers: [mockUser],
  }),
}));

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#194D9C',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#1E293B',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      borderLight: '#F1F5F9',
      danger: '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
      card: '#FFFFFF',
    },
    isDark: false,
  }),
}));

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockShowWarning = jest.fn();
const mockShowInfo = jest.fn();

jest.mock('../src/context/AlertContext', () => ({
  useAlert: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showWarning: mockShowWarning,
    showInfo: mockShowInfo,
  }),
}));

jest.mock('../src/services/deviceBindingService', () => ({
  DeviceBindingService: {
    checkDeviceStatus: jest.fn().mockResolvedValue({
      canPunch: true,
      status: 'APPROVED',
      isAuthorized: true,
      message: 'This device is authorized for attendance.',
    }),
  },
}));

jest.mock('../src/services/attendanceService', () => {
  const actual = jest.requireActual('../src/services/attendanceService');
  return {
    AttendanceService: {
      ...actual.AttendanceService,
      getCurrentPosition: jest.fn().mockResolvedValue({
        latitude: 23.032588,
        longitude: 72.861115,
        accuracy: 10,
        timestamp: Date.now(),
      }),
    },
  };
});

describe('Face Template Persistence & Simplified Geofence Acceptance Suite', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await StorageService.deleteFaceTemplate('test_staff_uid_1');
    await StorageService.deleteFaceTemplate('user_A');
    await StorageService.deleteFaceTemplate('user_B');
    await StorageService.deleteFaceTemplate('approved_staff_123');
    await StorageService.deleteFaceTemplate('approved_staff_456');
    await StorageService.deleteFaceTemplate('version_mismatch_user');
    await StorageService.deleteFaceTemplate('pending_user_789');
  });

  describe('Priority 1: Face Template Persistence & Read-Back Verification', () => {
    it('1. Persists face template with immediate read-back verification under correct user ID', async () => {
      const res = await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: 'test_staff_uid_1',
        userName: 'Chetan Luhar',
        registeredBy: 'test_staff_uid_1',
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'pending',
      });

      expect(res.success).toBe(true);
      expect(res.template).toBeDefined();
      expect(res.template?.userId).toBe('test_staff_uid_1');

      // Verify template can be immediately read back
      const readBack = await StorageService.getFaceTemplate('test_staff_uid_1');
      expect(readBack).not.toBeNull();
      expect(readBack?.userId).toBe('test_staff_uid_1');
      expect(readBack?.approvalStatus).toBe('pending');
    });

    it('2. Enforces strict isolation: User A cannot retrieve User B template', async () => {
      await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: 'user_A',
        userName: 'User A',
        registeredBy: 'user_A',
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'pending',
      });

      const userBTemplate = await StorageService.getFaceTemplate('user_B');
      expect(userBTemplate).toBeNull();
    });

    it('3. Detects APPROVED_BUT_TEMPLATE_MISSING when cloud profile is approved but local template is absent', async () => {
      const approvedUser: User = {
        ...mockUser,
        id: 'approved_staff_123',
        name: 'Approved Staff',
        email: 'staff@example.com',
        hasFaceRegistered: true,
        faceEnrollmentStatus: 'approved',
      };

      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(approvedUser);
      expect(status.canVerify).toBe(false);
      expect(status.state).toBe('ENROLLMENT_DATA_MISSING');
      expect(status.detailedState).toBe('APPROVED_BUT_TEMPLATE_MISSING');
      expect(status.recoveryAction).toBe('re_enroll_on_device');
    });

    it('4. Re-enrollment workflow keeps newly enrolled template pending until Admin approval', async () => {
      const approvedUser: User = {
        ...mockUser,
        id: 'approved_staff_456',
        name: 'Approved Staff',
        email: 'staff456@example.com',
        hasFaceRegistered: true,
        faceEnrollmentStatus: 'approved',
      };

      const reEnrollResult = await FaceRecognitionService.reEnrollFaceOnDevice({
        userId: approvedUser.id,
        userName: approvedUser.name,
        samples: ['sample_frame_1', 'sample_frame_2', 'sample_frame_3'],
      });

      expect(reEnrollResult.success).toBe(true);
      expect(reEnrollResult.template?.approvalStatus).toBe('pending');

      // Before Admin authorization: status must be ENROLLMENT_PENDING_REVIEW / ENROLLMENT_PENDING
      const statusPending = await FaceRecognitionService.getBiometricEnrollmentStatus(approvedUser);
      expect(statusPending.canVerify).toBe(false);
      expect(statusPending.state).toBe('ENROLLMENT_PENDING_REVIEW');
      expect(statusPending.detailedState).toBe('ENROLLMENT_PENDING');

      // Admin approves the face enrollment
      const approveResult = await FaceRecognitionService.approveEnrollment({
        userId: approvedUser.id,
        adminId: 'admin_1',
        adminName: 'Parth',
      });
      expect(approveResult.success).toBe(true);
      expect(approveResult.template?.approvalStatus).toBe('approved');

      // After Admin approval: status check returns ENROLLED_AND_READY / READY_FOR_VERIFICATION
      const approvedStaffProfile: User = {
        ...approvedUser,
        faceEnrollmentStatus: 'approved',
        hasFaceRegistered: true,
        faceApprovedAt: new Date().toISOString(),
        faceApprovedBy: 'Parth',
      };
      const statusAfter = await FaceRecognitionService.getBiometricEnrollmentStatus(approvedStaffProfile);
      expect(statusAfter.canVerify).toBe(true);
      expect(statusAfter.state).toBe('ENROLLED_AND_READY');
      expect(statusAfter.detailedState).toBe('READY_FOR_VERIFICATION');
    });

    it('5. Detects VERSION_MISMATCH when template model version differs', async () => {
      const user: User = {
        ...mockUser,
        id: 'version_mismatch_user',
        name: 'Version User',
        email: 'version@example.com',
        hasFaceRegistered: true,
        faceEnrollmentStatus: 'approved',
        faceModelVersion: 'legacy_v1_128',
      };

      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(user);
      expect(status.canVerify).toBe(false);
      expect(status.state).toBe('ENROLLMENT_VERSION_MISMATCH');
      expect(status.detailedState).toBe('VERSION_MISMATCH');
      expect(status.recoveryAction).toBe('re_enroll_on_device');
    });

    it('6. Detects ENROLLMENT_PENDING when staff submitted enrollment but admin review is pending', async () => {
      await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: 'pending_user_789',
        userName: 'Pending User',
        registeredBy: 'pending_user_789',
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'pending',
      });

      const pendingUser: User = {
        ...mockUser,
        id: 'pending_user_789',
        name: 'Pending User',
        email: 'pending@example.com',
        hasFaceRegistered: false,
        faceEnrollmentStatus: 'pending_approval',
      };

      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(pendingUser);
      expect(status.canVerify).toBe(false);
      expect(status.state).toBe('ENROLLMENT_PENDING_REVIEW');
      expect(status.detailedState).toBe('ENROLLMENT_PENDING');
    });
  });

  describe('Priority 2: Simplified Geofence UI & Dynamic Configuration', () => {
    it('7. Displays simple green status when inside shop area with exact dynamic distance', () => {
      const shopCoords: GeoPoint = { latitude: 23.032588, longitude: 72.861115 };
      const userInside: GeoPoint = { latitude: 23.032600, longitude: 72.861120, accuracy: 12 };

      const state = LocationService.evaluateLocationState(
        userInside,
        shopCoords,
        30,
        false,
        null,
        60
      );

      expect(state.status).toBe('INSIDE_GEOFENCE');
      expect(state.isInside).toBe(true);
      expect(state.canPunch).toBe(true);
      expect(state.distanceMeters).toBeLessThanOrEqual(30);
    });

    it('8. Displays amber status when outside shop area with distance beyond allowed radius', () => {
      const shopCoords: GeoPoint = { latitude: 23.032588, longitude: 72.861115 };
      // ~80m away
      const userOutside: GeoPoint = { latitude: 23.033300, longitude: 72.861115, accuracy: 15 };

      const state = LocationService.evaluateLocationState(
        userOutside,
        shopCoords,
        30,
        false,
        null,
        60
      );

      expect(state.status).toBe('OUTSIDE_GEOFENCE');
      expect(state.isInside).toBe(false);
      expect(state.canPunch).toBe(false);
      expect(state.distanceMeters).toBeGreaterThan(30);

      const distanceBeyond = Math.max(0, Math.round((state.distanceMeters || 0) - 30));
      expect(distanceBeyond).toBeGreaterThan(0);
    });

    it('9. Adapts dynamically when Admin changes allowed radius in Shop Configuration', () => {
      const shopCoords: GeoPoint = { latitude: 23.032588, longitude: 72.861115 };
      const userAt50m: GeoPoint = { latitude: 23.033000, longitude: 72.861115, accuracy: 15 };

      // With default 30m radius, user is outside
      const state30m = LocationService.evaluateLocationState(userAt50m, shopCoords, 30, false, null);
      expect(state30m.status).toBe('OUTSIDE_GEOFENCE');
      expect(state30m.canPunch).toBe(false);

      // When admin changes allowed radius to 100m, user is inside
      const state100m = LocationService.evaluateLocationState(userAt50m, shopCoords, 100, false, null);
      expect(state100m.status).toBe('INSIDE_GEOFENCE');
      expect(state100m.canPunch).toBe(true);
    });

    it('10. Blocks attendance and indicates weak GPS signal when accuracy exceeds threshold', () => {
      const shopCoords: GeoPoint = { latitude: 23.032588, longitude: 72.861115 };
      const weakGpsInside: GeoPoint = { latitude: 23.032588, longitude: 72.861115, accuracy: 95 };

      const state = LocationService.evaluateLocationState(
        weakGpsInside,
        shopCoords,
        30,
        false,
        null,
        60
      );

      expect(state.status).toBe('LOW_ACCURACY');
      expect(state.canPunch).toBe(false);
      expect(state.message).toContain('GPS signal is weak');
    });

    it('11. Evaluates LOCATING state during location acquisition', () => {
      const shopCoords: GeoPoint = { latitude: 23.032588, longitude: 72.861115 };
      const state = LocationService.evaluateLocationState(null, shopCoords, 30, true, null);

      expect(state.status).toBe('LOCATING');
      expect(state.canPunch).toBe(false);
    });

    it('12. Evaluates PERMISSION_DENIED state when location permission is refused', () => {
      const shopCoords: GeoPoint = { latitude: 23.032588, longitude: 72.861115 };
      const state = LocationService.evaluateLocationState(
        null,
        shopCoords,
        30,
        false,
        'Location permission denied by user'
      );

      expect(state.status).toBe('PERMISSION_DENIED');
      expect(state.canPunch).toBe(false);
    });

    it('13. Evaluates LOCATION_DISABLED state when device GPS is turned off', () => {
      const shopCoords: GeoPoint = { latitude: 23.032588, longitude: 72.861115 };
      const state = LocationService.evaluateLocationState(
        null,
        shopCoords,
        30,
        false,
        'Device location is turned off or disabled'
      );

      expect(state.status).toBe('LOCATION_DISABLED');
      expect(state.canPunch).toBe(false);
    });

    it('14. Renders AttendanceScreen with collapsed technical details and simple status', async () => {
      let renderer: any;
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(<AttendanceScreen />);
      });

      const root = renderer.root;
      // Confirm "Shop Location Status" is rendered
      const texts = root.findAll((node: any) => node.props && typeof node.props.children === 'string');
      const textContents = texts.map((t: any) => t.props.children);

      expect(textContents.some((t: string) => t.includes('Shop Location Status'))).toBe(true);
      expect(textContents.some((t: string) => t.includes('Technical Details'))).toBe(true);
      expect(textContents.some((t: string) => t.includes('TODAY\'S STATUS'))).toBe(true);
    });
  });
});
