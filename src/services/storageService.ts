import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AttendanceRecord,
  CustomerLead,
  MobilePriceItem,
  SecondHandPurchase,
  SecondHandSale,
  ShopConfig,
  User,
  SalesTarget,
  AppNotification,
  SalarySlip,
  FaceTemplate,
  AttendanceAuditLog,
  AdminAuditEntry,
  DeviceChangeRequest,
  StaffRegistrationDraft,
} from '../types';
import { DEFAULT_SHOP_CONFIG, INITIAL_USERS } from '../constants';
import { getTodayDateString } from '../utils/format';
import { FirestoreSyncService, FIRESTORE_COLLECTIONS } from './firestoreSync';

const STORAGE_KEYS = {
  CURRENT_USER: '@pmc_current_user',
  USERS_LIST: '@pmc_users_list',
  SHOP_CONFIG: '@pmc_shop_config',
  ATTENDANCE: '@pmc_attendance',
  LEADS: '@pmc_leads',
  PRICE_LIST: '@pmc_price_list',
  SECOND_HAND_PURCHASES: '@pmc_second_hand_purchases',
  SECOND_HAND_SALES: '@pmc_second_hand_sales',
  SALES_TARGETS: '@pmc_sales_targets',
  SALARY_SLIPS: '@pmc_salary_slips',
  NOTIFICATIONS: '@pmc_notifications',
  FACE_TEMPLATES: '@pmc_face_templates',
  ATTENDANCE_AUDIT_LOGS: '@pmc_attendance_audit_logs',
  ADMIN_AUDIT_LOGS: '@pmc_admin_audit_logs',
  DEVICE_CHANGE_REQUESTS: '@pmc_device_change_requests',
  PERSISTENT_DEVICE_ID: '@pmc_persistent_device_id',
  PERSISTENT_DEVICE_MODEL: '@pmc_persistent_device_model',
  REGISTRATION_DRAFT: '@pmc_registration_draft',
  USED_TOKENS: '@pmc_used_tokens',
  SEEDED: '@pmc_seeded_v1',
};

// Seed sample data strictly per PDF specifications
const INITIAL_PRICE_LIST: MobilePriceItem[] = [
  {
    id: 'price_vivo_v50',
    brand: 'Vivo',
    model: 'V50',
    ram: '8GB',
    storage: '128GB',
    purchasePrice: 22000,
    sellingPrice: 24999,
    inStock: true,
    updatedAt: new Date().toISOString(),
    priceHistory: [
      {
        date: '2026-09-15',
        purchasePrice: 22500,
        sellingPrice: 25499,
        updatedBy: 'Admin',
      },
    ],
  },
  {
    id: 'price_oppo_reno14',
    brand: 'Oppo',
    model: 'Reno 14',
    ram: '8GB',
    storage: '256GB',
    purchasePrice: 28000,
    sellingPrice: 31999,
    inStock: true,
    updatedAt: new Date().toISOString(),
    priceHistory: [],
  },
  {
    id: 'price_samsung_a56',
    brand: 'Samsung',
    model: 'A56',
    ram: '8GB',
    storage: '128GB',
    purchasePrice: 25000,
    sellingPrice: 27999,
    inStock: true,
    updatedAt: new Date().toISOString(),
    priceHistory: [],
  },
  {
    id: 'price_apple_iphone15',
    brand: 'Apple',
    model: 'iPhone 15',
    ram: '6GB',
    storage: '128GB',
    purchasePrice: 62000,
    sellingPrice: 69900,
    inStock: true,
    updatedAt: new Date().toISOString(),
    priceHistory: [],
  },
  {
    id: 'price_oneplus_12r',
    brand: 'OnePlus',
    model: '12R',
    ram: '16GB',
    storage: '256GB',
    purchasePrice: 36000,
    sellingPrice: 39999,
    inStock: true,
    updatedAt: new Date().toISOString(),
    priceHistory: [],
  },
  {
    id: 'price_xiaomi_14_civi',
    brand: 'Xiaomi',
    model: '14 Civi',
    ram: '8GB',
    storage: '256GB',
    purchasePrice: 38000,
    sellingPrice: 42999,
    inStock: true,
    updatedAt: new Date().toISOString(),
    priceHistory: [],
  },
  {
    id: 'price_realme_gt_6',
    brand: 'Realme',
    model: 'GT 6',
    ram: '12GB',
    storage: '256GB',
    purchasePrice: 35000,
    sellingPrice: 40999,
    inStock: true,
    updatedAt: new Date().toISOString(),
    priceHistory: [],
  },
];

const INITIAL_LEADS: CustomerLead[] = [
  {
    id: 'lead_1',
    name: 'Vikram Joshi',
    phone: '9825123456',
    alternatePhone: '9825123457',
    interestedBrand: 'Vivo',
    interestedModel: 'V50 8GB/128GB',
    budget: 25000,
    remarks: 'Wants exchange offer for old Vivo V23',
    status: 'new',
    followUpDate: getTodayDateString(),
    followUpTime: '16:00',
    createdBy: 'user_staff_1',
    createdByName: 'Ankit Verma',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    history: [
      {
        timestamp: new Date(Date.now() - 3600000 * 4).toISOString(),
        updatedBy: 'Ankit Verma',
        status: 'new',
        notes: 'Walked in inquiring about Vivo V50.',
      },
    ],
  },
  {
    id: 'lead_2',
    name: 'Sneha Kapadia',
    phone: '9879054321',
    interestedBrand: 'Samsung',
    interestedModel: 'A56 8GB/128GB',
    budget: 28000,
    remarks: 'Interested in EMI / Bajaj Finserv options',
    status: 'follow_up',
    followUpDate: getTodayDateString(),
    followUpTime: '17:30',
    createdBy: 'user_staff_2',
    createdByName: 'Pooja Mehta',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    history: [
      {
        timestamp: new Date(Date.now() - 86400000).toISOString(),
        updatedBy: 'Pooja Mehta',
        status: 'follow_up',
        notes: 'Requested loan scheme details. Follow up scheduled.',
      },
    ],
  },
];

