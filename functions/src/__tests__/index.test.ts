import {
  normalizePhone,
  normalizeEmail,
  validateCreateStaffInput,
  verifyCallerIsActiveAdmin,
  createStaffAccount,
  resendStaffInvitation,
  setStaffAccountStatus,
  repairStaffProfile,
  approveStaffEnrollment,
  rejectStaffEnrollment,
  correctAttendanceRecord,
  getServerTime,
} from '../index';
import { sendPasswordSetupEmail } from '../emailService';
import * as admin from 'firebase-admin';

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  const mockUserDoc = {
    exists: true,
    data: jest.fn(),
  };

  const mockQuerySnapshot = {
    empty: true,
    docs: [],
  };

  const mockBatch = {
    set: jest.fn().mockReturnThis(),
    commit: jest.fn().mockResolvedValue(undefined),
  };

  const mockDocRef = {
    get: jest.fn().mockResolvedValue(mockUserDoc),
    set: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  };

  const mockCollectionRef = {
    doc: jest.fn().mockReturnValue(mockDocRef),
    where: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue(mockQuerySnapshot),
    add: jest.fn().mockResolvedValue({ id: 'mock_audit_id' }),
  };

  const mockFirestore = {
    collection: jest.fn().mockReturnValue(mockCollectionRef),
    batch: jest.fn().mockReturnValue(mockBatch),
  };

  const mockAuth = {
    getUserByEmail: jest.fn(),
    createUser: jest.fn(),
    updateUser: jest.fn().mockResolvedValue(undefined),
    revokeRefreshTokens: jest.fn().mockResolvedValue(undefined),
    setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
    generatePasswordResetLink: jest.fn().mockResolvedValue('https://parthmobilecare.page.link/reset?token=test1234'),
    deleteUser: jest.fn().mockResolvedValue(undefined),
  };

  return {
    apps: [{}],
    initializeApp: jest.fn(),
    firestore: Object.assign(jest.fn(() => mockFirestore), {
      FieldValue: {
        serverTimestamp: jest.fn().mockReturnValue('MOCK_TIMESTAMP'),
        delete: jest.fn().mockReturnValue('MOCK_DELETE'),
      },
    }),
    auth: jest.fn(() => mockAuth),
  };
});

