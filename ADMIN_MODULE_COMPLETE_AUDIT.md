# PARTH MOBILE CARE — COMPLETE ADMIN MODULE AUDIT

**Audit Date**: November 3, 2026  
**Auditor**: Antigravity Autonomous Systems Agent  
**Environment**: Monorepo (`admin-dashboard/` + React Native Staff Mobile `/`)  
**Backend**: Firebase Cloud Firestore & Firebase Auth (100% Spark Plan Compliant)

---

## 1. Executive Summary & Objective

This document represents the complete, rigorous, feature-by-feature audit of the **Parth Mobile Care Admin Module** inside the existing web dashboard (`admin-dashboard/`) and its separation from the Staff Mobile Application.

### Architecture Scope
- **Admin Module**: Complete, full-featured web dashboard in `admin-dashboard/` for Store Owners & Administrators.
- **Staff Module**: Mobile application exclusively for on-floor Staff operations (GPS-geofenced attendance, lead follow-ups, price catalog lookup, second-hand buy/sell entries, own salary slip view).
- **Core Requirement**: Zero Admin dependency on the Staff Mobile App. Every Admin feature, operation, data field, workflow, report, permission, and business workflow must be accessible, fully operational, and thoroughly verified on the Web Dashboard.

---

## 2. Feature Inventory & Current Status Matrix

