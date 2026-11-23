# PARTH MOBILE CARE — STAFF MOBILE APPLICATION FINAL MODULE STRUCTURE

**Date:** November 3, 2026  
**Document Version:** 1.0  
**Project:** Parth Mobile Care  
**Platform Target:** React Native (Android / iOS)  
**Hosting / Backend Plan:** Firebase Spark Plan (100% Free Tier, Zero Cloud Functions, Zero Blaze, Zero Firebase Storage)  

---

## 1. Architectural Role & Boundary Definition

The Parth Mobile Care technology platform operates with a strict, bidirectional architectural separation of concerns:

```
┌────────────────────────────────────────────────────────┐
│               PARTH MOBILE CARE PLATFORM               │
└──────────────────────────┬─────────────────────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
┌─────────────────────────┐ ┌─────────────────────────┐
│   ADMIN WEB DASHBOARD   │ │ STAFF MOBILE APPLICATION │
│  (`admin-dashboard/`)   │ │        (`src/`)          │
├─────────────────────────┤ ├─────────────────────────┤
│ • Role: `admin` only    │ │ • Role: `staff` only    │
│ • Web Browser / Desktop │ │ • Android Phone Native  │
│ • Full Store Management │ │ • Field / Counter Tasks │
│ • Staff Admin & Targets │ │ • Personal Attendance   │
│ • Payroll Disbursements │ │ • Hardware Key Binding  │
│ • Device/Face Approvals │ │ • On-Device Face Punch  │
│ • Wholesale Cost Config │ │ • Retail Price Catalog  │
│ • Excel Price Import    │ │ • Customer Lead Intake  │
│ • Second-Hand Margin    │ │ • 2nd Hand Intake/Sale  │
│ • KYC Document Viewer   │ │ • Personal Salary Slips │
│ • Geofence & Store Hrs  │ │ • Digital Signatures    │
│ • Append-Only Audit Log │ │ • WhatsApp Invoicing    │
└─────────────────────────┘ └─────────────────────────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
┌────────────────────────────────────────────────────────┐
│               FIREBASE FIRESTORE & AUTH                │
│    (Role-Gated Security Rules & Real-time Listeners)   │
└────────────────────────────────────────────────────────┘
```

### Core Security Invariants
1. **Zero Admin Access on Mobile**: Store administrators cannot sign in or access any screen in the mobile application. If an admin account signs in, the session is terminated immediately, local cache purged, and an explicit warning dialog directs them to the Admin Web Dashboard.
2. **Zero Financial Confidentiality Leaks**: Wholesale purchase costs, dealer margins, profit amounts, and store-wide profit statistics are 100% stripped from mobile code. Staff only see retail Selling Price (MOP) and In-Stock indicators.
3. **Zero Unmasked KYC Exposure**: Aadhaar numbers in purchase/sale records and IMEI histories are masked (`XXXX XXXX 1234`). Full KYC document viewing is exclusive to the Admin Web Dashboard and permanently audit-logged.
4. **Data Isolation**: All leads, sales metrics, attendance logs, and target counters are filtered strictly to the authenticated `currentUser.id`.

---

## 2. Directory Layout & Module Structure (`src/`)

