# PARTH MOBILE CARE — STAFF REGISTRATION & FACE RECOGNITION ARCHITECTURE AUDIT

**Date:** November 3, 2026  
**Auditor:** Antigravity System Architect & Security Lead  
**Scope:** Biometric Face Recognition, On-Device TFLite Pipeline, Staff Provisioning, Hardware Device Binding, and Attendance Verification  
**Target Environments:** React Native Mobile Client (`src/`) & Admin Web Dashboard (`admin-dashboard/`)  
**Architecture Constraint:** 100% Firebase Spark Plan Compatibility (Zero Blaze, Zero Cloud Functions, Zero Firebase Storage, Zero Paid Add-ons)

---

## EXECUTIVE SUMMARY

Parth Mobile Care currently possesses a hybrid architecture:
1. **Real Native Biometric Foundations:** Physical `.tflite` models (BlazeFace, FaceMesh, FaceNet 512D, and 2x Silent-Face Anti-Spoofing models) are already bundled directly on disk in `src/assets/faceModels/` and packaged into Android assets. A native integration module (`react-native-offline-face-auth` + `react-native-fast-tflite` + `react-native-keychain`) is wired in.
2. **Architectural Gaps & Incomplete Modules:** 
   - A critical discrepancy exists between the bundled 512-dimensional FaceNet model and legacy 128-dimensional mock/fallback utilities in `faceRecognitionService.ts`.
   - The device identifier is hardcoded as `'parth-mobile-care-device'` across all devices, meaning there is zero hardware device binding.
   - Face registration review workflows exist inside a legacy mobile modal (`FaceMonitoringModal.tsx`), but the mobile app has been migrated to Staff-only, while the Admin Web Dashboard (`admin-dashboard/`) possesses no face approval or device authorization capabilities.
   - Cryptographic verification tokens are generated and verified on the client using a hardcoded shared secret (`HMAC_SECRET = 'PMC_BIOMETRIC_HMAC_SECRET_KEY_v1_2026'`).
   - Attendance timestamps rely on device clocks (`new Date().toISOString()`), which allows device-time manipulation.

This audit documents every component, identifies all vulnerabilities, maps existing Firestore schemas and rules, and defines a robust, Spark-compatible target architecture and phased roadmap.

---

## 1. EXISTING IMPLEMENTATION & EXACT FILE PATHS

The staff registration, biometric face authentication, device management, and attendance systems span the following files:

### A. Mobile Application (`src/`)

| File Path | Component / Service | Core Responsibility |
|---|---|---|
| `src/assets/faceModels/manifest.json` | Model Manifest | SHA-256 hashes and input tensor dimensions for all 5 TFLite models. |
| `src/assets/faceModels/blazeface.tflite` | TFLite Model (229 KB) | Face bounding box & 6-point landmark detection (128x128 input). |
| `src/assets/faceModels/face_mesh.tflite` | TFLite Model (1.2 MB) | 468-point 3D facial landmark mesh for head pose estimation (192x192 input). |
| `src/assets/faceModels/facenet_512.tflite` | TFLite Model (47.0 MB) | 512-dimensional L2-normalized biometric embedding extractor (160x160 input). |
| `src/assets/faceModels/spoof_2_7.tflite` | TFLite Model (5.9 MB) | MiniVision Silent-Face Anti-Spoofing scale 2.7 (80x80 input). |
| `src/assets/faceModels/spoof_4_0.tflite` | TFLite Model (6.4 MB) | MiniVision Silent-Face Anti-Spoofing scale 4.0 (80x80 input). |
| `src/services/onDeviceFaceAuth.ts` | Bridge Service | Native initialization wrapper for `react-native-offline-face-auth` and Keystore. |
| `src/services/faceRecognitionService.ts` | Biometric Engine | Token generation, validation, fallback mock descriptors, cosine similarity matching. |
| `src/components/OnDeviceFaceAuthView.tsx` | Viewfinder Component | Integrates `useTensorflowModel` hooks with `FaceAuthView`, handles dev bypasses. |
| `src/components/FaceRegistrationModal.tsx` | Enrollment Flow | Guided UI for capturing 3 consecutive face samples and checking consent. |
| `src/components/FaceVerificationModal.tsx` | Verification Flow | Modal triggered during Punch In / Out to authenticate staff against stored templates. |
| `src/components/FaceMonitoringModal.tsx` | Legacy Admin Modal | Mobile-based admin interface for reviewing pending staff face enrollments. |
| `src/services/attendanceService.ts` | Attendance Engine | Business hours check, geofencing (30m), biometric token validation, duplicate check. |
| `src/screens/AttendanceScreen.tsx` | Staff Attendance UI | Punch In/Out buttons, GPS live status, attendance summary cards, punch logs. |
| `src/services/staffProvisioningService.ts` | Staff Auth Service | Token verification (`PMC-INV-XXXX-YYYY`), Auth account creation, profile binding. |
| `src/screens/LoginScreen.tsx` | Mobile Login UI | Staff login and invitation redemption modal. |
| `src/services/storageService.ts` | Local Storage & Cache | AsyncStorage persistence for `@pmc_face_templates`, `@pmc_attendance`, and sync queues. |
| `src/services/firestoreSync.ts` | Firestore Sync Engine | Two-way replication between local AsyncStorage and Cloud Firestore. |

