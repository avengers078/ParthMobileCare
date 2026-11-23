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

import { StorageService } from '../src/services/storageService';
import { AppNotification, User } from '../src/types';

describe('Announcements & Alerts Module — Mobile Staff App Tests', () => {
  const staffA: User = {
    id: 'staff_user_A',
    name: 'Staff Alpha',
    email: 'alpha@parthmobile.com',
    phone: '9825000001',
    role: 'staff',
    designation: 'Sales Executive',
    joinedDate: '2026-01-01',
    basicSalary: 15000,
    monthlyTarget: 100000,
    isActive: true,
    deviceBindingStatus: 'approved',
    deviceId: 'device_alpha_1',
  };

  const staffB: User = {
    id: 'staff_user_B',
    name: 'Staff Beta',
    email: 'beta@parthmobile.com',
    phone: '9825000002',
    role: 'staff',
    designation: 'Technician',
    joinedDate: '2026-01-01',
    basicSalary: 16000,
    monthlyTarget: 80000,
    isActive: true,
    deviceBindingStatus: 'approved',
    deviceId: 'device_beta_1',
  };

  beforeEach(async () => {
    StorageService.clearMemoryCache();
    await StorageService.setCurrentUser(staffA);
  });

  it('1. Announcement Storage & Persistence: retrieves stored announcements and notifications', async () => {
    const notifs = await StorageService.getNotifications();
    expect(Array.isArray(notifs)).toBe(true);
  });

  it('2. Mark Announcement as Read: updates read status locally and persists', async () => {
    const testNotif: AppNotification = {
      id: 'test_announcement_1',
      userId: 'all',
      title: 'Store Timing Update',
      body: 'Store will open at 9:30 AM tomorrow.',
      type: 'announcement',
      priority: 'high',
      status: 'published',
      timestamp: new Date().toISOString(),
      read: false,
    };

    await StorageService.addNotification(testNotif);
    const beforeList = await StorageService.getNotifications();
    const foundBefore = beforeList.find(n => n.id === 'test_announcement_1');
    expect(foundBefore?.read).toBe(false);

    await StorageService.markNotificationRead('test_announcement_1');
    const afterList = await StorageService.getNotifications();
    const foundAfter = afterList.find(n => n.id === 'test_announcement_1');
    expect(foundAfter?.read).toBe(true);
  });

  it('3. Mark All Notifications as Read: batch marks all unread notifications', async () => {
    await StorageService.addNotification({
      title: 'Unread Notice 1',
      body: 'Notice 1 details',
      type: 'lead',
      userId: 'staff_user_A',
    });
    await StorageService.addNotification({
      title: 'Unread Notice 2',
      body: 'Notice 2 details',
      type: 'announcement',
      userId: 'all',
    });

    await StorageService.markAllNotificationsRead();
    const list = await StorageService.getNotifications();
    const unreadCount = list.filter(n => !n.read).length;
    expect(unreadCount).toBe(0);
  });

  it('4. Multi-Staff Audience Filtering: isolates broadcast vs targeted announcements', () => {
    const broadcast: AppNotification = {
      id: '1',
      userId: 'all',
      targetAudience: 'all',
      targetStaffIds: [],
      title: 'All Staff Broadcast',
      body: 'Broadcast message',
      type: 'announcement',
      timestamp: new Date().toISOString(),
      read: false,
    };

    const targetedMulti: AppNotification = {
      id: '2',
      userId: 'targeted',
      targetAudience: 'specific_staff',
      targetStaffIds: ['staff_user_A', 'staff_user_B'],
      title: 'Sales Team Incentive',
      body: 'Incentive for Alpha and Beta',
      type: 'announcement',
      timestamp: new Date().toISOString(),
      read: false,
    };

    const isVisibleToStaff = (n: AppNotification, staffId: string) => {
      if (n.userId === 'all' || n.targetAudience === 'all') return true;
      if (n.userId === staffId) return true;
      if (n.targetStaffIds && n.targetStaffIds.includes(staffId)) return true;
      return false;
    };

    expect(isVisibleToStaff(broadcast, staffA.id)).toBe(true);
    expect(isVisibleToStaff(targetedMulti, staffA.id)).toBe(true);
    expect(isVisibleToStaff(targetedMulti, staffB.id)).toBe(true);
    expect(isVisibleToStaff(targetedMulti, 'staff_user_C')).toBe(false);
  });

  it('5. Expiry Check: correctly filters out or flags expired announcements', () => {
    const today = new Date().toISOString().split('T')[0];
    const pastExpiry = '2026-10-01';
    const futureExpiry = '2026-12-31';

    const isExpired = (expiryDate?: string) => Boolean(expiryDate && expiryDate < today);

    expect(isExpired(pastExpiry)).toBe(true);
    expect(isExpired(futureExpiry)).toBe(false);
    expect(isExpired(undefined)).toBe(false);
  });

  it('6. Read-State Persistence Across Cloud Sync: remote read: false NEVER reverts local read: true', async () => {
    const broadcastNotif: AppNotification = {
      id: 'broadcast_diwali_2026',
      userId: 'all',
      title: 'Diwali Bonus Announcement',
      body: 'All staff receive festival bonus.',
      type: 'announcement',
      priority: 'high',
      status: 'published',
      timestamp: '2026-11-23T06:00:00.000Z',
      read: false,
    };

    // 1. Initial sync receives unread broadcast
    await StorageService.mergeCloudCollection('notifications', [broadcastNotif]);
    let list = await StorageService.getNotifications();
    let notif = list.find(n => n.id === 'broadcast_diwali_2026');
    expect(notif?.read).toBe(false);

    // 2. Staff marks it as read locally
    await StorageService.markNotificationRead('broadcast_diwali_2026');
    list = await StorageService.getNotifications();
    notif = list.find(n => n.id === 'broadcast_diwali_2026');
    expect(notif?.read).toBe(true);

    // 3. Repeated cloud sync occurs (remote is still read: false because it is a shared broadcast)
    await StorageService.mergeCloudCollection('notifications', [{
      ...broadcastNotif,
      title: 'Diwali Bonus Announcement (Updated)',
      read: false, // Cloud broadcast remains read: false
    }]);

    // 4. Verify local read state persists as true despite remote read: false
    list = await StorageService.getNotifications();
    notif = list.find(n => n.id === 'broadcast_diwali_2026');
    expect(notif?.read).toBe(true);
    expect(notif?.title).toBe('Diwali Bonus Announcement (Updated)');
  });

  it('7. App Restart & Offline Read Persistence: read state survives memory cache purge', async () => {
    const notifItem: AppNotification = {
      id: 'targeted_incentive_99',
      userId: 'targeted',
      targetAudience: 'specific_staff',
      targetStaffIds: ['staff_user_A'],
      title: 'Personal Sales Target Alert',
      body: 'Target details.',
      type: 'announcement',
      timestamp: '2026-11-23T06:30:00.000Z',
      read: false,
    };

    await StorageService.mergeCloudCollection('notifications', [notifItem]);
    await StorageService.markNotificationRead('targeted_incentive_99');

    // Simulate complete app termination & restart (clear in-memory cache)
    StorageService.clearMemoryCache();

    // Verify persisted state from AsyncStorage
    const readIds = await StorageService.getReadNotificationIds(staffA.id);
    expect(readIds.has('targeted_incentive_99')).toBe(true);

    const afterRestart = await StorageService.getNotifications();
    const afterItem = afterRestart.find(n => n.id === 'targeted_incentive_99');
    expect(afterItem?.read).toBe(true);

    // Subsequent cloud sync after reconnecting to internet
    await StorageService.mergeCloudCollection('notifications', [{ ...notifItem, read: false }]);
    const syncedList = await StorageService.getNotifications();
    const syncedItem = syncedList.find(n => n.id === 'targeted_incentive_99');
    expect(syncedItem?.read).toBe(true);
  });

  it('8. Device Multi-User Read Isolation: Staff A reading a broadcast does not mark it read for Staff B', async () => {
    const sharedBroadcast: AppNotification = {
      id: 'shared_broadcast_101',
      userId: 'all',
      title: 'General Meeting',
      body: 'Meeting at 5 PM',
      type: 'announcement',
      timestamp: '2026-11-23T07:00:00.000Z',
      read: false,
    };

    // Staff A logs in and reads the broadcast
    await StorageService.setCurrentUser(staffA);
    await StorageService.mergeCloudCollection('notifications', [sharedBroadcast]);
    await StorageService.markNotificationRead('shared_broadcast_101');

    const staffAReadIds = await StorageService.getReadNotificationIds(staffA.id);
    expect(staffAReadIds.has('shared_broadcast_101')).toBe(true);

    // Staff B logs into the same device
    await StorageService.setCurrentUser(staffB);
    const staffBReadIds = await StorageService.getReadNotificationIds(staffB.id);
    expect(staffBReadIds.has('shared_broadcast_101')).toBe(false);
  });

  it('9. Notification Deletion: removing a notification also removes it from read-state registry', async () => {
    const toDelete: AppNotification = {
      id: 'notice_to_delete_55',
      userId: 'all',
      title: 'Temporary Notice',
      body: 'Will be deleted',
      type: 'announcement',
      timestamp: '2026-11-23T07:15:00.000Z',
      read: false,
    };

    await StorageService.addNotification(toDelete);
    await StorageService.markNotificationRead('notice_to_delete_55');

    let readIds = await StorageService.getReadNotificationIds(staffA.id);
    expect(readIds.has('notice_to_delete_55')).toBe(true);

    await StorageService.deleteNotification('notice_to_delete_55');
    const remaining = await StorageService.getNotifications();
    expect(remaining.find(n => n.id === 'notice_to_delete_55')).toBeUndefined();

    readIds = await StorageService.getReadNotificationIds(staffA.id);
    expect(readIds.has('notice_to_delete_55')).toBe(false);
  });
});