```
src/
├── assets/
│   └── logo.png                          # Official mascot application logo
├── components/
│   ├── common/
│   │   ├── AnimatedCard.tsx              # Spring-animated tactile card container
│   │   └── AppAlert.tsx                  # Brand modal alert dialog (#194D9C)
│   ├── AppIcon.tsx                       # Unified Lucide icon abstraction
│   ├── Badge.tsx                         # Pill badge component
│   ├── Button.tsx                        # Outlined & secondary buttons
│   ├── DeviceBindingModal.tsx            # Staff hardware binding & replacement request modal
│   ├── DigitalSignaturePad.tsx           # SVG/Base64 digital signature pad for trade-ins
│   ├── DocumentCapture.tsx               # Camera & gallery document intake widget
│   ├── EmptyState.tsx                    # Empty listing state placeholder
│   ├── ErrorBoundary.tsx                 # React component error boundary
│   ├── FaceRegistrationModal.tsx         # Staff on-device camera face enrollment modal
│   ├── FaceVerificationModal.tsx         # Staff punch in/out face matching modal
│   ├── FilterChip.tsx                    # Horizontal scrolling category filter chip
│   ├── Header.tsx                        # LeadIQ styled screen header with back/action support
│   ├── Input.tsx                         # Validated text input with float labels & errors
│   ├── ModalCard.tsx                     # Bottom-sheet modal wrapper with backdrop
│   ├── OnDeviceFaceAuthView.tsx          # Real-time camera preview for MobileFaceNet
│   ├── PrimaryButton.tsx                 # Brand solid primary action button (#194D9C)
│   ├── SearchInput.tsx                   # Sticky search bar with clear button
│   ├── SectionHeader.tsx                 # Grouped section title with optional action
│   ├── StatCard.tsx                      # Metric summary card with gradient/icon
│   ├── StatusBadge.tsx                   # Status indicator (success, warning, info, danger)
│   └── index.ts                          # Clean component barrel export
├── constants/
│   └── index.ts                          # Brand definitions, default coordinates, initial lists
├── context/
│   ├── AlertContext.tsx                  # Global alert & confirmation dialog state
│   ├── AuthContext.tsx                   # Staff authentication, role enforcement & session listener
│   ├── ShopConfigContext.tsx             # Read-only store metadata & operating hours
│   └── ThemeContext.tsx                  # Light / Dark theme styling engine
├── navigation/
│   └── RootNavigator.tsx                 # Bottom tabs (`MainTabs`) & secondary stack screens
├── screens/
│   ├── AttendanceScreen.tsx              # GPS + On-device Face Punch & personal history
│   ├── HomeScreen.tsx                    # Staff daily operations dashboard & due follow-ups
│   ├── LeadListScreen.tsx                # Customer lead management, intake & status pipeline
│   ├── LoginScreen.tsx                   # Staff sign-in & token-based invitation setup
│   ├── PriceListScreen.tsx               # Retail mobile catalog (MOP selling prices only)
│   ├── ProfileScreen.tsx                 # Staff account details, personal targets & salary slips
│   └── SecondHandScreen.tsx              # Customer trade-in intake, retail sale & invoice PDF
├── services/
│   ├── attendanceService.ts              # Punch in/out calculation, daily shift status
│   ├── deviceBindingService.ts           # Keystore/Keychain RSA keypair & device binding requests
│   ├── deviceSecurityService.ts          # Root/Jailbreak detection & hardware integrity check
│   ├── excelService.ts                   # Staff-side sheet utilities (if needed)
│   ├── faceRecognitionService.ts         # Face detection & MobileFaceNet 192D embedding matcher
│   ├── firebase.ts                       # Modular Firebase Auth & Firestore initialization
│   ├── firestoreSync.ts                  # Spark-compatible Firestore offline & collection cache
│   ├── leadService.ts                    # Customer lead CRUD, status transitions, follow-up math
│   ├── locationService.ts                # High-accuracy GPS positioning & geofence distance calculation
│   ├── notificationService.ts            # Local push reminders for customer follow-ups
│   ├── onDeviceFaceAuth.ts               # Native camera frame processing & Euclidean distance matcher
│   ├── pdfService.ts                     # React Native PDF generator for tax invoices & salary slips
│   ├── secondHandService.ts              # Trade-in intake, IMEI verification & atomic sales
│   └── storageService.ts                 # AsyncStorage local caching layer
├── theme/
│   ├── colors.ts                         # Brand palette (#194D9C primary, #16A34A accent)
│   └── index.ts                          # Spacing, typography, border radius & shadow tokens
├── types/
│   └── index.ts                          # Strict TypeScript models & interfaces
└── utils/
    ├── crypto.ts                         # SHA-256 / Base64 cryptographic helpers
    ├── errorHandler.ts                   # User-friendly error message resolution
    ├── format.ts                         # Currency (₹ INR), date, and time formatting
    ├── geo.ts                            # Haversine distance & geofence perimeter checks
    ├── validation.ts                     # Indian mobile number & 15-digit IMEI validator
    └── whatsapp.ts                       # WhatsApp Click-to-Chat deep links & templates
```

---

## 3. Retained Staff Modules — Detailed Specification

### 3.1. Authentication & Staff Invitation Setup (`LoginScreen.tsx` & `AuthContext.tsx`)
- **Capabilities**:
  - Staff credentials login (Email + Password).
  - Token-based staff invitation setup: staff enters 16-character token generated by Admin, verifies profile name, sets their password, and immediately logs in.
  - Password reset request via Firebase Auth email link.
- **Admin Blocking**:
  - If a user with `profile.role !== 'staff'` attempts to log in, `AuthContext.login` rejects the attempt, invokes `signOut()`, purges local cache, and displays:
    `"Access Denied: Store administrators must use the Parth Mobile Care Admin Web Dashboard. This mobile app is exclusively for staff members."`
  - Real-time Firestore snapshot listener continuously verifies `role === 'staff'` and `isActive === true`. If the Admin deactivates the staff member or changes their role, mobile access is revoked immediately.

