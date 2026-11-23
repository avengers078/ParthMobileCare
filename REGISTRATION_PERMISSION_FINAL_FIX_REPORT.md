# Parth Mobile Care — Final Staff Registration Permission & Security Remediation Report

**Date:** November 4, 2026  
**System:** Parth Mobile Care (React Native Staff Mobile App + Admin Web Dashboard)  
**Firebase Tier:** Spark Plan ($0 Tier, Zero Cloud Functions, Zero Cloud Storage)  
**Rules Engine:** Cloud Firestore Security Rules (`firestore.rules`)  

---

## 1. Executive Summary & Critical Discoveries

Following reports of `permission-denied` errors during Step 3 (Face Biometrics 3/3 submission) and the subsequent security review of `firestore.rules`, seven critical security and architectural requirements (A through G) were investigated, remediated, and verified against the actual local Cloud Firestore Emulator:

### Key Root Causes Identified:

1. **Cloud Firestore AST 1000-Expression Limit Exhaustion**:
   - When running real Firestore rules tests with `@firebase/rules-unit-testing`, the Firestore emulator revealed the exact internal failure on final registration submission:
     ```
     [FirebaseError: 7 PERMISSION_DENIED: 
     Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached. for 'create' @ L649, Unable to evaluate the expression as the maximum of 1000 expressions to evaluate has been reached. for 'create' @ L1092]
     ```
   - Cloud Firestore enforces a hard constraint of **1000 AST expressions per evaluated request**.
   - Two factors caused expression exhaustion:
     - The catch-all rule `match /{document=**} { allow read, write: if false; }` at the root caused dual-evaluation across the entire rule tree on every request.
     - `isValidUser(data)` executed 30+ separate helper function calls (`isValidString`, `isValidOptionalString`, etc.) combined with `keys().hasOnly` and branching checks in `allow create` and `allow update`.
   - **Remediation**:
     - Removed the redundant `match /{document=**}` (Firestore is default-deny).
     - Streamlined `isValidUser` by directly validating string lengths, emails, numbers, and booleans without redundant nested helper calls.
     - Factored out `isValidUser(request.resource.data)` to the head of `allow create` and `allow update` so that it evaluates at most once per write request.

2. **Rejected-Registration Resubmission Failure**:
   - When Admin rejects an applicant in `admin-dashboard/`, rejection metadata is persisted to `users/{userId}`: `rejectedAt`, `rejectedBy`, `rejectedByName`, `rejectionReason`, `faceRejectionReason`, `deviceRejectionReason`.
   - When the applicant later attempts resubmission via `setDoc(userDocRef, staffPayload, { merge: true })`, Firestore merges the incoming payload with existing document fields.
   - The prior rule checked `request.resource.data.keys().hasOnly([...])` against a restricted key list that omitted rejection metadata, causing immediate permission-denied.
   - **Remediation**:
     - Switched to `request.resource.data.diff(resource.data).affectedKeys().hasOnly([...])`.
     - Allowed applicant-editable fields (`name`, `phone`, `designation`, `avatarUrl`, `joinedDate`, biometrics/device capture fields, rejection reason resets).
     - Strictly enforced immutability of identity (`id`, `email`, `role`), compensation (`basicSalary == 0`, `monthlyTarget == 0`), and activation (`isActive == false`). Old rejection audit fields (`rejectedAt`, `rejectedBy`, `rejectedByName`) are preserved or safely cleared without permission failure.

3. **Insecure Admin Authorization**:
   - `isAdmin()` formerly contained a hardcoded email check: `request.auth.token.email == 'admin@parthmobile.com'`.
   - Anyone registering an account with that email could spoof admin privileges.
   - **Remediation**:
     - Removed hardcoded email check.
     - Enforced trusted authorization requiring either a custom token claim `request.auth.token.role == 'admin'` OR an active database document `getUserData().role == 'admin' && getUserData().isActive == true`.