### B. Admin Web Dashboard (`admin-dashboard/`)

| File Path | Component / Service | Core Responsibility |
|---|---|---|
| `admin-dashboard/src/pages/StaffPage.tsx` | Staff Directory & Invitations | Staff CRUD, invitation code generation, basic salary/target configuration. |
| `admin-dashboard/src/pages/AttendancePage.tsx` | Attendance Logs & Overrides | Store-wide attendance history, manual manager punch override. |
| `admin-dashboard/src/services/api.ts` | Web Firestore Service | Direct Firestore queries for staff, invitations, attendance, and audit logs. |
| `admin-dashboard/src/context/AuthContext.tsx` | Admin Auth Context | Firebase Auth sign-in, session persistence, role verification. |

### C. Backend Configuration & Infrastructure

| File Path | Component | Core Responsibility |
|---|---|---|
| `firestore.rules` | Security Rules | Client access controls for `users`, `attendance`, `staff_invitations`, `audit_logs`. |
| `scripts/patch-face-auth.js` | Build Patch Script | Strips debug frame dumping from native code and patches Worklets Babel plugin. |

---

## 2. WORKING FEATURES (VERIFIED IN CODE)

1. **Physical TFLite Model Bundling:**
   - All 5 `.tflite` model files exist on disk in `src/assets/faceModels/`.
   - Android release assets are verified in `android/app/build/generated/res/react/release/raw/src_assets_facemodels_*.tflite`.
   - SHA-256 integrity verification is configured via `manifest.json`.
2. **Hardware-Backed Keystore Integration:**
   - `react-native-keychain` is installed and leveraged by `react-native-offline-face-auth/src/secure/keystore.ts`.
   - Generates a 256-bit data encryption key (DEK) stored inside Android Keystore (`KeyStore.getInstance("AndroidKeyStore")`) with StrongBox/TEE fallback.
3. **Local Face Template Isolation (Zero Cloud Biometrics):**
   - In `FaceRecognitionService.registerOnDeviceFaceTemplate`, `faceDescriptor` is stored as an empty array `[]` when saved to Firestore or AsyncStorage.
   - Raw face vectors are retained purely inside the native Keystore-backed `SecureKV` on the physical phone.
4. **Attendance Geo-Fencing & Shift Rules:**
   - Live GPS location acquisition with multi-tier fallback (GPS -> Network -> Cache).
   - High-accuracy Haversine distance calculation strictly rejecting punches beyond the 30-meter shop radius.
   - Business hours check preventing punches before opening or after closing.
