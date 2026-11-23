import { User, StaffDeviceInfo, DeviceChangeRequest, DeviceBindingStatus } from '../types';
import { DeviceSecurityService } from './deviceSecurityService';
import { StorageService } from './storageService';
import FirebaseService from './firebase';

export type DeviceStatusType =
  | 'APPROVED'
  | 'PENDING_APPROVAL'
  | 'UNREGISTERED'
  | 'REJECTED'
  | 'DEVICE_MISMATCH';

export interface DeviceBindingCheckResult {
  status: DeviceStatusType;
  canPunch: boolean;
  message: string;
  currentDeviceId: string;
  registeredDeviceId?: string;
  registeredModel?: string;
  rejectionReason?: string;
}

export class DeviceBindingService {
  /**
   * Evaluates the current device against the authenticated user's Firestore profile.
   * Auto-refreshes profile from Firestore when connected so Admin approvals are reflected immediately.
   */
  static async checkDeviceStatus(user: User): Promise<DeviceBindingCheckResult> {
    const currentDevice = await DeviceSecurityService.getDeviceInfo();
    const currentId = currentDevice.installationId;

    if (!user || !user.id) {
      return {
        status: 'UNREGISTERED',
        canPunch: false,
        message: 'No active staff session.',
        currentDeviceId: currentId,
      };
    }

    let activeUser = user;
    const db = FirebaseService.getFirestore();
    if (db && user.id) {
      try {
        const { doc, getDoc } = require('firebase/firestore');
        const userDocRef = doc(db, 'users', user.id);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const freshData = userDoc.data() as User;
          activeUser = { ...user, ...freshData, id: user.id };
          await StorageService.saveUser(activeUser);
        }
      } catch (e) {
        // Offline or non-blocking, continue with activeUser
      }
    }

    // 1. Explicitly unregistered status
    if (activeUser.deviceBindingStatus === 'unregistered') {
      return {
        status: 'UNREGISTERED',
        canPunch: false,
        message: 'This phone is not registered for your account. Please request approval from your administrator.',
        currentDeviceId: currentId,
      };
    }

    // 2. Pending or rejected status
    if (activeUser.deviceBindingStatus === 'pending_approval') {
      return {
        status: 'PENDING_APPROVAL',
        canPunch: false,
        message: 'Your device change request is waiting for administrator approval.',
        currentDeviceId: currentId,
        registeredDeviceId: activeUser.deviceId,
        registeredModel: activeUser.deviceModel,
      };
    }

    if (activeUser.deviceBindingStatus === 'rejected') {
      return {
        status: 'REJECTED',
        canPunch: false,
        message: `Device registration was rejected by Administrator: ${activeUser.deviceRejectionReason || 'Contact your administrator.'}`,
        currentDeviceId: currentId,
        registeredDeviceId: activeUser.deviceId,
        registeredModel: activeUser.deviceModel,
        rejectionReason: activeUser.deviceRejectionReason,
      };
    }

    // 3. Device ID is registered: verify hardware match
    if (activeUser.deviceId) {
      if (activeUser.deviceId !== currentId) {
        // Check if a device change request is already submitted and pending for this user
        const pendingChange = await this.getPendingDeviceChangeRequest(activeUser.id);
        if (pendingChange && pendingChange.status === 'pending') {
          return {
            status: 'PENDING_APPROVAL',
            canPunch: false,
            message: 'Your device change request is waiting for administrator approval.',
            currentDeviceId: currentId,
            registeredDeviceId: activeUser.deviceId,
            registeredModel: activeUser.deviceModel,
          };
        }

        return {
          status: 'DEVICE_MISMATCH',
          canPunch: false,
          message: 'This phone is not registered for your account. Please request approval from your administrator.',
          currentDeviceId: currentId,
          registeredDeviceId: activeUser.deviceId,
          registeredModel: activeUser.deviceModel,
        };
      }

      return {
        status: 'APPROVED',
        canPunch: true,
        message: 'Device verified and approved for attendance.',
        currentDeviceId: currentId,
        registeredDeviceId: activeUser.deviceId,
        registeredModel: activeUser.deviceModel,
      };
    }

