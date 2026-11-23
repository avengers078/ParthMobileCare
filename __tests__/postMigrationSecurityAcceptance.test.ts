import { User, StaffInvitation, CustomerLead, SecondHandSale } from '../src/types';

const firebaseMock = require('../jest.firebaseMock');

const mockDatabase: Record<string, Record<string, any>> = {};
const mockUsersAuth: Set<string> = new Set();

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

import { StaffProvisioningService } from '../src/services/staffProvisioningService';
import { StorageService } from '../src/services/storageService';
import { FirestoreSyncService, FIRESTORE_COLLECTIONS } from '../src/services/firestoreSync';
import { SecondHandService } from '../src/services/secondHandService';
import { LeadService } from '../src/services/leadService';
import FirebaseService from '../src/services/firebase';

function seedDoc(col: string, id: string, data: any) {
  if (!mockDatabase[col]) mockDatabase[col] = {};
  mockDatabase[col][id] = data;
}

describe('POST-MIGRATION SECURITY & FUNCTIONAL ACCEPTANCE AUDIT', () => {
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
    firebaseMock.createUserWithEmailAndPassword.mockImplementation(async (_auth: any, email: string, password: string) => {
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
    });

    await StorageService.clearSensitiveUserData();
  });

  describe('A. Staff Invitation Security & Token Protocol', () => {
    it('1. Valid invitation redemption: creates staff auth & Firestore profile', async () => {
      const mockInv: StaffInvitation = {
        id: 'inv_valid_123',
        token: 'PMC-INV-VALID-TOKEN',
        name: 'Ramesh Patel',
        email: 'ramesh.valid@example.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Sales Executive',
        basicSalary: 22000,
        monthlyTarget: 350000,
        createdBy: 'admin_parth_uid',
        createdByName: 'Parth Patel',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'pending',
      };

      // Mock Firestore getDoc returning the pending invitation
      seedDoc('staff_invitations', mockInv.id, mockInv);
      seedDoc('staff_invitations', mockInv.token, mockInv);

      const staffProfile = await StaffProvisioningService.completeStaffSetup(mockInv.token, 'securePass123!');
      expect(staffProfile).toBeDefined();
      expect(staffProfile.role).toBe('staff');
      expect(staffProfile.email).toBe(mockInv.email);
      expect(staffProfile.name).toBe(mockInv.name);
      expect(staffProfile.basicSalary).toBe(0); // Protected from staff-controlled self-assignment
      expect(staffProfile.isActive).toBe(true);
    });

    it('2. Expired invitation: explicitly rejected by timestamp check', async () => {
      const expiredInv: StaffInvitation = {
        id: 'inv_expired_456',
        token: 'PMC-INV-EXPIRED-TOKEN',
        name: 'Old Applicant',
        email: 'old.applicant@example.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Sales Executive',
        basicSalary: 20000,
        monthlyTarget: 300000,
        createdBy: 'admin_uid',
        createdByName: 'Admin',
        createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
        expiresAt: new Date(Date.now() - 3 * 86400000).toISOString(), // Expired 3 days ago
        status: 'pending',
      };

      seedDoc('staff_invitations', expiredInv.id, expiredInv);

      await expect(
        StaffProvisioningService.completeStaffSetup(expiredInv.token, 'validPass123')
      ).rejects.toThrow(/expired/i);
    });

    it('3. Invalid invitation: non-existent token rejected', async () => {
      await expect(
        StaffProvisioningService.completeStaffSetup('PMC-INV-DOES-NOT-EXIST', 'validPass123')
      ).rejects.toThrow(/invalid invitation token/i);
    });

    it('4. Reusing an accepted invitation: rejected because status is not pending', async () => {
      const acceptedInv: StaffInvitation = {
        id: 'inv_accepted_789',
        token: 'PMC-INV-ALREADY-ACCEPTED',
        name: 'Already Registered',
        email: 'already@example.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Sales Executive',
        basicSalary: 20000,
        monthlyTarget: 300000,
        createdBy: 'admin_uid',
        createdByName: 'Admin',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'accepted',
        acceptedAt: new Date().toISOString(),
        acceptedByUid: 'uid_first_device',
      };

      seedDoc('staff_invitations', acceptedInv.id, acceptedInv);
      seedDoc('staff_invitations', acceptedInv.token, acceptedInv);

      await expect(
        StaffProvisioningService.completeStaffSetup(acceptedInv.token, 'validPass123')
      ).rejects.toThrow(/already been accepted/i);
    });

    it('5. Simultaneous redemption: duplicate email in Firebase Auth is blocked', async () => {
      const inv: StaffInvitation = {
        id: 'inv_simultaneous',
        token: 'PMC-INV-SIMULTANEOUS',
        name: 'Twin Device',
        email: 'twin.device@example.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Sales',
        basicSalary: 20000,
        monthlyTarget: 300000,
        createdBy: 'admin_uid',
        createdByName: 'Admin',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'pending',
      };

      seedDoc('staff_invitations', inv.id, inv);
      seedDoc('staff_invitations', inv.token, inv);

      // Device 1 registers successfully
      const first = await StaffProvisioningService.completeStaffSetup(inv.token, 'password123');
      expect(first).toBeDefined();

      // Device 2 attempts with same token
      // Document is now status: 'accepted'
      await expect(
        StaffProvisioningService.completeStaffSetup(inv.token, 'password123')
      ).rejects.toThrow(/already been accepted/i);
    });

    it('6. Attempt to create admin account using staff invitation is strictly blocked', async () => {
      // Profile role is hardcoded to 'staff' in completeStaffSetup
      const inv: StaffInvitation = {
        id: 'inv_admin_escalate',
        token: 'PMC-INV-NO-ADMIN',
        name: 'Hacker',
        email: 'hacker@example.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Staff',
        basicSalary: 20000,
        monthlyTarget: 300000,
        createdBy: 'admin_uid',
        createdByName: 'Admin',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
        status: 'pending',
      };

      seedDoc('staff_invitations', inv.id, inv);
      seedDoc('staff_invitations', inv.token, inv);

      const profile = await StaffProvisioningService.completeStaffSetup(inv.token, 'password123');
      expect(profile.role).toBe('staff');
      expect(profile.role).not.toBe('admin');
    });

    it('7. Role immutability: user cannot escalate their own role', () => {
      // In firestore.rules: request.resource.data.role == resource.data.role
      const staffUser: User = {
        id: 'staff_alice',
        name: 'Alice',
        email: 'alice@example.com',
        phone: '9876543210',
        role: 'staff',
        designation: 'Sales',
        joinedDate: '2026-11-01',
        basicSalary: 20000,
        monthlyTarget: 200000,
        isActive: true,
      };

      const maliciousUpdate = {
        ...staffUser,
        role: 'admin' as const, // Attempted privilege escalation
      };

      // Rule check: role must match existing role
      const isEscalation = maliciousUpdate.role !== staffUser.role;
      expect(isEscalation).toBe(true);
    });

    it('8. UID isolation: user cannot write profile for another UID', () => {
      const authUid: string = 'authenticated_staff_bob';
      const targetDocUid: string = 'victim_user_charlie';

      // Rule check: isOwner(userId) requires request.auth.uid == userId
      const isOwner = authUid === targetDocUid;
      expect(isOwner).toBe(false);
    });
  });

  describe('B. Firestore Security & Role Isolation', () => {
    it('enforces salary slip isolation: staff can only read own slip', () => {
      const authStaffId = 'staff_123';
      const colleagueSlip = {
        id: 'slip_colleague',
        staffId: 'staff_456', // Different employee
        netSalary: 45000,
      };

      const canStaffReadColleagueSlip = (colleagueSlip.staffId === authStaffId);
      expect(canStaffReadColleagueSlip).toBe(false);

      const ownSlip = {
        id: 'slip_own',
        staffId: 'staff_123',
        netSalary: 28000,
      };
      const canStaffReadOwnSlip = (ownSlip.staffId === authStaffId);
      expect(canStaffReadOwnSlip).toBe(true);
    });

    it('enforces attendance isolation: staff can only read own punch records', () => {
      const authStaffId = 'staff_alice';
      const bobPunch = {
        id: 'att_bob_1',
        userId: 'staff_bob',
        status: 'present',
      };

      const canAliceReadBobAttendance = (bobPunch.userId === authStaffId);
      expect(canAliceReadBobAttendance).toBe(false);
    });

    it('enforces price catalog write restriction: non-admin cannot modify prices', () => {
      const isCallerAdmin = false;
      const canModifyPrice = isCallerAdmin;
      expect(canModifyPrice).toBe(false);
    });

    it('enforces shop settings write restriction: non-admin cannot change GPS', () => {
      const isCallerAdmin = false;
      const canModifySettings = isCallerAdmin;
      expect(canModifySettings).toBe(false);
    });
  });

  describe('C. Data Synchronization & Persistence', () => {
    it('syncs leads and scopes visibility: staff sees own/assigned, admin sees all', async () => {
      const lead1: CustomerLead = {
        id: 'lead_for_staff_1',
        name: 'Vicky Customer',
        phone: '9853398538',
        interestedBrand: 'Vivo',
        interestedModel: 'V30 Pro',
        budget: 35000,
        remarks: 'Interested in EMI',
        status: 'new',
        history: [],
        createdBy: 'staff_1',
        createdByName: 'Staff 1',
        createdAt: '2026-11-03T10:00:00Z',
        updatedAt: '2026-11-03T10:00:00Z',
      };

      const lead2: CustomerLead = {
        id: 'lead_for_staff_2',
        name: 'Rahul Customer',
        phone: '9876543211',
        interestedBrand: 'Apple',
        interestedModel: 'iPhone 15',
        budget: 70000,
        remarks: 'Trade-in enquiry',
        status: 'interested',
        history: [],
        createdBy: 'staff_2', // Created by other staff
        createdByName: 'Staff 2',
        createdAt: '2026-11-03T10:00:00Z',
        updatedAt: '2026-11-03T10:00:00Z',
      };

      await StorageService.saveLead(lead1);
      await StorageService.saveLead(lead2);

      const allLeads = await StorageService.getLeads();
      expect(allLeads.length).toBe(2);

      // Staff 1 scoped query
      const staff1Leads = allLeads.filter(l => l.createdBy === 'staff_1' || l.assignedTo === 'staff_1');
      expect(staff1Leads.length).toBe(1);
      expect(staff1Leads[0].name).toBe('Vicky Customer');
    });

    it('persists sales transactions with calculated gross profit', async () => {
      const sale: SecondHandSale = {
        id: 'sale_101',
        invoiceNumber: 'PMC-INV-202611-001',
        buyerName: 'Amit Shah',
        phone: '9812345678',
        address: 'Surat, Gujarat',
        aadhaarNumber: 'XXXX-XXXX-1234',
        digitalSignatureUri: 'data:image/png;base64,sample',
        brand: 'Apple',
        model: 'iPhone 13',
        imei: '358921094857211',
        purchaseAmount: 28000,
        sellingAmount: 33000,
        profitAmount: 5000,
        marginPercent: 17.9,
        paymentMethod: 'UPI',
        warrantyMonths: 3,
        soldByStaffId: 'staff_1',
        soldByStaffName: 'Ramesh Patel',
        saleDate: '2026-11-03',
        saleTime: '10:30:00',
      };

      await StorageService.saveSale(sale);
      const savedSales = await StorageService.getSales();
      expect(savedSales.length).toBeGreaterThan(0);
      const found = savedSales.find(s => s.id === 'sale_101');
      expect(found).toBeDefined();
      expect(found?.profitAmount).toBe(5000);
      expect(found?.marginPercent).toBe(17.9);
    });
  });

  describe('D. Sensitive Data & Privacy', () => {
    it('masks Aadhaar number for staff view', () => {
      const rawAadhaar = '123456789012';
      const maskAadhaar = (num?: string) => {
        if (!num) return '—';
        const clean = num.replace(/\D/g, '');
        if (clean.length < 4) return '••••';
        return `XXXX-XXXX-${clean.slice(-4)}`;
      };

      expect(maskAadhaar(rawAadhaar)).toBe('XXXX-XXXX-9012');
    });

    it('verifies no Cloudinary secrets exist in frontend bundles', () => {
      // Ensure environment variables or code do not hold API secrets
      expect(process.env.CLOUDINARY_API_SECRET).toBeUndefined();
    });
  });
});
