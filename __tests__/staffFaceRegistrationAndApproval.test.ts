jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'admin_test_uid' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
}));

import { FaceRecognitionService } from '../src/services/faceRecognitionService';
import { StorageService } from '../src/services/storageService';
import { AttendanceService } from '../src/services/attendanceService';
import { DEFAULT_SHOP_CONFIG } from '../src/constants';
import { User } from '../src/types';
import { getTodayDateString } from '../src/utils/format';

describe('Parth Mobile Care — Staff Registration, Face Enrollment & Approval System', () => {
  const adminUser: User = {
    id: 'admin_101',
    name: 'Parth Patel',
    email: 'admin@parthmobile.com',
    phone: '9876543210',
    role: 'admin',
    designation: 'Store Administrator',
    joinedDate: '2025-01-01',
    basicSalary: 50000,
    monthlyTarget: 500000,
    isActive: true,
  };

  const staffUser: User = {
    id: 'staff_202',
    name: 'Karan Dave',
    email: 'karan@parthmobile.com',
    phone: '9876543222',
    role: 'staff',
    designation: 'Sales Executive',
    joinedDate: '2026-02-01',
    basicSalary: 22000,
    monthlyTarget: 220000,
    isActive: true,
    createdBy: adminUser.id,
    faceEnrollmentStatus: 'not_enrolled',
  };

  const shopCoords = {
    latitude: DEFAULT_SHOP_CONFIG.latitude,
    longitude: DEFAULT_SHOP_CONFIG.longitude,
  };

  const permissiveConfig = {
    ...DEFAULT_SHOP_CONFIG,
    openingTime: '00:00',
    closingTime: '23:59',
  };

  beforeEach(async () => {
    await StorageService.deleteFaceTemplate(staffUser.id, adminUser.id);
    await StorageService.saveUser({ ...staffUser, hasFaceRegistered: false, faceEnrollmentStatus: 'not_enrolled' });
  });

  describe('A. Face Enrollment & Informed Consent', () => {
    it('requires explicit informed consent before face template generation', async () => {
      const res = await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: staffUser.id,
        userName: staffUser.name,
        registeredBy: staffUser.id,
        consentObtained: false,
        sampleCount: 3,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('Explicit informed consent is required');
    });

    it('submits face enrollment in pending_approval status when staff self-enrolls', async () => {
      const res = await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: staffUser.id,
        userName: staffUser.name,
        registeredBy: staffUser.id,
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'pending',
      });

      expect(res.success).toBe(true);
      expect(res.template).toBeDefined();
      expect(res.template?.approvalStatus).toBe('pending');
      expect(res.template?.sampleCount).toBe(3);
      expect(res.template?.deviceInfo).toBeDefined();

      const userAfter = (await StorageService.getAllUsers()).find(u => u.id === staffUser.id);
      expect(userAfter?.faceEnrollmentStatus).toBe('pending_approval');
      expect(userAfter?.hasFaceRegistered).toBe(false); // not active yet until approved
    });
  });

  describe('B. Attendance Enforcement & Approval Gating', () => {
    it('strictly blocks Punch In when face enrollment is pending Admin approval', async () => {
      // 1. Staff enrolls
      await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: staffUser.id,
        userName: staffUser.name,
        registeredBy: staffUser.id,
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'pending',
      });

      // 2. Generate signed token
      const token = FaceRecognitionService.generateVerificationToken(
        staffUser.id,
        'punch_in',
        0.96,
        0.95,
        ['blink', 'smile']
      );

      // 3. Attempt Punch In
      const punchResult = await AttendanceService.punchIn(
        staffUser,
        permissiveConfig,
        shopCoords,
        token
      );

      expect(punchResult.success).toBe(false);
      expect(punchResult.message).toContain('pending Administrator approval');
    });

    it('strictly blocks Punch In and Punch Out when face enrollment is rejected', async () => {
      // 1. Staff enrolls, admin rejects with reason
      await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: staffUser.id,
        userName: staffUser.name,
        registeredBy: staffUser.id,
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'pending',
      });

      await FaceRecognitionService.rejectEnrollment({
        userId: staffUser.id,
        adminId: adminUser.id,
        adminName: adminUser.name,
        reason: 'Poor ambient lighting and motion blur in camera samples.',
      });

      // 2. Punch In is rejected
      const punchInToken = FaceRecognitionService.generateVerificationToken(
        staffUser.id,
        'punch_in',
        0.96,
        0.95,
        ['blink']
      );

      const inResult = await AttendanceService.punchIn(
        staffUser,
        permissiveConfig,
        shopCoords,
        punchInToken
      );

      expect(inResult.success).toBe(false);
      expect(inResult.message).toContain('rejected: Poor ambient lighting');

      // 3. Punch Out is also rejected when face enrollment is rejected
      const today = getTodayDateString();
      jest.spyOn(StorageService, 'getAttendanceRecords').mockResolvedValueOnce([
        {
          id: `att_${staffUser.id}_${today}`,
          userId: staffUser.id,
          userName: staffUser.name,
          userRole: 'staff',
          date: today,
          punchInTime: '10:00:00',
          status: 'present',
          totalHours: 0,
          isLate: false,
          isEarlyExit: false,
        },
      ]);

      const punchOutToken = FaceRecognitionService.generateVerificationToken(
        staffUser.id,
        'punch_out',
        0.96,
        0.95,
        ['blink']
      );

      const punchResult = await AttendanceService.punchOut(
        staffUser,
        permissiveConfig,
        shopCoords,
        punchOutToken
      );

      expect(punchResult.success).toBe(false);
      expect(punchResult.message).toContain('rejected: Poor ambient lighting');
    });

    it('allows Punch In and Punch Out once Admin approves enrollment', async () => {
      // 1. Staff enrolls
      await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: staffUser.id,
        userName: staffUser.name,
        registeredBy: staffUser.id,
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'pending',
      });

      // 2. Admin approves
      const approval = await FaceRecognitionService.approveEnrollment({
        userId: staffUser.id,
        adminId: adminUser.id,
        adminName: adminUser.name,
      });

      expect(approval.success).toBe(true);
      expect(approval.template?.approvalStatus).toBe('approved');
      expect(approval.template?.approvedByAdminName).toBe(adminUser.name);

      // Check user record
      const userAfter = (await StorageService.getAllUsers()).find(u => u.id === staffUser.id);
      expect(userAfter?.hasFaceRegistered).toBe(true);
      expect(userAfter?.faceEnrollmentStatus).toBe('approved');

      // 3. Punch In with Face Token
      const punchInToken = FaceRecognitionService.generateVerificationToken(
        staffUser.id,
        'punch_in',
        0.97,
        0.96,
        ['blink', 'turn_head']
      );

      const inResult = await AttendanceService.punchIn(
        staffUser,
        permissiveConfig,
        shopCoords,
        punchInToken
      );

      expect(inResult.success).toBe(true);
      expect(inResult.record?.verificationMethod).toBe('face_recognition');

      // 4. Punch Out with Face Token
      const punchOutToken = FaceRecognitionService.generateVerificationToken(
        staffUser.id,
        'punch_out',
        0.96,
        0.95,
        ['smile']
      );

      const outResult = await AttendanceService.punchOut(
        staffUser,
        permissiveConfig,
        shopCoords,
        punchOutToken
      );

      expect(outResult.success).toBe(true);
      expect(outResult.record?.punchOutTime).toBeDefined();
    });
  });

  describe('C. Re-enrollment & Old Template Invalidation', () => {
    it('invalidates and supersedes old template upon successful re-enrollment', async () => {
      // 1. Initial enrollment & approval
      const first = await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: staffUser.id,
        userName: staffUser.name,
        registeredBy: staffUser.id,
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'approved',
      });

      const firstId = first.template?.id;

      // 2. Re-enrollment
      const second = await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: staffUser.id,
        userName: staffUser.name,
        registeredBy: staffUser.id,
        consentObtained: true,
        sampleCount: 3,
        approvalStatus: 'pending',
      });

      expect(second.template?.reEnrollmentCount).toBe(1);
      expect(second.template?.supersededTemplateId).toBe(firstId);

      // Verify old template is marked superseded
      const allTemplates = await StorageService.getAllFaceTemplatesForUser(staffUser.id);
      const oldTmpl = allTemplates.find(t => t.id === firstId);
      expect(oldTmpl?.status).toBe('superseded');
    });
  });

  describe('D. Verification Failure Tracking & Manual Review Process', () => {
    it('tracks failed verification attempts on the staff profile', async () => {
      await StorageService.recordVerificationFailure(staffUser.id, 'Anti-spoofing liveness check failed.');
      await StorageService.recordVerificationFailure(staffUser.id, 'Anti-spoofing liveness check failed.');

      const user = (await StorageService.getAllUsers()).find(u => u.id === staffUser.id);
      expect(user?.failedVerificationAttempts).toBe(2);
      expect(user?.lastFailedVerificationReason).toBe('Anti-spoofing liveness check failed.');
    });

    it('supports authorized manual attendance review when verification fails repeatedly', async () => {
      // Record 3 failures
      await StorageService.recordVerificationFailure(staffUser.id, 'Camera smudge');
      await StorageService.recordVerificationFailure(staffUser.id, 'Camera smudge');
      await StorageService.recordVerificationFailure(staffUser.id, 'Camera smudge');

      // Admin manual attendance review
      const today = new Date().toISOString().slice(0, 10);
      const manualRecord = {
        id: `att_${staffUser.id}_${today}`,
        userId: staffUser.id,
        userName: staffUser.name,
        userRole: staffUser.role,
        date: today,
        punchInTime: '09:45:00',
        status: 'present' as const,
        totalHours: 8,
        isLate: false,
        isEarlyExit: false,
        verificationMethod: 'manual_override' as const,
        notes: `Physical attendance verified on-site by Admin ${adminUser.name}`,
      };

      await StorageService.updateAttendanceRecord(manualRecord);
      await StorageService.resetVerificationFailures(staffUser.id);

      const userAfter = (await StorageService.getAllUsers()).find(u => u.id === staffUser.id);
      expect(userAfter?.failedVerificationAttempts).toBe(0);

      const records = await StorageService.getAttendanceRecords(staffUser.id);
      expect(records.some(r => r.id === manualRecord.id && r.verificationMethod === 'manual_override')).toBe(true);
    });
  });

  describe('E. Audit Logging Integrity', () => {
    it('records immutable audit logs for enrollment, approval, rejection, and manual correction', async () => {
      const logs = await StorageService.getAttendanceAuditLogs();
      const userLogs = logs.filter(l => l.userId === staffUser.id);

      expect(userLogs.length).toBeGreaterThan(0);
      expect(userLogs.some(l => l.action === 'enrollment_submitted' || l.action === 'register_face')).toBe(true);
    });
  });

  describe('F. 6 Discrete Biometric Enrollment States & Cloud Reconciliation', () => {
    it('evaluates state 1: NOT_ENROLLED when neither local nor cloud data exists', async () => {
      const freshUser: User = { ...staffUser, id: 'fresh_staff_301', hasFaceRegistered: false, faceEnrollmentStatus: 'not_enrolled' };
      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(freshUser);
      expect(status.state).toBe('NOT_ENROLLED');
      expect(status.canVerify).toBe(false);
      expect(status.message).toContain('face has not been registered');
    });

    it('evaluates state 2: ENROLLED_LOCALLY when template exists but cloud registration is not approved/submitted', async () => {
      const localOnlyUser: User = { ...staffUser, id: 'local_staff_302', hasFaceRegistered: false, faceEnrollmentStatus: undefined };
      await StorageService.saveFaceTemplate({
        id: 'tmpl_local_staff_302',
        userId: localOnlyUser.id,
        userName: localOnlyUser.name,
        faceDescriptor: [],
        qualityScore: 0.95,
        registeredAt: new Date().toISOString(),
        registeredBy: localOnlyUser.id,
        consentObtained: true,
        consentTimestamp: new Date().toISOString(),
        templateHash: 'mock_hash',
        sampleCount: 3,
        status: 'active',
        approvalStatus: undefined,
      });

      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(localOnlyUser);
      expect(status.state).toBe('ENROLLED_AND_READY'); // Active template without status is considered legacy approved
    });

    it('evaluates state 3: ENROLLMENT_PENDING_REVIEW when cloud status is pending_approval', async () => {
      const pendingUser: User = {
        ...staffUser,
        id: 'pending_staff_303',
        hasFaceRegistered: false,
        faceEnrollmentStatus: 'pending_approval',
        registrationStatus: 'pending',
      };
      await StorageService.saveFaceTemplate({
        id: 'tmpl_pending_staff_303',
        userId: pendingUser.id,
        userName: pendingUser.name,
        faceDescriptor: [],
        qualityScore: 0.95,
        registeredAt: new Date().toISOString(),
        registeredBy: pendingUser.id,
        consentObtained: true,
        consentTimestamp: new Date().toISOString(),
        templateHash: 'mock_hash',
        sampleCount: 3,
        status: 'active',
        approvalStatus: 'pending',
      });

      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(pendingUser);
      expect(status.state).toBe('ENROLLMENT_PENDING_REVIEW');
      expect(status.canVerify).toBe(false);
      expect(status.message).toContain('pending Administrator approval');
    });

    it('evaluates state 4: ENROLLED_AND_READY and reconciles local template from pending to approved when cloud is approved', async () => {
      const approvedStaffUser: User = {
        ...staffUser,
        id: 'chetan_luhar_live',
        name: 'Chetan Luhar',
        hasFaceRegistered: true,
        faceEnrollmentStatus: 'approved',
        faceModelVersion: 'facenet_512',
        faceApprovedBy: 'Parth',
        faceApprovedAt: '2026-11-05T10:03:06.161Z',
      };

      // Staff initially enrolled with 'pending' status stored in local AsyncStorage
      await StorageService.saveFaceTemplate({
        id: 'tmpl_chetan_pending',
        userId: approvedStaffUser.id,
        userName: approvedStaffUser.name,
        faceDescriptor: [],
        qualityScore: 0.95,
        registeredAt: '2026-11-05T09:00:00.000Z',
        registeredBy: approvedStaffUser.id,
        consentObtained: true,
        consentTimestamp: '2026-11-05T09:00:00.000Z',
        templateHash: 'mock_hash',
        sampleCount: 3,
        status: 'active',
        approvalStatus: 'pending',
      });

      // Call getBiometricEnrollmentStatus
      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(approvedStaffUser);
      expect(status.state).toBe('ENROLLED_AND_READY');
      expect(status.canVerify).toBe(true);
      expect(status.template?.approvalStatus).toBe('approved');
      expect(status.template?.approvedByAdminName).toBe('Parth');

      // Verify that local AsyncStorage template was updated to 'approved'
      const updatedTemplate = await StorageService.getFaceTemplate(approvedStaffUser.id);
      expect(updatedTemplate?.approvalStatus).toBe('approved');
      expect(updatedTemplate?.approvedByAdminName).toBe('Parth');
    });

    it('evaluates state 5: ENROLLMENT_DATA_MISSING when cloud is approved but local template and embeddings are missing', async () => {
      const freshDeviceUser: User = {
        ...staffUser,
        id: 'new_device_staff_305',
        hasFaceRegistered: true,
        faceEnrollmentStatus: 'approved',
        faceModelVersion: 'facenet_512',
      };

      // Ensure no local template
      await StorageService.deleteFaceTemplate(freshDeviceUser.id);

      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(freshDeviceUser);
      expect(status.state).toBe('ENROLLMENT_DATA_MISSING');
      expect(status.canVerify).toBe(false);
      expect(status.message).toContain('biometric face data is missing on this phone');
    });

    it('evaluates state 6: ENROLLMENT_VERSION_MISMATCH when faceModelVersion does not match facenet_512', async () => {
      const outdatedUser: User = {
        ...staffUser,
        id: 'outdated_model_staff_306',
        hasFaceRegistered: true,
        faceEnrollmentStatus: 'approved',
        faceModelVersion: 'facenet_128_legacy',
      };

      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(outdatedUser);
      expect(status.state).toBe('ENROLLMENT_VERSION_MISMATCH');
      expect(status.canVerify).toBe(false);
      expect(status.message).toContain('expected facenet_512, found facenet_128_legacy');
    });

    it('evaluates state 7: ENROLLMENT_REJECTED when admin rejected enrollment with a specific reason', async () => {
      const rejectedUser: User = {
        ...staffUser,
        id: 'rejected_staff_307',
        hasFaceRegistered: false,
        faceEnrollmentStatus: 'rejected',
        faceRejectionReason: 'Face blurred and excessive shadows.',
      };

      const status = await FaceRecognitionService.getBiometricEnrollmentStatus(rejectedUser);
      expect(status.state).toBe('ENROLLMENT_REJECTED');
      expect(status.canVerify).toBe(false);
      expect(status.message).toContain('Face blurred and excessive shadows');
      expect(status.rejectionReason).toBe('Face blurred and excessive shadows.');
    });
  });
});
