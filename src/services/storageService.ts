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

  // --- User Session ---
  static async getCurrentUser(): Promise<User | null> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CURRENT_USER);
    return data ? JSON.parse(data) : null;
  }

  static async setCurrentUser(user: User | null): Promise<void> {
    if (user) {
      await AsyncStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
    }
  }

  static async getAllUsers(): Promise<User[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.USERS_LIST);
    return data ? JSON.parse(data) : [];
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
      const config = remoteRecords[0];
      if (config) {
        const shopConfig = { ...config };
        delete shopConfig.id;
        await AsyncStorage.setItem(STORAGE_KEYS.SHOP_CONFIG, JSON.stringify(shopConfig));
      }
      return;
    }

    const storageKey = keys[collectionName];
    if (!storageKey) return;
    const cachedText = await AsyncStorage.getItem(storageKey);
    // Firebase Auth account IDs are canonical; old locally seeded/demo user IDs
    // must not be treated as provisioned cloud accounts or uploaded later.
    const cached: any[] = collectionName === FIRESTORE_COLLECTIONS.USERS
      ? []
      : cachedText ? JSON.parse(cachedText) : [];
    const merged = new Map<string, any>();
    cached.forEach(item => item?.id && merged.set(item.id, item));
    // Remote data wins for matching IDs; local-only records are retained for offline migration.
    remoteRecords.forEach(item => item?.id && merged.set(item.id, { ...merged.get(item.id), ...item }));
    await AsyncStorage.setItem(storageKey, JSON.stringify(Array.from(merged.values())));
  }

  static async saveUser(user: User): Promise<void> {
    const users = await this.getAllUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) {
      users[idx] = user;
    } else {
      users.push(user);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.USERS_LIST, JSON.stringify(users));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.USERS, user.id, user).catch(() => {});
  }

  // --- Shop Config ---
  static async getShopConfig(): Promise<ShopConfig> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SHOP_CONFIG);
    return data ? JSON.parse(data) : DEFAULT_SHOP_CONFIG;
  }

  static async saveShopConfig(config: ShopConfig): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.SHOP_CONFIG, JSON.stringify(config));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.SHOP_CONFIG, 'main_store', config).catch(() => {});
  }

  // --- Attendance ---
  static async getAttendanceRecords(userId?: string): Promise<AttendanceRecord[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.ATTENDANCE);
    const records: AttendanceRecord[] = data ? JSON.parse(data) : [];
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
    await AsyncStorage.setItem(STORAGE_KEYS.ATTENDANCE, JSON.stringify(records));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.ATTENDANCE, record.id, record).catch(() => {});
  }

  // --- Customer Leads ---
  static async getLeads(): Promise<CustomerLead[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.LEADS);
    return data ? JSON.parse(data) : [];
  }

  static async saveLead(lead: CustomerLead): Promise<void> {
    const leads = await this.getLeads();
    const idx = leads.findIndex(l => l.id === lead.id);
    if (idx >= 0) {
      leads[idx] = lead;
    } else {
      leads.unshift(lead);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.LEADS, lead.id, lead).catch(() => {});
  }

  /** Replace the local lead cache after a cloud pull without echoing writes back. */
  static async saveBulkLeads(leads: CustomerLead[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(leads));
  }

  static async deleteLead(id: string): Promise<void> {
    const leads = await this.getLeads();
    const filtered = leads.filter(l => l.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(filtered));
    FirestoreSyncService.deleteDocument(FIRESTORE_COLLECTIONS.LEADS, id).catch(() => {});
  }

  // --- Mobile Price List ---
  static async getPriceList(): Promise<MobilePriceItem[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PRICE_LIST);
    return data ? JSON.parse(data) : [];
  }

  static async savePriceItem(item: MobilePriceItem): Promise<void> {
    const list = await this.getPriceList();
    const idx = list.findIndex(p => p.id === item.id);
    if (idx >= 0) {
      list[idx] = item;
    } else {
      list.unshift(item);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.PRICE_LIST, JSON.stringify(list));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.MOBILE_PRICES, item.id, item).catch(() => {});
  }

  static async saveBulkPriceItems(items: MobilePriceItem[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PRICE_LIST, JSON.stringify(items));
    for (const item of items) {
      FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.MOBILE_PRICES, item.id, item).catch(() => {});
    }
  }

  static async deletePriceItem(id: string): Promise<void> {
    const list = await this.getPriceList();
    const filtered = list.filter(p => p.id !== id);
    await AsyncStorage.setItem(STORAGE_KEYS.PRICE_LIST, JSON.stringify(filtered));
    FirestoreSyncService.deleteDocument(FIRESTORE_COLLECTIONS.MOBILE_PRICES, id).catch(() => {});
  }

  // --- Second-Hand Purchases ---
  static async getPurchases(): Promise<SecondHandPurchase[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SECOND_HAND_PURCHASES);
    return data ? JSON.parse(data) : [];
  }

  static async savePurchase(purchase: SecondHandPurchase): Promise<void> {
    const list = await this.getPurchases();
    const idx = list.findIndex(p => p.id === purchase.id);
    if (idx >= 0) {
      list[idx] = purchase;
    } else {
      list.unshift(purchase);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.SECOND_HAND_PURCHASES, JSON.stringify(list));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.SECOND_HAND_PURCHASES, purchase.id, purchase).catch(() => {});
  }

  // --- Second-Hand Sales ---
  static async getSales(): Promise<SecondHandSale[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SECOND_HAND_SALES);
    return data ? JSON.parse(data) : [];
  }

  static async saveSale(sale: SecondHandSale): Promise<void> {
    const list = await this.getSales();
    const idx = list.findIndex(s => s.id === sale.id);
    if (idx >= 0) {
      list[idx] = sale;
    } else {
      list.unshift(sale);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.SECOND_HAND_SALES, JSON.stringify(list));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.SECOND_HAND_SALES, sale.id, sale).catch(() => {});

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
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SALES_TARGETS);
    const targets: SalesTarget[] = data ? JSON.parse(data) : [];
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
    await AsyncStorage.setItem(STORAGE_KEYS.SALES_TARGETS, JSON.stringify(list));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.SALES_TARGETS, target.id, target).catch(() => {});
  }

  // --- Notifications ---
  static async getNotifications(): Promise<AppNotification[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    return data ? JSON.parse(data) : [];
  }

  static async addNotification(notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>): Promise<void> {
    const list = await this.getNotifications();
    const newItem: AppNotification = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      read: false,
    };
    list.unshift(newItem);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
    FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.NOTIFICATIONS, newItem.id, newItem).catch(() => {});
  }

  static async markNotificationRead(id: string): Promise<void> {
    const list = await this.getNotifications();
    const idx = list.findIndex(n => n.id === id);
    if (idx >= 0) {
      list[idx].read = true;
      await AsyncStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(list));
      FirestoreSyncService.syncDocument(FIRESTORE_COLLECTIONS.NOTIFICATIONS, id, list[idx]).catch(() => {});
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
    const data = await AsyncStorage.getItem(STORAGE_KEYS.FACE_TEMPLATES);
    return data ? JSON.parse(data) : [];
  }

  static async getFaceTemplate(userId: string): Promise<FaceTemplate | null> {
    const list = await this.getFaceTemplates();
    const found = list.find(t => t.userId === userId && t.status === 'active');
    return found || null;
  }

  static async saveFaceTemplate(template: FaceTemplate): Promise<void> {
    const list = await this.getFaceTemplates();
    const idx = list.findIndex(t => t.userId === template.userId);
    if (idx >= 0) {
      list[idx] = template;
    } else {
      list.push(template);
    }
    await AsyncStorage.setItem(STORAGE_KEYS.FACE_TEMPLATES, JSON.stringify(list));

    // Synchronize User record flag
    const users = await this.getAllUsers();
    const userIdx = users.findIndex(u => u.id === template.userId);
    if (userIdx >= 0) {
      users[userIdx].hasFaceRegistered = template.status === 'active';
      users[userIdx].faceRegistrationDate = template.registeredAt;
      await this.saveUser(users[userIdx]);
    }
  }

  static async deleteFaceTemplate(userId: string, deletedBy?: string): Promise<boolean> {
    const list = await this.getFaceTemplates();
    const idx = list.findIndex(t => t.userId === userId);
    if (idx >= 0) {
      list.splice(idx, 1);
      await AsyncStorage.setItem(STORAGE_KEYS.FACE_TEMPLATES, JSON.stringify(list));

      // Synchronize User record flag
      const users = await this.getAllUsers();
      const userIdx = users.findIndex(u => u.id === userId);
      if (userIdx >= 0) {
        users[userIdx].hasFaceRegistered = false;
        users[userIdx].faceRegistrationDate = undefined;
        await this.saveUser(users[userIdx]);
      }
      return true;
    }
    return false;
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
}

