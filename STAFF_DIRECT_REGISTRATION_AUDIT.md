# PARTH MOBILE CARE — DIRECT STAFF REGISTRATION AUDIT

**Date:** November 3, 2026  
**Document Version:** 1.0  
**Project:** Parth Mobile Care  
**Scope:** Architectural audit of the transition from token-based staff invitations to Direct Self-Registration with Face Enrollment and Admin Approval.  
**Infrastructure Tier:** Firebase Spark Plan (100% Free Tier, Zero Cloud Functions, Zero Blaze, Zero Firebase Storage)  

---

## 1. Executive Summary

Previously, staff onboarding required a store administrator to generate a 16-character invitation token (`PMC-INV-xxxxxxxx`) inside the Admin Dashboard, transmit the token out-of-band (e.g. WhatsApp or SMS), and have the staff member paste the token into an invitation modal on the mobile Login screen.

While cryptographically sound, this invitation-first workflow created operational friction:
1. Store administrators were required to manually initiate every staff account before the employee could even touch the mobile application.
2. If an administrator was busy or in the field, new staff could not begin account setup or biometric face capture.
3. If token transmission failed or was delayed, onboarding ground to a halt.

### The New Required Workflow: Direct Registration + Face Enrollment + Admin Approval
Under the direct registration model:
1. **Independent Mobile Intake**: Staff members download the mobile application and tap **"Create Staff Account"**.
2. **Multi-Step Self-Registration**:
   - Step 1: Personal Details (Name, Email, Mobile, Designation, Password).
   - Step 2: Email Verification via standard Firebase Authentication link.
   - Step 3: On-Device Biometric Face Registration (captures 3 samples, performs liveness verification, extracts MobileFaceNet 128D/192D centroid template).
   - Step 4: Submission of registration request with initial state `registrationStatus: 'pending'`, `isActive: false`, `faceEnrollmentStatus: 'pending_review'`.
3. **Admin Review & Approval**:
   - The registration request appears in the existing Admin Web Dashboard under a dedicated **Registration Requests** view.
   - Store administrators inspect applicant credentials, email verification status, biometric enrollment status, and device metadata.
   - Administrator either **Approves** the registration (activating the account and assigning compensation/targets) or **Rejects** with a mandatory explanation.
4. **Access Control**:
   - Until approved, staff cannot access protected screens, cannot punch attendance, and cannot view store data. A dedicated **Registration Status Screen** informs them of their pending or rejected status.
   - Upon approval, the staff member is immediately granted access to the Staff Mobile Application.

---

## 2. Audit of Existing Invitation Components & Disposal Plan