const INITIAL_PURCHASES: SecondHandPurchase[] = [
  {
    id: 'pur_1',
    customerName: 'Mahesh Solanki',
    phone: '9724112233',
    alternatePhone: '9724112234',
    address: 'B-204, Shivalik Residency, Adajan, Surat',
    aadhaarNumber: '482910394821',
    brand: 'Apple',
    model: 'iPhone 13 128GB Blue',
    ram: '4GB',
    storage: '128GB',
    imei: '864920048192039',
    condition: 'Excellent condition with original box',
    purchaseAmount: 32000,
    digitalSignatureUri: 'data:image/png;base64,sample_signature',
    purchaseDate: getTodayDateString(),
    purchaseTime: '11:30:00',
    purchasedByStaffId: 'user_staff_1',
    purchasedByStaffName: 'Ankit Verma',
    status: 'in_stock',
    notes: 'Clean bill, verified IMEI with police database',
  },
  {
    id: 'pur_2',
    customerName: 'Ramesh Dave',
    phone: '9909283746',
    address: '14, Gayatri Nagar, Katargam, Surat',
    aadhaarNumber: '394820194829',
    brand: 'OnePlus',
    model: 'OnePlus 11R 8/128GB',
    ram: '8GB',
    storage: '128GB',
    imei: '861029384756192',
    condition: 'Minor scratches on corner',
    purchaseAmount: 20000,
    digitalSignatureUri: 'data:image/png;base64,sample_signature',
    purchaseDate: '2026-10-01',
    purchaseTime: '15:15:00',
    purchasedByStaffId: 'user_staff_2',
    purchasedByStaffName: 'Pooja Mehta',
    status: 'sold',
    notes: 'Sold to buyer next day',
  },
];

const INITIAL_SALES: SecondHandSale[] = [
  {
    id: 'sale_1',
    purchaseRecordId: 'pur_2',
    buyerName: 'Jayesh Patel',
    phone: '9898012345',
    alternatePhone: '9898012346',
    address: 'Plot 45, Green Park Society, Vesu, Surat',
    aadhaarNumber: '293847561029',
    brand: 'OnePlus',
    model: 'OnePlus 11R 8/128GB',
    ram: '8GB',
    storage: '128GB',
    imei: '861029384756192',
    purchaseAmount: 20000,
    sellingAmount: 24500,
    profitAmount: 4500,
    marginPercent: 18.37,
    invoiceNumber: 'PMC-202610-1001',
    digitalSignatureUri: 'data:image/png;base64,sample_signature',
    saleDate: getTodayDateString(),
    saleTime: '12:45:00',
    soldByStaffId: 'user_staff_1',
    soldByStaffName: 'Ankit Verma',
    paymentMethod: 'UPI',
    warrantyMonths: 3,
    notes: 'Covered with 3 months shop warranty',
  },
];

const INITIAL_SALARY_SLIPS: SalarySlip[] = [
  {
    id: 'slip_user_admin_1_2026-09',
    staffId: 'user_admin_1',
    staffName: 'Parth Patel',
    designation: 'Store Owner & Admin',
    month: 'September 2026',
    monthKey: '2026-09',
    basicSalary: 60000,
    salesIncentive: 10000,
    attendanceBonus: 2000,
    deductions: 0,
    netSalary: 72000,
    totalWorkingDays: 26,
    presentDays: 26,
    lateDays: 0,
    salesAchieved: 550000,
    generatedDate: '2026-09-30',
    isPaid: true,
  },
  {
    id: 'slip_user_mgr_1_2026-09',
    staffId: 'user_mgr_1',
    staffName: 'Rahul Sharma',
    designation: 'Floor Manager',
    month: 'September 2026',
    monthKey: '2026-09',
    basicSalary: 35000,
    salesIncentive: 7000,
    attendanceBonus: 2000,
    deductions: 0,
    netSalary: 44000,
    totalWorkingDays: 26,
    presentDays: 25,
    lateDays: 0,
    salesAchieved: 380000,
    generatedDate: '2026-09-30',
    isPaid: true,
  },
  {
    id: 'slip_user_staff_1_2026-09',
    staffId: 'user_staff_1',
    staffName: 'Ankit Verma',
    designation: 'Sales Executive',
    month: 'September 2026',
    monthKey: '2026-09',
    basicSalary: 20000,
    salesIncentive: 4500,
    attendanceBonus: 2000,
    deductions: 769,
    netSalary: 25731,
    totalWorkingDays: 26,
    presentDays: 24,
    lateDays: 1,
    salesAchieved: 225000,
    generatedDate: '2026-09-30',
    isPaid: true,
  },
  {
    id: 'slip_user_staff_2_2026-09',
    staffId: 'user_staff_2',
    staffName: 'Pooja Mehta',
    designation: 'Customer Relationship Exec',
    month: 'September 2026',
    monthKey: '2026-09',
    basicSalary: 22000,
    salesIncentive: 5000,
    attendanceBonus: 2000,
    deductions: 0,
    netSalary: 29000,
    totalWorkingDays: 26,
    presentDays: 26,
    lateDays: 0,
    salesAchieved: 250000,
    generatedDate: '2026-09-30',
    isPaid: true,
  },
];

export class StorageService {
  private static writeLocks = new Map<string, Promise<any>>();

  static async withLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const currentLock = this.writeLocks.get(key) || Promise.resolve();
    let releaseLock: () => void;
    const nextLock = new Promise<void>(resolve => { releaseLock = resolve; });
    this.writeLocks.set(key, nextLock);