5. **Staff Invitation & One-Time Token Redemption:**
   - Admin generates 7-day expiring tokens (`PMC-INV-XXXX-YYYY`).
   - Staff redeems invitation on mobile app; Firestore rules restrict invitation document updates strictly to `['status', 'acceptedAt', 'acceptedByUid']` via `diff().affectedKeys()`.
   - Profile creation is locked to the authenticated user's UID and validated email.
6. **Attendance State Transition & Local Duplicate Prevention:**
   - Staff cannot punch in twice on the same calendar day.
   - Staff cannot punch out without an active punch in.

---

## 3. DUMMY, SYNTHETIC, OR INCOMPLETE IMPLEMENTATIONS

### A. Vector Dimension Mismatch (512D vs 128D)
- **Native TFLite Model:** The bundled FaceNet model (`facenet_512.tflite`) outputs a **512-dimensional** float array (`Float32Array(512)`).
- **Service Constants:** `BIOMETRIC_CONFIG.VECTOR_DIMENSIONS` in `faceRecognitionService.ts` is hardcoded to **128**.
- **Mock Fallback Generator:** `generateDescriptorFromSeed` in `faceRecognitionService.ts` produces 128-dimensional vectors from SHA-256 strings.
- **Impact:** If code paths inadvertently mix native 512D embeddings with legacy 128D routines, cosine dot products will crash or yield `NaN`.

### B. Dev Override & Synthetic Embeddings in Viewfinder
- `OnDeviceFaceAuthView.tsx` defines a bypass button `Bypass Face Check (Dev Override)` active in `__DEV__`.
- It synthesizes an artificial vector via `createMockEmbeddingB64()` (a sine wave generator: `floats[i] = Math.sin(i + 1) * 0.1`).
- If native TFLite is unavailable or unlinked on an emulator, the viewfinder immediately falls back to synthetic pass results (`matchScore: 0.95, livenessScore: 0.98`).

### C. Hardcoded Device Identifier (Zero Device Binding)
- In `src/services/onDeviceFaceAuth.ts`, initialization contains:
  ```typescript
  await FaceAuth.init({
    deviceId: 'parth-mobile-care-device', // <-- HARDCODED
    debug: false,
    challenges: ['blink', 'smile', 'turn_head'],
    thresholds: { fineThreshold: 0.8, matchCosine: 0.8 },
  });
  ```
- In `src/services/faceRecognitionService.ts`, `getDeviceInfo()` returns:
  ```typescript
  return {
    platform: Platform.OS,
    model: Platform.select({ android: 'Android Native Client', ios: 'iOS Client', default: 'Mobile Device' }),
    appVersion: '1.0.0',
    enrolledAt: new Date().toISOString(),
  };
  ```
- **Finding:** No unique device fingerprint (e.g., Android Keystore hardware key, Android ID, or unique device GUID) is captured or registered in Firestore.

### D. Missing Face Approval Workflow on Admin Web Dashboard
- `FaceMonitoringModal.tsx` was written as a React Native mobile component with approve/reject buttons.
- Following the Phase 1 migration, the mobile app is strictly **Staff-only**. Store admins no longer use the mobile app.
- On the Admin Web Dashboard (`admin-dashboard/src/pages/StaffPage.tsx`), line 840 only renders:
  ```tsx
  {selectedStaff.hasFaceRegistered ? 'Enrolled in mobile app' : 'Not Enrolled / Pending Setup'}
  ```
- **Finding:** There is currently NO UI, NO route, and NO API method in the Web Dashboard for an admin to view pending face enrollments, inspect enrollment metadata, approve, or reject biometric profiles.

### E. Missing KYC & Document Storage Integration
- Staff registration creates only basic profile fields: `name`, `email`, `phone`, `role`, `designation`, `basicSalary`, `monthlyTarget`.
- No KYC collection (Aadhaar, PAN, address proof) exists in the registration flow.
- While subcollection `users/{uid}/kyc_sensitive` is protected in `firestore.rules`, there is no frontend screen in the mobile app or web dashboard to submit or review KYC records.

---

## 4. SECURITY VULNERABILITIES & RISKS

