import FirebaseService from './firebase';
import { StorageService } from './storageService';

export const FIRESTORE_COLLECTIONS = {
  USERS: 'users',
  ATTENDANCE: 'attendance',
  LEADS: 'leads',
  MOBILE_PRICES: 'mobile_prices',
  SECOND_HAND_PURCHASES: 'second_hand_purchases',
  SECOND_HAND_SALES: 'second_hand_sales',
  SALES_TARGETS: 'sales_targets',
  SALARY_SLIPS: 'salary_slips',
  NOTIFICATIONS: 'notifications',
  SHOP_CONFIG: 'shop_config',
  CONNECTION_TEST: '_connection_test',
} as const;

let firestoreLib: any = null;
function getFirestoreLib() {
  if (!firestoreLib) {
    try {
      firestoreLib = require('firebase/firestore');
    } catch {
      firestoreLib = null;
    }
  }
  return firestoreLib;
}

export interface SyncResult {
  success: boolean;
  syncedCount: number;
  error?: string;
  details?: Record<string, number>;
}

export class FirestoreSyncService {
  /**
   * Run live runtime connectivity diagnostics
   */
  static async testConnection() {
    return FirebaseService.testFirestoreConnection();
  }

  /**
   * Sync a single document to Cloud Firestore
   */
  static async syncDocument(collectionName: string, docId: string, data: any): Promise<boolean> {
    try {
      const db = FirebaseService.getFirestore();
      const fLib = getFirestoreLib();
      if (!db || !fLib) return false;

      // Remove undefined fields to prevent Firestore serialization errors
      const sanitized = JSON.parse(JSON.stringify(data));
      const docRef = fLib.doc(db, collectionName, docId);
      await fLib.setDoc(docRef, { ...sanitized, _syncedAt: new Date().toISOString() }, { merge: true });
      return true;
    } catch (e: any) {
      // Graceful offline fallback (app stays 100% responsive without blocking)
      console.log(`[FirestoreSync] Note: Saved locally. Cloud sync pending for ${collectionName}/${docId}:`, e?.message || e);
      return false;
    }
  }

  /**
   * Delete document from Cloud Firestore
   */
  static async deleteDocument(collectionName: string, docId: string): Promise<boolean> {
    try {
      const db = FirebaseService.getFirestore();
      const fLib = getFirestoreLib();
      if (!db || !fLib) return false;

      const docRef = fLib.doc(db, collectionName, docId);
      await fLib.deleteDoc(docRef);
      return true;
    } catch (e: any) {
      console.log(`[FirestoreSync] Delete offline fallback for ${collectionName}/${docId}:`, e?.message || e);
      return false;
    }
  }

  /**
   * Fetch all records from a Cloud Firestore collection
   */
  static async fetchCollection<T>(collectionName: string): Promise<T[]> {
    try {
      const db = FirebaseService.getFirestore();
      const fLib = getFirestoreLib();
      if (!db || !fLib) return [];

      const colRef = fLib.collection(db, collectionName);
      const snapshot = await fLib.getDocs(colRef);
      const records: T[] = [];
      snapshot.forEach((docSnap: any) => {
        records.push({ id: docSnap.id, ...docSnap.data() } as T);
      });
      return records;
    } catch (e: any) {
      console.log(`[FirestoreSync] Fetch offline fallback for ${collectionName}:`, e?.message || e);
      return [];
    }
  }

  /**
   * Pull collection from cloud and merge into local AsyncStorage
   */
  static async pullCollectionAndMerge(collectionName: string): Promise<number> {
    try {
      const remote = await this.fetchCollection<any>(collectionName);
      if (!remote || remote.length === 0) return 0;

      switch (collectionName) {
        case FIRESTORE_COLLECTIONS.LEADS: {
          const local = await StorageService.getLeads();
          const localMap = new Map(local.map(l => [l.id, l]));
          remote.forEach(r => localMap.set(r.id, { ...localMap.get(r.id), ...r }));
          await StorageService.saveBulkLeads(Array.from(localMap.values()));
          return remote.length;
        }
        case FIRESTORE_COLLECTIONS.MOBILE_PRICES: {
          await StorageService.saveBulkPriceItems(remote);
          return remote.length;
        }
        default:
          return remote.length;
      }
    } catch (e) {
      console.warn(`[FirestoreSync] Pull merge error for ${collectionName}:`, e);
      return 0;
    }
  }

  /**
   * Complete Bi-Directional Cloud Synchronization
   * Pushes all local AsyncStorage records into Cloud Firestore collections
   */
  static async syncAllLocalToCloud(): Promise<SyncResult> {
    let syncedCount = 0;
    let expectedCount = 0;
    const details: Record<string, number> = {};

    try {
      if (!(await FirebaseService.init())) {
        return { success: false, syncedCount: 0, error: 'Firebase initialization failed' };
      }
      const db = FirebaseService.getFirestore();
      if (!db) {
        return { success: false, syncedCount: 0, error: 'Database service unavailable' };
      }

      // 1. Users
      const users = await StorageService.getAllUsers();
      expectedCount += users.length;
      let userCount = 0;
      for (const u of users) {
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.USERS, u.id, u);
        if (ok) {
          syncedCount++;
          userCount++;
        }
      }
      details[FIRESTORE_COLLECTIONS.USERS] = userCount;

      // 2. Attendance
      const attendance = await StorageService.getAttendanceRecords();
      expectedCount += attendance.length;
      let attCount = 0;
      for (const a of attendance) {
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.ATTENDANCE, a.id, a);
        if (ok) {
          syncedCount++;
          attCount++;
        }
      }
      details[FIRESTORE_COLLECTIONS.ATTENDANCE] = attCount;

