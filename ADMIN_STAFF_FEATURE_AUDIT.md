# PARTH MOBILE CARE — COMPLETE ADMIN & STAFF FEATURE AUDIT

**Date:** November 3, 2026  
**Project:** Parth Mobile Care  
**Architecture Migration:** Split monolithic architecture into:
1. **Admin Module** &rarr; Complete Web Dashboard (`admin-dashboard/`)
2. **Staff Module** &rarr; React Native Mobile Application (`/`)

---

## 1. Executive Summary & Architectural Scope

The current implementation has both Admin and Staff logic interleaved within the React Native codebase, while an initial web structure exists in `admin-dashboard/`. 

Under the new architecture:
- **Admin Web Dashboard**: Dedicated, full-screen administrative control center for store owners/managers to oversee staff, global KPIs, confidential margins, inventory pricing, payroll generation, shop settings, and audit logs.
- **Staff Mobile Application**: Dedicated, field/counter mobile application for store employees to record attendance, manage assigned customer leads, browse current retail price lists, record authorized customer buy/sell transactions, and download their own monthly salary slips.
- **Firebase Spark Plan Adherence**: Zero reliance on Google Cloud Functions, Cloud Storage, or Blaze billing. Zero client-side Admin SDK leaks. All security enforced via declarative Firestore Security Rules and scoped client services.

---

## 2. Comprehensive Feature Inventory