### Vulnerability 1: Client-Side Token Generation with Hardcoded HMAC Secret (CRITICAL)
- **Location:** `src/services/faceRecognitionService.ts:23`, `546`
- **Issue:**
  ```typescript
  export const BIOMETRIC_CONFIG = {
    HMAC_SECRET: 'PMC_BIOMETRIC_HMAC_SECRET_KEY_v1_2026',
    ...
  };
  ...
  const signature = hmacSha256(BIOMETRIC_CONFIG.HMAC_SECRET, payload);
  ```
- **Risk:** The biometric verification token is generated, signed, and validated entirely in client-side JavaScript using a static string bundled into the APK. Any attacker inspecting the React Native JS bundle can extract this key, synthesize arbitrary tokens with `similarityScore: 0.99`, and bypass face recognition.

### Vulnerability 2: Absence of Hardware Device Binding & Multi-Device Fraud (HIGH)
- **Location:** `src/services/onDeviceFaceAuth.ts:27`
- **Issue:** Staff credentials can be shared across multiple devices. Since `deviceId` is a static constant and `users/{uid}` does not store a hardware-bound device public key, an employee can log in on a colleague's phone and punch attendance while physically absent from the store.

### Vulnerability 3: Client Device Time Reliance & Manipulation (HIGH)
- **Location:** `src/services/attendanceService.ts:64-65`, `239-240`
- **Issue:** Attendance records use:
  ```typescript
  const today = getTodayDateString(); // from device clock
  const timeNow = getCurrentTimeString(); // from device clock
  timestamp: new Date().toISOString()
  ```
- **Risk:** A staff member arriving late (e.g., at 10:45 AM) can change their Android system clock back to 09:55 AM before opening the app. The app will calculate `isPunchInLate = false` and record on-time arrival.

### Vulnerability 4: Lack of Mandatory Email Verification on Registration (MEDIUM)
- **Location:** `src/services/staffProvisioningService.ts:98-124`
- **Issue:** When staff redeem an invitation token, an account is created using `createUserWithEmailAndPassword`. The code does not require `user.emailVerified == true` before granting app access.

---

## 5. EXISTING FIRESTORE SCHEMA & RULES DEPENDENCIES

### A. Current Firestore Collections

```
/users/{userId}
  ├── id: string (matches auth.uid)
  ├── email: string
  ├── name: string
  ├── role: "admin" | "staff"
  ├── hasFaceRegistered: boolean
  ├── faceEnrollmentStatus: "not_enrolled" | "pending_approval" | "approved" | "rejected"
  ├── faceApprovedAt: string (ISO)
  ├── faceApprovedBy: string
  ├── faceRejectionReason: string
  └── kyc_sensitive/{docId} (subcollection, isolated)

/attendance/{recordId}
  ├── id: string ("att_{userId}_{YYYY-MM-DD}")
  ├── userId: string (matches auth.uid)
  ├── userName: string
  ├── date: string ("YYYY-MM-DD")
  ├── punchInTime: string ("HH:mm")
  ├── punchOutTime: string ("HH:mm")
  ├── punchInCoords: { latitude, longitude, distanceMeters, accuracyMeters, timestamp, isMocked }
  ├── punchOutCoords: { latitude, longitude, distanceMeters, accuracyMeters, timestamp, isMocked }
  ├── status: "present" | "late" | "half_day" | "absent"
  ├── totalHours: number
  ├── isLate: boolean
  ├── isEarlyExit: boolean
  ├── verificationMethod: "face_recognition" | "manual_override"
  ├── faceVerificationScore: number (0.00 - 1.00)
  ├── faceLivenessScore: number (0.00 - 1.00)
  └── faceVerificationTokenId: string

/staff_invitations/{invitationId}
  ├── token: string ("PMC-INV-XXXX-YYYY")
  ├── invitedEmail: string
  ├── role: "staff"
  ├── status: "pending" | "accepted" | "revoked" | "expired"
  ├── expiresAt: timestamp
  ├── acceptedAt: timestamp
  └── acceptedByUid: string

/attendance_audit_logs/{logId}
  ├── userId: string
  ├── userName: string
  ├── action: "punch_in" | "punch_out" | "register_face"
  ├── status: "success" | "blocked" | "failed"
  ├── reason: string
  ├── similarityScore: number
  ├── livenessScore: number
  └── timestamp: timestamp
```

