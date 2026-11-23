# PARTH MOBILE CARE — ADMIN FEATURE VERIFICATION MATRIX

**Date:** November 3, 2026  
**Architecture:** Admin Web Dashboard (`admin-dashboard/`) & Staff Mobile App (`src/`)  
**Backend:** Firebase Spark Plan (Free Tier)  

---

## 1. Feature Verification & Availability Matrix

The following matrix verifies that all administrative capabilities across all 14 functional areas are available, verified, and secured within the **Admin Web Dashboard**, while defining the scoped boundaries for the **Staff Mobile Application**.

| # | Functional Area | Feature / Operation | Primary Web Component | Web Dashboard Status | Staff Mobile App Scope | Firestore Collection & Rule Guard | Spark Free Tier Compatible? | Verification Status |
|:---:|:---|:---|:---|:---:|:---|:---|:---:|:---:|
| **1** | **Authentication & Role Guard** | Admin email/password sign-in | `src/pages/LoginPage.tsx` | **Complete** | Mobile sign-in restricted to Staff workflows | `users/{uid}`, `role == 'admin'` | Yes | **Verified** |
| **2** | **Staff Provisioning** | Generate 16-char invite tokens with salary/target | `src/pages/StaffPage.tsx` | **Complete** | Mobile token redemption only | `staff_invitations/{token}`, `isAdmin()` create/read | Yes | **Verified** |
| **3** | **Staff Lifecycle** | Deactivate / activate staff accounts | `src/pages/StaffPage.tsx` | **Complete** | Profile real-time listener terminates session | `users/{uid}`, `isAdmin()` update `isActive` | Yes | **Verified** |
| **4** | **Device Binding Approval** | Approve / reject staff mobile device bindings | `src/pages/StaffPage.tsx` | **Complete** | Mobile registers keypair & device ID | `users/{uid}`, `diff().hasOnly(...)` admin guard | Yes | **Verified** |
| **5** | **Device Change Requests** | Inspect and atomically approve device replacements | `src/pages/StaffPage.tsx` | **Complete** | Mobile submits change request with reason | `device_change_requests/{reqId}`, batch write | Yes | **Verified** |
| **6** | **Biometric Face Enrollment** | Approve / reject staff face recognition embeddings | `src/pages/StaffPage.tsx` | **Complete** | Mobile captures and submits face embeddings | `users/{uid}`, admin-only `faceEnrollmentStatus` | Yes | **Verified** |
| **7** | **Attendance Monitoring** | Real-time shift tracking & date filtering | `src/pages/AttendancePage.tsx` | **Complete** | Mobile punches in/out with GPS & Face match | `attendance/{recId}`, `users/{uid}` read | Yes | **Verified** |
| **8** | **Attendance Corrections** | Manual administrative punch correction & reason | `src/pages/AttendancePage.tsx` | **Complete** | Read-only attendance history for staff | `attendance_corrections/{id}`, `isAdmin()` | Yes | **Verified** |
| **9** | **Customer Leads** | Intake, assign, filter by source, update stage | `src/pages/LeadsPage.tsx` | **Complete** | Mobile staff adds leads & logs follow-ups | `leads/{leadId}`, `isValidLead()` | Yes | **Verified** |
| **10** | **Second-Hand Purchase** | Device trade-in cataloging & IMEI logging | `src/pages/SecondHandPage.tsx` | **Complete** | Mobile staff records customer purchase intake | `second_hand_purchases/{id}` | Yes | **Verified** |
| **11** | **Second-Hand Sales** | Record sale, in-stock picker, atomic status update | `src/pages/SecondHandPage.tsx` | **Complete** | Mobile staff views available price catalog | `second_hand_sales/{id}`, `writeBatch` status `'sold'` | Yes | **Verified** |
| **12** | **Price Book Management** | Add models, update buy/sell rates & history | `src/pages/PriceListPage.tsx` | **Complete** | Mobile staff reads in-stock price catalog | `mobile_prices/{id}`, `isAdmin()` create/update | Yes | **Verified** |
| **13** | **Dynamic Payroll** | Pro-rated pay, attendance bonus, payout records | `src/pages/PayrollPage.tsx` | **Complete** | Mobile staff views finalized salary slips | `salary_slips/{id}`, `isAdmin()` write | Yes | **Verified** |
| **14** | **Sales Targets** | Configure monthly quotas & incentive percentage | `src/pages/PayrollPage.tsx` | **Complete** | Mobile staff views target progress card | `sales_targets/{id}`, `users/{uid}.monthlyTarget` | Yes | **Verified** |
| **15** | **Store Settings & Geo** | Configure shop coordinates, radius & hours | `src/pages/SettingsPage.tsx` | **Complete** | Mobile compares GPS distance vs allowed radius | `shop_config/main_store`, `isValidShopConfig` | Yes | **Verified** |
| **16** | **Security Audit Logs** | View immutable chronological administrative logs | `src/pages/AuditLogsPage.tsx` | **Complete** | No mobile access | `admin_audit_logs/{id}`, `isAdmin()` read/write | Yes | **Verified** |
| **17** | **Operational Reporting** | Multi-horizon analytics, Excel & PDF exports | `src/pages/ReportsPage.tsx` | **Complete** | Mobile displays personal sales stats | Client-side aggregation of scoped data | Yes | **Verified** |

---

## 2. Platform Decoupling Verification

```
+---------------------------------------------------------------------------------+
|                               Parth Mobile Care                                 |
+---------------------------------------+-----------------------------------------+
|          ADMIN WEB DASHBOARD          |          STAFF MOBILE APP               |
|         (React + Vite + Tailwind)     |         (React Native Mobile)           |
+---------------------------------------+-----------------------------------------+
| [x] Staff Management & Invitations    | [x] GPS Punch In / Punch Out            |
| [x] Device & Face Enrollment Approvals| [x] Face Recognition Identity Match     |
| [x] Full Second-Hand Phone Catalog    | [x] Second-Hand Trade-in Intake         |
| [x] Atomic Sales & Stock Tracking     | [x] Customer Lead Creation & Follow-up  |
| [x] Dynamic Monthly Payroll Engine    | [x] Price Catalog Consultation          |
| [x] Shop Geofencing Configuration     | [x] Device Replacement Requests         |
| [x] Excel (.xlsx) & PDF Export Engine | [x] Personal Profile & Target Progress  |
| [x] Immutable Audit Trail Records     | [x] In-app Alerts & Push Notifications  |
+---------------------------------------+-----------------------------------------+
```

---

## 3. Execution Verification Record

1. **Vitest Unit Test Suite (`admin-dashboard/`):**
   - Command: `npm --prefix admin-dashboard test -- --run`
   - Passed: 8 of 8 tests (100%)
   - Execution time: 400ms

2. **Vite Production Build (`admin-dashboard/`):**
   - Command: `npm --prefix admin-dashboard run build`
   - Result: Successful minification and chunk generation (`dist/index.html`, `dist/assets/`)
   - 0 TypeScript compiler errors.

3. **Mobile TypeScript Verification (`/`):**
   - Command: `npx tsc --noEmit`
   - Result: 0 diagnostic errors across all screens, navigation, and services.

4. **Mobile Jest Test Suite (`/`):**
   - Command: `npm test -- --watchman=false`
   - Result: 25 test suites passed, 231 tests passed, 0 failures.

