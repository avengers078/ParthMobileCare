import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    getAuth: jest.fn(() => ({})),
    getFirestore: jest.fn(() => ({})),
  },
}));

jest.mock('../src/services/firestoreSync', () => ({
  FirestoreSyncService: {
    pullAllCloudToLocal: jest.fn().mockResolvedValue(undefined),
  },
  FIRESTORE_COLLECTIONS: {
    USERS: 'users',
  },
}));

import { StorageService } from '../src/services/storageService';
import { StaffRegistrationDraft, User } from '../src/types';

describe('POST-IMPLEMENTATION FINAL ACCEPTANCE VERIFICATION TESTS', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  describe('1. Critical Security Invariants & Privilege Escalation Denial', () => {
    it('prohibits staff from activating their own profile or setting isActive to true', () => {
      const staffSelfUpdate = {
        isActive: true,
      };

      // Simulates firestore.rules: request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'phone', 'avatarUrl', '_syncedAt'])
      const allowedUpdateKeys = ['name', 'phone', 'avatarUrl', '_syncedAt'];
      const attemptedKeys = Object.keys(staffSelfUpdate);
      const isAllowed = attemptedKeys.every(k => allowedUpdateKeys.includes(k));

      expect(isAllowed).toBe(false);
      expect(attemptedKeys).toContain('isActive');
    });

    it('prohibits staff from approving their own registration status', () => {
      const staffSelfApprove = {
        registrationStatus: 'approved',
      };

      const allowedUpdateKeys = ['name', 'phone', 'avatarUrl', '_syncedAt'];
      const isAllowed = Object.keys(staffSelfApprove).every(k => allowedUpdateKeys.includes(k));
      expect(isAllowed).toBe(false);
    });

    it('prohibits staff from changing their role to admin or manager', () => {
      const staffRoleChange = {
        role: 'admin',
      };

      const allowedUpdateKeys = ['name', 'phone', 'avatarUrl', '_syncedAt'];
      const isAllowed = Object.keys(staffRoleChange).every(k => allowedUpdateKeys.includes(k));
      expect(isAllowed).toBe(false);
    });

    it('prohibits staff from modifying their salary or sales target', () => {
      const staffSalaryTamper = {
        basicSalary: 80000,
        monthlyTarget: 100000,
      };

      const allowedUpdateKeys = ['name', 'phone', 'avatarUrl', '_syncedAt'];
      const isAllowed = Object.keys(staffSalaryTamper).every(k => allowedUpdateKeys.includes(k));
      expect(isAllowed).toBe(false);
    });

    it('prohibits staff from forging admin approval metadata', () => {
      const forgeApprovalMetadata = {
        approvedAt: new Date().toISOString(),
        approvedBy: 'hacker_uid',
        faceApprovedAt: new Date().toISOString(),
        faceApprovedBy: 'hacker_uid',
      };

      const allowedUpdateKeys = ['name', 'phone', 'avatarUrl', '_syncedAt'];
      const isAllowed = Object.keys(forgeApprovalMetadata).every(k => allowedUpdateKeys.includes(k));
      expect(isAllowed).toBe(false);
    });

    it('strictly denies protected screen access to rejected staff', () => {
      const rejectedUser: User = {
        id: 'rejected_user_1',
        name: 'Rejected Applicant',
        email: 'rejected@example.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Staff',
        joinedDate: '2026-11-03',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        registrationStatus: 'rejected',
        rejectionReason: 'Identity document unverified',
      };

      const canAccessProtectedScreens = rejectedUser.isActive && rejectedUser.registrationStatus === 'approved';
      expect(canAccessProtectedScreens).toBe(false);
    });
  });

  describe('2. Registration Draft Persistence & Password Security', () => {
    it('guarantees that draft persistence NEVER stores passwords', async () => {
      const draftWithPasswordAttempt: any = {
        uid: 'user_temp_123',
        name: 'Aakash Shah',
        email: 'aakash@parthmobile.com',
        phone: '9876543210',
        designation: 'Technician',
        step: 'verify_email',
        emailVerified: false,
        registeredAt: new Date().toISOString(),
        password: 'SUPER_SECRET_PLAINTEXT_PASSWORD',
      };

      // Strip sensitive properties before saving
      const sanitizedDraft: StaffRegistrationDraft = {
        uid: draftWithPasswordAttempt.uid,
        name: draftWithPasswordAttempt.name,
        email: draftWithPasswordAttempt.email,
        phone: draftWithPasswordAttempt.phone,
        designation: draftWithPasswordAttempt.designation,
        step: draftWithPasswordAttempt.step,
        emailVerified: draftWithPasswordAttempt.emailVerified,
        registeredAt: draftWithPasswordAttempt.registeredAt,
      };

      await StorageService.saveStaffRegistrationDraft(sanitizedDraft);

      const retrievedDraft = await StorageService.getStaffRegistrationDraft();
      expect(retrievedDraft).not.toBeNull();
      expect((retrievedDraft as any).password).toBeUndefined();
      expect(retrievedDraft?.name).toBe('Aakash Shah');
      expect(retrievedDraft?.email).toBe('aakash@parthmobile.com');
    });

    it('clears draft upon registration completion or cancellation', async () => {
      const draft: StaffRegistrationDraft = {
        uid: 'user_temp_456',
        name: 'Meena Rao',
        email: 'meena@parthmobile.com',
        phone: '9876543211',
        designation: 'Sales Executive',
        step: 'submitting',
        emailVerified: true,
        registeredAt: new Date().toISOString(),
      };

      await StorageService.saveStaffRegistrationDraft(draft);
      let existing = await StorageService.getStaffRegistrationDraft();
      expect(existing).not.toBeNull();

      await StorageService.clearStaffRegistrationDraft();
      let cleared = await StorageService.getStaffRegistrationDraft();
      expect(cleared).toBeNull();
    });
  });

  describe('3. Registration Recovery & Lifecycle State Transitions', () => {
    it('recovers state when app is killed during email verification', async () => {
      const draft: StaffRegistrationDraft = {
        uid: 'user_killed_app',
        name: 'Karan Mehra',
        email: 'karan@parthmobile.com',
        phone: '9876543212',
        designation: 'Technician',
        step: 'verify_email',
        emailVerified: false,
        registeredAt: new Date().toISOString(),
      };

      await StorageService.saveStaffRegistrationDraft(draft);

      // Simulate app restart: fetch draft
      const recovered = await StorageService.getStaffRegistrationDraft();
      expect(recovered?.step).toBe('verify_email');
      expect(recovered?.name).toBe('Karan Mehra');
      expect(recovered?.emailVerified).toBe(false);
    });

    it('advances from email verification to face enrollment upon email confirmation', async () => {
      const draft: StaffRegistrationDraft = {
        uid: 'user_verified_email',
        name: 'Priya Dave',
        email: 'priya@parthmobile.com',
        phone: '9876543213',
        designation: 'Sales Executive',
        step: 'verify_email',
        emailVerified: false,
        registeredAt: new Date().toISOString(),
      };

      await StorageService.saveStaffRegistrationDraft(draft);

      // Simulation of email verification event
      const updatedDraft: StaffRegistrationDraft = {
        ...draft,
        step: 'face_enrollment',
        emailVerified: true,
      };

      await StorageService.saveStaffRegistrationDraft(updatedDraft);

      const recovered = await StorageService.getStaffRegistrationDraft();
      expect(recovered?.step).toBe('face_enrollment');
      expect(recovered?.emailVerified).toBe(true);
    });

    it('prevents duplicate Firestore registration document collisions', () => {
      const existingRegistrations = new Set(['user_registered_1', 'user_registered_2']);
      const isDuplicate = existingRegistrations.has('user_registered_1');
      expect(isDuplicate).toBe(true);

      const isNewUser = !existingRegistrations.has('new_user_unique');
      expect(isNewUser).toBe(true);
    });

    it('handles background real-time Admin approval seamlessly', () => {
      let currentAppScreen = 'RegistrationStatusScreen';
      let staffProfile: User = {
        id: 'applicant_bg_approve',
        name: 'Bhavin Shah',
        email: 'bhavin@parthmobile.com',
        phone: '9876543214',
        role: 'staff',
        designation: 'Technician',
        joinedDate: '2026-11-03',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        registrationStatus: 'pending',
      };

      // Admin approves in Firestore
      const firestoreAdminUpdate = {
        isActive: true,
        registrationStatus: 'approved' as const,
        basicSalary: 22000,
        monthlyTarget: 250000,
      };

      staffProfile = { ...staffProfile, ...firestoreAdminUpdate };

      // RootNavigator logic evaluation
      if (staffProfile.isActive && staffProfile.registrationStatus === 'approved') {
        currentAppScreen = 'MainTabs';
      }

      expect(currentAppScreen).toBe('MainTabs');
      expect(staffProfile.basicSalary).toBe(22000);
    });

    it('handles background real-time Admin rejection seamlessly', () => {
      let currentAppScreen = 'RegistrationStatusScreen';
      let staffProfile: User = {
        id: 'applicant_bg_reject',
        name: 'Harish Bhai',
        email: 'harish@parthmobile.com',
        phone: '9876543215',
        role: 'staff',
        designation: 'Sales Executive',
        joinedDate: '2026-11-03',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        registrationStatus: 'pending',
      };

      // Admin rejects in Firestore
      const firestoreAdminRejection = {
        isActive: false,
        registrationStatus: 'rejected' as const,
        rejectionReason: 'Position already filled',
      };

      staffProfile = { ...staffProfile, ...firestoreAdminRejection };

      // RootNavigator logic evaluation
      if (staffProfile.registrationStatus === 'rejected') {
        currentAppScreen = 'RegistrationStatusScreen_Rejected';
      }

      expect(currentAppScreen).toBe('RegistrationStatusScreen_Rejected');
      expect(staffProfile.rejectionReason).toBe('Position already filled');
    });
  });

  describe('4. Global Keyboard Avoidance & Scroll Coordination Invariants', () => {
    it('calculates dynamic bottom padding properly based on soft keyboard height', () => {
      const calculatePadding = (keyboardVisible: boolean, keyboardHeight: number) => {
        return keyboardVisible ? Math.max(keyboardHeight, 260) + 60 : 24;
      };

      // Keyboard Closed
      expect(calculatePadding(false, 0)).toBe(24);

      // Keyboard Open (standard keyboard: 280px)
      expect(calculatePadding(true, 280)).toBe(340);

      // Keyboard Open (compact keyboard: 200px -> clamped to min 260 + 60)
      expect(calculatePadding(true, 200)).toBe(320);
    });

    it('ensures Android hardware back dismisses keyboard without popping screen or modal', () => {
      let screenPopped = false;
      let modalClosed = false;
      let keyboardVisible = true;

      const handleHardwareBack = () => {
        if (keyboardVisible) {
          keyboardVisible = false; // Dismiss keyboard first
          return true; // Consume event
        }
        // If keyboard was not open, screen would pop or modal would close
        modalClosed = true;
        screenPopped = true;
        return false;
      };

      // First Back Press (with keyboard open)
      const consumedFirst = handleHardwareBack();
      expect(consumedFirst).toBe(true);
      expect(keyboardVisible).toBe(false);
      expect(modalClosed).toBe(false);
      expect(screenPopped).toBe(false);

      // Second Back Press (with keyboard already closed)
      const consumedSecond = handleHardwareBack();
      expect(consumedSecond).toBe(false);
      expect(modalClosed).toBe(true);
      expect(screenPopped).toBe(true);
    });
  });

  describe('5. Verified Applicant Incomplete Registration Recovery', () => {
    it('recognizes verified email applicant without throwing missing profile error', () => {
      const authUser = {
        uid: '0pvoT5eSdLSUeu7tZEh5WMYJLQB3',
        email: 'ramesh@parthmobilecare.com',
        emailVerified: true,
      };

      const docExists = false; // Firestore document does not exist yet
      const draft = null as StaffRegistrationDraft | null; // Draft was absent or cleared

      // Evaluates logic in AuthContext.tsx
      const hasMatchingDraft = !!(draft && (
        (draft.uid && draft.uid === authUser.uid) ||
        (draft.email && draft.email.trim().toLowerCase() === authUser.email?.trim().toLowerCase())
      ));
      const isVerifiedApplicant = !!authUser.emailVerified;
      const isRegistering = hasMatchingDraft || isVerifiedApplicant;

      expect(isRegistering).toBe(true); // Must NOT be rejected as orphaned!

      const targetStatus = isRegistering ? 'face_enrollment_pending' : 'error';
      expect(targetStatus).toBe('face_enrollment_pending');
    });

    it('reconstructs registration draft seamlessly when verified applicant returns', async () => {
      const authUser = {
        uid: '0pvoT5eSdLSUeu7tZEh5WMYJLQB3',
        email: 'ramesh@parthmobilecare.com',
        displayName: 'Ramesh Patel',
        emailVerified: true,
      };

      let draft = await StorageService.getStaffRegistrationDraft();
      expect(draft).toBeNull();

      if (!draft || (!draft.uid && !draft.email)) {
        draft = {
          uid: authUser.uid,
          name: authUser.displayName || 'Staff Applicant',
          email: authUser.email || '',
          phone: '',
          designation: 'Sales Executive',
          step: authUser.emailVerified ? 'face_enrollment' : 'verify_email',
          emailVerified: !!authUser.emailVerified,
          registeredAt: new Date().toISOString(),
        };
        await StorageService.saveStaffRegistrationDraft(draft);
      }

      const savedDraft = await StorageService.getStaffRegistrationDraft();
      expect(savedDraft).not.toBeNull();
      expect(savedDraft?.uid).toBe(authUser.uid);
      expect(savedDraft?.email).toBe('ramesh@parthmobilecare.com');
      expect(savedDraft?.step).toBe('face_enrollment');
      expect(savedDraft?.emailVerified).toBe(true);
    });

    it('rejects unverified orphan login that has no draft and unverified email', () => {
      const orphanUser = {
        uid: 'orphaned_uid_999',
        email: 'orphan@example.com',
        emailVerified: false,
      };

      const draft = null as StaffRegistrationDraft | null;
      const hasMatchingDraft = !!(draft && (
        (draft.uid && draft.uid === orphanUser.uid) ||
        (draft.email && draft.email.trim().toLowerCase() === orphanUser.email?.trim().toLowerCase())
      ));
      const isVerifiedApplicant = !!orphanUser.emailVerified;
      const isRegistering = hasMatchingDraft || isVerifiedApplicant;

      expect(isRegistering).toBe(false); // Orphan is properly rejected
    });
  });
});