### B. Firestore Rules Analysis (`firestore.rules`)
- **`users` Collection:**
  - Authenticated staff can read and update their own document: `request.auth.uid == userId`.
  - Sensitive fields (`role`, `status`) cannot be modified by staff.
  - **Limitation:** Staff can update their own `faceEnrollmentStatus` unless rule fields are explicitly constrained.
- **`attendance` Collection:**
  - Staff can create an attendance record only if `request.resource.data.userId == request.auth.uid`.
  - Document ID convention `att_{userId}_{YYYY-MM-DD}` inherently prevents duplicate punches on the same day because Firestore document creation fails if write rules require non-existence or if client creates with existing ID.
- **Security Rule Hardening Needed:**
  - Restrict `faceEnrollmentStatus`, `faceApprovedAt`, and `faceApprovedBy` so they can ONLY be updated by `isAdmin()`. Staff should only be permitted to transition from `not_enrolled` to `pending_approval`.

---

## 6. FIREBASE SPARK PLAN COMPATIBILITY VERIFICATION

| Spark Constraint | Architecture Strategy & Compliance |
|---|---|
| **Zero Cloud Functions** | **100% Compliant.** All AI inferencing (face detection, liveness, embedding extraction, cosine matching) is executed 100% on-device via `react-native-fast-tflite`. Validation logic executes within Firestore Security Rules and client-side deterministic verification. |
| **Zero Firebase Storage** | **100% Compliant.** No biometric photos or raw embeddings are ever uploaded to cloud storage. Embeddings remain in the phone's Android Keystore / EncryptedSharedPreferences. Only cryptographic hashes, quality metrics, and approval statuses are recorded in Firestore documents. |
| **Zero Paid Cloud Add-ons** | **100% Compliant.** No third-party facial recognition APIs (AWS Rekognition, Google Cloud Vision, Azure Face API) are utilized. The bundled open-source models (BlazeFace, FaceNet, MiniVision Silent-Face) are entirely self-hosted within the app. |
| **Firestore Free Tier Quotas** | **100% Compliant.** Spark provides 50,000 document reads and 20,000 document writes per day. For a 10-15 person retail staff team, daily attendance, enrollment, and logging generate fewer than 200 writes and 500 reads per day (<1.5% of free quotas). |

---

## 7. RECOMMENDED ARCHITECTURE

