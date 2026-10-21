export type UserRole = 'admin' | 'manager' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  designation: string;
  avatarUrl?: string;
  joinedDate: string;
  basicSalary: number;
  monthlyTarget: number;
  isActive: boolean;
  hasFaceRegistered?: boolean;
  faceRegistrationDate?: string;
}

export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'early_exit' | 'absent';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  date: string; // YYYY-MM-DD
  punchInTime?: string; // HH:mm:ss
  punchInCoords?: {
    latitude: number;
    longitude: number;
    distanceMeters: number;
  };
  punchOutTime?: string; // HH:mm:ss
  punchOutCoords?: {
    latitude: number;
    longitude: number;
    distanceMeters: number;
  };
  status: AttendanceStatus;
  totalHours: number;
  isLate: boolean;
  isEarlyExit: boolean;
  notes?: string;
  verificationMethod?: 'face_recognition' | 'manual_override';
  faceVerificationScore?: number;
  faceLivenessScore?: number;
  faceVerificationTokenId?: string;
}

export interface FaceTemplate {
  id: string;
  userId: string;
  userName: string;
  faceDescriptor: number[]; // 128-dimensional biometric embedding vector
  qualityScore: number; // 0.0 - 1.0
  registeredAt: string; // ISO string
  registeredBy: string; // Admin / Manager user ID
  consentObtained: boolean;
  consentTimestamp: string;
  templateHash: string; // Integrity check
  sampleCount: number; // Number of training frames sampled
  status: 'active' | 'revoked';
}

export interface FaceVerificationToken {
  tokenId: string;
  userId: string;
  action: 'punch_in' | 'punch_out';
  timestamp: number; // ms
  similarityScore: number;
  livenessScore: number;
  challengesCompleted: string[];
  signature: string;
}

export interface AttendanceAuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: 'punch_in' | 'punch_out' | 'register_face' | 'revoke_face' | 'verification_failed';
  status: 'success' | 'failed' | 'blocked';
  reason?: string;
  similarityScore?: number;
  livenessScore?: number;
  distanceMeters?: number;
  notes?: string;
}

export interface ShopConfig {
  shopName: string;
  tagline: string;
  shopAddress: string;
  phone: string;
  alternatePhone: string;
  email: string;
  gstNumber: string;
  // Geo-Fencing
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number; // e.g. 30
  // Shop Hours
  openingTime: string; // "10:00" (24h or HH:mm)
  closingTime: string; // "21:00"
}

export type LeadStatus = 'new' | 'follow_up' | 'interested' | 'purchased' | 'lost';

export interface LeadHistoryItem {
  timestamp: string;
  updatedBy: string;
  status: LeadStatus;
  notes: string;
}

export interface CustomerLead {
  id: string;
  name: string;
  phone: string;
  alternatePhone?: string;
  interestedBrand: string;
  interestedModel: string;
  budget: number;
  remarks: string;
  status: LeadStatus;
  followUpDate?: string; // YYYY-MM-DD
  followUpTime?: string; // HH:mm
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
  history: LeadHistoryItem[];
}

export interface PriceHistoryItem {
  date: string;
  purchasePrice: number;
  sellingPrice: number;
  updatedBy: string;
}

export interface MobilePriceItem {
  id: string;
  brand: string; // Vivo, Oppo, Samsung, Apple, Xiaomi, Realme, OnePlus, etc.
  model: string;
  ram: string; // e.g. 8GB
  storage: string; // e.g. 128GB
  purchasePrice: number;
  sellingPrice: number;
  inStock?: boolean;
  updatedAt: string;
  priceHistory: PriceHistoryItem[];
}

export interface SecondHandPurchase {
  id: string;
  customerName: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  aadhaarNumber: string;
  aadhaarFrontUri?: string;
  aadhaarBackUri?: string;
  aadhaarPhotoFront?: string;
  aadhaarPhotoBack?: string;
  aadhaarCardPhotoUri?: string;
  customerPhotoUri?: string;
  brand: string;
  model: string;
  ram?: string;
  storage?: string;
  imei: string;
  condition: string; // Excellent, Good, Fair
  purchaseAmount: number;
  billImageUri?: string;
  digitalSignatureUri: string;
  purchaseDate: string; // YYYY-MM-DD
  purchaseTime: string; // HH:mm:ss
  purchasedByStaffId: string;
  purchasedByStaffName: string;
  status: 'in_stock' | 'sold';
  notes?: string;
}

export interface SecondHandSale {
  id: string;
  purchaseRecordId?: string;
  buyerName: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  aadhaarNumber: string;
  aadhaarPhotoUri?: string;
  buyerPhotoUri?: string;
  brand: string;
  model: string;
  ram?: string;
  storage?: string;
  imei: string;
  sellingAmount: number;
  purchaseAmount: number;
  profitAmount: number;
  marginPercent: number;
  invoiceNumber: string;
  digitalSignatureUri: string;
  saleDate: string; // YYYY-MM-DD
  saleTime: string; // HH:mm:ss
  soldByStaffId: string;
  soldByStaffName: string;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
  warrantyMonths?: number;
  notes?: string;
}

export interface SalesTarget {
  id: string;
  staffId: string;
  staffName: string;
  month: string; // YYYY-MM
  targetAmount: number;
  achievedAmount: number;
  targetUnits: number;
  achievedUnits: number;
  incentivePercent: number;
  calculatedIncentive: number;
}

export interface SalarySlip {
  id: string;
  staffId: string;
  staffName: string;
  designation: string;
  month: string; // e.g. "October 2026"
  monthKey: string; // "2026-10"
  basicSalary: number;
  salesIncentive: number;
  attendanceBonus: number;
  deductions: number;
  netSalary: number;
  totalWorkingDays: number;
  presentDays: number;
  lateDays: number;
  salesAchieved: number;
  generatedDate: string;
  isPaid: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: 'follow_up' | 'attendance' | 'lead' | 'purchase' | 'sale' | 'target';
  timestamp: string;
  read: boolean;
  relatedId?: string;
}
