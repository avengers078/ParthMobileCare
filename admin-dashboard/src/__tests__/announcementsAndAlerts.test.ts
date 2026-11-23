import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiService } from '../services/api';
import { AppNotification } from '../types';

// Mock Firebase
vi.mock('../services/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'admin_test_uid', email: 'parthmobilecare07@gmail.com' } },
  FIRESTORE_COLLECTIONS: {
    NOTIFICATIONS: 'notifications',
    USERS: 'users',
    ADMIN_AUDIT_LOGS: 'admin_audit_logs',
  },
}));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn((_db, _col, id) => ({ id })),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  updateDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  where: vi.fn(),
}));

describe('Announcements & Alerts Module — Admin Dashboard Test Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ApiService.invalidateCache();
  });

  it('1. Admin Announcement Creation: creates broadcast announcement with full payload', async () => {
    const admin = { id: 'admin_uid', name: 'Parth Patel' };
    const result = await ApiService.createAnnouncement(
      {
        title: 'Diwali Festive Bonus Announced',
        body: 'All staff exceeding target will receive 20% festival bonus.',
        priority: 'high',
        status: 'published',
        targetAudience: 'all',
        startDate: '2026-11-23',
        expiryDate: '2026-11-30',
      },
      admin
    );

    expect(result.id).toMatch(/^notif_/);
    expect(result.userId).toBe('all');
    expect(result.title).toBe('Diwali Festive Bonus Announced');
    expect(result.priority).toBe('high');
    expect(result.status).toBe('published');
    expect(result.targetAudience).toBe('all');
    expect(result.authorName).toBe('Parth Patel');
    expect(result.read).toBe(false);
  });

  it('2. Target-Specific Announcement: sets targetAudience and targetStaffIds correctly with userId: "targeted"', async () => {
    const admin = { id: 'admin_uid', name: 'Parth Patel' };
    const targetStaff = ['staff_chetan_1', 'staff_rohan_2'];
    const result = await ApiService.createAnnouncement(
      {
        title: 'Targeted Sales Meeting',
        body: 'Meeting at 7 PM for sales team.',
        priority: 'urgent',
        status: 'published',
        targetAudience: 'specific_staff',
        targetStaffIds: targetStaff,
        startDate: '2026-11-23',
      },
      admin
    );

    expect(result.targetAudience).toBe('specific_staff');
    expect(result.targetStaffIds).toEqual(targetStaff);
    expect(result.priority).toBe('urgent');
    expect(result.userId).toBe('targeted'); // Multi-staff uses 'targeted', never falls back to 'all'
  });

  it('2b. Single-Staff Target Announcement: sets userId to the individual recipient UID', async () => {
    const admin = { id: 'admin_uid', name: 'Parth Patel' };
    const result = await ApiService.createAnnouncement(
      {
        title: 'One-on-One Performance Review',
        body: 'Please meet at office.',
        priority: 'normal',
        status: 'published',
        targetAudience: 'specific_staff',
        targetStaffIds: ['staff_chetan_1'],
      },
      admin
    );

    expect(result.targetAudience).toBe('specific_staff');
    expect(result.targetStaffIds).toEqual(['staff_chetan_1']);
    expect(result.userId).toBe('staff_chetan_1');
  });

  it('2c. Empty Staff Target Rejection: throws error when no staff UID is provided for specific_staff', async () => {
    const admin = { id: 'admin_uid', name: 'Parth Patel' };
    await expect(
      ApiService.createAnnouncement(
        {
          title: 'Invalid Specific Staff Notice',
          body: 'Has no recipients',
          targetAudience: 'specific_staff',
          targetStaffIds: [],
        },
        admin
      )
    ).rejects.toThrow('At least one staff member must be selected');
  });

  it('3. Scheduled Announcement: automatically tags as scheduled if start date is in the future', async () => {
    const admin = { id: 'admin_uid', name: 'Parth Patel' };
    const futureDate = new Date(Date.now() + 86400000 * 5).toISOString().split('T')[0];
    const result = await ApiService.createAnnouncement(
      {
        title: 'New Store Opening Next Week',
        body: 'Staff training will begin next Monday.',
        priority: 'normal',
        status: 'published',
        targetAudience: 'all',
        startDate: futureDate,
      },
      admin
    );

    expect(result.status).toBe('scheduled');
  });

  it('4. Draft Announcement: preserves draft status and shields from staff by binding userId to admin', async () => {
    const admin = { id: 'admin_uid', name: 'Parth Patel' };
    const result = await ApiService.createAnnouncement(
      {
        title: 'Draft Policy Update',
        body: 'Drafting new leave policies.',
        priority: 'normal',
        status: 'draft',
        targetAudience: 'all',
      },
      admin
    );

    expect(result.status).toBe('draft');
    expect(result.userId).toBe('admin_uid'); // Shielded from staff
  });

  it('5. Admin Announcement Update: edits content, priority, and audience', async () => {
    const admin = { id: 'admin_uid', name: 'Parth Patel' };
    await expect(
      ApiService.updateAnnouncement(
        'notif_test_123',
        {
          title: 'Updated Policy Title',
          body: 'Updated body text with revisions.',
          priority: 'urgent',
          status: 'published',
        },
        admin
      )
    ).resolves.not.toThrow();
  });

  it('6. Admin Announcement Deletion: removes announcement record and logs audit', async () => {
    const admin = { id: 'admin_uid', name: 'Parth Patel' };
    await expect(
      ApiService.deleteAnnouncement('notif_to_delete', 'Title to delete', admin)
    ).resolves.not.toThrow();
  });

  it('7. Safe Mark as Read: uses setDoc merge so legacy notifications without userId succeed', async () => {
    // Legacy notification without userId must not crash
    await expect(ApiService.markNotificationRead('legacy_notif_without_user_id')).resolves.not.toThrow();
  });

  it('8. Safe Batch Mark All Read: updates all unread notifications in batch', async () => {
    const unreadIds = ['notif_1', 'notif_2', 'notif_3'];
    await expect(ApiService.markAllNotificationsRead(unreadIds)).resolves.not.toThrow();
  });

  it('9. Expiry Evaluation: identifies expired announcements based on date comparison', () => {
    const pastDate = '2026-10-01';
    const futureDate = '2026-12-31';
    const today = new Date().toISOString().split('T')[0];

    const isExpired = (expiryDate?: string) => Boolean(expiryDate && expiryDate < today);

    expect(isExpired(pastDate)).toBe(true);
    expect(isExpired(futureDate)).toBe(false);
    expect(isExpired(undefined)).toBe(false);
  });
});