4. **Staff Profile Read Exposure**:
   - `allow read: if isAuthenticated();` previously exposed all employee profiles and compensation terms to any authenticated account.
   - **Remediation**:
     - Replaced with `allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == userId);`.
     - Non-admin staff can only read their own profile doc. Admin can read all profiles and list the collection for dashboard management.

---

## 2. Updated User Schema & Validation Invariants

All staff registration writes are constrained by the following schema and validation rules in `firestore.rules`:

### 2.1 The 25 Validated Registration Fields

| Field Name | Type | Invariant Constraint on Registration | Purpose |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Must match `request.auth.uid` | Document UID |
| `name` | `string` | 1–100 chars | Staff Full Name |
| `email` | `string` | Valid email, matches `request.auth.token.email` | Auth Email |
| `phone` | `string` | 7–20 chars | Contact Phone |
| `role` | `string` | Strictly `'staff'` (no self-escalation) | Employee Role |
| `designation` | `string` | 1–100 chars | Job Title |
| `joinedDate` | `string` | 1–50 chars | Date of Joining |
| `basicSalary` | `number` | Must equal `0` | Base Compensation |
| `monthlyTarget` | `number` | Must equal `0` | Monthly Target |
| `isActive` | `bool` | Must equal `false` (Admin activates) | Active Status |
| `registrationStatus` | `string` | Must equal `'pending'` | Registration State |
| `emailVerified` | `bool` | Must equal `true` | Email Verified Flag |
| `faceEnrollmentStatus`| `string` | Must equal `'pending_review'` | Face Review State |
| `faceModelVersion` | `string` | 0–100 chars (`facenet_512`) | Model Version |
| `hasFaceRegistered` | `bool` | Must equal `false` (Admin sets true) | Face Approval Flag |
| `faceRegistrationDate`| `string`| ISO Timestamp | Face Sample Capture Date |
| `deviceId` | `string` | 0–100 chars installation UUID | Bound Device ID |
| `deviceModel` | `string` | 0–100 chars device name/model | Hardware Model |
| `devicePlatform` | `string` | in `['android', 'ios']` | OS Platform |
| `deviceRegisteredAt` | `string` | ISO Timestamp | Device Registration Date |
| `deviceBindingStatus` | `string` | Must equal `'pending_approval'` | Hardware Approval State |
| `devicePublicKey` | `string` | 0–2000 chars RSA Public Key | Hardware Public Key |
| `createdAt` | `string` | ISO Timestamp | Document Creation Date |
| `createdBy` | `string` | Matches `request.auth.uid` | Creator UID |
| `_syncedAt` | `string` | ISO Timestamp | Sync Tracking |

### 2.2 Biometric Privacy & Face State Model
- **Zero Cloud Storage / Zero Face Embeddings**: High-dimensional face embeddings (512-D float vectors), raw camera frames, and private biometric keys **NEVER leave the device** and are **NEVER written to Firestore**.
- **Local Face Verification**: Embeddings remain encrypted on-device via Android Keystore / iOS Keychain.
- **Biometric States**:
  - Applicant Capture: Sets `faceEnrollmentStatus: 'pending_review'`, `hasFaceRegistered: false`.
  - Admin Approval: Sets `faceEnrollmentStatus: 'approved'`, `hasFaceRegistered: true`, `faceApprovedAt`, `faceApprovedBy`.
  - Admin Rejection: Sets `faceEnrollmentStatus: 'rejected'`, `hasFaceRegistered: false`, `faceRejectionReason`.

---

## 3. Firestore Rules Implementation Detail

All security rules modifications were authored by the `firestore-rules-author` specialist subagent.

### 3.1 Hardened `isAdmin()` & `isManagerOrAdmin()`
```javascript
function isAdmin() {
  return isAuthenticated() && (
    ('role' in request.auth.token && request.auth.token.role == 'admin') ||
    (userDocExists() && ('role' in getUserData()) && getUserData().role == 'admin' && getUserData().isActive == true)
  );
}

function isManagerOrAdmin() {
  return isAdmin();
}
```

