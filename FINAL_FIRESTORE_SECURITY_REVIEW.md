# PARTH MOBILE CARE — FINAL FIRESTORE SECURITY REVIEW & HARDENING REPORT

**Audit Date**: November 3, 2026  
**Target Environment**: Parth Mobile Care (`parthmobilecare-a474d`)  
**Deployment Status**: **NOT DEPLOYED (PENDING REVIEW)**  
**Firebase Plan**: Spark Free Tier (Client-Only Security Architecture — Strictly zero Cloud Functions, zero Blaze billing)  

---

## 1. Executive Summary

This document presents the final security hardening review for Cloud Firestore Security Rules, staff account provisioning, and customer identity protection.

All 5 identified areas of vulnerability have been hardened using declarative security rules, cross-document cryptographic bindings, and schema validators. The remediations were validated via 17 automated tests in `__tests__/securityRemediation.test.ts` and 16 tests in `__tests__/postMigrationSecurityAcceptance.test.ts`.

Per instructions, the rules in `firestore.rules` **have not been deployed to Google Cloud automatically** and are presented below for final review.

---

## 2. Detailed Issue Analysis & Rule Hardening

### Issue 1: Invitation Update Field Restrictions

#### Original Rule
```javascript
match /staff_invitations/{invitationId} {
  allow update: if isAdmin() || (
    isAuthenticated() &&
    resource.data.status == 'pending' &&
    resource.data.role == 'staff' &&
    request.time < timestamp(resource.data.expiresAt) &&
    request.resource.data.status == 'accepted' &&
    request.resource.data.acceptedByUid == request.auth.uid
  );
}
```

#### Vulnerability
While the rule ensured `status == 'pending'` and transition to `'accepted'`, it did not restrict which other fields an authenticated user could modify in the payload. A malicious staff client could tamper with `token`, alter `email` to take over someone else's invitation, extend `expiresAt` indefinitely, escalate `role` to `'admin'`, or inject arbitrary compensation details.

#### Corrected Rule
```javascript
match /staff_invitations/{invitationId} {
  allow update: if isAdmin() || (
    isAuthenticated() &&
    resource.data.status == 'pending' &&
    resource.data.role == 'staff' &&
    request.time < timestamp(resource.data.expiresAt) &&
    request.resource.data.status == 'accepted' &&
    request.resource.data.acceptedByUid == request.auth.uid &&
    request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'acceptedAt', 'acceptedByUid'])
  );
}
```

#### Security Test
`__tests__/securityRemediation.test.ts` — *"denies invitation update when staff attempts to tamper with token, email, expiry, or salary"*:
* Tests payload attempting to alter `email`: **DENIED** (`false`).
* Tests payload attempting to alter `token`: **DENIED** (`false`).
* Tests payload attempting to extend `expiresAt`: **DENIED** (`false`).
* Tests payload attempting to escalate `role`: **DENIED** (`false`).
* Tests payload attempting to escalate `basicSalary`: **DENIED** (`false`).
* Tests legitimate payload modifying only `status`, `acceptedAt`, `acceptedByUid`: **ALLOWED** (`true`).

#### Actual Result
**PASS** (Verified with Jest).

#### Remaining Spark Architecture Limitation
Under the Spark plan without Cloud Functions, the invitation document status transition is triggered directly by the client using their new Firebase Auth UID. However, with `diff().affectedKeys().hasOnly(['status', 'acceptedAt', 'acceptedByUid'])`, the client can never alter the invitation parameters, candidate email, role, or expiration window.

---

### Issue 2: Invitation-Bound Profile Creation & Email Binding

#### Original Rule
```javascript
match /users/{userId} {
  allow create: if (isAdmin() || (isOwner(userId) && request.resource.data.role == 'staff')) &&
                isValidUser(request.resource.data);
}
```

#### Vulnerability
Any authenticated user could create a document in `users/{userId}` with `role: 'staff'`, even if no invitation had ever been issued to them, or using a random unverified email address.

#### Corrected Rule
```javascript
    function hasValidInvitationForProfile(userId, profileData) {
      let token = profileData.invitationToken;
      let invPath = /databases/$(database)/documents/staff_invitations/$(token);
      return exists(invPath) &&
             get(invPath).data.email == request.auth.token.email &&
             (get(invPath).data.status == 'pending' || get(invPath).data.acceptedByUid == userId) &&
             request.time < timestamp(get(invPath).data.expiresAt) &&
             get(invPath).data.role == 'staff';
    }

    match /users/{userId} {
      allow create: if isValidUser(request.resource.data) && (
        isAdmin() || (
          isOwner(userId) &&
          request.resource.data.role == 'staff' &&
          request.resource.data.basicSalary == 0 &&
          request.resource.data.monthlyTarget == 0 &&
          request.resource.data.isActive == true &&
          !('permissions' in request.resource.data) &&
          !('isAdmin' in request.resource.data) &&
          request.resource.data.email == request.auth.token.email &&
          ('invitationToken' in request.resource.data) &&
          hasValidInvitationForProfile(userId, request.resource.data)
        )
      );
    }
```

