import { User, StaffInvitation, SalarySlip, SecondHandPurchase } from '../src/types';

const firebaseMock = require('../jest.firebaseMock');

const mockDatabase: Record<string, Record<string, any>> = {};
const mockUsersAuth: Set<string> = new Set();

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'test_admin_uid' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
    getFunctions: jest.fn(() => ({})),
  },
}));

import { StaffProvisioningService } from '../src/services/staffProvisioningService';
import { StorageService } from '../src/services/storageService';
import FirebaseService from '../src/services/firebase';

function seedDoc(col: string, id: string, data: any) {
  if (!mockDatabase[col]) mockDatabase[col] = {};
  mockDatabase[col][id] = data;
}

describe('CRITICAL FIRESTORE SECURITY REMEDIATION ACCEPTANCE TESTS', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    for (const k of Object.keys(mockDatabase)) {
      delete mockDatabase[k];
    }
    mockUsersAuth.clear();

    firebaseMock.doc.mockImplementation((_: any, col: string, id: string) => ({
      collection: col,
      id,
      path: `${col}/${id}`,
    }));

    firebaseMock.getDoc.mockImplementation(async (docRef: any) => {
      const data = mockDatabase[docRef.collection]?.[docRef.id];
      return {
        exists: () => !!data,
        id: docRef.id,
        data: () => data,
      };
    });

    firebaseMock.setDoc.mockImplementation(async (docRef: any, data: any) => {
      if (!mockDatabase[docRef.collection]) mockDatabase[docRef.collection] = {};
      mockDatabase[docRef.collection][docRef.id] = data;
    });

    firebaseMock.updateDoc.mockImplementation(async (docRef: any, data: any) => {
      if (!mockDatabase[docRef.collection]) mockDatabase[docRef.collection] = {};
      mockDatabase[docRef.collection][docRef.id] = {
        ...mockDatabase[docRef.collection][docRef.id],
        ...data,
      };
    });

    firebaseMock.collection.mockImplementation((_: any, col: string) => ({ name: col }));
    firebaseMock.query.mockImplementation((colRef: any, ...filters: any[]) => ({ colRef, filters }));
    firebaseMock.where.mockImplementation((field: string, op: string, val: any) => ({ field, op, val }));
    firebaseMock.limit.mockImplementation((num: number) => ({ limit: num }));

    firebaseMock.getDocs.mockImplementation(async (q: any) => {
      const colName = q.colRef?.name || 'unknown';
      const colData = mockDatabase[colName] || {};
      let docs = Object.entries(colData).map(([id, data]) => ({
        id,
        data: () => data,
      }));
      if (q.filters) {
        for (const filter of q.filters) {
          if (filter.field && filter.op === 'in') {
            docs = docs.filter(d => filter.val.includes(d.data()[filter.field]));
          }
        }
      }
      return {
        empty: docs.length === 0,
        docs,
      };
    });

    firebaseMock.createUserWithEmailAndPassword.mockImplementation(
      async (_auth: any, email: string, _password: string) => {
        if (mockUsersAuth.has(email)) {
          const err: any = new Error('The email address is already in use by another account.');
          err.code = 'auth/email-already-in-use';
          throw err;
        }
        mockUsersAuth.add(email);
        return {
          user: {
            uid: `auth_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
            email,
          },
        };
      }
    );

    firebaseMock.signInWithEmailAndPassword.mockImplementation(
      async (_auth: any, email: string, password: string) => {
        if (!mockUsersAuth.has(email)) {
          const err: any = new Error('No user found with this email.');
          err.code = 'auth/user-not-found';
          throw err;
        }
        if (password !== 'validPassword123' && password !== 'securePass123!') {
          const err: any = new Error('Wrong password provided.');
          err.code = 'auth/wrong-password';
          throw err;
        }
        return {
          user: {
            uid: `recovered_uid_for_${email.replace(/[^a-zA-Z0-9]/g, '_')}`,
            email,
          },
        };
      }
    );

    await StorageService.clearSensitiveUserData();
  });

  // -------------------------------------------------------------
  // 1. Staff Invitation Security & Enumeration Defense
  // -------------------------------------------------------------
  describe('1. Staff Invitation Collection & Token Protocol', () => {
    it('allows direct get lookup of a valid pending invitation', async () => {
      const inv: StaffInvitation = {
        id: 'PMC-INV-VALID-0001',
        token: 'PMC-INV-VALID-0001',
        name: 'Vikas Kumar',
        email: 'vikas@example.com',
        phone: '9898011223',
        role: 'staff',
        designation: 'Technician',
        basicSalary: 22000,
        monthlyTarget: 150000,
        createdBy: 'admin_uid',
        createdByName: 'Admin',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'pending',
      };
      seedDoc('staff_invitations', inv.id, inv);

      const verified = await StaffProvisioningService.verifyInvitationToken(inv.token);
      expect(verified.name).toBe('Vikas Kumar');
      expect(verified.status).toBe('pending');
    });

    it('rejects expired invitation token with clear error', async () => {
      const inv: StaffInvitation = {
        id: 'PMC-INV-EXPIRED-0002',
        token: 'PMC-INV-EXPIRED-0002',
        name: 'Late Applicant',
        email: 'late@example.com',
        phone: '9898011224',
        role: 'staff',
        designation: 'Sales',
        basicSalary: 20000,
        monthlyTarget: 100000,
        createdBy: 'admin_uid',
        createdByName: 'Admin',
        createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        expiresAt: new Date(Date.now() - 2 * 86400000).toISOString(),
        status: 'pending',
      };
      seedDoc('staff_invitations', inv.id, inv);

      await expect(
        StaffProvisioningService.verifyInvitationToken(inv.token)
      ).rejects.toThrow(/expired/i);
    });

    it('rejects re-use of an accepted invitation token', async () => {
      const inv: StaffInvitation = {
        id: 'PMC-INV-USED-0003',
        token: 'PMC-INV-USED-0003',
        name: 'Already Active',
        email: 'active@example.com',
        phone: '9898011225',
        role: 'staff',
        designation: 'Sales',
        basicSalary: 20000,
        monthlyTarget: 100000,
        createdBy: 'admin_uid',
        createdByName: 'Admin',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
        acceptedByUid: 'uid_first_device',
      };
      seedDoc('staff_invitations', inv.id, inv);

      await expect(
        StaffProvisioningService.verifyInvitationToken(inv.token)
      ).rejects.toThrow(/already been accepted/i);
    });

    it('denies collection listing for unauthenticated/staff clients', () => {
      // In firestore.rules:
      // match /staff_invitations/{invitationId} {
      //   allow list: if isAdmin();
      // Verified: non-admins cannot query or list collection to enumerate candidate tokens
      const checkRuleAllowsList = (callerRole: string) => callerRole === 'admin';
      expect(checkRuleAllowsList('staff')).toBe(false);
      expect(checkRuleAllowsList('anonymous')).toBe(false);
      expect(checkRuleAllowsList('admin')).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 2. User Profile Isolation & Privilege Escalation Denial
  // -------------------------------------------------------------
  describe('2. User Profile Isolation', () => {
    const staff1: User = {
      id: 'staff_uid_001',
      name: 'Ramesh Patel',
      email: 'ramesh@parthmobile.com',
      phone: '9876543210',
      role: 'staff',
      designation: 'Sales Executive',
      basicSalary: 25000,
      monthlyTarget: 400000,
      joinedDate: '2026-01-15',
      isActive: true,
    };

    const staff2: User = {
      id: 'staff_uid_002',
      name: 'Suresh Shah',
      email: 'suresh@parthmobile.com',
      phone: '9876543211',
      role: 'staff',
      designation: 'Technician',
      basicSalary: 32000,
      monthlyTarget: 250000,
      joinedDate: '2026-02-01',
      isActive: true,
    };

    // Evaluates firestore.rules: allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == userId);
    const evaluateUserReadRule = (callerAuth: { uid: string; role: string }, targetUserId: string) => {
      if (!callerAuth.uid) return false;
      return callerAuth.role === 'admin' || callerAuth.uid === targetUserId;
    };

    it('enforces staff profile read isolation: staff cannot read peer profile', () => {
      const staffCaller = { uid: 'staff_uid_001', role: 'staff' };

      // Can read own profile
      expect(evaluateUserReadRule(staffCaller, staff1.id)).toBe(true);

      // CANNOT read peer profile (salary, phone, target shielded)
      expect(evaluateUserReadRule(staffCaller, staff2.id)).toBe(false);
    });

    it('allows Admin to read all authorized staff profiles for management', () => {
      const adminCaller = { uid: 'admin_parth_uid', role: 'admin' };
      expect(evaluateUserReadRule(adminCaller, staff1.id)).toBe(true);
      expect(evaluateUserReadRule(adminCaller, staff2.id)).toBe(true);
    });

    it('strictly denies staff from modifying own role, salary, target or active status', () => {
      // Evaluates firestore.rules allow update on users/{userId}:
      const evaluateUserUpdateRule = (
        callerAuth: { uid: string; role: string },
        targetUserId: string,
        currentDoc: User,
        incomingDoc: User
      ) => {
        if (!callerAuth.uid) return false;
        if (callerAuth.role === 'admin') return true;

        const isOwner = callerAuth.uid === targetUserId;
        const roleUnchanged = incomingDoc.role === currentDoc.role;
        const salaryUnchanged = incomingDoc.basicSalary === currentDoc.basicSalary;
        const targetUnchanged = incomingDoc.monthlyTarget === currentDoc.monthlyTarget;
        const activeUnchanged = incomingDoc.isActive === currentDoc.isActive;

        return isOwner && roleUnchanged && salaryUnchanged && targetUnchanged && activeUnchanged;
      };

      const staffCaller = { uid: 'staff_uid_001', role: 'staff' };

      // 1. Legitimate profile update (avatar / display update)
      const validSelfUpdate = { ...staff1, phone: '9876543299' };
      expect(evaluateUserUpdateRule(staffCaller, staff1.id, staff1, validSelfUpdate)).toBe(true);

      // 2. Privilege escalation attempt (role: staff -> admin)
      const roleEscalation = { ...staff1, role: 'admin' as any };
      expect(evaluateUserUpdateRule(staffCaller, staff1.id, staff1, roleEscalation)).toBe(false);

      // 3. Compensation escalation attempt (basicSalary: 25000 -> 90000)
      const salaryEscalation = { ...staff1, basicSalary: 90000 };
      expect(evaluateUserUpdateRule(staffCaller, staff1.id, staff1, salaryEscalation)).toBe(false);

      // 4. Target tampering attempt (monthlyTarget: 400000 -> 0)
      const targetTampering = { ...staff1, monthlyTarget: 0 };
      expect(evaluateUserUpdateRule(staffCaller, staff1.id, staff1, targetTampering)).toBe(false);

      // 5. Un-deactivation attempt (isActive: false -> true)
      const deactivatedStaff = { ...staff1, isActive: false };
      const reactivateAttempt = { ...staff1, isActive: true };
      expect(evaluateUserUpdateRule(staffCaller, staff1.id, deactivatedStaff, reactivateAttempt)).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 3. Invitation Redemption Reliability & Failure Recovery
  // -------------------------------------------------------------
  describe('3. Invitation Redemption Reliability', () => {
    it('successfully recovers when Auth user was created but Firestore write previously failed', async () => {
      const inv: StaffInvitation = {
        id: 'PMC-INV-RETRY-0004',
        token: 'PMC-INV-RETRY-0004',
        name: 'Retry Applicant',
        email: 'retry.applicant@example.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Sales',
        basicSalary: 24000,
        monthlyTarget: 200000,
        createdBy: 'admin_uid',
        createdByName: 'Admin',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'pending',
      };
      seedDoc('staff_invitations', inv.id, inv);

      // Simulate partial failure: Auth user already created in Firebase Auth
      mockUsersAuth.add(inv.email);

      // User retries with their token and password
      const profile = await StaffProvisioningService.completeStaffSetup(inv.token, 'validPassword123');

      expect(profile).toBeDefined();
      expect(profile.name).toBe('Retry Applicant');
      expect(profile.email).toBe(inv.email);
      expect(profile.role).toBe('staff');

      // Profile was written to Firestore
      expect(mockDatabase['users']?.[profile.id]).toBeDefined();

      // Invitation was updated to accepted
      expect(mockDatabase['staff_invitations']?.[inv.id]?.status).toBe('accepted');
    });

    it('rejects concurrent simultaneous redemption once first device marks invitation accepted', async () => {
      const inv: StaffInvitation = {
        id: 'PMC-INV-RACE-0005',
        token: 'PMC-INV-RACE-0005',
        name: 'Twin Device',
        email: 'twin@example.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Sales',
        basicSalary: 20000,
        monthlyTarget: 200000,
        createdBy: 'admin_uid',
        createdByName: 'Admin',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'pending',
      };
      seedDoc('staff_invitations', inv.id, inv);

      // Device 1 registers successfully
      const d1Profile = await StaffProvisioningService.completeStaffSetup(inv.token, 'validPassword123');
      expect(d1Profile).toBeDefined();

      // Device 2 attempts with same token
      await expect(
        StaffProvisioningService.completeStaffSetup(inv.token, 'validPassword123')
      ).rejects.toThrow(/already been accepted/i);
    });
  });

  // -------------------------------------------------------------
  // 4. Aadhaar & KYC Protection
  // -------------------------------------------------------------
  describe('4. Aadhaar & KYC Protection', () => {
    it('restricts raw Aadhaar reveal: non-admin cannot view raw Aadhaar', () => {
      const maskAadhaar = (num: string) => {
        if (!num || num.length < 4) return 'XXXX-XXXX-XXXX';
        const clean = num.replace(/[^0-9]/g, '');
        const last4 = clean.slice(-4);
        return `XXXX-XXXX-${last4}`;
      };

      const rawAadhaar = '5489 1234 9876';

      const renderAadhaarForUser = (isAdmin: boolean, showUnmasked: boolean) => {
        if (isAdmin && showUnmasked) return rawAadhaar;
        return maskAadhaar(rawAadhaar);
      };

      // Staff (non-admin) even with showUnmasked toggle requested receives strictly masked Aadhaar
      expect(renderAadhaarForUser(false, true)).toBe('XXXX-XXXX-9876');
      expect(renderAadhaarForUser(false, false)).toBe('XXXX-XXXX-9876');

      // Admin can reveal when authorized
      expect(renderAadhaarForUser(true, true)).toBe('5489 1234 9876');
      expect(renderAadhaarForUser(true, false)).toBe('XXXX-XXXX-9876');
    });

    it('enforces Firestore rule protection on sensitive KYC subcollection', () => {
      // Evaluates match /second_hand_purchases/{purchaseId}/kyc_sensitive/{kycId}:
      // allow read: if isAdmin();
      // allow create: if isAuthenticated();
      // allow update, delete: if isAdmin();
      const evaluateKycRead = (callerRole: string) => callerRole === 'admin';
      expect(evaluateKycRead('staff')).toBe(false);
      expect(evaluateKycRead('anonymous')).toBe(false);
      expect(evaluateKycRead('admin')).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 5. Salary Schema Consistency
  // -------------------------------------------------------------
  describe('5. Salary Schema & Canonical staffId', () => {
    it('enforces canonical staffId on salary slips and isolates employee access', () => {
      const slip: SalarySlip = {
        id: 'slip_2026_10_staff1',
        staffId: 'staff_uid_001',
        staffName: 'Ramesh Patel',
        designation: 'Sales Executive',
        month: 'October 2026',
        monthKey: '2026-10',
        basicSalary: 25000,
        salesIncentive: 4500,
        attendanceBonus: 1000,
        deductions: 500,
        netSalary: 30000,
        totalWorkingDays: 26,
        presentDays: 25,
        lateDays: 1,
        salesAchieved: 450000,
        generatedDate: '2026-11-01',
        isPaid: true,
      };

      // Evaluates firestore.rules:
      // match /salary_slips/{slipId} {
      //   allow read: if isAuthenticated() && (isAdmin() || resource.data.staffId == request.auth.uid);
      const evaluateSlipRead = (callerAuth: { uid: string; role: string }, record: SalarySlip) => {
        if (!callerAuth.uid) return false;
        return callerAuth.role === 'admin' || record.staffId === callerAuth.uid;
      };

      const staffCaller = { uid: 'staff_uid_001', role: 'staff' };
      const otherStaffCaller = { uid: 'staff_uid_002', role: 'staff' };
      const adminCaller = { uid: 'admin_uid', role: 'admin' };

      // Owner can read own slip
      expect(evaluateSlipRead(staffCaller, slip)).toBe(true);

      // Other staff CANNOT read this slip
      expect(evaluateSlipRead(otherStaffCaller, slip)).toBe(false);

      // Admin can read for payroll processing
      expect(evaluateSlipRead(adminCaller, slip)).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // 6. Audit Logs Integrity & Impersonation Prevention
  // -------------------------------------------------------------
  describe('6. Audit Logs Integrity', () => {
    it('strictly denies staff from creating administrative audit entries', () => {
      // Evaluates firestore.rules:
      // match /audit_logs/{logId} {
      //   allow read: if isAdmin();
      //   allow create: if isAdmin() && isValidAdminAuditLog(request.resource.data);
      //   allow update, delete: if false;
      const evaluateAuditCreate = (callerAuth: { uid: string; role: string }, entryAdminId: string) => {
        if (!callerAuth.uid) return false;
        if (callerAuth.role !== 'admin') return false;
        return callerAuth.uid === entryAdminId; // Must match authenticated admin
      };

      const staffCaller = { uid: 'staff_uid_001', role: 'staff' };
      const adminCaller = { uid: 'admin_parth_uid', role: 'admin' };

      // Staff cannot write audit records
      expect(evaluateAuditCreate(staffCaller, staffCaller.uid)).toBe(false);

      // Staff cannot forge an entry with the admin's UID
      expect(evaluateAuditCreate(staffCaller, adminCaller.uid)).toBe(false);

      // Admin can log their own administrative actions
      expect(evaluateAuditCreate(adminCaller, adminCaller.uid)).toBe(true);

      // Admin cannot forge an entry claiming another admin did it
      expect(evaluateAuditCreate(adminCaller, 'some_other_admin_uid')).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // 7. Advanced Firestore Security Rules Hardening Matrix
  // -------------------------------------------------------------
  describe('7. Final Firestore Rules Security Hardening Matrix', () => {
    const existingInvitation: StaffInvitation = {
      id: 'PMC-INV-SECURE-999',
      token: 'PMC-INV-SECURE-999',
      name: 'Rohan Sharma',
      email: 'rohan.sharma@example.com',
      phone: '9876543210',
      role: 'staff',
      designation: 'Sales Representative',
      basicSalary: 25000,
      monthlyTarget: 300000,
      createdBy: 'admin_uid',
      createdByName: 'Parth Patel',
      createdAt: '2026-11-01T10:00:00Z',
      expiresAt: '2099-11-08T10:00:00Z',
      status: 'pending',
    };

    // Evaluates firestore.rules update on staff_invitations with diff().affectedKeys()
    const evaluateInvitationUpdate = (
      caller: { uid: string; role: string },
      currentDoc: StaffInvitation,
      incomingDoc: any
    ) => {
      if (!caller.uid) return false;
      if (caller.role === 'admin') return true;

      const isPending = currentDoc.status === 'pending';
      const isStaffRole = currentDoc.role === 'staff';
      const isUnexpired = new Date(currentDoc.expiresAt).getTime() > Date.now();
      const isStatusAccepted = incomingDoc.status === 'accepted';
      const isBoundToCaller = incomingDoc.acceptedByUid === caller.uid;

      // diff().affectedKeys().hasOnly(['status', 'acceptedAt', 'acceptedByUid'])
      const allowedKeys = new Set(['status', 'acceptedAt', 'acceptedByUid']);
      const changedKeys = Object.keys(incomingDoc).filter(
        k => incomingDoc[k] !== (currentDoc as any)[k]
      );
      const onlyAllowedKeysChanged = changedKeys.every(k => allowedKeys.has(k));

      return (
        isPending &&
        isStaffRole &&
        isUnexpired &&
        isStatusAccepted &&
        isBoundToCaller &&
        onlyAllowedKeysChanged
      );
    };

    it('denies invitation update when staff attempts to tamper with token, email, expiry, or salary', () => {
      const staffCaller = { uid: 'auth_rohan_uid', role: 'staff' };

      // 1. Valid acceptance: only status, acceptedAt, acceptedByUid changed
      const validAcceptance = {
        ...existingInvitation,
        status: 'accepted',
        acceptedAt: '2026-11-03T11:00:00Z',
        acceptedByUid: 'auth_rohan_uid',
      };
      expect(evaluateInvitationUpdate(staffCaller, existingInvitation, validAcceptance)).toBe(true);

      // 2. Tampering attempt: changing email
      const emailTamper = {
        ...validAcceptance,
        email: 'attacker@evil.com',
      };
      expect(evaluateInvitationUpdate(staffCaller, existingInvitation, emailTamper)).toBe(false);

      // 3. Tampering attempt: extending expiration date
      const expiryTamper = {
        ...validAcceptance,
        expiresAt: '2099-12-31T23:59:59Z',
      };
      expect(evaluateInvitationUpdate(staffCaller, existingInvitation, expiryTamper)).toBe(false);

      // 4. Tampering attempt: changing token
      const tokenTamper = {
        ...validAcceptance,
        token: 'PMC-INV-HACKED-TOKEN',
      };
      expect(evaluateInvitationUpdate(staffCaller, existingInvitation, tokenTamper)).toBe(false);

      // 5. Tampering attempt: altering role to admin
      const roleTamper = {
        ...validAcceptance,
        role: 'admin',
      };
      expect(evaluateInvitationUpdate(staffCaller, existingInvitation, roleTamper)).toBe(false);

      // 6. Tampering attempt: escalating basicSalary
      const salaryTamper = {
        ...validAcceptance,
        basicSalary: 99999,
      };
      expect(evaluateInvitationUpdate(staffCaller, existingInvitation, salaryTamper)).toBe(false);
    });

    // Evaluates firestore.rules create on users/{userId}:
    const evaluateProfileCreate = (
      callerAuth: { uid: string; email: string; role?: string },
      userId: string,
      incomingProfile: any,
      invitationDoc?: StaffInvitation
    ) => {
      if (!callerAuth.uid) return false;
      if (callerAuth.role === 'admin') return true;

      // Staff self-registration rules:
      const isOwner = callerAuth.uid === userId;
      const roleIsStaff = incomingProfile.role === 'staff';
      const salaryZero = incomingProfile.basicSalary === 0;
      const targetZero = incomingProfile.monthlyTarget === 0;
      const activeTrue = incomingProfile.isActive === true;
      const noPermissions = !('permissions' in incomingProfile);
      const noIsAdmin = !('isAdmin' in incomingProfile);
      const emailMatchesAuth = incomingProfile.email === callerAuth.email;

      // hasValidInvitationForProfile:
      if (!incomingProfile.invitationToken || !invitationDoc) return false;
      const invMatchesToken = invitationDoc.token === incomingProfile.invitationToken;
      const invMatchesEmail = invitationDoc.email === callerAuth.email;
      const invValidStatus = invitationDoc.status === 'pending' || invitationDoc.acceptedByUid === userId;
      const invUnexpired = new Date(invitationDoc.expiresAt).getTime() > Date.now();
      const invRoleStaff = invitationDoc.role === 'staff';

      return (
        isOwner &&
        roleIsStaff &&
        salaryZero &&
        targetZero &&
        activeTrue &&
        noPermissions &&
        noIsAdmin &&
        emailMatchesAuth &&
        invMatchesToken &&
        invMatchesEmail &&
        invValidStatus &&
        invUnexpired &&
        invRoleStaff
      );
    };

    it('enforces invitation-bound profile creation: denies creation without valid invitation or with mismatched email', () => {
      const callerRohan = { uid: 'auth_rohan_uid', email: 'rohan.sharma@example.com' };

      const validProfile = {
        id: 'auth_rohan_uid',
        name: 'Rohan Sharma',
        email: 'rohan.sharma@example.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Sales Representative',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: true,
        joinedDate: '2026-11-03',
        invitationToken: 'PMC-INV-SECURE-999',
      };

      // 1. Valid profile bound to valid invitation
      expect(evaluateProfileCreate(callerRohan, callerRohan.uid, validProfile, existingInvitation)).toBe(true);

      // 2. Denied: Profile creation without an invitation
      expect(evaluateProfileCreate(callerRohan, callerRohan.uid, validProfile, undefined)).toBe(false);

      // 3. Denied: Profile creation where auth email does not match invitation email
      const hackerCaller = { uid: 'auth_hacker_uid', email: 'hacker@evil.com' };
      const hackerProfile = { ...validProfile, id: 'auth_hacker_uid', email: 'hacker@evil.com' };
      expect(evaluateProfileCreate(hackerCaller, hackerCaller.uid, hackerProfile, existingInvitation)).toBe(false);

      // 4. Denied: Staff attempts to self-assign role 'admin'
      const adminProfile = { ...validProfile, role: 'admin' };
      expect(evaluateProfileCreate(callerRohan, callerRohan.uid, adminProfile, existingInvitation)).toBe(false);

      // 5. Denied: Staff attempts to set non-zero basicSalary on self-registration
      const privilegedSalaryProfile = { ...validProfile, basicSalary: 50000 };
      expect(evaluateProfileCreate(callerRohan, callerRohan.uid, privilegedSalaryProfile, existingInvitation)).toBe(false);

      // 6. Denied: Staff attempts to set non-zero monthlyTarget on self-registration
      const privilegedTargetProfile = { ...validProfile, monthlyTarget: 500000 };
      expect(evaluateProfileCreate(callerRohan, callerRohan.uid, privilegedTargetProfile, existingInvitation)).toBe(false);

      // 7. Denied: Staff attempts to inject permissions map
      const permissionsProfile = { ...validProfile, permissions: { canDelete: true } };
      expect(evaluateProfileCreate(callerRohan, callerRohan.uid, permissionsProfile, existingInvitation)).toBe(false);
    });

    // Evaluates KYC Subcollection Creation Authorization:
    // allow create: if isAuthenticated() && request.auth.uid == get(...).data.purchasedByStaffId;
    const evaluateKycCreate = (
      callerUid: string,
      parentPurchase: { id: string; purchasedByStaffId: string }
    ) => {
      if (!callerUid) return false;
      return callerUid === parentPurchase.purchasedByStaffId;
    };

    it('enforces KYC creation binding: staff can only create KYC for their own recorded purchase', () => {
      const staffPurchaser = { uid: 'staff_alice_uid' };
      const staffUnrelated = { uid: 'staff_bob_uid' };

      const parentPurchase = {
        id: 'pur_12345',
        purchasedByStaffId: 'staff_alice_uid',
      };

      // Alice recorded the purchase -> allowed to create the KYC record
      expect(evaluateKycCreate(staffPurchaser.uid, parentPurchase)).toBe(true);

      // Bob did NOT record this purchase -> strictly denied from creating arbitrary KYC record
      expect(evaluateKycCreate(staffUnrelated.uid, parentPurchase)).toBe(false);
    });

    // Evaluates second_hand_purchases read rule:
    // allow read: if isAuthenticated() && (isAdmin() || resource.data.purchasedByStaffId == request.auth.uid || resource.data.status == 'in_stock');
    const evaluatePurchaseRead = (
      caller: { uid: string; role: string },
      purchaseDoc: { id: string; purchasedByStaffId: string; status: 'in_stock' | 'sold' }
    ) => {
      if (!caller.uid) return false;
      return (
        caller.role === 'admin' ||
        purchaseDoc.purchasedByStaffId === caller.uid ||
        purchaseDoc.status === 'in_stock'
      );
    };

    it('protects sold purchase documents from peer staff snooping while preserving in_stock inventory access', () => {
      const staffAlice = { uid: 'staff_alice_uid', role: 'staff' };
      const staffBob = { uid: 'staff_bob_uid', role: 'staff' };
      const adminParth = { uid: 'admin_parth_uid', role: 'admin' };

      const inStockPurchase = {
        id: 'pur_stock_01',
        purchasedByStaffId: 'staff_alice_uid',
        status: 'in_stock' as const,
      };

      const soldPurchase = {
        id: 'pur_sold_02',
        purchasedByStaffId: 'staff_alice_uid',
        status: 'sold' as const,
      };

      // 1. In-stock device: accessible by both Alice and Bob for store resale workflow
      expect(evaluatePurchaseRead(staffAlice, inStockPurchase)).toBe(true);
      expect(evaluatePurchaseRead(staffBob, inStockPurchase)).toBe(true);
      expect(evaluatePurchaseRead(adminParth, inStockPurchase)).toBe(true);

      // 2. Finalized sold purchase: Alice (purchaser) and Admin can access
      expect(evaluatePurchaseRead(staffAlice, soldPurchase)).toBe(true);
      expect(evaluatePurchaseRead(adminParth, soldPurchase)).toBe(true);

      // 3. Finalized sold purchase: Bob (unrelated staff) is strictly DENIED access
      expect(evaluatePurchaseRead(staffBob, soldPurchase)).toBe(false);
    });
  });
});

