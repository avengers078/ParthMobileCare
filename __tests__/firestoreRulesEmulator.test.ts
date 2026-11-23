/**
 * FIRESTORE RULES REAL EMULATOR ACCEPTANCE TEST SUITE
 *
 * Runs against the actual Cloud Firestore Emulator and executes security assertions
 * against the real Firestore security rules engine (`firestore.rules`) using
 * `@firebase/rules-unit-testing`.
 *
 * Covers all required security test scenarios:
 *  1. Staff registration create (verified email, pending status, salary 0) -> ALLOW
 *  2. Staff registration create without email verification -> DENY
 *  3. Staff registration create with role='admin' -> DENY
 *  4. Staff registration create with salary > 0 -> DENY
 *  5. Staff registration create with isActive=true -> DENY
 *  6. Staff resubmission when rejected, preserving old rejection metadata -> ALLOW
 *  7. Staff resubmission when rejected, trying to self-approve -> DENY
 *  8. Staff resubmission when rejected, trying to change salary/target -> DENY
 *  9. Duplicate staff submission when already pending -> ALLOW
 * 10. Active staff trying to reset status via registration branch -> DENY
 * 11. Staff reading another staff profile -> DENY
 * 12. Staff reading own profile -> ALLOW
 * 13. Admin reading any staff profile -> ALLOW
 * 14. User with spoofed admin email in auth token but no admin role -> DENY admin actions
 * 15. Inactive admin with valid custom claim role='admin' -> DENY admin actions
 * 16. Pending staff cannot modify deviceId -> DENY
 * 17. Pending staff cannot modify devicePublicKey -> DENY
 * 18. Pending staff cannot change deviceModel -> DENY
 * 19. Staff cannot change createdAt on resubmission or profile update -> DENY
 * 20. Staff cannot change createdBy on resubmission or profile update -> DENY
 * 21. Staff cannot alter Admin rejection metadata -> DENY
 * 22. Invalid optional field types are denied -> DENY
 * 23. Existing approved staff can punch in on their approved device -> ALLOW
 * 24. Existing approved staff can update profile fields (name, phone) -> ALLOW
 * 25. Existing approved staff can submit device change request -> ALLOW
 * 26. Admin can approve pending staff registration -> ALLOW
 * 27. Admin can reject pending staff registration -> ALLOW
 */

import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ID = 'parthmobilecare-a474d';
const RULES_PATH = path.resolve(__dirname, '../firestore.rules');

