import { AppNotification } from '../types';
import { NavTab } from '../layouts/DashboardLayout';

export interface NavigationParams {
  recordId?: string;
  subTab?: string;
  staffId?: string;
  requestId?: string;
  date?: string;
  month?: string;
  type?: string;
  [key: string]: any;
}

export interface NotificationNavigationResult {
  action: 'navigate' | 'modal' | 'error';
  tab?: NavTab;
  params?: NavigationParams;
  modalType?: 'announcement';
  errorMessage?: string;
}

/**
 * Resolves context-aware navigation destination and parameters for an AppNotification.
 * Safely maps existing Firestore types and payload contents to destination routes.
 */
export function resolveNotificationNavigation(
  notification: AppNotification | null | undefined
): NotificationNavigationResult {
  if (!notification || !notification.id) {
    return {
      action: 'error',
      errorMessage: 'Unable to open this notification. Please try again.',
    };
  }

  const rawType = String(notification.type || '').toLowerCase().trim();
  const title = String(notification.title || '').toLowerCase();
  const body = String(notification.body || '').toLowerCase();
  const relatedId = notification.relatedId?.trim() || undefined;
  const userId = notification.userId?.trim() || undefined;

  // 1. Staff Registration Requests
  if (
    rawType === 'staff_registration' ||
    title.includes('registration request') ||
    title.includes('staff registration') ||
    body.includes('submitted staff registration')
  ) {
    return {
      action: 'navigate',
      tab: 'staff',
      params: {
        subTab: 'registrations',
        staffId: relatedId || userId,
        type: 'staff_registration',
      },
    };
  }

  // 2. Staff Device Binding & Device Change Requests
  if (
    rawType === 'device_binding' ||
    title.includes('device binding') ||
    title.includes('device change') ||
    body.includes('new device') ||
    body.includes('device change request')
  ) {
    return {
      action: 'navigate',
      tab: 'staff',
      params: {
        subTab: 'devices',
        requestId: relatedId,
        staffId: userId,
        type: 'device_binding',
      },
    };
  }

  // 3. Staff Biometric Face Enrollment Approval Requests
  if (
    rawType === 'face_enrollment' ||
    rawType === 'biometric' ||
    title.includes('face enrollment') ||
    title.includes('biometric') ||
    body.includes('face enrollment') ||
    body.includes('biometric face')
  ) {
    return {
      action: 'navigate',
      tab: 'staff',
      params: {
        subTab: 'faces',
        staffId: relatedId || userId,
        type: 'face_enrollment',
      },
    };
  }

  // 3. Customer Lead Follow-Up
  if (rawType === 'follow_up' || title.includes('follow up') || title.includes('follow-up')) {
    return {
      action: 'navigate',
      tab: 'leads',
      params: {
        recordId: relatedId,
        type: 'follow_up',
      },
    };
  }

  // 4. Customer Lead (General / New Inquiry)
  if (rawType === 'lead' || title.includes('new lead') || title.includes('inquiry')) {
    return {
      action: 'navigate',
      tab: 'leads',
      params: {
        recordId: relatedId,
        type: 'lead',
      },
    };
  }

  // 5. Second-Hand Device Sale & Tax Invoice
  if (rawType === 'sale' || title.includes('sale') || title.includes('invoice')) {
    return {
      action: 'navigate',
      tab: 'secondhand',
      params: {
        subTab: 'sales',
        recordId: relatedId,
        type: 'sale',
      },
    };
  }

  // 6. Second-Hand Device Purchase & Quality Check
  if (rawType === 'purchase' || title.includes('purchase') || title.includes('device intake')) {
    return {
      action: 'navigate',
      tab: 'secondhand',
      params: {
        subTab: 'purchases',
        recordId: relatedId,
        type: 'purchase',
      },
    };
  }

  // 7. Staff Attendance & Punch Alerts
  if (rawType === 'attendance' || title.includes('attendance') || title.includes('punch')) {
    const recordDate = notification.timestamp
      ? notification.timestamp.slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    return {
      action: 'navigate',
      tab: 'attendance',
      params: {
        recordId: relatedId,
        staffId: userId || relatedId,
        date: recordDate,
        type: 'attendance',
      },
    };
  }

  // 8. Salary, Payroll & Sales Target Achievements
  if (
    rawType === 'salary' ||
    rawType === 'target' ||
    title.includes('salary') ||
    title.includes('pay slip') ||
    title.includes('target achieved')
  ) {
    const recordMonth = notification.timestamp
      ? notification.timestamp.slice(0, 7)
      : new Date().toISOString().slice(0, 7);

    return {
      action: 'navigate',
      tab: 'payroll',
      params: {
        staffId: userId || relatedId,
        month: recordMonth,
        recordId: relatedId,
        type: 'salary',
      },
    };
  }

  // 9. Store Announcement (Open Full Details Modal in Announcements & Alerts)
  if (rawType === 'announcement' || title.includes('announcement') || title.includes('broadcast')) {
    return {
      action: 'modal',
      modalType: 'announcement',
    };
  }

  // Default Fallback: View Details in Announcement Modal
  return {
    action: 'modal',
    modalType: 'announcement',
  };
}

/**
 * Returns user-friendly action helper text for each notification row
 */
export function getNotificationActionLabel(notification: AppNotification): string {
  const result = resolveNotificationNavigation(notification);
  if (result.action === 'modal') {
    return 'View Announcement';
  }
  switch (result.tab) {
    case 'leads':
      return 'Open Customer Lead';
    case 'secondhand':
      return result.params?.subTab === 'sales' ? 'View Sale Invoice' : 'View Device Intake';
    case 'attendance':
      return 'Inspect Attendance';
    case 'staff':
      return result.params?.subTab === 'registrations'
        ? 'Review Registration'
        : result.params?.subTab === 'faces'
        ? 'Review Face Biometric'
        : result.params?.subTab === 'devices'
        ? 'Review Device'
        : 'View Staff Profile';
    case 'payroll':
      return 'Open Salary Slip';
    default:
      return 'View Record';
  }
}