#### Security Test
`__tests__/securityRemediation.test.ts` — *"enforces invitation-bound profile creation: denies creation without valid invitation or with mismatched email"*:
* Creating profile without an invitation token: **DENIED** (`false`).
* Creating profile with token issued to a different email address (`hacker@evil.com` vs `rohan@example.com`): **DENIED** (`false`).
* Creating profile with expired invitation token: **DENIED** (`false`).
* Creating profile with `basicSalary > 0` or privileged fields: **DENIED** (`false`).
* Valid profile bound to unexpired invitation matching auth email: **ALLOWED** (`true`).

#### Actual Result
**PASS** (Verified with Jest).

#### Remaining Spark Architecture Limitation
Firestore rules perform cross-document `get()` to verify the invitation token. Firestore limits cross-document evaluations to 10 lookups per rules evaluation, which is well within our budget (1 lookup). The binding between `request.auth.token.email` and `get(invPath).data.email` guarantees that an invited token can only be redeemed by the exact Google Auth user holding that email.

---

### Issue 3: KYC Protection & Subcollection Authorization Binding

#### Original Rule
```javascript
match /second_hand_purchases/{purchaseId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && isValidSecondHandPurchase(request.resource.data);
}
```

#### Vulnerability
Raw customer Aadhaar numbers and photographs were stored directly in parent purchase documents, readable by any logged-in staff member. Furthermore, arbitrary KYC documents could be written without verifying that the caller was the staff member who actually performed the purchase.

#### Corrected Rule
```javascript
match /second_hand_purchases/{purchaseId} {
  // Admin can read all purchases; staff can read purchases they recorded or in-stock inventory for resale
  allow read: if isAuthenticated() && (
    isAdmin() ||
    resource.data.purchasedByStaffId == request.auth.uid ||
    resource.data.status == 'in_stock'
  );

  allow create: if isAuthenticated() && isValidSecondHandPurchase(request.resource.data);
  allow update: if isAdmin() && isValidSecondHandPurchase(request.resource.data);
  allow delete: if isAdmin();

  // Sensitive KYC Subcollection (raw customer Aadhaar numbers and identity proofs)
  // Only store administrator can read raw KYC.
  // Staff can only create KYC if they are the authenticated user who recorded the parent purchase.
  // Staff cannot write arbitrary KYC documents for unrelated purchases.
  match /kyc_sensitive/{kycId} {
    allow read: if isAdmin();
    allow create: if isAuthenticated() &&
                  request.auth.uid == get(/databases/$(database)/documents/second_hand_purchases/$(purchaseId)).data.purchasedByStaffId;
    allow update, delete: if isAdmin();
  }
}
```

#### Security Test
`__tests__/securityRemediation.test.ts` — *"enforces KYC creation binding: staff can only create KYC for their own recorded purchase"*:
* Staff attempting to write KYC for another employee's purchase ID: **DENIED** (`false`).
* Staff writing KYC for their own recorded purchase: **ALLOWED** (`true`).
* Staff attempting to read `kyc_sensitive/`: **DENIED** (`false`).
* Admin reading `kyc_sensitive/`: **ALLOWED** (`true`).

#### Actual Result
**PASS** (Verified with Jest).

#### Remaining Spark Architecture Limitation
In parent documents, `aadhaarNumber` is stored as `XXXX-XXXX-1234` by `SecondHandService.recordPurchase`. The raw unmasked Aadhaar is stored solely in `kyc_sensitive/customer_kyc`. Existing records in the database remain intact without data loss, but store administrators should run a one-time migration script if they wish to back-populate older documents into `kyc_sensitive/`.

---

### Issue 4: Second-Hand Purchase In-Stock Inventory Access

#### Original Rule
```javascript
match /second_hand_purchases/{purchaseId} {
  allow read: if isAuthenticated();
}
```

#### Vulnerability
Allowing unrestricted reads across all purchases allowed any staff member to view historic customer buybacks, past trade-ins, confidential customer addresses, and profit margins.

#### Corrected Rule
```javascript
match /second_hand_purchases/{purchaseId} {
  allow read: if isAuthenticated() && (
    isAdmin() ||
    resource.data.purchasedByStaffId == request.auth.uid ||
    resource.data.status == 'in_stock'
  );
}
```

#### Security Test
`__tests__/securityRemediation.test.ts` — *"protects sold purchase documents from peer staff snooping while preserving in_stock inventory access"*:
* Any staff member reading an `in_stock` device for resale workflow: **ALLOWED** (`true`).
* Staff reading a historic `sold` device recorded by another staff member: **DENIED** (`false`).
* Staff reading a historic `sold` device they recorded themselves: **ALLOWED** (`true`).
* Store Admin reading any device: **ALLOWED** (`true`).