| Module / Feature | Existing Mobile Location | Existing Web Location | Firebase Collection / Service | Current Functionality | Identified Problems | Required Fixes | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **Admin Login & Auth** | `src/screens/LoginScreen.tsx` | `admin-dashboard/src/pages/LoginPage.tsx` | Firebase Auth & `users/{uid}` | Email/password login with role verification (`role === 'admin'`) | No idle session timeout; mobile still shows Admin login UI. | Show clear web redirection banner on mobile for admin accounts. | **PARTIAL** |
| **Admin Password Reset** | `src/screens/LoginScreen.tsx` | `admin-dashboard/src/pages/LoginPage.tsx` & `ProfilePage.tsx` | `sendPasswordResetEmail`, `updatePassword` | Allows password reset via email and in-dashboard password change | In-app change password requires re-auth; works properly. | Verified operational. | **PASS** |
| **Overview Dashboard KPIs** | `src/screens/HomeScreen.tsx` | `admin-dashboard/src/pages/OverviewPage.tsx` | `users`, `attendance`, `leads`, `second_hand_sales`, `second_hand_purchases` | Displays basic cards for Active Staff, Today's Attendance, Leads, Gross Profit | No date range filter; missing "Absent Staff" card; missing Open vs Closed lead stats; fetches only 100 attendance records. | Add Period/Date filters (Today, This Month, All Time), compute absent staff, calculate monthly vs lifetime sales. | **PARTIAL** |
| **Staff Listing & Filters** | `src/screens/StaffManagementScreen.tsx` | `admin-dashboard/src/pages/StaffPage.tsx` | `users` | Table with search, role filter, status filter, and badge display | In-memory rendering lacks pagination; no detailed attendance/lead/sales tabs in staff modal. | Add pagination controls and multi-tab staff profile inspection modal. | **PARTIAL** |
| **Staff Token Invitation** | `src/services/staffProvisioningService.ts` | `admin-dashboard/src/pages/StaffPage.tsx` | `staff_invitations/{tokenId}` | Generates 7-day token `PMC-INV-XXXXXX`, WhatsApp share link, and setup modal | Works reliably on Firebase Spark; invitations list viewable. | Fully operational. | **PASS** |
| **Staff Status Toggle (Active/Deactive)** | `src/screens/StaffManagementScreen.tsx` | `admin-dashboard/src/pages/StaffPage.tsx` | `users/{uid}` & `audit_logs` | Toggles `isActive: false` with confirmation dialog and audit log | Works; immediately revokes staff mobile session via Auth listener. | Fully operational. | **PASS** |
| **Staff Detail Inspection** | `src/screens/StaffManagementScreen.tsx` | `admin-dashboard/src/pages/StaffPage.tsx` | `users/{uid}` | Displays modal with contact, basic pay, sales target, and device binding | **Missing:** Staff attendance history, staff lead history, staff sales performance, and staff salary slips. | Implement multi-tab detailed staff profile modal with real-time history. | **PARTIAL** |
| **Biometric Face Enrollment Review** | `src/services/faceRecognitionService.ts` | `admin-dashboard/src/pages/StaffPage.tsx` | `users/{uid}` | Displays static text "Enrolled in mobile app" | **Missing:** Admin has no button to review pending face enrollments, approve face registration, or reject it with reason. | Add Face Enrollment review table with Approve/Reject actions in Staff Page. | **BROKEN** |
| **Device Binding Approval / Rejection** | `src/services/deviceBindingService.ts` | `admin-dashboard/src/pages/StaffPage.tsx` | `users/{uid}` & `device_change_requests` | "Device Binding" tab with inventory, change requests review (Approve/Reject), and reset button | Approval writes to `users/{uid}` and `device_change_requests` separately without atomic batch. | Use Firestore `writeBatch` for atomic request approval and user profile binding. | **PARTIAL** |
| **Attendance Today & History** | `src/screens/AttendanceScreen.tsx` | `admin-dashboard/src/pages/AttendancePage.tsx` | `attendance` | Table with date filter, staff filter, status filter, and Excel export | Only single date picker (no date range); fetches only 200 records; missing top KPI summary cards (Present, Late, Absent, Hours). | Add Date Range (From/To) filter, summary KPI cards, and pagination. | **PARTIAL** |
| **Attendance Manual Corrections** | `src/screens/AttendanceScreen.tsx` | `admin-dashboard/src/pages/AttendancePage.tsx` | `attendance/{id}` & `audit_logs` | Modal to adjust status, punch in/out times with mandatory audit reason | Overwrites record without preserving full previous state in record audit metadata. | Store `auditCorrection` object on record and create entry in `audit_logs`. | **PASS** |
| **Leads Pipeline Management** | `src/screens/LeadListScreen.tsx` | `admin-dashboard/src/pages/LeadsPage.tsx` | `leads` | Full CRUD, stage filtering, staff assignment, follow-up scheduling, and Excel export | Missing "Lead Source" field in form and table; no staff conversion comparison. | Add Lead Source (Walk-in, Call, WhatsApp, Social, Referral) and staff conversion summary. | **PARTIAL** |
| **Mobile Price Catalog & Import** | `src/screens/PriceListScreen.tsx` | `admin-dashboard/src/pages/PriceListPage.tsx` | `mobile_prices` | Full CRUD, Excel bulk import, Excel export, price change history | Static brand list; no dynamic brand filter management. | Add brand management and stock toggle controls. | **PASS** |
| **Second-Hand Purchase (Buy-In)** | `src/screens/SecondHandScreen.tsx` | `admin-dashboard/src/pages/SecondHandPage.tsx` | `second_hand_purchases` | Form to record buy-in with customer Aadhaar, phone, IMEI, condition, price | **Bug:** Does not check for duplicate IMEI already in stock; does not link accessories. | Add duplicate IMEI validation against active stock. | **BROKEN** |
| **Second-Hand Sale (Sell-Out)** | `src/screens/SecondHandScreen.tsx` | `admin-dashboard/src/pages/SecondHandPage.tsx` | `second_hand_sales` & `second_hand_purchases` | Form to sell phone with invoice generation and PDF receipt download | **Bug:** Does not update the purchase record to `status: 'sold'`; no dropdown to select an existing in-stock phone. | Add in-stock device picker that automatically auto-fills IMEI, cost, and updates purchase record to `sold`. | **BROKEN** |
| **Salary Slips & Payroll Engine** | `src/screens/PayrollScreen.tsx` | `admin-dashboard/src/pages/PayrollPage.tsx` | `salary_slips`, `sales_targets`, `attendance` | Month selector, slip generation modal, toggle paid status, PDF slip download | **Bug:** Hardcodes working days (26) and present days (25) instead of querying actual attendance records for that staff member! | Automatically query `attendance` collection to calculate exact present days, late arrivals, and absent days. | **BROKEN** |
| **Reports & Store Analytics** | `src/screens/ReportsScreen.tsx` | `admin-dashboard/src/pages/ReportsPage.tsx` | `second_hand_sales`, `leads`, `attendance`, `users` | Overview KPI cards, Excel export, PDF summary export | **Bug:** No date range filters; lifetime aggregated totals only; missing dedicated category reports. | Add Date Range filters (This Month, Last Month, Custom Range) and staff-specific performance breakdown. | **PARTIAL** |
| **Broadcast Announcements** | `src/screens/NotificationsScreen.tsx` | `admin-dashboard/src/pages/NotificationsPage.tsx` | `notifications` | Form to dispatch broadcast notifications to all staff | Works; notifications sync to mobile app immediately. | Fully operational. | **PASS** |
| **Security Audit Logs** | `src/services/auditService.ts` | `admin-dashboard/src/pages/AuditLogsPage.tsx` | `audit_logs` | Table showing admin actions, target record, timestamp, and details with Excel export | Works; read-only security logs strictly protected by Firestore rules. | Fully operational. | **PASS** |
| **Shop Settings & Geofence** | `src/screens/ProfileScreen.tsx` | `admin-dashboard/src/pages/SettingsPage.tsx` | `shop_config/main_store` | Form to edit shop address, contact, geofence radius, and store opening/closing hours | **CRITICAL BUG:** `SettingsPage.tsx` saves `latitude`/`longitude` while `firestore.rules` requires `shopLatitude`/`shopLongitude` and fails `hasOnly` check! | Update rules and service so that both field naming conventions are supported seamlessly. | **BROKEN** |
| **Mobile App Remnant Links** | `src/screens/HomeScreen.tsx` & `ProfileScreen.tsx` | N/A | React Navigation | Mobile app still has buttons attempting to navigate to `StaffManagement` and `ReportsTab` | Tapping "Staff & Roles" on mobile triggers unhandled route errors. | Remove Admin-only navigation buttons from mobile `HomeScreen.tsx` and `ProfileScreen.tsx`. | **BROKEN** |

