jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'pLQ1C2qPcnbkr6NWJeB2LMHmtCy2' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
}));

import { FaceRecognitionService } from '../src/services/faceRecognitionService';
import { StorageService } from '../src/services/storageService';
import { CloudinaryService } from '../src/services/cloudinaryService';
import { AttendanceService } from '../src/services/attendanceService';
import { DeviceBindingService } from '../src/services/deviceBindingService';
import { User, ShopConfig, AttendanceRecord } from '../src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock DeviceBindingService
jest.mock('../src/services/deviceBindingService', () => ({
  DeviceBindingService: {
    checkDeviceStatus: jest.fn().mockResolvedValue({
      canPunch: true,
      status: 'APPROVED',
      currentDeviceId: 'hardware_dev_chetan_123',
    }),
  },
}));

describe('PARTH MOBILE CARE — PERMANENT FACE ENROLLMENT & CLOUDINARY STORAGE AUDIT', () => {
  const CHETAN_UID = 'pLQ1C2qPcnbkr6NWJeB2LMHmtCy2';

  const mockShopConfig: ShopConfig = {
    shopName: 'Parth Mobile Care',
    tagline: 'Best Mobile Repair Shop',
    shopAddress: 'Shop 4, City Center, Main Road',
    phone: '9876543210',
    alternatePhone: '9876543211',
    email: 'info@parthmobilecare.com',
    gstNumber: '24ABCDE1234F1Z5',
    latitude: 23.032588,
    longitude: 72.861115,
    allowedRadiusMeters: 50,
    openingTime: '00:00',
    closingTime: '23:59',
  };

  const approvedChetanUser: User = {
    id: CHETAN_UID,
    name: 'Chetan Luhar',
    email: 'chetan@parthmobilecare.com',
    phone: '9876543210',
    role: 'staff',
    designation: 'Senior Technician',
    joinedDate: '2026-10-15',
    basicSalary: 25000,
    monthlyTarget: 300000,
    isActive: true,
    registrationStatus: 'approved',
    hasFaceRegistered: true,
    faceEnrollmentStatus: 'approved',
    faceApprovedAt: '2026-10-16T10:00:00.000Z',
    faceApprovedBy: 'Admin Parth',
    deviceBindingStatus: 'approved',
    deviceId: 'hardware_dev_chetan_123',
    faceModelVersion: 'facenet_512',
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('1. Five Canonical Biometric Enrollment Lifecycle States', () => {
    it('evaluates state 1: NOT_ENROLLED when user has never registered face biometrics', async () => {
      const freshUser: User = {
        id: 'new_staff_001',
        name: 'New Staff',
        email: 'new@example.com',
        phone: '9876543211',
        role: 'staff',
        designation: 'Sales Executive',
        joinedDate: '2026-11-01',
        basicSalary: 20000,
        monthlyTarget: 200000,
        isActive: false,
        registrationStatus: 'pending',
        hasFaceRegistered: false,
        faceEnrollmentStatus: 'not_enrolled',
      };

      const result = await FaceRecognitionService.getBiometricEnrollmentStatus(freshUser);
      expect(result.lifecycleState).toBe('NOT_ENROLLED');
      expect(result.state).toBe('NOT_ENROLLED');
      expect(result.canVerify).toBe(false);
    });

    it('evaluates state 2: ENROLLMENT_PENDING when registration samples submitted awaiting Admin review', async () => {
      const pendingStaff: User = {
        ...approvedChetanUser,
        id: 'applicant_999',
        registrationStatus: 'pending',
        hasFaceRegistered: false,
        faceEnrollmentStatus: 'pending_approval',
      };

      const result = await FaceRecognitionService.getBiometricEnrollmentStatus(pendingStaff);
      expect(result.lifecycleState).toBe('ENROLLMENT_PENDING');
      expect(result.canVerify).toBe(false);
      expect(result.message).toContain('pending Administrator approval');
    });

    it('evaluates state 3: APPROVED_TEMPLATE_AVAILABLE when cloud is approved and local template exists', async () => {
      // Seed user and local template
      await StorageService.saveUser(approvedChetanUser);
      await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: CHETAN_UID,
        userName: approvedChetanUser.name,
        registeredBy: CHETAN_UID,
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'approved',
        approvedAt: approvedChetanUser.faceApprovedAt,
        approvedByAdminName: approvedChetanUser.faceApprovedBy,
      });

      const result = await FaceRecognitionService.getBiometricEnrollmentStatus(approvedChetanUser);
      expect(result.lifecycleState).toBe('APPROVED_TEMPLATE_AVAILABLE');
      expect(result.canVerify).toBe(true);
      expect(result.template).toBeDefined();
      expect(result.template?.userId).toBe(CHETAN_UID);
    });

    it('evaluates state 4: APPROVED_TEMPLATE_MISSING when cloud is approved but APK reinstalled without local data', async () => {
      // Simulate clean reinstall: user is approved in Firestore, but AsyncStorage has NO face template
      const result = await FaceRecognitionService.getBiometricEnrollmentStatus(approvedChetanUser);
      expect(result.lifecycleState).toBe('APPROVED_TEMPLATE_MISSING');
      expect(result.state).toBe('ENROLLMENT_DATA_MISSING');
      expect(result.detailedState).toBe('APPROVED_BUT_TEMPLATE_MISSING');
      expect(result.canVerify).toBe(false);
      expect(result.recoveryAction).toBe('re_enroll_on_device');
      expect(result.message).toContain('Face Setup Required on This Phone');
    });

    it('evaluates state 5: REJECTED when admin explicitly rejected face enrollment', async () => {
      const rejectedUser: User = {
        ...approvedChetanUser,
        faceEnrollmentStatus: 'rejected',
        faceRejectionReason: 'Face image was obstructed by sunglasses and dark lighting.',
      };

      const result = await FaceRecognitionService.getBiometricEnrollmentStatus(rejectedUser);
      expect(result.lifecycleState).toBe('REJECTED');
      expect(result.canVerify).toBe(false);
      expect(result.rejectionReason).toBe('Face image was obstructed by sunglasses and dark lighting.');
    });
  });

  describe('2. Persistence Across Update, Restart, and Uninstall/Reinstall Recovery', () => {
    it('preserves face enrollment across app restarts and updates without data loss', async () => {
      await StorageService.saveUser(approvedChetanUser);
      const regRes = await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: CHETAN_UID,
        userName: approvedChetanUser.name,
        registeredBy: CHETAN_UID,
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'approved',
        approvedAt: approvedChetanUser.faceApprovedAt,
      });
      expect(regRes.success).toBe(true);

      // App restart: read back template from storage
      const reloadedTemplate = await StorageService.getFaceTemplate(CHETAN_UID);
      expect(reloadedTemplate).not.toBeNull();
      expect(reloadedTemplate?.userId).toBe(CHETAN_UID);
      expect(reloadedTemplate?.approvalStatus).toBe('approved');

      // Status check continues to be ready
      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(approvedChetanUser);
      expect(status.lifecycleState).toBe('APPROVED_TEMPLATE_AVAILABLE');
      expect(status.canVerify).toBe(true);
    });

    it('ensures stale local pending metadata NEVER overwrites Firestore cloud approval', async () => {
      await StorageService.saveUser(approvedChetanUser);

      // Simulate an old local template that was saved with status 'pending' before admin approved in cloud
      const staleTemplate = {
        id: `tmpl_${CHETAN_UID}_stale`,
        userId: CHETAN_UID,
        userName: approvedChetanUser.name,
        faceDescriptor: [],
        qualityScore: 0.95,
        registeredAt: '2026-10-15T09:00:00Z',
        registeredBy: CHETAN_UID,
        consentObtained: true,
        consentTimestamp: '2026-10-15T09:00:00Z',
        templateHash: 'hash123',
        sampleCount: 3,
        status: 'active' as const,
        approvalStatus: 'pending' as const,
        deviceInfo: { platform: 'android', model: 'Android Client', appVersion: '1.0.0', enrolledAt: '2026-10-15' },
      };

      // StorageService.saveFaceTemplate must synchronize with Firestore and reconcile stale pending
      await StorageService.saveFaceTemplate(staleTemplate);

      const reconciledTemplate = await StorageService.getFaceTemplate(CHETAN_UID);
      expect(reconciledTemplate?.approvalStatus).toBe('approved');

      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(approvedChetanUser);
      expect(status.lifecycleState).toBe('APPROVED_TEMPLATE_AVAILABLE');
      expect(status.canVerify).toBe(true);
    });

    it('requires Admin review for recovered face template and blocks punch in until approved', async () => {
      // Chetan uninstalled and reinstalled: Firestore profile is approved, but local store is empty
      const preCheck = await FaceRecognitionService.getBiometricEnrollmentStatus(approvedChetanUser);
      expect(preCheck.lifecycleState).toBe('APPROVED_TEMPLATE_MISSING');
      expect(preCheck.canVerify).toBe(false);

      // Chetan performs recovery on his device (captures 3 new samples)
      const recoveryResult = await FaceRecognitionService.recoverApprovedFaceTemplateOnDevice({
        user: approvedChetanUser,
        samples: ['live_sample_frame_1', 'live_sample_frame_2', 'live_sample_frame_3'],
      });

      expect(recoveryResult.success).toBe(true);
      expect(recoveryResult.template?.userId).toBe(CHETAN_UID);
      expect(recoveryResult.template?.approvalStatus).toBe('pending_recovery');
      expect(recoveryResult.template?.sampleCount).toBe(3);

      // After recovery: template is in pending_recovery! Punch In is BLOCKED until Admin verifies.
      const postCheck = await FaceRecognitionService.getBiometricEnrollmentStatus(approvedChetanUser);
      expect(postCheck.lifecycleState).toBe('ENROLLMENT_PENDING');
      expect(postCheck.detailedState).toBe('RECOVERY_PENDING');
      expect(postCheck.canVerify).toBe(false);

      // Admin reviews and approves the recovery:
      const adminApprovalTime = new Date(Date.now() + 5000).toISOString();
      const adminApprovedUser: User = {
        ...approvedChetanUser,
        faceEnrollmentStatus: 'approved',
        faceApprovedAt: adminApprovalTime,
        faceApprovedBy: 'Admin Parth',
      };
      await StorageService.saveUser(adminApprovedUser);

      // Now biometric verification is unlocked!
      const afterApproval = await FaceRecognitionService.getBiometricEnrollmentStatus(adminApprovedUser);
      expect(afterApproval.lifecycleState).toBe('APPROVED_TEMPLATE_AVAILABLE');
      expect(afterApproval.canVerify).toBe(true);
    });
  });

  describe('3. Mandatory Attendance Verification (1:1 Matching, UID check, Punch In/Out)', () => {
    beforeEach(async () => {
      await StorageService.saveUser(approvedChetanUser);
      await FaceRecognitionService.recoverApprovedFaceTemplateOnDevice({
        user: approvedChetanUser,
        samples: ['frame_a', 'frame_b', 'frame_c'],
      });
      // Simulate Admin approving the recovery so attendance tests can test 1:1 match
      const approvalTime = new Date(Date.now() + 1000).toISOString();
      await StorageService.saveUser({
        ...approvedChetanUser,
        faceEnrollmentStatus: 'approved',
        faceApprovedAt: approvalTime,
        faceApprovedBy: 'Admin Parth',
      });
    });

    it('generates cryptographic token and completes Punch In with 1:1 match and liveness', async () => {
      const matchScore = 0.94;
      const livenessScore = 0.91;

      const token = FaceRecognitionService.generateVerificationToken(
        CHETAN_UID,
        'punch_in',
        matchScore,
        livenessScore,
        ['ON_DEVICE_FACE_MATCH', 'ACTIVE_LIVENESS_CHALLENGE']
      );

      expect(token.userId).toBe(CHETAN_UID);
      expect(token.action).toBe('punch_in');
      expect(token.similarityScore).toBe(0.94);
      expect(token.livenessScore).toBe(0.91);

      // Validate token
      const tokenCheck = await FaceRecognitionService.validateVerificationToken(token, CHETAN_UID, 'punch_in');
      expect(tokenCheck.valid).toBe(true);

      // Perform Punch In
      const punchInResult = await AttendanceService.punchIn(
        approvedChetanUser,
        mockShopConfig,
        { latitude: 23.032588, longitude: 72.861115 },
        token
      );

      expect(punchInResult.success).toBe(true);
      expect(punchInResult.record?.userId).toBe(CHETAN_UID);
      expect(punchInResult.record?.verificationMethod).toBe('face_recognition');
      expect(punchInResult.record?.faceVerificationScore).toBe(0.94);
    });

    it('generates cryptographic token and completes Punch Out with 1:1 match and liveness', async () => {
      // First seed a punch in record
      const today = new Date().toISOString().slice(0, 10);
      const existingRecord: AttendanceRecord = {
        id: `att_${CHETAN_UID}_${today}`,
        userId: CHETAN_UID,
        userName: approvedChetanUser.name,
        userRole: 'staff',
        date: today,
        punchInTime: '2026-11-07T09:30:00Z',
        totalHours: 0,
        status: 'present',
        isLate: false,
        isEarlyExit: false,
        verificationMethod: 'face_recognition',
      };
      await StorageService.saveAttendanceRecord(existingRecord);

      // Token for Punch Out
      const token = FaceRecognitionService.generateVerificationToken(
        CHETAN_UID,
        'punch_out',
        0.92,
        0.88,
        ['ON_DEVICE_FACE_MATCH', 'ACTIVE_LIVENESS_CHALLENGE']
      );

      const punchOutResult = await AttendanceService.punchOut(
        approvedChetanUser,
        mockShopConfig,
        { latitude: 23.032588, longitude: 72.861115 },
        token
      );

      expect(punchOutResult.success).toBe(true);
      expect(punchOutResult.record?.punchOutTime).toBeDefined();
      expect(punchOutResult.record?.totalHours).toBeGreaterThanOrEqual(0);
    });

    it('rejects Punch In when candidate face belongs to another staff member (1:1 mismatch)', async () => {
      const OTHER_STAFF_UID = 'other_staff_789';

      // Token generated for a different person
      const fraudulentToken = FaceRecognitionService.generateVerificationToken(
        OTHER_STAFF_UID,
        'punch_in',
        0.95,
        0.90,
        ['ON_DEVICE_FACE_MATCH']
      );

      // Attempt punch in as Chetan Luhar using other person's token
      const tokenCheck = await FaceRecognitionService.validateVerificationToken(fraudulentToken, CHETAN_UID, 'punch_in');
      expect(tokenCheck.valid).toBe(false);
      expect(tokenCheck.reason).toContain('does not match');

      const punchInResult = await AttendanceService.punchIn(
        approvedChetanUser,
        mockShopConfig,
        { latitude: 23.032588, longitude: 72.861115 },
        fraudulentToken
      );

      expect(punchInResult.success).toBe(false);
      expect(punchInResult.message).toContain('does not match');
    });

    it('rejects verification when liveness score is below the threshold', async () => {
      const lowLivenessToken = FaceRecognitionService.generateVerificationToken(
        CHETAN_UID,
        'punch_in',
        0.95,
        0.40, // Below 0.82 threshold
        ['ON_DEVICE_FACE_MATCH']
      );

      const tokenCheck = await FaceRecognitionService.validateVerificationToken(lowLivenessToken, CHETAN_UID, 'punch_in');
      expect(tokenCheck.valid).toBe(false);
      expect(tokenCheck.reason).toContain('Liveness verification failed');
    });

    it('rejects verification when cosine similarity score is below the matching threshold', async () => {
      const lowMatchToken = FaceRecognitionService.generateVerificationToken(
        CHETAN_UID,
        'punch_in',
        0.65, // Below 0.80 threshold
        0.90,
        ['ON_DEVICE_FACE_MATCH']
      );

      const tokenCheck = await FaceRecognitionService.validateVerificationToken(lowMatchToken, CHETAN_UID, 'punch_in');
      expect(tokenCheck.valid).toBe(false);
      expect(tokenCheck.reason).toContain('Face matching confidence');
    });
  });

  describe('4. Cloudinary Service Security & Isolation From Biometrics', () => {
    it('strictly forbids uploading face samples, biometric templates, or embeddings to Cloudinary', async () => {
      // 1. Attempt upload with face keyword in payload
      const faceUpload = await CloudinaryService.uploadImage('data:image/jpeg;base64,face_embedding_raw_data', {
        folder: 'devices',
        tags: ['face_biometric_sample'],
      });
      expect(faceUpload.success).toBe(false);
      expect(faceUpload.error).toContain('Security Violation');

      // 2. Attempt upload with biometric embedding tags
      const embeddingUpload = await CloudinaryService.uploadImage('data:image/png;base64,sample_image', {
        tags: ['descriptor_vector_512'],
      });
      expect(embeddingUpload.success).toBe(false);
      expect(embeddingUpload.error).toContain('Security Violation');

      // 3. Attempt upload with sensitive Aadhaar / KYC documents
      const aadhaarUpload = await CloudinaryService.uploadImage('data:image/jpeg;base64,customer_aadhaar_card', {
        tags: ['customer_aadhaar_kyc'],
      });
      expect(aadhaarUpload.success).toBe(false);
      expect(aadhaarUpload.error).toContain('Security Violation');
    });

    it('never exposes Cloudinary API secret in mobile configuration and verifies new credentials are connected', () => {
      const config = CloudinaryService.getConfig();
      expect(config.cloudName).toBe('lbqtrrw5');
      expect(config.uploadPreset).toBe('pmc_mobile_uploads');
      expect(config.cloudName).not.toBe('parthmobilecare');
      expect(config.uploadPreset).not.toBe('pmc_device_photos');
      expect((config as any).apiSecret).toBeUndefined();
      expect((config as any).api_secret).toBeUndefined();
      expect(CloudinaryService.isConfigured()).toBe(true);
    });

    it('validates image size and rejects payloads exceeding 5 MB', () => {
      const oversizedBytes = 6 * 1024 * 1024; // 6 MB
      const check = CloudinaryService.validateImageMeta('image/jpeg', oversizedBytes);
      expect(check.valid).toBe(false);
      expect(check.error).toContain('exceeds maximum allowed limit');
    });

    it('validates permitted formats (JPEG, PNG, WEBP) and rejects unpermitted formats', () => {
      expect(CloudinaryService.validateImageMeta('jpg').valid).toBe(true);
      expect(CloudinaryService.validateImageMeta('png').valid).toBe(true);
      expect(CloudinaryService.validateImageMeta('webp').valid).toBe(true);
      expect(CloudinaryService.validateImageMeta('pdf').valid).toBe(false);
      expect(CloudinaryService.validateImageMeta('tflite').valid).toBe(false);
    });

    it('generates responsive CDN delivery URLs with auto-format and auto-quality', () => {
      const fullUrl = 'https://res.cloudinary.com/demo_cloud/image/upload/v1/device_vivo_v30_front.jpg';
      const optimizedUrl = CloudinaryService.getOptimizedImageUrl(fullUrl, {
        width: 800,
        quality: 'auto',
      });
      expect(optimizedUrl).toContain('res.cloudinary.com/demo_cloud/image/upload');
      expect(optimizedUrl).toContain('f_auto,q_auto,c_limit,w_800');
    });
  });
});