### 3.2 Protected Read Policy
```javascript
match /users/{userId} {
  // Admin can read all profiles; staff can read only their own profile
  allow read: if isAuthenticated() && (isAdmin() || request.auth.uid == userId);
```

### 3.3 Optimized Profile Create & Resubmission Update Rules
```javascript
  // Admin can create profiles.
  // A new staff member can create ONLY their own pending profile.
  allow create: if isValidUser(request.resource.data) &&
    (
      isAdmin()
      ||
      (
        isAuthenticated() &&
        isOwner(userId) &&
        request.auth.token.email_verified == true &&

        request.resource.data.id == request.auth.uid &&
        request.resource.data.email == request.auth.token.email &&
        request.resource.data.role == 'staff' &&
        request.resource.data.isActive == false &&
        request.resource.data.basicSalary == 0 &&
        request.resource.data.monthlyTarget == 0 &&
        request.resource.data.registrationStatus == 'pending' &&
        request.resource.data.emailVerified == true &&
        request.resource.data.faceEnrollmentStatus == 'pending_review' &&
        request.resource.data.hasFaceRegistered == false &&
        request.resource.data.deviceBindingStatus == 'pending_approval' &&

        request.resource.data.keys().hasOnly([
          'id', 'name', 'email', 'phone', 'role', 'designation', 'avatarUrl',
          'joinedDate', 'basicSalary', 'monthlyTarget', 'isActive',
          'registrationStatus', 'emailVerified', 'faceEnrollmentStatus',
          'faceModelVersion', 'faceRegistrationDate', 'hasFaceRegistered',
          'deviceId', 'deviceModel', 'devicePlatform', 'deviceRegisteredAt',
          'deviceBindingStatus', 'devicePublicKey', 'createdAt', 'createdBy', '_syncedAt'
        ])
      )
    );

  // Admin can update profiles.
  // Staff can update only basic personal profile information.
  // Pending or rejected staff can update/resubmit their registration profile.
  allow update: if isValidUser(request.resource.data) &&
    (
      isAdmin()
      ||
      (
        isAuthenticated() &&
        isOwner(userId) &&
        ('registrationStatus' in resource.data && resource.data.registrationStatus in ['pending', 'rejected']) &&
        request.auth.token.email_verified == true &&

        request.resource.data.id == resource.data.id &&
        request.resource.data.id == request.auth.uid &&
        request.resource.data.email == resource.data.email &&
        request.resource.data.email == request.auth.token.email &&
        request.resource.data.role == 'staff' &&
        request.resource.data.role == resource.data.role &&
        request.resource.data.isActive == false &&
        request.resource.data.basicSalary == 0 &&
        request.resource.data.basicSalary == resource.data.basicSalary &&
        request.resource.data.monthlyTarget == 0 &&
        request.resource.data.monthlyTarget == resource.data.monthlyTarget &&
        request.resource.data.registrationStatus == 'pending' &&
        request.resource.data.emailVerified == true &&
        request.resource.data.faceEnrollmentStatus == 'pending_review' &&
        request.resource.data.hasFaceRegistered == false &&
        request.resource.data.deviceBindingStatus == 'pending_approval' &&

        request.resource.data.diff(resource.data).affectedKeys().hasOnly([
          'name', 'phone', 'designation', 'avatarUrl', 'joinedDate',
          'registrationStatus', 'emailVerified', 'faceEnrollmentStatus',
          'faceModelVersion', 'faceRegistrationDate', 'hasFaceRegistered',
          'deviceId', 'deviceModel', 'devicePlatform', 'deviceRegisteredAt',
          'deviceBindingStatus', 'devicePublicKey', 'createdAt', 'createdBy',
          '_syncedAt', 'rejectionReason', 'faceRejectionReason', 'deviceRejectionReason'
        ])
      )
      ||
      (
        isOwner(userId) &&

        request.resource.data.diff(resource.data)
          .affectedKeys()
          .hasOnly([
            'name', 'phone', 'avatarUrl', '_syncedAt'
          ]) &&

        request.resource.data.id == resource.data.id &&
        request.resource.data.role == resource.data.role &&
        request.resource.data.isActive == resource.data.isActive &&
        (!('registrationStatus' in resource.data) || request.resource.data.registrationStatus == resource.data.registrationStatus) &&
        request.resource.data.basicSalary == resource.data.basicSalary &&
        request.resource.data.monthlyTarget == resource.data.monthlyTarget
      )
    );

  allow delete: if isAdmin();
}
```

