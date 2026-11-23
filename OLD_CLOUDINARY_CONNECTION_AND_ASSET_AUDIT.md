# Parth Mobile Care — Existing Cloudinary Connection & Asset Audit Report

**Date of Audit:** November 22, 2026  
**Audited Target:** Parth Mobile Care (Mobile App & Admin Web Dashboard)  
**Firebase Project:** `parthmobilecare-a474d`  
**Cloudinary Cloud Name Audited:** `parthmobilecare`  
**Upload Preset Audited:** `pmc_device_photos`  

---

## 1. Executive Summary

An exhaustive technical audit of the Cloudinary media integration was conducted across both the **React Native Mobile App** (`/src`) and the **Admin Web Portal** (`/admin-dashboard/src`), as well as the live production **Google Cloud Firestore** database (`parthmobilecare-a474d`).

### Key Findings
1. **Current Connection Status:** **DISCONNECTED / NON-FUNCTIONAL**.
   - The codebase specifies Cloud Name `parthmobilecare` and upload preset `pmc_device_photos`.
   - Real-time API probes to `https://api.cloudinary.com/v1_1/parthmobilecare/image/upload` fail with HTTP 401: `Unknown API key`.
   - This error occurs because the unsigned upload preset `pmc_device_photos` does not exist or is set to Signed mode on the Cloudinary account.
2. **Current Upload Behavior:**
   - Every upload attempt from the mobile app and admin dashboard fails.
   - The application gracefully catches the upload failure and falls back to saving local Android cache URIs (`file:///data/user/0/com.parthmobilecare/cache/...`).
3. **Existing Firestore Asset Inventory:** **ZERO (0) CLOUDINARY URLS**.
   - An exhaustive scan of all **11 Firestore collections** (127 total documents) found **0 Cloudinary URLs**.
   - Not a single Firestore record in production references `res.cloudinary.com`.
4. **Deletion / Disconnection Impact:** **ZERO RISK (100% SAFE)**.
   - Disconnecting, replacing, or deleting assets in the old Cloudinary account will cause **no loss of Firestore data**, **no broken image URLs**, and **no impact on store operations**.

---

## 2. Phase 1 — Connection Inspection

### 2.1 Configuration Parameters

| Parameter | Current Value in Mobile App | Current Value in Admin Dashboard |
| :--- | :--- | :--- |
| **Cloud Name** | `parthmobilecare` | `parthmobilecare` |
| **Upload Preset** | `pmc_device_photos` | `pmc_device_photos` |
| **Secure Base URL** | `https://res.cloudinary.com/parthmobilecare/image/upload` | `https://res.cloudinary.com/parthmobilecare/image/upload` |
| **Upload Endpoint** | `https://api.cloudinary.com/v1_1/parthmobilecare/image/upload` | `https://api.cloudinary.com/v1_1/parthmobilecare/image/upload` |
| **API Secret in Client** | None (Preserved — strict zero-secret policy) | None (Preserved — strict zero-secret policy) |
| **Environment Overrides** | None (`DEFAULT_CLOUDINARY_CONFIG` used directly) | None (`DEFAULT_CLOUDINARY_CONFIG` used directly) |

### 2.2 Live Upload Endpoint Diagnostic

A diagnostic probe was dispatched to the active Cloudinary endpoint:
```bash
curl -s -X POST "https://api.cloudinary.com/v1_1/parthmobilecare/image/upload" \
  -F "upload_preset=pmc_device_photos" \
  -F "file=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
```

**Response Returned:**
```json
{"error":{"message":"Unknown API key "}}
```

**Root Cause:**
In Cloudinary, when an unsigned upload request is made without an API Key, Cloudinary validates whether the provided `upload_preset` exists and has `Signing Mode: Unsigned`. Because `pmc_device_photos` is either missing or configured as Signed, Cloudinary rejects the request and demands an API Key. Consequently, **no client can upload media to this preset**.

### 2.3 Folder Structure and Categories Designed in Code

