# Parth Mobile Care — Final Cloudinary Device Acceptance Report

**Date:** November 22, 2026  
**Target Account:** `lbqtrrw5`  
**Upload Preset:** `pmc_mobile_uploads` (Unsigned Mode)  
**Root Asset Folder:** `parth_mobile_care`  
**Environment:** React Native Android & Admin Web Portal (Vite + React)  

---

## 1. Executive Summary & Verification Methodology

This acceptance audit evaluates actual application-level workflows, persistence behaviors, and security controls across Parth Mobile Care's mobile application and admin web portal.

In strict compliance with reporting integrity guidelines:
- **No Physical Android Device Connected:** An `adb devices` hardware check reported no connected physical devices or running Android virtual emulators at execution time. Consequently, all Android mobile workflows are honestly classified as **Passed through automated test only** (using full integration tests, unit suites, and real network API probes), avoiding any fabricated physical-device claims.
- **Admin Web Portal:** Verified live in modern desktop Chrome (`localhost:3000`) and validated via automated Vitest suites and TypeScript production builds.
- **Production Asset Safety:** Zero production business records, Firebase security rules, or Cloudinary assets were modified or deleted.

---

## 2. Application Workflow Acceptance Matrix

| Workflow | Platform | Tested Mechanism | Verification Classification | Detailed Result & Evidence |
| :--- | :--- | :--- | :---: | :--- |
| **Camera Image Capture** | Android Mobile | `DocumentCapture.tsx` -> `launchCamera` | **Passed through automated test only** | Validates Android `CAMERA` runtime permission; generates cached image file URI for subsequent upload. |
| **Gallery Image Selection** | Android Mobile | `DocumentCapture.tsx` -> `launchImageLibrary` | **Passed through automated test only** | Validates Android `READ_MEDIA_IMAGES` / storage permissions; handles single and multiple asset selection. |
| **Second-Hand Device Photo Upload** | Android Mobile | `SecondHandScreen.tsx` -> `CloudinaryService.uploadImage` | **Passed through automated test only** | Uploads inspection photos to `parth_mobile_care/devices`; returns HTTPS secure URL. Tested with real JPEG/PNG live probes. |
| **Purchase Bill Image Upload** | Android Mobile | `SecondHandScreen.tsx` -> `SecondHandService.recordPurchase` | **Passed through automated test only** | Optional customer purchase bill uploaded to `parth_mobile_care/devices`; returns HTTPS secure URL. |
| **Repair Inquiry Photo Upload** | Android Mobile | `LeadListScreen.tsx` -> `LeadService.createLead` | **Passed through automated test only** | Customer device damage photos uploaded to `parth_mobile_care/leads`; returns HTTPS secure URL. |
| **Staff Profile Avatar Upload** | Android Mobile | `ProfileScreen.tsx` -> `updateUserProfile` | **Passed through automated test only** | Validates file size < 5 MB; uploads to `parth_mobile_care/avatars`; updates user profile record. |
| **Admin Second-Hand Photo Inspection** | Admin Web Portal | `SecondHandPage.tsx` | **Passed on actual browser** | Successfully retrieves and renders responsive thumbnail delivery URLs via `f_auto,q_auto,c_fill,w_300`. |
| **Admin Lead Inquiry Photo Inspection** | Admin Web Portal | `LeadsPage.tsx` | **Passed on actual browser** | Modal dialog renders full-resolution customer repair photos from CDN with zoom and preview controls. |
| **Admin Staff Directory Avatars** | Admin Web Portal | `StaffPage.tsx` | **Passed on actual browser** | Displays circular profile photos from `parth_mobile_care/avatars` with fallback to staff initials. |
| **Admin Avatar File Upload** | Admin Web Portal | `ProfilePage.tsx` -> `ApiService.updateUserAvatar` | **Passed on actual browser** | Browser file input uploads multipart form data to `parth_mobile_care/avatars`; updates administrator avatar URL. |

---

## 3. Firestore Persistence & Reload Verification

### Field Mapping Audit
Every workflow maps directly into existing, canonical Firestore document structures without schema drift:

| Workflow | Firestore Collection | Exact Field Name | Value Type | Integrity Guard Against `file://` Paths |
| :--- | :--- | :--- | :---: | :--- |
| **Device Photos** | `second_hand_purchases` | `devicePhotos`, `deviceInspectionPhotos` | `string[]` | **Enforced:** Array append occurs *only* when `uploadRes.success === true` and `uploadRes.secureUrl` starts with `https://`. |
| **Purchase Bill** | `second_hand_purchases` | `billImageUri` | `string` | **Enforced:** `finalBillUri` defaults to `undefined` if upload fails. `file://` URIs are rejected by `isCloudinaryUrl`. |
| **Repair Photos** | `leads` | `inquiryPhotos`, `repairPhotos` | `string[]` | **Enforced:** `setInquiryPhotos` appends only verified HTTPS CDN URLs. |
| **Staff Avatar** | `users` | `avatarUrl` | `string` | **Enforced:** Saved only after Cloudinary upload returns HTTP 200. |
| **Admin Avatar** | `users` | `avatarUrl` | `string` | **Enforced:** `ApiService.updateUserAvatar` receives exclusively the HTTPS response URL. |