    // 4. Neither deviceId nor deviceBindingStatus is defined
    if (activeUser.role === 'admin' || activeUser.deviceBindingStatus === undefined) {
      return {
        status: 'APPROVED',
        canPunch: true,
        message: 'Device verified.',
        currentDeviceId: currentId,
      };
    }

    return {
      status: 'UNREGISTERED',
      canPunch: false,
      message: 'This phone is not registered for your account. Please request approval from your administrator.',
      currentDeviceId: currentId,
    };
  }

  /**
   * Registers the current device for a staff account that is not yet bound to an approved device.
   * Strictly prevents overwriting an existing approved device.
   */
  static async registerDevice(user: User): Promise<{ success: boolean; message: string; updatedUser?: User }> {
    if (!user || !user.id) {
      return { success: false, message: 'Authentication required.' };
    }

    // Safety: Prevent overwriting an already approved device binding
    if (user.deviceId && user.deviceBindingStatus === 'approved') {
      const current = await DeviceSecurityService.getDeviceInfo();
      if (user.deviceId !== current.installationId) {
        return {
          success: false,
          message: 'Cannot overwrite an existing approved device. Please submit a Device Change Request.',
        };
      }
      return { success: true, message: 'This device is already approved.' };
    }

    try {
      const deviceInfo = await DeviceSecurityService.getDeviceInfo(true);
      const nowIso = new Date().toISOString();

      const updatedUser: User = {
        ...user,
        deviceId: deviceInfo.installationId,
        devicePublicKey: deviceInfo.publicKey,
        deviceModel: deviceInfo.model,
        devicePlatform: deviceInfo.platform,
        deviceBindingStatus: 'pending_approval',
        deviceRegisteredAt: nowIso,
        deviceRejectionReason: undefined,
      };

      // 1. Update Firestore if online
      const db = FirebaseService.getFirestore();
      if (db) {
        try {
          const { doc, updateDoc } = require('firebase/firestore');
          const userDocRef = doc(db, 'users', user.id);
          await updateDoc(userDocRef, {
            deviceId: deviceInfo.installationId,
            devicePublicKey: deviceInfo.publicKey,
            deviceModel: deviceInfo.model,
            devicePlatform: deviceInfo.platform,
            deviceBindingStatus: 'pending_approval',
            deviceRegisteredAt: nowIso,
          });
        } catch (dbErr: any) {
          console.warn('[DeviceBindingService] Firestore update note:', dbErr?.message || dbErr);
        }
      }

      // 2. Update local storage
      await StorageService.saveUser(updatedUser);

      // 3. Log audit event
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'register_device' as any,
        status: 'pending' as any,
        notes: `Device registration submitted: ${deviceInfo.model} (${deviceInfo.installationId.substring(0, 16)}...)`,
      });

      return {
        success: true,
        message: 'Device registration submitted! Awaiting Administrator approval.',
        updatedUser,
      };
    } catch (error: any) {
      console.warn('[DeviceBindingService] Device registration failed:', error);
      return {
        success: false,
        message: error?.message || 'Device registration failed. Please try again.',
      };
    }
  }

  /**
   * Submits a formal Device Change Request when an employee switches phones or reinstalls.
   */
  static async submitDeviceChangeRequest(
    user: User,
    reason: string
  ): Promise<{ success: boolean; message: string; request?: DeviceChangeRequest }> {
    if (!user || !user.id) {
      return { success: false, message: 'Authentication required.' };
    }

    const cleanReason = reason?.trim();
    if (!cleanReason || cleanReason.length < 5) {
      return { success: false, message: 'Please provide a clear reason for the device change (minimum 5 characters).' };
    }

    try {
      // Check for existing pending request
      const existing = await this.getPendingDeviceChangeRequest(user.id);
      if (existing) {
        return {
          success: false,
          message: 'You already have a device change request pending Administrator approval.',
          request: existing,
        };
      }

      const deviceInfo = await DeviceSecurityService.getDeviceInfo(true);
      const nowIso = new Date().toISOString();
      const requestId = `dcr_${user.id}_${Date.now()}`;

      // Pre-fetch canonical Firestore user doc to ensure strict conformance with firestore.rules
      let canonicalName = user.name;
      let canonicalEmail = user.email;
      let currentDeviceId = user.deviceId;
      let currentDeviceModel = user.deviceModel;

      const db = FirebaseService.getFirestore();
      if (db) {
        try {
          const { doc, getDoc } = require('firebase/firestore');
          const userDocSnap = await getDoc(doc(db, 'users', user.id));
          if (userDocSnap.exists()) {
            const data = userDocSnap.data();
            if (data.name) canonicalName = data.name;
            if (data.email) canonicalEmail = data.email;
            if (data.deviceId) currentDeviceId = data.deviceId;
            if (data.deviceModel) currentDeviceModel = data.deviceModel;
          }
        } catch (fetchErr) {
          console.warn('[DeviceBindingService] Pre-fetch canonical user profile error:', fetchErr);
        }
      }

      const request: DeviceChangeRequest = {
        id: requestId,
        userId: user.id,
        userName: canonicalName,
        userEmail: canonicalEmail,
        ...(currentDeviceId ? { currentDeviceId } : {}),
        ...(currentDeviceModel ? { currentDeviceModel } : {}),
        newDeviceId: deviceInfo.installationId,
        newDevicePublicKey: deviceInfo.publicKey,
        newDeviceModel: deviceInfo.model,
        newDevicePlatform: deviceInfo.platform,
        reason: cleanReason,
        status: 'pending',
        createdAt: nowIso,
      };

      // 1. Save to Cloud Firestore
      if (db) {
        const { doc, setDoc } = require('firebase/firestore');
        const docRef = doc(db, 'device_change_requests', requestId);
        await setDoc(docRef, request);
      }

      // 2. Save locally and update in-memory user
      await StorageService.saveDeviceChangeRequest(request);

      // 3. Log audit event
      await StorageService.addAttendanceAuditLog({
        userId: user.id,
        userName: user.name,
        action: 'device_change_request' as any,
        status: 'pending' as any,
        notes: `Device replacement request submitted: "${cleanReason}". Target model: ${deviceInfo.model}`,
      });

      return {
        success: true,
        message: 'Device change request submitted. You will be notified once the Administrator approves it.',
        request,
      };
    } catch (error: any) {
      console.warn('[DeviceBindingService] Submit device change request failed:', error);
      return {
        success: false,
        message: error?.message || 'Failed to submit device change request.',
      };
    }
  }

  /**
   * Retrieves any active pending device change request for this user.
   */
  static async getPendingDeviceChangeRequest(userId: string): Promise<DeviceChangeRequest | null> {
    try {
      // 1. Try Firestore
      const db = FirebaseService.getFirestore();
      if (db) {
        try {
          const { collection, query, where, getDocs } = require('firebase/firestore');
          const colRef = collection(db, 'device_change_requests');
          const q = query(colRef, where('userId', '==', userId), where('status', '==', 'pending'));
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const docSnap = snapshot.docs[0];
            return { ...docSnap.data(), id: docSnap.id } as DeviceChangeRequest;
          }
        } catch (dbErr) {
          console.warn('[DeviceBindingService] Firestore query error, falling back to local:', dbErr);
        }
      }

      // 2. Local fallback
      const localList = await StorageService.getDeviceChangeRequests();
      const found = localList.find(r => r.userId === userId && r.status === 'pending');
      return found || null;
    } catch (error) {
      console.warn('[DeviceBindingService] getPendingDeviceChangeRequest error:', error);
      return null;
    }
  }

  /**
   * Cancels a pending device change request (staff initiated).
   */
  static async cancelDeviceChangeRequest(requestId: string, userId: string): Promise<boolean> {
    try {
      const db = FirebaseService.getFirestore();
      if (db) {
        try {
          const { doc, updateDoc } = require('firebase/firestore');
          const docRef = doc(db, 'device_change_requests', requestId);
          await updateDoc(docRef, { status: 'cancelled' });
        } catch (dbErr) {
          console.warn('[DeviceBindingService] Firestore cancel error:', dbErr);
        }
      }

      await StorageService.updateDeviceChangeRequestStatus(requestId, 'cancelled');
      return true;
    } catch (error) {
      console.warn('[DeviceBindingService] Cancel error:', error);
      return false;
    }
  }
}