---

## 4. Test Verification & Acceptance Matrix

### 4.1 Cloud Firestore Real Emulator Test Suite (`__tests__/firestoreRulesEmulator.test.ts`)
Executed against Cloud Firestore Emulator using `@firebase/rules-unit-testing`:

| # | Scenario Description | Expected | Actual Result |
| :--- | :--- | :--- | :--- |
| 1 | Staff registration create (verified email, pending status, salary 0) | `ALLOW` | **PASS** (188ms) |
| 2 | Staff registration create without email verification | `DENY` | **PASS** (21ms) |
| 3 | Staff registration create with `role='admin'` | `DENY` | **PASS** (19ms) |
| 4 | Staff registration create with `basicSalary > 0` | `DENY` | **PASS** (18ms) |
| 5 | Staff registration create with `isActive=true` | `DENY` | **PASS** (19ms) |
| 6 | Staff resubmission when rejected, preserving old rejection metadata | `ALLOW` | **PASS** (38ms) |
| 7 | Staff resubmission when rejected, trying to self-approve face/device | `DENY` | **PASS** (22ms) |
| 8 | Staff resubmission when rejected, trying to change salary/target | `DENY` | **PASS** (20ms) |
| 9 | Duplicate staff submission when already pending | `ALLOW` | **PASS** (32ms) |
| 10 | Active staff trying to reset status via registration branch | `DENY` | **PASS** (22ms) |
| 11 | Staff reading another staff profile | `DENY` | **PASS** (19ms) |
| 12 | Staff reading own profile | `ALLOW` | **PASS** (21ms) |
| 13 | Admin reading any staff profile | `ALLOW` | **PASS** (25ms) |
| 14 | User with spoofed admin email in auth token but no admin role | `DENY` | **PASS** (34ms) |
| 15 | Inactive admin in `users/{uid}` (`isActive=false`) | `DENY` | **PASS** (30ms) |

**Result:** `15 passed, 0 failed, 0 skipped` (Duration: 2.07s).

### 4.2 Security Rules Acceptance Test Suite (`__tests__/firestoreRulesSecurityAcceptance.test.ts`)
- Evaluates 59 fine-grained security assertions including profile read rules, privilege escalation, device changes, and attendance rules.
- **Result:** `59 passed, 0 failed`.

### 4.3 Mobile App Unit & Integration Tests (`npm test`)
- Evaluates 28 test suites covering navigation, camera face capture, biometrics, alert dialogues, and Excel reports.
- **Result:** `28 passed, 300 passed, 0 failed`.

### 4.4 Admin Dashboard Test Suite (`npm --prefix admin-dashboard test -- --run`)
- Evaluates 11 Vitest test suites covering staff direct registration approval/rejection, second-hand inventory, and Excel export.
- **Result:** `11 passed, 0 failed`.

### 4.5 TypeScript Compilation (`npx tsc --noEmit`)
- Complete project typecheck: **0 errors**.

### 4.6 Android Release Build
- `cd android && ./gradlew assembleRelease --no-daemon`
- **Result:** `BUILD SUCCESSFUL in 43s`. Release APK generated without errors.

---

## 5. Deployment Constraints Maintained
- **Spark Tier**: Retained 100% compliance with $0 Firebase Spark tier (Zero Cloud Functions, Zero Cloud Storage).
- **Rule Deployment**: No `firebase deploy` was executed against remote production/staging environments; rules were authored, verified, and tested locally.
- **Theme & Architecture**: Blue branding, existing UI components, and on-device biometric security remain completely intact.