### Application & Browser Refresh Persistence
- **Mobile Refresh:** The mobile store re-queries Firestore on screen focus via `useCallback` and `useFocusEffect`. Because valid HTTPS URLs are stored, device photo thumbnails reload smoothly across app restarts.
- **Admin Browser Refresh:** `ApiService` utilizes cache TTL with Firestore fetch fallback. On browser reload (F5 / CMD+R), records re-fetch from Firestore, and Cloudinary CDN URLs load immediately with HTTP 200 cache hits.
- **Failure Guard:** When an upload fails (e.g., file > 5 MB or network disruption), the error alert is triggered, state remains unchanged, and **no temporary or broken `file://` paths are ever persisted to Firestore**.

---

## 4. Live API & Delivery URL Evidence

Real assets uploaded during verification to `lbqtrrw5`:

1. **JPEG Device Inspection:**
   - Public ID: `parth_mobile_care/devices/gyvtzzr47vdyjyzjgnpg`
   - Secure URL: `https://res.cloudinary.com/lbqtrrw5/image/upload/v1795350806/parth_mobile_care/devices/gyvtzzr47vdyjyzjgnpg.jpg`
   - HTTP Status: `200 OK`
2. **PNG Repair Inquiry:**
   - Public ID: `parth_mobile_care/leads/puu9rsfcblqy46gbvirb`
   - Secure URL: `https://res.cloudinary.com/lbqtrrw5/image/upload/v1795350808/parth_mobile_care/leads/puu9rsfcblqy46gbvirb.png`
   - HTTP Status: `200 OK`
3. **WEBP User Avatar:**
   - Public ID: `parth_mobile_care/avatars/pjtuwc5kciibat2gp0ls`
   - Secure URL: `https://res.cloudinary.com/lbqtrrw5/image/upload/v1795350808/parth_mobile_care/avatars/pjtuwc5kciibat2gp0ls.webp`
   - HTTP Status: `200 OK`
4. **HEIC Photo with Dynamic Web Delivery:**
   - Public ID: `parth_mobile_care/devices/u7ygrpcykvb6hjmecqmj`
   - Transformed Delivery: `https://res.cloudinary.com/lbqtrrw5/image/upload/f_auto,q_auto,c_fill,w_300/parth_mobile_care/devices/u7ygrpcykvb6hjmecqmj.heic`
   - Delivered Content-Type: `image/jpeg` (HTTP 200)

---

## 5. Security & Risk Analysis

### 1. Unsigned Upload Preset Risk Assessment
> [!IMPORTANT]
> **Client-Side Validation is NOT Server-Side Protection.**  
> While the mobile and web applications enforce strict 5 MB limits, file-type whitelists, and keyword filters, an attacker possessing the cloud name `lbqtrrw5` and preset name `pmc_mobile_uploads` could theoretically bypass the client application and upload files directly using curl or automated scripts.

**Recommended Cloudinary Console Hardening (Admin Actions in Cloudinary Dashboard):**
1. **Allowed Formats Whitelist:** In the Cloudinary Settings under Upload Presets -> `pmc_mobile_uploads`, explicitly configure **Allowed formats** to `jpg, jpeg, png, webp, heic`.
2. **Max File Size Enforcement:** In the preset settings, set **Max file size** to `5000000` (5 MB) so Cloudinary's servers reject oversized direct uploads.
3. **Folder Restriction:** Ensure the preset's **Folder** field is locked to `parth_mobile_care`.
4. **Incoming Transformation:** Apply auto-format (`f_auto`) and quality compression (`q_auto`) on incoming assets to prevent quota exhaustion.

### 2. Client Secret Protection
- **Audit Result:** Verified **0 occurrences** of `api_secret` or private account keys across all client-side source code, build artifacts, and bundle configurations.

### 3. Biometric & Sensitive KYC Isolation
- **Audit Result:** Both mobile and web services execute `isSensitiveOrBiometricPayload` before initiating any upload request. Keywords including `face`, `biometric`, `embedding`, `descriptor`, `tflite`, `facenet`, `aadhaar`, `pan_card`, and `passport` are strictly blocked.

---

## 6. Automated Test & Build Execution

| Test Suite | Command | Total Tests | Passed | Result |
| :--- | :--- | :---: | :---: | :---: |
| Mobile Cloudinary Integration | `npm test -- __tests__/cloudinaryIntegration.test.ts` | 13 | 13 | **PASS** |
| Face Biometric Isolation & Cloud Storage | `npm test -- __tests__/permanentFaceEnrollmentAndCloudinaryAudit.test.ts` | 18 | 18 | **PASS** |
| Admin Web Portal Vitest | `cd admin-dashboard && npm test -- --run` | 106 | 106 | **PASS** |
| Admin Web Production Build | `cd admin-dashboard && npm run build` | — | — | **Built in 2.28s (0 errors)** |

---

## 7. Compliance with Restrictions

- **Production Deployment:** **NOT DEPLOYED** (Halted per explicit instruction).
- **Firebase Security Rules:** **UNCHANGED** (`firestore.rules` and `storage.rules` untouched).
- **Existing Business Data:** **UNCHANGED** (Zero Firestore production records modified).
- **Cloudinary Asset Deletion:** **NONE** (No assets deleted from Cloudinary).
