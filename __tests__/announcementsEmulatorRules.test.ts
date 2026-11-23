/**
 * ANNOUNCEMENTS & ALERTS REAL FIREBASE EMULATOR SECURITY TEST SUITE
 *
 * Runs against the actual local Cloud Firestore Emulator and executes security assertions
 * against the real local Firestore security rules (`firestore.rules`) using
 * `@firebase/rules-unit-testing`.
 *
 * Verifies that:
 * 1. Admin can create broadcast announcements (`userId: 'all'`) -> ALLOW
 * 2. Admin can create multi-staff announcements (`userId: 'targeted'`, targetStaffIds) -> ALLOW
 * 3. Specific-staff announcement with empty targetStaffIds -> DENY
 * 4. Specific-staff announcement with `userId: 'all'` -> DENY
 * 5. Specific-staff announcement with `userId: 'targeted'` when targetAudience is 'all' -> DENY
 * 6. Staff attempting to create `type: 'announcement'` -> DENY
 * 7. Staff can read broadcast announcements (`userId: 'all'`) -> ALLOW
 * 8. Targeted staff can read announcement (`uid in targetStaffIds`) -> ALLOW
 * 9. Non-targeted staff cannot read targeted announcement -> DENY
 * 10. Staff cannot read Admin-only private business notifications (leads, profit margins) -> DENY
 * 11. Admin can read all notifications and announcements -> ALLOW
 * 12. Inactive staff cannot read announcements -> DENY
 * 13. Staff cannot modify announcement content or remote read status in Firestore -> DENY
 * 14. Admin can edit/update announcement metadata and delete announcements -> ALLOW
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
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ID = 'parthmobilecare-a474d';
const RULES_PATH = path.resolve(__dirname, '../firestore.rules');

describe('Announcements & Alerts Real Firestore Emulator Security Tests', () => {
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

    // Seed test users with security rules bypassed
    await testEnv.withSecurityRulesDisabled(async (context: any) => {
      const db = context.firestore();

      // 1. Store Admin
      await setDoc(doc(db, 'users/admin_parth'), {
        id: 'admin_parth',
        name: 'Parth Patel',
        email: 'parthmobilecare07@gmail.com',
        phone: '9825000000',
        role: 'admin',
        designation: 'Store Owner',
        joinedDate: '2026-01-01',
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: true,
        deviceBindingStatus: 'approved',
        deviceId: 'dev_admin_phone',
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'system',
      });

      // 2. Active Staff Member 1
      await setDoc(doc(db, 'users/staff_chetan'), {
        id: 'staff_chetan',
        name: 'Chetan Luhar',
        email: 'chetan@parthmobile.com',
        phone: '6355725247',
        role: 'staff',
        designation: 'Sales Executive',
        joinedDate: '2026-01-01',
        basicSalary: 18000,
        monthlyTarget: 150000,
        isActive: true,
        deviceBindingStatus: 'approved',
        deviceId: 'dev_chetan_phone',
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'admin_parth',
      });

      // 3. Active Staff Member 2
      await setDoc(doc(db, 'users/staff_rohan'), {
        id: 'staff_rohan',
        name: 'Rohan Sharma',
        email: 'rohan@parthmobile.com',
        phone: '9825111222',
        role: 'staff',
        designation: 'Technician',
        joinedDate: '2026-01-01',
        basicSalary: 16000,
        monthlyTarget: 100000,
        isActive: true,
        deviceBindingStatus: 'approved',
        deviceId: 'dev_rohan_phone',
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'admin_parth',
      });

      // 4. Inactive Staff Member
      await setDoc(doc(db, 'users/staff_inactive'), {
        id: 'staff_inactive',
        name: 'Inactive Staff',
        email: 'inactive@parthmobile.com',
        phone: '9825333444',
        role: 'staff',
        designation: 'Former Staff',
        joinedDate: '2026-01-01',
        basicSalary: 12000,
        monthlyTarget: 50000,
        isActive: false,
        deviceBindingStatus: 'approved',
        deviceId: 'dev_inactive_phone',
        createdAt: '2026-01-01T00:00:00Z',
        createdBy: 'admin_parth',
      });

      // 5. Seed an existing broadcast announcement
      await setDoc(doc(db, 'notifications/notif_broadcast_diwali'), {
        id: 'notif_broadcast_diwali',
        userId: 'all',
        title: 'Diwali Store Timings',
        body: 'Store will remain open until 10 PM.',
        type: 'announcement',
        priority: 'high',
        status: 'published',
        targetAudience: 'all',
        targetStaffIds: [],
        timestamp: '2026-11-23T06:00:00Z',
        read: false,
        readBy: [],
        createdBy: 'admin_parth',
        authorName: 'Parth Patel',
      });

      // 6. Seed a multi-staff announcement targeted only to staff_chetan and staff_rohan
      await setDoc(doc(db, 'notifications/notif_targeted_sales'), {
        id: 'notif_targeted_sales',
        userId: 'targeted',
        title: 'Sales Team Morning Briefing',
        body: 'Briefing at 10 AM on sales targets.',
        type: 'announcement',
        priority: 'urgent',
        status: 'published',
        targetAudience: 'specific_staff',
        targetStaffIds: ['staff_chetan', 'staff_rohan'],
        timestamp: '2026-11-23T06:30:00Z',
        read: false,
        readBy: [],
        createdBy: 'admin_parth',
        authorName: 'Parth Patel',
      });

      // 7. Seed an Admin-only confidential business notification (profit margin)
      await setDoc(doc(db, 'notifications/notif_admin_profit_alert'), {
        id: 'notif_admin_profit_alert',
        userId: 'admin_parth',
        title: 'Second-Hand Mobile Sold: ₹35,000',
        body: 'Apple iPhone 14 Pro Sold | Profit: ₹20,000',
        type: 'sale',
        timestamp: '2026-11-23T07:00:00Z',
        read: false,
        relatedId: 'sale_1793665243160_u6e6e',
      });
    });
  });

  it('1. Admin can create a valid store broadcast announcement (userId == "all")', async () => {
    const adminCtx = testEnv.authenticatedContext('admin_parth', { email: 'parthmobilecare07@gmail.com' });
    const db = adminCtx.firestore();

    await assertSucceeds(
      setDoc(doc(db, 'notifications/notif_test_admin_broadcast'), {
        id: 'notif_test_admin_broadcast',
        userId: 'all',
        title: 'Staff Meeting Friday',
        body: 'General all-hands store meeting.',
        type: 'announcement',
        priority: 'normal',
        status: 'published',
        targetAudience: 'all',
        targetStaffIds: [],
        timestamp: '2026-11-23T08:00:00Z',
        read: false,
        readBy: [],
      })
    );
  });

  it('2. Admin can create multi-staff announcement with userId: "targeted"', async () => {
    const adminCtx = testEnv.authenticatedContext('admin_parth', { email: 'parthmobilecare07@gmail.com' });
    const db = adminCtx.firestore();

    await assertSucceeds(
      setDoc(doc(db, 'notifications/notif_test_multi_target'), {
        id: 'notif_test_multi_target',
        userId: 'targeted',
        title: 'Technician Notice',
        body: 'Special tools have arrived.',
        type: 'announcement',
        priority: 'high',
        status: 'published',
        targetAudience: 'specific_staff',
        targetStaffIds: ['staff_chetan', 'staff_rohan'],
        timestamp: '2026-11-23T08:15:00Z',
        read: false,
        readBy: [],
      })
    );
  });

  it('3. Specific-staff announcement with empty targetStaffIds is DENIED', async () => {
    const adminCtx = testEnv.authenticatedContext('admin_parth', { email: 'parthmobilecare07@gmail.com' });
    const db = adminCtx.firestore();

    await assertFails(
      setDoc(doc(db, 'notifications/notif_invalid_empty_staff'), {
        id: 'notif_invalid_empty_staff',
        userId: 'targeted',
        title: 'Empty Staff Announcement',
        body: 'No recipients provided.',
        type: 'announcement',
        priority: 'normal',
        status: 'published',
        targetAudience: 'specific_staff',
        targetStaffIds: [], // Empty!
        timestamp: '2026-11-23T08:20:00Z',
        read: false,
      })
    );
  });

  it('4. Specific-staff announcement with userId == "all" is DENIED (anti-leakage)', async () => {
    const adminCtx = testEnv.authenticatedContext('admin_parth', { email: 'parthmobilecare07@gmail.com' });
    const db = adminCtx.firestore();

    await assertFails(
      setDoc(doc(db, 'notifications/notif_invalid_leakage'), {
        id: 'notif_invalid_leakage',
        userId: 'all', // Inconsistent!
        title: 'Leaked Notice',
        body: 'Should not leak to all staff.',
        type: 'announcement',
        priority: 'urgent',
        status: 'published',
        targetAudience: 'specific_staff',
        targetStaffIds: ['staff_chetan'],
        timestamp: '2026-11-23T08:25:00Z',
        read: false,
      })
    );
  });

  it('5. Broadcast announcement with userId == "targeted" is DENIED', async () => {
    const adminCtx = testEnv.authenticatedContext('admin_parth', { email: 'parthmobilecare07@gmail.com' });
    const db = adminCtx.firestore();

    await assertFails(
      setDoc(doc(db, 'notifications/notif_invalid_targeted_broadcast'), {
        id: 'notif_invalid_targeted_broadcast',
        userId: 'targeted', // Inconsistent!
        title: 'Broadcast Confusion',
        body: 'Audience is all but userId is targeted.',
        type: 'announcement',
        priority: 'normal',
        status: 'published',
        targetAudience: 'all',
        targetStaffIds: [],
        timestamp: '2026-11-23T08:30:00Z',
        read: false,
      })
    );
  });

  it('6. Staff attempting to create announcement is DENIED', async () => {
    const staffCtx = testEnv.authenticatedContext('staff_chetan');
    const db = staffCtx.firestore();

    await assertFails(
      setDoc(doc(db, 'notifications/notif_staff_forged_notice'), {
        id: 'notif_staff_forged_notice',
        userId: 'all',
        title: 'Store Closing Early',
        body: 'Staff forged announcement.',
        type: 'announcement',
        timestamp: '2026-11-23T08:35:00Z',
        read: false,
      })
    );
  });

  it('7. Staff can read store broadcast announcements (userId == "all")', async () => {
    const staffCtx = testEnv.authenticatedContext('staff_chetan');
    const db = staffCtx.firestore();

    await assertSucceeds(getDoc(doc(db, 'notifications/notif_broadcast_diwali')));
  });

  it('8. Targeted staff can read announcement where authenticated UID is in targetStaffIds', async () => {
    const chetanCtx = testEnv.authenticatedContext('staff_chetan');
    const dbChetan = chetanCtx.firestore();

    await assertSucceeds(getDoc(doc(dbChetan, 'notifications/notif_targeted_sales')));
  });

  it('9. Non-targeted staff CANNOT read targeted announcement (horizontal isolation)', async () => {
    // Authenticate as a different staff member not in targetStaffIds
    const outsiderCtx = testEnv.authenticatedContext('staff_outsider');
    const dbOutsider = outsiderCtx.firestore();

    await assertFails(getDoc(doc(dbOutsider, 'notifications/notif_targeted_sales')));
  });

  it('10. Staff CANNOT read Admin-only private business notifications (protects profit and leads)', async () => {
    const chetanCtx = testEnv.authenticatedContext('staff_chetan');
    const dbChetan = chetanCtx.firestore();

    await assertFails(getDoc(doc(dbChetan, 'notifications/notif_admin_profit_alert')));
  });

  it('11. Admin can read all notifications and announcements', async () => {
    const adminCtx = testEnv.authenticatedContext('admin_parth', { email: 'parthmobilecare07@gmail.com' });
    const db = adminCtx.firestore();

    await assertSucceeds(getDoc(doc(db, 'notifications/notif_broadcast_diwali')));
    await assertSucceeds(getDoc(doc(db, 'notifications/notif_targeted_sales')));
    await assertSucceeds(getDoc(doc(db, 'notifications/notif_admin_profit_alert')));
  });

  it('12. Inactive staff CANNOT read any announcements or notifications', async () => {
    const inactiveCtx = testEnv.authenticatedContext('staff_inactive');
    const db = inactiveCtx.firestore();

    await assertFails(getDoc(doc(db, 'notifications/notif_broadcast_diwali')));
    await assertFails(getDoc(doc(db, 'notifications/notif_targeted_sales')));
  });

  it('13. Staff CANNOT modify announcement content or remote read status in Firestore', async () => {
    const staffCtx = testEnv.authenticatedContext('staff_chetan');
    const db = staffCtx.firestore();

    // Attempting to modify title
    await assertFails(
      updateDoc(doc(db, 'notifications/notif_broadcast_diwali'), {
        title: 'Tampered Title',
      })
    );

    // Attempting to mark broadcast as read directly in shared Firestore collection
    await assertFails(
      updateDoc(doc(db, 'notifications/notif_broadcast_diwali'), {
        read: true,
      })
    );
  });

  it('14. Admin can edit announcement content and delete announcements', async () => {
    const adminCtx = testEnv.authenticatedContext('admin_parth', { email: 'parthmobilecare07@gmail.com' });
    const db = adminCtx.firestore();

    // Admin updates announcement
    await assertSucceeds(
      updateDoc(doc(db, 'notifications/notif_broadcast_diwali'), {
        body: 'Updated timings: Store will remain open until 10:30 PM.',
      })
    );

    // Admin deletes announcement
    await assertSucceeds(deleteDoc(doc(db, 'notifications/notif_broadcast_diwali')));
  });
});
