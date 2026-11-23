import { StaffProvisioningService } from '../src/services/staffProvisioningService';
import FirebaseService from '../src/services/firebase';

const mockCallable = jest.fn();

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getFunctions: jest.fn(() => ({})),
    getAuth: jest.fn(),
    getFirestore: jest.fn(),
    getStorage: jest.fn(),
  },
}));

jest.mock('firebase/functions', () => ({
  httpsCallable: jest.fn(() => mockCallable),
}));

describe('StaffProvisioningService (Client integration)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls createStaffAccount callable with correct payload and returns response', async () => {
    mockCallable.mockResolvedValueOnce({
      data: {
        success: true,
        uid: 'auth_uid_12345',
        email: 'staff@example.com',
        name: 'Staff Member',
        role: 'staff',
        inviteLink: 'https://parthmobilecare.page.link/reset?token=xyz',
        message: 'Staff account and database profile created successfully.',
      },
    });

    const result = await StaffProvisioningService.provisionStaffAccount({
      name: 'Staff Member',
      email: 'staff@example.com',
      phone: '9876543210',
      role: 'staff',
      designation: 'Sales Executive',
      basicSalary: 25000,
      monthlyTarget: 150000,
    });

    expect(result.success).toBe(true);
    expect(result.uid).toBe('auth_uid_12345');
    expect(result.inviteLink).toContain('reset?token=xyz');
    expect(mockCallable).toHaveBeenCalledWith({
      name: 'Staff Member',
      email: 'staff@example.com',
      phone: '9876543210',
      role: 'staff',
      designation: 'Sales Executive',
      basicSalary: 25000,
      monthlyTarget: 150000,
    });
  });

  it('handles permission-denied error gracefully', async () => {
    mockCallable.mockRejectedValueOnce({
      code: 'functions/permission-denied',
      message: 'Unauthorized: Only store administrators can provision new accounts.',
    });

    await expect(
      StaffProvisioningService.provisionStaffAccount({
        name: 'Another User',
        email: 'another@example.com',
        phone: '9876543210',
        role: 'staff',
      })
    ).rejects.toThrow('Access denied: Only active administrators have permission to provision accounts.');
  });

  it('handles already-exists error gracefully', async () => {
    mockCallable.mockRejectedValueOnce({
      code: 'functions/already-exists',
      message: 'A user with this email address already exists.',
    });

    await expect(
      StaffProvisioningService.provisionStaffAccount({
        name: 'Dup User',
        email: 'dup@example.com',
        phone: '9876543210',
        role: 'staff',
      })
    ).rejects.toThrow('An account with this email address already exists in the store system.');
  });

  it('handles unauthenticated error gracefully', async () => {
    mockCallable.mockRejectedValueOnce({
      code: 'functions/unauthenticated',
      message: 'The function must be called while authenticated.',
    });

    await expect(
      StaffProvisioningService.provisionStaffAccount({
        name: 'No Auth',
        email: 'noauth@example.com',
        phone: '9876543210',
        role: 'staff',
      })
    ).rejects.toThrow('You must be signed in as an administrator to create staff accounts.');
  });

  describe('resendStaffInvitation', () => {
    it('successfully calls resendStaffInvitation callable', async () => {
      mockCallable.mockResolvedValueOnce({
        data: {
          success: true,
          email: 'staff@example.com',
          inviteLink: 'https://parthmobilecare.page.link/reset?token=abc',
          message: 'Password setup invitation generated successfully.',
        },
      });

      const res = await StaffProvisioningService.resendStaffInvitation('staff@example.com');
      expect(res.success).toBe(true);
      expect(res.email).toBe('staff@example.com');
      expect(mockCallable).toHaveBeenCalledWith({ email: 'staff@example.com' });
    });

    it('handles failed-precondition for inactive accounts', async () => {
      mockCallable.mockRejectedValueOnce({
        code: 'functions/failed-precondition',
        message: 'Cannot send invitation to a deactivated account. Reactivate the account first.',
      });

      await expect(
        StaffProvisioningService.resendStaffInvitation('inactive@example.com')
      ).rejects.toThrow('Cannot send invitation to a deactivated staff account. Reactivate the account first.');
    });
  });

  describe('setStaffAccountStatus', () => {
    it('successfully calls setStaffAccountStatus callable to deactivate account', async () => {
      mockCallable.mockResolvedValueOnce({
        data: {
          success: true,
          uid: 'staff_123',
          isActive: false,
          message: 'Account deactivated and active sessions revoked.',
        },
      });

      const res = await StaffProvisioningService.setStaffAccountStatus('staff_123', false);
      expect(res.success).toBe(true);
      expect(res.isActive).toBe(false);
      expect(mockCallable).toHaveBeenCalledWith({ uid: 'staff_123', isActive: false });
    });

    it('handles self-deactivation rejection error', async () => {
      mockCallable.mockRejectedValueOnce({
        code: 'functions/invalid-argument',
        message: 'Administrators cannot deactivate their own account.',
      });

      await expect(
        StaffProvisioningService.setStaffAccountStatus('admin_self', false)
      ).rejects.toThrow('Administrators cannot deactivate their own account.');
    });
  });

  describe('repairStaffProfile', () => {
    it('successfully calls repairStaffProfile callable to link missing profile', async () => {
      mockCallable.mockResolvedValueOnce({
        data: {
          success: true,
          uid: 'auth_user_99',
          email: 'chetanluhar65@gmail.com',
          role: 'staff',
          wasCreated: true,
          message: 'Created missing Firestore profile for chetanluhar65@gmail.com linked to Auth UID auth_user_99.',
        },
      });

      const res = await StaffProvisioningService.repairStaffProfile('chetanluhar65@gmail.com', 'staff');
      expect(res.success).toBe(true);
      expect(res.uid).toBe('auth_user_99');
      expect(res.wasCreated).toBe(true);
      expect(mockCallable).toHaveBeenCalledWith({
        email: 'chetanluhar65@gmail.com',
        defaultRole: 'staff',
        designation: undefined,
      });
    });

    it('handles not-found error if Auth user does not exist', async () => {
      mockCallable.mockRejectedValueOnce({
        code: 'functions/not-found',
        message: 'No Firebase Authentication account found for this email address.',
      });

      await expect(
        StaffProvisioningService.repairStaffProfile('nonexistent@example.com')
      ).rejects.toThrow('No Firebase Authentication account found for this email address.');
    });
  });
});

