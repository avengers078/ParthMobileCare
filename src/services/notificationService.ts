import { Platform, PermissionsAndroid } from 'react-native';
import { StorageService } from './storageService';
import { LeadService } from './leadService';
import { AppNotification } from '../types';
import FirebaseService from './firebase';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';

export interface NotificationPermissionResult {
  granted: boolean;
  canAskAgain?: boolean;
}

export class NotificationService {
  /**
   * Request Android 13+ (API 33+) runtime POST_NOTIFICATIONS permission
   */
  static async requestNotificationPermission(): Promise<NotificationPermissionResult> {
    if (Platform.OS !== 'android') {
      return { granted: true };
    }

    try {
      if (Platform.Version >= 33) {
        const permission = 'android.permission.POST_NOTIFICATIONS' as any;
        const hasPermission = await PermissionsAndroid.check(permission);
        if (hasPermission) {
          return { granted: true };
        }

        const status = await PermissionsAndroid.request(permission, {
          title: 'Notification Permission',
          message: 'Parth Mobile Care needs notification permission for customer lead follow-ups and store alerts.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        });

        return {
          granted: status === PermissionsAndroid.RESULTS.GRANTED,
          canAskAgain: status !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
        };
      }

      // Android 12 and below grant notifications at install time
      return { granted: true };
    } catch (error) {
      console.warn('[NotificationService] Permission request failed:', error);
      return { granted: false };
    }
  }

  /**
   * Check for scheduled lead follow-ups due today and enqueue notification reminders
   */
  static async checkAndTriggerLeadReminders(): Promise<number> {
    try {
      const dueLeads = await LeadService.getDueFollowUps();
      if (!dueLeads || dueLeads.length === 0) return 0;

      const existingNotifs = await StorageService.getNotifications();
      let triggeredCount = 0;

      for (const lead of dueLeads) {
        // Prevent duplicate reminder for the same lead and date
        const alreadyNotified = existingNotifs.some(
          n => n.type === 'follow_up' && n.relatedId === lead.id && n.body.includes(lead.followUpDate || '')
        );

        if (!alreadyNotified) {
          const timeText = lead.followUpTime ? ` at ${lead.followUpTime}` : '';
          await StorageService.addNotification({
            title: `Follow-Up Due Today: ${lead.name}`,
            body: `Inquiry for ${lead.interestedBrand} ${lead.interestedModel}. Contact scheduled for ${lead.followUpDate}${timeText}.`,
            type: 'follow_up',
            relatedId: lead.id,
          });
          triggeredCount++;
        }
      }

      return triggeredCount;
    } catch (err) {
      console.warn('[NotificationService] Lead reminders check failed:', err);
      return 0;
    }
  }

  /**
   * Register or update staff device FCM token in Firestore (if FCM is configured)
   * Safely links the device registration without logging tokens or credentials.
   */
  static async registerDeviceToken(userId: string, token: string): Promise<boolean> {
    if (!userId || !token) return false;
    try {
      const db = FirebaseService.getFirestore();
      if (!db) return false;

      const userDocRef = doc(db, 'users', userId);
      await updateDoc(userDocRef, {
        fcmTokens: arrayUnion(token),
        lastDeviceRegistration: new Date().toISOString(),
      });
      return true;
    } catch {
      // In offline or rules-enforced scenarios, retain local state safely
      return false;
    }
  }

  /**
   * Dispatch an internal business alert notification
   */
  static async dispatchEventNotification(
    title: string,
    body: string,
    type: AppNotification['type'],
    relatedId?: string
  ): Promise<void> {
    await StorageService.addNotification({
      title,
      body,
      type,
      relatedId,
    });
  }
}