| Feature | Existing Mobile Location | Classification | Current Status | Admin Web Status | Staff Mobile Status | Required Changes |
|---|---|---|---|---|---|---|
| **Admin Dedicated Login** | `src/screens/LoginScreen.tsx` | Admin Only | Supported with fallback | Implemented in `pages/LoginPage.tsx` | Blocked & Removed | Restrict Web Dashboard to `admin` role with token claim validation; block Admin login on mobile with redirection notice. |
| **Staff Dedicated Login** | `src/screens/LoginScreen.tsx` | Staff Only | Shared form with role check | Blocked on Web Dashboard | Implemented in `screens/LoginScreen.tsx` | Verify `staff` role on mobile; reject `admin` credentials with clear warning to use Web Dashboard. |
| **Staff Invitation & Setup** | `src/services/staffProvisioningService.ts` | Shared with Restricted Permissions | Attempted Cloud Function | Needs secure invitation flow | Needs token-based account setup | Migrate from non-working Cloud Function to secure Firestore token invitation workflow on Firebase Spark. |
| **Global Store KPIs & Overview** | `src/screens/HomeScreen.tsx` | Admin Only | Mixed with staff view via `isAdmin` | Implemented in `pages/OverviewPage.tsx` | Removed from Mobile | Admin Web shows total revenue, gross profit, total inventory, team attendance, and store-wide sales. Mobile shows only staff personal stats. |
| **Personal Staff Dashboard** | `src/screens/HomeScreen.tsx` | Staff Only | Shared conditional layout | Not Applicable (Staff Only) | Retained & Streamlined | Display only personal punch status, personal leads count, personal sales, and personal target progress. |
| **Staff Directory & Management** | `src/screens/StaffManagementScreen.tsx` | Admin Only | Full CRUD in mobile behind `isAdmin` | Implemented in `pages/StaffPage.tsx` | Completely Removed from Mobile | Migrate all staff management to Web Dashboard. Remove `StaffManagementScreen` from mobile stack and home quick actions. |
| **Staff Activation / Deactivation** | `src/screens/StaffManagementScreen.tsx` | Admin Only | Toggles `isActive` in Firestore | Implemented in `pages/StaffPage.tsx` | Completely Removed from Mobile | Admin Web provides one-click account suspension and reactivation with audit trail. |
| **Sales Target Assignment** | `src/screens/StaffManagementScreen.tsx` | Admin Only | Managed per staff | Implemented in `pages/StaffPage.tsx` & `PayrollPage.tsx` | View Only (Own Target) | Target setting exclusive to Admin Web; Staff views personal target progress in Home and Profile. |
| **Attendance Punch In/Out** | `src/screens/AttendanceScreen.tsx` | Staff Only | Mobile GPS & Biometrics | Not Applicable (Mobile Only) | Retained & Polished | Staff punches in/out on mobile with GPS geofence checks and device verification. |
| **Attendance Geofence Validation** | `src/services/locationService.ts` | Staff Only | Haversine distance check | Configured via `SettingsPage.tsx` | Retained on Mobile | Geofence radius and store coordinates read from `/shop_config/main_store` in Firestore. |
| **Biometric Face Verification** | `src/services/faceRecognitionService.ts` | Staff Only | On-device tfjs / canvas | Approval flow in `StaffPage.tsx` | Retained with consent check | Staff captures face on device; Admin reviews and approves enrollment on Admin Web. |
| **All Staff Attendance Overview** | `src/screens/AttendanceScreen.tsx` | Admin Only | Conditional tab in mobile | Implemented in `pages/AttendancePage.tsx` | Removed from Mobile | Admin Web displays all employee attendance logs, missing punches, and monthly attendance sheets. |
| **Attendance Manual Correction** | `src/screens/AttendanceScreen.tsx` | Admin Only | Admin override modal | Implemented in `pages/AttendancePage.tsx` | View Status Only | Admin can override punch times with required audit reason. Mobile shows read-only corrected status. |
| **Attendance Export (Excel/CSV)** | `src/screens/AttendanceScreen.tsx` | Admin Only | Mobile share sheet CSV | Needs XLSX/CSV export button | Removed from Mobile | Integrate `xlsx` export in `admin-dashboard/src/pages/AttendancePage.tsx`. |
| **Customer Leads Pipeline (Global)**| `src/screens/LeadListScreen.tsx` | Admin Only | Conditional `isAdmin` view | Implemented in `pages/LeadsPage.tsx` | Removed (Personal Only) | Admin Web displays full customer pipeline, filtering by staff, stage, and brand. |
| **Lead Assignment / Reassignment**| `src/screens/LeadListScreen.tsx` | Admin Only | In edit modal on mobile | Implemented in `pages/LeadsPage.tsx` | Restricted | Admin reassigns leads across staff members on Web Dashboard. Staff only sees assigned leads. |
| **Lead Creation & Follow-Up Log** | `src/screens/LeadListScreen.tsx` | Shared with Restricted Permissions | Full modal in mobile | Implemented in `pages/LeadsPage.tsx` | Retained (Self-Assigned) | Both Admin and Staff can create leads. Staff creates lead assigned to self; Admin can assign to any staff. |
| **Lead Deletion with Audit** | `src/screens/LeadListScreen.tsx` | Admin Only | Admin-only delete prompt | Implemented in `pages/LeadsPage.tsx` | Removed from Mobile | Lead deletion strictly prohibited on mobile; restricted to Admin Web with logged audit record. |
| **Lead Export (Excel/CSV)** | `src/services/reportExportService.ts`| Admin Only | Mobile file share | Needs XLSX export button | Removed from Mobile | Integrate `xlsx` lead export into `admin-dashboard/src/pages/LeadsPage.tsx`. |
| **Mobile Price Catalog Management**| `src/screens/PriceListScreen.tsx` | Admin Only | Modals for Add/Edit/Delete | Implemented in `pages/PriceListPage.tsx` | Completely Removed | Price edits, price history updates, and catalog deletions exclusive to Admin Web. |
| **Mobile Price Bulk Excel Import** | `src/components/ExcelImportModal.tsx`| Admin Only | XLSX parsing on mobile | Needs Web Excel Import | Completely Removed | Migrate Excel/CSV price import modal to Admin Web Dashboard using `xlsx`. |
| **Mobile Price Catalog View** | `src/screens/PriceListScreen.tsx` | Shared with Restricted Permissions | Full list with search/filter | Implemented in `pages/PriceListPage.tsx` | Retained (View Only) | Mobile app retains clean, read-only catalog with search and brand filtering for staff counter sales. |
| **Second-Hand Purchase (Buy In)** | `src/screens/SecondHandScreen.tsx` | Shared with Restricted Permissions | Full form with camera KYC | Implemented in `pages/SecondHandPage.tsx` | Retained (Input Only) | Staff inputs purchase at counter with IMEI and customer signature. Admin audits on Web Dashboard. |
| **Purchase Cost & Margins** | `src/screens/SecondHandScreen.tsx` | Admin Only | Hidden via `isAdmin` | Implemented in `pages/SecondHandPage.tsx` | Strictly Hidden | Purchase cost and profit margin percentage strictly hidden from Staff UI and protected in Security Rules. |
| **Second-Hand Sales (Sell Out)** | `src/screens/SecondHandScreen.tsx` | Shared with Restricted Permissions | Invoicing and receipt | Implemented in `pages/SecondHandPage.tsx` | Retained (Sale Only) | Staff records sold mobile, selects payment method, generates PDF receipt for buyer. |
| **Sales & Purchase Export** | `src/services/reportExportService.ts`| Admin Only | Mobile share sheet | Needs XLSX export button | Removed from Mobile | Admin Web exports full sales ledger and purchase registry with margin analysis to Excel/CSV. |
| **KYC Document Viewer** | `src/components/DocumentCapture.tsx` | Admin Only | Local cache preview | Implemented in `pages/SecondHandPage.tsx` | Restricted | Admin views uploaded Aadhaar and customer verification documents on secure Web Dashboard. |
| **Salary Calculation & Slips** | `src/screens/PayrollScreen.tsx` | Admin Only | Mobile screen behind `isAdmin` | Implemented in `pages/PayrollPage.tsx` | Completely Removed | Admin generates, reviews, and edits salary slips for all staff members on Web Dashboard. |
| **Individual Salary Slip Download**| `src/screens/ProfileScreen.tsx` | Shared with Restricted Permissions | Mobile PDF generator | Implemented in `pages/PayrollPage.tsx` | Retained (Own Slip Only) | Staff views and downloads only their own generated PDF salary slips in Profile. |
| **Global Analytics & Reports** | `src/screens/ReportsScreen.tsx` | Admin Only | Bottom tab behind `isAdmin` | Implemented in `pages/ReportsPage.tsx` | Completely Removed from Mobile | Remove `ReportsScreen` and `ReportsTab` from mobile navigation entirely. |
| **Store Announcement Broadcast** | `src/screens/NotificationsScreen.tsx`| Admin Only | None (View only) | Needs broadcast modal | Receive Announcements | Admin posts global or targeted announcements on Web Dashboard; Staff receives notifications on mobile. |
| **Shop Geofence & Store Settings** | `src/screens/ProfileScreen.tsx` | Admin Only | Settings tab behind `isAdmin` | Implemented in `pages/SettingsPage.tsx` | Removed (View Address Only) | Admin updates GPS coordinates, shop name, working hours, and GST on Web Dashboard. |
| **Administrative Audit Logs** | `src/services/auditService.ts` | Admin Only | Local cache in Profile | Needs dedicated page | Removed from Mobile | Dedicated `AuditLogsPage.tsx` on Admin Web Dashboard showing security-sensitive events. |
| **Staff Profile & Password Reset** | `src/screens/ProfileScreen.tsx` | Staff Only | Personal profile tab | Not Applicable (Staff Only) | Retained on Mobile | Staff views own verified details, enrolled face status, and initiates password reset. |
| **Admin Profile & Password Reset** | `src/screens/ProfileScreen.tsx` | Admin Only | Web Profile Page | Implemented in `pages/ProfilePage.tsx` | Not Applicable (Web Only) | Admin manages store credentials and password security on Web Dashboard. |

