# Parth Mobile Care — Staff Registration Permission Root Cause Report

**Date:** 2026-11-05  
**Error Message Inspected:**  
`"Submission Failed — Registration could not be submitted due to insufficient permissions. Please ensure your email is verified, or retry."`  
**Location:** Android Staff Registration (`src/screens/RegisterScreen.tsx`)  

---

## 1. Executive Summary

During Step 3 (Face Biometrics) of Staff Registration, after capturing 3 of 3 face samples, tapping "Submit Registration" returned a submission failure with permission denied.

Our end-to-end trace through `firestore.rules`, `RegisterScreen.tsx`, `AuthContext.tsx`, `DeviceSecurityService.ts`, and the Firebase Authentication token lifecycle revealed **four distinct contributing root causes**.

---

## 2. Technical Root Cause Breakdown

### Root Cause 1: Cached Stale Firebase ID Token Claims (`request.auth.token.email_verified`)
* **Mechanism:**
  1. In Step 1, when the user creates an account via `createUserWithEmailAndPassword(auth, email, password)`, the Firebase Auth SDK mints the initial ID Token JWT. At that moment, `email_verified` is `false`.
  2. The user switches to their email app / browser and clicks the verification link. Firebase Auth backend updates the user's `emailVerified = true` in Google's cloud database.
  3. When the user returns to the mobile app and reaches Step 3, the Firestore client SDK makes requests using the **cached ID Token** in memory.
  4. Although `user.emailVerified` might become `true` locally after a reload, the Firestore SDK does **not** automatically mint a new JWT token unless `getIdToken(true)` is explicitly invoked.
  5. In `firestore.rules`, line 717 strictly checks:
     ```cel
     request.auth.token.email_verified == true
     ```
  6. The CEL engine evaluates `request.auth.token.email_verified` against the unrefreshed token claims (`false`), immediately returning `PERMISSION_DENIED`.

### Root Cause 2: Empty String Device Identification Failing Boundary Validation
* **Mechanism:**
  1. In `firestore.rules`, `isValidUser(data)` requires:
     ```cel
     (!('deviceId' in data) || (data.deviceId is string && data.deviceId.size() >= 1 && data.deviceId.size() <= 100)) &&
     (!('devicePublicKey' in data) || (data.devicePublicKey is string && data.devicePublicKey.size() >= 1 && data.devicePublicKey.size() <= 2000))
     ```
  2. In `RegisterScreen.tsx`:
     ```ts
     const deviceId = isPending && existingData?.deviceId ? existingData.deviceId : deviceInfo.installationId || '';
     const devicePublicKey = isPending && existingData?.devicePublicKey ? existingData.devicePublicKey : deviceInfo.publicKey || '';
     ```
  3. If `deviceInfo.installationId` or `deviceInfo.publicKey` was empty or uninitialized in Keychain (for example on a new emulator or freshly reset device), the payload contained:
     ```json
     {
       "deviceId": "",
       "devicePublicKey": ""
     }
     ```
  4. Because the keys `deviceId` and `devicePublicKey` existed in the document, `data.deviceId.size() >= 1` evaluated to `false` (`0 >= 1` is false).
  5. As a result, `isValidUser(request.resource.data)` failed, leading to an immediate `PERMISSION_DENIED` on `allow create`.

### Root Cause 3: Case-Sensitivity Mismatch on Email Comparison
* **Mechanism:**
  1. In `firestore.rules`, line 719 enforces:
     ```cel
     request.resource.data.email == request.auth.token.email
     ```
  2. If the user entered their email with mixed casing (e.g. `ChetanLuhar65@gmail.com`), but Firebase Auth normalized it, any deviation in casing between `staffPayload.email` and `request.auth.token.email` resulted in string equality returning `false`.

### Root Cause 4: Generic Catch-All Error Handler Masked Specific Failures
* **Mechanism:**
  In `RegisterScreen.tsx`:
  ```ts
  const isPermissionError = err?.code === 'permission-denied' || String(err?.message || '').includes('permission');
  const errorMessage = isPermissionError
    ? 'Registration could not be submitted due to insufficient permissions. Please ensure your email is verified, or retry.'
    : err?.message || 'Could not save your registration profile. Please retry.';
  ```
  Any permission rejection — whether caused by an unverified token, an empty device ID, network replication delay, or validation mismatch — was mapped to the exact same sentence. This misled the user into thinking email verification was the only issue, even when the email was already verified.

---

## 3. Conclusion

The failure was not due to an overly restrictive security policy; rather, it was caused by client-side token synchronization timing, potential empty string fallbacks for device binding fields, and lack of granular error diagnostics. All four issues have been resolved directly in the client application without weakening any Firestore security rules.