### 3.2. Staff Daily Operations Dashboard (`HomeScreen.tsx`)
- **Navigation**: First tab of bottom navigation (`HomeTab`).
- **Capabilities**:
  - Welcome banner with employee name and designation.
  - Punctuality indicator (Punched In / Not Punched) with one-tap link to Attendance.
  - Personal monthly metrics:
    - *My Leads This Month*: Count of leads created by or assigned to the staff member.
    - *My Closed Leads*: Converted leads attributed to the staff member.
    - *Pending Follow-ups*: Leads awaiting customer contact.
    - *Conversion Rate*: Percentage of converted leads for the staff member.
  - Urgent Follow-ups Carousel: Highlighted customer leads due today with quick Call and WhatsApp buttons.
  - Quick action shortcuts: "New Lead", "Attendance", "Buy Phone", "Price List".
  - Recent personal activity feed (recent leads and completed sales).

### 3.3. Personal Attendance & Biometric Face Punch (`AttendanceScreen.tsx`)
- **Navigation**: Accessible from Home screen and Stack Navigator (`Attendance`).
- **Capabilities**:
  - Live GPS Location Check: Displays current distance from shop center with visual inside/outside geofence indicator (standard 30-meter radius).
  - Hardware Device Binding Verification: Ensures punch occurs only on the staff member's approved device. If unbound, prompts to register; if pending approval, displays status.
  - On-Device Face Authentication: Front camera scans staff face, extracts 192D embedding, and compares Euclidean distance against approved biometric template (threshold ≤ 0.85).
  - Punch In / Punch Out: Records timestamp (Firestore server timestamp) and verified GPS coordinates.
  - Personal Attendance History: Monthly calendar view showing Present, Late, Half Day, Absent, and Off Days with shift durations.
- **Removed Admin Elements**:
  - Staff selection filter chips (`allUsers`) removed — screen is strictly locked to `currentUser.id`.
  - Admin face review banner removed.
  - "Approvals" header button and `FaceMonitoringModal` removed.

### 3.4. Customer Lead Management (`LeadListScreen.tsx`)
- **Navigation**: Second tab of bottom navigation (`LeadsTab`).
- **Capabilities**:
  - Search by customer name, phone number, or mobile model.
  - Pipeline status filter chips: *All*, *New*, *Interested*, *Follow Up*, *Negotiation*, *Purchased*, *Lost*.
  - Add Customer Lead Modal:
    - Customer full name.
    - 10-digit Indian mobile number (validated with standard regex).
    - Interested brand & model.
    - Customer budget (₹).
    - Follow-up date & notes.
  - Lead Card Actions:
    - Direct phone call (`tel:`).
    - Direct WhatsApp message with automated template (`whatsapp://send`).
    - Advance status in pipeline.
    - Add activity note.

### 3.5. Retail Mobile Price Catalog (`PriceListScreen.tsx`)
- **Navigation**: Third tab of bottom navigation (`PriceListTab`).
- **Capabilities**:
  - Search mobile models by name, RAM variant, or storage.
  - Brand filter tabs: *All*, *Apple*, *Samsung*, *Vivo*, *Oppo*, *Realme*, *OnePlus*, *Xiaomi*, etc.
  - Model Card Display:
    - Model name & brand badge.
    - Specification variant (e.g. 8GB RAM • 128GB Storage).
    - Official Retail Selling Price (MOP).
    - In-Stock availability badge.
    - Past price revisions history modal (customer selling price only).
- **Removed Admin Elements**:
  - Wholesale purchase cost (`purchasePrice`) removed.
  - Gross profit margin (`margin`) and margin percentage (`marginPercent`) removed.
  - Floating Action Button (FAB) to "+ Add Model" removed.
  - Edit prices and Delete model buttons removed.
  - Excel price sheet import modal and header button removed.

### 3.6. Second-Hand Phone Intake & Retail Sales (`SecondHandScreen.tsx`)
- **Navigation**: Secondary stack screen accessible from Home (`BuySell`).
- **Capabilities**:
  - **Purchase Intake Tab**:
    - Customer KYC entry: Full name, verified mobile, alternative contact, residential address, 12-digit Aadhaar number.
    - Document capture: Aadhaar Front photo, Aadhaar Back photo, Customer photo, Original bill upload.
    - Device details: Brand, model, 15-digit numeric IMEI, physical condition, trade-in purchase price.
    - Customer Digital Signature pad: Legal declaration signed by customer on touchscreen.
    - Saves device directly to in-stock inventory.
  - **Retail Sales Tab**:
    - Select from available in-stock devices.
    - Buyer full name, mobile number, address, and Aadhaar number.
    - Agreed selling price and payment method (UPI, Cash, Card).
    - Buyer digital signature.
    - Generates official Parth Mobile Care Tax Invoice with invoice number.
    - Generates PDF invoice and shares directly to customer WhatsApp via PDF print/share.
  - **IMEI Search Tab**:
    - Validates 15-digit IMEI to check if the device is currently in store stock or was previously traded.