describe('Phase 1: Secure Firebase Staff Account Provisioning', () => {
  let db: any;
  let auth: any;

  beforeEach(() => {
    jest.clearAllMocks();
    db = (admin.firestore as any)();
    auth = (admin.auth as any)();
  });

  describe('normalizePhone', () => {
    it('normalizes a standard 10-digit Indian phone number', () => {
      expect(normalizePhone('9876543210')).toBe('+919876543210');
      expect(normalizePhone('98765 43210')).toBe('+919876543210');
      expect(normalizePhone('987-654-3210')).toBe('+919876543210');
    });

    it('normalizes 12-digit Indian number starting with 91', () => {
      expect(normalizePhone('919876543210')).toBe('+919876543210');
    });

    it('preserves valid E.164 formatted number', () => {
      expect(normalizePhone('+919876543210')).toBe('+919876543210');
      expect(normalizePhone('+14155552671')).toBe('+14155552671');
    });

    it('throws invalid-argument error for invalid phone numbers', () => {
      expect(() => normalizePhone('')).toThrow();
      expect(() => normalizePhone('12345')).toThrow();
      expect(() => normalizePhone('abcdefghij')).toThrow();
    });
  });

  describe('normalizeEmail', () => {
    it('trims and lowercases valid email addresses', () => {
      expect(normalizeEmail('  Staff.User@Example.Com ')).toBe('staff.user@example.com');
    });

    it('throws error on invalid email address', () => {
      expect(() => normalizeEmail('')).toThrow();
      expect(() => normalizeEmail('not-an-email')).toThrow();
      expect(() => normalizeEmail('missing@domain')).toThrow();
    });
  });

  describe('validateCreateStaffInput', () => {
    it('validates and applies defaults for valid input', () => {
      const input = {
        name: ' Ramesh Patel ',
        email: 'RAMESH@EXAMPLE.COM',
        phone: '9825012345',
        role: 'staff',
        basicSalary: 25000,
        monthlyTarget: 150000,
      };

      const result = validateCreateStaffInput(input);
      expect(result.name).toBe('Ramesh Patel');
      expect(result.email).toBe('ramesh@example.com');
      expect(result.phone).toBe('+919825012345');
      expect(result.role).toBe('staff');
      expect(result.designation).toBe('Sales Executive');
      expect(result.basicSalary).toBe(25000);
      expect(result.monthlyTarget).toBe(150000);
    });

    it('assigns Store Administrator designation default when role is admin', () => {
      const input = {
        name: 'Admin Manager',
        email: 'admin@example.com',
        phone: '9825012345',
        role: 'admin',
      };
      const result = validateCreateStaffInput(input);
      expect(result.designation).toBe('Store Administrator');
    });

    it('rejects short or empty names', () => {
      expect(() => validateCreateStaffInput({ name: 'A', email: 'a@b.com', phone: '9825012345' })).toThrow();
      expect(() => validateCreateStaffInput({ name: '', email: 'a@b.com', phone: '9825012345' })).toThrow();
    });

    it('rejects negative salary or target', () => {
      expect(() =>
        validateCreateStaffInput({
          name: 'Valid Name',
          email: 'valid@example.com',
          phone: '9825012345',
          basicSalary: -100,
        })
      ).toThrow();

      expect(() =>
        validateCreateStaffInput({
          name: 'Valid Name',
          email: 'valid@example.com',
          phone: '9825012345',
          monthlyTarget: -500,
        })
      ).toThrow();
    });
  });

  describe('verifyCallerIsActiveAdmin', () => {
    it('throws permission-denied when caller document does not exist', async () => {
      const docRef = db.collection().doc();
      docRef.get.mockResolvedValueOnce({ exists: false });

      await expect(verifyCallerIsActiveAdmin('nonexistent_uid')).rejects.toThrow();
    });

    it('throws permission-denied when caller has staff role', async () => {
      const docRef = db.collection().doc();
      docRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: 'staff', isActive: true }),
      });

      await expect(verifyCallerIsActiveAdmin('staff_uid')).rejects.toThrow(
        /Only store administrators can provision new accounts/
      );
    });

    it('throws permission-denied when admin account is inactive', async () => {
      const docRef = db.collection().doc();
      docRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: 'admin', isActive: false }),
      });

      await expect(verifyCallerIsActiveAdmin('inactive_admin_uid')).rejects.toThrow(
        /Caller account is inactive or disabled/
      );
    });

    it('succeeds and returns admin data when caller is active admin', async () => {
      const adminData = { role: 'admin', isActive: true, name: 'Parth Admin' };
      const docRef = db.collection().doc();
      docRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => adminData,
      });

      const result = await verifyCallerIsActiveAdmin('active_admin_uid');
      expect(result).toEqual(adminData);
    });
  });

  describe('createStaffAccount callable function', () => {
    it('throws unauthenticated when request.auth is missing', async () => {
      const unauthRequest = {
        data: { name: 'Test', email: 'test@example.com', phone: '9825012345' },
        auth: null,
      } as any;

      await expect((createStaffAccount as any).run(unauthRequest)).rejects.toThrow(
        /Authentication required/
      );
    });

    it('throws permission-denied when caller is not an active admin', async () => {
      const docRef = db.collection().doc();
      docRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: 'staff', isActive: true }),
      });

      const staffCallerRequest = {
        auth: { uid: 'staff_123' },
        data: { name: 'New Colleague', email: 'new@example.com', phone: '9825012345' },
      } as any;

      await expect((createStaffAccount as any).run(staffCallerRequest)).rejects.toThrow(
        /Only store administrators can provision new accounts/
      );
    });

    it('throws already-exists if email is already in Auth', async () => {
      const docRef = db.collection().doc();
      docRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: 'admin', isActive: true }),
      });

      auth.getUserByEmail.mockResolvedValueOnce({ uid: 'existing_uid', email: 'dup@example.com' });

      const request = {
        auth: { uid: 'admin_uid' },
        data: { name: 'Dup User', email: 'dup@example.com', phone: '9825012345' },
      } as any;

      await expect((createStaffAccount as any).run(request)).rejects.toThrow(
        /already exists in Firebase Auth/
      );
    });

    it('successfully provisions staff account and returns UID + inviteLink', async () => {
      // 1. Admin verification
      const docRef = db.collection().doc();
      docRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: 'admin', isActive: true, name: 'Parth Admin' }),
      });

      // 2. Auth user check: not found
      auth.getUserByEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' });

      // 3. Firestore duplicate check: empty
      const collectionRef = db.collection();
      collectionRef.get.mockResolvedValueOnce({ empty: true });

      // 4. Create Auth user
      const createdUid = 'new_staff_auth_uid_789';
      auth.createUser.mockResolvedValueOnce({
        uid: createdUid,
        email: 'newstaff@example.com',
        displayName: 'New Staff',
      });

      // 5. Batch commit
      const batch = db.batch();
      batch.commit.mockResolvedValueOnce(undefined);

      // 6. Generate invite link
      auth.generatePasswordResetLink.mockResolvedValueOnce(
        'https://parthmobilecare.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=XYZ123'
      );

      const request = {
        auth: { uid: 'admin_uid' },
        data: {
          name: 'New Staff',
          email: 'newstaff@example.com',
          phone: '9825012345',
          role: 'staff',
          designation: 'Technician',
          basicSalary: 22000,
          monthlyTarget: 180000,
        },
      } as any;

      const response = await (createStaffAccount as any).run(request);

      expect(response.success).toBe(true);
      expect(response.uid).toBe(createdUid);
      expect(response.email).toBe('newstaff@example.com');
      expect(response.role).toBe('staff');
      expect(response.inviteLink).toContain('resetPassword');
      expect(auth.createUser).toHaveBeenCalledWith({
        email: 'newstaff@example.com',
        displayName: 'New Staff',
        disabled: false,
      });
      expect(auth.setCustomUserClaims).toHaveBeenCalledWith(createdUid, { role: 'staff' });
    });

    it('rolls back and deletes created Auth user if database batch write fails', async () => {
      // Admin verification
      const docRef = db.collection().doc();
      docRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: 'admin', isActive: true }),
      });

      auth.getUserByEmail.mockRejectedValueOnce({ code: 'auth/user-not-found' });

      const collectionRef = db.collection();
      collectionRef.get.mockResolvedValueOnce({ empty: true });

      const createdUid = 'failed_batch_uid';
      auth.createUser.mockResolvedValueOnce({
        uid: createdUid,
        email: 'fail@example.com',
      });

      // Batch commit fails with database network error
      const batch = db.batch();
      batch.commit.mockRejectedValueOnce(new Error('Firestore connection lost'));

      const request = {
        auth: { uid: 'admin_uid' },
        data: {
          name: 'Fail User',
          email: 'fail@example.com',
          phone: '9825012345',
        },
      } as any;

      await expect((createStaffAccount as any).run(request)).rejects.toThrow(
        /Failed to write staff profile to database/
      );

      // Verify rollback occurred: auth.deleteUser was called with createdUid!
      expect(auth.deleteUser).toHaveBeenCalledWith(createdUid);
    });
  });

  describe('resendStaffInvitation callable function', () => {
    it('throws unauthenticated when no auth credentials provided', async () => {
      const req = { data: { email: 'staff@example.com' }, auth: null } as any;
      await expect((resendStaffInvitation as any).run(req)).rejects.toThrow(/Authentication required/);
    });

    it('throws failed-precondition if staff account is deactivated', async () => {
      // Admin caller
      const docRef = db.collection().doc();
      docRef.get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'admin', isActive: true }),
        })
        // Target staff profile is inactive
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'staff', isActive: false }),
        });

      auth.getUserByEmail.mockResolvedValueOnce({ uid: 'target_uid', email: 'inactive@example.com' });

      const req = {
        auth: { uid: 'admin_uid' },
        data: { email: 'inactive@example.com' },
      } as any;

      await expect((resendStaffInvitation as any).run(req)).rejects.toThrow(
        /Cannot send invitation to a deactivated account/
      );
    });

    it('generates new password invitation link for active staff', async () => {
      const docRef = db.collection().doc();
      docRef.get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'admin', isActive: true }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'staff', isActive: true, email: 'active@example.com' }),
        });

      auth.getUserByEmail.mockResolvedValueOnce({ uid: 'target_uid', email: 'active@example.com' });
      auth.generatePasswordResetLink.mockResolvedValueOnce('https://parthmobilecare.page.link/reset?token=newlink');

      const req = {
        auth: { uid: 'admin_uid' },
        data: { email: 'active@example.com' },
      } as any;

      const res = await (resendStaffInvitation as any).run(req);
      expect(res.success).toBe(true);
      expect(res.email).toBe('active@example.com');
      expect(res.inviteLink).toBe('https://parthmobilecare.page.link/reset?token=newlink');
    });
  });

  describe('setStaffAccountStatus callable function', () => {
    it('throws invalid-argument when admin attempts to deactivate own account', async () => {
      const docRef = db.collection().doc();
      docRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: 'admin', isActive: true }),
      });

      const req = {
        auth: { uid: 'admin_uid' },
        data: { uid: 'admin_uid', isActive: false },
      } as any;

      await expect((setStaffAccountStatus as any).run(req)).rejects.toThrow(
        /Administrators cannot deactivate their own account/
      );
    });

    it('disables Auth user and revokes refresh tokens on deactivation', async () => {
      const docRef = db.collection().doc();
      docRef.get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'admin', isActive: true }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'staff', isActive: true }),
        });

      const req = {
        auth: { uid: 'admin_uid' },
        data: { uid: 'staff_123', isActive: false },
      } as any;

      const res = await (setStaffAccountStatus as any).run(req);
      expect(res.success).toBe(true);
      expect(res.isActive).toBe(false);
      expect(auth.updateUser).toHaveBeenCalledWith('staff_123', { disabled: true });
      expect(auth.revokeRefreshTokens).toHaveBeenCalledWith('staff_123');
      expect(docRef.update).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false })
      );
    });

    it('re-enables Auth user on reactivation', async () => {
      const docRef = db.collection().doc();
      docRef.get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'admin', isActive: true }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'staff', isActive: false }),
        });

      const req = {
        auth: { uid: 'admin_uid' },
        data: { uid: 'staff_123', isActive: true },
      } as any;

      const res = await (setStaffAccountStatus as any).run(req);
      expect(res.success).toBe(true);
      expect(res.isActive).toBe(true);
      expect(auth.updateUser).toHaveBeenCalledWith('staff_123', { disabled: false });
      expect(docRef.update).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: true })
      );
    });
  });

  describe('repairStaffProfile callable function', () => {
    it('throws unauthenticated when request.auth is missing', async () => {
      const req = { data: { email: 'staff@parth.com' } } as any;
      await expect((repairStaffProfile as any).run(req)).rejects.toMatchObject({
        code: 'unauthenticated',
      });
    });

    it('creates missing Firestore profile for an existing Auth user', async () => {
      const docRef = db.collection().doc();
      docRef.get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'admin', isActive: true }),
        })
        .mockResolvedValueOnce({
          exists: false,
        });

      (auth.getUserByEmail as jest.Mock).mockResolvedValueOnce({
        uid: 'existing_auth_uid_99',
        email: 'staff99@parth.com',
        displayName: 'Staff 99',
        disabled: false,
      });

      const req = {
        auth: { uid: 'admin_uid' },
        data: { email: 'staff99@parth.com', defaultRole: 'staff' },
      } as any;

      const res = await (repairStaffProfile as any).run(req);
      expect(res.success).toBe(true);
      expect(res.uid).toBe('existing_auth_uid_99');
      expect(res.wasCreated).toBe(true);
      expect(docRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'existing_auth_uid_99',
          email: 'staff99@parth.com',
          role: 'staff',
        })
      );
      expect(auth.setCustomUserClaims).toHaveBeenCalledWith('existing_auth_uid_99', { role: 'staff' });
    });

    it('repairs existing profile role/status without creating duplicates', async () => {
      const docRef = db.collection().doc();
      docRef.get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'admin', isActive: true }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'staff', isActive: true, id: 'existing_auth_uid_88' }),
        });

      (auth.getUserByEmail as jest.Mock).mockResolvedValueOnce({
        uid: 'existing_auth_uid_88',
        email: 'staff88@parth.com',
        disabled: false,
      });

      const req = {
        auth: { uid: 'admin_uid' },
        data: { email: 'staff88@parth.com' },
      } as any;

      const res = await (repairStaffProfile as any).run(req);
      expect(res.success).toBe(true);
      expect(res.wasCreated).toBe(false);
      expect(docRef.update).toHaveBeenCalled();
    });
  });

  describe('approveStaffEnrollment callable function', () => {
    it('throws unauthenticated when request.auth is missing', async () => {
      const req = { data: { targetUid: 'staff_1' } } as any;
      await expect((approveStaffEnrollment as any).run(req)).rejects.toThrow(/Authentication required/);
    });

    it('approves staff face enrollment when caller is active admin', async () => {
      const docRef = db.collection().doc();
      docRef.get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'admin', isActive: true, name: 'Parth Patel' }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'staff', isActive: true, name: 'Karan Dave' }),
        });

      const req = {
        auth: { uid: 'admin_uid' },
        data: { targetUid: 'staff_1' },
      } as any;

      const res = await (approveStaffEnrollment as any).run(req);
      expect(res.success).toBe(true);
      expect(res.uid).toBe('staff_1');
      expect(docRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          hasFaceRegistered: true,
          faceEnrollmentStatus: 'approved',
        })
      );
    });
  });

  describe('rejectStaffEnrollment callable function', () => {
    it('throws invalid-argument when reason is missing', async () => {
      const docRef = db.collection().doc();
      docRef.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ role: 'admin', isActive: true }),
      });

      const req = {
        auth: { uid: 'admin_uid' },
        data: { targetUid: 'staff_1', reason: '' },
      } as any;

      await expect((rejectStaffEnrollment as any).run(req)).rejects.toThrow(/rejection reason/);
    });

    it('rejects staff face enrollment with recorded reason', async () => {
      const docRef = db.collection().doc();
      docRef.get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'admin', isActive: true }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'staff', isActive: true, name: 'Karan Dave' }),
        });

      const req = {
        auth: { uid: 'admin_uid' },
        data: { targetUid: 'staff_1', reason: 'Blurry photo' },
      } as any;

      const res = await (rejectStaffEnrollment as any).run(req);
      expect(res.success).toBe(true);
      expect(res.reason).toBe('Blurry photo');
      expect(docRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          hasFaceRegistered: false,
          faceEnrollmentStatus: 'rejected',
          faceRejectionReason: 'Blurry photo',
        })
      );
    });
  });

  describe('correctAttendanceRecord callable function', () => {
    it('corrects attendance record and sets manual override fields', async () => {
      const docRef = db.collection().doc();
      docRef.get
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'admin', isActive: true, name: 'Parth Patel' }),
        })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ role: 'staff', isActive: true, name: 'Karan Dave' }),
        });

      const req = {
        auth: { uid: 'admin_uid' },
        data: {
          recordId: 'att_staff_1_2026-10-30',
          targetUid: 'staff_1',
          date: '2026-10-30',
          punchInTime: '09:30:00',
          reason: 'Camera issue confirmed on site',
        },
      } as any;

      const res = await (correctAttendanceRecord as any).run(req);
      expect(res.success).toBe(true);
      expect(docRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'present',
          verificationMethod: 'manual_override',
        }),
        { merge: true }
      );
    });
  });

  describe('getServerTime callable function', () => {
    it('returns server timestamp and ISO string', async () => {
      const res = await (getServerTime as any).run({} as any);
      expect(res.serverTime).toBeDefined();
      expect(typeof res.timestamp).toBe('number');
    });
  });

  describe('emailService password setup delivery', () => {
    it('returns delivered: false when no email provider is configured in environment', async () => {
      const result = await sendPasswordSetupEmail({
        to: 'staff@example.com',
        name: 'John Doe',
        inviteLink: 'https://parthmobilecare-a474d.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=xyz',
      });
      expect(result.delivered).toBe(false);
      expect(result.error).toContain('No email delivery provider credentials configured');
    });

    it('returns delivered: false if inviteLink is missing', async () => {
      const result = await sendPasswordSetupEmail({
        to: 'staff@example.com',
        name: 'John Doe',
        inviteLink: '',
      });
      expect(result.delivered).toBe(false);
      expect(result.error).toBe('No invitation link provided.');
    });
  });
});