    try {
      await currentLock;
      return await operation();
    } finally {
      releaseLock!();
      if (this.writeLocks.get(key) === nextLock) {
        this.writeLocks.delete(key);
      }
    }
  }
  /**
   * Initialize default seed data if not yet created
   */
  static async seedInitialDataIfNeeded(): Promise<void> {
    try {
      const seeded = await AsyncStorage.getItem(STORAGE_KEYS.SEEDED);
      if (!seeded) {
        await AsyncStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(INITIAL_USERS));
        await AsyncStorage.setItem(STORAGE_KEYS.SHOP_CONFIG, JSON.stringify(DEFAULT_SHOP_CONFIG));
        await AsyncStorage.setItem(STORAGE_KEYS.PRICE_LIST, JSON.stringify(INITIAL_PRICE_LIST));
        await AsyncStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(INITIAL_LEADS));
        await AsyncStorage.setItem(STORAGE_KEYS.SECOND_HAND_PURCHASES, JSON.stringify(INITIAL_PURCHASES));
        await AsyncStorage.setItem(STORAGE_KEYS.SECOND_HAND_SALES, JSON.stringify(INITIAL_SALES));
        await AsyncStorage.setItem(STORAGE_KEYS.SALARY_SLIPS, JSON.stringify(INITIAL_SALARY_SLIPS));
        // Default login as Admin for seamless initial launch
        await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(INITIAL_USERS[0]));
        await AsyncStorage.setItem(STORAGE_KEYS.SEEDED, 'true');
      }
    } catch (e) {
      console.warn('Seed data error:', e);
    }
  }

  // --- High-Performance In-Memory Cache Layer ---
  private static memoryCache = new Map<string, any>();

  /** Clear in-memory cache (e.g. for testing or logout) */
  static clearMemoryCache(): void {
    StorageService.memoryCache.clear();
  }

  // --- User Session ---
  static async getCurrentUser(): Promise<User | null> {
    if (StorageService.memoryCache.has(STORAGE_KEYS.CURRENT_USER)) {
      return StorageService.memoryCache.get(STORAGE_KEYS.CURRENT_USER);
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    const user = data ? JSON.parse(data) : null;
    StorageService.memoryCache.set(STORAGE_KEYS.CURRENT_USER, user);
    return user;
  }

  static async setCurrentUser(user: User | null): Promise<void> {
    if (user) {
      StorageService.memoryCache.set(STORAGE_KEYS.CURRENT_USER, user);
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      StorageService.memoryCache.delete(STORAGE_KEYS.CURRENT_USER);
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  // --- Registration Progress Persistence (Non-sensitive only) ---
  static async getStaffRegistrationDraft(): Promise<StaffRegistrationDraft | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.REGISTRATION_DRAFT);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  static async saveStaffRegistrationDraft(draft: StaffRegistrationDraft): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REGISTRATION_DRAFT, JSON.stringify(draft));
    } catch (e) {
      console.warn('[StorageService] Failed to save registration draft:', e);
    }
  }

  static async clearStaffRegistrationDraft(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.REGISTRATION_DRAFT);
    } catch (e) {
      console.warn('[StorageService] Failed to clear registration draft:', e);
    }
  }

  /** Clears sensitive user session data and cached team records on logout or deactivation. */
  static async clearSensitiveUserData(): Promise<void> {
    StorageService.memoryCache.clear();
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER),
      AsyncStorage.removeItem(STORAGE_KEYS.USERS_LIST),
      AsyncStorage.removeItem(STORAGE_KEYS.SALARY_SLIPS),
      AsyncStorage.removeItem(STORAGE_KEYS.SALES_TARGETS),
      AsyncStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS),
    ]);
  }

  static async getAllUsers(): Promise<User[]> {
    if (StorageService.memoryCache.has(STORAGE_KEYS.USERS_LIST)) {
      return StorageService.memoryCache.get(STORAGE_KEYS.USERS_LIST);
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USERS_LIST);
    const users = data ? JSON.parse(data) : [];
    StorageService.memoryCache.set(STORAGE_KEYS.USERS_LIST, users);
    return users;
  }

  /** Merge authenticated cloud data into the on-device cache without echoing writes. */
  static async mergeCloudCollection(collectionName: string, remoteRecords: any[]): Promise<void> {
    const keys: Record<string, string> = {
      users: STORAGE_KEYS.USERS_LIST,
      attendance: STORAGE_KEYS.ATTENDANCE,
      leads: STORAGE_KEYS.LEADS,
      mobile_prices: STORAGE_KEYS.PRICE_LIST,
      second_hand_purchases: STORAGE_KEYS.SECOND_HAND_PURCHASES,
      second_hand_sales: STORAGE_KEYS.SECOND_HAND_SALES,
      sales_targets: STORAGE_KEYS.SALES_TARGETS,
      salary_slips: STORAGE_KEYS.SALARY_SLIPS,
      notifications: STORAGE_KEYS.NOTIFICATIONS,
    };

    if (collectionName === FIRESTORE_COLLECTIONS.SHOP_CONFIG) {
      const config = remoteRecords.find((r: any) => r.id === 'main_store') || remoteRecords[0];
      if (config) {
        const shopConfig = { ...config };
        delete shopConfig.id;
        await AsyncStorage.setItem(STORAGE_KEYS.SHOP_CONFIG, JSON.stringify(shopConfig));
      }
      return;
    }

    const storageKey = keys[collectionName];
    if (!storageKey) return;
    const cachedText = StorageService.memoryCache.has(storageKey)
      ? JSON.stringify(StorageService.memoryCache.get(storageKey))
      : await AsyncStorage.getItem(storageKey);
    // Firebase Auth account IDs are canonical; old locally seeded/demo user IDs
    // must not be treated as provisioned cloud accounts or uploaded later.
    const cached: any[] = collectionName === FIRESTORE_COLLECTIONS.USERS
      ? []
      : cachedText ? JSON.parse(cachedText) : [];
    const merged = new Map<string, any>();
    cached.forEach(item => item?.id && merged.set(item.id, item));

    // For notifications, load user-specific locally read IDs to guarantee read state isolation & persistence
    let readIds = new Set<string>();
    if (collectionName === FIRESTORE_COLLECTIONS.NOTIFICATIONS) {
      readIds = await this.getReadNotificationIds();
    }

    // Remote data updates matching IDs unless local record has pending offline changes or a newer timestamp.
    remoteRecords.forEach(item => {
      if (!item?.id) return;
      const local = merged.get(item.id);

      // Notification read isolation: local read: true must NEVER be reverted by remote read: false
      if (collectionName === FIRESTORE_COLLECTIONS.NOTIFICATIONS) {
        const isLocallyRead = readIds.has(item.id) || (local && local.read === true);
        const finalRead = isLocallyRead || item.read === true;
        if (!local) {
          merged.set(item.id, { ...item, read: finalRead });
          return;
        }
        if (local._syncPending) {
          return;
        }
        merged.set(item.id, {
          ...local,
          ...item,
          read: finalRead,
        });
        return;
      }

      if (!local) {
        merged.set(item.id, item);
        return;
      }
      // Preserve local uncommitted edits during offline-to-online sync
      if (local._syncPending) {
        return;
      }
      // Stale snapshot protection: prevent older snapshot from overwriting newer local change
      const localTime = local.updatedAt || local._syncedAt;
      const remoteTime = item.updatedAt || item._syncedAt;
      if (localTime && remoteTime && new Date(localTime).getTime() > new Date(remoteTime).getTime()) {
        return;
      }
      merged.set(item.id, { ...local, ...item });
    });
    const mergedArray = Array.from(merged.values());
    StorageService.memoryCache.set(storageKey, mergedArray);
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(mergedArray));
    } catch (diskErr) {
      console.warn(`[StorageService] Background disk write warning for ${storageKey}:`, diskErr);
    }
  }

  static async saveUser(user: User): Promise<void> {
    const users = await this.getAllUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    StorageService.memoryCache.set(STORAGE_KEYS.USERS_LIST, users);
    await AsyncStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(users));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.USERS, user.id, user).catch(() => {});
  }

  // --- Shop Config ---
  static async getShopConfig(): Promise<ShopConfig> {
    if (StorageService.memoryCache.has(STORAGE_KEYS.SHOP_CONFIG)) {
      return StorageService.memoryCache.get(STORAGE_KEYS.SHOP_CONFIG);
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SHOP_CONFIG);
    if (!data) return DEFAULT_SHOP_CONFIG;
    try {
      const parsed: ShopConfig = JSON.parse(data);
      // If cached data contains obsolete Surat mock coordinates, purge and return latest defaults
      if (
        Math.abs(parsed.latitude - 21.1702) < 0.0001 &&
        Math.abs(parsed.longitude - 72.8311) < 0.0001
      ) {
        StorageService.memoryCache.set(STORAGE_KEYS.SHOP_CONFIG, DEFAULT_SHOP_CONFIG);
        await AsyncStorage.setItem(STORAGE_KEYS.SHOP_CONFIG, JSON.stringify(DEFAULT_SHOP_CONFIG));
        return DEFAULT_SHOP_CONFIG;
      }
      StorageService.memoryCache.set(STORAGE_KEYS.SHOP_CONFIG, parsed);
      return parsed;
    } catch {
      return DEFAULT_SHOP_CONFIG;
    }
  }

  static async saveShopConfig(config: ShopConfig): Promise<void> {
    StorageService.memoryCache.set(STORAGE_KEYS.SHOP_CONFIG, config);
    await AsyncStorage.setItem(STORAGE_KEYS.SHOP_CONFIG, JSON.stringify(config));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.SHOP_CONFIG, 'main_store', config).catch(() => {});
  }

  // --- Attendance ---
  static async getAttendanceRecords(userId?: string): Promise<AttendanceRecord[]> {
    let records: AttendanceRecord[];
    if (StorageService.memoryCache.has(STORAGE_KEYS.ATTENDANCE)) {
      records = StorageService.memoryCache.get(STORAGE_KEYS.ATTENDANCE);
    } else {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE);
      records = data ? JSON.parse(data) : [];
      StorageService.memoryCache.set(STORAGE_KEYS.ATTENDANCE, records);
    }
    if (userId) {
      return records.filter(r => r.userId === userId);
    }
    return records;
  }

  static async saveAttendanceRecord(record: AttendanceRecord): Promise<void> {
    const records = await this.getAttendanceRecords();
    const idx = records.findIndex(r => r.id === record.id || (r.userId === record.userId && r.date === record.date));
    if (idx >= 0) {
      records[idx] = { ...records[idx], ...record };
    } else {
      records.unshift(record);
    }
    StorageService.memoryCache.set(STORAGE_KEYS.ATTENDANCE, records);
    await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
    try {
      await FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.ATTENDANCE, record.id, record);
    } catch (syncErr: any) {
      if (__DEV__) console.warn('[StorageService] Attendance cloud sync warning:', syncErr?.message || syncErr);
    }
  }

  // --- Customer Leads ---
  static async getLeads(): Promise<CustomerLead[]> {
    if (StorageService.memoryCache.has(STORAGE_KEYS.LEADS)) {
      return StorageService.memoryCache.get(STORAGE_KEYS.LEADS);
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.LEADS);
    const leads = data ? JSON.parse(data) : [];
    StorageService.memoryCache.set(STORAGE_KEYS.LEADS, leads);
    return leads;
  }

  static async saveLead(lead: CustomerLead): Promise<CustomerLead> {
    return this.withLock(STORAGE_KEYS.LEADS, async () => {
      const existing = StorageService.memoryCache.has(STORAGE_KEYS.LEADS)
        ? StorageService.memoryCache.get(STORAGE_KEYS.LEADS)
        : await this.getLeads();
      const leads = [...existing];
      const idx = leads.findIndex(l => l.id === lead.id);
      const leadToSave: CustomerLead = { ...lead };

      // 1. Immediately persist in memory synchronously to prevent race conditions
      if (idx >= 0) {
        leads[idx] = leadToSave;
      } else {
        leads.unshift(leadToSave);
      }
      StorageService.memoryCache.set(STORAGE_KEYS.LEADS, leads);

      try {
        await AsyncStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
      } catch (diskErr) {
        console.warn('[StorageService] Disk write deferred for lead:', diskErr);
      }

      // 2. Synchronize with Cloud Firestore
      try {
        await FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.LEADS, leadToSave.id, leadToSave);
        leadToSave._syncPending = false;
        leadToSave._syncedAt = new Date().toISOString();

        // Update local storage with confirmed sync timestamp
        const currentList = await this.getLeads();
        const cIdx = currentList.findIndex(l => l.id === leadToSave.id);
        if (cIdx >= 0) {
          currentList[cIdx] = leadToSave;
          StorageService.memoryCache.set(STORAGE_KEYS.LEADS, currentList);
          try {
            await AsyncStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(currentList));
          } catch {}
        }
      } catch (err: any) {
        console.warn(`[StorageService] Cloud sync deferred for lead ${leadToSave.id}:`, err?.message || err);
        leadToSave._syncPending = true;

        const currentList = await this.getLeads();
        const cIdx = currentList.findIndex(l => l.id === leadToSave.id);
        if (cIdx >= 0) {
          currentList[cIdx] = leadToSave;
          StorageService.memoryCache.set(STORAGE_KEYS.LEADS, currentList);
          try {
            await AsyncStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(currentList));
          } catch {}
        }

        // Throw if permission is denied or unauthenticated so caller knows
        if (err?.code === 'permission-denied' || /permission|unauthenticated/i.test(err?.message || '')) {
          throw new Error(`Cloud sync error: ${err.message || 'Permission denied'}`);
        }
      }

      return leadToSave;
    });
  }

  /** Replace the local lead cache after a cloud pull without echoing writes back. */
  static async saveBulkLeads(leads: CustomerLead[]): Promise<void> {
    StorageService.memoryCache.set(STORAGE_KEYS.LEADS, leads);
    await AsyncStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
  }

  static async deleteLead(id: string): Promise<void> {
    const leads = await this.getLeads();
    const filtered = leads.filter(l => l.id !== id);
    StorageService.memoryCache.set(STORAGE_KEYS.LEADS, filtered);
    await AsyncStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(filtered));
    try {
      await FirestoreSyncService.deleteDocument(FIRESTORE_COLLECTIONS.LEADS, id);
    } catch (err) {
      console.warn(`[StorageService] Cloud delete failed for lead ${id}:`, err);
    }
  }

  // --- Mobile Price List ---
  static async getPriceList(): Promise<MobilePriceItem[]> {
    if (StorageService.memoryCache.has(STORAGE_KEYS.PRICE_LIST)) {
      return StorageService.memoryCache.get(STORAGE_KEYS.PRICE_LIST);
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PRICE_LIST);
    const list = data ? JSON.parse(data) : [];
    StorageService.memoryCache.set(STORAGE_KEYS.PRICE_LIST, list);
    return list;
  }

  static async savePriceItem(item: MobilePriceItem): Promise<void> {
    const list = await this.getPriceList();
    const idx = list.findIndex(p => p.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    StorageService.memoryCache.set(STORAGE_KEYS.PRICE_LIST, list);
    await AsyncStorage.setItem(STORAGE_KEYS.PRICE_LIST, JSON.stringify(list));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.MOBILE_PRICES, item.id, item).catch(() => {});
  }

  static async saveBulkPriceItems(items: MobilePriceItem[]): Promise<void> {
    StorageService.memoryCache.set(STORAGE_KEYS.PRICE_LIST, items);
    await AsyncStorage.setItem(STORAGE_KEYS.PRICE_LIST, JSON.stringify(items));
    for (const item of items) {
      FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.MOBILE_PRICES, item.id, item).catch(() => {});
    }
  }

  static async deletePriceItem(id: string): Promise<void> {
    const list = await this.getPriceList();
    const filtered = list.filter(p => p.id !== id);
    StorageService.memoryCache.set(STORAGE_KEYS.PRICE_LIST, filtered);
    await AsyncStorage.setItem(STORAGE_KEYS.PRICE_LIST, JSON.stringify(filtered));
    FirestoreSyncService.deleteDocument(FIRESTORE_COLLECTIONS.MOBILE_PRICES, id).catch(() => {});
  }

  // --- Second-Hand Purchases ---
  static async getPurchases(): Promise<SecondHandPurchase[]> {
    if (StorageService.memoryCache.has(STORAGE_KEYS.SECOND_HAND_PURCHASES)) {
      return StorageService.memoryCache.get(STORAGE_KEYS.SECOND_HAND_PURCHASES);
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SECOND_HAND_PURCHASES);
    const purchases = data ? JSON.parse(data) : [];
    StorageService.memoryCache.set(STORAGE_KEYS.SECOND_HAND_PURCHASES, purchases);
    return purchases;
  }

  static async savePurchase(purchase: SecondHandPurchase): Promise<void> {
    return this.withLock(STORAGE_KEYS.SECOND_HAND_PURCHASES, async () => {
      const existing = StorageService.memoryCache.has(STORAGE_KEYS.SECOND_HAND_PURCHASES)
        ? StorageService.memoryCache.get(STORAGE_KEYS.SECOND_HAND_PURCHASES)
        : await this.getPurchases();
      const list = [...existing];
      const idx = list.findIndex(p => p.id === purchase.id);
      if (idx >= 0) {
        list[idx] = purchase;
      } else {
        list.unshift(purchase);
      }
      StorageService.memoryCache.set(STORAGE_KEYS.SECOND_HAND_PURCHASES, list);
      try {
        await AsyncStorage.setItem(STORAGE_KEYS.SECOND_HAND_PURCHASES, JSON.stringify(list));
      } catch (diskErr) {
        console.warn('[StorageService] Disk write deferred for purchase:', diskErr);
      }

      // Data Isolation: Parent purchase document contains ONLY inventory & resale fields
      // Strictly aligned with Firestore rules isValidSecondHandPurchase(data)
      const parentInventoryDoc = {
        id: purchase.id,
        brand: purchase.brand,
        model: purchase.model,
        ram: purchase.ram || '',
        storage: purchase.storage || '',
        imei: purchase.imei,
        condition: purchase.condition,
        purchaseAmount: purchase.purchaseAmount,
        purchaseDate: purchase.purchaseDate,
        purchaseTime: purchase.purchaseTime,
        purchasedByStaffId: purchase.purchasedByStaffId,
        purchasedByStaffName: purchase.purchasedByStaffName,
        status: purchase.status,
        notes: purchase.notes || '',
        hasSensitiveKyc: true,
        _syncedAt: new Date().toISOString(),
      };
      FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, purchase.id, parentInventoryDoc).catch(err => {
        console.warn('[StorageService] Error syncing purchase parent inventory:', err);
      });

      // Sensitive customer identity, Aadhaar, inspection photos, and digital signature stored in Admin-only subcollection
      if (purchase.customerName || purchase.aadhaarNumber || purchase.digitalSignatureUri || (purchase.deviceInspectionPhotos && purchase.deviceInspectionPhotos.length > 0) || (purchase.devicePhotos && purchase.devicePhotos.length > 0)) {
        const inspectionPhotos = purchase.deviceInspectionPhotos || purchase.devicePhotos || [];
        const customerPhotoValue = inspectionPhotos.length > 0
          ? JSON.stringify(inspectionPhotos)
          : (purchase.customerPhotoUri || '');

        const kycDoc = {
          id: 'record',
          purchaseId: purchase.id,
          customerName: purchase.customerName || '',
          phone: purchase.phone || '',
          alternatePhone: purchase.alternatePhone || '',
          address: purchase.address || '',
          aadhaarNumber: purchase.aadhaarNumber || '',
          aadhaarFrontUri: purchase.aadhaarFrontUri || '',
          aadhaarBackUri: purchase.aadhaarBackUri || '',
          aadhaarPhotoFront: purchase.aadhaarPhotoFront || '',
          aadhaarPhotoBack: purchase.aadhaarPhotoBack || '',
          aadhaarCardPhotoUri: purchase.aadhaarCardPhotoUri || '',
          customerPhotoUri: customerPhotoValue,
          digitalSignatureUri: purchase.digitalSignatureUri || '',
          billImageUri: purchase.billImageUri || '',
          recordedByStaffId: purchase.purchasedByStaffId,
          recordedByStaffName: purchase.purchasedByStaffName,
          createdAt: new Date().toISOString(),
          _syncedAt: new Date().toISOString(),
        };
        FirestoreSyncService.syncDocument(
          `${FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES}/${purchase.id}/kyc_sensitive`,
          'record',
          kycDoc
        ).catch(err => {
          console.warn('[StorageService] Error syncing purchase kyc_sensitive:', err);
        });
      }
    });
  }

  // --- Second-Hand Sales ---
  static async getSales(): Promise<SecondHandSale[]> {
    if (StorageService.memoryCache.has(STORAGE_KEYS.SECOND_HAND_SALES)) {
      return StorageService.memoryCache.get(STORAGE_KEYS.SECOND_HAND_SALES);
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SECOND_HAND_SALES);
    const sales = data ? JSON.parse(data) : [];
    StorageService.memoryCache.set(STORAGE_KEYS.SECOND_HAND_SALES, sales);
    return sales;
  }

  static async saveSale(sale: SecondHandSale): Promise<void> {
    const list = await this.getSales();
    const idx = list.findIndex(s => s.id === sale.id);
    if (idx >= 0) {
      list[idx] = sale;
    } else {
      list.unshift(sale);
    }
    StorageService.memoryCache.set(STORAGE_KEYS.SECOND_HAND_SALES, list);
    await AsyncStorage.setItem(STORAGE_KEYS.SECOND_HAND_SALES, JSON.stringify(list));

    // Data Isolation: Parent sales document contains ONLY sales, warranty & invoice fields.
    // Sensitive buyer Aadhaar numbers and identity proofs are isolated into an Admin-only subcollection.
    const parentSaleDoc = {
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
      hasSensitiveKyc: !!sale.aadhaarNumber,
      _syncedAt: new Date().toISOString(),
    };
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.SECOND_HAND_SALES, sale.id, parentSaleDoc).catch(() => {});

    // Sensitive buyer KYC subcollection (Admin-only read)
    if (sale.aadhaarNumber || sale.buyerPhotoUri || sale.aadhaarPhotoUri) {
      const kycDoc = {
        id: 'record',
        saleId: sale.id,
        buyerName: sale.buyerName,
        phone: sale.phone,
        alternatePhone: sale.alternatePhone || '',
        address: sale.address,
        aadhaarNumber: sale.aadhaarNumber || '',
        aadhaarPhotoUri: sale.aadhaarPhotoUri || '',
        buyerPhotoUri: sale.buyerPhotoUri || '',
        digitalSignatureUri: sale.digitalSignatureUri || '',
        recordedByStaffId: sale.soldByStaffId,
        recordedByStaffName: sale.soldByStaffName,
        recordedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        _syncedAt: new Date().toISOString(),
      };
      FirestoreSyncService.syncDocument(
        `${FIRESTORE_COLLECTIONS.SECOND_HAND_SALES}/${sale.id}/kyc_sensitive`,
        'record',
        kycDoc
      ).catch(() => {});
    }

    // Update purchase record status to 'sold' if linked
    if (sale.purchaseRecordId) {
      const purchases = await this.getPurchases();
      const pIdx = purchases.findIndex(p => p.id === sale.purchaseRecordId);
      if (pIdx >= 0) {
        purchases[pIdx].status = 'sold';
        await AsyncStorage.setItem(STORAGE_KEYS.SECOND_HAND_PURCHASES, JSON.stringify(purchases));
        FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, purchases[pIdx].id, purchases[pIdx]).catch(() => {});
      }
    }
  }

  // --- Sales Targets & Incentives ---
  static async getSalesTargets(monthKey?: string): Promise<SalesTarget[]> {
    let targets: SalesTarget[];
    if (StorageService.memoryCache.has(STORAGE_KEYS.SALES_TARGETS)) {
      targets = StorageService.memoryCache.get(STORAGE_KEYS.SALES_TARGETS);
    } else {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.SALES_TARGETS);
      targets = data ? JSON.parse(data) : [];
      StorageService.memoryCache.set(STORAGE_KEYS.SALES_TARGETS, targets);
    }
    if (monthKey) {
      return targets.filter(t => t.month === monthKey);
    }
    return targets;
  }

  static async saveSalesTarget(target: SalesTarget): Promise<void> {
    const list = await this.getSalesTargets();
    const idx = list.findIndex(t => t.id === target.id);
    if (idx >= 0) {
      list[idx] = target;
    } else {
      list.unshift(target);
    }
    StorageService.memoryCache.set(STORAGE_KEYS.SALES_TARGETS, list);
    await AsyncStorage.setItem(STORAGE_KEYS.SALES_TARGETS, JSON.stringify(list));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.SALES_TARGETS, target.id, target).catch(() => {});
  }

  // --- Notifications ---
  static async getNotifications(): Promise<AppNotification[]> {
    if (StorageService.memoryCache.has(STORAGE_KEYS.NOTIFICATIONS)) {
      return StorageService.memoryCache.get(STORAGE_KEYS.NOTIFICATIONS);
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    const list = data ? JSON.parse(data) : [];
    StorageService.memoryCache.set(STORAGE_KEYS.NOTIFICATIONS, list);
    return list;
  }

  static async addNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read' | 'userId'> & { userId?: string }): Promise<void> {
    const list = await this.getNotifications();
    let targetUserId = notif.userId;
    if (!targetUserId) {
      const user = await this.getCurrentUser();
      targetUserId = user?.id || 'staff';
    }
    const newItem: AppNotification = {
      ...notif,
      id: (notif as any).id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      userId: targetUserId,
      timestamp: new Date().toISOString(),
      read: false,
    };
    list.unshift(newItem);
    StorageService.memoryCache.set(STORAGE_KEYS.NOTIFICATIONS, list);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));

    // Only sync legitimate client workflow notifications permitted by Firestore rules.
    // Client-reported attendance reminders remain local to prevent forging attendance notifications in Firestore.
    if (['lead', 'purchase', 'sale', 'task', 'follow_up'].includes(newItem.type)) {
      FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.NOTIFICATIONS, newItem.id, newItem).catch(() => {});
    }
  }

  static async getReadNotificationIds(userId?: string): Promise<Set<string>> {
    try {
      let uid = userId;
      if (!uid) {
        const user = await this.getCurrentUser();
        uid = user?.id || 'default_user';
      }
      const key = `${STORAGE_KEYS.NOTIFICATIONS}_read_ids_${uid}`;
      const cached = StorageService.memoryCache.get(key);
      if (cached && Array.isArray(cached)) {
        return new Set<string>(cached);
      }
      const raw = await AsyncStorage.getItem(key);
      if (!raw) return new Set<string>();
      const arr = JSON.parse(raw);
      const set = new Set<string>(Array.isArray(arr) ? arr : []);
      StorageService.memoryCache.set(key, Array.from(set));
      return set;
    } catch {
      return new Set<string>();
    }
  }

  static async saveReadNotificationIds(readIds: Set<string>, userId?: string): Promise<void> {
    try {
      let uid = userId;
      if (!uid) {
        const user = await this.getCurrentUser();
        uid = user?.id || 'default_user';
      }
      const key = `${STORAGE_KEYS.NOTIFICATIONS}_read_ids_${uid}`;
      const arr = Array.from(readIds);
      StorageService.memoryCache.set(key, arr);
      await AsyncStorage.setItem(key, JSON.stringify(arr));
    } catch (e) {
      console.warn('[StorageService] Error saving read notification IDs:', e);
    }
  }

  static async markNotificationRead(id: string): Promise<void> {
    const user = await this.getCurrentUser();
    const uid = user?.id || 'default_user';
    const readIds = await this.getReadNotificationIds(uid);
    readIds.add(id);
    await this.saveReadNotificationIds(readIds, uid);

    const list = await this.getNotifications();
    const idx = list.findIndex(n => n.id === id);
    if (idx >= 0) {
      list[idx].read = true;
      list[idx].updatedAt = new Date().toISOString();
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
      StorageService.memoryCache.set(STORAGE_KEYS.NOTIFICATIONS, list);

      // Do NOT modify shared Firestore notification documents when a staff member reads a broadcast or announcement.
      // Only personal workflow alerts (leads, purchases, sales, tasks, follow-ups) addressed directly to the user are synced.
      if (
        list[idx].userId === uid &&
        ['lead', 'purchase', 'sale', 'task', 'follow_up'].includes(list[idx].type)
      ) {
        FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.NOTIFICATIONS, id, list[idx]).catch(() => {});
      }
    }
  }

  static async markAllNotificationsRead(): Promise<void> {
    const user = await this.getCurrentUser();
    const uid = user?.id || 'default_user';
    const readIds = await this.getReadNotificationIds(uid);

    const list = await this.getNotifications();
    const nowIso = new Date().toISOString();
    const updated = list.map(n => {
      readIds.add(n.id);
      return { ...n, read: true, updatedAt: nowIso };
    });

    await this.saveReadNotificationIds(readIds, uid);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(updated));
    StorageService.memoryCache.set(STORAGE_KEYS.NOTIFICATIONS, updated);

    // Only sync personal workflow alerts belonging to the current user
    for (const item of updated.filter(n => n.userId === uid && ['lead', 'purchase', 'sale', 'task', 'follow_up'].includes(n.type))) {
      FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.NOTIFICATIONS, item.id, item).catch(() => {});
    }
  }

  static async deleteNotification(id: string): Promise<void> {
    const list = await this.getNotifications();
    const filtered = list.filter(n => n.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(filtered));
    StorageService.memoryCache.set(STORAGE_KEYS.NOTIFICATIONS, filtered);

    const user = await this.getCurrentUser();
    const uid = user?.id || 'default_user';
    const readIds = await this.getReadNotificationIds(uid);
    if (readIds.has(id)) {
      readIds.delete(id);
      await this.saveReadNotificationIds(readIds, uid);
    }
  }

  // --- Salary Slips ---
  static async getSalarySlips(): Promise<SalarySlip[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SALARY_SLIPS);
    return data ? JSON.parse(data) : [];
  }

  static async saveSalarySlip(slip: SalarySlip): Promise<void> {
    const list = await this.getSalarySlips();
    const idx = list.findIndex(s => s.id === slip.id);
    if (idx >= 0) {
      list[idx] = slip;
    } else {
      list.unshift(slip);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.SALARY_SLIPS, JSON.stringify(list));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.SALARY_SLIPS, slip.id, slip).catch(() => {});
  }

  static async getSalarySlipForStaffAndMonth(staffId: string, monthKey: string): Promise<SalarySlip | null> {
    const list = await this.getSalarySlips();
    const found = list.find(s => s.staffId === staffId && s.monthKey === monthKey);
    return found || null;
  }

  // --- Face Biometric Templates ---
  static async getFaceTemplates(): Promise<FaceTemplate[]> {
    if (StorageService.memoryCache.has(STORAGE_KEYS.FACE_TEMPLATES)) {
      return StorageService.memoryCache.get(STORAGE_KEYS.FACE_TEMPLATES);
    }
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FACE_TEMPLATES);
    const list = data ? JSON.parse(data) : [];
    StorageService.memoryCache.set(STORAGE_KEYS.FACE_TEMPLATES, list);
    return list;
  }

  static async getFaceTemplate(userId: string): Promise<FaceTemplate | null> {
    const list = await this.getFaceTemplates();
    const found = list.find(t => t.userId === userId && t.status === 'active');
    return found || null;
  }

  static async getLatestFaceTemplate(userId: string): Promise<FaceTemplate | null> {
    const list = await this.getFaceTemplates();
    const userTemplates = list.filter(t => t.userId === userId);
    if (userTemplates.length === 0) return null;
    return userTemplates.sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime())[0];
  }

  static async getAllFaceTemplatesForUser(userId: string): Promise<FaceTemplate[]> {
    const list = await this.getFaceTemplates();
    return list
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.registeredAt).getTime() - new Date(a.registeredAt).getTime());
  }

  static async saveFaceTemplate(template: FaceTemplate): Promise<void> {
    // Synchronize User record flag and reconcile stale metadata with existing approved user profile
    const users = await this.getAllUsers();
    const userIdx = users.findIndex(u => u.id === template.userId);
    if (userIdx >= 0) {
      const user = users[userIdx];
      // Guard against stale pending metadata overwriting approved status,
      // EXCEPT when template is explicitly in pending_recovery waiting for Admin re-verification:
      const isRecoveryPending = template.approvalStatus === 'pending_recovery' || user.faceEnrollmentStatus === 'pending_recovery';
      const hasNewerAdminApproval = Boolean(
        user.faceApprovedAt &&
        new Date(user.faceApprovedAt).getTime() >= new Date(template.registeredAt).getTime()
      );

      if (!isRecoveryPending && user.faceEnrollmentStatus === 'approved' && template.approvalStatus !== 'approved') {
        template.approvalStatus = 'approved';
        template.approvedAt = user.faceApprovedAt || template.approvedAt || new Date().toISOString();
        template.approvedByAdminName = user.faceApprovedBy || template.approvedByAdminName || 'Admin';
      }

      if (isRecoveryPending && !hasNewerAdminApproval) {
        template.approvalStatus = 'pending_recovery';
        users[userIdx].hasFaceRegistered = false;
        users[userIdx].faceEnrollmentStatus = 'pending_recovery';
      } else {
        const isApproved = (template.status === 'active' && template.approvalStatus === 'approved') || (user.faceEnrollmentStatus === 'approved' && hasNewerAdminApproval);
        users[userIdx].hasFaceRegistered = isApproved;
        users[userIdx].faceRegistrationDate = template.registeredAt;
        if (template.approvalStatus === 'approved') {
          users[userIdx].faceEnrollmentStatus = 'approved';
        } else {
          users[userIdx].faceEnrollmentStatus = template.approvalStatus
            ? (template.approvalStatus === 'pending' ? 'pending_approval' : template.approvalStatus)
            : (template.status === 'active' ? 'approved' : 'not_enrolled');
        }
      }
      if (template.approvedAt || user.faceApprovedAt) {
        users[userIdx].faceApprovedAt = template.approvedAt || user.faceApprovedAt;
      }
      if (template.approvedByAdminName || template.approvedByAdminId || user.faceApprovedBy) {
        users[userIdx].faceApprovedBy = template.approvedByAdminName || template.approvedByAdminId || user.faceApprovedBy;
      }
      if (template.rejectionReason) users[userIdx].faceRejectionReason = template.rejectionReason;
      await this.saveUser(users[userIdx]);
    }

    const list = await this.getFaceTemplates();
    const idx = list.findIndex(t => t.id === template.id || (t.userId === template.userId && t.status === 'active'));
    if (idx >= 0) {
      list[idx] = template;
    } else {
      list.push(template);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.FACE_TEMPLATES, JSON.stringify(list));
    StorageService.memoryCache.set(STORAGE_KEYS.FACE_TEMPLATES, list);
  }

  static async deleteFaceTemplate(userId: string, _deletedBy?: string): Promise<boolean> {
    const list = await this.getFaceTemplates();
    const filtered = list.filter(t => t.userId !== userId);
    if (filtered.length !== list.length) {
      await AsyncStorage.setItem(STORAGE_KEYS.FACE_TEMPLATES, JSON.stringify(filtered));
      StorageService.memoryCache.set(STORAGE_KEYS.FACE_TEMPLATES, filtered);

      // Synchronize User record flag
      const users = await this.getAllUsers();
      const userIdx = users.findIndex(u => u.id === userId);
      if (userIdx >= 0) {
        users[userIdx].hasFaceRegistered = false;
        users[userIdx].faceRegistrationDate = undefined;
        users[userIdx].faceEnrollmentStatus = 'not_enrolled';
        await this.saveUser(users[userIdx]);
      }
      return true;
    }
    return false;
  }

  static async recordVerificationFailure(userId: string, reason: string): Promise<void> {
    const users = await this.getAllUsers();
    const userIdx = users.findIndex(u => u.id === userId);
    if (userIdx >= 0) {
      const attempts = (users[userIdx].failedVerificationAttempts || 0) + 1;
      users[userIdx].failedVerificationAttempts = attempts;
      users[userIdx].lastFailedVerificationReason = reason;
      users[userIdx].lastFailedVerificationAt = new Date().toISOString();
      await this.saveUser(users[userIdx]);
    }
  }

  static async resetVerificationFailures(userId: string): Promise<void> {
    const users = await this.getAllUsers();
    const userIdx = users.findIndex(u => u.id === userId);
    if (userIdx >= 0 && (users[userIdx].failedVerificationAttempts || 0) > 0) {
      users[userIdx].failedVerificationAttempts = 0;
      await this.saveUser(users[userIdx]);
    }
  }

  static async updateAttendanceRecord(updatedRecord: AttendanceRecord): Promise<void> {
    const records = await this.getAttendanceRecords();
    const idx = records.findIndex(r => r.id === updatedRecord.id);
    if (idx >= 0) {
      records[idx] = updatedRecord;
    } else {
      records.push(updatedRecord);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
  }

  // --- Attendance Audit Logs ---
  static async getAttendanceAuditLogs(): Promise<AttendanceAuditLog[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE_AUDIT_LOGS);
    return data ? JSON.parse(data) : [];
  }

  static async addAttendanceAuditLog(
    log: Omit<AttendanceAuditLog, 'id' | 'timestamp'>
  ): Promise<AttendanceAuditLog> {
    const logs = await this.getAttendanceAuditLogs();
    const newLog: AttendanceAuditLog = {
      ...log,
      id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newLog);
    const trimmed = logs.slice(0, 500);
    await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE_AUDIT_LOGS, JSON.stringify(trimmed));
    return newLog;
  }

  // --- Admin Activity Audit Logs (Append-Only) ---
  static async getAdminAuditLogs(): Promise<AdminAuditEntry[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ADMIN_AUDIT_LOGS);
    return data ? JSON.parse(data) : [];
  }

  static async addAdminAuditLog(
    entry: Omit<AdminAuditEntry, 'id' | 'timestamp'> & { timestamp?: string }
  ): Promise<AdminAuditEntry> {
    const logs = await this.getAdminAuditLogs();
    const newEntry: AdminAuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
    };
    logs.unshift(newEntry);
    const trimmed = logs.slice(0, 1000); // Retain latest 1000 admin actions locally
    await AsyncStorage.setItem(STORAGE_KEYS.ADMIN_AUDIT_LOGS, JSON.stringify(trimmed));
    return newEntry;
  }

  // --- Verification Token Replay Protection ---
  static async isTokenConsumed(tokenId: string): Promise<boolean> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USED_TOKENS);
    const set: string[] = data ? JSON.parse(data) : [];
    return set.includes(tokenId);
  }

  static async consumeVerificationToken(tokenId: string): Promise<void> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USED_TOKENS);
    const set: string[] = data ? JSON.parse(data) : [];
    if (!set.includes(tokenId)) {
      set.unshift(tokenId);
      const trimmed = set.slice(0, 200);
      await AsyncStorage.setItem(STORAGE_KEYS.USED_TOKENS, JSON.stringify(trimmed));
    }
  }

  // --- Device Change Requests ---
  static async getDeviceChangeRequests(): Promise<DeviceChangeRequest[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_CHANGE_REQUESTS);
    return data ? JSON.parse(data) : [];
  }

  static async saveDeviceChangeRequest(req: DeviceChangeRequest): Promise<void> {
    const list = await this.getDeviceChangeRequests();
    const idx = list.findIndex(r => r.id === req.id);
    if (idx >= 0) {
      list[idx] = req;
    } else {
      list.unshift(req);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_CHANGE_REQUESTS, JSON.stringify(list));
  }

  static async updateDeviceChangeRequestStatus(id: string, status: DeviceChangeRequest['status']): Promise<void> {
    const list = await this.getDeviceChangeRequests();
    const idx = list.findIndex(r => r.id === id);
    if (idx >= 0) {
      list[idx].status = status;
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_CHANGE_REQUESTS, JSON.stringify(list));
    }
  }

  // --- Persistent Hardware Identity Fallbacks ---
  static async getPersistentDeviceId(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PERSISTENT_DEVICE_ID);
    } catch {
      return null;
    }
  }

  static async setPersistentDeviceId(deviceId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PERSISTENT_DEVICE_ID, deviceId);
    } catch {
      // Ignored
    }
  }

  static async getPersistentDeviceModel(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.PERSISTENT_DEVICE_MODEL);
    } catch {
      return null;
    }
  }

  static async setPersistentDeviceModel(model: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.PERSISTENT_DEVICE_MODEL, model);
    } catch {
      // Ignored
    }
  }
}

