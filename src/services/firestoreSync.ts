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
  DEVICE_CHANGE_REQUESTS: 'device_change_requests',
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
      if (!db || !fLib) {
        console.warn(`[FirestoreSync] Firestore not ready – skipping write to ${collectionName}/${docId}`);
        return false;
      }

      // Remove undefined fields and local-only flags to prevent Firestore serialization errors
      const sanitized = JSON.parse(JSON.stringify(data));
      delete sanitized._syncPending;

      const docRef = fLib.doc(db, collectionName, docId);
      await fLib.setDoc(docRef, { ...sanitized, _syncedAt: new Date().toISOString() }, { merge: true });
      return true;
    } catch (e: any) {
      console.warn(`[FirestoreSync] Write error for ${collectionName}/${docId}:`, e?.message || e);
      throw e;
    }
  }

  /**
   * Extract ONLY the inventory-safe fields from a purchase record for the parent document.
   * This avoids Firestore rules rejection when `hasOnly(allowed)` is enforced.
   */
  static sanitizePurchaseForParent(pur: any): Record<string, any> {
    return {
      id: pur.id,
      brand: pur.brand,
      model: pur.model,
      ram: pur.ram || '',
      storage: pur.storage || '',
      imei: pur.imei,
      condition: pur.condition,
      purchaseAmount: pur.purchaseAmount,
      purchaseDate: pur.purchaseDate,
      purchaseTime: pur.purchaseTime,
      purchasedByStaffId: pur.purchasedByStaffId,
      purchasedByStaffName: pur.purchasedByStaffName,
      status: pur.status,
      notes: pur.notes || '',
      hasSensitiveKyc: true,
      _syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Extract ONLY the sale-safe fields from a sale record for the parent document.
   */
  static sanitizeSaleForParent(sale: any): Record<string, any> {
    return {
      id: sale.id,
      purchaseRecordId: sale.purchaseRecordId || '',
      buyerName: sale.buyerName,
      phone: sale.phone,
      address: sale.address,
      brand: sale.brand,
      model: sale.model,
      ram: sale.ram || '',
      storage: sale.storage || '',
      imei: sale.imei,
      sellingAmount: sale.sellingAmount,
      purchaseAmount: sale.purchaseAmount,
      profitAmount: sale.profitAmount,
      marginPercent: sale.marginPercent,
      invoiceNumber: sale.invoiceNumber,
      digitalSignatureUri: sale.digitalSignatureUri,
      saleDate: sale.saleDate,
      saleTime: sale.saleTime,
      soldByStaffId: sale.soldByStaffId,
      soldByStaffName: sale.soldByStaffName,
      paymentMethod: sale.paymentMethod,
      warrantyMonths: sale.warrantyMonths || 0,
      notes: sale.notes || '',
      hasSensitiveKyc: !!(sale.aadhaarNumber || sale.buyerPhotoUri || sale.aadhaarPhotoUri),
      _syncedAt: new Date().toISOString(),
    };
  }

  /**
   * Verify document exists in Cloud Firestore
   */
  static async verifyDocumentExists(collectionName: string, docId: string): Promise<boolean> {
    try {
      const db = FirebaseService.getFirestore();
      const fLib = getFirestoreLib();
      if (!db || !fLib) return false;

      const docRef = fLib.doc(db, collectionName, docId);
      const snap = await fLib.getDoc(docRef);
      return snap.exists();
    } catch {
      return false;
    }
  }

  /**
   * Real-time listener for customer leads
   */
  static subscribeToLeads(
    user: any,
    onUpdate: (leads: any[]) => void,
    onError?: (error: any) => void
  ): (() => void) {
    try {
      const db = FirebaseService.getFirestore();
      const fLib = getFirestoreLib();
      if (!db || !fLib) return () => {};

      const colRef = fLib.collection(db, FIRESTORE_COLLECTIONS.LEADS);
      const isStaff = user && user.role !== 'admin';
      const q = isStaff && user?.id
        ? (fLib.query ? fLib.query(colRef, fLib.where('createdBy', '==', user.id)) : colRef)
        : colRef;

      if (!fLib.onSnapshot) return () => {};

      const unsubscribe = fLib.onSnapshot(
        q,
        (snapshot: any) => {
          const records: any[] = [];
          snapshot.forEach((docSnap: any) => {
            records.push({ ...docSnap.data(), id: docSnap.id });
          });
          onUpdate(records);
        },
        (error: any) => {
          console.warn('[FirestoreSync] Leads real-time subscription error:', error);
          onError?.(error);
        }
      );

      return unsubscribe;
    } catch (e) {
      console.warn('[FirestoreSync] Failed to initialize leads subscription:', e);
      return () => {};
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
        // The Firestore document path is the canonical record ID.
        records.push({ ...docSnap.data(), id: docSnap.id } as T);
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
      await StorageService.mergeCloudCollection(collectionName, remote);
      return remote.length;
    } catch (e) {
      console.warn(`[FirestoreSync] Pull merge error for ${collectionName}:`, e);
      return 0;
    }
  }

  /**
   * Fetch scoped collection with a where query
   */
  static async fetchCollectionWithQuery<T>(collectionName: string, field: string, op: any, value: any): Promise<T[]> {
    try {
      const db = FirebaseService.getFirestore();
      const fLib = getFirestoreLib();
      if (!db || !fLib) return [];

      const colRef = fLib.collection(db, collectionName);
      const q = fLib.query ? fLib.query(colRef, fLib.where(field, op, value)) : colRef;
      const snapshot = await fLib.getDocs(q);
      const records: T[] = [];
      snapshot.forEach((docSnap: any) => {
        records.push({ ...docSnap.data(), id: docSnap.id } as T);
      });
      return records;
    } catch (e: any) {
      console.log(`[FirestoreSync] Scoped query fallback for ${collectionName}:`, e?.message || e);
      return [];
    }
  }

  /** Pull cloud records into the local cache after Firebase authentication, scoped by role. */
  static async pullAllCloudToLocal(currentUser?: any): Promise<Record<string, number>> {
    const isStaff = currentUser && currentUser.role !== 'admin';
    const collectionsToPull: string[] = [
      FIRESTORE_COLLECTIONS.SHOP_CONFIG,
      FIRESTORE_COLLECTIONS.MOBILE_PRICES,
      FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES,
      FIRESTORE_COLLECTIONS.SECOND_HAND_SALES,
    ];

    if (!isStaff) {
      // Admin pulls all collections
      collectionsToPull.push(
        FIRESTORE_COLLECTIONS.NOTIFICATIONS,
        FIRESTORE_COLLECTIONS.USERS,
        FIRESTORE_COLLECTIONS.ATTENDANCE,
        FIRESTORE_COLLECTIONS.LEADS,
        FIRESTORE_COLLECTIONS.SALES_TARGETS,
        FIRESTORE_COLLECTIONS.SALARY_SLIPS
      );
      const results = await Promise.all(collectionsToPull.map(async name => [name, await this.pullCollectionAndMerge(name)] as const));
      return Object.fromEntries(results);
    }

    // Scoped pull for staff: only pull own attendance, own leads, own salary slips, and authorized notifications
    const results: [string, number][] = await Promise.all(
      collectionsToPull.map(async name => [name, await this.pullCollectionAndMerge(name)] as const)
    );

    if (currentUser?.id) {
      // Pull own notifications & broadcast announcements & targeted staff announcements
      const ownNotifs = await this.fetchCollectionWithQuery<any>(FIRESTORE_COLLECTIONS.NOTIFICATIONS, 'userId', '==', currentUser.id);
      const broadcastNotifs = await this.fetchCollectionWithQuery<any>(FIRESTORE_COLLECTIONS.NOTIFICATIONS, 'userId', '==', 'all');
      const targetedNotifs = await this.fetchCollectionWithQuery<any>(FIRESTORE_COLLECTIONS.NOTIFICATIONS, 'targetStaffIds', 'array-contains', currentUser.id).catch(() => []);
      const combinedNotifs = [...ownNotifs];
      [...broadcastNotifs, ...targetedNotifs].forEach(n => {
        // Staff should only receive published or scheduled announcements (not drafts or archived)
        if (n.status === 'draft' || n.status === 'archived') return;
        if (!combinedNotifs.some(c => c.id === n.id)) combinedNotifs.push(n);
      });
      if (combinedNotifs.length) await StorageService.mergeCloudCollection(FIRESTORE_COLLECTIONS.NOTIFICATIONS, combinedNotifs);
      results.push([FIRESTORE_COLLECTIONS.NOTIFICATIONS, combinedNotifs.length]);

      // Pull own attendance
      const ownAtt = await this.fetchCollectionWithQuery<any>(FIRESTORE_COLLECTIONS.ATTENDANCE, 'userId', '==', currentUser.id);
      if (ownAtt.length) await StorageService.mergeCloudCollection(FIRESTORE_COLLECTIONS.ATTENDANCE, ownAtt);
      results.push([FIRESTORE_COLLECTIONS.ATTENDANCE, ownAtt.length]);

      // Pull own leads (createdBy or assignedTo)
      const ownCreatedLeads = await this.fetchCollectionWithQuery<any>(FIRESTORE_COLLECTIONS.LEADS, 'createdBy', '==', currentUser.id);
      const ownAssignedLeads = await this.fetchCollectionWithQuery<any>(FIRESTORE_COLLECTIONS.LEADS, 'assignedTo', '==', currentUser.id);
      const combinedLeads = [...ownCreatedLeads];
      ownAssignedLeads.forEach(l => {
        if (!combinedLeads.some(c => c.id === l.id)) combinedLeads.push(l);
      });
      if (combinedLeads.length) await StorageService.mergeCloudCollection(FIRESTORE_COLLECTIONS.LEADS, combinedLeads);
      results.push([FIRESTORE_COLLECTIONS.LEADS, combinedLeads.length]);

      // Pull own salary slips
      const ownSalaries = await this.fetchCollectionWithQuery<any>(FIRESTORE_COLLECTIONS.SALARY_SLIPS, 'userId', '==', currentUser.id);
      if (ownSalaries.length) await StorageService.mergeCloudCollection(FIRESTORE_COLLECTIONS.SALARY_SLIPS, ownSalaries);
      results.push([FIRESTORE_COLLECTIONS.SALARY_SLIPS, ownSalaries.length]);
    }

    return Object.fromEntries(results);
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

      // 5. Second Hand Purchases – sync ONLY inventory-safe parent fields
      const purchases = await StorageService.getPurchases();
      expectedCount += purchases.length;
      let purCount = 0;
      for (const pur of purchases) {
        const parentDoc = this.sanitizePurchaseForParent(pur);
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, pur.id, parentDoc);
        if (ok) {
          syncedCount++;
          purCount++;
        }
      }
      details[FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES] = purCount;

      // 6. Second Hand Sales – sync ONLY sale-safe parent fields
      const sales = await StorageService.getSales();
      expectedCount += sales.length;
      let saleCount = 0;
      for (const s of sales) {
        const parentDoc = this.sanitizeSaleForParent(s);
        const ok = await this.syncDocument(FIRESTORE_COLLECTIONS.SECOND_HAND_SALES, s.id, parentDoc);
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
