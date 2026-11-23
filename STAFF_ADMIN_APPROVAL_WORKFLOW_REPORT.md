# PARTH MOBILE CARE — STAFF ADMIN APPROVAL & REJECTION WORKFLOW REPORT

**Date:** November 3, 2026  
**Status:** FULLY INTEGRATED & AUDITED  
**Platform:** Admin Web Dashboard (`admin-dashboard/`) & Staff Mobile Application  

---

## Executive Summary

The Admin Review, Approval, and Rejection module operates exclusively inside the Admin Web Dashboard (`admin-dashboard/`). When staff members complete direct registration, their applications appear in real time under the "Registration Requests" tab. Store administrators review employment details, email verification status, and biometric enrollment before making an authoritative decision.

The Staff Mobile App listens in real time to the Firestore profile document via `onSnapshot`, automatically transitioning the user into the approved staff dashboard (`MainTabs`) or presenting the rejection reason without requiring manual app reboots.

---

## 1. Admin Web Dashboard Review Portal

Located in [`admin-dashboard/src/pages/StaffPage.tsx`](file:///Users/chetan/ParthMobileCare/admin-dashboard/src/pages/StaffPage.tsx), the tab **Registration Requests** displays:
- **Staff Name & Contact**: Full name, email, and mobile number.
- **Designation / Role Title**: Proposed role (e.g. Sales Executive, Technician).
- **Email Verification Status**: Green badge (`Verified`) or Amber badge (`Unverified`).
- **Face Biometrics Status**: Green badge (`Approved`) or Amber badge (`Pending Review`).
- **Device Model & Binding**: Hardware model and truncated installation ID.
- **Submission Date**: Exact timestamp of submission.
- **Action Buttons**: **Approve** and **Reject**.

---

## 2. Admin Actions

### A. Approval Workflow
When the administrator clicks **Approve**:
1. An approval modal prompts for:
   - **Basic Monthly Salary (₹)**: Mandatory numeric value (e.g. ₹20,000).
   - **Monthly Sales Target (₹)**: Mandatory numeric value (e.g. ₹200,000).
2. The dashboard invokes [`ApiService.approveStaffRegistration`](file:///Users/chetan/ParthMobileCare/admin-dashboard/src/services/api.ts#L714):
   ```typescript
   await updateDoc(userRef, {
     registrationStatus: 'approved',
     isActive: true,
     basicSalary: Number(params.basicSalary) || 0,
     monthlyTarget: Number(params.monthlyTarget) || 0,
     approvedAt: nowIso,
     approvedBy: admin.id,
     approvedByName: admin.name || admin.id,
     rejectionReason: null,
     faceEnrollmentStatus: 'approved',
     hasFaceRegistered: true,
     faceApprovedAt: nowIso,
     faceApprovedBy: admin.name || admin.id,
     deviceBindingStatus: 'approved',
     deviceApprovedAt: nowIso,
     deviceApprovedBy: admin.name || admin.id,
   });
   ```
3. An administrative audit log entry is written to `admin_audit_logs/{logId}` recording the administrator's UID, timestamp, and target staff details.

### B. Rejection Workflow
When the administrator clicks **Reject**:
1. A rejection modal requires a **Mandatory Rejection Reason** (minimum 5 characters).
2. The dashboard invokes [`ApiService.rejectStaffRegistration`](file:///Users/chetan/ParthMobileCare/admin-dashboard/src/services/api.ts#L758):
   ```typescript
   await updateDoc(userRef, {
     registrationStatus: 'rejected',
     isActive: false,
     rejectedAt: nowIso,
     rejectedBy: admin.id,
     rejectedByName: admin.name || admin.id,
     rejectionReason: reason.trim(),
     rejectedBy: admin.id,
     rejectedByName: admin.name || admin.id,
   });
   ```
3. An audit log is recorded in `admin_audit_logs`.

---

## 3. Mobile Application Behavior After Decision

### A. Pending State
- Displayed by [`RegistrationStatusScreen.tsx`](file:///Users/chetan/ParthMobileCare/src/screens/RegistrationStatusScreen.tsx).
- Displays: *"Your registration request has been submitted successfully. Once an Administrator approves your request, your access will be activated."*
- Features an **Applicant Summary** and a manual **"Check Approval Status"** button.
- Never displays missing-profile error dialogs.

### B. Real-Time Approval Detection
- Inside `src/context/AuthContext.tsx`, `onSnapshot` monitors `users/{uid}`.
- When `registrationStatus == 'approved'` and `isActive == true`:
  1. `authStatus` transitions to `'approved_staff'`.
  2. `StorageService.clearStaffRegistrationDraft()` cleans up any residual registration draft.
  3. `FirestoreSyncService.pullAllCloudToLocal()` initializes local caches for inventory, leads, and prices.
  4. `RootNavigator.tsx` automatically switches navigation from `RegistrationStatus` to `MainTabs` (Staff Home).

### C. Real-Time Rejection Handling
- When `registrationStatus == 'rejected'`:
  1. `authStatus` transitions to `'rejected'`.
  2. `RegistrationStatusScreen.tsx` displays the rejection header, red alert badge, and the administrator's exact explanation in the **"ADMINISTRATOR'S REASON"** box.
  3. Protected screens remain strictly locked.
  4. A **"Start New Registration"** button allows the applicant to clear local state and submit a fresh application if permitted by store management.

---

## 4. Security & Authorization Guarantees

1. **Staff Authorization Restrictions**:
   - In `firestore.rules`, staff cannot update `registrationStatus`, `isActive`, `basicSalary`, `monthlyTarget`, `approvedAt`, `approvedBy`, `faceApprovedAt`, or `faceApprovedBy`.
   - Any client-side attempt to modify these fields is rejected by `diff().affectedKeys().hasOnly(['name', 'phone', 'avatarUrl', '_syncedAt'])`.
2. **Exclusively Admin-Driven Activation**:
   - Only users authenticated with `isAdmin() == true` can execute `approveStaffRegistration` and `rejectStaffRegistration`.
