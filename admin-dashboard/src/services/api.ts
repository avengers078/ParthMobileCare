import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  limit,
  where,
  Timestamp,
  writeBatch,
  deleteField,
  onSnapshot,
} from 'firebase/firestore';
import { db, auth, FIRESTORE_COLLECTIONS } from './firebase';
import {
  User,
  AttendanceRecord,
  CustomerLead,
  MobilePriceItem,
  SecondHandPurchase,
  SecondHandKycRecord,
  SecondHandSale,
  SecondHandSaleKycRecord,
  SalesTarget,
  SalarySlip,
  AppNotification,
  ShopConfig,
  StaffInvitation,
  AdminAuditEntry,
  DeviceChangeRequest,
} from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();
const inFlightRequests = new Map<string, Promise<any>>();

function cleanPayload<T extends Record<string, any>>(obj: T): T {
  const result: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }
  return result;
}

export class ApiService {
  // --- High-Performance Memory Cache & Deduplication (Spark-Tier Optimized) ---
  static getFromCache<T>(key: string): T | null {
    const entry = memoryCache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      memoryCache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  static setCache<T>(key: string, data: T, ttlMs = 30000): void {
    memoryCache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  }

  static invalidateCache(keyPrefix?: string): void {
    if (!keyPrefix) {
      memoryCache.clear();
      return;
    }
    for (const key of Array.from(memoryCache.keys())) {
      if (key.startsWith(keyPrefix)) {
        memoryCache.delete(key);
      }
    }
  }

  static async cachedFetch<T>(
    key: string,
    ttlMs: number,
    forceRefresh: boolean,
    fetcher: () => Promise<T>
  ): Promise<T> {
    if (!forceRefresh) {
      const cached = this.getFromCache<T>(key);
      if (cached !== null) {
        return cached;
      }
    }

    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key) as Promise<T>;
    }

    const promise = fetcher()
      .then(result => {
        this.setCache(key, result, ttlMs);
        inFlightRequests.delete(key);
        return result;
      })
      .catch(err => {
        inFlightRequests.delete(key);
        throw err;
      });

