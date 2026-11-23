# Parth Mobile Care — Customer Name Bug Fix & Admin Dashboard Performance Optimization Report

**Date:** November 5, 2026  
**Project:** Parth Mobile Care (`parthmobilecare-a474d`)  
**Scope:** Admin Web Dashboard (`admin-dashboard/`) & Customer Name Data Flow  
**Brand Blue Anchor:** `#194D9C` (100% Preserved)  
**Verification:** Vitest (13/13 passed), Jest (300/300 passed), Production Build (Clean 0 errors in 2.14s)

---

## 1. Executive Summary & Root Cause Analysis

### Part 1: Customer Name Bug in Second-Hand Devices
- **Symptom:** In *Operations → Second-Hand Devices → In-Stock & Purchase Records*, the Samsung S24 Ultra (IMEI `646946191816491`) displayed a blank customer name and blank phone number, while earlier records (Apple 17 — "Manoj Malik", Apple iPhone 18 Pro Max — "Chetan Luhar") displayed customer details correctly.
- **Root Cause Identified:**
  1. During the KYC data separation refactor, `firestore.rules` enforced strict security isolation:
     ```cel
     function isValidSecondHandPurchase(data) {
       let allowed = [
         'id', 'brand', 'model', 'ram', 'storage', 'imei', 'condition', 'purchaseAmount',
         'purchaseDate', 'purchaseTime', 'purchasedByStaffId', 'purchasedByStaffName',
         'status', 'notes', 'hasSensitiveKyc', '_syncedAt'
       ];
       ...
     ```
     `customerName` and `phone` were intentionally excluded from `allowed` on the parent `second_hand_purchases/{id}` collection to prevent staff from storing sensitive PII on the inventory document.
  2. All sensitive customer KYC fields (`customerName`, `phone`, `alternatePhone`, `address`, `aadhaarNumber`, `customerPhotoUri`, etc.) are securely stored in the Admin-only subcollection:
     `/second_hand_purchases/{id}/kyc_sensitive/record`.
  3. Older records created before this rule change had `customerName` and `phone` written on the parent document. When the Samsung S24 Ultra was purchased on 2026-11-05, the customer name was stored exclusively in `kyc_sensitive/record`.
  4. The Admin Dashboard service `ApiService.getSecondHandPurchases()` previously executed a single `getDocs()` query on `second_hand_purchases` without resolving missing customer metadata from `kyc_sensitive/record`. In `SecondHandPage.tsx`, `{p.customerName}` was rendered directly without fallbacks.

- **Remediation Implemented:**
  1. **Safe Subcollection Resolution in `ApiService.getSecondHandPurchases()`:**
     When a purchase document is read by the store administrator, if `customerName` is missing from the parent document, `ApiService` reads `/second_hand_purchases/{id}/kyc_sensitive/record` (authorized for Admin) to populate `customerName` and `phone`.
  2. **Multi-Field Fallbacks & Privacy Normalization:**
     If `customerName` is not present, it safely checks `customerName || sellerName || (data as any).name || (hasSensitiveKyc ? 'Verified Seller (KYC)' : 'Name unavailable')`.
  3. **Table & Search Integration in `SecondHandPage.tsx`:**
     Table cells, search filters, and export generators now handle all fallback paths and render clean labels without empty spaces or missing phone lines.

---

### Part 2: Admin Dashboard Performance & Sluggishness Optimization
- **Symptom:** Page switching between tabs and tables felt sluggish due to duplicate Firestore reads and unmemoized component renders.
- **Root Cause Identified:**
  1. No query caching: Every tab navigation triggered roundtrip Firestore network reads for `users`, `attendance`, `leads`, `purchases`, `sales`, `prices`, `notifications`, and `shopConfig`.
  2. Redundant polling in `DashboardLayout.tsx`: `ApiService.getNotifications()` was queried on every `currentTab` change.
  3. Uncached in-flight requests: Multiple components mounting concurrently executed duplicate `getDocs()` queries for identical collections.
- **Remediation Implemented:**
  1. **Lightweight In-Memory Cache (`ApiService`):**
     - Built a TTL-based cache (20s to 60s depending on collection volatility).
     - Concurrent in-flight request deduplication (`inFlightRequests` Map): concurrent calls share a single Firestore Promise.
     - Automatic cache invalidation upon any create, update, or delete mutation.
  2. **React Rendering Optimizations:**
     - Wrapped all table filter, sort, and search computations in `useMemo`.
     - Preserved all state without unneeded parent re-renders.

---

### Part 3: Visual Polish & Alignment Corrections (From Reference Screenshots)
1. **Export Dropdown Chevron Stacking (Screenshots 4 & 5):**
   - In `ExportDropdown.tsx`, enforced `inline-flex flex-row items-center justify-center flex-nowrap whitespace-nowrap` on the button and `whitespace-nowrap shrink-0` on the label. The `Download` icon, "Export" text, and chevron `v` are strictly locked on a single horizontal row and can never wrap or stack vertically.
2. **Select Chevron Escaping Container (Screenshot 5):**
   - In `Select.tsx`, replaced `relative flex items-center` with `absolute right-3 top-1/2 -translate-y-1/2`. The dropdown arrow is locked into the vertical center of the `<select>` input, preventing detached or floating chevrons.
3. **Sidebar Footer Profile Email Truncation (Screenshot 4):**
   - In `DashboardLayout.tsx`, updated the profile container with `min-w-0 flex-1 overflow-hidden`, giving `currentUser?.email` clean truncation (`truncate leading-tight block select-all w-full`) with a native tooltip `title={currentUser?.email}`, preventing awkward clipping next to the sign-out icon.
4. **Overview "Total Acquired Devices" Dark Mode Surface (Screenshots 3 & 5):**
   - Replaced mixed opacity `bg-brand-50/70 dark:bg-[#142D50]` with clean theme tokens `dark:bg-[#17243A]`, `dark:border-[#24344D]`, crisp bold primary text `dark:text-[#E8EEF8]`, and a high-contrast icon badge `dark:bg-[#142D50] dark:text-blue-300`.
5. **Appearance & Theme Card Contrast (Screenshot 6):**
   - In `ProfilePage.tsx`, updated the selected Dark Mode card to use `bg-brand-50/70 dark:bg-[#17243A]`, `border-[#194D9C] ring-2 ring-[#194D9C]/30`, a bright icon badge `bg-[#194D9C] text-white`, and readable descriptions.
6. **Button Disabled State Contrast:**
   - In `Button.tsx`, replaced conflicting `disabled:bg-brand-500/50` + `disabled:opacity-60` with clean, modern disabled tokens, eliminating washed-out blue surfaces.

---

## 2. Test Verification Matrix

| Test Suite | Environment | Tests Passed | Status |
| :--- | :--- | :--- | :--- |
| `adminDashboard.test.ts` | Vitest (Web Admin) | **13 / 13 passed** | **GREEN** |
| Root Jest Test Suite (28 test files) | Jest (Mobile App) | **300 / 300 passed** | **GREEN** |
| TypeScript & Vite Production Build | Node / Vite 5.4.21 | **0 errors (built in 2.14s)** | **GREEN** |

---

## 3. Deployment Safety & Firebase Spark Tier Adherence
- **Zero Cloud Functions deployed.**
- **Zero Cloud Storage writes required.**
- **Zero modifications to production Firestore Security Rules.**
- **No changes to production database records directly.**
- All changes are strictly client-side within `admin-dashboard/` and maintain 100% backward compatibility.