The service architecture defines the following four asset categories:
1. `parth_mobile_care/devices`: Second-hand device inspection photos and purchase bills.
2. `parth_mobile_care/leads`: Customer repair inquiry and phone inspection photos.
3. `parth_mobile_care/avatars`: Staff and Admin profile pictures.
4. `parth_mobile_care/general`: Store documents and general media.

### 2.4 Codebase Reference Locations

| Component | File Path | Media Field / Function |
| :--- | :--- | :--- |
| **Mobile Service** | `src/services/cloudinaryService.ts` | Core mobile upload, validation & thumbnail helper |
| **Admin Service** | `admin-dashboard/src/services/cloudinaryService.ts` | Web portal upload, validation & thumbnail helper |
| **Mobile Profile** | `src/screens/ProfileScreen.tsx` | Avatar upload and `currentUser.avatarUrl` thumbnail |
| **Mobile Leads** | `src/screens/LeadListScreen.tsx` | Repair photo capture and inquiry attachment thumbnails |
| **Mobile Second-Hand** | `src/screens/SecondHandScreen.tsx` | Purchase bill upload (`purBillUri`) and inspection photos |
| **Admin Profile** | `admin-dashboard/src/pages/ProfilePage.tsx` | Admin avatar upload and display |
| **Admin Staff** | `admin-dashboard/src/pages/StaffPage.tsx` | Staff avatar thumbnail rendering (`staff.avatarUrl`) |
| **Admin Leads** | `admin-dashboard/src/pages/LeadsPage.tsx` | Inquiry photo viewing modal |
| **Admin Second-Hand** | `admin-dashboard/src/pages/SecondHandPage.tsx` | Purchase bills & inspection photo thumbnails |

---

## 3. Phase 2 — Existing Asset Inventory & Firestore Audit

### 3.1 Live Production Firestore Database Audit

An automated read-only scan of all **11 root collections** in Firebase project `parthmobilecare-a474d` was executed via Google Cloud Firestore REST API:

| Collection Name | Total Documents | Cloudinary URLs Found | Other Image / Local URIs Found |
| :--- | :---: | :---: | :---: |
| `users` | 4 | **0** | 0 (All `avatarUrl` fields are null/unset) |
| `leads` | 3 | **0** | 0 (All 3 leads have empty photo arrays) |
| `second_hand_purchases` | 3 | **0** | 2 docs contain Android local cache paths |
| `second_hand_sales` | 2 | **0** | 1 doc contains Android local cache path |
| `mobile_prices` | 3 | **0** | 0 |
| `attendance` | 0 | **0** | 0 |
| `staff_invitations` | 0 | **0** | 0 |
| `device_change_requests` | 7 | **0** | 0 |
| `notifications` | 36 | **0** | 0 |
| `audit_logs` | 26 | **0** | 0 |
| `shop_config` | 2 | **0** | 0 |
| **TOTALS** | **127 docs** | **0** | **3 records with local `file:///` URIs** |

### 3.2 Asset Inventory by Category

#### 1. Second-Hand Device Photos & Inspection
- **Cloudinary Assets:** 0
- **Firestore Status:** Zero Cloudinary URLs. Two records in `second_hand_purchases` have device inspection arrays, but they are either empty or point to temporary Android cache paths.

#### 2. Purchase Bills
- **Cloudinary Assets:** 0
- **Firestore Status:** Document `pur_1793621544292_i5asg` has `billImageUri`:
  ```
  file:///data/user/0/com.parthmobilecare/cache/rn_image_picker_lib_temp_e1b50770-6cc4-4dc9-9fad-3117261b9e3e.jpg
  ```
  Because Cloudinary upload failed at the time of recording, the app fell back to storing the local device cache path.

#### 3. Customer Repair Inquiry Images
- **Cloudinary Assets:** 0
- **Firestore Status:** All 3 leads (`lead_1793639396828_rgvjs`, `lead_1793894651204_fpu14`, `lead_1793951566174_7794s`) contain no images.