```
                               ┌─────────────────────────────────────────────────────────┐
                               │                ADMIN WEB DASHBOARD                      │
                               │  - Creates Staff Invitation (PMC-INV-XXXX-YYYY)         │
                               │  - Reviews Pending Face Enrollments (Metadata & Audits) │
                               │  - Approves / Rejects Biometric Registration            │
                               │  - Authorizes Device Binding / Reset Requests           │
                               └────────────────────────────┬────────────────────────────┘
                                                            │ Reads/Writes Firestore
                                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                CLOUD FIRESTORE (SPARK PLAN)                            │
│  - /users/{uid} ─── Stores enrollment status, approved deviceId, devicePublicKey      │
│  - /attendance/{att_uid_date} ─── Idempotent daily punches with serverTimestamp()      │
│  - /attendance_audit_logs/{id} ─── Tamper-evident biometric audit trail                 │
└───────────────────────────────────────────▲────────────────────────────────────────────┘
                                            │ Reads/Writes Firestore (Rules Enforced)
┌───────────────────────────────────────────┴────────────────────────────────────────────┐
│                             STAFF REACT NATIVE MOBILE APP                              │
│                                                                                        │
│  ┌─────────────────────────┐   ┌──────────────────────────┐   ┌─────────────────────┐  │
│  │   HARDWARE ATTESTATION  │   │  ON-DEVICE CAMERA AI     │   │ ATTENDANCE ENGINE   │  │
│  │ - Android Keystore DEK  │   │ - BlazeFace (128x128)    │   │ - 30m GPS Geofence  │  │
│  │ - Device Hardware UUID  │──▶│ - Silent-Face Anti-Spoof │──▶│ - Server Timestamp  │  │
│  │ - 1 Phone = 1 Staff ID  │   │ - FaceNet 512D Embedding │   │ - Idempotent Punch  │  │
│  └─────────────────────────┘   │ - Keystore Secure Store  │   └─────────────────────┘  │
│                                └──────────────────────────┘                            │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key Architectural Pillars:

1. **Hardware-Backed Device Binding (1 Phone = 1 Staff ID):**
   - On initial registration, the mobile app generates a unique hardware key pair inside Android Keystore (`react-native-keychain`).
   - The device hardware fingerprint and public key are submitted to `users/{uid}` under `enrolledDeviceId`.
   - Any login from a different physical phone will be flagged as `DEVICE_UNRECOGNIZED` and blocked until an admin resets the binding on the Web Dashboard.
2. **512-Dimensional Consolidated Pipeline:**
   - Standardize all embedding representations to 512-dimensional floats (`Float32Array(512)`), deprecating the 128D legacy fallback.
   - Retain raw embeddings strictly in local Keystore encrypted storage; never synchronize biometric vectors to Firestore.
3. **Web-Based Biometric Approval Workflow:**
   - Implement a dedicated "Biometric Approvals" tab inside `admin-dashboard/src/pages/StaffPage.tsx`.
   - When staff complete 3 on-device enrollment samples, the mobile app sets `faceEnrollmentStatus = 'pending_approval'`.
   - The admin reviews staff metadata, device info, and sample quality score on the Web Dashboard and marks it `approved` or `rejected`.
   - Mobile app strictly rejects Attendance Punch In/Out until status is `approved`.
4. **Tamper-Resistant Attendance with Server Timestamps:**
   - Enforce Firestore `request.time` in `firestore.rules` for all punch operations.
   - In `attendanceService.ts`, validate local device clock against network time or server time to prevent clock rollback attacks.

---

## 8. EXACT FILES THAT WILL NEED MODIFICATION

When implementation begins, changes will be isolated to the following files:

| File Path | Nature of Change |
|---|---|
| `src/services/onDeviceFaceAuth.ts` | Replace hardcoded `'parth-mobile-care-device'` with unique hardware device ID derived from Keystore. |
| `src/services/faceRecognitionService.ts` | Standardize vector dimensions to 512D; remove hardcoded client HMAC secret; bind tokens to device Keystore. |
| `src/components/OnDeviceFaceAuthView.tsx` | Align viewfinder hooks to 512D model; disable simulated Dev Bypass in production builds. |
| `src/screens/AttendanceScreen.tsx` | Enforce admin approval gating; check device binding before opening camera; display approval status. |
| `src/services/attendanceService.ts` | Add device binding check; integrate Firestore `serverTimestamp()` validation; prevent clock manipulation. |
| `src/services/storageService.ts` | Add device binding persistence; update user face status synchronization. |
| `admin-dashboard/src/pages/StaffPage.tsx` | Add "Biometric Approvals" management tab, Device Binding Reset button, and Approval/Rejection modal. |
| `admin-dashboard/src/services/api.ts` | Add Firestore update methods for `approveStaffFace`, `rejectStaffFace`, and `resetStaffDevice`. |
| `firestore.rules` | Harden `users` write rules to prevent staff from self-approving `faceEnrollmentStatus`; enforce deviceId immutability. |

---

## 9. MISSING DEPENDENCIES & MODEL FILES

### A. Model Files Status: COMPLETE (No Missing Files)
All 5 required model files are present on disk and verified:
- `blazeface.tflite` (229 KB)
- `face_mesh.tflite` (1.2 MB)
- `facenet_512.tflite` (47 MB)
- `spoof_2_7.tflite` (5.9 MB)
- `spoof_4_0.tflite` (6.4 MB)

### B. Dependencies Status
All necessary native libraries are already present in `package.json`:
- `"react-native-fast-tflite": "^1.6.1"`
- `"react-native-offline-face-auth": "0.1.0"`
- `"react-native-keychain": "^10.0.0"`
- `"react-native-vision-camera": "^4.7.3"`
- `"react-native-worklets-core": "^1.3.3"`

*Note:* For hardware device identification, the native Android Keystore key generated by `react-native-keychain` provides hardware-backed persistence. No additional third-party dependencies are required.

---

## 10. PHASED IMPLEMENTATION PLAN

```
┌────────────────────────────────────────────────────────────────────────┐
│                        PHASED IMPLEMENTATION ROADMAP                   │
├───────────────────┬───────────────────┬─────────────────┬──────────────┤
│      PHASE 1      │      PHASE 2      │     PHASE 3     │   PHASE 4    │
│  Hardware Device  │   512D Pipeline   │  Admin Web Flow │ Attendance   │
│  Binding & Keys   │   Consolidation   │  & Approvals    │ Hardening    │
├───────────────────┼───────────────────┼─────────────────┼──────────────┤
│ • Keystore Device │ • Standardize     │ • Biometric tab │ • Server     │
│   UUID generation │   512D in service │   in Web Staff  │   timestamp  │
│ • Lock 1 phone    │ • Remove legacy   │ • Approve/Reject│   validation │
│   to 1 Staff UID  │   128D fallbacks  │   actions       │ • Device     │
│ • Firestore schema│ • Remove client   │ • Device reset  │   binding    │
│   binding updates │   HMAC secret     │   management    │   check      │
└───────────────────┴───────────────────┴─────────────────┴──────────────┘
```

### Phase 1: Hardware Device Binding & Keystore Security
1. Implement unique hardware device key generation via `react-native-keychain`.
2. Add `enrolledDeviceId` and `deviceBoundAt` fields to `users/{uid}` in Firestore.
3. Update mobile app authentication to verify that current device matches `enrolledDeviceId`.
4. Allow device re-binding only upon Administrator reset.

### Phase 2: FaceNet 512D Pipeline Consolidation & Secret Removal
1. Update `faceRecognitionService.ts` to operate strictly on 512-dimensional vectors matching `facenet_512.tflite`.
2. Remove hardcoded `HMAC_SECRET` and replace client token signing with Keystore-backed signature validation.
3. Remove synthetic 128D mock generator and ensure production builds strictly require live camera input.

### Phase 3: Admin Web Dashboard Approval & Management Interface
1. Add a "Biometric Management" tab to `StaffPage.tsx` on the Admin Web Dashboard.
2. Display staff enrollment status (`Not Enrolled`, `Pending Approval`, `Approved`, `Rejected`), device model, and enrollment timestamp.
3. Provide one-click "Approve Face Enrollment", "Reject Face Enrollment", and "Reset Device Binding" actions.
4. Update `firestore.rules` so only `isAdmin()` can modify `faceEnrollmentStatus` and `enrolledDeviceId`.

### Phase 4: Attendance Verification & Anti-Tampering Hardening
1. In `attendanceService.ts`, mandate:
   - Valid device hardware match.
   - `faceEnrollmentStatus === 'approved'`.
   - Valid 30-meter GPS proximity.
   - Network/server time check preventing local device clock rollbacks.
2. Enforce idempotent Firestore document writes (`att_{userId}_{date}`) to guarantee zero duplicate punches.
3. Run end-to-end integration tests verifying complete flow from Web invitation to Mobile enrollment to Web approval to Mobile attendance punch.

---

## CONCLUSION

The Parth Mobile Care codebase already contains the heavy machinery for on-device AI biometrics, including genuine TFLite models and Keystore encryption. By closing the identified gaps—standardizing on the 512D pipeline, enforcing hardware device binding, migrating biometric approvals to the Admin Web Dashboard, and locking down Firestore Security Rules—the application will deliver a bank-grade, tamper-resistant staff registration and face attendance system while remaining **100% within the free Firebase Spark plan**.
