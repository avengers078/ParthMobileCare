# Parth Mobile Care — Old Cloudinary Disconnection Report

**Date of Execution:** November 22, 2026  
**Status:** COMPLETED (Controlled Local Disconnection & Verification)  
**Firebase Project:** `parthmobilecare-a474d`  
**Disconnection Target:** Old Cloudinary configuration (`parthmobilecare` / `pmc_device_photos`)

---

## 1. Executive Summary

A controlled, zero-downtime removal of the obsolete Cloudinary integration was performed across both the **React Native Mobile Application** and the **Admin Web Portal**. 

The old, non-functional credentials (`cloudName: 'parthmobilecare'` and `uploadPreset: 'pmc_device_photos'`) have been removed from the application configuration. The system is now cleanly set to a disconnected/paused state:
- All local camera, gallery selection, validation, and on-device preview capabilities remain 100% functional.
- Temporary Android cache paths (`file:///data/user/0/...`) are strictly prevented from being written to Firestore as permanent cross-device image URLs.
- Clear user alerts notify staff and administrators when cloud image uploads are paused, preventing any false upload-success messages.
- Zero production Firestore records, security rules, Firebase Auth accounts, biometrics, or attendance workflows were modified.

---

## 2. Files Inspected

The following files across the repository were audited and inspected:
1. `src/services/cloudinaryService.ts` (Mobile Cloudinary service)
2. `admin-dashboard/src/services/cloudinaryService.ts` (Admin Web Cloudinary service)
3. `src/screens/SecondHandScreen.tsx` (Device purchase bills & inspection photos)
4. `src/screens/LeadListScreen.tsx` (Customer repair inquiry photos)
5. `src/screens/ProfileScreen.tsx` (Staff profile avatar)
6. `admin-dashboard/src/pages/ProfilePage.tsx` (Admin profile avatar)
7. `admin-dashboard/src/pages/StaffPage.tsx` (Staff avatar display)
8. `admin-dashboard/src/pages/LeadsPage.tsx` (Repair inquiry photos modal)
9. `admin-dashboard/src/pages/SecondHandPage.tsx` (Device photos modal & purchase bills)
10. `admin-dashboard/.env.example` (Web environment template)
11. `__tests__/cloudinaryIntegration.test.ts` (Mobile Jest test suite)
12. `__tests__/permanentFaceEnrollmentAndCloudinaryAudit.test.ts` (Biometric & media isolation test suite)
13. `admin-dashboard/src/__tests__/cloudinaryAdmin.test.ts` (Admin Vitest test suite)

---

## 3. Files Modified and Exact Changes

### 1. `src/services/cloudinaryService.ts` (React Native Mobile)
- **Old Configuration Removed:**
  - Removed `cloudName: 'parthmobilecare'`.
  - Removed `uploadPreset: 'pmc_device_photos'`.
  - Removed `secureBaseUrl: 'https://res.cloudinary.com/parthmobilecare/image/upload'`.
- **New Disconnected State:**
  ```typescript
  export const DEFAULT_CLOUDINARY_CONFIG: CloudinaryConfig = {
    cloudName: '',
    uploadPreset: '',
    secureBaseUrl: '',
  };
  ```
- **Added Disconnection Guard (`isConfigured`):**
  ```typescript
  static isConfigured(): boolean {
    return Boolean(this.config.cloudName && this.config.uploadPreset);
  }
  ```
- **Upload Guard:**
  Inside `uploadImage`, if `!this.isConfigured()`, returns:
  `{ success: false, error: 'Cloud image storage is currently disconnected. Image uploads are paused until a new storage provider is configured.' }`
- **Thumbnail / Optimization Safeguard:**
  `getOptimizedImageUrl` now safely verifies `this.config.secureBaseUrl` before building URLs, preventing invalid prefixes when disconnected.

### 2. `admin-dashboard/src/services/cloudinaryService.ts` (Admin Web Portal)
- Same clean disconnection applied:
  - `DEFAULT_CLOUDINARY_CONFIG` reset to empty strings.
  - Added `isConfigured()` check.
  - `uploadImage()` returns graceful paused notice if called when unconfigured.
  - `getOptimizedImageUrl()` safely handles unconfigured base URLs.

### 3. `src/screens/SecondHandScreen.tsx`
- **Firestore URL Hygiene (Zero `file://` Persistence):**
  - Updated purchase record submission: If `purBillUri` is a local `file://` URI and cloud storage is disconnected, `finalBillUri` resolves to `undefined`.
  - **Result:** Temporary Android device cache paths (`file:///data/user/0/...`) are never written to Firestore as broken permanent URLs.
- **DocumentCapture Device Photo Handling:**
  - Added guard check before capturing inspection photos: If `!CloudinaryService.isConfigured()`, displays a friendly alert:
    *"Cloud image upload is temporarily paused until a new storage provider is connected. Purchase details and customer digital signature can still be recorded normally."*
  - The purchase flow continues without blocking the staff member.

### 4. `src/screens/LeadListScreen.tsx`
- Added `CloudinaryService.isConfigured()` check in both New Lead and Edit Lead `DocumentCapture` handlers.
- If storage is disconnected, notifies staff: *"Cloud image upload is temporarily paused until a new storage provider is connected. Lead can still be saved normally."*
- Prevents misleading network errors and ensures lead details (customer name, brand, model, budget, follow-up) save seamlessly.

### 5. `src/screens/ProfileScreen.tsx`
- In `handlePickAvatar`: Added check for `CloudinaryService.isConfigured()`.
- Shows notice: *"Profile avatar cloud upload is temporarily paused until a new storage account is connected."*
- Prevents misleading failure alerts.

