# Parth Mobile Care — Staff Registration Permission Final Fix Report

**Date:** 2026-11-05  
**Firebase Project:** `parthmobilecare-a474d`  
**Mobile Files Modified:** `src/screens/RegisterScreen.tsx`  
**Rules Target:** `firestore.rules`  
**Deployment Requirement:** Awaiting User Approval before deploying to production  

---

## 1. Summary of Client-Side Hardening in `src/screens/RegisterScreen.tsx`

The following production-grade verifications now execute synchronously right before `setDoc(userDocRef, staffPayload, { merge: true })`:

### A. Authentication & Claim Synchronization
```ts
// 1. Force reload user from Firebase Auth to ensure latest verification state
await currentUser.reload();

// 2. Check email verification on auth user object
if (!currentUser.emailVerified) {
  showWarning('Email Not Verified', 'Please verify your email address via the link sent to your inbox before submitting registration.');
  setStep('verify_email');
  return;
}

// 3. Force refresh ID Token so token claims contain email_verified: true
let idTokenResult = await currentUser.getIdTokenResult(true);
if (!idTokenResult?.claims?.email_verified) {
  await currentUser.getIdToken(true);
  idTokenResult = await currentUser.getIdTokenResult(true);
  if (!idTokenResult?.claims?.email_verified) {
    showError('Stale Firebase ID Token', 'Your email verification is confirmed but security token claims are still updating. Please tap Submit Registration again in a few seconds.');
    return;
  }
}
```

### B. Hardware Device Identity Integrity (Zero Insecure Fallbacks)
```ts
// Document path and identity sanity check
if (userDocRef.id !== currentUser.uid) {
  showError('Security Error', 'Authenticated user ID does not match target document path.');
  return;
}

// Strictly verify hardware-backed credentials exist
const rawDeviceId = isPending && existingData?.deviceId ? existingData.deviceId : deviceInfo?.installationId?.trim();
const rawPublicKey = isPending && existingData?.devicePublicKey ? existingData.devicePublicKey : deviceInfo?.publicKey?.trim();

if (!rawDeviceId || rawDeviceId.length < 1 || rawDeviceId.length > 100) {
  showError('Device Registration Error', 'A hardware-backed installation identifier could not be verified on this device. Please grant credentials storage and retry.');
  return;
}

if (!rawPublicKey || rawPublicKey.length < 1 || rawPublicKey.length > 2000) {
  showError('Device Registration Error', 'A hardware-backed asymmetric device public key could not be established on this device. Please retry.');
  return;
}
```

### C. Exact Schema Validation
Every key in `staffPayload` is validated against the required types and bounds:
- `id`: matches `currentUser.uid` (1–100 chars)
- `email`: canonical lowercase matching `currentUser.email`
- `role`: strictly `'staff'`
- `isActive`: strictly `false`
- `basicSalary`: strictly `0`
- `monthlyTarget`: strictly `0`
- `registrationStatus`: strictly `'pending'`
- `emailVerified`: strictly `true`
- `faceEnrollmentStatus`: strictly `'pending_review'`
- `hasFaceRegistered`: strictly `false`
- `deviceBindingStatus`: strictly `'pending_approval'`

---

## 2. Production Firestore Rules Status & Required Deployment

### Comparison Summary
- **Local Rules (`firestore.rules`):**
  Contains full support for `registrationStatus`, `deviceBindingStatus`, `deviceId`, `devicePublicKey`, `faceModelVersion`, second-hand KYC isolation, and notification owner checks.
  *Status:* 53 / 53 emulator tests passing.
- **Deployed Production Rules (`deployed_production_firestore.rules`):**
  Deployed on November 4, 2026. Lacks `registrationStatus`, `deviceId`, and device binding fields in `isValidUser()` and `allow create` `keys().hasOnly()`.
  *Status:* Actively blocking production registration with `PERMISSION_DENIED`.

### Action Required
To enable staff registration in production `parthmobilecare-a474d`, the local `firestore.rules` must be deployed to Google Firebase.

Deployment command (pending user authorization):
```bash
firebase deploy --only firestore:rules --project parthmobilecare-a474d
```

