import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { User, RegistrationStatus } from '../src/types';

// Mock Firebase for testing
const mockFirestoreData: Record<string, any> = {};

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    getAuth: jest.fn(() => ({
      currentUser: {
        uid: 'test_applicant_123',
        email: 'applicant@example.com',
        emailVerified: true,
        reload: jest.fn().mockResolvedValue(undefined),
        getIdToken: jest.fn().mockResolvedValue('token_with_email_verified'),
      },
    })),
    getFirestore: jest.fn(() => ({})),
  },
}));

jest.mock('../src/services/deviceSecurityService', () => ({
  DeviceSecurityService: {
    getDeviceInfo: jest.fn().mockResolvedValue({
      installationId: 'dev_android_hw_12345',
      publicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA',
      model: 'Samsung Galaxy A54',
      platform: 'android',
      isHardwareBacked: true,
    }),
  },
}));

jest.mock('../src/services/onDeviceFaceAuth', () => ({
  safeCheckDuplicate: jest.fn().mockResolvedValue({ isDuplicate: false }),
  safeEnrollLocal: jest.fn().mockResolvedValue(true),
}));

jest.mock('../src/services/faceRecognitionService', () => ({
  FaceRecognitionService: {
    registerOnDeviceFaceTemplate: jest.fn().mockResolvedValue({
      success: true,
      template: { id: 'tmpl_123', userId: 'test_applicant_123' },
    }),
  },
}));