- **Removed Admin Elements**:
  - Admin "View KYC" button and confidential KYC document viewer modal removed.
  - Unmask Aadhaar toggle removed (Aadhaar numbers remain masked: `XXXX XXXX 1234`).
  - Net Profit column (`profitAmount`) removed from sales cards.
  - Wholesale purchase cost removed from sales history cards and IMEI search results.

### 3.7. Staff Profile, Monthly Targets & Salary Slips (`ProfileScreen.tsx`)
- **Navigation**: Fourth tab of bottom navigation (`ProfileTab`).
- **Capabilities**:
  - Hero profile card with avatar initial, employee name, "Staff" badge, designation, phone, and email.
  - Theme mode toggle button (Light / Dark mode).
  - Tab 1: **Account**:
    - Personal details: Full name, mobile, email, designation, joined date.
    - Biometric face registration status.
    - Hardware device binding status badge (Approved, Pending Approval, or Unbound).
    - Store details: Shop name, address, GSTIN, and operating hours (read-only).
    - Security actions: Reset password via email.
    - Prominent red-accented Sign Out button with confirmation dialog.
  - Tab 2: **Targets & Salary**:
    - Monthly Sales Target progress bar: Visual percentage bar of target vs achieved volume.
    - Month-wise selector (12-month rolling history).
    - Salary breakdown summary: Basic pay, sales incentives earned, punctuality bonuses, and deductions.
    - View Official Salary Statement modal.
    - Download / Save official Salary Statement PDF.
    - Share salary summary via text.
- **Removed Admin Elements**:
  - "Shop Settings" tab (`shop_config`) removed (geofencing coordinates and store operating hours).
  - "Admin Audit Trail" tab (`audit_logs`) removed.
  - "Manage Staff & Sales Targets" action row removed.

---

## 4. Security Rules & Data Scoping Architecture

| Feature Area | Mobile App Staff Rule | Admin Web Dashboard Rule | Enforced By |
|:---|:---|:---|:---|
| **Authentication** | Role must equal `staff`. Admins/Managers rejected. | Role must equal `admin`. Staff rejected. | `AuthContext.tsx` + Firestore listener |
| **Attendance Records** | Can read and write only documents matching `request.auth.uid == userId`. | Can read and review all staff attendance records. | `firestore.rules` |
| **Staff Directory** | Cannot list or read `/users` collection of other staff members. | Full read and update permissions on `/users`. | `firestore.rules` |
| **Wholesale Costs** | Mobile client has 0 code references to purchase cost/margin calculations in Price List. | Full CRUD on retail and wholesale price sheets. | Code removal + Web API |
| **Customer KYC** | Customer Aadhaar is masked in all UI lists. Staff can only write during intake. | Admin can view KYC documents with mandatory audit logging. | Code removal + Web Audit service |
| **Second-Hand Margin**| Staff sees selling price; profit margin is not calculated or rendered in sales cards. | Complete gross profit and margin analytics across all sales. | Code removal + Web analytics |
| **Geofencing Config** | Read-only configuration fetched to determine current punch radius. | Admin can update latitude, longitude, radius, and hours. | `firestore.rules` |
| **Device Binding** | Staff generates RSA keypair and submits request for their own UID. | Admin approves or rejects device binding requests. | `firestore.rules` + `DeviceBindingService` |

---

## 5. Technical Validation Matrix

| Test Suite / Build Verification | Scope | Status | Notes |
|:---|:---|:---:|:---|
| `npx tsc --noEmit` (Root Mobile) | Type check all 60+ mobile TypeScript files | **PASS** | 0 type errors |
| `npm test -- --watchman=false` | 25 test suites, 231 unit/integration tests | **PASS (231/231)** | 100% pass rate |
| `npx react-native bundle` | Android Metro production bundle test | **PASS** | Bundle output written cleanly to disk |
| `npm --prefix admin-dashboard test` | Admin Web Dashboard Vitest test suite | **PASS (8/8)** | Zero regression in web dashboard |
| `npm --prefix admin-dashboard run build` | Admin Web Dashboard production build (`tsc && vite build`)| **PASS** | Dist bundle built in 2.03s |

---

## 6. Conclusion

The Parth Mobile Care React Native application is now 100% **Staff-Only**. All administration, staff provisioning, price sheet imports, financial margin analytics, geofence rules, and audit logging live exclusively in the Admin Web Dashboard. The mobile codebase is lean, secure, role-restricted, and strictly adheres to the Firebase Spark Plan constraints.