      // 3. Customer Leads
      const leads = await StorageService.getLeads();
      expectedCount += leads.length;
      let leadCount = 0;
      for (const l of leads) {
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.LEADS, l.id, l);
        if (ok) {
          syncedCount++;
          leadCount++;
        }
      }
      details[FIRESTORE_COLLECTIONS.LEADS] = leadCount;

      // 4. Mobile Prices
      const prices = await StorageService.getPriceList();
      expectedCount += prices.length;
      let priceCount = 0;
      for (const p of prices) {
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.MOBILE_PRICES, p.id, p);
        if (ok) {
          syncedCount++;
          priceCount++;
        }
      }
      details[FIRESTORE_COLLECTIONS.MOBILE_PRICES] = priceCount;

      // 5. Second Hand Purchases
      const purchases = await StorageService.getPurchases();
      expectedCount += purchases.length;
      let purCount = 0;
      for (const pur of purchases) {
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, pur.id, pur);
        if (ok) {
          syncedCount++;
          purCount++;
        }
      }
      details[FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES] = purCount;

      // 6. Second Hand Sales
      const sales = await StorageService.getSales();
      expectedCount += sales.length;
      let saleCount = 0;
      for (const s of sales) {
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.SECOND_HAND_SALES, s.id, s);
        if (ok) {
          syncedCount++;
          saleCount++;
        }
      }
      details[FIRESTORE_COLLECTIONS.SECOND_HAND_SALES] = saleCount;

      // 7. Sales Targets
      const targets = await StorageService.getSalesTargets();
      expectedCount += targets.length;
      let targetCount = 0;
      for (const t of targets) {
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.SALES_TARGETS, t.id, t);
        if (ok) {
          syncedCount++;
          targetCount++;
        }
      }
      details[FIRESTORE_COLLECTIONS.SALES_TARGETS] = targetCount;

      // 8. Salary Slips
      const slips = await StorageService.getSalarySlips();
      expectedCount += slips.length;
      let slipCount = 0;
      for (const slip of slips) {
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.SALARY_SLIPS, slip.id, slip);
        if (ok) {
          syncedCount++;
          slipCount++;
        }
      }
      details[FIRESTORE_COLLECTIONS.SALARY_SLIPS] = slipCount;

      // 9. Notifications
      const notifs = await StorageService.getNotifications();
      expectedCount += notifs.length;
      let notifCount = 0;
      for (const n of notifs) {
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.NOTIFICATIONS, n.id, n);
        if (ok) {
          syncedCount++;
          notifCount++;
        }
      }
      details[FIRESTORE_COLLECTIONS.NOTIFICATIONS] = notifCount;

      // 10. Shop Config
      const config = await StorageService.getShopConfig();
      expectedCount += 1;
      const okConfig = await this.syncDocument(FIRESTORE_COLLECTIONS.SHOP_CONFIG, 'main_store', config);
      if (okConfig) {
        syncedCount++;
      }
      details[FIRESTORE_COLLECTIONS.SHOP_CONFIG] = okConfig ? 1 : 0;

      const allRecordsSynced = syncedCount === expectedCount;
      return {
        success: allRecordsSynced,
        syncedCount,
        details,
        error: allRecordsSynced ? undefined : 'Some records could not be uploaded. Check Firebase Authentication and Firestore security rules.',
      };
    } catch (e: any) {
      console.warn('Sync all error:', e);
      return { success: false, syncedCount, error: e?.message || 'Sync failed', details };
    }
  }

  /**
   * Upload an image/file to Firebase Storage if configured and online.
   */
  static async uploadFileToStorage(
    storagePath: string,
    localUri: string
  ): Promise<{ success: boolean; downloadUrl?: string; error?: string }> {
    try {
      if (!localUri || localUri.startsWith('http')) {
        return { success: false, error: 'Local file URI required' };
      }
      const storage = FirebaseService.getStorage();
      if (!storage) {
        return { success: false, error: 'Firebase Storage not initialized' };
      }
      let storageLib: any;
      try {
        storageLib = require('firebase/storage');
      } catch {
        return { success: false, error: 'firebase/storage module not available' };
      }
      const fileRef = storageLib.ref(storage, storagePath);
      const response = await fetch(localUri);
      const blob = await response.blob();
      const snapshot = await storageLib.uploadBytes(fileRef, blob);
      const downloadUrl = await storageLib.getDownloadURL(snapshot.ref);
      return { success: true, downloadUrl };
    } catch (err: any) {
      console.log(`[StorageUpload] Local file retained. Cloud upload result: ${err?.message || 'offline'}`);
      return { success: false, error: err?.message || 'Storage upload failed' };
    }
  }
}