| Existing Component / File | Current Role | Migration & Disposal Strategy |
|:---|:---|:---|
| [`src/screens/LoginScreen.tsx`](file:///Users/chetan/ParthMobileCare/src/screens/LoginScreen.tsx) | Contains `"Invited Staff? Set Up Account"` button opening token verification modal. | Replace button with `"Create Staff Account"`. Route to dedicated multi-step [`RegisterScreen.tsx`](file:///Users/chetan/ParthMobileCare/src/screens/RegisterScreen.tsx). Remove the token verification modal while preserving staff email/password login. |
| [`src/services/staffProvisioningService.ts`](file:///Users/chetan/ParthMobileCare/src/services/staffProvisioningService.ts) | Implements token verification and acceptance logic against `staff_invitations`. | Retain for backwards compatibility with existing invited records, but introduce direct registration methods (`registerStaffAccount`, `checkRegistrationStatus`). |
| [`src/context/AuthContext.tsx`](file:///Users/chetan/ParthMobileCare/src/context/AuthContext.tsx) | Rejects sign-in immediately if `isActive === false` with fatal error. | Modify `acceptAuthUser` to load profile into `currentUser` even if `registrationStatus === 'pending'` or `'rejected'`, allowing the user to view their status screen rather than crashing or stranding them. |
| [`src/navigation/RootNavigator.tsx`](file:///Users/chetan/ParthMobileCare/src/navigation/RootNavigator.tsx) | Direct binary switch between `Login` and `MainTabs`. | Introduce three-state navigation flow: Unauthenticated (`Login`, `Register`), Pending/Rejected Approval (`RegistrationStatusScreen`), and Approved Active Staff (`MainTabs` + secondary stack). |
| [`firestore.rules`](file:///Users/chetan/ParthMobileCare/firestore.rules) | Line 656 restricts self-created user fields to a narrow list missing registration and biometric status. | Expand `isValidUser` and self-creation rules on `users/{userId}` to permit `registrationStatus: 'pending'`, `faceEnrollmentStatus: 'pending_review'`, `emailVerified`, `hasFaceRegistered`, and device info, while strictly prohibiting self-activation or role escalation. |
| `admin-dashboard/src/pages/StaffPage.tsx` | Manages staff directory, invitations, and device requests. | Add a dedicated **Registration Requests** tab with real-time pending counter, applicant profile viewer, Approve action, and Reject action with mandatory reason. |

---

## 3. Data Model Schema Specification

### Profile Document: `users/{userId}`
The direct registration model utilizes the existing `users/{userId}` canonical collection to avoid duplicate user storage and keep Spark Plan queries minimal:

```typescript
export interface User {
  id: string;                               // Firebase Auth UID
  name: string;                             // Full name (e.g. "Ramesh Patel")
  email: string;                            // Authenticated email address
  phone: string;                            // 10-digit Indian mobile number
  role: 'staff';                            // Strictly assigned as 'staff'
  designation: string;                      // E.g. "Sales Executive", "Service Specialist"
  avatarUrl?: string;                       // Optional avatar
  joinedDate: string;                       // YYYY-MM-DD
  basicSalary: number;                      // Initially 0; set by Admin upon approval
  monthlyTarget: number;                    // Initially 0; set by Admin upon approval
  isActive: boolean;                        // Initially false; set to true ONLY by Admin
  
  // Registration Lifecycle Fields
  registrationStatus: 'pending' | 'approved' | 'rejected';
  emailVerified: boolean;                   // Verified via Firebase Auth
  createdAt: string;                        // ISO timestamp of registration submission
  createdBy: string;                        // authUser.uid
  
  // Biometric Enrollment Fields
  hasFaceRegistered: boolean;               // True once face template is generated
  faceRegistrationDate?: string;            // ISO timestamp
  faceEnrollmentStatus: 'not_enrolled' | 'pending_review' | 'approved' | 'rejected';
  faceModelVersion?: string;                // "MobileFaceNet-v1"
  faceApprovedAt?: string;                  // ISO timestamp
  faceApprovedBy?: string;                  // Admin UID
  faceRejectionReason?: string;             // Optional reason if face rejected
  
  // Hardware Device Binding Fields
  deviceId?: string;                        // Unique hardware installation ID
  deviceModel?: string;                     // E.g. "Samsung Galaxy S23"
  devicePlatform?: 'android' | 'ios';       // Platform
  deviceBindingStatus?: 'unregistered' | 'pending_approval' | 'approved' | 'rejected';
  deviceRegisteredAt?: string;              // ISO timestamp
  
  // Admin Decision Audit Fields
  approvedAt?: string;                      // ISO timestamp
  approvedBy?: string;                      // Admin UID
  approvedByName?: string;                  // Admin display name
  rejectedAt?: string;                      // ISO timestamp
  rejectedBy?: string;                      // Admin UID
  rejectedByName?: string;                  // Admin display name
  rejectionReason?: string;                 // Mandatory reason if rejected
}
```

---

## 4. Security & Architecture Invariants

1. **Role Immutability**:
   - The mobile application has zero UI controls or API payloads that allow selecting role.
   - Firestore Security Rules enforce `request.resource.data.role == 'staff'` on self-create and reject any document where `role != 'staff'`.
2. **Activation Immutability**:
   - Staff can only create documents with `request.resource.data.isActive == false` and `request.resource.data.registrationStatus == 'pending'`.
   - Any attempt by an applicant to write `isActive == true` or `registrationStatus == 'approved'` is rejected by security rules.
3. **Compensation Isolation**:
   - Self-registration enforces `basicSalary == 0` and `monthlyTarget == 0`.
   - Compensation terms are assigned exclusively by store administrators during or after approval.
4. **Email Verification Precondition**:
   - Firestore rules require `request.auth.token.email_verified == true` before profile creation can succeed.
   - The client application enforces this at Step 2 before allowing the applicant to proceed to Face Registration.
5. **Biometric Data Protection**:
   - High-dimensional face descriptors (128D/192D) are stored in device-secure keystores or encrypted biometric template subcollections.
   - Raw face images are never uploaded to Firestore, strictly complying with the Spark Plan zero-storage boundary and privacy best practices.
6. **Client-Side Biometric Authenticity Caveat**:
   - Face matching and liveness challenges executed on-device cannot be cryptographically proven to a remote server without specialized hardware attestation. This is an honest architectural reality under the Firebase Spark Plan. Admin visual review of face enrollment samples and metadata provides the human-in-the-loop guarantee.

---

## 5. Migration Safety & Backwards Compatibility

1. **Existing Approved Staff**:
   - Existing approved staff accounts already have `isActive: true` and `role: 'staff'`.
   - For backwards compatibility, an existing user document with `isActive: true` and no explicit `registrationStatus` field is treated as `approved` by both the mobile client and the web dashboard.
2. **Existing Administrators**:
   - Administrators continue logging in via the Admin Web Dashboard (`admin-dashboard/`).
   - Admin accounts remain strictly blocked from the mobile application.
3. **Zero Data Loss**:
   - No collections or documents are deleted or dropped during this rollout.