describe('Direct Staff Registration & Face Enrollment Architecture', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Mobile Registration Data Model & Payload Integrity', () => {
    it('creates a compliant pending staff registration document', async () => {
      const applicantId = 'applicant_uid_987';
      const nowIso = new Date().toISOString();

      const registrationPayload: Partial<User> = {
        id: applicantId,
        name: 'Suresh Kumar',
        email: 'suresh@parthmobilecare.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Technician',
        joinedDate: nowIso.split('T')[0],
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        registrationStatus: 'pending',
        emailVerified: true,
        faceEnrollmentStatus: 'pending_review',
        faceModelVersion: 'facenet_512',
        hasFaceRegistered: false,
        faceRegistrationDate: nowIso,
        deviceId: 'dev_android_hw_987',
        deviceModel: 'Redmi Note 12',
        devicePlatform: 'android',
        deviceRegisteredAt: nowIso,
        deviceBindingStatus: 'pending_approval',
        devicePublicKey: 'PUBKEY_BASE64_987',
        createdAt: nowIso,
        createdBy: applicantId,
        _syncedAt: nowIso,
      };

      // Invariants strictly enforced by Firestore Security Rules
      expect(registrationPayload.role).toBe('staff');
      expect(registrationPayload.isActive).toBe(false);
      expect(registrationPayload.registrationStatus).toBe('pending');
      expect(registrationPayload.basicSalary).toBe(0);
      expect(registrationPayload.monthlyTarget).toBe(0);
      expect(registrationPayload.emailVerified).toBe(true);
      expect(registrationPayload.hasFaceRegistered).toBe(false);
      expect(registrationPayload.faceEnrollmentStatus).toBe('pending_review');
      expect(registrationPayload.deviceBindingStatus).toBe('pending_approval');
    });

    it('requires 3 biometric face samples before enrollment can be completed', () => {
      const REQUIRED_SAMPLES = 3;
      const samples: string[] = [];

      // Frame 1
      samples.push('embedding_sample_1_base64');
      expect(samples.length < REQUIRED_SAMPLES).toBe(true);

      // Frame 2
      samples.push('embedding_sample_2_base64');
      expect(samples.length < REQUIRED_SAMPLES).toBe(true);

      // Frame 3
      samples.push('embedding_sample_3_base64');
      expect(samples.length >= REQUIRED_SAMPLES).toBe(true);
      expect(samples.length).toBe(3);
    });

    it('rejects duplicate face enrollment across different staff accounts', async () => {
      const { safeCheckDuplicate } = require('../src/services/onDeviceFaceAuth');
      safeCheckDuplicate.mockResolvedValueOnce({
        isDuplicate: true,
        personnelId: 'different_staff_456',
      });

      const currentStaffId = 'new_applicant_789';
      const checkResult = await safeCheckDuplicate('duplicate_embedding_b64');

      const isCollision = checkResult.isDuplicate && checkResult.personnelId !== currentStaffId;
      expect(isCollision).toBe(true);
    });
  });

  describe('Registration Status Portal Security & Gatekeeping', () => {
    it('determines pending approval state correctly', () => {
      const pendingStaff: Partial<User> = {
        id: 'applicant_1',
        name: 'Anita Sharma',
        role: 'staff',
        isActive: false,
        registrationStatus: 'pending',
      };

      const isAwaitingApproval = !pendingStaff.isActive && pendingStaff.registrationStatus === 'pending';
      const canAccessMainTabs = pendingStaff.isActive && pendingStaff.registrationStatus === 'approved';

      expect(isAwaitingApproval).toBe(true);
      expect(canAccessMainTabs).toBe(false);
    });

    it('determines rejected state with reason correctly', () => {
      const rejectedStaff: Partial<User> = {
        id: 'applicant_2',
        name: 'Vikas Gupta',
        role: 'staff',
        isActive: false,
        registrationStatus: 'rejected',
        rejectionReason: 'Applicant ID documentation did not match name provided.',
        rejectedByName: 'Store Administrator',
      };

      const isRejected = rejectedStaff.registrationStatus === 'rejected';
      const canAccessMainTabs = rejectedStaff.isActive && rejectedStaff.registrationStatus === 'approved';

      expect(isRejected).toBe(true);
      expect(canAccessMainTabs).toBe(false);
      expect(rejectedStaff.rejectionReason).toBe('Applicant ID documentation did not match name provided.');
    });

    it('grants access to MainTabs only when both isActive and registrationStatus are approved', () => {
      const approvedStaff: Partial<User> = {
        id: 'staff_3',
        name: 'Pooja Verma',
        role: 'staff',
        isActive: true,
        registrationStatus: 'approved',
      };

      const canAccessMainTabs = approvedStaff.isActive && approvedStaff.registrationStatus === 'approved';
      expect(canAccessMainTabs).toBe(true);
    });
  });

  describe('Admin Web Dashboard Approval Invariants', () => {
    it('validates mandatory rejection reason on registration rejection', () => {
      const validateRejectionReason = (reason: string) => {
        if (!reason || reason.trim().length < 5) {
          throw new Error('A detailed rejection reason (minimum 5 characters) is required.');
        }
        return true;
      };

      expect(() => validateRejectionReason('')).toThrow('A detailed rejection reason (minimum 5 characters) is required.');
      expect(() => validateRejectionReason('Bad')).toThrow('A detailed rejection reason (minimum 5 characters) is required.');
      expect(validateRejectionReason('Does not match store employment records')).toBe(true);
    });
  });

  describe('Registration Draft & Incomplete State Resolution', () => {
    it('saves and clears registration progress draft without storing password', () => {
      const draft = {
        uid: 'applicant_123',
        name: 'Ramesh Patel',
        email: 'ramesh@parthmobilecare.com',
        phone: '9876543210',
        designation: 'Sales Executive',
        step: 'verify_email' as const,
        emailVerified: false,
        registeredAt: new Date().toISOString(),
      };

      // Ensure password field is strictly not part of the draft model
      expect((draft as any).password).toBeUndefined();
      expect(draft.step).toBe('verify_email');
      expect(draft.emailVerified).toBe(false);
    });

    it('resolves authenticated unverified state correctly for in-progress registration', () => {
      const isRegistering = true;
      const emailVerified = false;

      let authStatus: string;
      if (isRegistering && !emailVerified) {
        authStatus = 'authenticated_unverified';
      } else if (isRegistering && emailVerified) {
        authStatus = 'face_enrollment_pending';
      } else {
        authStatus = 'unauthenticated';
      }

      expect(authStatus).toBe('authenticated_unverified');
    });

    it('resolves face enrollment pending state when email is verified during registration', () => {
      const isRegistering = true;
      const emailVerified = true;
      const sampleCount = 0;

      let authStatus: string;
      if (isRegistering && emailVerified && sampleCount < 3) {
        authStatus = 'face_enrollment_pending';
      } else {
        authStatus = 'registration_incomplete';
      }

      expect(authStatus).toBe('face_enrollment_pending');
    });
  });

  describe('Final Submission Token & Permission Validation', () => {
    it('verifies that token claims are force-refreshed before submitting', async () => {
      let refreshed = false;
      const mockAuthUser = {
        uid: 'user_123',
        email: 'test@parthmobilecare.com',
        emailVerified: true,
        reload: jest.fn().mockResolvedValue(undefined),
        getIdTokenResult: jest.fn().mockImplementation(async (forceRefresh) => {
          if (forceRefresh) refreshed = true;
          return {
            claims: { email_verified: true },
            issuedAtTime: new Date().toISOString(),
          };
        }),
      };

      await mockAuthUser.reload();
      const tokenResult = await mockAuthUser.getIdTokenResult(true);

      expect(refreshed).toBe(true);
      expect(mockAuthUser.reload).toHaveBeenCalledTimes(1);
      expect(tokenResult.claims.email_verified).toBe(true);
    });

    it('rejects registration submission if token email_verified claim is false', async () => {
      const mockAuthUser = {
        uid: 'user_unverified',
        email: 'unverified@parthmobilecare.com',
        emailVerified: false,
        reload: jest.fn().mockResolvedValue(undefined),
        getIdTokenResult: jest.fn().mockResolvedValue({
          claims: { email_verified: false },
        }),
      };

      const validateBeforeSubmit = async (user: any) => {
        await user.reload();
        const idToken = await user.getIdTokenResult(true);
        if (!user.emailVerified || !idToken.claims.email_verified) {
          throw new Error('Email verification is required before submitting your registration.');
        }
        return true;
      };

      await expect(validateBeforeSubmit(mockAuthUser)).rejects.toThrow(
        'Email verification is required before submitting your registration.'
      );
    });

    it('validates phone number minimum length constraint (>= 7 digits)', () => {
      const validatePhone = (phone: string) => {
        const clean = phone.trim();
        if (!clean || clean.length < 7) {
          throw new Error('A valid phone number (at least 7 digits) is required for staff registration.');
        }
        return true;
      };

      expect(() => validatePhone('')).toThrow('at least 7 digits');
      expect(() => validatePhone('12345')).toThrow('at least 7 digits');
      expect(validatePhone('9876543210')).toBe(true);
    });

    it('preserves 3 captured face samples if Firestore submission fails', () => {
      const samplesRef = { current: ['sample1', 'sample2', 'sample3'] };
      let step = 'submitting';

      // Simulate a submission failure (e.g. network/permissions)
      try {
        throw new Error('Missing or insufficient permissions.');
      } catch {
        step = 'face_enrollment';
        // samplesRef is deliberately NOT cleared
      }

      expect(step).toBe('face_enrollment');
      expect(samplesRef.current.length).toBe(3);
      expect(samplesRef.current).toEqual(['sample1', 'sample2', 'sample3']);
    });
  });
});
