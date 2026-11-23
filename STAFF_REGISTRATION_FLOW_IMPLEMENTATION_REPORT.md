# PARTH MOBILE CARE — STAFF REGISTRATION FLOW IMPLEMENTATION REPORT

**Date:** November 3, 2026  
**Status:** FULLY IMPLEMENTED & ARCHITECTURALLY VERIFIED  
**Platform:** React Native (Android / iOS) • Firebase Spark Plan Compliant  

---

## Executive Summary

The Staff Direct Registration, Email Verification, Biometric Face Enrollment, and Registration Submission workflow in Parth Mobile Care has been re-architected. The implementation eliminates the premature profile fetch bug, guarantees state persistence across background app transitions and restarts, provides automated foreground verification detection, and ensures strict Firestore Security Rules compliance without requiring Firebase Blaze or Cloud Functions.

---

## 1. Complete Revised Registration Lifecycle

The registration workflow is governed by an explicit 4-step state machine:

```
[ Step 1: Personal Details ]
      │  (Validate Name, Email, Phone, Designation, Password)
      │  (createUserWithEmailAndPassword + sendEmailVerification)
      │  (Persist non-sensitive draft to AsyncStorage)
      ▼
[ Step 2: Email Verification ]
      │  (Background/Foreground AppState listener detects verification via auth.reload())
      │  (Manual "I Have Verified My Email" / "Resend Email" buttons available)
      │  (Once auth.currentUser.emailVerified == true, mint token with getIdToken(true))
      ▼
[ Step 3: Biometric Face Enrollment ]
      │  (Request camera permission)
      │  (Capture 3 consecutive live face samples via OnDeviceFaceAuthView)
      │  (Execute anti-spoofing liveness & cross-account duplicate checks)
      │  (Enroll on-device local template via safeEnrollLocal)
      ▼
[ Step 4: Submission & Admin Review ]
      │  (Query hardware-backed device keys via DeviceSecurityService)
      │  (Write single users/{uid} document in Firestore with registrationStatus: 'pending')
      │  (Clear local draft from AsyncStorage)
      ▼
[ Pending Review Screen (RegistrationStatusScreen) ]
      │  (Real-time onSnapshot listener monitors Firestore user document)
      │  (Admin approves ➔ updates isActive: true, registrationStatus: 'approved')
      ▼
[ Staff Home (MainTabs) ]
```

---

## 2. Non-Sensitive State Persistence Architecture

To ensure registration progress survives app minimization (e.g., when the user opens Gmail to verify their email) or OS-level process termination, non-sensitive state is persisted in `AsyncStorage`:

### `StaffRegistrationDraft` Schema
```typescript
export interface StaffRegistrationDraft {
  uid: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  step: 'details' | 'verify_email' | 'face_enrollment' | 'submitting';
  emailVerified: boolean;
  sampleCount?: number;
  registeredAt: string;
}
```

> **Security Guarantee**:
> In strict compliance with Parth Mobile Care security principles, **passwords are never saved** in `AsyncStorage`, Firestore, logs, or error dumps. Only minimum non-sensitive contact details and step pointers are retained.

### Storage Service Helpers in [`src/services/storageService.ts`](file:///Users/chetan/ParthMobileCare/src/services/storageService.ts):
- `getStaffRegistrationDraft(): Promise<StaffRegistrationDraft | null>`
- `saveStaffRegistrationDraft(draft: StaffRegistrationDraft): Promise<void>`
- `clearStaffRegistrationDraft(): Promise<void>`

---

## 3. Email Verification Flow Enhancements

### A. Foreground Detection via `AppState`
When the applicant opens the email verification link in their mobile browser and switches back to the application, the `AppState` listener triggers an automatic check:
```typescript
useEffect(() => {
  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (nextAppState === 'active' && step === 'verify_email') {
      try {
        const res = await checkEmailVerification();
        if (res.verified) {
          await saveRegistrationProgress({ step: 'face_enrollment', emailVerified: true });
          setStep('face_enrollment');
          showSuccess('Email Verified!', 'Your email confirmation was detected. Please complete face enrollment.');
        }
      } catch (_) {}
    }
  };

  const sub = AppState.addEventListener('change', handleAppStateChange);
  return () => sub.remove();
}, [step]);
```

### B. Reliable Token & Reload Protocol
1. Calls `await auth.currentUser.reload()` to retrieve latest server-side verification status from Firebase Auth.
2. Calls `await freshUser.getIdToken(true)` to force-refresh the Firebase ID token and ensure the cryptographically signed `email_verified: true` claim is updated for Firestore rules evaluation.
3. Provides manual fallback buttons:
   - **"I Have Verified My Email"**: Runs `handleCheckEmailVerified()`.
   - **"Resend Verification Link"**: Re-dispatches `sendEmailVerification()`.

### C. Graceful Handling of `auth/email-already-in-use`
If an applicant initiated registration previously and returns after the app process was recycled:
- The app attempts credential verification with `signInWithEmailAndPassword`.
- If credentials match, the existing session is retrieved, the email verification state is reloaded, and the applicant advances directly to the pending step (Step 2 or Step 3) without duplicate account creation errors.

---

## 4. Biometric Face Enrollment Integration

- **Model**: MobileNetV2 FaceNet (512-dimensional embedding space, on-device TFLite).
- **Quality & Samples**: Captures 3 distinct embedding samples with face landmark quality checks.
- **Liveness Verification**: Built-in micro-motion and challenge validation ensures physical presence.
- **Cross-Account Collision**: Invokes `safeCheckDuplicate(embedding)` before enrollment. If the template matches another enrolled employee, registration is blocked immediately.
- **Biometric Security**: Raw face photographs are discarded immediately after embedding generation; only the mathematical template is saved on-device.

---

## 5. Document Structure & Firestore Security Rules

When registration is finalized in Step 4, a single document is created at `users/{userId}` in Firestore:

```typescript
const staffPayload = {
  id: user.uid,
  name: name.trim(),
  email: cleanEmail,
  phone: phone.trim(),
  role: 'staff',
  designation: designation.trim(),
  joinedDate: nowIso.split('T')[0],
  basicSalary: 0,
  monthlyTarget: 0,
  isActive: false,
  registrationStatus: 'pending',
  emailVerified: true,
  faceEnrollmentStatus: 'pending_review',
  faceModelVersion: 'facenet_512',
  hasFaceRegistered: false,
  faceRegistrationDate: nowIso,
  deviceId: deviceInfo.installationId || '',
  deviceModel: deviceInfo.model || 'Mobile Device',
  devicePlatform: Platform.OS,
  deviceRegisteredAt: nowIso,
  deviceBindingStatus: 'pending_approval',
  devicePublicKey: deviceInfo.publicKey || '',
  createdAt: nowIso,
  createdBy: user.uid,
  _syncedAt: nowIso,
};
```

### Compliance with `firestore.rules` (Lines 650–702):
- `isOwner(userId)`: Satisfied (`user.uid == userId`).
- `request.auth.token.email_verified == true`: Satisfied (enforced in Step 2).
- `role == 'staff'`: Satisfied (client cannot choose admin/manager).
- `isActive == false`: Satisfied (inactive until Admin decision).
- `basicSalary == 0 && monthlyTarget == 0`: Satisfied.
- `registrationStatus == 'pending'`: Satisfied.
- `keys().hasOnly([...])`: Strict match against all 25 allowed fields.

