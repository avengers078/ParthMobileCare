# Parth Mobile Care — Phase 1 Final Security Acceptance Audit

**Audit Date**: November 3, 2026  
**Auditor**: Independent Security Audit Agent  
**Environment**: Local Workspace (macOS)  
**Target Architecture**: Firebase Spark Plan (Free Tier, Zero Cloud Functions, Zero Blaze, Zero Firebase Storage)  
**Target Rules File**: [`firestore.rules`](file:///Users/chetan/ParthMobileCare/firestore.rules)  
**Remote Deployment Status**: **CONFIRMED: Remote rules were NOT deployed.**

---

## 1. Executive Summary & Verification Scorecard

| Security Requirement | Status | Detailed Finding |
| :--- | :---: | :--- |
| **1. Pending Device Binding Tampering Prevention** | **FAIL (Vulnerability)** | While approved device bindings (`status == 'approved'`) are locked and immutable, an account with status `pending_approval` can repeatedly modify `deviceId`, `devicePublicKey`, and `deviceModel` prior to admin approval. |
| **2a. Punch In Server Timestamp** | **FAIL (Limitation)** | Attendance `punchInTime` is stored as a client-formatted string (`"HH:MM"`), and `timestamp` is a client-generated ISO string. It does NOT use `FieldValue.serverTimestamp()`. |
| **2b. Punch Out Server Timestamp** | **FAIL (Limitation)** | Attendance `punchOutTime` is stored as a client-formatted string (`"HH:MM"`). It does NOT use `FieldValue.serverTimestamp()`. |
| **2c. Admin `reviewedAt` Timestamp** | **FAIL (Limitation)** | `reviewedAt` is validated as a non-empty string (`reviewedAt is string && reviewedAt.size() > 0`), not strictly enforced to equal `request.time`. |
| **3a. Punch In Allowed Only When No Active Session** | **PASS** | Document ID is bound to `att_${uid}_${date}` and uses `allow create`. Create fails if today's document already exists. |
| **3b. Punch Out Requires Existing Punch In** | **PASS** | `allow update` requires `punchOutTime` to be unset/empty on existing document and set in incoming resource. |
| **3c. Punch In Fields Immutable After Creation** | **PASS** | `id`, `userId`, `userName`, `userRole`, `date`, `punchInTime`, `punchInCoords`, `deviceId`, and `isLate` are strictly checked for equality. |
| **3d. Duplicate Punch Out Rejected** | **PASS** | Once `punchOutTime` is populated, subsequent update attempts fail. |
| **3e. `totalHours` Manipulation Prevention** | **FAIL (Spark Limitation)** | In Spark CEL rules, string-based times cannot be subtracted. Rules only check `totalHours is number && totalHours >= 0`. A modified client could send arbitrary `totalHours`. |
| **3f. Historical Attendance Modification Prevention** | **PARTIAL** | Staff cannot alter completed records, but a record left unpunched from an earlier date could technically be punched out later because rules do not enforce `resource.data.date == today`. |
| **3g. Attendance Status Values Validated** | **PASS** | On create, status is restricted to `['present', 'late']`. In `isValidAttendance`, status is restricted to `['present', 'late', 'half_day', 'early_exit', 'absent']`. |
| **4a. Device Change Request UID Binding** | **PASS** | `request.resource.data.userId == request.auth.uid`, `userName == getUserData().name`, `userEmail == getUserData().email`. |
| **4b. Device Change Request Post-Submission Immutability**| **PASS** | Staff update rule allows ONLY transition to `status: 'cancelled'`. Device keys/IDs cannot be altered after creation. |
| **4c. Staff Self-Approval Prevention** | **PASS** | Staff update rule forbids setting `status == 'approved'`. |
| **4d. Admin Transition Restriction** | **PASS** | Admin update requires `status in ['approved', 'rejected']`, `reviewedBy == request.auth.uid`, and mandatory non-empty `rejectionReason` on rejection. |
| **4e. Admin Review Device Key Tampering Prevention** | **PASS** | Admin affected keys allowlist excludes `userId`, `newDeviceId`, and `newDevicePublicKey`. |
| **5. Firestore Emulator & Rules Testing Validation** | **FAIL (Reporting Accuracy)** | Acceptance tests in `__tests__/firestoreRulesSecurityAcceptance.test.ts` are **Jest TypeScript mock tests**, NOT tests executed against a live Firebase Emulator or `@firebase/rules-unit-testing`. |
| **6. Complete Rules & Collection Preservation** | **PASS** | All 14 collections, subcollections (`kyc_sensitive`, `compensation`), and default deny root rules are preserved. |

---

## 2. Detailed Technical Findings

### Finding 1: Pending Device Binding Can Be Silently Replaced (Vulnerability)
- **File**: [`firestore.rules`](file:///Users/chetan/ParthMobileCare/firestore.rules#L652-L671)
- **Current Rule**:
  ```javascript
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
  ```
- **Vulnerability**:
  When a staff member registers a device, their status becomes `'pending_approval'`.
  The check `(!('deviceBindingStatus' in resource.data) || resource.data.deviceBindingStatus != 'approved')` evaluates to **TRUE** when `resource.data.deviceBindingStatus == 'pending_approval'`.
  As a result, a staff member can silently overwrite `deviceId`, `devicePublicKey`, and `deviceModel` while their registration is pending admin review.
- **Risk**: Staff could register a compliant device (e.g. store phone), and immediately swap the public key and device ID to an unvetted personal phone before the Admin reviews and clicks "Approve".

---

### Finding 2: Timestamp Architecture Relies on Client Strings (Spark Architectural Limitation)
- **File**: [`firestore.rules`](file:///Users/chetan/ParthMobileCare/firestore.rules#L309-L323) and [`src/services/attendanceService.ts`](file:///Users/chetan/ParthMobileCare/src/services/attendanceService.ts#L254-L260)
- **Current Implementation**:
  ```typescript
  // attendanceService.ts
  const timeNow = getCurrentTimeString(); // e.g. "09:55"
  const newRecord: AttendanceRecord = {
    ...
    punchInTime: timeNow,
    timestamp: new Date().toISOString(),
  };
  ```
  ```javascript
  // firestore.rules
  request.resource.data.punchInTime is string && request.resource.data.punchInTime.size() > 0
  ```
- **Limitation**:
  1. `punchInTime` and `punchOutTime` are client-supplied strings (`"HH:MM"`), not Firestore `FieldValue.serverTimestamp()`.
  2. `timestamp` is a client-supplied ISO string.
  3. Admin `reviewedAt` in `device_change_requests` is checked as `request.resource.data.reviewedAt is string`, not `request.resource.data.reviewedAt == request.time`.
- **Root Cause**: The application was built to run offline-first with local AsyncStorage caching and UI formatted time displays without Cloud Functions or Blaze triggers. Because Firestore Security Rules CEL cannot easily convert client string times to server timestamps, client clock drift or modified payloads can set arbitrary time strings.

---

### Finding 3: `totalHours` Cannot Be Enforced by CEL (Spark Architectural Limitation)
- **File**: [`firestore.rules`](file:///Users/chetan/ParthMobileCare/firestore.rules#L313)
- **Current Rule**:
  ```javascript
  data.totalHours is number && data.totalHours >= 0
  ```
- **Limitation**:
  Common Expression Language (CEL) in Firestore rules does not have string-to-time math functions to parse `"09:30"` and `"18:00"` and compute `(18 - 9.5) = 8.5` hours.
  The `totalHours` field is computed by the mobile client. While the client code computes it accurately, Firestore Security Rules cannot mathematically verify that `totalHours == (punchOutTime - punchInTime)`.

---

### Finding 4: Nature of Acceptance Tests (Mocked vs Emulator)
- **File**: [`__tests__/firestoreRulesSecurityAcceptance.test.ts`](file:///Users/chetan/ParthMobileCare/__tests__/firestoreRulesSecurityAcceptance.test.ts)
- **Audit Verification**:
  1. Does `@firebase/rules-unit-testing` exist in `package.json`? **No.**
  2. Does the project have a running Firebase Local Emulator? **No.**
  3. Command executed:
     ```bash
     npm test -- __tests__/firestoreRulesSecurityAcceptance.test.ts --watchman=false
     ```
  4. Output:
     ```
     PASS __tests__/firestoreRulesSecurityAcceptance.test.ts (26 passed, 26 total)
     ```
- **Clarification**:
  These 26 tests are **mocked TypeScript tests** that evaluate a simulated rule engine (`evaluateRule`) matching the syntax of `firestore.rules`.
  They do **not** run against the actual Google Cloud Firestore Security Rules emulator engine. Describing them as "Firestore Emulator Rules tests" was incorrect and has now been accurately classified.

---

## 3. Complete Collection Permissions Inventory

Every collection in `firestore.rules` was verified against unauthorized widening:

1. **`users/{userId}`**:
   - `read`: Admin or owner.
   - `create`: Admin, or invited staff with valid unexpired token (cannot set role, salary, target).
   - `update`: Admin, or owner (strict allowlist, but pending binding can be overwritten - see Finding 1).
   - `delete`: Admin only.
2. **`attendance/{attendanceId}`**:
   - `read`: Admin or owner.
   - `create`: Admin, or active staff on approved device (`deviceId == getUserData().deviceId`) with canonical ID.
   - `update`: Admin, or staff punching out (immutable punch-in attributes).
   - `delete`: Admin only.
3. **`attendance_audit_logs/{logId}`**:
   - `read`: Admin or owner.
   - `create`: Admin or owner.
   - `update`, `delete`: `false` (Immutable).
4. **`device_change_requests/{requestId}`**:
   - `read`: Admin or owner.
   - `create`: Admin, or owner matching Firestore profile.
   - `update`: Staff cancellation (`status == 'cancelled'`) or Admin review (`status in ['approved', 'rejected']`).
   - `delete`: Admin only.
5. **`staff_invitations/{invitationId}`**:
   - `list`: Admin only.
   - `get`: Admin, or holder of valid pending unexpired token.
   - `create`, `delete`: Admin only.
   - `update`: Admin, or staff accepting token (`diff().affectedKeys().hasOnly(['status', 'acceptedAt', 'acceptedByUid'])`).
   - `compensation/{docId}`: Admin only.
6. **`leads/{leadId}`**:
   - `read`, `update`: Admin, creator staff, or assigned staff.
   - `create`: Admin or creator staff.
   - `delete`: Admin only.
7. **`mobile_prices/{priceId}`**:
   - `read`: Authenticated users.
   - `create`, `update`, `delete`: Admin only.
8. **`second_hand_purchases/{purchaseId}`**:
   - `read`: Admin, purchasing staff, or in-stock.
   - `create`: Authenticated staff (with KYC & signature).
   - `update`, `delete`: Admin only.
   - `kyc_sensitive/{kycId}`: `read`/`update`/`delete`: Admin only; `create`: Purchasing staff only.
9. **`second_hand_sales/{saleId}`**:
   - `read`: Authenticated users.
   - `create`: Authenticated staff.
   - `update`, `delete`: Admin only.
10. **`sales_targets/{targetId}`**:
    - `read`: Authenticated users.
    - `create`, `update`, `delete`: Admin only.
11. **`salary_slips/{slipId}`**:
    - `read`: Admin or assigned staff.
    - `create`, `update`, `delete`: Admin only.
12. **`notifications/{notificationId}`**:
    - `read`, `create`: Authenticated users.
    - `update`: Mark read without body alteration.
    - `delete`: Admin only.
13. **`shop_config/{configId}`**:
    - `read`: Authenticated users.
    - `create`, `update`, `delete`: Admin only.
14. **`_connection_test/{testDocId}`**:
    - Diagnostic health check.
15. **`audit_logs/{logId}`**:
    - `read`: Admin only.
    - `create`: Admin matching `adminId == request.auth.uid`.
    - `update`, `delete`: `false` (Immutable).
16. **`/{document=**}` (Root Fallback)**:
    - `allow read, write: if false;` (Default Deny).

---

## 4. Test Execution Summary

### Mobile Test Suite
```bash
npm test -- --watchman=false
```
- **Test Suites**: 25 passed, 25 total
- **Tests**: 231 passed, 231 total
- **Snapshots**: 0
- **Time**: 1.772s
- **Status**: **PASS**

### TypeScript Check
```bash
npx tsc --noEmit
```
- **Status**: **PASS (0 errors)**

### Admin Dashboard Vitest
```bash
npm --prefix admin-dashboard test -- --run
```
- **Test Files**: 1 passed, 1 total
- **Tests**: 5 passed, 5 total
- **Time**: 424ms
- **Status**: **PASS**

### Admin Dashboard Production Build
```bash
npm --prefix admin-dashboard run build
```
- **Status**: **PASS (Vite production bundle built in 2.05s)**

---

## 5. Unresolved Issues & Recommendations Before Production

1. **Pending Device Binding Immutability**:
   - *Issue*: A staff user in `'pending_approval'` state can modify their `deviceId` and `devicePublicKey` before admin review.
   - *Fix*: Update `firestore.rules` to disallow changing `deviceId` or `devicePublicKey` when `resource.data.deviceBindingStatus in ['approved', 'pending_approval']`. Staff must only be allowed to submit device credentials when `deviceBindingStatus == 'unregistered'` or absent.
2. **Review Timestamp Strictness**:
   - *Issue*: Admin `reviewedAt` is validated as a non-empty string rather than `request.time`.
   - *Fix*: If server-enforced review timing is required, the Admin Web Dashboard must transition to `serverTimestamp()` or Firestore `Timestamp`, and rules must enforce `request.resource.data.reviewedAt == request.time`.
3. **Attendance Timestamp Strictness**:
   - *Issue*: Punch times are client strings.
   - *Spark Boundary*: In Firebase Spark, without Cloud Functions to translate client time strings, client-generated ISO strings are standard. For audit integrity, client coordinates and device IDs are mirrored to immutable `attendance_audit_logs`.
4. **Historical Punch-Out Window**:
   - *Issue*: A record from an unpunched past date could theoretically be punched out weeks later.
   - *Fix*: Add date check ensuring `resource.data.date` matches the current date string or a server timestamp window.

---

## 6. Final Confirmation

- **Remote Firestore Security Rules were NOT deployed.**
- Application code was **not modified** during this audit.
- Phase 2 has **not been started**.

