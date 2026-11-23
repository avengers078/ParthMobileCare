export type UserRole = 'admin' | 'staff';
export type LegacyUserRole = 'admin' | 'manager' | 'staff';

export type RegistrationStatus = 'pending' | 'approved' | 'rejected';

export type FaceEnrollmentStatus = 'not_enrolled' | 'pending_review' | 'pending_approval' | 'pending_recovery' | 'approved' | 'rejected';

export type BiometricEnrollmentState =
  | 'NOT_ENROLLED'
  | 'ENROLLMENT_PENDING'
  | 'APPROVED_TEMPLATE_AVAILABLE'
  | 'APPROVED_TEMPLATE_MISSING'
  | 'REJECTED'
  | 'ENROLLED_LOCALLY'
  | 'ENROLLMENT_PENDING_REVIEW'
  | 'RECOVERY_PENDING'
  | 'ENROLLED_AND_READY'
  | 'READY_FOR_VERIFICATION'
  | 'ENROLLMENT_DATA_MISSING'
  | 'APPROVED_BUT_TEMPLATE_MISSING'
  | 'ENROLLMENT_VERSION_MISMATCH'
  | 'VERSION_MISMATCH'
  | 'ENROLLMENT_REJECTED'
  | 'RE_ENROLLMENT_REQUIRED';

export interface BiometricStatusResult {
  state: BiometricEnrollmentState;
  lifecycleState?: 'NOT_ENROLLED' | 'ENROLLMENT_PENDING' | 'APPROVED_TEMPLATE_AVAILABLE' | 'APPROVED_TEMPLATE_MISSING' | 'REJECTED';
  detailedState?: BiometricEnrollmentState;
  canVerify: boolean;
  message: string;
  template?: FaceTemplate | null;
  modelVersion?: string;
  rejectionReason?: string;
  recoveryAction?: 'none' | 're_enroll_on_device' | 'contact_admin';
}

export type DeviceBindingStatus = 'unregistered' | 'pending_approval' | 'approved' | 'rejected';

export type DeviceChangeRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export type AuthStatus =
  | 'loading'
  | 'unauthenticated'
  | 'authenticated_unverified'
  | 'registration_incomplete'
  | 'face_enrollment_pending'
  | 'approval_pending'
  | 'approved_staff'
  | 'rejected'
  | 'inactive'
  | 'unauthorized_role'
  | 'error';

export interface StaffRegistrationDraft {
  uid: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  step: 'details' | 'verify_email' | 'face_enrollment' | 'submitting';
  emailVerified: boolean;
  sampleCount?: number;
  registeredAt: string;
}

export interface StaffDeviceInfo {
  installationId: string;
  publicKey: string;
  keyAlgorithm: string;
  platform: 'android' | 'ios';
  model: string;
  appVersion: string;
  isHardwareBacked: boolean;
}

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
  faceEnrollmentStatus?: FaceEnrollmentStatus;
  faceApprovedAt?: string;
  faceApprovedBy?: string;
  faceRejectionReason?: string;
  failedVerificationAttempts?: number;
  lastFailedVerificationReason?: string;
  lastFailedVerificationAt?: string;
  createdBy?: string;
  createdAt?: string;
  passwordSetupStatus?: 'pending' | 'completed';
  invitationToken?: string;
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

export type AttendanceStatus = 'present' | 'late' | 'half_day' | 'early_exit' | 'absent';

export interface GeoPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  isMocked?: boolean;
  timestamp?: number;
  isCached?: boolean;
  isPrecise?: boolean;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  date: string; // YYYY-MM-DD
  timestamp?: string; // ISO 8601 UTC timestamp
  punchInTime?: string; // HH:mm:ss
  punchInCoords?: {
    latitude: number;
    longitude: number;
    distanceMeters: number;
    accuracyMeters?: number;
    timestamp?: string;
    isMocked?: boolean;
  };
  punchOutTime?: string; // HH:mm:ss
  punchOutCoords?: {
    latitude: number;
    longitude: number;
    distanceMeters: number;
    accuracyMeters?: number;
    timestamp?: string;
    isMocked?: boolean;
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
  deviceId?: string;
}

export type FaceApprovalStatus = 'pending' | 'approved' | 'rejected' | 'pending_recovery';

export interface FaceDeviceInfo {
  platform: string;
  model?: string;
  appVersion?: string;
  enrolledAt: string;
}

