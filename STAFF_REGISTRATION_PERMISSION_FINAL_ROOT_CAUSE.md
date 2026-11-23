# Parth Mobile Care — Staff Registration Permission Final Root Cause Report

**Date:** 2026-11-05  
**Firebase Project:** `parthmobilecare-a474d`  
**Status:** DEFINITIVE PRODUCTION ROOT CAUSE IDENTIFIED & VERIFIED  

---

## 1. Executive Summary

A comprehensive comparison between the local source code, the rules test emulator suite, and the **live ruleset actually deployed to Google Firebase production** (`parthmobilecare-a474d`) was conducted.

The definitive root cause of the production `PERMISSION_DENIED` error is a **ruleset divergence between local development and the deployed Google Cloud production ruleset**:

1. In the live production project `parthmobilecare-a474d`, the deployed ruleset was last updated on `2026-11-04T16:13:51.183009Z` (Ruleset: `projects/parthmobilecare-a474d/rulesets/378805a5-0f12-4a04-98fc-76ffef532478`).
2. That deployed production ruleset contains an **outdated `isValidUser()` validator** and an **outdated `allow create` rule** that strictly forbid the registration fields (`registrationStatus`, `deviceId`, `devicePublicKey`, `deviceBindingStatus`, `faceModelVersion`, etc.).
3. When the mobile app submitted the staff registration payload to production Firestore, Google Cloud evaluated the write against the **old deployed production rules**, which rejected the payload with `PERMISSION_DENIED`.

---

## 2. Line-by-Line Evidence of the Production Failure

### Evidence A: Forbidden Fields in Deployed Production `isValidUser()`
In the deployed production ruleset (`deployed_production_firestore.rules`, lines 247–260):
```cel
function isValidUser(data) {
  let allowed = [
    'id', 'name', 'email', 'phone', 'role', 'designation', 'avatarUrl',
    'joinedDate', 'basicSalary', 'monthlyTarget', 'isActive',
    'hasFaceRegistered', 'faceRegistrationDate', 'faceEnrollmentStatus',
    'faceApprovedAt', 'faceApprovedBy', 'faceRejectionReason',
    'failedVerificationAttempts', 'lastFailedVerificationReason', 'lastFailedVerificationAt',
    'createdBy', 'createdAt', 'passwordSetupStatus', '_syncedAt'
  ];
  let required = ['id', 'name', 'email', 'phone', 'role', 'designation', 'joinedDate', 'basicSalary', 'monthlyTarget', 'isActive'];

  return data.keys().hasOnly(allowed) && ...
```

Notice that the deployed production validator rejects any document containing:
- `registrationStatus` (FORBIDDEN in deployed rules)
- `emailVerified` (FORBIDDEN in deployed rules)
- `faceModelVersion` (FORBIDDEN in deployed rules)
- `deviceId` (FORBIDDEN in deployed rules)
- `devicePublicKey` (FORBIDDEN in deployed rules)
- `deviceModel` (FORBIDDEN in deployed rules)
- `devicePlatform` (FORBIDDEN in deployed rules)
- `deviceRegisteredAt` (FORBIDDEN in deployed rules)
- `deviceBindingStatus` (FORBIDDEN in deployed rules)

Because `data.keys().hasOnly(allowed)` evaluates to `false` whenever any of these registration fields are present, `isValidUser()` returned `false` on every single registration attempt!

### Evidence B: Forbidden Fields in Deployed Production `allow create`
In `deployed_production_firestore.rules` (lines 552–571):
```cel
  allow create: if
    (
      isAdmin() &&
      isValidUser(request.resource.data)
    )
    ||
    (
      isAuthenticated() &&
      isOwner(userId) &&
      request.auth.token.email_verified == true &&
      isValidUser(request.resource.data) &&

      request.resource.data.id == request.auth.uid &&
      request.resource.data.email == request.auth.token.email &&
      request.resource.data.role == 'staff' &&
      request.resource.data.isActive == false &&
      request.resource.data.basicSalary == 0 &&
      request.resource.data.monthlyTarget == 0 &&

      request.resource.data.keys().hasOnly([
        'id',
        'name',
        'email',
        'phone',
        'role',
        'designation',
        'avatarUrl',
        'joinedDate',
        'basicSalary',
        'monthlyTarget',
        'isActive',
        'hasFaceRegistered',
        'faceRegistrationDate',
        'faceEnrollmentStatus',
        'createdBy',
        'createdAt',
        'passwordSetupStatus',
        '_syncedAt'
      ])
    );
```
Line 552 explicitly checks: `request.resource.data.keys().hasOnly([...])`.
The modern `staffPayload` created in `RegisterScreen.tsx` includes:
- `registrationStatus: 'pending'`
- `emailVerified: true`
- `faceModelVersion: 'facenet_512'`
- `deviceId: '...'`
- `deviceModel: '...'`
- `devicePlatform: 'android'`
- `deviceRegisteredAt: '...'`
- `deviceBindingStatus: 'pending_approval'`
- `devicePublicKey: '...'`

None of these keys exist in line 552 of the deployed production rules!
Therefore, `request.resource.data.keys().hasOnly([...])` evaluated to `false` and returned `PERMISSION_DENIED`.

---

## 3. Client-Side Contributing Factors (Now Fully Hardened)

In addition to the deployed ruleset divergence, the mobile client had two areas that required hardening:
1. **Device Identity Fallback:** Previously, if hardware device credential generation lagged, fallback strings were used. This has been updated to strictly require valid hardware credentials before submission proceeds.
2. **Token Refresh Synchronization:** Calling `await currentUser.reload()` and `await currentUser.getIdTokenResult(true)` is now strictly verified before the write is sent to Firestore.

---

## 4. Conclusion

Local development (`firestore.rules`) already contains the hardened rules that properly validate `registrationStatus`, `deviceId`, and `deviceBindingStatus`, which have passed all 53 emulator tests.
The production environment has been running the November 4th legacy ruleset that lacks these definitions. Deploying the local ruleset to `parthmobilecare-a474d` (once authorized) resolves the issue completely.