### 6. `admin-dashboard/src/pages/ProfilePage.tsx`
- In `handleAvatarFileChange`: Added check for `CloudinaryService.isConfigured()`.
- Displays notice: *"Cloud image storage is currently disconnected. Avatar upload is paused until a new storage provider is connected."*

### 7. Unit Test Suites Updated
- **`__tests__/cloudinaryIntegration.test.ts`:**
  - Added unit test verifying that default state is disconnected (`isConfigured() === false`) and pauses uploads.
  - Configured mock credentials dynamically during network upload tests, ensuring zero old hardcoded credentials remain.
- **`__tests__/permanentFaceEnrollmentAndCloudinaryAudit.test.ts`:**
  - Updated configuration verification test to assert that `cloudName` is not `'parthmobilecare'` and `uploadPreset` is not `'pmc_device_photos'`.
- **`admin-dashboard/src/__tests__/cloudinaryAdmin.test.ts`:**
  - Added unit test verifying that default state is disconnected and pauses uploads.
  - Dynamically configured mock credentials during upload simulation.

---

## 4. Old Configuration References Removed

The following obsolete values have been completely stripped from active application configuration:
- ❌ `parthmobilecare` (as Cloudinary cloud name)
- ❌ `pmc_device_photos` (as Cloudinary upload preset)
- ❌ `https://res.cloudinary.com/parthmobilecare/image/upload` (as Cloudinary base URL)

---

## 5. Image Workflows Preserved

The following core workflows remain fully intact:
1. **Local Image Selection & Gallery Picker:**
   - React Native Image Picker (`launchImageLibrary`) remains intact.
   - Browser file input (`<input type="file" accept="image/*">`) remains intact.
2. **Camera & Gallery Permissions:**
   - Android permissions (`CAMERA`, `READ_EXTERNAL_STORAGE`, `READ_MEDIA_IMAGES`) remain unchanged in `AndroidManifest.xml`.
3. **MIME Type and Size Validation:**
   - File size validation (5 MB limit) remains active.
   - Permitted formats check (`JPEG`, `PNG`, `WEBP`) remains active.
   - Rejection of unsupported extensions (`PDF`, `EXE`, `TFLite`) remains active.
4. **Security & Biometric Isolation Gates:**
   - Strict rejection of biometric keywords (`face`, `embedding`, `facenet`, `descriptor`) remains active.
   - Strict rejection of sensitive KYC keywords (`aadhaar`, `pan_card`, `voter_id`, `passport`) remains active.
5. **Business Flows:**
   - Second-hand purchase recording with customer details, IMEI, purchase price, and digital signature pad works normally.
   - Customer leads capture and follow-up management work normally.
   - Profile management works normally.

---

## 6. Verification and Test Results

### 1. Mobile React Native Test Suites (Jest)
```bash
npm test -- __tests__/cloudinaryIntegration.test.ts
npm test -- __tests__/permanentFaceEnrollmentAndCloudinaryAudit.test.ts
```
- **`cloudinaryIntegration.test.ts`:** **13 passed, 13 total** (100% pass)
- **`permanentFaceEnrollmentAndCloudinaryAudit.test.ts`:** **18 passed, 18 total** (100% pass)

### 2. Admin Dashboard Test Suite (Vitest)
```bash
cd admin-dashboard && npm test -- --run
```
- **Test Suites:** **8 passed, 8 total**
- **Tests:** **106 passed, 106 total**
- **Duration:** 588ms

### 3. Admin Web Production Build (TypeScript & Vite)
```bash
cd admin-dashboard && npm run build
```
- **TypeScript (`tsc`) Compilation:** **Zero errors**
- **Vite Production Bundle:** **Success (`dist/index.html` built in 2.16s)**

---

## 7. Remaining Cloudinary References (Audit and Justification)

No obsolete configuration (`parthmobilecare` / `pmc_device_photos`) remains in active configuration. The remaining references in the codebase are intentional and necessary:
1. **`CloudinaryService` class name and interfaces:**
   - Kept in `src/services/cloudinaryService.ts` and `admin-dashboard/src/services/cloudinaryService.ts` so that when the user provides the new Cloudinary account, it can be plugged in immediately without refactoring component imports or renaming services.
2. **Thumbnail URL parser (`isCloudinaryUrl`):**
   - Retained so that any valid Cloudinary URLs can be safely detected and rendered.
3. **Security rejection keywords:**
   - Retained to guarantee that biometrics and sensitive KYC data are never uploaded to any cloud CDN.

---

## 8. Functionality Temporarily Paused Until New Account Connected

The following features will display a friendly "Storage Paused" alert until the new Cloudinary account is configured:
1. **Second-hand Device Inspection Photos:** Online photo uploads are paused; purchase records and customer digital signatures continue to save normally.
2. **Purchase Paper Bills:** Cloud bill photo uploads are paused; purchase entries continue to save normally.
3. **Repair Inquiry Photos:** Cloud repair photo uploads are paused; customer inquiries and follow-ups continue to save normally.
4. **Staff & Admin Avatar Uploads:** Profile picture uploads are paused; account credentials, names, and passwords can be updated normally.

---

## 9. Next Steps (Awaiting User Instructions)

The application code is now cleanly prepared. When you are ready to connect a new Cloudinary account:
1. Provide the **New Cloud Name** and **New Unsigned Upload Preset**.
2. We will set them in `DEFAULT_CLOUDINARY_CONFIG`.
3. All image upload features will instantly become active and generate permanent HTTPS CDN URLs.