---

## 3. Detailed Architectural Discrepancies & Broken Workflows

### 3.1. CRITICAL: Shop Config Schema Mismatch in Firestore Rules
- **Problem**: `admin-dashboard/src/pages/SettingsPage.tsx` saves:
  ```json
  {
    "id": "main_store",
    "shopName": "Parth Mobile Care",
    "tagline": "...",
    "shopAddress": "...",
    "phone": "...",
    "alternatePhone": "...",
    "email": "...",
    "gstNumber": "...",
    "latitude": 21.1702,
    "longitude": 72.8311,
    "allowedRadiusMeters": 50,
    "openingTime": "10:00",
    "closingTime": "21:00"
  }
  ```
- **Rules Block**: In [`firestore.rules`](file:///Users/chetan/ParthMobileCare/firestore.rules#L430-L445), `isValidShopConfig` strictly enforces:
  `allowed = ['id', 'shopName', 'shopLatitude', 'shopLongitude', 'allowedRadiusMeters', 'openingTime', 'closingTime', '_syncedAt']`
  and requires `shopLatitude` and `shopLongitude`.
- **Result**: Any save attempt from the Admin Web Dashboard fails with a **Permission Denied** error because of `data.keys().hasOnly(allowed)`.
- **Required Fix**: Update `firestore.rules` and `api.ts` to allow both standard `latitude`/`longitude` and legacy `shopLatitude`/`shopLongitude`, plus store metadata (`shopAddress`, `phone`, `email`, `gstNumber`, `tagline`).

### 3.2. Second-Hand Sales Form Fails to Update Stock Status
- **Problem**: In `admin-dashboard/src/pages/SecondHandPage.tsx`, when an admin registers a sale via `handleCreateSale`, the payload created does not set `purchaseRecordId`.
- **Result**: The purchased phone remains marked as `status: 'in_stock'` forever, even though it was sold.
- **Required Fix**: Provide an in-stock device picker in the sale modal that populates IMEI, brand, model, and purchase price, and attaches `purchaseRecordId` so that the purchase document is atomically transitioned to `'sold'`.

### 3.3. Payroll Slip Generation Hardcodes Attendance Numbers
- **Problem**: In `admin-dashboard/src/pages/PayrollPage.tsx`, `handleOpenGenerate` sets:
  ```typescript
  setWorkingDays(26);
  setPresentDays(25);
  ```
- **Result**: Staff salary slips ignore actual attendance data recorded in Firestore! A staff member who attended only 10 days still receives a slip generated with 25 days.
- **Required Fix**: Dynamically calculate the employee's verified present days, late arrivals, and total working days from the `attendance` collection for the selected month before opening the slip generation modal.

### 3.4. Staff Biometric Face Enrollment Has No Web Admin Review Action
- **Problem**: When a staff member enrolls their face on the mobile app, their profile has `faceEnrollmentStatus: 'pending_approval'`.
- **Result**: The Admin Web Dashboard has no UI or API method to review pending face registrations, approve them, or reject them with a reason.
- **Required Fix**: Add an "Approve Face Enrollment" / "Reject Face Enrollment" action in `StaffPage.tsx` and implement corresponding methods in `ApiService`.

### 3.5. Mobile App Home Screen Has Dead Navigation Buttons
- **Problem**: `src/screens/HomeScreen.tsx` and `src/screens/ProfileScreen.tsx` contain `isAdmin` checks that render "Staff & Roles" (`navigation.navigate('StaffManagement')`) and "Reports" (`navigation.navigate('ReportsTab')`).
- **Result**: Because `StaffManagement` and `ReportsTab` were removed from `RootNavigator.tsx`, tapping these buttons causes React Navigation errors.
- **Required Fix**: Clean up mobile screens to ensure the mobile app is purely Staff-focused with zero dead admin links.

---

## 4. Remediation Plan & Execution Sequence

1. **Step 1: Fix Shop Config Schema in Firestore Rules & API**
   - Delegate rule update to `firestore-rules-author` to permit `latitude`, `longitude`, `shopAddress`, `phone`, `email`, `gstNumber`, `tagline` in `isValidShopConfig`.
   - Update `admin-dashboard/src/services/api.ts` to sync both formats.
2. **Step 2: Complete Second-Hand Inventory Synchronization**
   - Add duplicate IMEI check in `SecondHandPage.tsx` purchase creation.
   - Add In-Stock Device Picker in sale creation modal; link `purchaseRecordId` and set purchase status to `sold`.
3. **Step 3: Connect Payroll Engine to Real Attendance Records**
   - Query `attendance` records for the selected month when generating salary slips to calculate real present days, late arrivals, and unapproved absences.
   - Add payment modal to record `paidDate`, `paymentMethod` (Cash/UPI/Bank Transfer), and `transactionRef`.
4. **Step 4: Implement Biometric Face Approval in Staff Management**
   - Add `approveFaceEnrollment` and `rejectFaceEnrollment` in `ApiService`.
   - Add Face Enrollment Review section in `StaffPage.tsx` allowing Admin to approve or reject with a reason.
5. **Step 5: Enhance Staff Profile Modal with Full History**
   - In `StaffPage.tsx`, expand the staff detail modal to include tabs for:
     - Profile & Device Info
     - Attendance Log
     - Assigned Leads & Follow-ups
     - Salary Slips & Targets
6. **Step 6: Add Date Range Filters & KPI Cards to Attendance & Reports**
   - In `AttendancePage.tsx`: Add Date Range filter and top KPI summary cards (Present, Late, Absent, Hours Worked).
   - In `ReportsPage.tsx`: Add period filters (This Month, Last Month, Custom Date Range) and staff performance matrix.
7. **Step 7: Clean Up Mobile Navigation Remnants**
   - Remove dead links to `StaffManagement` and `ReportsTab` in `src/screens/HomeScreen.tsx` and `src/screens/ProfileScreen.tsx`.
   - Display a clean Admin notice on mobile login screen directing administrators to the Web Dashboard.
8. **Step 8: Automated Verification & Final Documentation**
   - Run Vitest in `admin-dashboard/`.
   - Run production Vite build in `admin-dashboard/`.
   - Run mobile Jest test suite and TypeScript check.
   - Generate `ADMIN_MODULE_COMPLETION_REPORT.md`, `ADMIN_FEATURE_VERIFICATION_MATRIX.md`, and `FIREBASE_DATA_SCHEMA_DOCUMENTATION.md`.

