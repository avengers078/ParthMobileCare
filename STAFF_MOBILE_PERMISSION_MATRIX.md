# PARTH MOBILE CARE — STAFF MOBILE PERMISSION MATRIX

## 1. System Role Architecture

Parth Mobile Care enforces an asymmetric dual-platform architecture:
- **Administrator Role**: Administered exclusively through the **Admin Web Dashboard** (`admin-dashboard/`).
- **Staff Role**: Operated exclusively through the **React Native Mobile Application**.

---

## 2. Feature & Permission Comparison Matrix

| Module / Action | Admin Web Dashboard | Staff Mobile App | Security & Enforcement Mechanism |
|---|:---:|:---:|---|
| **Authentication & Sign In** | Yes (Admin only) | Yes (Staff only) | Role check on login; admin blocked from mobile, staff blocked from web. |
| **Account Setup / Provisioning** | Yes (Create Invites) | Yes (Token Setup) | Web creates 7-day single-use token; staff enters token on mobile to self-register. |
| **KPI & Revenue Dashboard** | Yes (Store-wide) | No | Mobile dashboard scoped strictly to staff member's personal daily metrics. |
| **Staff Directory & Permissions** | Yes | **NO (Blocked)** | Route and UI removed from mobile bundle; only available on web portal. |
| **Deactivate / Activate Staff** | Yes | **NO (Blocked)** | Guarded by Firestore rules (`isAdmin()`). |
| **Password Reset Dispatch** | Yes | Yes (Self reset) | Admin dispatches reset from web; staff can trigger self-reset via email. |
| **Punch In / Punch Out** | No (Store Floor) | **YES** | Enforced via GPS geofencing radius (30m) & on-device face verification. |
| **Attendance Approvals** | Yes | **NO (Blocked)** | Only Admin on web can approve or adjust punch records. |
| **Attendance Manual Corrections** | Yes (Audit Reason) | **NO (Blocked)** | Web modal requires administrative justification; logs to `audit_logs`. |
| **Export Attendance to Excel** | Yes | **NO (Blocked)** | Export button removed from mobile; available in Admin web header. |
| **Create / Capture Leads** | Yes | **YES** | Both platforms write to `leads/{leadId}` with standard schema. |
| **View Leads Pipeline** | Yes (All Leads) | Restricted | Staff only sees leads created by self or assigned to self. |
| **Reassign Leads to Staff** | Yes | **NO (Blocked)** | Admin only on web; changes logged to security audit trail. |
| **Delete Customer Leads** | Yes (Logged) | **NO (Blocked)** | Delete restricted to Admin; mobile app does not provide delete action. |
| **Export Leads to Excel** | Yes | **NO (Blocked)** | Available on web portal. |
| **View Selling Price (MOP)** | Yes | **YES** | Both platforms display retail selling prices for customer inquiries. |
| **View Purchase Cost & Margin** | Yes | **NO (Hidden)** | Mobile app hides purchase cost and profit margin for non-admin accounts. |
| **Add / Edit Phone Prices** | Yes | **NO (Blocked)** | Mobile app is strictly view-only; add/edit modals removed from mobile. |
| **Bulk Import Prices (Excel/CSV)**| Yes (File Preview) | **NO (Blocked)** | Handled exclusively via Vite web interface using `xlsx`. |
| **Record 2nd-Hand Purchase** | Yes | **YES** | In-store trade-ins: staff captures device details, customer photo & signature. |
| **Record 2nd-Hand Sale** | Yes | **YES** | In-store sales: staff records buyer details, payment mode, IMEI, and warranty. |
| **Generate & Print Tax Invoice** | Yes (PDF Download) | Yes (WhatsApp PDF) | Web generates PDF via `jspdf`; mobile generates and shares PDF attachment. |
| **Inspect Unmasked Aadhaar KYC** | Yes | **NO (Masked)** | Customer Aadhaar is masked (`XXXX-XXXX-1234`) on mobile for staff. |
| **View 2nd-Hand Profit Margins** | Yes | **NO (Hidden)** | Net profit and margin percent columns hidden on mobile device. |
| **Salary Calculation & Payroll** | Yes (All Staff) | **NO (Blocked)** | Dedicated calculation engine and payouts page on web portal. |
| **View Own Salary Slip** | Yes | Yes (Profile tab) | Staff can view their own generated slip; cannot view team members' slips. |
| **Reports & Sales Turnover** | Yes (Full Trends) | **NO (Blocked)** | Reports tab and financial charts completely removed from mobile navigation. |
| **Broadcast Store Announcements** | Yes | Receive Only | Admin broadcasts from web; staff receives in real-time notification feed. |
| **Security Audit Logs** | Yes | **NO (Blocked)** | Immutable audit records only readable by Admin on web dashboard. |
| **Store Geo-Fencing Settings** | Yes | Read Only | Admin configures latitude, longitude, and radius; mobile validates attendance. |

---

## 3. Mobile Navigation Layout for Staff

```
[ BOTTOM TAB BAR ]
├── 1. HomeTab      (Personal Punch, Today Sales, Personal Follow-ups, Personal Target)
├── 2. LeadsTab     (Own Customer Inquiries, Status Updates, WhatsApp Follow-up)
├── 3. PriceListTab (Search Phone Models, Storage Variants, Retail MOP Prices - View Only)
└── 4. ProfileTab   (Personal Staff Info, Biometric Status, Store Hours, Logout)

[ STACK SCREENS ]
├── AttendanceScreen (Geo-Fenced Punch In/Out, Biometric Verification, Own Logs)
├── SecondHandScreen (Trade-in Purchase with KYC, Refurbished Sale with PDF Invoice)
└── NotificationsScreen (Store Broadcasts, Personal Follow-up Reminders)
```

**Removed from Mobile Navigation Bundle**:
- `ReportsTab`
- `StaffManagementScreen`
- `PayrollScreen`
- `ExcelImportModal`

