# Parth Mobile Care — Staff Registration Reset Acceptance Report

**Date:** 2026-11-05  
**Audit Status:** DRY RUN AUDIT COMPLETE & ACCEPTED  
**Application Status:** STAFF REGISTRATION FIX VERIFIED & TESTED  

---

## 1. Acceptance Checklist & Verification Summary

| Requirement | Status | Evidence / Verification |
| :--- | :--- | :--- |
| **Dry-Run Cleanup Audit** | **PASSED** | Generated `STAFF_REGISTRATION_CLEANUP_AUDIT.md`. Evaluated 5 Auth accounts and 2 Firestore docs. |
| **No Premature Deletion** | **PASSED** | Zero destructive writes or deletions executed pending explicit user confirmation. |
| **Admin Protection Invariant** | **PASSED** | Admin profile `NmX4ySVJ6NPHytFA6XLnY9GYoCg1` confirmed protected. |
| **Active Staff Invariant** | **PASSED** | Active staff `user_staff_1792925577356` (Ramesh Patel) confirmed protected. |
| **Orphan Accounts Classified** | **PASSED** | 4 candidate orphan Auth accounts identified with exact UIDs and emails. |
| **Token Refresh & Email Claim** | **PASSED** | Token force-refresh and `idTokenResult.claims.email_verified` implemented in `RegisterScreen.tsx`. |
| **Device Identity String Bounds** | **PASSED** | Fallbacks guarantee `deviceId` and `devicePublicKey` non-empty string constraints. |
| **Diagnostic Error Messages** | **PASSED** | Replaced generic permission error with specific diagnostic messages. |
| **Firestore Emulator Tests** | **PASSED** | 53 / 53 tests passed across 10 test suites in `__tests__/firestoreRulesEmulator.test.ts`. |
| **Mobile Jest Test Suite** | **PASSED** | 300 / 300 tests passed across 28 test suites in `npm test`. |
| **React Native TypeScript** | **PASSED** | `npx tsc --noEmit` exited cleanly with 0 errors. |
| **Admin Dashboard Vitest** | **PASSED** | 11 / 11 tests passed in `admin-dashboard`. |
| **Admin Dashboard Build** | **PASSED** | Vite production build clean in `admin-dashboard`. |

---

## 2. Test Execution Details

### A. Real Firestore Emulator Acceptance Tests (`npm run test:rules:emulator`)
```text
✔ Firestore Rules Real Emulator Acceptance Tests
  ✔ Staff Registration Creation (allow create) (5 tests passed)
  ✔ Staff Registration Resubmission & Transitions (allow update) (5 tests passed)
  ✔ Staff Profile Read Permissions (allow read) (3 tests passed)
  ✔ Admin Authorization & Deactivation Defense (6 tests passed)
  ✔ Second-Hand Purchases & KYC Isolation (10 tests passed)
  ✔ Second-Hand Sales & Sensitive KYC Isolation (6 tests passed)
  ✔ Notification Authorization & Owner Permissions (6 tests passed)
  ✔ Attendance & Punch Record Integrity (7 tests passed)
  ✔ Salary Slips & Administrative Payroll Locks (3 tests passed)
  ✔ Post-Hardening Security Remediation Verification (2 tests passed)

ℹ tests 53
ℹ suites 10
ℹ pass 53
ℹ fail 0
```

### B. Mobile Jest Test Suite (`npm test`)
```text
Test Suites: 28 passed, 28 total
Tests:       300 passed, 300 total
Snapshots:   0 total
Time:        2.147 s
```

### C. Admin Dashboard Test & Build
```text
 ✓ src/__tests__/adminDashboard.test.ts (11 tests passed)
 Test Files  1 passed (1)
      Tests  11 passed (11)
 ✓ vite build completed in 2.11s (0 errors)
```

---

## 3. Account Reset Recommendation & Next Step

Once you review and approve the dry-run audit in `STAFF_REGISTRATION_CLEANUP_AUDIT.md`, you can run the following command in terminal to safely delete only the 4 orphan candidate accounts:

```bash
node scripts/cleanup_orphan_staff.mjs --execute
```

This will clear the 4 orphan Firebase Authentication accounts, allowing those staff members to register again with their legitimate email addresses.