export interface FaceTemplate {
  id: string;
  userId: string;
  userName: string;
  faceDescriptor: number[]; // 128-dimensional biometric embedding vector
  qualityScore: number; // 0.0 - 1.0
  registeredAt: string; // ISO string
  registeredBy: string; // Admin / Manager / Self user ID
  consentObtained: boolean;
  consentTimestamp: string;
  templateHash: string; // Integrity check
  sampleCount: number; // Number of training frames sampled
  status: 'active' | 'revoked' | 'superseded';
  approvalStatus?: FaceApprovalStatus;
  approvedByAdminId?: string;
  approvedByAdminName?: string;
  approvedAt?: string;
  rejectionReason?: string;
  deviceInfo?: FaceDeviceInfo;
  reEnrollmentCount?: number;
  supersededTemplateId?: string;
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
  action:
    | 'punch_in'
    | 'punch_out'
    | 'register_face'
    | 'revoke_face'
    | 'verification_failed'
    | 'enrollment_submitted'
    | 'enrollment_approved'
    | 'enrollment_rejected'
    | 're_enrollment'
    | 'attendance_corrected';
  status: 'success' | 'failed' | 'blocked';
  reason?: string;
  similarityScore?: number;
  livenessScore?: number;
  distanceMeters?: number;
  notes?: string;
  adminId?: string;
  adminName?: string;
  deviceInfo?: string;
  beforeStatus?: string;
  afterStatus?: string;
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
  assignedTo?: string;
  assignedToName?: string;
  createdAt: string;
  updatedAt: string;
  history: LeadHistoryItem[];
  inquiryPhotos?: string[]; // Cloudinary secure URLs of customer repair inquiry / device damage
  repairPhotos?: string[];
  _syncPending?: boolean;
  _syncedAt?: string;
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

export interface SecondHandKycRecord {
  id: string;
  purchaseId: string;
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
  digitalSignatureUri: string;
  billImageUri?: string;
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
  devicePhotos?: string[]; // Cloudinary secure URLs of device inspection photos (front, back, screen, ports)
  deviceInspectionPhotos?: string[];
  billImageUri?: string;
  digitalSignatureUri?: string;
  purchaseDate: string; // YYYY-MM-DD
  purchaseTime: string; // HH:mm:ss
  purchasedByStaffId: string;
  purchasedByStaffName: string;
  status: 'in_stock' | 'sold';
  notes?: string;
  hasSensitiveKyc?: boolean;
  _syncedAt?: string;
}

export interface SecondHandSale {
  id: string;
  purchaseRecordId?: string;
  buyerName: string;
  phone: string;
  alternatePhone?: string;
  address: string;
  aadhaarNumber?: string;
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
  hasSensitiveKyc?: boolean;
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
  aadhaarPhotoUri?: string;
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
  paymentDate?: string;
  paymentMethod?: 'Cash' | 'UPI' | 'Bank Transfer';
  paymentReference?: string;
  paymentNotes?: string;
  paidByAdminId?: string;
  paidByAdminName?: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'follow_up' | 'attendance' | 'lead' | 'purchase' | 'sale' | 'target' | 'announcement';
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

export type AdminAuditActionType =
  | 'staff_create'
  | 'staff_edit'
  | 'staff_activate'
  | 'staff_deactivate'
  | 'staff_bulk_action'
  | 'attendance_correction'
  | 'salary_update'
  | 'salary_payment_confirmed'
  | 'price_update'
  | 'price_create'
  | 'purchase_create'
  | 'purchase_update'
  | 'sale_create'
  | 'sale_update'
  | 'lead_create'
  | 'lead_update'
  | 'lead_status_change'
  | 'kyc_document_access'
  | 'kyc_document_download'
  | 'settings_update'
  | 'enrollment_approve'
  | 'enrollment_reject'
  | 'face_re_enrollment';

export interface AdminAuditEntry {
  id: string;
  adminId: string;
  adminName: string;
  actionType: AdminAuditActionType | string;
  targetRecordId: string;
  targetRecordTitle?: string;
  timestamp: string; // ISO 8601
  details?: string;
  beforeValue?: Record<string, any>;
  afterValue?: Record<string, any>;
}

export type ReportDateRange = 'today' | 'this_week' | 'this_month' | 'last_month' | 'custom';