---

## 3. Classification Summary

- **Total Features Audited:** 35
- **Admin Only:** 17 features (Migrated to Web Dashboard, completely removed from mobile navigation)
- **Staff Only:** 6 features (Retained on mobile, not present on Web Dashboard)
- **Shared with Restricted Permissions:** 12 features (Admin has full access on Web; Staff has scoped/read-only access on Mobile)
- **Deprecated / Unused:** Cloud Functions provisioning (`functions/src/index.ts`) &rarr; Migrated to secure Firestore token invitation workflow.

---

## 4. Architectural Boundaries

```
[ ADMIN WEB DASHBOARD ]                       [ STAFF MOBILE APP ]
   (Desktop / Tablet)                             (Android / iOS)
          │                                              │
          ├─ Global Store KPIs                           ├─ Personal Punch In/Out
          ├─ Staff Directory & Targets                   ├─ GPS Geofence Check
          ├─ Staff Invitations & Status                  ├─ Assigned Leads & Follow-ups
          ├─ Attendance Override & Export                ├─ Mobile Price Catalog (Read Only)
          ├─ Price Catalog Full CRUD & Excel Import      ├─ Second Hand Buy/Sell (Counter Flow)
          ├─ Profit Margins & Purchase Costs             ├─ Personal Salary Slip Download
          ├─ Monthly Payroll Generation                  └─ Personal Staff Profile
          ├─ Announcements Broadcast
          ├─ Shop GPS Geofence Configuration
          └─ System Audit Logs
                  │                                              │
                  └───────────────┬──────────────────────────────┘
                                  ▼
                     [ CLOUD FIRESTORE (SPARK) ]
                     - /users/{userId}
                     - /staff_invitations/{token}
                     - /attendance/{attendanceId}
                     - /leads/{leadId}
                     - /mobile_prices/{priceId}
                     - /second_hand_purchases/{purchaseId}
                     - /second_hand_sales/{saleId}
                     - /sales_targets/{targetId}
                     - /salary_slips/{slipId}
                     - /notifications/{notificationId}
                     - /shop_config/main_store
                     - /audit_logs/{auditId}
```

