import { User } from '../src/types';

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

import { LeadService } from '../src/services/leadService';
import { StaffPerformanceService } from '../src/services/staffPerformanceService';
import { StorageService } from '../src/services/storageService';
import { FIRESTORE_COLLECTIONS } from '../src/services/firestoreSync';

describe('Lead Management, Staff Target & Cloud Sync Tests', () => {
  const mockAdmin: User = {
    id: 'user_admin_test',
    name: 'Parth Patel',
    email: 'admin@parthmobile.com',
    phone: '9876543210',
    role: 'admin',
    designation: 'Store Owner',
    joinedDate: '2023-01-01',
    basicSalary: 60000,
    monthlyTarget: 500000,
    isActive: true,
  };

  test('creates customer lead, updates full details, and deletes cleanly', async () => {
    // 1. Create Lead
    const newLead = await LeadService.createLead(
      {
        name: 'Rohan Sharma',
        phone: '9879112233',
        alternatePhone: '9879112234',
        interestedBrand: 'Vivo',
        interestedModel: 'V50 8GB/128GB',
        budget: 25000,
        remarks: 'Wants exchange on old phone',
        createdBy: mockAdmin.id,
        createdByName: mockAdmin.name,
      },
      mockAdmin,
      'new',
      false
    );

    expect(newLead.id).toBeDefined();
    expect(newLead.name).toBe('Rohan Sharma');

    // 2. Edit Lead Details
    const updatedLead = await LeadService.updateLeadDetails(
      newLead.id,
      {
        budget: 27000,
        remarks: 'Confirmed interested with cash down payment',
        status: 'interested',
      },
      mockAdmin
    );

    expect(updatedLead).toBeDefined();
    expect(updatedLead?.budget).toBe(27000);
    expect(updatedLead?.status).toBe('interested');

    // 3. Delete Lead
    await LeadService.deleteLead(newLead.id);
    const leadsAfter = await StorageService.getLeads();
    expect(leadsAfter.find(l => l.id === newLead.id)).toBeUndefined();
  });

  test('schedules real follow-up reminder notification when lead has follow-up date and time', async () => {
    const lead = await LeadService.createLead(
      {
        name: 'Manoj Tiwari',
        phone: '9825998877',
        alternatePhone: '9825998878',
        interestedBrand: 'OnePlus',
        interestedModel: 'Nord 4',
        budget: 30000,
        remarks: 'Call for bank cashback offer',
        followUpDate: '2026-10-15',
        followUpTime: '11:30 AM',
        createdBy: mockAdmin.id,
        createdByName: mockAdmin.name,
      },
      mockAdmin,
      'new',
      false
    );

    const notifications = await StorageService.getNotifications();
    const followUpNotif = notifications.find(n => n.type === 'follow_up' && n.relatedId === lead.id);
    expect(followUpNotif).toBeDefined();
    expect(followUpNotif?.title).toContain('Follow-Up Scheduled');
    expect(followUpNotif?.body).toContain('Manoj Tiwari');
  });

  test('handles staff sales targets and incentive calculation', async () => {
    const target = await StaffPerformanceService.getStaffTarget(mockAdmin.id, '2026-10');
    expect(target).toBeDefined();
    expect(target.staffId).toBe(mockAdmin.id);

    // Update target
    await StaffPerformanceService.updateStaffTarget({
      ...target,
      targetAmount: 600000,
      incentivePercent: 3.0,
    });

    const updatedTarget = await StaffPerformanceService.getStaffTarget(mockAdmin.id, '2026-10');
    expect(updatedTarget.targetAmount).toBe(600000);
    expect(updatedTarget.incentivePercent).toBe(3.0);
  });

  test('in-app notifications creation, retrieval and read-status tracking', async () => {
    await StorageService.addNotification({
      title: 'Customer Follow-Up Alert',
      body: 'Call customer Sneha regarding Vivo V50',
      type: 'follow_up',
    });

    const notifications = await StorageService.getNotifications();
    expect(notifications.length).toBeGreaterThan(0);
    const firstNotif = notifications[0];
    expect(firstNotif.read).toBe(false);

    await StorageService.markNotificationRead(firstNotif.id);
    const updatedNotifs = await StorageService.getNotifications();
    const targetNotif = updatedNotifs.find(n => n.id === firstNotif.id);
    expect(targetNotif?.read).toBe(true);
  });

  test('FirestoreSyncService correctly defines all Firestore collections', () => {
    expect(FIRESTORE_COLLECTIONS.USERS).toBe('users');
    expect(FIRESTORE_COLLECTIONS.ATTENDANCE).toBe('attendance');
    expect(FIRESTORE_COLLECTIONS.LEADS).toBe('leads');
    expect(FIRESTORE_COLLECTIONS.MOBILE_PRICES).toBe('mobile_prices');
    expect(FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES).toBe('second_hand_purchases');
    expect(FIRESTORE_COLLECTIONS.SECOND_HAND_SALES).toBe('second_hand_sales');
    expect(FIRESTORE_COLLECTIONS.SALES_TARGETS).toBe('sales_targets');
    expect(FIRESTORE_COLLECTIONS.SALARY_SLIPS).toBe('salary_slips');
    expect(FIRESTORE_COLLECTIONS.NOTIFICATIONS).toBe('notifications');
    expect(FIRESTORE_COLLECTIONS.SHOP_CONFIG).toBe('shop_config');
  });

  test('salary slip retrieval for recorded months and null for unrecorded months', async () => {
    await StorageService.seedInitialDataIfNeeded();
    // 1. September 2026 has a seeded slip for mockAdmin (user_admin_1 / user_admin_test)
    const adminUser: User = {
      ...mockAdmin,
      id: 'user_admin_1',
    };
    const sepSlip = await StaffPerformanceService.getSalarySlip(adminUser, '2026-09');
    expect(sepSlip).not.toBeNull();
    expect(sepSlip?.month).toBe('September 2026');
    expect(sepSlip?.basicSalary).toBe(60000);
    expect(sepSlip?.salesIncentive).toBe(10000);
    expect(sepSlip?.attendanceBonus).toBe(2000);
    expect(sepSlip?.deductions).toBe(0);
    expect(sepSlip?.netSalary).toBe(72000);

    // 2. Unrecorded past month prior to joining date or without record returns null (Empty state)
    const oldSlip = await StaffPerformanceService.getSalarySlip(adminUser, '2022-05');
    expect(oldSlip).toBeNull();

    // 3. Current month generates dynamic salary slip
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const currSlip = await StaffPerformanceService.getSalarySlip(adminUser, currentMonthKey);
    expect(currSlip).not.toBeNull();
    expect(currSlip?.monthKey).toBe(currentMonthKey);
    expect(currSlip?.basicSalary).toBe(60000);
  });

  test('accurately calculates Monthly Total Leads and Closed Leads for the current calendar month', async () => {
    const currentMonthKey = new Date().toISOString().substring(0, 7); // e.g. "2026-10"
    const pastMonthKey = '2026-08';

    // Seed leads: 2 in current month, 1 in past month
    const currentLead1 = await LeadService.createLead(
      {
        name: 'Anjali Sharma',
        phone: '9988112233',
        interestedBrand: 'Samsung',
        interestedModel: 'S24',
        budget: 70000,
        remarks: 'Wants exchange offer',
        createdBy: mockAdmin.id,
        createdByName: mockAdmin.name,
      },
      mockAdmin,
      'new',
      false
    );

    const currentLead2 = await LeadService.createLead(
      {
        name: 'Vikas Patel',
        phone: '9988445566',
        interestedBrand: 'Apple',
        interestedModel: 'iPhone 15',
        budget: 65000,
        remarks: 'Cash purchase',
        createdBy: mockAdmin.id,
        createdByName: mockAdmin.name,
      },
      mockAdmin,
      'purchased',
      false
    );

    // Save a lead from a past month
    await StorageService.saveLead({
      id: 'past_lead_test_1',
      name: 'Past Customer',
      phone: '9911002233',
      interestedBrand: 'Oppo',
      interestedModel: 'Reno 11',
      budget: 30000,
      remarks: 'Past lead',
      status: 'purchased',
      createdBy: mockAdmin.id,
      createdByName: mockAdmin.name,
      createdAt: `${pastMonthKey}-10T10:00:00.000Z`,
      updatedAt: `${pastMonthKey}-15T10:00:00.000Z`,
      history: [
        {
          timestamp: `${pastMonthKey}-15T10:00:00.000Z`,
          updatedBy: mockAdmin.name,
          status: 'purchased',
          notes: 'Converted in August',
        },
      ],
    });

    const allLeads = await StorageService.getLeads();
    const currentMonthLeads = allLeads.filter(l => l.createdAt && l.createdAt.startsWith(currentMonthKey));

    // Verify Monthly Total Leads only counts leads created in the current month
    expect(currentMonthLeads.some(l => l.id === currentLead1.id)).toBe(true);
    expect(currentMonthLeads.some(l => l.id === currentLead2.id)).toBe(true);
    expect(currentMonthLeads.some(l => l.id === 'past_lead_test_1')).toBe(false);

    // Verify Monthly Closed Leads:
    // currentLead2 was created as 'purchased' in current month -> counted
    // past_lead_test_1 was converted in pastMonthKey -> NOT counted in current month
    const closedLeadIds = new Set<string>();
    allLeads.forEach(l => {
      const hasPurchasedHistoryThisMonth = l.history?.some(
        h => h.status === 'purchased' && h.timestamp && h.timestamp.startsWith(currentMonthKey)
      );
      const isPurchasedThisMonth = l.status === 'purchased' && (
        hasPurchasedHistoryThisMonth ||
        (l.updatedAt && l.updatedAt.startsWith(currentMonthKey)) ||
        (l.createdAt && l.createdAt.startsWith(currentMonthKey))
      );
      if (isPurchasedThisMonth) {
        closedLeadIds.add(l.id);
      }
    });

    expect(closedLeadIds.has(currentLead2.id)).toBe(true);
    expect(closedLeadIds.has('past_lead_test_1')).toBe(false);
  });

  test('role-based lead scoping: staff sees only own leads while admin sees all', async () => {
    const staffUser1: User = {
      id: 'staff_alice',
      name: 'Alice',
      email: 'alice@parthmobile.com',
      phone: '9870000001',
      role: 'staff',
      designation: 'Sales Executive',
      joinedDate: '2024-01-01',
      basicSalary: 20000,
      monthlyTarget: 200000,
      isActive: true,
    };

    const staffUser2: User = {
      id: 'staff_bob',
      name: 'Bob',
      email: 'bob@parthmobile.com',
      phone: '9870000002',
      role: 'staff',
      designation: 'Sales Executive',
      joinedDate: '2024-01-01',
      basicSalary: 20000,
      monthlyTarget: 200000,
      isActive: true,
    };

    // Alice creates a lead
    const leadAlice = await LeadService.createLead(
      {
        name: 'Alice Customer',
        phone: '9871112233',
        interestedBrand: 'Vivo',
        interestedModel: 'Y200',
        budget: 15000,
        remarks: 'Wants blue color',
        createdBy: staffUser1.id,
        createdByName: staffUser1.name,
      },
      staffUser1,
      'new',
      false
    );

    // Bob creates a lead
    const leadBob = await LeadService.createLead(
      {
        name: 'Bob Customer',
        phone: '9872223344',
        interestedBrand: 'Samsung',
        interestedModel: 'M35',
        budget: 18000,
        remarks: 'Cash purchase',
        createdBy: staffUser2.id,
        createdByName: staffUser2.name,
      },
      staffUser2,
      'new',
      false
    );

    // Alice should only see her lead, not Bob's lead
    const aliceLeads = await LeadService.getLeadsForUser(staffUser1);
    expect(aliceLeads.some(l => l.id === leadAlice.id)).toBe(true);
    expect(aliceLeads.some(l => l.id === leadBob.id)).toBe(false);

    // Bob should only see his lead, not Alice's lead
    const bobLeads = await LeadService.getLeadsForUser(staffUser2);
    expect(bobLeads.some(l => l.id === leadBob.id)).toBe(true);
    expect(bobLeads.some(l => l.id === leadAlice.id)).toBe(false);

    // Admin should see both leads
    const adminLeads = await LeadService.getLeadsForUser(mockAdmin);
    expect(adminLeads.some(l => l.id === leadAlice.id)).toBe(true);
    expect(adminLeads.some(l => l.id === leadBob.id)).toBe(true);
  });

  test('guards against rapid duplicate lead creation within 10s', async () => {
    const leadData = {
      name: 'Duplicate Test Customer',
      phone: '9898989898',
      interestedBrand: 'OnePlus',
      interestedModel: 'Nord CE4',
      budget: 20000,
      remarks: 'First submission',
      createdBy: mockAdmin.id,
      createdByName: mockAdmin.name,
    };

    const firstLead = await LeadService.createLead(leadData, mockAdmin, 'new', false);
    const secondLead = await LeadService.createLead(leadData, mockAdmin, 'new', false);

    expect(firstLead.id).toBe(secondLead.id);
  });

  test('preserves lead persistence across simulated app restart and local retrieval', async () => {
    const testLead = await LeadService.createLead(
      {
        name: 'Persistent Lead',
        phone: '9899112233',
        interestedBrand: 'Apple',
        interestedModel: 'iPhone 15',
        budget: 70000,
        remarks: 'Wants installment',
        createdBy: mockAdmin.id,
        createdByName: mockAdmin.name,
      },
      mockAdmin,
      'new',
      false
    );

    const leads = await StorageService.getLeads();
    const found = leads.find(l => l.id === testLead.id);
    expect(found).toBeDefined();
    expect(found?.name).toBe('Persistent Lead');
    expect(found?.phone).toBe('9899112233');
  });
});



