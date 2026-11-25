export type UserRole = 'admin' | 'staff';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export type DeviceBindingStatus = 'unregistered' | 'pending_approval' | 'approved' | 'rejected';

export type DeviceChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface DeviceChangeRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  currentDeviceId?: string;
  currentDeviceModel?: string;
  newDeviceId: string;
  newDevicePublicKey: string;
  newDeviceModel: string;
  newDevicePlatform: string;
  reason: string;
  status: DeviceChangeRequestStatus;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  reviewedByName?: string;
  rejectionReason?: string;
  _syncedAt?: string;
}

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
  faceEnrollmentStatus?: 'unregistered' | 'not_enrolled' | 'pending_review' | 'pending' | 'pending_approval' | 'pending_recovery' | 'approved' | 'rejected';
  faceApprovedAt?: string;
  faceApprovedBy?: string;
  faceRejectionReason?: string;
  deviceId?: string;
  devicePublicKey?: string;
  deviceModel?: string;
  devicePlatform?: string;
  deviceBindingStatus?: DeviceBindingStatus;
  deviceRegisteredAt?: string;
  deviceApprovedAt?: string;
  deviceApprovedBy?: string;
  deviceRejectionReason?: string;
  registrationStatus?: RegistrationStatus;
  emailVerified?: boolean;
  faceModelVersion?: string;
  approvedAt?: string;
  approvedBy?: string;
  approvedByName?: string;
  rejectedAt?: string;
  rejectedBy?: string;
  rejectedByName?: string;
  rejectionReason?: string;
  createdAt?: string;
  createdBy?: string;
  _syncedAt?: string;
}

export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'early_exit' | 'absent';

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  date: string; // YYYY-MM-DD
  timestamp?: string;
  punchInTime?: string;
  punchInCoords?: {
    latitude: number;
    longitude: number;
    distanceMeters: number;
    accuracyMeters?: number;
    isMocked?: boolean;
  };
  punchOutTime?: string;
  punchOutCoords?: {
    latitude: number;
    longitude: number;
    distanceMeters: number;
    accuracyMeters?: number;
    isMocked?: boolean;
  };
  status: AttendanceStatus;
  totalHours: number;
  isLate: boolean;
  isEarlyExit: boolean;
  notes?: string;
  verificationMethod?: 'face_recognition' | 'manual_override';
  faceVerificationScore?: number;
  deviceId?: string;
  isCorrected?: boolean;
  correctionReason?: string;
}

export interface ShopConfig {
  shopName: string;
  tagline: string;
  shopAddress: string;
  phone: string;
  alternatePhone: string;
  email: string;
  gstNumber: string;
  latitude: number;
  longitude: number;
  allowedRadiusMeters: number;
  openingTime: string;
  closingTime: string;
  _syncedAt?: string;
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
  followUpDate?: string;
  followUpTime?: string;
  createdBy: string;
  createdByName: string;
  assignedTo?: string;
  assignedToName?: string;
  createdAt: string;
  updatedAt: string;
  history: LeadHistoryItem[];
  inquiryPhotos?: string[];
  repairPhotos?: string[];
}

export interface PriceHistoryItem {
  date: string;
  purchasePrice: number;
  sellingPrice: number;
  updatedBy: string;
}

export interface MobilePriceItem {
  id: string;
  brand: string;
  model: string;
  ram: string;
  storage: string;
  purchasePrice: number;
  sellingPrice: number;
  inStock?: boolean;
  updatedAt: string;
  priceHistory: PriceHistoryItem[];
}

export interface SecondHandKycRecord {
  id: string;
  purchaseId: string;
  customerName: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  aadhaarNumber: string;
  rawAadhaarNumber?: string;
  aadhaarFrontUri?: string;
  aadhaarBackUri?: string;
  aadhaarFrontPublicId?: string;
  aadhaarBackPublicId?: string;
  customerPhotoUri?: string;
  billImageUri?: string;
  digitalSignatureUri: string;
  recordedByStaffId: string;
  recordedByStaffName: string;
  createdAt: string;
  _syncedAt?: string;
}

export interface SecondHandPurchase {
  id: string;
  customerName?: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  aadhaarNumber?: string;
  rawAadhaarNumber?: string;
  aadhaarFrontUri?: string;
  aadhaarBackUri?: string;
  aadhaarFrontPublicId?: string;
  aadhaarBackPublicId?: string;
  customerPhotoUri?: string;
  brand: string;
  model: string;
  ram?: string;
  storage?: string;
  imei: string;
  condition: string;
  purchaseAmount: number;
  devicePhotos?: string[];
  deviceInspectionPhotos?: string[];
  billImageUri?: string;
  digitalSignatureUri?: string;
  purchaseDate: string;
  purchaseTime: string;
  purchasedByStaffId: string;
  purchasedByStaffName: string;
  status: 'in_stock' | 'sold';
  notes?: string;
  hasSensitiveKyc?: boolean;
  kyc?: SecondHandKycRecord;
}

export interface SecondHandSale {
  id: string;
  purchaseRecordId?: string;
  buyerName: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  aadhaarNumber?: string;
  rawAadhaarNumber?: string;
  aadhaarPhotoUri?: string;
  aadhaarPhotoPublicId?: string;
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
  saleDate: string;
  saleTime: string;
  soldByStaffId: string;
  soldByStaffName: string;
  paymentMethod: 'Cash' | 'UPI' | 'Card' | 'Bank Transfer';
  warrantyMonths?: number;
  notes?: string;
  hasSensitiveKyc?: boolean;
  kyc?: SecondHandSaleKycRecord;
  _syncedAt?: string;
}

export interface SecondHandSaleKycRecord {
  id: string;
  saleId: string;
  buyerName: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  aadhaarNumber: string;
  rawAadhaarNumber?: string;
  aadhaarPhotoUri?: string;
  aadhaarPhotoPublicId?: string;
  buyerPhotoUri?: string;
  digitalSignatureUri?: string;
  recordedByStaffId: string;
  recordedByStaffName: string;
  recordedAt?: string;
  createdAt?: string;
  _syncedAt?: string;
}

export interface SalesTarget {
  id: string;
  staffId: string;
  staffName: string;
  month: string;
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
  month: string;
  monthKey: string;
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
  paidDate?: string;
  paymentMethod?: string;
  transactionRef?: string;
}

export interface AppNotification {
  id: string;
  userId?: string;
  title: string;
  body: string;
  type: 'follow_up' | 'attendance' | 'lead' | 'purchase' | 'sale' | 'target' | 'salary' | 'announcement' | 'staff_registration' | 'device_binding' | 'face_enrollment';
  priority?: 'normal' | 'high' | 'urgent';
  timestamp: string;
  read: boolean;
  relatedId?: string;
  createdBy?: string;
  authorName?: string;
  status?: 'published' | 'draft' | 'scheduled' | 'archived';
  startDate?: string;
  expiryDate?: string;
  targetAudience?: 'all' | 'specific_staff';
  targetStaffIds?: string[];
  readBy?: string[];
  updatedAt?: string;
  _syncedAt?: string;
}

export interface StaffInvitation {
  id: string;
  token: string;
  name: string;
  email: string;
  phone: string;
  role: 'staff';
  designation: string;
  basicSalary: number;
  monthlyTarget: number;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'revoked' | 'expired';
  acceptedAt?: string;
  acceptedByUid?: string;
}

export interface AdminAuditEntry {
  id: string;
  adminId: string;
  adminName: string;
  actionType: string;
  targetRecordId: string;
  targetRecordTitle?: string;
  timestamp: string;
  details?: string;
  beforeValue?: any;
  afterValue?: any;
}