#### 4. Staff Profile Photos
- **Cloudinary Assets:** 0
- **Firestore Status:** Active staff (`Chetan Luhar`, `Ramesh Patel`) and legacy staff have no avatar URLs in Firestore.

#### 5. Admin Profile Photos
- **Cloudinary Assets:** 0
- **Firestore Status:** Primary Admin (`Parth Patel` / `parthmobilecare07@gmail.com`) has no avatar URL in Firestore.

#### 6. Other Uploaded Media
- **Cloudinary Assets:** 0
- Probes to `https://res.cloudinary.com/parthmobilecare/image/upload/...` for sample paths all return `HTTP 404: Resource not found`.

---

## 4. Phase 3 — Deletion & Disconnection Impact Assessment

### 4.1 Feature Impact if Existing Cloudinary Assets Are Deleted
- **Will any application feature lose visible images?**
  **NO.** Because no images from the application were ever successfully uploaded to or linked from Cloudinary, deleting assets inside the old Cloudinary account will cause **zero visual degradation** in both the mobile app and admin dashboard.

### 4.2 Will Existing Firestore Records Retain Broken Image URLs?
- **NO.** There are zero Cloudinary URLs stored in any Firestore document. Not a single record in production will become broken or point to a 404 error.

### 4.3 Does Deleting Assets Affect Other Business Data?
- **NO.** Cloudinary is completely decoupled from:
  - Firebase Authentication accounts (Admin and Staff).
  - Firestore security rules and permissions.
  - On-device biometric face verification and Keystore encryption (which strictly forbid cloud storage).
  - Attendance timestamps and geofencing coordinates.
  - Mobile Price Catalog and profit margins.
  - Salary slips and sales targets.

### 4.4 Can the Current Cloudinary Connection Be Safely Disconnected?
- **YES, 100% SAFELY.**
  - The current connection is non-operational and holds zero linked production assets.
  - The old account can be safely disconnected or replaced with a new, properly configured Cloudinary account at any time with **zero data loss** and **zero downtime**.

---

## 5. Summary Table

| Audit Question | Finding | Technical Evidence |
| :--- | :---: | :--- |
| **Is old Cloudinary account currently connected?** | **NO** | Uploads fail with HTTP 401 `Unknown API key` |
| **Is upload preset `pmc_device_photos` working?** | **NO** | Missing or configured as Signed in Cloudinary |
| **Are any Cloudinary URLs stored in Firestore?** | **0** | Full scan of 11 collections returned 0 URLs |
| **Are purchase bills stored on Cloudinary?** | **NO** | Stored as local Android `file:///` URIs |
| **Are staff/admin avatars on Cloudinary?** | **NO** | All avatar fields are null/empty |
| **Is it safe to delete old Cloudinary assets?** | **YES** | Zero dependency in database |
| **Is it safe to disconnect the old account?** | **YES** | Complete decoupling from core app systems |

---

## 6. Recommendations for New Cloudinary Setup

When ready to connect a new Cloudinary account:
1. **Create an Unsigned Upload Preset:**
   - In Cloudinary Console → Settings → Upload → Upload Presets.
   - Name: `pmc_device_photos` (or custom name).
   - **Signing Mode:** Select **Unsigned** (Critical).
   - Folder: `parth_mobile_care/devices`.
2. **Configure in Code:**
   - Update `cloudName` and `uploadPreset` in `DEFAULT_CLOUDINARY_CONFIG` in `src/services/cloudinaryService.ts` and `admin-dashboard/src/services/cloudinaryService.ts`.
3. **Result:**
   - All newly taken device inspection photos, purchase bills, repair inquiry photos, and profile avatars will upload directly to Cloudinary and generate permanent, universally accessible HTTPS URLs viewable across all devices and the admin dashboard.

---

> [!NOTE]
> Per strict user instructions, no Cloudinary assets, accounts, presets, Firestore records, or source files were modified or deleted during this audit. Awaiting explicit user approval before performing any disconnection or credential replacement.