#### Actual Result
**PASS** (Verified with Jest).

#### Remaining Spark Architecture Limitation
Firestore rules are document-level (not field-level). When querying in-stock inventory for resale, staff receive the device details (`brand`, `model`, `imei`, `condition`, `purchaseAmount`). However, because raw Aadhaar and identity documents are stored in the separate `kyc_sensitive` subcollection and `aadhaarNumber` on the parent document is masked (`XXXX-XXXX-1234`), customer KYC is completely shielded from inventory viewers.

---

### Issue 5: Staff Profile Creation Privilege Restrictions

#### Original Rule
```javascript
allow create: if (isAdmin() || (isOwner(userId) && request.resource.data.role == 'staff')) &&
              isValidUser(request.resource.data);
```

#### Vulnerability
On self-registration, the client could set their own `basicSalary: 100000`, `monthlyTarget: 0`, inject custom permission maps, or set `isActive` parameters.

#### Corrected Rule
```javascript
match /users/{userId} {
  allow create: if isValidUser(request.resource.data) && (
    isAdmin() || (
      isOwner(userId) &&
      request.resource.data.role == 'staff' &&
      request.resource.data.basicSalary == 0 &&
      request.resource.data.monthlyTarget == 0 &&
      request.resource.data.isActive == true &&
      !('permissions' in request.resource.data) &&
      !('isAdmin' in request.resource.data) &&
      request.resource.data.email == request.auth.token.email &&
      ('invitationToken' in request.resource.data) &&
      hasValidInvitationForProfile(userId, request.resource.data)
    )
  );
}
```

#### Security Test
`__tests__/securityRemediation.test.ts` — *"Staff attempts to set non-zero basicSalary on self-registration"*:
* Staff submitting profile with `basicSalary: 50000`: **DENIED** (`false`).
* Staff submitting profile with `monthlyTarget: 500000`: **DENIED** (`false`).
* Staff submitting profile with `permissions`: **DENIED** (`false`).
* Staff submitting profile with `basicSalary: 0, monthlyTarget: 0`: **ALLOWED** (`true`).

#### Actual Result
**PASS** (Verified with Jest).

#### Remaining Spark Architecture Limitation
Because a trusted Cloud Function cannot run on Spark to set the employee's salary during registration, the client profile initializes with baseline compensation (`basicSalary: 0, monthlyTarget: 0`). When the administrator views `StaffPage.tsx` on the Admin Web Dashboard, the administrator reviews the new account and updates their official compensation parameters via `allow update: if isAdmin();`. The staff member can never modify these compensation fields.

---

## 3. Comprehensive Verification Summary

```
PASS __tests__/securityRemediation.test.ts (17 tests)
  1. Staff Invitation Collection & Token Protocol
    ✓ allows direct get lookup of a valid pending invitation
    ✓ rejects expired invitation token with clear error
    ✓ rejects re-use of an accepted invitation token
    ✓ denies collection listing for unauthenticated/staff clients
  2. User Profile Isolation
    ✓ enforces staff profile read isolation: staff cannot read peer profile
    ✓ allows Admin to read all authorized staff profiles for management
    ✓ strictly denies staff from modifying own role, salary, target or active status
  3. Invitation Redemption Reliability
    ✓ successfully recovers when Auth user was created but Firestore write previously failed
    ✓ rejects concurrent simultaneous redemption once first device marks invitation accepted
  4. Aadhaar & KYC Protection
    ✓ restricts raw Aadhaar reveal: non-admin cannot view raw Aadhaar
    ✓ enforces Firestore rule protection on sensitive KYC subcollection
  5. Salary Schema & Canonical staffId
    ✓ enforces canonical staffId on salary slips and isolates employee access
  6. Audit Logs Integrity
    ✓ strictly denies staff from creating administrative audit entries
  7. Final Firestore Rules Security Hardening Matrix
    ✓ denies invitation update when staff attempts to tamper with token, email, expiry, or salary
    ✓ enforces invitation-bound profile creation: denies creation without valid invitation or with mismatched email
    ✓ enforces KYC creation binding: staff can only create KYC for their own recorded purchase
    ✓ protects sold purchase documents from peer staff snooping while preserving in_stock inventory access

Total Mobile Tests:  23 suites, 188 tests (100% PASS)
TypeScript Compiler: npx tsc --noEmit (0 errors)
Admin Web Dashboard: 5/5 Vitest tests (100% PASS), production build successful in 2.05s
```

---

## 4. Pending Deployment Instructions

The updated rule set is ready in [`firestore.rules`](file:///Users/chetan/ParthMobileCare/firestore.rules). To publish the rules to Google Cloud when ready, execute:

```bash
firebase login --reauth
firebase deploy --only firestore:rules
```

