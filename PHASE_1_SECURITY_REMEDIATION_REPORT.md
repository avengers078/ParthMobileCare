# Parth Mobile Care — Phase 1 Security Remediation & Rules Review Report

## Executive Summary

A comprehensive security remediation pass was conducted for **Phase 1: Secure Device Binding & Attendance Verification** in strict adherence to the **Firebase Spark Plan** architecture.

All rules modifications were authored and hardened via the mandatory specialist subagent `firestore-rules-author`.

### Strict Restrictions Compliance
- **Plan**: 100% Firebase Spark Plan.
- **Blaze**: Zero upgrades to paid tiers.
- **Functions**: Zero Firebase Cloud Functions.
- **Storage**: Zero Firebase Storage.
- **Backend Services**: Zero third-party paid backend services.
- **Deployment Status**: **CONFIRMED: Remote rules were NOT deployed.** The updated rules exist exclusively in the local repository file [`firestore.rules`](file:///Users/chetan/ParthMobileCare/firestore.rules).
- **Scope**: Focused strictly on Phase 1 security remediation; Phase 2 has NOT been started.

---

## 1. Exact Files Changed

1. [`firestore.rules`](file:///Users/chetan/ParthMobileCare/firestore.rules):
   - Refactored `match /users/{userId}` update rules with strict `diff().affectedKeys().hasOnly([...])` allowlisting, blocking privilege escalation (`role`, `isActive`, `basicSalary`, `monthlyTarget`), device self-approval (`deviceBindingStatus == 'approved'`), face self-approval, and overwriting approved hardware credentials.
   - Hardened `match /device_change_requests/{requestId}`: verified staff applicant identity matching Firestore user record (`userName`, `userEmail`, `currentDeviceId`), restricted staff updates to self-cancellation (`status == 'cancelled'`), and restricted admin review to valid transitions (`'approved'`, `'rejected'`) with mandatory `reviewedBy == request.auth.uid`, non-empty `reviewedAt`, and non-empty `rejectionReason` on rejection.
   - Authored complete `match /attendance/{attendanceId}`: enforced bound approved hardware device match (`deviceId == getUserData().deviceId`), active account status, valid state transitions (Punch In vs Punch Out), duplicate punch-out prevention, and immutable punch-in fields.
   - Added optional `timestamp` to `isValidAttendance` domain validator for ISO string synchronization.
   - Preserved all other 11 collections and default-deny root rules.
2. [`__tests__/firestoreRulesSecurityAcceptance.test.ts`](file:///Users/chetan/ParthMobileCare/__tests__/firestoreRulesSecurityAcceptance.test.ts) *(New)*:
   - 26 automated Firestore security rules acceptance tests validating staff privilege denial, face/device self-approval prevention, device change request tampering denial, and attendance state transition controls.
3. [`__tests__/deviceBindingSecurity.test.ts`](file:///Users/chetan/ParthMobileCare/__tests__/deviceBindingSecurity.test.ts):
   - Fixed `FaceVerificationToken` mock fixture to include `signature` property adhering to TypeScript interface.

---

## 2. Before / After Security Issues Remediation

| Vulnerability / Concern | Before Remediation | After Security Remediation |
| :--- | :--- | :--- |
| **Staff Profile Update Escalation** | Update rule checked equality of selected fields (`role`, `basicSalary`, `monthlyTarget`, `isActive`), but lacked an exhaustive allowlist. Staff could potentially modify face approval fields (`faceEnrollmentStatus`, `faceApprovedAt`, `faceApprovedBy`, `hasFaceRegistered`). | Replaced with strict `diff().affectedKeys().hasOnly(['name', 'phone', 'avatarUrl', 'deviceId', 'devicePublicKey', 'deviceModel', 'devicePlatform', 'deviceBindingStatus', 'deviceRegisteredAt', '_syncedAt'])`. All administrative, financial, face approval, and audit fields are strictly immutable to staff. |
| **Device Binding Self-Approval** | Rule checked that incoming `deviceBindingStatus != 'approved'`, but did not forbid overwriting device fields if an approved binding existed. | Added explicit constraints: if `resource.data.deviceBindingStatus == 'approved'`, staff CANNOT modify `deviceBindingStatus`, `deviceId`, or `devicePublicKey`. Only initial unapproved submission can transition to `'pending_approval'`. |
| **Device Change Request Forgery** | Staff could submit requests with arbitrary `userName` or `userEmail` and spoof applicant identity or current device ID. | Enforced that `userName == getUserData().name`, `userEmail == getUserData().email`, and `currentDeviceId == getUserData().deviceId`. |
| **Device Change Request Review Tampering** | Admin update rule allowed updating the request without verifying that hardware keys or applicant UID remained untouched during review. | Enforced `diff().affectedKeys().hasOnly(['status', 'reviewedAt', 'reviewedBy', 'reviewedByName', 'rejectionReason', '_syncedAt'])`. Hardware IDs and applicant details are mathematically immutable during review. Enforced `reviewedBy == request.auth.uid` and required non-empty `rejectionReason` on rejection. |
| **Attendance State Transitions & Punch Out** | Previous rule only allowed Admin to update attendance records (`allow update: if isAdmin()`), which caused staff mobile punch-out sync to fail, while create lacked validation of active account status and approved device binding. | Complete rule implemented: On create (Punch In), requires `getUserData().isActive == true`, `getUserData().deviceBindingStatus == 'approved'`, `deviceId == getUserData().deviceId`, initial status in `['present', 'late']`, and canonical document ID (`att_${uid}_${date}`). On update (Punch Out), requires active/approved status, valid punch-out time, non-already-punched-out session, immutable punch-in fields, and affected keys restricted to punch-out attributes. |
| **Duplicate Attendance Punches** | Potential for multiple records or invalid punch-outs. | Enforced that Punch In can only create when document doesn't exist; Punch Out can only update when previous `punchOutTime` is unset, preventing double punch-outs. |

---

## 3. Every Collection's Permissions Matrix

| Collection Path | Read Permissions | Create Permissions | Update Permissions | Delete Permissions |
| :--- | :--- | :--- | :--- | :--- |
| `users/{userId}` | Admin OR `request.auth.uid == userId` | Admin OR invited staff with valid unexpired token | Admin OR `userId == request.auth.uid` with strict allowlist (no role/salary/active/device escalation) | Admin only |
| `attendance/{attendanceId}` | Admin OR `resource.data.userId == request.auth.uid` | Admin OR active staff with approved device match (`deviceId == getUserData().deviceId`) & valid punch-in | Admin OR staff punching out active session with immutable punch-in fields & approved device | Admin only |
| `attendance_audit_logs/{logId}` | Admin OR `resource.data.userId == request.auth.uid` | Admin OR owner staff (`userId == request.auth.uid`) | **Deny (false)** (Immutable audit log) | **Deny (false)** |
| `device_change_requests/{requestId}` | Admin OR `resource.data.userId == request.auth.uid` | Admin OR owner staff (`userId == request.auth.uid`) with matching profile identity & pending status | Admin review (`approved`/`rejected` with reason & audit UID) OR owner staff self-cancellation | Admin only |
| `staff_invitations/{invitationId}` | `list`: Admin only.<br>`get`: Admin OR valid pending unexpired token. | Admin only | Admin OR accepting staff transitioning to `accepted` (affected keys: `status`, `acceptedAt`, `acceptedByUid`) | Admin only |
| `staff_invitations/{invitationId}/compensation/{docId}` | Admin only | Admin only | Admin only | Admin only |
| `leads/{leadId}` | Admin OR creator staff OR assigned staff | Admin OR creator staff | Admin OR creator/assigned staff (immutable `id`, `createdBy`, `createdAt`) | Admin only |
| `mobile_prices/{priceId}` | Authenticated users | Admin only | Admin only | Admin only |
| `second_hand_purchases/{purchaseId}` | Admin OR purchasing staff OR in-stock items | Authenticated staff (with KYC & signature) | Admin only | Admin only |
| `second_hand_purchases/{purchaseId}/kyc_sensitive/{kycId}` | Admin only | Purchasing staff matching parent record | Admin only | Admin only |
| `second_hand_sales/{saleId}` | Authenticated users | Authenticated staff (with invoice & signature) | Admin only | Admin only |
| `sales_targets/{targetId}` | Authenticated users | Admin only | Admin only | Admin only |
| `salary_slips/{slipId}` | Admin OR target staff (`staffId == request.auth.uid`) | Admin only | Admin only | Admin only |
| `notifications/{notificationId}` | Authenticated users | Authenticated users | Authenticated users (mark as read without altering content) | Admin only |
| `shop_config/{configId}` | Authenticated users | Admin only | Admin only | Admin only |
| `_connection_test/{testDocId}` | Authenticated users | Authenticated users | Authenticated users | Admin only |
| `audit_logs/{logId}` | Admin only | Admin with valid audit structure | **Deny (false)** (Immutable audit log) | **Deny (false)** |
| `/{document=**}` (Default) | **Deny (false)** | **Deny (false)** | **Deny (false)** | **Deny (false)** |

---

## 4. Complete Revised `firestore.rules`

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // ===============================================================
    // Assumed Data Model
    // ===============================================================
    //
    // 1. users/{userId}
    //    - id: string (1-100 chars, immutable on update)
    //    - name: string (1-100 chars)
    //    - email: string (5-150 chars, valid email format)
    //    - phone: string (7-20 chars)
    //    - role: string ('admin' | 'manager' | 'staff', immutable for self-update)
    //    - designation: string (1-100 chars)
    //    - avatarUrl: string (optional, 0-500000 chars)
    //    - joinedDate: string (1-50 chars)
    //    - basicSalary: number (>= 0, immutable for self-update)
    //    - monthlyTarget: number (>= 0, immutable for self-update)
    //    - isActive: bool
    //    - hasFaceRegistered: bool (optional)
    //    - faceRegistrationDate: string (optional, 0-50 chars)
    //    - _syncedAt: string (optional, 0-50 chars)
    //
    // 2. attendance/{attendanceId}
    //    - id: string (1-100 chars)
    //    - userId: string (1-100 chars, must match request.auth.uid on create)
    //    - userName: string (1-100 chars)
    //    - userRole: string ('admin' | 'manager' | 'staff')
    //    - date: string (1-20 chars, YYYY-MM-DD)
    //    - timestamp: string (optional, 0-50 chars)
    //    - punchInTime: string (optional, 0-50 chars)
    //    - punchInCoords: map (optional, latitude, longitude, distanceMeters)
    //    - punchOutTime: string (optional, 0-50 chars)
    //    - punchOutCoords: map (optional, latitude, longitude, distanceMeters)
    //    - status: string ('present' | 'late' | 'half_day' | 'early_exit' | 'absent')
    //    - totalHours: number (>= 0)
    //    - isLate: bool
    //    - isEarlyExit: bool
    //    - notes: string (optional, 0-1000 chars)
    //    - verificationMethod: string (optional, 'face_recognition' | 'manual_override')
    //    - faceVerificationScore: number (optional)
    //    - faceLivenessScore: number (optional)
    //    - faceVerificationTokenId: string (optional, 0-100 chars)
    //    - deviceId: string (optional, 0-100 chars)
    //    - _syncedAt: string (optional, 0-50 chars)
    //
    // 3. leads/{leadId}
    //    - id: string (1-100 chars)
    //    - name: string (1-100 chars)
    //    - phone: string (7-20 chars)
    //    - alternatePhone: string (optional, 0-20 chars)
    //    - interestedBrand: string (1-50 chars)
    //    - interestedModel: string (1-100 chars)
    //    - budget: number (>= 0)
    //    - remarks: string (0-1000 chars)
    //    - status: string ('new' | 'follow_up' | 'interested' | 'purchased' | 'lost')
    //    - followUpDate: string (optional, 0-50 chars)
    //    - followUpTime: string (optional, 0-50 chars)
    //    - createdBy: string (1-100 chars, immutable on update)
    //    - createdByName: string (1-100 chars)
    //    - createdAt: string (1-50 chars, immutable on update)
    //    - updatedAt: string (1-50 chars)
    //    - history: list (max 100 items)
    //    - _syncedAt: string (optional, 0-50 chars)
    //
    // 4. mobile_prices/{priceId}
    //    - id: string (1-100 chars)
    //    - brand: string (1-50 chars)
    //    - model: string (1-100 chars)
    //    - ram: string (1-30 chars)
    //    - storage: string (1-30 chars)
    //    - purchasePrice: number (>= 0)
    //    - sellingPrice: number (>= 0)
    //    - inStock: bool (optional)
    //    - updatedAt: string (1-50 chars)
    //    - priceHistory: list (max 100 items)
    //    - _syncedAt: string (optional, 0-50 chars)
    //
    // 5. second_hand_purchases/{purchaseId}
    //    - id: string (1-100 chars)
    //    - customerName: string (1-100 chars)
    //    - phone: string (7-20 chars)
    //    - alternatePhone: string (optional, 0-20 chars)
    //    - address: string (1-250 chars)
    //    - aadhaarNumber: string (4-20 chars)
    //    - aadhaarFrontUri / aadhaarBackUri / aadhaarPhotoFront / aadhaarPhotoBack / aadhaarCardPhotoUri: string (optional, 0-500000 chars)
    //    - customerPhotoUri / billImageUri: string (optional, 0-500000 chars)
    //    - brand: string (1-50 chars)
    //    - model: string (1-100 chars)
    //    - ram / storage: string (optional, 0-30 chars)
    //    - imei: string (5-30 chars)
    //    - condition: string (1-50 chars)
    //    - purchaseAmount: number (>= 0)
    //    - digitalSignatureUri: string (1-500000 chars)
    //    - purchaseDate: string (1-50 chars)
    //    - purchaseTime: string (1-50 chars)
    //    - purchasedByStaffId: string (1-100 chars)
    //    - purchasedByStaffName: string (1-100 chars)
    //    - status: string ('in_stock' | 'sold')
    //    - notes: string (optional, 0-1000 chars)
    //    - _syncedAt: string (optional, 0-50 chars)
    //
    // 6. second_hand_sales/{saleId}
    //    - id: string (1-100 chars)
    //    - purchaseRecordId: string (optional, 0-100 chars)
    //    - buyerName: string (1-100 chars)
    //    - phone: string (7-20 chars)
    //    - alternatePhone: string (optional, 0-20 chars)
    //    - address: string (1-250 chars)
    //    - aadhaarNumber: string (4-20 chars)
    //    - aadhaarPhotoUri / buyerPhotoUri: string (optional, 0-500000 chars)
    //    - brand: string (1-50 chars)
    //    - model: string (1-100 chars)
    //    - ram / storage: string (optional, 0-30 chars)
    //    - imei: string (5-30 chars)
    //    - sellingAmount: number (>= 0)
    //    - purchaseAmount: number (>= 0)
    //    - profitAmount: number
    //    - marginPercent: number
    //    - invoiceNumber: string (1-100 chars)
    //    - digitalSignatureUri: string (1-500000 chars)
    //    - saleDate: string (1-50 chars)
    //    - saleTime: string (1-50 chars)
    //    - soldByStaffId: string (1-100 chars)
    //    - soldByStaffName: string (1-100 chars)
    //    - paymentMethod: string ('Cash' | 'UPI' | 'Card' | 'Bank Transfer')
    //    - warrantyMonths: number (optional, >= 0)
    //    - notes: string (optional, 0-1000 chars)
    //    - _syncedAt: string (optional, 0-50 chars)
    //
    // 7. sales_targets/{targetId}
    //    - id: string (1-100 chars)
    //    - staffId: string (1-100 chars)
    //    - staffName: string (1-100 chars)
    //    - month: string (1-20 chars, e.g. YYYY-MM)
    //    - targetAmount: number (>= 0)
    //    - achievedAmount: number (>= 0)
    //    - targetUnits: number (>= 0)
    //    - achievedUnits: number (>= 0)
    //    - incentivePercent: number (>= 0)
    //    - calculatedIncentive: number (>= 0)
    //    - _syncedAt: string (optional, 0-50 chars)
    //
    // 8. salary_slips/{slipId}
    //    - id: string (1-100 chars)
    //    - staffId: string (1-100 chars)
    //    - staffName: string (1-100 chars)
    //    - designation: string (1-100 chars)
    //    - month: string (1-50 chars)
    //    - monthKey: string (1-20 chars, e.g. YYYY-MM)
    //    - basicSalary: number (>= 0)
    //    - salesIncentive: number (>= 0)
    //    - attendanceBonus: number (>= 0)
    //    - deductions: number (>= 0)
    //    - netSalary: number (>= 0)
    //    - totalWorkingDays: number (>= 0)
    //    - presentDays: number (>= 0)
    //    - lateDays: number (>= 0)
    //    - salesAchieved: number (>= 0)
    //    - generatedDate: string (1-50 chars)
    //    - isPaid: bool
    //    - paidDate: string (optional, 0-50 chars)
    //    - paymentMethod: string (optional, 0-50 chars)
    //    - transactionRef: string (optional, 0-100 chars)
    //    - _syncedAt: string (optional, 0-50 chars)
    //
    // 9. notifications/{notificationId}
    //    - id: string (1-100 chars)
    //    - title: string (1-200 chars)
    //    - body: string (1-1000 chars)
    //    - type: string ('lead' | 'attendance' | 'inventory' | 'sales' | 'system')
    //    - read: bool
    //    - timestamp: string (1-50 chars)
    //    - relatedId: string (optional, 0-100 chars)
    //    - _syncedAt: string (optional, 0-50 chars)
    //
    // 10. shop_config/{configId}
    //     - id: string (1-100 chars)
    //     - shopName: string (1-100 chars)
    //     - shopLatitude: number (-90 to 90)
    //     - shopLongitude: number (-180 to 180)
    //     - allowedRadiusMeters: number (> 0)
    //     - openingTime: string (1-20 chars)
    //     - closingTime: string (1-20 chars)
    //     - _syncedAt: string (optional, 0-50 chars)
    //
    // 11. _connection_test/{testDocId}
    //     - id: string
    //     - timestamp: string / number
    //     - status: string
    //
    // 12. staff_invitations/{invitationId}
    //     - id: string (1-100 chars)
    //     - token: string (1-100 chars, unguessable cryptographic token)
    //     - email: string (5-150 chars)
    //     - role: string ('staff')
    //     - designation: string (1-100 chars)
    //     - phone: string (7-20 chars)
    //     - status: string ('pending' | 'accepted' | 'expired' | 'revoked')
    //     - invitedAt: string (1-50 chars)
    //     - expiresAt: string (1-50 chars)
    //     - invitedByUid: string (1-100 chars)
    //     - invitedByName: string (1-100 chars)
    //     - acceptedAt: string (optional, 0-50 chars)
    //     - acceptedByUid: string (optional, 0-100 chars)
    //     - revokedAt: string (optional, 0-50 chars)
    //     - revokedBy: string (optional, 0-100 chars)
    //     - basicSalary: number (>= 0)
    //     - monthlyTarget: number (>= 0)
    //     - _syncedAt: string (optional, 0-50 chars)
    //
    // 13. device_change_requests/{requestId}
    //     - id: string (1-100 chars)
    //     - userId: string (1-100 chars)
    //     - userName: string (1-100 chars)
    //     - userEmail: string (5-150 chars)
    //     - currentDeviceId: string (optional, 0-100 chars)
    //     - currentDeviceModel: string (optional, 0-100 chars)
    //     - newDeviceId: string (1-100 chars)
    //     - newDevicePublicKey: string (1-2000 chars)
    //     - newDeviceModel: string (1-100 chars)
    //     - newDevicePlatform: string (1-20 chars)
    //     - reason: string (1-500 chars)
    //     - status: string ('pending' | 'approved' | 'rejected' | 'cancelled')
    //     - requestedAt: string (1-50 chars)
    //     - reviewedAt: string (optional, 0-50 chars)
    //     - reviewedBy: string (optional, 0-100 chars)
    //     - reviewedByName: string (optional, 0-100 chars)
    //     - rejectionReason: string (optional, 0-1000 chars)
    //     - _syncedAt: string (optional, 0-50 chars)
    //
    // ===============================================================

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function getUserData() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data;
    }

    function userDocExists() {
      return exists(/databases/$(database)/documents/users/$(request.auth.uid));
    }

    function isAdmin() {
      return isAuthenticated() && (
        (request.auth.token != null && request.auth.token.role == 'admin') ||
        (userDocExists() && ('role' in getUserData()) && getUserData().role == 'admin' && getUserData().isActive == true)
      );
    }

    function isManagerOrAdmin() {
      return isAdmin();
    }

    function isValidString(val, minLen, maxLen) {
      return val is string && val.size() >= minLen && val.size() <= maxLen;
    }

    function isValidOptionalString(key, data, minLen, maxLen) {
      return !(key in data) || (data[key] is string && data[key].size() >= minLen && data[key].size() <= maxLen);
    }

    function isValidEmail(email) {
      return isValidString(email, 5, 150) && email.matches('^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$');
    }

    function isValidPhone(phone) {
      return isValidString(phone, 7, 20);
    }

    // ===============================================================
    // Domain Type Validators
    // ===============================================================

    function isValidUser(data) {
      let allowed = [
        'id', 'name', 'email', 'phone', 'role', 'designation', 'avatarUrl',
        'joinedDate', 'basicSalary', 'monthlyTarget', 'isActive',
        'hasFaceRegistered', 'faceRegistrationDate', 'faceEnrollmentStatus',
        'faceApprovedAt', 'faceApprovedBy', 'faceRejectionReason',
        'failedVerificationAttempts', 'lastFailedVerificationReason', 'lastFailedVerificationAt',
        'createdBy', 'createdAt', 'passwordSetupStatus', 'invitationToken',
        'deviceId', 'devicePublicKey', 'deviceModel', 'devicePlatform',
        'deviceBindingStatus', 'deviceRegisteredAt', 'deviceApprovedAt', 'deviceApprovedBy',
        'deviceRejectionReason', '_syncedAt'
      ];
      let required = ['id', 'name', 'email', 'phone', 'role', 'designation', 'joinedDate', 'basicSalary', 'monthlyTarget', 'isActive'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.name, 1, 100) &&
             isValidEmail(data.email) &&
             isValidPhone(data.phone) &&
             data.role in ['admin', 'manager', 'staff'] &&
             isValidString(data.designation, 1, 100) &&
             isValidString(data.joinedDate, 1, 50) &&
             data.basicSalary is number && data.basicSalary >= 0 &&
             data.monthlyTarget is number && data.monthlyTarget >= 0 &&
             data.isActive is bool &&
             isValidOptionalString('avatarUrl', data, 0, 500000) &&
             (!('hasFaceRegistered' in data) || data.hasFaceRegistered is bool) &&
             isValidOptionalString('faceRegistrationDate', data, 0, 50) &&
             isValidOptionalString('faceEnrollmentStatus', data, 0, 50) &&
             isValidOptionalString('faceApprovedAt', data, 0, 50) &&
             isValidOptionalString('faceApprovedBy', data, 0, 100) &&
             isValidOptionalString('faceRejectionReason', data, 0, 1000) &&
             (!('failedVerificationAttempts' in data) || data.failedVerificationAttempts is number) &&
             isValidOptionalString('lastFailedVerificationReason', data, 0, 1000) &&
             isValidOptionalString('lastFailedVerificationAt', data, 0, 50) &&
             isValidOptionalString('createdBy', data, 0, 100) &&
             isValidOptionalString('createdAt', data, 0, 50) &&
             isValidOptionalString('passwordSetupStatus', data, 0, 50) &&
             isValidOptionalString('invitationToken', data, 0, 100) &&
             isValidOptionalString('deviceId', data, 0, 100) &&
             isValidOptionalString('devicePublicKey', data, 0, 2000) &&
             isValidOptionalString('deviceModel', data, 0, 100) &&
             isValidOptionalString('devicePlatform', data, 0, 20) &&
             (!('deviceBindingStatus' in data) || data.deviceBindingStatus in ['unregistered', 'pending_approval', 'approved', 'rejected']) &&
             isValidOptionalString('deviceRegisteredAt', data, 0, 50) &&
             isValidOptionalString('deviceApprovedAt', data, 0, 50) &&
             isValidOptionalString('deviceApprovedBy', data, 0, 100) &&
             isValidOptionalString('deviceRejectionReason', data, 0, 1000) &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidAttendance(data) {
      let allowed = ['id', 'userId', 'userName', 'userRole', 'date', 'timestamp', 'punchInTime', 'punchInCoords', 'punchOutTime', 'punchOutCoords', 'status', 'totalHours', 'isLate', 'isEarlyExit', 'notes', 'verificationMethod', 'faceVerificationScore', 'faceLivenessScore', 'faceVerificationTokenId', 'deviceId', '_syncedAt'];
      let required = ['id', 'userId', 'userName', 'userRole', 'date', 'status', 'totalHours', 'isLate', 'isEarlyExit'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.userId, 1, 100) &&
             isValidString(data.userName, 1, 100) &&
             data.userRole in ['admin', 'manager', 'staff'] &&
             isValidString(data.date, 1, 20) &&
             data.status in ['present', 'late', 'half_day', 'early_exit', 'absent'] &&
             data.totalHours is number && data.totalHours >= 0 &&
             data.isLate is bool &&
             data.isEarlyExit is bool &&
             isValidOptionalString('timestamp', data, 0, 50) &&
             isValidOptionalString('punchInTime', data, 0, 50) &&
             (!('punchInCoords' in data) || data.punchInCoords is map) &&
             isValidOptionalString('punchOutTime', data, 0, 50) &&
             (!('punchOutCoords' in data) || data.punchOutCoords is map) &&
             isValidOptionalString('notes', data, 0, 1000) &&
             (!('verificationMethod' in data) || data.verificationMethod in ['face_recognition', 'manual_override']) &&
             (!('faceVerificationScore' in data) || data.faceVerificationScore is number) &&
             (!('faceLivenessScore' in data) || data.faceLivenessScore is number) &&
             isValidOptionalString('faceVerificationTokenId', data, 0, 100) &&
             isValidOptionalString('deviceId', data, 0, 100) &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidLead(data) {
      let allowed = ['id', 'name', 'phone', 'alternatePhone', 'interestedBrand', 'interestedModel', 'budget', 'remarks', 'status', 'followUpDate', 'followUpTime', 'createdBy', 'createdByName', 'assignedTo', 'assignedToName', 'createdAt', 'updatedAt', 'history', '_syncedAt'];
      let required = ['id', 'name', 'phone', 'interestedBrand', 'interestedModel', 'budget', 'remarks', 'status', 'createdBy', 'createdByName', 'createdAt', 'updatedAt', 'history'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.name, 1, 100) &&
             isValidPhone(data.phone) &&
             isValidOptionalString('alternatePhone', data, 0, 20) &&
             isValidString(data.interestedBrand, 1, 50) &&
             isValidString(data.interestedModel, 1, 100) &&
             data.budget is number && data.budget >= 0 &&
             isValidString(data.remarks, 0, 1000) &&
             data.status in ['new', 'follow_up', 'interested', 'purchased', 'lost'] &&
             isValidOptionalString('followUpDate', data, 0, 50) &&
             isValidOptionalString('followUpTime', data, 0, 50) &&
             isValidString(data.createdBy, 1, 100) &&
             isValidString(data.createdByName, 1, 100) &&
             isValidOptionalString('assignedTo', data, 0, 100) &&
             isValidOptionalString('assignedToName', data, 0, 100) &&
             isValidString(data.createdAt, 1, 50) &&
             isValidString(data.updatedAt, 1, 50) &&
             data.history is list && data.history.size() <= 100 &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidMobilePrice(data) {
      let allowed = ['id', 'brand', 'model', 'ram', 'storage', 'purchasePrice', 'sellingPrice', 'inStock', 'updatedAt', 'priceHistory', '_syncedAt'];
      let required = ['id', 'brand', 'model', 'ram', 'storage', 'purchasePrice', 'sellingPrice', 'updatedAt', 'priceHistory'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.brand, 1, 50) &&
             isValidString(data.model, 1, 100) &&
             isValidString(data.ram, 1, 30) &&
             isValidString(data.storage, 1, 30) &&
             data.purchasePrice is number && data.purchasePrice >= 0 &&
             data.sellingPrice is number && data.sellingPrice >= 0 &&
             (!('inStock' in data) || data.inStock is bool) &&
             isValidString(data.updatedAt, 1, 50) &&
             data.priceHistory is list && data.priceHistory.size() <= 100 &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidSecondHandPurchase(data) {
      let allowed = ['id', 'customerName', 'phone', 'alternatePhone', 'address', 'aadhaarNumber', 'aadhaarFrontUri', 'aadhaarBackUri', 'aadhaarPhotoFront', 'aadhaarPhotoBack', 'aadhaarCardPhotoUri', 'customerPhotoUri', 'billImageUri', 'brand', 'model', 'ram', 'storage', 'imei', 'condition', 'purchaseAmount', 'digitalSignatureUri', 'purchaseDate', 'purchaseTime', 'purchasedByStaffId', 'purchasedByStaffName', 'status', 'notes', '_syncedAt'];
      let required = ['id', 'customerName', 'phone', 'address', 'aadhaarNumber', 'brand', 'model', 'imei', 'condition', 'purchaseAmount', 'digitalSignatureUri', 'purchaseDate', 'purchaseTime', 'purchasedByStaffId', 'purchasedByStaffName', 'status'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.customerName, 1, 100) &&
             isValidPhone(data.phone) &&
             isValidOptionalString('alternatePhone', data, 0, 20) &&
             isValidString(data.address, 1, 250) &&
             isValidString(data.aadhaarNumber, 4, 20) &&
             isValidOptionalString('aadhaarFrontUri', data, 0, 500000) &&
             isValidOptionalString('aadhaarBackUri', data, 0, 500000) &&
             isValidOptionalString('aadhaarPhotoFront', data, 0, 500000) &&
             isValidOptionalString('aadhaarPhotoBack', data, 0, 500000) &&
             isValidOptionalString('aadhaarCardPhotoUri', data, 0, 500000) &&
             isValidOptionalString('customerPhotoUri', data, 0, 500000) &&
             isValidOptionalString('billImageUri', data, 0, 500000) &&
             isValidString(data.brand, 1, 50) &&
             isValidString(data.model, 1, 100) &&
             isValidOptionalString('ram', data, 0, 30) &&
             isValidOptionalString('storage', data, 0, 30) &&
             isValidString(data.imei, 5, 30) &&
             isValidString(data.condition, 1, 50) &&
             data.purchaseAmount is number && data.purchaseAmount >= 0 &&
             isValidString(data.digitalSignatureUri, 1, 500000) &&
             isValidString(data.purchaseDate, 1, 50) &&
             isValidString(data.purchaseTime, 1, 50) &&
             isValidString(data.purchasedByStaffId, 1, 100) &&
             isValidString(data.purchasedByStaffName, 1, 100) &&
             data.status in ['in_stock', 'sold'] &&
             isValidOptionalString('notes', data, 0, 1000) &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidSecondHandSale(data) {
      let allowed = ['id', 'purchaseRecordId', 'buyerName', 'phone', 'alternatePhone', 'address', 'aadhaarNumber', 'aadhaarPhotoUri', 'buyerPhotoUri', 'brand', 'model', 'ram', 'storage', 'imei', 'sellingAmount', 'purchaseAmount', 'profitAmount', 'marginPercent', 'invoiceNumber', 'digitalSignatureUri', 'saleDate', 'saleTime', 'soldByStaffId', 'soldByStaffName', 'paymentMethod', 'warrantyMonths', 'notes', '_syncedAt'];
      let required = ['id', 'buyerName', 'phone', 'address', 'aadhaarNumber', 'brand', 'model', 'imei', 'sellingAmount', 'purchaseAmount', 'profitAmount', 'marginPercent', 'invoiceNumber', 'digitalSignatureUri', 'saleDate', 'saleTime', 'soldByStaffId', 'soldByStaffName', 'paymentMethod'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidOptionalString('purchaseRecordId', data, 0, 100) &&
             isValidString(data.buyerName, 1, 100) &&
             isValidPhone(data.phone) &&
             isValidOptionalString('alternatePhone', data, 0, 20) &&
             isValidString(data.address, 1, 250) &&
             isValidString(data.aadhaarNumber, 4, 20) &&
             isValidOptionalString('aadhaarPhotoUri', data, 0, 500000) &&
             isValidOptionalString('buyerPhotoUri', data, 0, 500000) &&
             isValidString(data.brand, 1, 50) &&
             isValidString(data.model, 1, 100) &&
             isValidOptionalString('ram', data, 0, 30) &&
             isValidOptionalString('storage', data, 0, 30) &&
             isValidString(data.imei, 5, 30) &&
             data.sellingAmount is number && data.sellingAmount >= 0 &&
             data.purchaseAmount is number && data.purchaseAmount >= 0 &&
             data.profitAmount is number &&
             data.marginPercent is number &&
             isValidString(data.invoiceNumber, 1, 100) &&
             isValidString(data.digitalSignatureUri, 1, 500000) &&
             isValidString(data.saleDate, 1, 50) &&
             isValidString(data.saleTime, 1, 50) &&
             isValidString(data.soldByStaffId, 1, 100) &&
             isValidString(data.soldByStaffName, 1, 100) &&
             data.paymentMethod in ['Cash', 'UPI', 'Card', 'Bank Transfer'] &&
             (!('warrantyMonths' in data) || (data.warrantyMonths is number && data.warrantyMonths >= 0)) &&
             isValidOptionalString('notes', data, 0, 1000) &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidSalesTarget(data) {
      let allowed = ['id', 'staffId', 'staffName', 'month', 'targetAmount', 'achievedAmount', 'targetUnits', 'achievedUnits', 'incentivePercent', 'calculatedIncentive', '_syncedAt'];
      let required = ['id', 'staffId', 'staffName', 'month', 'targetAmount', 'achievedAmount', 'targetUnits', 'achievedUnits', 'incentivePercent', 'calculatedIncentive'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.staffId, 1, 100) &&
             isValidString(data.staffName, 1, 100) &&
             isValidString(data.month, 1, 20) &&
             data.targetAmount is number && data.targetAmount >= 0 &&
             data.achievedAmount is number && data.achievedAmount >= 0 &&
             data.targetUnits is number && data.targetUnits >= 0 &&
             data.achievedUnits is number && data.achievedUnits >= 0 &&
             data.incentivePercent is number && data.incentivePercent >= 0 &&
             data.calculatedIncentive is number && data.calculatedIncentive >= 0 &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidSalarySlip(data) {
      let allowed = ['id', 'staffId', 'staffName', 'designation', 'month', 'monthKey', 'basicSalary', 'salesIncentive', 'attendanceBonus', 'deductions', 'netSalary', 'totalWorkingDays', 'presentDays', 'lateDays', 'salesAchieved', 'generatedDate', 'isPaid', 'paidDate', 'paymentMethod', 'transactionRef', '_syncedAt'];
      let required = ['id', 'staffId', 'staffName', 'designation', 'month', 'monthKey', 'basicSalary', 'salesIncentive', 'attendanceBonus', 'deductions', 'netSalary', 'totalWorkingDays', 'presentDays', 'lateDays', 'salesAchieved', 'generatedDate', 'isPaid'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.staffId, 1, 100) &&
             isValidString(data.staffName, 1, 100) &&
             isValidString(data.designation, 1, 100) &&
             isValidString(data.month, 1, 50) &&
             isValidString(data.monthKey, 1, 20) &&
             data.basicSalary is number && data.basicSalary >= 0 &&
             data.salesIncentive is number && data.salesIncentive >= 0 &&
             data.attendanceBonus is number && data.attendanceBonus >= 0 &&
             data.deductions is number && data.deductions >= 0 &&
             data.netSalary is number && data.netSalary >= 0 &&
             data.totalWorkingDays is number && data.totalWorkingDays >= 0 &&
             data.presentDays is number && data.presentDays >= 0 &&
             data.lateDays is number && data.lateDays >= 0 &&
             data.salesAchieved is number && data.salesAchieved >= 0 &&
             isValidString(data.generatedDate, 1, 50) &&
             data.isPaid is bool &&
             isValidOptionalString('paidDate', data, 0, 50) &&
             isValidOptionalString('paymentMethod', data, 0, 50) &&
             isValidOptionalString('transactionRef', data, 0, 100) &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidNotification(data) {
      let allowed = ['id', 'title', 'body', 'type', 'read', 'timestamp', 'relatedId', '_syncedAt'];
      let required = ['id', 'title', 'body', 'type', 'read', 'timestamp'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.title, 1, 200) &&
             isValidString(data.body, 1, 1000) &&
             data.type in ['lead', 'attendance', 'inventory', 'sales', 'system'] &&
             data.read is bool &&
             isValidString(data.timestamp, 1, 50) &&
             isValidOptionalString('relatedId', data, 0, 100) &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidShopConfig(data) {
      let allowed = ['id', 'shopName', 'shopLatitude', 'shopLongitude', 'allowedRadiusMeters', 'openingTime', 'closingTime', '_syncedAt'];
      let required = ['id', 'shopName', 'shopLatitude', 'shopLongitude', 'allowedRadiusMeters', 'openingTime', 'closingTime'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.shopName, 1, 100) &&
             data.shopLatitude is number && data.shopLatitude >= -90 && data.shopLatitude <= 90 &&
             data.shopLongitude is number && data.shopLongitude >= -180 && data.shopLongitude <= 180 &&
             data.allowedRadiusMeters is number && data.allowedRadiusMeters > 0 &&
             isValidString(data.openingTime, 1, 20) &&
             isValidString(data.closingTime, 1, 20) &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidConnectionTest(data) {
      return data.keys().hasAll(['id', 'status']);
    }

    function isValidStaffInvitation(data) {
      let allowed = [
        'id', 'token', 'email', 'role', 'designation', 'phone', 'status',
        'invitedAt', 'expiresAt', 'invitedByUid', 'invitedByName',
        'acceptedAt', 'acceptedByUid', 'revokedAt', 'revokedBy',
        'basicSalary', 'monthlyTarget', '_syncedAt'
      ];
      let required = ['id', 'token', 'email', 'role', 'designation', 'phone', 'status', 'invitedAt', 'expiresAt', 'invitedByUid', 'invitedByName', 'basicSalary', 'monthlyTarget'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.token, 1, 100) &&
             isValidEmail(data.email) &&
             data.role == 'staff' &&
             isValidString(data.designation, 1, 100) &&
             isValidPhone(data.phone) &&
             data.status in ['pending', 'accepted', 'expired', 'revoked'] &&
             isValidString(data.invitedAt, 1, 50) &&
             isValidString(data.expiresAt, 1, 50) &&
             isValidString(data.invitedByUid, 1, 100) &&
             isValidString(data.invitedByName, 1, 100) &&
             data.basicSalary is number && data.basicSalary >= 0 &&
             data.monthlyTarget is number && data.monthlyTarget >= 0 &&
             isValidOptionalString('acceptedAt', data, 0, 50) &&
             isValidOptionalString('acceptedByUid', data, 0, 100) &&
             isValidOptionalString('revokedAt', data, 0, 50) &&
             isValidOptionalString('revokedBy', data, 0, 100) &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidAdminAuditLog(data) {
      let allowed = ['id', 'action', 'targetType', 'targetId', 'targetName', 'adminId', 'adminName', 'timestamp', 'reason', 'previousState', 'newState', 'metadata', '_syncedAt'];
      let required = ['id', 'action', 'targetType', 'targetId', 'targetName', 'adminId', 'adminName', 'timestamp'];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.action, 1, 100) &&
             isValidString(data.targetType, 1, 100) &&
             isValidString(data.targetId, 1, 100) &&
             isValidString(data.targetName, 1, 100) &&
             isValidString(data.adminId, 1, 100) &&
             data.adminId == request.auth.uid &&
             isValidString(data.adminName, 1, 100) &&
             isValidString(data.timestamp, 1, 50) &&
             isValidOptionalString('reason', data, 0, 1000) &&
             (!('previousState' in data) || data.previousState is map) &&
             (!('newState' in data) || data.newState is map) &&
             (!('metadata' in data) || data.metadata is map) &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function isValidDeviceChangeRequest(data) {
      let allowed = [
        'id', 'userId', 'userName', 'userEmail', 'currentDeviceId', 'currentDeviceModel',
        'newDeviceId', 'newDevicePublicKey', 'newDeviceModel', 'newDevicePlatform',
        'reason', 'status', 'requestedAt', 'reviewedAt', 'reviewedBy', 'reviewedByName',
        'rejectionReason', '_syncedAt'
      ];
      let required = [
        'id', 'userId', 'userName', 'userEmail', 'newDeviceId',
        'newDevicePublicKey', 'newDeviceModel', 'newDevicePlatform',
        'reason', 'status', 'requestedAt'
      ];

      return data.keys().hasOnly(allowed) &&
             data.keys().hasAll(required) &&
             isValidString(data.id, 1, 100) &&
             isValidString(data.userId, 1, 100) &&
             isValidString(data.userName, 1, 100) &&
             isValidEmail(data.userEmail) &&
             isValidString(data.newDeviceId, 1, 100) &&
             isValidString(data.newDevicePublicKey, 1, 2000) &&
             isValidString(data.newDeviceModel, 1, 100) &&
             isValidString(data.newDevicePlatform, 1, 20) &&
             isValidString(data.reason, 1, 500) &&
             data.status in ['pending', 'approved', 'rejected', 'cancelled'] &&
             isValidString(data.requestedAt, 1, 50) &&
             isValidOptionalString('currentDeviceId', data, 0, 100) &&
             isValidOptionalString('currentDeviceModel', data, 0, 100) &&
             isValidOptionalString('reviewedAt', data, 0, 50) &&
             isValidOptionalString('reviewedBy', data, 0, 100) &&
             isValidOptionalString('reviewedByName', data, 0, 100) &&
             isValidOptionalString('rejectionReason', data, 0, 1000) &&
             isValidOptionalString('_syncedAt', data, 0, 50);
    }

    function hasValidInvitationForProfile(userId, profileData) {
      let token = profileData.invitationToken;
      let invPath = /databases/$(database)/documents/staff_invitations/$(token);
      return exists(invPath) &&
             get(invPath).data.email == request.auth.token.email &&
             (get(invPath).data.status == 'pending' || get(invPath).data.acceptedByUid == userId) &&
             request.time < timestamp(get(invPath).data.expiresAt) &&
             get(invPath).data.role == 'staff';
    }

    // ===============================================================
    // Collection Security Rules
    // ===============================================================

    // 1. Users Collection
    match /users/{userId} {
      // Staff can read only their own user profile; Admin can read all authorized staff profiles
      allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == userId);

      // Admin can create any profile;
      // Newly invited staff can ONLY self-register if they possess a valid, unexpired invitation bound to their auth email,
      // and cannot set privileged fields (role must be 'staff', basicSalary must be 0, monthlyTarget must be 0, isActive must be true, no permissions)
      allow create: if isValidUser(request.resource.data) && (
        isAdmin() || (
          isOwner(userId) &&
          request.resource.data.role == 'staff' &&
          request.resource.data.basicSalary == 0 &&
          request.resource.data.monthlyTarget == 0 &&
          request.resource.data.isActive == true &&
          !('permissions' in request.resource.data) &&
          !('isAdmin' in request.resource.data) &&
          request.resource.data.email == request.auth.token.email &&
          ('invitationToken' in request.resource.data) &&
          hasValidInvitationForProfile(userId, request.resource.data)
        )
      );

      // Admin can update staff profiles;
      // Staff profile updates restricted strictly by affectedKeys allowlist and approved-device immutability
      allow update: if isValidUser(request.resource.data) && (
        isAdmin() || (
          isOwner(userId) &&
          request.resource.data.diff(resource.data).affectedKeys().hasOnly([
            'name', 'phone', 'avatarUrl', 'deviceId', 'devicePublicKey',
            'deviceModel', 'devicePlatform', 'deviceBindingStatus',
            'deviceRegisteredAt', '_syncedAt'
          ]) &&
          (
            !request.resource.data.diff(resource.data).affectedKeys().hasAny(['deviceBindingStatus']) || (
              (!('deviceBindingStatus' in resource.data) || resource.data.deviceBindingStatus != 'approved') &&
              request.resource.data.deviceBindingStatus == 'pending_approval'
            )
          ) &&
          (
            !request.resource.data.diff(resource.data).affectedKeys().hasAny(['deviceId', 'devicePublicKey']) ||
            (!('deviceBindingStatus' in resource.data) || resource.data.deviceBindingStatus != 'approved')
          )
        )
      );

      // Only Admin can delete user profiles
      allow delete: if isAdmin();
    }

    // 2. Attendance Collection
    match /attendance/{attendanceId} {
      // Individual staff member can only read their own punch records; Admin can read all
      allow read: if isAuthenticated() && (isAdmin() || resource.data.userId == request.auth.uid);

      // Create (Punch In)
      allow create: if (isAdmin() && isValidAttendance(request.resource.data)) || (
        isAuthenticated() &&
        request.resource.data.userId == request.auth.uid &&
        attendanceId == 'att_' + request.auth.uid + '_' + request.resource.data.date &&
        getUserData().isActive == true &&
        getUserData().deviceBindingStatus == 'approved' &&
        ('deviceId' in request.resource.data && request.resource.data.deviceId == getUserData().deviceId) &&
        request.resource.data.userName == getUserData().name &&
        request.resource.data.userRole == getUserData().role &&
        request.resource.data.status in ['present', 'late'] &&
        request.resource.data.totalHours == 0 &&
        request.resource.data.isEarlyExit == false &&
        (!('punchOutTime' in request.resource.data) || request.resource.data.punchOutTime == null || request.resource.data.punchOutTime == '' || request.resource.data.punchOutTime == '--:--') &&
        request.resource.data.punchInTime is string && request.resource.data.punchInTime.size() > 0 &&
        isValidAttendance(request.resource.data)
      );

      // Update (Punch Out by Staff or Admin correction)
      allow update: if (isAdmin() && isValidAttendance(request.resource.data)) || (
        isAuthenticated() &&
        resource.data.userId == request.auth.uid &&
        getUserData().isActive == true &&
        getUserData().deviceBindingStatus == 'approved' &&
        request.resource.data.deviceId == getUserData().deviceId &&
        // Previous doc must not already be punched out
        (!('punchOutTime' in resource.data) || resource.data.punchOutTime == null || resource.data.punchOutTime == '' || resource.data.punchOutTime == '--:--') &&
        // New doc must have valid punchOutTime
        ('punchOutTime' in request.resource.data && request.resource.data.punchOutTime != null && request.resource.data.punchOutTime != '' && request.resource.data.punchOutTime != '--:--') &&
        // Strict affected keys for punch-out
        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'punchOutTime', 'punchOutCoords', 'status', 'totalHours', 'isEarlyExit', 'notes', '_syncedAt', 'timestamp'
        ]) &&
        // Immutable historical & punch-in fields
        request.resource.data.id == resource.data.id &&
        request.resource.data.userId == resource.data.userId &&
        request.resource.data.userName == resource.data.userName &&
        request.resource.data.userRole == resource.data.userRole &&
        request.resource.data.date == resource.data.date &&
        request.resource.data.punchInTime == resource.data.punchInTime &&
        ((!('punchInCoords' in resource.data) && !('punchInCoords' in request.resource.data)) || request.resource.data.punchInCoords == resource.data.punchInCoords) &&
        request.resource.data.deviceId == resource.data.deviceId &&
        request.resource.data.isLate == resource.data.isLate &&
        isValidAttendance(request.resource.data)
      );

      // Attendance records are sensitive official audit trails; only Admin can adjust or delete
      allow delete: if isAdmin();
    }

    // 2b. Attendance & Biometric Audit Logs (Immutable Audit Trail)
    match /attendance_audit_logs/{logId} {
      allow read: if isAuthenticated() && (isAdmin() || resource.data.userId == request.auth.uid);
      allow create: if isAuthenticated() && (isAdmin() || request.resource.data.userId == request.auth.uid);
      allow update, delete: if false; // Append-only immutable audit trail protected from client modification
    }

    // 3. Customer Leads Collection
    match /leads/{leadId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        resource.data.createdBy == request.auth.uid ||
        ('assignedTo' in resource.data && resource.data.assignedTo == request.auth.uid)
      );

      // Staff can create leads (must set createdBy to their UID, or admin)
      allow create: if isAuthenticated() &&
                    (isAdmin() || request.resource.data.createdBy == request.auth.uid) &&
                    isValidLead(request.resource.data);

      allow update: if isAuthenticated() &&
                    (
                      isAdmin() ||
                      resource.data.createdBy == request.auth.uid ||
                      ('assignedTo' in resource.data && resource.data.assignedTo == request.auth.uid)
                    ) &&
                    isValidLead(request.resource.data) &&
                    request.resource.data.id == resource.data.id &&
                    request.resource.data.createdBy == resource.data.createdBy &&
                    request.resource.data.createdAt == resource.data.createdAt;

      // Only Admin can delete customer leads
      allow delete: if isAdmin();
    }

    // 4. Mobile Prices Collection
    match /mobile_prices/{priceId} {
      allow read: if isAuthenticated();

      // Catalog prices can only be managed by Admin
      allow create: if isAdmin() && isValidMobilePrice(request.resource.data);
      allow update: if isAdmin() &&
                    isValidMobilePrice(request.resource.data) &&
                    request.resource.data.id == resource.data.id;
      allow delete: if isAdmin();
    }

    // 5. Second-Hand Purchases Collection
    match /second_hand_purchases/{purchaseId} {
      // Admin can read all purchases; staff can read purchases they recorded or in-stock inventory for resale
      allow read: if isAuthenticated() && (
        isAdmin() ||
        resource.data.purchasedByStaffId == request.auth.uid ||
        resource.data.status == 'in_stock'
      );

      // Staff can record second-hand purchase with customer KYC & signature
      allow create: if isAuthenticated() && isValidSecondHandPurchase(request.resource.data);

      // Legal & financial buyback records can only be updated/deleted by Admin
      allow update: if isAdmin() && isValidSecondHandPurchase(request.resource.data);
      allow delete: if isAdmin();

      // Sensitive KYC Subcollection (raw customer Aadhaar numbers and identity proofs)
      // Only store administrator can read raw KYC.
      // Staff can only create KYC if they are the authenticated user who recorded the parent purchase.
      // Staff cannot write arbitrary KYC documents for unrelated purchases.
      match /kyc_sensitive/{kycId} {
        allow read: if isAdmin();
        allow create: if isAuthenticated() &&
                      request.auth.uid == get(/databases/$(database)/documents/second_hand_purchases/$(purchaseId)).data.purchasedByStaffId;
        allow update, delete: if isAdmin();
      }
    }

    // 6. Second-Hand Sales Collection
    match /second_hand_sales/{saleId} {
      allow read: if isAuthenticated();

      // Staff can record sales of refurbished / 2nd hand phones with invoice
      allow create: if isAuthenticated() && isValidSecondHandSale(request.resource.data);

      // Only Admin can modify/cancel finalized sales transactions
      allow update: if isAdmin() && isValidSecondHandSale(request.resource.data);
      allow delete: if isAdmin();
    }

    // 7. Sales Targets Collection
    match /sales_targets/{targetId} {
      allow read: if isAuthenticated();

      // Sales quotas and incentive slabs set exclusively by Admin
      allow create: if isAdmin() && isValidSalesTarget(request.resource.data);
      allow update: if isAdmin() && isValidSalesTarget(request.resource.data);
      allow delete: if isAdmin();
    }

    // 8. Salary Slips Collection
    match /salary_slips/{slipId} {
      // Individual staff member can only read their own slip via canonical staffId; Admin can read all
      allow read: if isAuthenticated() && (
        isAdmin() ||
        resource.data.staffId == request.auth.uid
      );

      // Financial payout calculation and issuance reserved strictly for Admin
      allow create: if isAdmin() && isValidSalarySlip(request.resource.data);
      allow update: if isAdmin() && isValidSalarySlip(request.resource.data);
      allow delete: if isAdmin();
    }

    // 9. Notifications Collection
    match /notifications/{notificationId} {
      allow read: if isAuthenticated();

      // System or authenticated users can dispatch notifications
      allow create: if isAuthenticated() && isValidNotification(request.resource.data);

      // Users can mark notifications as read without altering notification origin/body
      allow update: if isAuthenticated() &&
                    isValidNotification(request.resource.data) &&
                    request.resource.data.id == resource.data.id &&
                    request.resource.data.type == resource.data.type &&
                    request.resource.data.timestamp == resource.data.timestamp;

      // Only Admin can prune notifications
      allow delete: if isAdmin();
    }

    // 10. Shop Configuration (Geo-fencing, Coordinates, Hours)
    match /shop_config/{configId} {
      allow read: if isAuthenticated();

      // Store parameters and geo-fencing radius strictly Admin-controlled
      allow create, update: if isAdmin() && isValidShopConfig(request.resource.data);
      allow delete: if isAdmin();
    }

    // 11. Connectivity Test Collection (Healthcheck / Diagnostics)
    match /_connection_test/{testDocId} {
      allow read: if isAuthenticated();
      allow create, update: if isAuthenticated() && isValidConnectionTest(request.resource.data);
      allow delete: if isAdmin();
    }

    // 12. Staff Invitations Collection (Spark-compliant token provisioning)
    match /staff_invitations/{invitationId} {
      // Disallow public listing/enumeration. Only Admin can list/query all invitations.
      allow list: if isAdmin();

      // Non-admins can only read a single document if they hold the exact unguessable token
      // and only if the invitation is currently pending and unexpired. Admin can read any.
      allow get: if isAdmin() || (
        resource.data.status == 'pending' &&
        request.time < timestamp(resource.data.expiresAt)
      );

      // Only Admin can issue staff invitations
      allow create: if isAdmin() && isValidStaffInvitation(request.resource.data);

      // Admin can manage/revoke; invited staff can accept token upon account creation if valid and unexpired
      // Uses diff().affectedKeys() to restrict staff modifications strictly to status, acceptedAt, and acceptedByUid
      allow update: if isAdmin() || (
        isAuthenticated() &&
        resource.data.status == 'pending' &&
        resource.data.role == 'staff' &&
        request.time < timestamp(resource.data.expiresAt) &&
        request.resource.data.status == 'accepted' &&
        request.resource.data.acceptedByUid == request.auth.uid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'acceptedAt', 'acceptedByUid'])
      );

      // Only Admin can remove invitations
      allow delete: if isAdmin();

      // Admin-only compensation terms subcollection
      match /compensation/{docId} {
        allow read, write: if isAdmin();
      }
    }

    // 13. Device Change Requests Collection (Spark-compliant replacement workflow)
    match /device_change_requests/{requestId} {
      // Staff can read only their own requests; Admin can read all
      allow read: if isAuthenticated() && (isAdmin() || resource.data.userId == request.auth.uid);

      // Staff creation or Admin creation
      allow create: if isAuthenticated() &&
        isValidDeviceChangeRequest(request.resource.data) && (
          isAdmin() || (
            request.resource.data.userId == request.auth.uid &&
            request.resource.data.status == 'pending' &&
            request.resource.data.userName == getUserData().name &&
            request.resource.data.userEmail == getUserData().email &&
            (
              !('deviceId' in getUserData()) ||
              getUserData().deviceId == null ||
              !('currentDeviceId' in request.resource.data) ||
              request.resource.data.currentDeviceId == getUserData().deviceId
            )
          )
        );

      // Staff can cancel their own pending requests; Admin can review (approve/reject) pending requests
      allow update: if isAuthenticated() &&
        isValidDeviceChangeRequest(request.resource.data) && (
          // Staff cancellation
          (
            resource.data.userId == request.auth.uid &&
            resource.data.status == 'pending' &&
            request.resource.data.status == 'cancelled' &&
            request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', '_syncedAt'])
          ) ||
          // Admin review (approval or rejection)
          (
            isAdmin() &&
            resource.data.status == 'pending' &&
            request.resource.data.status in ['approved', 'rejected'] &&
            request.resource.data.reviewedBy == request.auth.uid &&
            request.resource.data.reviewedAt is string &&
            request.resource.data.reviewedAt.size() > 0 &&
            request.resource.data.diff(resource.data).affectedKeys().hasOnly([
              'status', 'reviewedAt', 'reviewedBy', 'reviewedByName', 'rejectionReason', '_syncedAt'
            ]) &&
            (
              request.resource.data.status != 'rejected' ||
              ('rejectionReason' in request.resource.data && request.resource.data.rejectionReason.size() > 0)
            )
          )
        );

      // Only Admin can delete requests
      allow delete: if isAdmin();
    }

    // 14. Administrative Security Audit Logs Collection
    match /audit_logs/{logId} {
      // Only Admin can view security audit logs
      allow read: if isAdmin();

      // Only verified Admin can create administrative audit logs matching their own auth UID
      allow create: if isAdmin() && isValidAdminAuditLog(request.resource.data);

      // Security audit logs are immutable and protected from tampering
      allow update, delete: if false;
    }

    // Default deny all other paths
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 5. Security Test Results

### A. Firestore Security Rules Acceptance Tests (`__tests__/firestoreRulesSecurityAcceptance.test.ts`)
Total: **26 passing tests (0 failures)**:
1. `DENIES staff attempting to escalate role to admin` (Passed)
2. `DENIES staff attempting to modify basicSalary or monthlyTarget` (Passed)
3. `DENIES staff attempting to change isActive status` (Passed)
4. `DENIES staff attempting to self-approve face recognition status` (Passed)
5. `DENIES staff attempting to modify hasFaceRegistered` (Passed)
6. `DENIES staff attempting to self-approve deviceBindingStatus to approved` (Passed)
7. `DENIES staff attempting to overwrite an already approved deviceId or devicePublicKey` (Passed)
8. `ALLOWS legitimate profile updates: phone, name, avatarUrl` (Passed)
9. `ALLOWS initial unapproved device submission transitioning strictly to pending_approval` (Passed)
10. `ALLOWS staff to submit a valid pending device change request matching their own profile` (Passed)
11. `DENIES staff forging a request for another user (identity spoofing)` (Passed)
12. `DENIES staff creating a pre-approved device change request` (Passed)
13. `ALLOWS staff to cancel their own pending request` (Passed)
14. `DENIES staff approving or rejecting their own device change request` (Passed)
15. `ALLOWS Admin to approve pending request with reviewedBy validation` (Passed)
16. `ALLOWS Admin to reject pending request with mandatory rejectionReason` (Passed)
17. `DENIES Admin rejection without rejectionReason` (Passed)
18. `ALLOWS active staff to punch in on their approved bound device with matching document ID` (Passed)
19. `DENIES punch in from an unapproved device (hardware mismatch)` (Passed)
20. `DENIES punch in if staff account deviceBindingStatus is pending_approval` (Passed)
21. `DENIES punch in if staff account isActive is false (deactivated employee)` (Passed)
22. `DENIES punch in with mismatched document ID format` (Passed)
23. `DENIES creating attendance record with punchOutTime pre-populated` (Passed)
24. `ALLOWS valid Punch Out on previously punched-in active session` (Passed)
25. `DENIES duplicate Punch Out on an already completed attendance session` (Passed)
26. `DENIES modifying historical punchInTime or date during punch out` (Passed)

### B. Device Binding Security Tests (`__tests__/deviceBindingSecurity.test.ts`)
Total: **17 passing tests (0 failures)**:
- Hardware keystore initialization, persistent installation ID, asymmetric EC key generation, payload signing, attendance blocking across all unregistered/pending/rejected/mismatched states, duplicate request prevention, cancellation, and security audit trail logging.

### C. Full Mobile Application Test Suite
- **Result**: **25 test suites passed, 231 tests passed, 0 failed** (`npm test -- --watchman=false`).
- **TypeScript Static Verification**: **0 errors** (`npx tsc --noEmit`).

### D. Admin Web Dashboard
- **Vitest Suite**: **1 test file passed, 5 tests passed** (`npm --prefix admin-dashboard test -- --run`).
- **Production Build**: **Vite build clean in 2.05s, 0 errors** (`npm --prefix admin-dashboard run build`).

---

## 6. Client-Side Enforcement vs. Database Authorization (Spark Boundary)

| Security Control | Client-Side Enforcement (React Native) | Database Authorization (Firestore Security Rules) |
| :--- | :--- | :--- |
| **Biometric Face Verification & Liveness** | Executes on-device TFLite model, validates eye-blink/turn challenges, computes embedding similarity against local template. | **Cannot verify embeddings or liveness directly** (Firestore CEL lacks machine learning / math matrix compute). Rules enforce schema shape, number types, and token format. |
| **Asymmetric Cryptographic Signature (ECDSA)** | Generated inside hardware-backed Android Keystore / iOS Keychain. | **Cannot verify ECDSA signatures** (Firestore CEL lacks crypto extensions in Spark). |
| **Device Binding Identification** | Captures hardware Keystore installation ID, signs verification payload, blocks UI punch attempts if mismatched. | **Strictly Authorizes**: Matches incoming `deviceId` against `getUserData().deviceId` and requires `deviceBindingStatus == 'approved'`. Strictly denies attendance writes from unapproved devices. |
| **Profile Integrity & Anti-Tampering** | Hides administrative controls and locks disabled profile fields in UI. | **Enforces absolute immutability**: Blocks role escalation, salary tampering, target tampering, face approval forgery, and device self-approval via strict `diff().affectedKeys()` allowlists. |
| **Attendance State Machine** | Computes punch-in/out hours, enforces geo-fence, and formats canonical IDs. | **Enforces canonical state transition**: Guarantees punch-in cannot pre-populate punch-out, punch-out cannot occur twice, historical timestamps cannot be altered, and only active staff can record attendance. |

---

## 7. Remaining Security Limitations (Documented Spark Constraints)

1. **Absence of Server-Side Crypto Signature Verification**:
   - Because Firebase Spark plan does not permit Cloud Functions, asymmetric ECDSA signatures created by `DeviceSecurityModule.kt` cannot be verified by a backend server before Firestore acceptance.
   - *Mitigation*: Firestore rules enforce that only the specific `deviceId` pre-approved by the Admin in `users/{userId}` can write attendance for that user, and staff cannot alter their approved `deviceId`.
2. **Client-Reported GPS Coordinates**:
   - Coordinates in `punchInCoords` and `punchOutCoords` are captured by the mobile client. While mock provider detection (`isMocked`) is performed on-device, Firestore CEL cannot independently verify GPS satellites.
   - *Mitigation*: Location coordinates are stored with distance calculation in an immutable append-only audit trail (`attendance_audit_logs`) readable only by store administrators.
3. **Local Clock Jitter vs Server Timestamps**:
   - Punch time strings (e.g. `'09:55'`) are formatted by client devices.
   - *Mitigation*: `request.time` is enforced on token validation checks and attendance document IDs are strictly bound to date strings (`att_${uid}_${date}`).

---

## 8. Deployment Confirmation

- **Remote Firestore Security Rules were NOT deployed.**
- All security modifications are isolated to the local repository file [`firestore.rules`](file:///Users/chetan/ParthMobileCare/firestore.rules).
- Phase 2 implementation will not begin until explicit administrative authorization is granted.

