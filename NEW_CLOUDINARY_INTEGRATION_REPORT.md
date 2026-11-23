# Parth Mobile Care — New Cloudinary Account Integration & Verification Report

**Date:** November 22, 2026  
**Account Status:** Active, Verified & Integrated  
**Environment:** React Native Mobile App & Admin Web Portal  

---

## 1. Executive Summary

The new Cloudinary media storage account has been integrated and validated across the entire Parth Mobile Care ecosystem (React Native Mobile App and Admin Web Dashboard).

All legacy account configuration (`parthmobilecare`, `pmc_device_photos`) was completely disconnected in the previous phase. The new account configuration (`lbqtrrw5` with unsigned upload preset `pmc_mobile_uploads`) is now active, with live API upload functionality verified via real-world HTTP 200 response from Cloudinary's edge servers.

---

## 2. New Account Configuration Applied

| Configuration Property | Value / Specification |
| :--- | :--- |
| **Cloud Name** | `lbqtrrw5` |
| **Upload Preset** | `pmc_mobile_uploads` |
| **Signing Mode** | `Unsigned` |
| **Asset Folder** | `parth_mobile_care` |
| **Upload API Endpoint** | `https://api.cloudinary.com/v1_1/lbqtrrw5/image/upload` |
| **CDN Delivery Base URL** | `https://res.cloudinary.com/lbqtrrw5/image/upload/` |
| **Maximum File Size** | `5 MB` |
| **Supported Image Formats** | `JPEG`, `PNG`, `WEBP`, `HEIC` |
| **API Secret Bundling** | **STRICTLY FORBIDDEN** (Zero secret bundling in client apps) |

---

## 3. Files Inspected & Modified

### Files Modified
1. `src/services/cloudinaryService.ts`
   - Configured `DEFAULT_CLOUDINARY_CONFIG` to default to `lbqtrrw5` and `pmc_mobile_uploads`.
   - Wired runtime resolution via `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME` and `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET`.
   - Maintained folder structures under `parth_mobile_care/*`.
   - Preserved strict biometric and KYC security gates.
2. `admin-dashboard/src/services/cloudinaryService.ts`
   - Configured `DEFAULT_CLOUDINARY_CONFIG` to default to `lbqtrrw5` and `pmc_mobile_uploads`.
   - Wired runtime resolution via `VITE_CLOUDINARY_CLOUD_NAME` and `VITE_CLOUDINARY_UPLOAD_PRESET`.
   - Maintained browser `File` and `Blob` multipart/form-data upload flows.
3. `admin-dashboard/.env.example`
   - Added environment variable documentation for `VITE_CLOUDINARY_CLOUD_NAME=lbqtrrw5` and `VITE_CLOUDINARY_UPLOAD_PRESET=pmc_mobile_uploads`.
4. `.env.example`
   - Created root example documentation for `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=lbqtrrw5` and `EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET=pmc_mobile_uploads`.
5. `__tests__/permanentFaceEnrollmentAndCloudinaryAudit.test.ts`
   - Updated integration test assertion to verify `CloudinaryService.isConfigured()` is `true` with `lbqtrrw5` and `pmc_mobile_uploads`.

### Files Inspected (Audit Scope)
- `src/screens/SecondHandScreen.tsx` — Second-hand device purchase bills & multi-angle inspection photos.
- `src/screens/LeadListScreen.tsx` — Customer repair damage & inquiry photos.
- `src/screens/ProfileScreen.tsx` — Staff profile avatar upload and thumbnail rendering.
- `admin-dashboard/src/pages/SecondHandPage.tsx` — Admin inspection photo display.
- `admin-dashboard/src/pages/LeadsPage.tsx` — Admin repair photo inspection modal.
- `admin-dashboard/src/pages/ProfilePage.tsx` — Admin avatar upload with Cloudinary CDN optimization.
- `admin-dashboard/src/pages/StaffPage.tsx` — Admin staff directory avatar rendering.
- `src/types/index.ts` — Type definitions for `SecondHandPurchase`, `CustomerLead`, `User`.

---

## 4. Old Cloudinary References Removed

| Old Property | Status |
| :--- | :--- |
| `parthmobilecare` (Cloud Name) | Completely eradicated from active application configs |
| `pmc_device_photos` (Upload Preset) | Completely eradicated from active application configs |
| `ml_default` (Default Preset) | Not used anywhere; prevented |

---

## 5. Live Endpoint & Asset Folder Verification

### Direct API Probe Results
A live HTTPS upload probe was executed against `https://api.cloudinary.com/v1_1/lbqtrrw5/image/upload` with the unsigned preset `pmc_mobile_uploads`:

```json
{
  "asset_id": "40556113ce4dd7df0c1332ff79df1b08",
  "public_id": "parth_mobile_care/devices/pyocvvezjc9qzjptja3g",
  "version": 1795349905,
  "version_id": "fae217036a445d3bc2ec96a71bb9596c",
  "signature": "3cbe2cb4018868da36693a6cbe702165c7170566",
  "width": 1,
  "height": 1,
  "format": "png",
  "resource_type": "image",
  "created_at": "2026-11-22T12:18:25Z",
  "tags": [
    "device_inspection",
    "pmc_retail"
  ],
  "bytes": 69,
  "type": "upload",
  "etag": "0cfa3198516fb97fa523bb4e4370f69a",
  "placeholder": false,
  "url": "http://res.cloudinary.com/lbqtrrw5/image/upload/v1795349905/parth_mobile_care/devices/pyocvvezjc9qzjptja3g.png",
  "secure_url": "https://res.cloudinary.com/lbqtrrw5/image/upload/v1795349905/parth_mobile_care/devices/pyocvvezjc9qzjptja3g.png",
  "asset_folder": "parth_mobile_care"
}
```

**Verification Status:** **100% OPERATIONAL (HTTP 200 OK)**

---

## 6. Functional Workflow Routing

All media uploads are partitioned into isolated folder namespaces under `parth_mobile_care`:

1. **Second-Hand Devices:**
   - **Target Folder:** `parth_mobile_care/devices`
   - **Assets:** Multi-angle physical condition inspection photos (screen, body, camera, ports) & purchase bills.
   - **Firestore Persistence:** Saved as HTTPS array in `devicePhotos` and string in `purchaseBillUrl` / `billImageUri`.
2. **Customer Repair Leads:**
   - **Target Folder:** `parth_mobile_care/leads`
   - **Assets:** Device damage photos, water damage indicators, broken display photos.
   - **Firestore Persistence:** Saved as HTTPS array in `inquiryPhotos`.
3. **Staff & Admin Avatars:**
   - **Target Folder:** `parth_mobile_care/avatars`
   - **Assets:** User profile avatars.
   - **Firestore Persistence:** Saved as HTTPS string in `avatarUrl`.
4. **General Documents:**
   - **Target Folder:** `parth_mobile_care/general`

---

## 7. Security Gates & Biometric Isolation

The strict security barriers introduced to protect user biometrics and identity data remain enforced:

1. **Biometric Face Data Protection:**
   - Upload attempts containing keywords `face`, `biometric`, `embedding`, `descriptor`, `tflite`, `facenet`, `blazeface`, `spoof`, `template`, `keystore`, `dek` are intercepted and rejected prior to network transmission.
   - Live face verification frames and biometric models never touch Cloudinary.
2. **KYC Document Isolation:**
   - Upload attempts containing keywords `aadhaar`, `aadhar`, `pan_card`, `voter_id`, `passport`, `kyc` are intercepted and rejected.
3. **API Secret Safety:**
   - Neither the React Native app nor the Admin Dashboard bundle or request `api_secret`. All uploads use the unsigned preset `pmc_mobile_uploads`.
4. **File Validation:**
   - Maximum file size: 5 MB strictly enforced.
   - Executables (`.exe`), PDFs (`.pdf`), and non-image binaries (`.tflite`) are rejected before transmission.

---

## 8. Verification & Test Results

### Test Suite Execution
- `npm test -- __tests__/cloudinaryIntegration.test.ts`: **13 passed, 13 total (100%)**
- `npm test -- __tests__/permanentFaceEnrollmentAndCloudinaryAudit.test.ts`: **18 passed, 18 total (100%)**
- `cd admin-dashboard && npm test -- --run`: **106 passed, 106 total (100%)**
- `cd admin-dashboard && npm run build`: **Success (0 errors, built in 2.28s)**

---

## 9. Current Implementation Status Matrix

| Component | Status | Details |
| :--- | :--- | :--- |
| Mobile Cloudinary Service | **Implemented & Verified** | Defaulting to `lbqtrrw5` / `pmc_mobile_uploads` with Expo public env overrides |
| Admin Web Cloudinary Service | **Implemented & Verified** | Defaulting to `lbqtrrw5` / `pmc_mobile_uploads` with Vite env overrides |
| Second-Hand Device Photos | **Implemented & Verified** | Routing to `parth_mobile_care/devices` |
| Purchase Bills Upload | **Implemented & Verified** | Routing to `parth_mobile_care/devices` |
| Repair Inquiry Photos | **Implemented & Verified** | Routing to `parth_mobile_care/leads` |
| User Profile Avatars | **Implemented & Verified** | Routing to `parth_mobile_care/avatars` |
| Live API Endpoint Verification | **Verified Live (HTTP 200)** | Uploaded test asset to `lbqtrrw5` |
| Unit & Integration Tests | **All Passed** | 137 tests passing across mobile and admin |
| Production Build | **Passed** | Vite production build successful |
| Production Deployment | **NOT DEPLOYED** | Stopped per strict restriction guidelines |

---

## 10. Remaining Limitations & Recommendations

1. **Cloudinary Free Tier Quota:**
   - Account `lbqtrrw5` provides 25 monthly credits (approx. 25,000 transformations or 25 GB storage/bandwidth).
   - In-app thumbnail transformation helper (`getDeviceThumbnailUrl` using `f_auto,q_auto,c_fill,w_300`) optimizes bandwidth to minimize credit consumption.
2. **Production Deployment:**
   - Ready for deployment whenever you provide explicit approval.
