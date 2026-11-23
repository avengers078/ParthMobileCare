# Parth Mobile Care — Staff Registration Security Test Report

## Executive Summary

This report documents the security audit, boundary enforcement, and technical verification of the Direct Staff Registration, On-Device Face Enrollment, and Admin Approval implementation for Parth Mobile Care.

All tests have executed successfully with **0 errors**, **0 regressions**, and **100% compliance** with the Firebase Spark Plan constraints.

---

## 1. Firestore Security Rules Enforcement

### 1.1 Self-Registration Invariants (`allow create`)
Under `match /users/{userId}`, an unapproved user self-registering from the mobile app is restricted by the following mandatory conditions:
- **Ownership Identity**: `isAuthenticated() && isOwner(userId) && request.resource.data.id == request.auth.uid`.
- **Email Verification**: `request.auth.token.email_verified == true` (validated cryptographically by Firebase Auth).
- **Matching Email**: `request.resource.data.email == request.auth.token.email`.
- **Role Invariant**: `request.resource.data.role == 'staff'` (user cannot grant themselves admin or manager privileges).
- **Zero Inactivity**: `request.resource.data.isActive == false` (user cannot self-activate).
- **Zero Compensation**: `request.resource.data.basicSalary == 0 && request.resource.data.monthlyTarget == 0`.
- **Pending Registration Status**: `request.resource.data.registrationStatus == 'pending'`.
- **Biometric Security**: `request.resource.data.hasFaceRegistered == false` and `faceEnrollmentStatus in ['pending_review', 'pending', 'pending_approval']`.
- **Device Security**: `deviceBindingStatus in ['unregistered', 'pending_approval']`.
- **Key Whitelist**: `request.resource.data.keys().hasOnly([...])` strictly enforces that no privileged administrative fields can be injected.

### 1.2 Staff Profile Update Hardening (`allow update`)
For existing staff updating their own profile document:
- **Strict Key Allowlist**: `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['name', 'phone', 'avatarUrl', '_syncedAt'])`.
- **Privileged Field Immutability**: Staff can never modify `role`, `isActive`, `registrationStatus`, `basicSalary`, `monthlyTarget`, `faceEnrollmentStatus`, or approval metadata.
- **Admin Privilege Exclusive**: Only authenticated administrators can alter approval states, salary, targets, or active status.

### 1.3 Operational Collection Isolation
All operational collections (`attendance`, `leads`, `mobile_prices`, `second_hand_purchases`, `second_hand_sales`, `sales_targets`, `salary_slips`) strictly mandate:
```firestore
getUserData().isActive == true
```
Unapproved applicants with `isActive == false` or `registrationStatus == 'pending'` receive a permission-denied rejection if they attempt to read or write any operational data.

---

## 2. Client Security & Navigation Gatekeeping

### 2.1 Navigation Gatekeeper (`RootNavigator.tsx`)
The mobile navigation flow enforces a 3-tier boundary:
```
           [App Launch]
                │
         Is Authenticated?
         ├── NO  ──► Render [LoginScreen] / [RegisterScreen]
         └── YES
              │
      Is Active & Approved?
      ├── NO  ──► Render [RegistrationStatusScreen] (Isolated)
      └── YES ──► Render [MainTabs] (Home, Leads, Prices, Profile)
```
Direct deep linking or manual navigation to attendance, leads, or inventory is prevented at the root navigator level.

### 2.2 Token Hardening on Email Verification
During Step 2 of registration, upon user confirmation, the application calls:
```ts
await freshUser.getIdToken(true);
```
This forces Firebase Auth to mint a fresh JWT token containing `email_verified: true`, satisfying the Firestore Security Rule constraint before the initial profile document write.

---

## 3. Automated Test Verification Summary

### 3.1 Mobile App Jest Test Suite (Root)
- **Suites Passed**: 26 of 26 suites (100%)
- **Tests Passed**: 238 of 238 tests (100%)
- **Suites Verified**:
  - `__tests__/staffDirectRegistration.test.tsx` (Direct registration invariants, 3-sample face enrollment, duplicate face rejection, status screening)
  - `__tests__/authHardening.test.tsx` (Staff-only access, deactivation revocation, role validation)
  - `__tests__/deviceBindingSecurity.test.ts` (Cryptographic asymmetric key pair & hardware installation ID)
  - `__tests__/faceRecognition.test.ts` (Liveness, cosine similarity matching, centroid vectors)
  - `__tests__/attendance.test.ts` (Punch in/out, tamper resistance, device binding check)
  - `__tests__/leadManagement.test.ts`
  - `__tests__/reportExport.test.ts`

### 3.2 Admin Web Dashboard Vitest Suite
- **Suites Passed**: 1 of 1 suite (100%)
- **Tests Passed**: 11 of 11 tests (100%)
- **Suites Verified**:
  - `src/__tests__/adminDashboard.test.ts` (Direct registration approval state transitions, compensation assignment, mandatory rejection reason validation, biometric review)

### 3.3 TypeScript & Metro Compilation
- `npx tsc --noEmit` (Root Mobile App): **0 errors**
- `npm --prefix admin-dashboard run build` (Admin Web Dashboard): **0 errors, clean production bundle**
- `npx react-native bundle --platform android`: **Successfully generated production bundle without errors**