describe('Firestore Rules Real Emulator Acceptance Tests', () => {
  let testEnv: any;

  before(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: {
        host: '127.0.0.1',
        port: 8080,
        rules: fs.readFileSync(RULES_PATH, 'utf8'),
      },
    });
  });

  after(async () => {
    if (testEnv) {
      await testEnv.cleanup();
    }
  });

  beforeEach(async () => {
    await testEnv.clearFirestore();

    // Seed standard base data with security rules bypassed
    await testEnv.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();

      // Active Store Admin
      await setDoc(doc(db, 'users/admin_user'), {
        id: 'admin_user',
        name: 'Store Admin',
        email: 'admin@parthmobile.com',
        phone: '9999999999',
        role: 'admin',
        designation: 'Store Owner',
        joinedDate: '2026-01-01',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: true,
        deviceBindingStatus: 'approved',
        deviceId: 'dev_admin_123',
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'system',
      });

      // Inactive Admin (has role='admin' in doc, but isActive=false)
      await setDoc(doc(db, 'users/admin_inactive'), {
        id: 'admin_inactive',
        name: 'Inactive Admin',
        email: 'inactive_admin@parthmobile.com',
        phone: '9999999998',
        role: 'admin',
        designation: 'Former Owner',
        joinedDate: '2026-01-01',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        deviceBindingStatus: 'approved',
        deviceId: 'dev_admin_inact_123',
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'system',
      });

      // Approved Active Staff
      await setDoc(doc(db, 'users/staff_ramesh'), {
        id: 'staff_ramesh',
        name: 'Ramesh Patel',
        email: 'ramesh@parthmobile.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Senior Sales Executive',
        joinedDate: '2026-02-01',
        basicSalary: 25000,
        monthlyTarget: 300000,
        isActive: true,
        registrationStatus: 'approved',
        hasFaceRegistered: true,
        faceEnrollmentStatus: 'approved',
        deviceBindingStatus: 'approved',
        deviceId: 'dev_ramesh_123',
        createdAt: '2026-02-01T00:00:00Z',
        createdBy: 'admin_user',
      });

      // Other Active Staff
      await setDoc(doc(db, 'users/staff_suresh'), {
        id: 'staff_suresh',
        name: 'Suresh Kumar',
        email: 'suresh@parthmobile.com',
        phone: '9876543219',
        role: 'staff',
        designation: 'Sales Executive',
        joinedDate: '2026-03-01',
        basicSalary: 20000,
        monthlyTarget: 250000,
        isActive: true,
        registrationStatus: 'approved',
        hasFaceRegistered: true,
        faceEnrollmentStatus: 'approved',
        deviceBindingStatus: 'approved',
        deviceId: 'dev_suresh_123',
        createdAt: '2026-03-01T00:00:00Z',
        createdBy: 'admin_user',
      });

      // Rejected Staff profile (with Admin rejection metadata preserved)
      await setDoc(doc(db, 'users/staff_rejected'), {
        id: 'staff_rejected',
        name: 'Rejected Staff',
        email: 'rejected@parthmobile.com',
        phone: '9876543212',
        role: 'staff',
        designation: 'Sales Executive',
        joinedDate: '2026-11-01',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        registrationStatus: 'rejected',
        emailVerified: true,
        faceEnrollmentStatus: 'pending_review',
        faceModelVersion: 'facenet_512',
        faceRegistrationDate: '2026-11-01T10:00:00Z',
        hasFaceRegistered: false,
        deviceId: 'dev_rejected_123',
        deviceModel: 'Pixel 7',
        devicePlatform: 'android',
        deviceRegisteredAt: '2026-11-01T10:00:00Z',
        deviceBindingStatus: 'pending_approval',
        devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
        createdAt: '2026-11-01T10:00:00Z',
        createdBy: 'staff_rejected',
        _syncedAt: '2026-11-01T10:00:00Z',
        rejectedAt: '2026-11-01T11:00:00Z',
        rejectedBy: 'admin_user',
        rejectedByName: 'Store Admin',
        rejectionReason: 'Invalid face scan, please retry in good lighting.',
        faceRejectionReason: 'Lighting was too dark',
        deviceRejectionReason: 'Emulator detected',
      });

      // Pending Staff profile (for duplicate resubmission and device immutability testing)
      await setDoc(doc(db, 'users/staff_pending'), {
        id: 'staff_pending',
        name: 'Pending Staff',
        email: 'pending@parthmobile.com',
        phone: '9876543211',
        role: 'staff',
        designation: 'Sales Executive',
        joinedDate: '2026-11-01',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        registrationStatus: 'pending',
        emailVerified: true,
        faceEnrollmentStatus: 'pending_review',
        faceModelVersion: 'facenet_512',
        faceRegistrationDate: '2026-11-01T10:00:00Z',
        hasFaceRegistered: false,
        deviceId: 'dev_pending_123',
        deviceModel: 'Pixel 7',
        devicePlatform: 'android',
        deviceRegisteredAt: '2026-11-01T10:00:00Z',
        deviceBindingStatus: 'pending_approval',
        devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
        createdAt: '2026-11-01T10:00:00Z',
        createdBy: 'staff_pending',
        _syncedAt: '2026-11-01T10:00:00Z',
      });
    });
  });

  const getValidRegistrationPayload = (uid: string, email: string) => ({
    id: uid,
    name: 'Applicant Candidate',
    email: email,
    phone: '9876543218',
    role: 'staff',
    designation: 'Sales Executive',
    joinedDate: '2026-11-04',
    basicSalary: 0,
    monthlyTarget: 0,
    isActive: false,
    registrationStatus: 'pending',
    emailVerified: true,
    faceEnrollmentStatus: 'pending_review',
    faceModelVersion: 'facenet_512',
    faceRegistrationDate: '2026-11-04T12:00:00Z',
    hasFaceRegistered: false,
    deviceId: 'dev_candidate_123',
    deviceModel: 'Samsung A54',
    devicePlatform: 'android',
    deviceRegisteredAt: '2026-11-04T12:00:00Z',
    deviceBindingStatus: 'pending_approval',
    devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAOCAQ8AMIIBCgKCAQEA...',
    createdAt: '2026-11-04T12:00:00Z',
    createdBy: uid,
    _syncedAt: '2026-11-04T12:00:00Z',
  });

  // -----------------------------------------------------------------
  // 1-5: Staff Registration Creation Scenarios
  // -----------------------------------------------------------------
  describe('Staff Registration Creation (allow create)', () => {
    it('1. Staff registration create (verified email, pending status, salary 0) -> ALLOW', async () => {
      const uid = 'candidate_001';
      const email = 'candidate001@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: true,
      });
      const db = staffContext.firestore();

      const payload = getValidRegistrationPayload(uid, email);
      await assertSucceeds(setDoc(doc(db, `users/${uid}`), payload));
    });

    it('2. Staff registration create without email verification -> DENY', async () => {
      const uid = 'candidate_unverified';
      const email = 'unverified@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: false, // NOT verified
      });
      const db = staffContext.firestore();

      const payload = getValidRegistrationPayload(uid, email);
      await assertFails(setDoc(doc(db, `users/${uid}`), payload));
    });

    it('3. Staff registration create with role="admin" -> DENY', async () => {
      const uid = 'candidate_role_tamper';
      const email = 'tamper_role@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: true,
      });
      const db = staffContext.firestore();

      const payload = {
        ...getValidRegistrationPayload(uid, email),
        role: 'admin', // Privilege escalation attempt
      };
      await assertFails(setDoc(doc(db, `users/${uid}`), payload));
    });

    it('4. Staff registration create with salary > 0 -> DENY', async () => {
      const uid = 'candidate_salary_tamper';
      const email = 'tamper_salary@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: true,
      });
      const db = staffContext.firestore();

      const payload = {
        ...getValidRegistrationPayload(uid, email),
        basicSalary: 50000, // Illegal compensation self-assignment
      };
      await assertFails(setDoc(doc(db, `users/${uid}`), payload));
    });

    it('5. Staff registration create with isActive=true -> DENY', async () => {
      const uid = 'candidate_active_tamper';
      const email = 'tamper_active@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: true,
      });
      const db = staffContext.firestore();

      const payload = {
        ...getValidRegistrationPayload(uid, email),
        isActive: true, // Illegal self-activation
      };
      await assertFails(setDoc(doc(db, `users/${uid}`), payload));
    });
  });

  // -----------------------------------------------------------------
  // 6-10: Staff Resubmission & State Transition Scenarios
  // -----------------------------------------------------------------
  describe('Staff Registration Resubmission & Transitions (allow update)', () => {
    it('6. Staff resubmission when rejected, preserving old rejection metadata -> ALLOW', async () => {
      const uid = 'staff_rejected';
      const email = 'rejected@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: true,
      });
      const db = staffContext.firestore();

      // Mobile app resubmits with merge: true (can supply replacement device when rejected)
      const resubmissionPayload = {
        id: uid,
        name: 'Rejected Staff Resubmitted',
        email: email,
        phone: '9876543212',
        role: 'staff',
        designation: 'Sales Executive',
        joinedDate: '2026-11-01',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        registrationStatus: 'pending', // Reverts to pending
        emailVerified: true,
        faceEnrollmentStatus: 'pending_review',
        faceModelVersion: 'facenet_512',
        faceRegistrationDate: '2026-11-04T15:00:00Z',
        hasFaceRegistered: false,
        deviceId: 'dev_rejected_new_123',
        deviceModel: 'Pixel 8',
        devicePlatform: 'android',
        deviceRegisteredAt: '2026-11-04T15:00:00Z',
        deviceBindingStatus: 'pending_approval',
        devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
        createdAt: '2026-11-01T10:00:00Z',
        createdBy: uid,
        _syncedAt: '2026-11-04T15:00:00Z',
      };

      await assertSucceeds(setDoc(doc(db, `users/${uid}`), resubmissionPayload, { merge: true }));
    });

    it('7. Staff resubmission when rejected, trying to self-approve -> DENY', async () => {
      const uid = 'staff_rejected';
      const email = 'rejected@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: true,
      });
      const db = staffContext.firestore();

      const illegalApprove = {
        faceEnrollmentStatus: 'approved',
        deviceBindingStatus: 'approved',
        hasFaceRegistered: true,
      };

      await assertFails(updateDoc(doc(db, `users/${uid}`), illegalApprove));
    });

    it('8. Staff resubmission when rejected, trying to change salary/target -> DENY', async () => {
      const uid = 'staff_rejected';
      const email = 'rejected@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: true,
      });
      const db = staffContext.firestore();

      const illegalSalary = {
        basicSalary: 45000,
        monthlyTarget: 300000,
      };

      await assertFails(updateDoc(doc(db, `users/${uid}`), illegalSalary));
    });

    it('9. Duplicate staff submission when already pending -> ALLOW', async () => {
      const uid = 'staff_pending';
      const email = 'pending@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: true,
      });
      const db = staffContext.firestore();

      // Idempotent duplicate re-save with merge: true keeping original registered device identity
      const duplicatePayload = {
        id: uid,
        name: 'Pending Staff Updated',
        email: email,
        phone: '9876543211',
        role: 'staff',
        designation: 'Sales Executive',
        joinedDate: '2026-11-01',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        registrationStatus: 'pending',
        emailVerified: true,
        faceEnrollmentStatus: 'pending_review',
        faceModelVersion: 'facenet_512',
        faceRegistrationDate: '2026-11-04T16:00:00Z',
        hasFaceRegistered: false,
        deviceId: 'dev_pending_123', // Matches registered device
        deviceModel: 'Pixel 7', // Matches registered device
        devicePlatform: 'android', // Matches registered device
        deviceRegisteredAt: '2026-11-01T10:00:00Z', // Matches registered device
        deviceBindingStatus: 'pending_approval',
        devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...', // Matches registered device
        createdAt: '2026-11-01T10:00:00Z',
        createdBy: uid,
        _syncedAt: '2026-11-04T16:00:00Z',
      };

      await assertSucceeds(setDoc(doc(db, `users/${uid}`), duplicatePayload, { merge: true }));
    });

    it('10. Active staff trying to reset status via registration branch -> DENY', async () => {
      const uid = 'staff_ramesh';
      const email = 'ramesh@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: true,
      });
      const db = staffContext.firestore();

      // Attempt to demote/reset approved staff via registration branch
      const illegalReset = {
        registrationStatus: 'pending',
        isActive: false,
        basicSalary: 0,
        monthlyTarget: 0,
      };

      await assertFails(updateDoc(doc(db, `users/${uid}`), illegalReset));
    });
  });

  // -----------------------------------------------------------------
  // 11-13: Staff Profile Read Scenarios (allow read)
  // -----------------------------------------------------------------
  describe('Staff Profile Read Permissions (allow read)', () => {
    it('11. Staff reading another staff profile -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Ramesh tries to read Suresh's profile
      await assertFails(getDoc(doc(db, 'users/staff_suresh')));
      // Ramesh tries to read Admin profile
      await assertFails(getDoc(doc(db, 'users/admin_user')));
    });

    it('12. Staff reading own profile -> ALLOW', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Ramesh reads his own profile
      await assertSucceeds(getDoc(doc(db, 'users/staff_ramesh')));
    });

    it('13. Admin reading any staff profile -> ALLOW', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user', {
        email: 'admin@parthmobile.com',
      });
      const db = adminContext.firestore();

      // Admin reads Ramesh
      await assertSucceeds(getDoc(doc(db, 'users/staff_ramesh')));
      // Admin reads Suresh
      await assertSucceeds(getDoc(doc(db, 'users/staff_suresh')));
      // Admin reads rejected staff
      await assertSucceeds(getDoc(doc(db, 'users/staff_rejected')));
      // Admin reads pending staff
      await assertSucceeds(getDoc(doc(db, 'users/staff_pending')));
    });
  });

  // -----------------------------------------------------------------
  // 14-15: Admin Authorization Hardening Scenarios
  // -----------------------------------------------------------------
  describe('Admin Authorization Hardening (isAdmin())', () => {
    it('14. User with spoofed admin email in auth token but no admin role -> DENY admin actions', async () => {
      // Attacker creates Auth account with admin@parthmobile.com
      const spoofUid = 'attacker_spoofed_email';
      const spoofContext = testEnv.authenticatedContext(spoofUid, {
        email: 'admin@parthmobile.com',
      });
      const db = spoofContext.firestore();

      // Attacker tries to read Ramesh's profile as if they were admin
      await assertFails(getDoc(doc(db, 'users/staff_ramesh')));

      // Attacker tries to update another staff profile
      await assertFails(updateDoc(doc(db, 'users/staff_suresh'), {
        isActive: false,
      }));
    });

    it('15. Inactive admin with valid custom claim role="admin" -> DENY admin actions', async () => {
      // Token carries stale custom claim role: 'admin', but Firestore document has isActive: false
      const inactiveAdminContext = testEnv.authenticatedContext('admin_inactive', {
        email: 'inactive_admin@parthmobile.com',
        role: 'admin', // Stale custom claim
      });
      const db = inactiveAdminContext.firestore();

      // Inactive admin tries to read another user's profile
      await assertFails(getDoc(doc(db, 'users/staff_ramesh')));

      // Inactive admin tries to approve staff
      await assertFails(updateDoc(doc(db, 'users/staff_pending'), {
        registrationStatus: 'approved',
        isActive: true,
      }));
    });
  });

  // -----------------------------------------------------------------
  // 16-21: Device Identity & Metadata Immutability Scenarios
  // -----------------------------------------------------------------
  describe('Device Identity & Metadata Immutability', () => {
    it('16. Pending staff cannot modify deviceId -> DENY', async () => {
      const uid = 'staff_pending';
      const staffContext = testEnv.authenticatedContext(uid, {
        email: 'pending@parthmobile.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      await assertFails(updateDoc(doc(db, `users/${uid}`), {
        deviceId: 'tampered_device_999',
      }));
    });

    it('17. Pending staff cannot modify devicePublicKey -> DENY', async () => {
      const uid = 'staff_pending';
      const staffContext = testEnv.authenticatedContext(uid, {
        email: 'pending@parthmobile.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      await assertFails(updateDoc(doc(db, `users/${uid}`), {
        devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA_TAMPERED',
      }));
    });

    it('18. Pending staff cannot change deviceModel -> DENY', async () => {
      const uid = 'staff_pending';
      const staffContext = testEnv.authenticatedContext(uid, {
        email: 'pending@parthmobile.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      await assertFails(updateDoc(doc(db, `users/${uid}`), {
        deviceModel: 'iPhone 15 Pro Max',
      }));
    });

    it('19. Staff cannot change createdAt on resubmission or profile update -> DENY', async () => {
      const uid = 'staff_pending';
      const staffContext = testEnv.authenticatedContext(uid, {
        email: 'pending@parthmobile.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      await assertFails(updateDoc(doc(db, `users/${uid}`), {
        createdAt: '2020-01-01T00:00:00Z',
      }));
    });

    it('20. Staff cannot change createdBy on resubmission or profile update -> DENY', async () => {
      const uid = 'staff_pending';
      const staffContext = testEnv.authenticatedContext(uid, {
        email: 'pending@parthmobile.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      await assertFails(updateDoc(doc(db, `users/${uid}`), {
        createdBy: 'admin_user',
      }));
    });

    it('21. Staff cannot alter Admin rejection metadata -> DENY', async () => {
      const uid = 'staff_rejected';
      const staffContext = testEnv.authenticatedContext(uid, {
        email: 'rejected@parthmobile.com',
        email_verified: true,
      });
      const db = staffContext.firestore();

      // Attempt to tamper with rejection reason or reviewer fields
      await assertFails(updateDoc(doc(db, `users/${uid}`), {
        rejectionReason: 'Tampered reason',
      }));
      await assertFails(updateDoc(doc(db, `users/${uid}`), {
        rejectedBy: 'nobody',
      }));
      await assertFails(updateDoc(doc(db, `users/${uid}`), {
        rejectedByName: 'Nobody',
      }));
    });
  });

  // -----------------------------------------------------------------
  // 22: Complete Schema Validation Checks
  // -----------------------------------------------------------------
  describe('Complete Schema Validation in isValidUser()', () => {
    it('22. Invalid optional field types are denied -> DENY', async () => {
      const uid = 'candidate_invalid_types';
      const email = 'invalid_types@parthmobile.com';
      const staffContext = testEnv.authenticatedContext(uid, {
        email,
        email_verified: true,
      });
      const db = staffContext.firestore();

      // Disallowed devicePlatform
      await assertFails(setDoc(doc(db, `users/${uid}`), {
        ...getValidRegistrationPayload(uid, email),
        devicePlatform: 'windows',
      }));

      // Non-string deviceModel
      await assertFails(setDoc(doc(db, `users/${uid}`), {
        ...getValidRegistrationPayload(uid, email),
        deviceModel: 12345,
      }));

      // Negative basicSalary
      await assertFails(setDoc(doc(db, `users/${uid}`), {
        ...getValidRegistrationPayload(uid, email),
        basicSalary: -100,
      }));

      // Disallowed deviceBindingStatus
      await assertFails(setDoc(doc(db, `users/${uid}`), {
        ...getValidRegistrationPayload(uid, email),
        deviceBindingStatus: 'super_approved',
      }));
    });
  });

  // -----------------------------------------------------------------
  // 23-25: Approved Staff Legitimate Operations
  // -----------------------------------------------------------------
  describe('Approved Staff Legitimate Modules', () => {
    it('23. Existing approved staff can punch in on their approved device -> ALLOW', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();
      const attId = 'att_staff_ramesh_2026-11-04';

      await assertSucceeds(setDoc(doc(db, `attendance/${attId}`), {
        id: attId,
        userId: 'staff_ramesh',
        userName: 'Ramesh Patel',
        userRole: 'staff',
        date: '2026-11-04',
        punchInTime: '09:00:00',
        status: 'present',
        totalHours: 0,
        isLate: false,
        isEarlyExit: false,
        deviceId: 'dev_ramesh_123',
      }));
    });

    it('24. Existing approved staff can update profile fields (name, phone) -> ALLOW', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(updateDoc(doc(db, 'users/staff_ramesh'), {
        name: 'Ramesh K Patel',
        phone: '9876543299',
      }));
    });

    it('25. Existing approved staff can submit device change request -> ALLOW', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();
      const reqId = 'dcr_staff_ramesh_001';

      await assertSucceeds(setDoc(doc(db, `device_change_requests/${reqId}`), {
        id: reqId,
        userId: 'staff_ramesh',
        userName: 'Ramesh Patel',
        userEmail: 'ramesh@parthmobile.com',
        newDeviceId: 'dev_ramesh_new_456',
        newDeviceModel: 'Pixel 9',
        newDevicePlatform: 'android',
        newDevicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
        reason: 'Upgraded my phone to Pixel 9',
        status: 'pending',
        createdAt: '2026-11-04T12:00:00Z',
      }));
    });
  });

  // -----------------------------------------------------------------
  // 26-27: Admin Web Dashboard Approval & Rejection Operations
  // -----------------------------------------------------------------
  describe('Admin Web Dashboard Operations', () => {
    it('26. Admin can approve pending staff registration -> ALLOW', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user', {
        email: 'admin@parthmobile.com',
      });
      const db = adminContext.firestore();

      await assertSucceeds(updateDoc(doc(db, 'users/staff_pending'), {
        registrationStatus: 'approved',
        isActive: true,
        basicSalary: 22000,
        monthlyTarget: 250000,
        faceEnrollmentStatus: 'approved',
        hasFaceRegistered: true,
        deviceBindingStatus: 'approved',
        approvedAt: '2026-11-04T17:00:00Z',
        approvedBy: 'admin_user',
        approvedByName: 'Store Admin',
      }));
    });

    it('27. Admin can reject pending staff registration -> ALLOW', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user', {
        email: 'admin@parthmobile.com',
      });
      const db = adminContext.firestore();

      await assertSucceeds(updateDoc(doc(db, 'users/staff_pending'), {
        registrationStatus: 'rejected',
        rejectionReason: 'Photo not clear enough',
        rejectedAt: '2026-11-04T17:00:00Z',
        rejectedBy: 'admin_user',
        rejectedByName: 'Store Admin',
      }));
    });
  });

  // -----------------------------------------------------------------
  // 28-53: Post-Hardening Security Remediation Verification
  // -----------------------------------------------------------------
  describe('Post-Hardening Security Remediation Verification', () => {
    it('28. Staff cannot read customer Aadhaar/KYC in kyc_sensitive subcollection -> DENY', async () => {
      // Seed a second-hand purchase and sensitive KYC record
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'second_hand_purchases/shp_001'), {
          id: 'shp_001',
          brand: 'Samsung',
          model: 'Galaxy S23',
          imei: '351234567890123',
          condition: 'good',
          purchaseAmount: 35000,
          purchaseDate: '2026-11-04',
          purchaseTime: '10:00:00',
          purchasedByStaffId: 'staff_ramesh',
          purchasedByStaffName: 'Ramesh Patel',
          status: 'in_stock',
          hasSensitiveKyc: true,
        });

        await setDoc(doc(db, 'second_hand_purchases/shp_001/kyc_sensitive/record'), {
          id: 'record',
          purchaseId: 'shp_001',
          customerName: 'Aarav Sharma',
          phone: '9876543210',
          aadhaarNumber: '123456789012',
          address: '42 MG Road, Ahmedabad',
          recordedByStaffId: 'staff_ramesh',
          recordedByStaffName: 'Ramesh Patel',
          createdAt: '2026-11-04T10:00:00Z',
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Even the staff who recorded the purchase cannot read the isolated KYC subcollection!
      await assertFails(getDoc(doc(db, 'second_hand_purchases/shp_001/kyc_sensitive/record')));
    });

    it('29. Admin can read customer Aadhaar/KYC in kyc_sensitive subcollection -> ALLOW', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user', {
        email: 'admin@parthmobile.com',
      });
      const db = adminContext.firestore();

      await assertSucceeds(getDoc(doc(db, 'second_hand_purchases/shp_001/kyc_sensitive/record')));
    });

    it('30. Staff cannot write Aadhaar or customer KYC to purchase parent document -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Attempting to inject customer Aadhaar or KYC photo into the parent inventory document must fail validation
      await assertFails(setDoc(doc(db, 'second_hand_purchases/shp_leak_001'), {
        id: 'shp_leak_001',
        brand: 'Apple',
        model: 'iPhone 13',
        imei: '359876543210981',
        condition: 'good',
        purchaseAmount: 32000,
        purchaseDate: '2026-11-04',
        purchaseTime: '11:00:00',
        purchasedByStaffId: 'staff_ramesh',
        purchasedByStaffName: 'Ramesh Patel',
        status: 'in_stock',
        aadhaarNumber: '123456789012', // Sensitive KYC forbidden on parent
      }));
    });

    it('31. Staff can write pure inventory second-hand purchase without customer private data -> ALLOW', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(setDoc(doc(db, 'second_hand_purchases/shp_002'), {
        id: 'shp_002',
        brand: 'Apple',
        model: 'iPhone 14',
        imei: '359876543210987',
        condition: 'excellent',
        purchaseAmount: 42000,
        purchaseDate: '2026-11-04',
        purchaseTime: '11:30:00',
        purchasedByStaffId: 'staff_ramesh',
        purchasedByStaffName: 'Ramesh Patel',
        status: 'in_stock',
        hasSensitiveKyc: true,
      }));
    });

    it('32. Staff cannot create KYC under another employee purchase -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'second_hand_purchases/shp_suresh_001'), {
          id: 'shp_suresh_001',
          brand: 'OnePlus',
          model: '11R',
          imei: '358765432109876',
          condition: 'good',
          purchaseAmount: 26000,
          purchaseDate: '2026-11-04',
          purchaseTime: '12:00:00',
          purchasedByStaffId: 'staff_suresh',
          purchasedByStaffName: 'Suresh Kumar',
          status: 'in_stock',
          hasSensitiveKyc: true,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Ramesh tries to create KYC for Suresh's purchase -> must be denied!
      await assertFails(setDoc(doc(db, 'second_hand_purchases/shp_suresh_001/kyc_sensitive/record'), {
        id: 'record',
        purchaseId: 'shp_suresh_001',
        customerName: 'Unauthorized Customer',
        phone: '9876543210',
        aadhaarNumber: '999988887777',
        address: 'MG Road',
        recordedByStaffId: 'staff_ramesh',
        recordedByStaffName: 'Ramesh Patel',
      }));
    });

    it('33. Staff can create KYC under their own purchase when parent purchase exists -> ALLOW', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'second_hand_purchases/shp_002'), {
          id: 'shp_002',
          brand: 'Apple',
          model: 'iPhone 14',
          imei: '359876543210987',
          condition: 'excellent',
          purchaseAmount: 42000,
          purchaseDate: '2026-11-04',
          purchaseTime: '11:30:00',
          purchasedByStaffId: 'staff_ramesh',
          purchasedByStaffName: 'Ramesh Patel',
          status: 'in_stock',
          hasSensitiveKyc: true,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // shp_002 was purchased by staff_ramesh
      await assertSucceeds(setDoc(doc(db, 'second_hand_purchases/shp_002/kyc_sensitive/record'), {
        id: 'record',
        purchaseId: 'shp_002',
        customerName: 'Pooja Verma',
        phone: '9876543219',
        aadhaarNumber: '555566667777',
        address: 'CG Road, Ahmedabad',
        recordedByStaffId: 'staff_ramesh',
        recordedByStaffName: 'Ramesh Patel',
      }));
    });

    it('34. Staff cannot update or delete KYC records after submission -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'second_hand_purchases/shp_002'), {
          id: 'shp_002',
          brand: 'Apple',
          model: 'iPhone 14',
          imei: '359876543210987',
          condition: 'excellent',
          purchaseAmount: 42000,
          purchaseDate: '2026-11-04',
          purchaseTime: '11:30:00',
          purchasedByStaffId: 'staff_ramesh',
          purchasedByStaffName: 'Ramesh Patel',
          status: 'in_stock',
          hasSensitiveKyc: true,
        });

        await setDoc(doc(db, 'second_hand_purchases/shp_002/kyc_sensitive/record'), {
          id: 'record',
          purchaseId: 'shp_002',
          customerName: 'Pooja Verma',
          phone: '9876543219',
          aadhaarNumber: '555566667777',
          address: 'CG Road, Ahmedabad',
          recordedByStaffId: 'staff_ramesh',
          recordedByStaffName: 'Ramesh Patel',
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Ramesh tries to update customer Aadhaar in KYC record
      await assertFails(updateDoc(doc(db, 'second_hand_purchases/shp_002/kyc_sensitive/record'), {
        aadhaarNumber: '000011112222',
      }));

      // Ramesh tries to delete KYC record
      await assertFails(deleteDoc(doc(db, 'second_hand_purchases/shp_002/kyc_sensitive/record')));
    });

    it('35. Staff cannot write Aadhaar to sales parent document -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Attempting to include Aadhaar in parent sale document
      await assertFails(setDoc(doc(db, 'second_hand_sales/sale_leak_001'), {
        id: 'sale_leak_001',
        buyerName: 'Buyer With Aadhaar',
        phone: '9876543210',
        address: 'Ahmedabad',
        aadhaarNumber: '123456789012', // Forbidden in parent sale
        brand: 'Apple',
        model: 'iPhone 14',
        imei: '359876543210987',
        sellingAmount: 48000,
        purchaseAmount: 42000,
        profitAmount: 6000,
        marginPercent: 14.3,
        invoiceNumber: 'PMC-INV-001',
        digitalSignatureUri: 'data:image/png;base64,sig',
        saleDate: '2026-11-04',
        saleTime: '15:00:00',
        soldByStaffId: 'staff_ramesh',
        soldByStaffName: 'Ramesh Patel',
        paymentMethod: 'UPI',
      }));
    });

    it('36. Staff can write pure sales parent document -> ALLOW', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(setDoc(doc(db, 'second_hand_sales/sale_ramesh_001'), {
        id: 'sale_ramesh_001',
        buyerName: 'Vikram Mehta',
        phone: '9876543210',
        address: 'Satellite, Ahmedabad',
        brand: 'Apple',
        model: 'iPhone 14',
        imei: '359876543210987',
        sellingAmount: 48000,
        purchaseAmount: 42000,
        profitAmount: 6000,
        marginPercent: 14.3,
        invoiceNumber: 'PMC-INV-001',
        digitalSignatureUri: 'data:image/png;base64,sig',
        saleDate: '2026-11-04',
        saleTime: '15:00:00',
        soldByStaffId: 'staff_ramesh',
        soldByStaffName: 'Ramesh Patel',
        paymentMethod: 'UPI',
        hasSensitiveKyc: true,
      }));
    });

    it('37. Staff cannot read another staff member sales document -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'second_hand_sales/sale_suresh_001'), {
          id: 'sale_suresh_001',
          buyerName: 'Suresh Buyer',
          phone: '9876543299',
          address: 'Maninagar',
          brand: 'Samsung',
          model: 'Galaxy S22',
          imei: '357890123456789',
          sellingAmount: 30000,
          purchaseAmount: 24000,
          profitAmount: 6000,
          marginPercent: 25.0,
          invoiceNumber: 'PMC-INV-002',
          digitalSignatureUri: 'data:image/png;base64,sig',
          saleDate: '2026-11-04',
          saleTime: '16:00:00',
          soldByStaffId: 'staff_suresh',
          soldByStaffName: 'Suresh Kumar',
          paymentMethod: 'Cash',
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Ramesh tries to read Suresh's sales doc -> DENY
      await assertFails(getDoc(doc(db, 'second_hand_sales/sale_suresh_001')));
    });

    it('38. Staff can read their own sales document -> ALLOW', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'second_hand_sales/sale_ramesh_001'), {
          id: 'sale_ramesh_001',
          buyerName: 'Vikram Mehta',
          phone: '9876543210',
          address: 'Satellite, Ahmedabad',
          brand: 'Apple',
          model: 'iPhone 14',
          imei: '359876543210987',
          sellingAmount: 48000,
          purchaseAmount: 42000,
          profitAmount: 6000,
          marginPercent: 14.3,
          invoiceNumber: 'PMC-INV-001',
          digitalSignatureUri: 'data:image/png;base64,sig',
          saleDate: '2026-11-04',
          saleTime: '15:00:00',
          soldByStaffId: 'staff_ramesh',
          soldByStaffName: 'Ramesh Patel',
          paymentMethod: 'UPI',
          hasSensitiveKyc: true,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Ramesh reads his own sale
      await assertSucceeds(getDoc(doc(db, 'second_hand_sales/sale_ramesh_001')));
    });

    it('39. Staff cannot read buyer Aadhaar from sales kyc_sensitive subcollection -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'second_hand_sales/sale_ramesh_001/kyc_sensitive/record'), {
          id: 'record',
          saleId: 'sale_ramesh_001',
          buyerName: 'Vikram Mehta',
          phone: '9876543210',
          aadhaarNumber: '888899990000',
          address: 'Satellite, Ahmedabad',
          recordedByStaffId: 'staff_ramesh',
          recordedByStaffName: 'Ramesh Patel',
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Staff cannot read isolated sale KYC subcollection
      await assertFails(getDoc(doc(db, 'second_hand_sales/sale_ramesh_001/kyc_sensitive/record')));
    });

    it('40. Admin can read all purchases, sales, and KYC documents -> ALLOW', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user', {
        email: 'admin@parthmobile.com',
      });
      const db = adminContext.firestore();

      await assertSucceeds(getDoc(doc(db, 'second_hand_purchases/shp_001')));
      await assertSucceeds(getDoc(doc(db, 'second_hand_purchases/shp_001/kyc_sensitive/record')));
      await assertSucceeds(getDoc(doc(db, 'second_hand_sales/sale_suresh_001')));
      await assertSucceeds(getDoc(doc(db, 'second_hand_sales/sale_ramesh_001/kyc_sensitive/record')));
    });

    it('41. Staff cannot read another staff member notifications -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_priya_001'), {
          id: 'notif_priya_001',
          userId: 'staff_priya',
          title: 'Private Staff Notice',
          body: 'Your salary slip has been generated',
          type: 'announcement',
          timestamp: '2026-11-04T12:00:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertFails(getDoc(doc(db, 'notifications/notif_priya_001')));
    });

    it('42. Staff can read their own notifications -> ALLOW', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_ramesh_001'), {
          id: 'notif_ramesh_001',
          userId: 'staff_ramesh',
          title: 'Purchase Recorded',
          body: 'Purchased phone',
          type: 'purchase',
          timestamp: '2026-11-04T09:00:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(getDoc(doc(db, 'notifications/notif_ramesh_001')));
    });

    it('43. Staff cannot create arbitrary notifications for another user -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertFails(setDoc(doc(db, 'notifications/notif_fake_priya'), {
        id: 'notif_fake_priya',
        userId: 'staff_priya', // Forged recipient
        title: 'Forged Alert',
        body: 'Fake alert from another staff',
        type: 'purchase',
        timestamp: '2026-11-04T12:00:00Z',
        read: false,
      }));
    });

    it('44. Staff cannot create fake attendance notifications -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Attendance notification creation is forbidden for staff
      await assertFails(setDoc(doc(db, 'notifications/notif_fake_attendance'), {
        id: 'notif_fake_attendance',
        userId: 'staff_ramesh',
        title: 'Fake Verified Punch In',
        body: 'Punched in remotely',
        type: 'attendance',
        timestamp: '2026-11-04T09:00:00Z',
        read: false,
      }));
    });

    it('45. Staff cannot create fake announcement or payroll notifications -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertFails(setDoc(doc(db, 'notifications/notif_fake_announcement'), {
        id: 'notif_fake_announcement',
        userId: 'staff_ramesh',
        title: 'Store Holiday Announced',
        body: 'Store will be closed tomorrow',
        type: 'announcement',
        timestamp: '2026-11-04T09:00:00Z',
        read: false,
      }));
    });

    it('46. Staff can create legitimate client workflow notification -> ALLOW', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(setDoc(doc(db, 'notifications/notif_legit_lead'), {
        id: 'notif_legit_lead',
        userId: 'staff_ramesh',
        title: 'New Lead Added',
        body: 'Customer interested in iPhone 15',
        type: 'lead',
        timestamp: '2026-11-04T10:00:00Z',
        read: false,
      }));
    });

    it('47. Staff can update only their own notification read status without altering body/title -> ALLOW', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_ramesh_001'), {
          id: 'notif_ramesh_001',
          userId: 'staff_ramesh',
          title: 'Purchase Recorded',
          body: 'Purchased phone',
          type: 'purchase',
          timestamp: '2026-11-04T09:00:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(updateDoc(doc(db, 'notifications/notif_ramesh_001'), {
        read: true,
      }));
    });

    it('48. Staff cannot alter notification title/body/type/userId on update -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_ramesh_001'), {
          id: 'notif_ramesh_001',
          userId: 'staff_ramesh',
          title: 'Purchase Recorded',
          body: 'Purchased phone',
          type: 'purchase',
          timestamp: '2026-11-04T09:00:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertFails(updateDoc(doc(db, 'notifications/notif_ramesh_001'), {
        title: 'Tampered Title',
        read: true,
      }));
    });

    it('49. Staff cannot forge Punch Out totalHours > 16 -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'attendance/att_ramesh_today'), {
          id: 'att_ramesh_today',
          userId: 'staff_ramesh',
          userName: 'Ramesh Patel',
          userRole: 'staff',
          date: '2026-11-04',
          punchInTime: '09:00:00',
          status: 'present',
          totalHours: 0,
          isLate: false,
          isEarlyExit: false,
          deviceId: 'dev_ramesh_123',
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Attempting to submit 24 hours for a single shift must be blocked
      await assertFails(updateDoc(doc(db, 'attendance/att_ramesh_today'), {
        punchOutTime: '21:00:00',
        totalHours: 24,
      }));
    });

    it('50. Staff cannot alter punchInTime on punch out update -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Attempting to rewrite morning punch in time
      await assertFails(updateDoc(doc(db, 'attendance/att_ramesh_today'), {
        punchInTime: '08:00:00', // Rewritten from 09:00:00
        punchOutTime: '17:00:00',
        totalHours: 8,
      }));
    });

    it('51. Staff cannot write directly to salary_slips (authoritative payroll evidence) -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Staff trying to self-issue salary slip
      await assertFails(setDoc(doc(db, 'salary_slips/slip_ramesh_fake'), {
        id: 'slip_ramesh_fake',
        staffId: 'staff_ramesh',
        staffName: 'Ramesh Patel',
        month: '2026-11',
        basicSalary: 30000,
        netSalary: 35000,
        status: 'paid',
      }));
    });

    it('52. Staff cannot forge administrative attendance audit log -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Staff trying to forge an enrollment_approved action with fake adminId
      await assertFails(setDoc(doc(db, 'attendance_audit_logs/audit_fake_001'), {
        id: 'audit_fake_001',
        userId: 'staff_ramesh',
        userName: 'Ramesh Patel',
        action: 'enrollment_approved',
        adminId: 'admin_user',
        adminName: 'Store Admin',
        timestamp: '2026-11-04T15:00:00Z',
      }));
    });

    it('53. Staff can create their own client attendance audit log -> ALLOW', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(setDoc(doc(db, 'attendance_audit_logs/audit_ramesh_punch_in'), {
        id: 'audit_ramesh_punch_in',
        userId: 'staff_ramesh',
        userName: 'Ramesh Patel',
        action: 'punch_in',
        timestamp: '2026-11-04T09:00:00Z',
      }));
    });

    it('54. Admin can create broadcast announcement (userId: all, type: announcement) -> ALLOW', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user', {
        email: 'admin@parthmobile.com',
      });
      const db = adminContext.firestore();

      await assertSucceeds(setDoc(doc(db, 'notifications/notif_announcement_001'), {
        id: 'notif_announcement_001',
        userId: 'all',
        title: 'Happy New Year',
        body: 'Holiday schedule update for store team',
        type: 'announcement',
        timestamp: '2026-11-21T12:00:00Z',
        read: false,
      }));
    });

    it('55. Staff cannot create announcement (type: announcement) -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertFails(setDoc(doc(db, 'notifications/notif_fake_announcement'), {
        id: 'notif_fake_announcement',
        userId: 'staff_ramesh',
        title: 'Unauthorized announcement',
        body: 'Staff trying to create announcement',
        type: 'announcement',
        timestamp: '2026-11-21T12:00:00Z',
        read: false,
      }));
    });

    it('56. Staff cannot create notification with userId: all -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertFails(setDoc(doc(db, 'notifications/notif_broadcast_tamper'), {
        id: 'notif_broadcast_tamper',
        userId: 'all',
        title: 'Lead Follow-up',
        body: 'Lead inquiry notification',
        type: 'lead',
        timestamp: '2026-11-21T12:00:00Z',
        read: false,
      }));
    });

    it('57. Active staff can read broadcast announcement (userId: all) -> ALLOW', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_announcement_store'), {
          id: 'notif_announcement_store',
          userId: 'all',
          title: 'Store Meeting',
          body: 'Morning standup at 10 AM',
          type: 'announcement',
          timestamp: '2026-11-21T10:00:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(getDoc(doc(db, 'notifications/notif_announcement_store')));
    });

    it('58. Inactive staff cannot read broadcast announcement (userId: all) -> DENY', async () => {
      const inactiveStaffContext = testEnv.authenticatedContext('staff_rejected', {
        email: 'rejected@parthmobile.com',
      });
      const db = inactiveStaffContext.firestore();

      // staff_rejected has isActive=false in their user doc
      await assertFails(getDoc(doc(db, 'notifications/notif_announcement_store')));
    });

    it('59. Unauthenticated users cannot read broadcast announcement (userId: all) -> DENY', async () => {
      const unauthContext = testEnv.unauthenticatedContext();
      const db = unauthContext.firestore();

      await assertFails(getDoc(doc(db, 'notifications/notif_announcement_store')));
    });

    it('60. Active Admin can read broadcast announcement (userId: all) -> ALLOW', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user', {
        email: 'admin@parthmobile.com',
      });
      const db = adminContext.firestore();

      await assertSucceeds(getDoc(doc(db, 'notifications/notif_announcement_store')));
    });

    it('61. Inactive Admin cannot access Admin-protected operations (create announcement) -> DENY', async () => {
      const inactiveAdminContext = testEnv.authenticatedContext('admin_inactive', {
        email: 'inactive_admin@parthmobile.com',
      });
      const db = inactiveAdminContext.firestore();

      // admin_inactive has role='admin' but isActive=false
      await assertFails(setDoc(doc(db, 'notifications/notif_inactive_admin_announcement'), {
        id: 'notif_inactive_admin_announcement',
        userId: 'all',
        title: 'Tampered Broadcast',
        body: 'Inactive admin attempt',
        type: 'announcement',
        timestamp: '2026-11-21T12:00:00Z',
        read: false,
      }));
    });

    it('62. Inactive Admin cannot read notifications -> DENY', async () => {
      const inactiveAdminContext = testEnv.authenticatedContext('admin_inactive', {
        email: 'inactive_admin@parthmobile.com',
      });
      const db = inactiveAdminContext.firestore();

      await assertFails(getDoc(doc(db, 'notifications/notif_announcement_store')));
    });

    it('63. Active staff can read their own personalized notification -> ALLOW', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_ramesh_lead'), {
          id: 'notif_ramesh_lead',
          userId: 'staff_ramesh',
          title: 'New Lead Assigned',
          body: 'Customer interested in iPhone 15',
          type: 'lead',
          timestamp: '2026-11-21T10:30:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(getDoc(doc(db, 'notifications/notif_ramesh_lead')));
    });

    it('64. Inactive staff cannot read their own personalized notification -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_rejected_own'), {
          id: 'notif_rejected_own',
          userId: 'staff_rejected',
          title: 'Application Status',
          body: 'Your application was rejected',
          type: 'follow_up',
          timestamp: '2026-11-21T10:30:00Z',
          read: false,
        });
      });

      const inactiveStaffContext = testEnv.authenticatedContext('staff_rejected', {
        email: 'rejected@parthmobile.com',
      });
      const db = inactiveStaffContext.firestore();

      // Inactive staff cannot read even their own notifications
      await assertFails(getDoc(doc(db, 'notifications/notif_rejected_own')));
    });

    it('65. Staff cannot read another staff member personalized notification (cross-staff isolation) -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_suresh_private'), {
          id: 'notif_suresh_private',
          userId: 'staff_suresh',
          title: 'Suresh Private Notification',
          body: 'Private notification for Suresh',
          type: 'lead',
          timestamp: '2026-11-21T10:30:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Ramesh reading Suresh's notification is denied
      await assertFails(getDoc(doc(db, 'notifications/notif_suresh_private')));
    });

    it('66. Staff cannot tamper with announcement content or title -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_immutable_announcement'), {
          id: 'notif_immutable_announcement',
          userId: 'all',
          title: 'Store Policy',
          body: 'Official store hours: 10 AM to 9 PM',
          type: 'announcement',
          timestamp: '2026-11-21T09:00:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Tampering with title or body
      await assertFails(updateDoc(doc(db, 'notifications/notif_immutable_announcement'), {
        title: 'Store closed today',
      }));
    });

    it('67. Staff cannot delete announcement -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertFails(deleteDoc(doc(db, 'notifications/notif_announcement_store')));
    });

    it('68. Admin can delete announcement -> ALLOW', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user', {
        email: 'admin@parthmobile.com',
      });
      const db = adminContext.firestore();

      await assertSucceeds(deleteDoc(doc(db, 'notifications/notif_announcement_store')));
    });

    it('69. Admin query (orderBy timestamp desc, limit 50) -> ALLOW', async () => {
      const adminContext = testEnv.authenticatedContext('admin_user', {
        email: 'admin@parthmobile.com',
      });
      const db = adminContext.firestore();

      const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(50));
      await assertSucceeds(getDocs(q));
    });

    it('70. Staff scoped query for own notifications (where userId == uid) -> ALLOW', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      const q = query(collection(db, 'notifications'), where('userId', '==', 'staff_ramesh'));
      await assertSucceeds(getDocs(q));
    });

    it('71. Staff scoped query for broadcast announcements (where userId == all) -> ALLOW', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      const q = query(collection(db, 'notifications'), where('userId', '==', 'all'));
      await assertSucceeds(getDocs(q));
    });

    it('72. Staff unconstrained query without where clause (rules are not filters) -> DENY', async () => {
      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      // Querying all notifications without filtering by userId must fail for staff
      await assertFails(getDocs(collection(db, 'notifications')));
    });

    it('73. Inactive staff scoped query (where userId == staff_rejected) -> DENY', async () => {
      const inactiveStaffContext = testEnv.authenticatedContext('staff_rejected', {
        email: 'rejected@parthmobile.com',
      });
      const db = inactiveStaffContext.firestore();

      const q = query(collection(db, 'notifications'), where('userId', '==', 'staff_rejected'));
      await assertFails(getDocs(q));
    });

    it('74. Active staff can change read from false to true on their own notification -> ALLOW', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_ramesh_lead'), {
          id: 'notif_ramesh_lead',
          userId: 'staff_ramesh',
          title: 'New Lead Assigned',
          body: 'Customer interested in iPhone 15',
          type: 'lead',
          timestamp: '2026-11-21T10:30:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(updateDoc(doc(db, 'notifications/notif_ramesh_lead'), {
        read: true,
      }));
    });

    it('75. Active staff can change read from true to false and update _syncedAt -> ALLOW', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_ramesh_lead'), {
          id: 'notif_ramesh_lead',
          userId: 'staff_ramesh',
          title: 'New Lead Assigned',
          body: 'Customer interested in iPhone 15',
          type: 'lead',
          timestamp: '2026-11-21T10:30:00Z',
          read: true,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertSucceeds(updateDoc(doc(db, 'notifications/notif_ramesh_lead'), {
        read: false,
        _syncedAt: '2026-11-21T12:00:00Z',
      }));
    });

    it('76. Active staff cannot change title, body, type, timestamp, or userId -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_ramesh_lead'), {
          id: 'notif_ramesh_lead',
          userId: 'staff_ramesh',
          title: 'New Lead Assigned',
          body: 'Customer interested in iPhone 15',
          type: 'lead',
          timestamp: '2026-11-21T10:30:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertFails(updateDoc(doc(db, 'notifications/notif_ramesh_lead'), {
        title: 'Tampered Lead Title',
      }));

      await assertFails(updateDoc(doc(db, 'notifications/notif_ramesh_lead'), {
        body: 'Tampered Lead Body',
      }));

      await assertFails(updateDoc(doc(db, 'notifications/notif_ramesh_lead'), {
        type: 'announcement',
      }));

      await assertFails(updateDoc(doc(db, 'notifications/notif_ramesh_lead'), {
        userId: 'all',
      }));
    });

    it('77. Active staff cannot change relatedId or add arbitrary unapproved fields -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_ramesh_lead'), {
          id: 'notif_ramesh_lead',
          userId: 'staff_ramesh',
          title: 'New Lead Assigned',
          body: 'Customer interested in iPhone 15',
          type: 'lead',
          timestamp: '2026-11-21T10:30:00Z',
          read: false,
        });
      });

      const staffContext = testEnv.authenticatedContext('staff_ramesh', {
        email: 'ramesh@parthmobile.com',
      });
      const db = staffContext.firestore();

      await assertFails(updateDoc(doc(db, 'notifications/notif_ramesh_lead'), {
        relatedId: 'new_related_id',
      }));

      await assertFails(updateDoc(doc(db, 'notifications/notif_ramesh_lead'), {
        arbitraryField: 'malicious',
      }));
    });

    it('78. Inactive staff cannot mark notification as read -> DENY', async () => {
      await testEnv.withSecurityRulesDisabled(async (context: any) => {
        const db = context.firestore();
        await setDoc(doc(db, 'notifications/notif_rejected_own'), {
          id: 'notif_rejected_own',
          userId: 'staff_rejected',
          title: 'Application Status',
          body: 'Your application was rejected',
          type: 'follow_up',
          timestamp: '2026-11-21T10:30:00Z',
          read: false,
        });
      });

      const inactiveStaffContext = testEnv.authenticatedContext('staff_rejected', {
        email: 'rejected@parthmobile.com',
      });
      const db = inactiveStaffContext.firestore();

      await assertFails(updateDoc(doc(db, 'notifications/notif_rejected_own'), {
        read: true,
      }));
    });
  });
});