    inFlightRequests.set(key, promise);
    return promise;
  }

  // --- Secure Spark-Compatible Invitation Workflow ---
  static async createStaffInvitation(
    data: {
      name: string;
      email: string;
      phone: string;
      role?: 'staff';
      designation?: string;
      basicSalary?: number;
      monthlyTarget?: number;
    },
    adminUser: { id: string; name: string }
  ): Promise<StaffInvitation> {
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomHex2 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const token = `PMC-INV-${randomHex}-${randomHex2}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7-day validity

    const invitation: StaffInvitation = {
      id: token,
      token,
      name: data.name.trim(),
      email: data.email.trim().toLowerCase(),
      phone: data.phone.trim(),
      role: 'staff',
      designation: data.designation?.trim() || 'Sales Executive',
      basicSalary: Number(data.basicSalary) || 20000,
      monthlyTarget: Number(data.monthlyTarget) || 200000,
      createdBy: adminUser.id,
      createdByName: adminUser.name,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
    };

    await setDoc(doc(db, 'staff_invitations', token), invitation);

    await this.logAdminAction({
      adminId: adminUser.id,
      adminName: adminUser.name,
      actionType: 'staff_invitation_created',
      targetRecordId: token,
      targetRecordTitle: invitation.name,
      details: `Generated invitation token for ${invitation.email} (${invitation.designation})`,
    });

    return invitation;
  }

  static async getStaffInvitations(forceRefresh = false): Promise<StaffInvitation[]> {
    return this.cachedFetch('invitations', 20000, forceRefresh, async () => {
      try {
        const snap = await getDocs(query(collection(db, 'staff_invitations'), orderBy('createdAt', 'desc')));
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as StaffInvitation));
      } catch (e) {
        console.warn('Could not fetch invitations:', e);
        return [];
      }
    });
  }

  static async revokeStaffInvitation(tokenId: string, adminUser: { id: string; name: string }): Promise<void> {
    await updateDoc(doc(db, 'staff_invitations', tokenId), {
      status: 'revoked',
      revokedAt: new Date().toISOString(),
      revokedBy: adminUser.name,
    });

    await this.logAdminAction({
      adminId: adminUser.id,
      adminName: adminUser.name,
      actionType: 'staff_invitation_revoked',
      targetRecordId: tokenId,
      details: `Revoked pending staff invitation token ${tokenId}`,
    });
  }

  static async setStaffAccountStatus(
    uid: string,
    isActive: boolean,
    adminUser?: { id: string; name: string }
  ): Promise<{ success: boolean; uid: string; isActive: boolean; message: string }> {
    const adminId = auth.currentUser?.uid || adminUser?.id;
    const adminName = adminUser?.name || auth.currentUser?.displayName || 'Administrator';

    await updateDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, uid), {
      isActive,
      _syncedAt: new Date().toISOString(),
    });

    if (adminId) {
      await this.logAdminAction({
        adminId,
        adminName,
        actionType: isActive ? 'staff_activated' : 'staff_deactivated',
        targetRecordId: uid,
        details: `Account status set to ${isActive ? 'ACTIVE' : 'INACTIVE'}`,
      });
    }

    this.invalidateCache('users');

    return {
      success: true,
      uid,
      isActive,
      message: `Staff account ${isActive ? 'activated' : 'deactivated'} successfully.`,
    };
  }

  // --- Users & Staff Directory ---
  static async getUsers(forceRefresh = false): Promise<User[]> {
    return this.cachedFetch('users', 30000, forceRefresh, async () => {
      const snap = await getDocs(collection(db, FIRESTORE_COLLECTIONS.USERS));
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as User));
    });
  }

  static async saveUser(user: User, adminUser?: { id: string; name: string }): Promise<void> {
    const { updatedAt, ...userData } = user as any;
    const adminId = auth.currentUser?.uid || adminUser?.id;
    const adminName = adminUser?.name || auth.currentUser?.displayName || 'Administrator';

    const payload = cleanPayload({
      ...userData,
      _syncedAt: new Date().toISOString(),
    });

    await setDoc(doc(db, FIRESTORE_COLLECTIONS.USERS, user.id), payload, { merge: true });

    this.invalidateCache('users');

    if (adminId) {
      await this.logAdminAction({
        adminId,
        adminName,
        actionType: 'staff_profile_updated',
        targetRecordId: user.id,
        targetRecordTitle: user.name,
        details: `Updated staff profile: ${user.designation}, Salary: ₹${user.basicSalary}, Target: ₹${user.monthlyTarget}`,
      });
    }
  }

  /**
   * Real-time listener for users / staff directory.
   */
  static subscribeToUsers(
    onUpdate: (users: User[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const colRef = collection(db, FIRESTORE_COLLECTIONS.USERS);
    return onSnapshot(colRef, (snap) => {
      this.invalidateCache('users');
      const users = snap.docs.map(d => ({ ...d.data(), id: d.id } as User));
      onUpdate(users);
    }, (err) => {
      console.warn('[AdminApi] Users snapshot error:', err);
      onError?.(err);
    });
  }

  /**
   * Real-time listener for staff invitations.
   */
  static subscribeToStaffInvitations(
    onUpdate: (invitations: StaffInvitation[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const colRef = collection(db, 'staff_invitations');
    return onSnapshot(colRef, (snap) => {
      this.invalidateCache('staff_invitations');
      const invitations = snap.docs.map(d => ({ ...d.data(), id: d.id } as StaffInvitation));
      onUpdate(invitations);
    }, (err) => {
      console.warn('[AdminApi] Staff invitations snapshot error:', err);
      onError?.(err);
    });
  }

  /**
   * Real-time listener for device change requests.
   */
  static subscribeToDeviceChangeRequests(
    onUpdate: (requests: DeviceChangeRequest[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const colRef = collection(db, FIRESTORE_COLLECTIONS.DEVICE_CHANGE_REQUESTS);
    return onSnapshot(colRef, (snap) => {
      this.invalidateCache('deviceChangeRequests');
      const requests = snap.docs.map(d => ({ ...d.data(), id: d.id } as DeviceChangeRequest));
      onUpdate(requests);
    }, (err) => {
      console.warn('[AdminApi] Device change requests snapshot error:', err);
      onError?.(err);
    });
  }

  // --- Attendance ---
  static async getAttendanceRecords(limitCount = 300, forceRefresh = false): Promise<AttendanceRecord[]> {
    return this.cachedFetch(`attendance_${limitCount}`, 20000, forceRefresh, async () => {
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.ATTENDANCE),
        orderBy('date', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord));
    });
  }

  /**
   * Real-time listener for attendance records.
   */
  static subscribeToAttendanceRecords(
    limitCount = 300,
    onUpdate: (records: AttendanceRecord[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const q = query(
      collection(db, FIRESTORE_COLLECTIONS.ATTENDANCE),
      orderBy('date', 'desc'),
      limit(limitCount)
    );
    return onSnapshot(q, (snap) => {
      this.invalidateCache('attendance');
      const records = snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord));
      onUpdate(records);
    }, (err) => {
      console.warn('[AdminApi] Attendance snapshot error:', err);
      onError?.(err);
    });
  }

  static async correctAttendanceRecord(
    recordId: string,
    updates: Partial<AttendanceRecord>,
    adminName: string,
    reason: string,
    adminId = 'admin'
  ): Promise<void> {
    const recordRef = doc(db, FIRESTORE_COLLECTIONS.ATTENDANCE, recordId);
    await updateDoc(recordRef, {
      ...updates,
      verificationMethod: 'manual_override',
      auditCorrection: {
        correctedBy: adminName,
        correctedAt: new Date().toISOString(),
        reason,
      },
    });

    this.invalidateCache('attendance');

    await this.logAdminAction({
      adminId,
      adminName,
      actionType: 'attendance_correction',
      targetRecordId: recordId,
      details: `Corrected attendance status to ${updates.status || 'present'}. Reason: ${reason}`,
    });
  }

  // --- Leads ---
  static async getLeads(forceRefresh = false): Promise<CustomerLead[]> {
    return this.cachedFetch('leads', 30000, forceRefresh, async () => {
      const q = query(collection(db, FIRESTORE_COLLECTIONS.LEADS), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as CustomerLead));
    });
  }

  /**
   * Real-time listener for customer leads.
   */
  static subscribeToLeads(
    onUpdate: (leads: CustomerLead[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const q = query(collection(db, FIRESTORE_COLLECTIONS.LEADS), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      this.invalidateCache('leads');
      const leads = snap.docs.map(d => ({ ...d.data(), id: d.id } as CustomerLead));
      onUpdate(leads);
    }, (err) => {
      console.warn('[AdminApi] Leads snapshot error:', err);
      onError?.(err);
    });
  }

  static async saveLead(lead: CustomerLead, adminUser?: { id: string; name: string }): Promise<void> {
    const payload = cleanPayload({
      ...lead,
      _syncedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.LEADS, lead.id), payload, { merge: true });
    this.invalidateCache('leads');

    if (adminUser) {
      await this.logAdminAction({
        adminId: adminUser.id,
        adminName: adminUser.name,
        actionType: 'lead_updated',
        targetRecordId: lead.id,
        targetRecordTitle: lead.name,
        details: `Lead ${lead.name} (${lead.interestedBrand} ${lead.interestedModel}) status: ${lead.status}, assigned: ${lead.assignedToName || 'Unassigned'}`,
      });
    }
  }

  static async deleteLead(leadId: string, adminUser?: { id: string; name: string }): Promise<void> {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.LEADS, leadId));
    this.invalidateCache('leads');

    if (adminUser) {
      await this.logAdminAction({
        adminId: adminUser.id,
        adminName: adminUser.name,
        actionType: 'lead_deleted',
        targetRecordId: leadId,
        details: `Deleted lead document ID: ${leadId}`,
      });
    }
  }

  // --- Mobile Prices ---
  static async getMobilePrices(forceRefresh = false): Promise<MobilePriceItem[]> {
    return this.cachedFetch('prices', 60000, forceRefresh, async () => {
      const snap = await getDocs(collection(db, FIRESTORE_COLLECTIONS.MOBILE_PRICES));
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as MobilePriceItem));
    });
  }

  /**
   * Real-time listener for mobile prices catalog.
   */
  static subscribeToMobilePrices(
    onUpdate: (prices: MobilePriceItem[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const colRef = collection(db, FIRESTORE_COLLECTIONS.MOBILE_PRICES);
    return onSnapshot(colRef, (snap) => {
      this.invalidateCache('prices');
      const prices = snap.docs.map(d => ({ ...d.data(), id: d.id } as MobilePriceItem));
      onUpdate(prices);
    }, (err) => {
      console.warn('[AdminApi] Mobile prices snapshot error:', err);
      onError?.(err);
    });
  }

  static async saveMobilePrice(item: MobilePriceItem, adminUser?: { id: string; name: string }): Promise<void> {
    const payload = cleanPayload({
      ...item,
      _syncedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.MOBILE_PRICES, item.id), payload, { merge: true });
    this.invalidateCache('prices');

    if (adminUser) {
      await this.logAdminAction({
        adminId: adminUser.id,
        adminName: adminUser.name,
        actionType: 'price_item_saved',
        targetRecordId: item.id,
        targetRecordTitle: `${item.brand} ${item.model}`,
        details: `Set selling price: ₹${item.sellingPrice}, purchase price: ₹${item.purchasePrice}`,
      });
    }
  }

  static async saveBulkMobilePrices(items: MobilePriceItem[], adminUser?: { id: string; name: string }): Promise<number> {
    let count = 0;
    for (const item of items) {
      const payload = cleanPayload({
        ...item,
        _syncedAt: new Date().toISOString(),
      });
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.MOBILE_PRICES, item.id), payload, { merge: true });
      count++;
    }
    this.invalidateCache('prices');

    if (adminUser) {
      await this.logAdminAction({
        adminId: adminUser.id,
        adminName: adminUser.name,
        actionType: 'price_catalog_bulk_imported',
        targetRecordId: 'catalog_bulk',
        details: `Imported ${count} price list entries via Excel/CSV`,
      });
    }
    return count;
  }

  static async deleteMobilePrice(itemId: string, adminUser?: { id: string; name: string }): Promise<void> {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.MOBILE_PRICES, itemId));
    this.invalidateCache('prices');

    if (adminUser) {
      await this.logAdminAction({
        adminId: adminUser.id,
        adminName: adminUser.name,
        actionType: 'price_item_deleted',
        targetRecordId: itemId,
        details: `Deleted catalog price entry ID: ${itemId}`,
      });
    }
  }

  // --- Second Hand Purchases ---
  static async getSecondHandPurchases(forceRefresh = false): Promise<SecondHandPurchase[]> {
    return this.cachedFetch('purchases', 30000, forceRefresh, async () => {
      const q = query(collection(db, FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES), orderBy('purchaseDate', 'desc'));
      const snap = await getDocs(q);
      const purchases = await Promise.all(
        snap.docs.map(async d => {
          const data = d.data();
          let customerName = data.customerName || (data as any).sellerName || (data as any).customer || '';
          let phone = data.phone || (data as any).sellerPhone || (data as any).contact || '';
          let deviceInspectionPhotos: string[] = data.deviceInspectionPhotos || data.devicePhotos || [];
          let billImageUri: string = data.billImageUri || '';

          // If customer name, bill or inspection photos are stored in KYC subcollection, resolve them
          if (!customerName || !billImageUri || deviceInspectionPhotos.length === 0) {
            try {
              const kycSnap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, d.id, 'kyc_sensitive', 'record'));
              if (kycSnap.exists()) {
                const kycData = kycSnap.data();
                if (!customerName) customerName = kycData.customerName || kycData.sellerName || '';
                if (!phone) phone = kycData.phone || '';
                if (!billImageUri) billImageUri = kycData.billImageUri || '';
                if (deviceInspectionPhotos.length === 0 && kycData.customerPhotoUri) {
                  try {
                    if (kycData.customerPhotoUri.startsWith('[')) {
                      deviceInspectionPhotos = JSON.parse(kycData.customerPhotoUri);
                    } else if (kycData.customerPhotoUri.startsWith('http')) {
                      deviceInspectionPhotos = [kycData.customerPhotoUri];
                    }
                  } catch {
                    // Ignore JSON parse error
                  }
                }
              }
            } catch {
              // Ignore subcollection read error
            }
          }

          return {
            ...data,
            id: d.id,
            customerName: customerName || (data.hasSensitiveKyc ? 'Verified Seller (KYC)' : 'Name unavailable'),
            phone: phone || '—',
            deviceInspectionPhotos,
            devicePhotos: deviceInspectionPhotos,
            billImageUri,
          } as SecondHandPurchase;
        })
      );
      return purchases;
    });
  }

  static async getSecondHandPurchaseKyc(purchaseId: string): Promise<SecondHandKycRecord | null> {
    try {
      const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, purchaseId, 'kyc_sensitive', 'record'));
      if (snap.exists()) {
        return snap.data() as SecondHandKycRecord;
      }
      return null;
    } catch (e) {
      console.warn('[AdminApi] Failed to fetch KYC record:', e);
      return null;
    }
  }

  static async updatePurchaseInspectionPhotos(purchaseId: string, photos: string[]): Promise<void> {
    const docRef = doc(db, FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, purchaseId);
    await setDoc(docRef, {
      devicePhotos: photos,
      deviceInspectionPhotos: photos,
      _syncedAt: new Date().toISOString(),
    }, { merge: true });
    this.invalidateCache('purchases');
  }

  static async updateLeadInquiryPhotos(leadId: string, photos: string[]): Promise<void> {
    const docRef = doc(db, FIRESTORE_COLLECTIONS.LEADS, leadId);
    await setDoc(docRef, {
      inquiryPhotos: photos,
      repairPhotos: photos,
      updatedAt: new Date().toISOString(),
      _syncedAt: new Date().toISOString(),
    }, { merge: true });
    this.invalidateCache('leads');
  }

  static async updateUserAvatar(userId: string, avatarUrl: string): Promise<void> {
    const docRef = doc(db, FIRESTORE_COLLECTIONS.USERS, userId);
    await setDoc(docRef, {
      avatarUrl,
      _syncedAt: new Date().toISOString(),
    }, { merge: true });
    this.invalidateCache('users');
  }

  static async saveSecondHandPurchase(purchase: SecondHandPurchase, adminUser?: { id: string; name: string }): Promise<void> {
    const {
      customerName,
      phone,
      alternatePhone,
      aadhaarNumber,
      rawAadhaarNumber,
      address,
      customerPhotoUri,
      aadhaarFrontUri,
      aadhaarBackUri,
      aadhaarFrontPublicId,
      aadhaarBackPublicId,
      billImageUri,
      digitalSignatureUri,
      ...inventoryData
    } = purchase;

    const parentPayload = cleanPayload({
      ...inventoryData,
      hasSensitiveKyc: true,
      _syncedAt: new Date().toISOString(),
    });

    await setDoc(doc(db, FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, purchase.id), parentPayload, { merge: true });

    // Store sensitive KYC in isolated Admin-only subcollection
    if (customerName || aadhaarNumber || customerPhotoUri) {
      const kycDocRef = doc(db, FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, purchase.id, 'kyc_sensitive', 'record');
      const kycPayload: SecondHandKycRecord = cleanPayload({
        id: 'record',
        purchaseId: purchase.id,
        customerName: customerName || 'Verified Customer',
        phone: phone || '',
        alternatePhone: alternatePhone || '',
        aadhaarNumber: rawAadhaarNumber || aadhaarNumber || '',
        rawAadhaarNumber: rawAadhaarNumber || aadhaarNumber || '',
        address: address || '',
        customerPhotoUri: customerPhotoUri || '',
        aadhaarFrontUri: aadhaarFrontUri || '',
        aadhaarBackUri: aadhaarBackUri || '',
        aadhaarFrontPublicId: aadhaarFrontPublicId || '',
        aadhaarBackPublicId: aadhaarBackPublicId || '',
        billImageUri: billImageUri || '',
        digitalSignatureUri: digitalSignatureUri || '',
        createdAt: new Date().toISOString(),
        _syncedAt: new Date().toISOString(),
        recordedByStaffId: purchase.purchasedByStaffId || adminUser?.id || 'admin',
        recordedByStaffName: purchase.purchasedByStaffName || adminUser?.name || 'Admin',
      });
      await setDoc(kycDocRef, kycPayload, { merge: true });
    }

    this.invalidateCache('purchases');

    if (adminUser) {
      await this.logAdminAction({
        adminId: adminUser.id,
        adminName: adminUser.name,
        actionType: 'second_hand_purchase_saved',
        targetRecordId: purchase.id,
        targetRecordTitle: `${purchase.brand} ${purchase.model} (IMEI: ${purchase.imei})`,
        details: `Customer: ${customerName || 'Verified'}, Purchase Amount: ₹${purchase.purchaseAmount}`,
      });
    }
  }

  // --- Second Hand Sales ---
  static async getSecondHandSales(forceRefresh = false): Promise<SecondHandSale[]> {
    return this.cachedFetch('sales', 30000, forceRefresh, async () => {
      const q = query(collection(db, FIRESTORE_COLLECTIONS.SECOND_HAND_SALES), orderBy('saleDate', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as SecondHandSale));
    });
  }

  static async getSecondHandSaleKyc(saleId: string): Promise<SecondHandSaleKycRecord | null> {
    try {
      const snap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.SECOND_HAND_SALES, saleId, 'kyc_sensitive', 'record'));
      if (snap.exists()) {
        return snap.data() as SecondHandSaleKycRecord;
      }
      return null;
    } catch (e) {
      console.warn('[AdminApi] Failed to fetch Sale KYC record:', e);
      return null;
    }
  }

  /**
   * Real-time listener for second-hand purchases.
   * Returns an unsubscribe function to detach the listener.
   */
  static subscribeToSecondHandPurchases(
    onUpdate: (purchases: SecondHandPurchase[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const q = query(collection(db, FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES), orderBy('purchaseDate', 'desc'));
    return onSnapshot(q, async (snap) => {
      try {
        const purchases = await Promise.all(
          snap.docs.map(async d => {
            const data = d.data();
            let customerName = data.customerName || (data as any).sellerName || (data as any).customer || '';
            let phone = data.phone || (data as any).sellerPhone || (data as any).contact || '';
            let deviceInspectionPhotos: string[] = data.deviceInspectionPhotos || data.devicePhotos || [];
            let billImageUri: string = data.billImageUri || '';

            if (!customerName || !billImageUri || deviceInspectionPhotos.length === 0) {
              try {
                const kycSnap = await getDoc(doc(db, FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, d.id, 'kyc_sensitive', 'record'));
                if (kycSnap.exists()) {
                  const kycData = kycSnap.data();
                  if (!customerName) customerName = kycData.customerName || kycData.sellerName || '';
                  if (!phone) phone = kycData.phone || '';
                  if (!billImageUri) billImageUri = kycData.billImageUri || '';
                  if (deviceInspectionPhotos.length === 0 && kycData.customerPhotoUri) {
                    try {
                      if (kycData.customerPhotoUri.startsWith('[')) {
                        deviceInspectionPhotos = JSON.parse(kycData.customerPhotoUri);
                      } else if (kycData.customerPhotoUri.startsWith('http')) {
                        deviceInspectionPhotos = [kycData.customerPhotoUri];
                      }
                    } catch { /* ignore */ }
                  }
                }
              } catch { /* ignore subcollection read error */ }
            }

            return {
              ...data,
              id: d.id,
              customerName: customerName || (data.hasSensitiveKyc ? 'Verified Seller (KYC)' : 'Name unavailable'),
              phone: phone || '—',
              deviceInspectionPhotos,
              devicePhotos: deviceInspectionPhotos,
              billImageUri,
            } as SecondHandPurchase;
          })
        );
        this.invalidateCache('purchases');
        onUpdate(purchases);
      } catch (err) {
        console.warn('[AdminApi] Error processing purchase snapshot:', err);
        onError?.(err);
      }
    }, (err) => {
      console.warn('[AdminApi] Purchase snapshot listener error:', err);
      onError?.(err);
    });
  }

  /**
   * Real-time listener for second-hand sales.
   * Returns an unsubscribe function to detach the listener.
   */
  static subscribeToSecondHandSales(
    onUpdate: (sales: SecondHandSale[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const q = query(collection(db, FIRESTORE_COLLECTIONS.SECOND_HAND_SALES), orderBy('saleDate', 'desc'));
    return onSnapshot(q, (snap) => {
      try {
        const sales = snap.docs.map(d => ({ ...d.data(), id: d.id } as SecondHandSale));
        this.invalidateCache('sales');
        onUpdate(sales);
      } catch (err) {
        console.warn('[AdminApi] Error processing sale snapshot:', err);
        onError?.(err);
      }
    }, (err) => {
      console.warn('[AdminApi] Sale snapshot listener error:', err);
      onError?.(err);
    });
  }

  static async saveSecondHandSale(sale: SecondHandSale, adminUser?: { id: string; name: string }): Promise<void> {
    const {
      aadhaarNumber,
      rawAadhaarNumber,
      aadhaarPhotoUri,
      aadhaarPhotoPublicId,
      buyerPhotoUri,
      alternatePhone,
      ...saleInventory
    } = sale;

    const parentPayload = cleanPayload({
      ...saleInventory,
      hasSensitiveKyc: !!aadhaarNumber,
      _syncedAt: new Date().toISOString(),
    });

    const batch = writeBatch(db);
    const saleRef = doc(db, FIRESTORE_COLLECTIONS.SECOND_HAND_SALES, sale.id);
    batch.set(saleRef, parentPayload, { merge: true });

    if (sale.purchaseRecordId) {
      const purchaseRef = doc(db, FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, sale.purchaseRecordId);
      batch.update(purchaseRef, {
        status: 'sold',
        _syncedAt: new Date().toISOString(),
      });
    }

    await batch.commit();

    if (aadhaarNumber || buyerPhotoUri || aadhaarPhotoUri) {
      const kycDocRef = doc(db, FIRESTORE_COLLECTIONS.SECOND_HAND_SALES, sale.id, 'kyc_sensitive', 'record');
      const kycPayload: SecondHandSaleKycRecord = cleanPayload({
        id: 'record',
        saleId: sale.id,
        buyerName: sale.buyerName,
        phone: sale.phone,
        alternatePhone: alternatePhone || '',
        address: sale.address,
        aadhaarNumber: rawAadhaarNumber || aadhaarNumber || '',
        rawAadhaarNumber: rawAadhaarNumber || aadhaarNumber || '',
        aadhaarPhotoUri: aadhaarPhotoUri || '',
        aadhaarPhotoPublicId: aadhaarPhotoPublicId || '',
        buyerPhotoUri: buyerPhotoUri || '',
        digitalSignatureUri: sale.digitalSignatureUri || '',
        createdAt: new Date().toISOString(),
        recordedAt: new Date().toISOString(),
        _syncedAt: new Date().toISOString(),
        recordedByStaffId: sale.soldByStaffId || adminUser?.id || 'admin',
        recordedByStaffName: sale.soldByStaffName || adminUser?.name || 'Admin',
      });
      await setDoc(kycDocRef, kycPayload, { merge: true });
    }

    this.invalidateCache('sales');
    this.invalidateCache('purchases');

    if (adminUser) {
      await this.logAdminAction({
        adminId: adminUser.id,
        adminName: adminUser.name,
        actionType: 'second_hand_sale_saved',
        targetRecordId: sale.id,
        targetRecordTitle: `Invoice #${sale.invoiceNumber} - ${sale.brand} ${sale.model}`,
        details: `Buyer: ${sale.buyerName}, Amount: ₹${sale.sellingAmount}, Margin: ₹${sale.profitAmount}`,
      });
    }
  }

  // --- Sales Targets ---
  static async getSalesTargets(monthKey?: string, forceRefresh = false): Promise<SalesTarget[]> {
    const cacheKey = `targets_${monthKey || 'all'}`;
    return this.cachedFetch(cacheKey, 30000, forceRefresh, async () => {
      let q = query(collection(db, FIRESTORE_COLLECTIONS.SALES_TARGETS));
      if (monthKey) {
        q = query(collection(db, FIRESTORE_COLLECTIONS.SALES_TARGETS), where('month', '==', monthKey));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as SalesTarget));
    });
  }

  /**
   * Real-time listener for sales targets.
   */
  static subscribeToSalesTargets(
    monthKey: string | undefined,
    onUpdate: (targets: SalesTarget[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const colRef = collection(db, FIRESTORE_COLLECTIONS.SALES_TARGETS);
    const q = monthKey ? query(colRef, where('month', '==', monthKey)) : colRef;
    return onSnapshot(q, (snap) => {
      this.invalidateCache('targets');
      const targets = snap.docs.map(d => ({ ...d.data(), id: d.id } as SalesTarget));
      onUpdate(targets);
    }, (err) => {
      console.warn('[AdminApi] Sales targets snapshot error:', err);
      onError?.(err);
    });
  }

  static async saveSalesTarget(target: SalesTarget, adminUser?: { id: string; name: string }): Promise<void> {
    const payload = cleanPayload({
      ...target,
      _syncedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.SALES_TARGETS, target.id), payload, { merge: true });
    this.invalidateCache('targets');

    if (adminUser) {
      await this.logAdminAction({
        adminId: adminUser.id,
        adminName: adminUser.name,
        actionType: 'sales_target_assigned',
        targetRecordId: target.id,
        targetRecordTitle: `${target.staffName} (${target.month})`,
        details: `Assigned Target: ₹${target.targetAmount}, Incentive: ${target.incentivePercent}%`,
      });
    }
  }

  // --- Salary Slips ---
  static async getSalarySlips(monthKey?: string, forceRefresh = false): Promise<SalarySlip[]> {
    const cacheKey = `slips_${monthKey || 'all'}`;
    return this.cachedFetch(cacheKey, 30000, forceRefresh, async () => {
      let q = query(collection(db, FIRESTORE_COLLECTIONS.SALARY_SLIPS));
      if (monthKey) {
        q = query(collection(db, FIRESTORE_COLLECTIONS.SALARY_SLIPS), where('monthKey', '==', monthKey));
      }
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as SalarySlip));
    });
  }

  /**
   * Real-time listener for salary slips.
   */
  static subscribeToSalarySlips(
    monthKey: string | undefined,
    onUpdate: (slips: SalarySlip[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const colRef = collection(db, FIRESTORE_COLLECTIONS.SALARY_SLIPS);
    const q = monthKey ? query(colRef, where('monthKey', '==', monthKey)) : colRef;
    return onSnapshot(q, (snap) => {
      this.invalidateCache('slips');
      const slips = snap.docs.map(d => ({ ...d.data(), id: d.id } as SalarySlip));
      onUpdate(slips);
    }, (err) => {
      console.warn('[AdminApi] Salary slips snapshot error:', err);
      onError?.(err);
    });
  }

  static async saveSalarySlip(slip: SalarySlip, adminUser?: { id: string; name: string }): Promise<void> {
    const payload = cleanPayload({
      ...slip,
      _syncedAt: new Date().toISOString(),
    });
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.SALARY_SLIPS, slip.id), payload, { merge: true });
    this.invalidateCache('slips');

    if (adminUser) {
      await this.logAdminAction({
        adminId: adminUser.id,
        adminName: adminUser.name,
        actionType: 'salary_slip_generated',
        targetRecordId: slip.id,
        targetRecordTitle: `${slip.staffName} (${slip.monthKey})`,
        details: `Net Salary: ₹${slip.netSalary}, Basic: ₹${slip.basicSalary}, Deductions: ₹${slip.deductions}`,
      });
    }
  }

  // --- Notifications & Announcements ---
  static async getNotifications(forceRefresh = false): Promise<AppNotification[]> {
    return this.cachedFetch('notifications', 20000, forceRefresh, async () => {
      const q = query(collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS), orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ ...d.data(), id: d.id } as AppNotification));
    });
  }

  /**
   * Real-time listener for notifications.
   */
  static subscribeToNotifications(
    onUpdate: (notifications: AppNotification[]) => void,
    onError?: (error: any) => void
  ): () => void {
    const q = query(collection(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS), orderBy('timestamp', 'desc'), limit(50));
    return onSnapshot(q, (snap) => {
      this.invalidateCache('notifications');
      const notifs = snap.docs.map(d => ({ ...d.data(), id: d.id } as AppNotification));
      onUpdate(notifs);
    }, (err) => {
      console.warn('[AdminApi] Notifications snapshot error:', err);
      onError?.(err);
    });
  }

  static async createAnnouncement(
    announcement: {
      title: string;
      body: string;
      priority?: 'normal' | 'high' | 'urgent';
      status?: 'published' | 'draft' | 'scheduled';
      targetAudience?: 'all' | 'specific_staff';
      targetStaffIds?: string[];
      startDate?: string;
      expiryDate?: string;
    },
    adminUser: { id: string; name: string }
  ): Promise<AppNotification> {
    const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const nowIso = new Date().toISOString();
    
    // Determine schedule status if startDate is in the future
    let finalStatus = announcement.status || 'published';
    if (announcement.startDate && new Date(announcement.startDate).getTime() > Date.now() && finalStatus === 'published') {
      finalStatus = 'scheduled';
    }

    const targetAudience = announcement.targetAudience || 'all';
    let targetStaffIds = announcement.targetStaffIds || [];
    let targetUserId = 'all';

    if (targetAudience === 'specific_staff') {
      if (!targetStaffIds || targetStaffIds.length === 0) {
        throw new Error('At least one staff member must be selected for targeted announcements.');
      }
      // Single staff uses their specific UID; multi-staff uses 'targeted'
      targetUserId = targetStaffIds.length === 1 ? targetStaffIds[0] : 'targeted';
    } else {
      // Broadcast announcement
      targetUserId = 'all';
      targetStaffIds = [];
    }

    // If draft, bind userId to the creating admin UID so staff queries never return it
    if (finalStatus === 'draft') {
      targetUserId = adminUser.id;
    }

    const notification: AppNotification = {
      id: notifId,
      userId: targetUserId,
      title: announcement.title.trim(),
      body: announcement.body.trim(),
      type: 'announcement',
      priority: announcement.priority || 'normal',
      status: finalStatus,
      targetAudience: targetAudience,
      targetStaffIds: targetStaffIds,
      startDate: announcement.startDate || nowIso.split('T')[0],
      expiryDate: announcement.expiryDate || '',
      authorName: adminUser.name,
      createdBy: adminUser.id,
      timestamp: nowIso,
      read: false,
      readBy: [],
      _syncedAt: nowIso,
    };

    await setDoc(doc(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS, notifId), notification);
    this.invalidateCache('notifications');

    await this.logAdminAction({
      adminId: adminUser.id,
      adminName: adminUser.name,
      actionType: 'announcement_broadcast',
      targetRecordId: notifId,
      targetRecordTitle: announcement.title,
      details: `${announcement.body.substring(0, 100)} | Priority: ${notification.priority} | Status: ${notification.status} | Audience: ${notification.targetAudience}`,
    });

    return notification;
  }

  static async updateAnnouncement(
    id: string,
    updates: Partial<AppNotification>,
    adminUser: { id: string; name: string }
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      ...updates,
      _syncedAt: nowIso,
    };
    if (updates.title) updatePayload.title = updates.title.trim();
    if (updates.body) updatePayload.body = updates.body.trim();

    // Recompute userId if audience, staff targets, or status change
    if (updates.status === 'draft') {
      updatePayload.userId = adminUser.id;
    } else if (updates.targetAudience === 'specific_staff' || (updates.targetStaffIds && updates.targetStaffIds.length > 0)) {
      const staffIds = updates.targetStaffIds || [];
      if (staffIds.length === 0 && updates.targetAudience === 'specific_staff') {
        throw new Error('At least one staff member must be selected for targeted announcements.');
      }
      updatePayload.userId = staffIds.length === 1 ? staffIds[0] : 'targeted';
      updatePayload.targetAudience = 'specific_staff';
    } else if (updates.targetAudience === 'all') {
      updatePayload.userId = 'all';
      updatePayload.targetStaffIds = [];
    }

    await setDoc(doc(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS, id), updatePayload, { merge: true });
    this.invalidateCache('notifications');

    await this.logAdminAction({
      adminId: adminUser.id,
      adminName: adminUser.name,
      actionType: 'announcement_updated' as any,
      targetRecordId: id,
      targetRecordTitle: updates.title || 'Announcement Updated',
      details: `Updated announcement fields: ${Object.keys(updates).join(', ')}`,
    });
  }

  static async deleteAnnouncement(
    id: string,
    title: string,
    adminUser: { id: string; name: string }
  ): Promise<void> {
    await deleteDoc(doc(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS, id));
    this.invalidateCache('notifications');

    await this.logAdminAction({
      adminId: adminUser.id,
      adminName: adminUser.name,
      actionType: 'announcement_deleted' as any,
      targetRecordId: id,
      targetRecordTitle: title,
      details: `Permanently removed announcement record: ${id}`,
    });
  }

  static async markNotificationRead(id: string): Promise<void> {
    await setDoc(
      doc(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS, id),
      { read: true, _syncedAt: new Date().toISOString() },
      { merge: true }
    );
    this.invalidateCache('notifications');
  }

  static async markAllNotificationsRead(ids: string[]): Promise<void> {
    const nowIso = new Date().toISOString();
    await Promise.all(
      ids.map(id =>
        setDoc(
          doc(db, FIRESTORE_COLLECTIONS.NOTIFICATIONS, id),
          { read: true, _syncedAt: nowIso },
          { merge: true }
        )
      )
    );
    this.invalidateCache('notifications');
  }

  // --- Shop Config ---
  // Unified with mobile app using 'main_store' with fallback to 'main'
  static async getShopConfig(forceRefresh = false): Promise<ShopConfig | null> {
    return this.cachedFetch('shopConfig', 60000, forceRefresh, async () => {
      try {
        const snapStore = await getDoc(doc(db, FIRESTORE_COLLECTIONS.SHOP_CONFIG, 'main_store'));
        if (snapStore.exists()) {
          return snapStore.data() as ShopConfig;
        }
        const snapMain = await getDoc(doc(db, FIRESTORE_COLLECTIONS.SHOP_CONFIG, 'main'));
        if (snapMain.exists()) {
          return snapMain.data() as ShopConfig;
        }
      } catch (e) {
        console.warn('Could not load shop config:', e);
      }
      return null;
    });
  }

  static async saveShopConfig(config: ShopConfig, adminUser?: { id: string; name: string }): Promise<void> {
    const payload = cleanPayload({
      ...config,
      _syncedAt: new Date().toISOString(),
    });
    // Write to both 'main_store' (standard mobile) and 'main' for 100% synchronization compatibility
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.SHOP_CONFIG, 'main_store'), payload, { merge: true });
    await setDoc(doc(db, FIRESTORE_COLLECTIONS.SHOP_CONFIG, 'main'), payload, { merge: true });
    this.invalidateCache('shopConfig');

    if (adminUser) {
      await this.logAdminAction({
        adminId: adminUser.id,
        adminName: adminUser.name,
        actionType: 'shop_config_updated',
        targetRecordId: 'main_store',
        targetRecordTitle: config.shopName,
        details: `Updated Store GPS: (${config.latitude}, ${config.longitude}), Radius: ${config.allowedRadiusMeters}m`,
      });
    }
  }

  // --- Administrative Audit Logs ---
  static async logAdminAction(entry: {
    adminId: string;
    adminName: string;
    actionType: string;
    targetRecordId: string;
    targetRecordTitle?: string;
    details?: string;
    beforeValue?: any;
    afterValue?: any;
  }): Promise<AdminAuditEntry> {
    try {
      const logId = 'audit_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
      const auditDoc: AdminAuditEntry = {
        ...entry,
        id: logId,
        timestamp: new Date().toISOString(),
      };
      await setDoc(doc(db, 'audit_logs', logId), auditDoc);
      return auditDoc;
    } catch (e) {
      console.warn('Could not record audit entry:', e);
      return {
        ...entry,
        id: 'local_' + Date.now(),
        timestamp: new Date().toISOString(),
      };
    }
  }

  static async getAdminAuditLogs(limitCount = 200, forceRefresh = false): Promise<AdminAuditEntry[]> {
    return this.cachedFetch(`audit_logs_${limitCount}`, 20000, forceRefresh, async () => {
      try {
        const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(limitCount));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as AdminAuditEntry));
      } catch (e) {
        console.warn('Could not fetch audit logs:', e);
        return [];
      }
    });
  }

  // --- Device Management & Approval Workflow ---

  static async getDeviceChangeRequests(forceRefresh = false): Promise<DeviceChangeRequest[]> {
    return this.cachedFetch('device_requests', 20000, forceRefresh, async () => {
      try {
        const q = query(
          collection(db, FIRESTORE_COLLECTIONS.DEVICE_CHANGE_REQUESTS),
          orderBy('createdAt', 'desc')
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ ...d.data(), id: d.id } as DeviceChangeRequest));
      } catch (e) {
        console.warn('Could not fetch device change requests:', e);
        return [];
      }
    });
  }

  static async approveDeviceRegistration(
    userId: string,
    admin: { id: string; name: string }
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      deviceBindingStatus: 'approved',
      deviceApprovedAt: nowIso,
      deviceApprovedBy: admin.name || admin.id,
      deviceRejectionReason: deleteField(),
    });
    this.invalidateCache('users');

    await this.logAdminAction({
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'security_policy_change',
      targetRecordId: userId,
      targetRecordTitle: 'Device Registration Approved',
      details: `Admin approved device registration for staff ID ${userId}`,
    });
  }

  static async rejectDeviceRegistration(
    userId: string,
    reason: string,
    admin: { id: string; name: string }
  ): Promise<void> {
    const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      deviceBindingStatus: 'rejected',
      deviceRejectionReason: reason.trim(),
    });
    this.invalidateCache('users');

    await this.logAdminAction({
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'security_policy_change',
      targetRecordId: userId,
      targetRecordTitle: 'Device Registration Rejected',
      details: `Admin rejected device registration for staff ID ${userId}. Reason: ${reason}`,
    });
  }

  static async approveDeviceChangeRequest(
    requestId: string,
    request: DeviceChangeRequest,
    admin: { id: string; name: string }
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const batch = writeBatch(db);

    // 1. Update user profile with the new device binding
    const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, request.userId);
    batch.update(userRef, {
      deviceId: request.newDeviceId,
      devicePublicKey: request.newDevicePublicKey,
      deviceModel: request.newDeviceModel,
      devicePlatform: request.newDevicePlatform,
      deviceBindingStatus: 'approved',
      deviceApprovedAt: nowIso,
      deviceApprovedBy: admin.name || admin.id,
      deviceRejectionReason: deleteField(),
    });

    // 2. Mark the change request as approved
    const reqRef = doc(db, FIRESTORE_COLLECTIONS.DEVICE_CHANGE_REQUESTS, requestId);
    batch.update(reqRef, {
      status: 'approved',
      reviewedAt: nowIso,
      reviewedBy: admin.id,
      reviewedByName: admin.name,
    });

    // Commit atomically
    await batch.commit();
    this.invalidateCache('users');

    // 3. Log audit entry
    await this.logAdminAction({
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'security_policy_change',
      targetRecordId: request.userId,
      targetRecordTitle: 'Device Change Approved',
      details: `Replaced device for ${request.userName} (${request.userEmail}) to ${request.newDeviceModel} (${request.newDeviceId.substring(0, 16)}...). Reason: ${request.reason}`,
    });
  }

  static async rejectDeviceChangeRequest(
    requestId: string,
    reason: string,
    admin: { id: string; name: string }
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const reqRef = doc(db, FIRESTORE_COLLECTIONS.DEVICE_CHANGE_REQUESTS, requestId);
    await updateDoc(reqRef, {
      status: 'rejected',
      rejectionReason: reason.trim(),
      reviewedAt: nowIso,
      reviewedBy: admin.id,
      reviewedByName: admin.name,
    });

    await this.logAdminAction({
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'security_policy_change',
      targetRecordId: requestId,
      targetRecordTitle: 'Device Change Rejected',
      details: `Rejected device change request ${requestId}. Reason: ${reason}`,
    });
  }

  static async resetStaffDeviceBinding(
    userId: string,
    admin: { id: string; name: string }
  ): Promise<void> {
    const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      deviceId: deleteField(),
      devicePublicKey: deleteField(),
      deviceModel: deleteField(),
      devicePlatform: deleteField(),
      deviceBindingStatus: 'unregistered',
      deviceApprovedAt: deleteField(),
      deviceApprovedBy: deleteField(),
      deviceRejectionReason: deleteField(),
    });
    this.invalidateCache('users');

    await this.logAdminAction({
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'security_policy_change',
      targetRecordId: userId,
      targetRecordTitle: 'Device Binding Reset',
      details: `Admin reset device binding for staff ID ${userId}. Staff must register new device on next login.`,
    });
  }

  // --- Biometric Face Registration Review ---
  static async approveFaceEnrollment(
    userId: string,
    admin: { id: string; name: string }
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      faceEnrollmentStatus: 'approved',
      hasFaceRegistered: true,
      faceApprovedAt: nowIso,
      faceApprovedBy: admin.name || admin.id,
      faceRejectionReason: null,
    });
    this.invalidateCache('users');

    await this.logAdminAction({
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'security_policy_change',
      targetRecordId: userId,
      targetRecordTitle: 'Face Enrollment Approved',
      details: `Admin approved biometric face enrollment for staff ID ${userId}`,
    });
  }

  static async rejectFaceEnrollment(
    userId: string,
    reason: string,
    admin: { id: string; name: string }
  ): Promise<void> {
    const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, userId);
    await updateDoc(userRef, {
      faceEnrollmentStatus: 'rejected',
      hasFaceRegistered: false,
      faceRejectionReason: reason.trim(),
    });
    this.invalidateCache('users');

    await this.logAdminAction({
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'security_policy_change',
      targetRecordId: userId,
      targetRecordTitle: 'Face Enrollment Rejected',
      details: `Admin rejected biometric face enrollment for staff ID ${userId}. Reason: ${reason}`,
    });
  }

  // --- Direct Staff Registration Approval Workflow ---
  static async approveStaffRegistration(
    userId: string,
    params: {
      basicSalary: number;
      monthlyTarget: number;
    },
    admin: { id: string; name: string }
  ): Promise<void> {
    const nowIso = new Date().toISOString();
    const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      throw new Error(`Staff user ${userId} not found.`);
    }
    const userData = snap.data();

    await updateDoc(userRef, {
      registrationStatus: 'approved',
      isActive: true,
      basicSalary: Number(params.basicSalary) || 0,
      monthlyTarget: Number(params.monthlyTarget) || 0,
      approvedAt: nowIso,
      approvedBy: admin.id,
      approvedByName: admin.name || admin.id,
      rejectionReason: null,
      faceEnrollmentStatus: 'approved',
      hasFaceRegistered: true,
      faceApprovedAt: nowIso,
      faceApprovedBy: admin.name || admin.id,
      deviceBindingStatus: 'approved',
      deviceApprovedAt: nowIso,
      deviceApprovedBy: admin.name || admin.id,
    });
    this.invalidateCache('users');

    await this.logAdminAction({
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'user_management',
      targetRecordId: userId,
      targetRecordTitle: `Staff Registration Approved: ${userData.name || userId}`,
      details: `Admin approved staff registration for ${userData.name} (${userData.email}). Set basic salary: ₹${params.basicSalary}, monthly target: ₹${params.monthlyTarget}.`,
    });
  }

  static async rejectStaffRegistration(
    userId: string,
    reason: string,
    admin: { id: string; name: string }
  ): Promise<void> {
    if (!reason || reason.trim().length < 5) {
      throw new Error('A detailed rejection reason (minimum 5 characters) is required.');
    }
    const nowIso = new Date().toISOString();
    const userRef = doc(db, FIRESTORE_COLLECTIONS.USERS, userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      throw new Error(`Staff user ${userId} not found.`);
    }
    const userData = snap.data();

    await updateDoc(userRef, {
      registrationStatus: 'rejected',
      isActive: false,
      rejectedAt: nowIso,
      rejectedBy: admin.id,
      rejectedByName: admin.name || admin.id,
      rejectionReason: reason.trim(),
      faceEnrollmentStatus: 'rejected',
      hasFaceRegistered: false,
      faceRejectionReason: reason.trim(),
      deviceBindingStatus: 'rejected',
      deviceRejectionReason: reason.trim(),
    });
    this.invalidateCache('users');

    await this.logAdminAction({
      adminId: admin.id,
      adminName: admin.name,
      actionType: 'user_management',
      targetRecordId: userId,
      targetRecordTitle: `Staff Registration Rejected: ${userData.name || userId}`,
      details: `Admin rejected staff registration for ${userData.name} (${userData.email}). Reason: ${reason.trim()}`,
    });
  }

  // --- Attendance Analytics Helpers ---
  static async getStaffAttendanceForMonth(staffId: string, monthKey: string, forceRefresh = false): Promise<AttendanceRecord[]> {
    return this.cachedFetch(`att_${staffId}_${monthKey}`, 30000, forceRefresh, async () => {
      try {
        const q = query(
          collection(db, FIRESTORE_COLLECTIONS.ATTENDANCE),
          where('userId', '==', staffId)
        );
        const snap = await getDocs(q);
        const allRecords = snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord));
        return allRecords.filter(r => r.date && r.date.startsWith(monthKey));
      } catch (e) {
        console.warn('Could not fetch staff attendance for month:', e);
        return [];
      }
    });
  }
}

