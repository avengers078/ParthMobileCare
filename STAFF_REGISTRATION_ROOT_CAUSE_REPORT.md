# PARTH MOBILE CARE — STAFF REGISTRATION ROOT CAUSE AUDIT REPORT

**Date:** November 3, 2026  
**Status:** ROOT CAUSE IDENTIFIED & RESOLVED  
**Platform:** React Native (Android / iOS) • Firebase Spark Plan Compliant  

---

## Executive Summary

During testing of the Direct Staff Registration and Face Enrollment workflow, two critical operational failures occurred:

1. **Missing Profile Alert / Crash**:
   Upon completing Step 1 of registration and advancing to email verification (or when returning from Gmail after verification), the mobile application presented an alert:
   > *"Sign In Failed: Your Firebase account is signed in, but its staff profile is missing. Ask an administrator to create users/0pvoT5eSdLSUeu7tZEh5WMYJLQB3 in Firestore."*
   The application trapped the user on an "Authentication Check" screen, wiping in-memory registration data and blocking the applicant from completing face enrollment.

2. **Broken Email Verification Resume Loop**:
   Staff received the verification email and clicked the verification link in the browser, but reopening the mobile application failed to resume registration, returning to the missing-profile error screen instead of advancing to Face Enrollment.

This report documents the architectural root causes of these failures based on source code analysis, log traces, and Firebase SDK behavior.

---

## 1. Problem 1: Root Cause of "Missing Staff Profile" Alert

### A. Premature Auth Listener Activation & Uncoordinated Lifecycle
- In `src/screens/RegisterScreen.tsx`, Step 1 (`handleProceedToEmailVerification`) executed:
  ```typescript
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  ```
- Firebase Authentication automatically signs in any newly created user on the local client upon completion of `createUserWithEmailAndPassword`.
- In `src/context/AuthContext.tsx`, an active global listener was subscribed to Firebase Auth state changes:
  ```typescript
  onAuthStateChanged(auth, async (authUser) => {
    ...
    await acceptAuthUser(authUser);
  });
  ```
- Inside `acceptAuthUser`:
  ```typescript
  const profileRef = doc(FirebaseService.getFirestore(), 'users', authUser.uid);
  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) {
    throw new Error('Your Firebase account is signed in, but its staff profile is missing. Ask an administrator to create users/' + authUser.uid + ' in Firestore.');
  }
  ```
- **The Core Flaw**: The document `users/{uid}` in Firestore was scheduled to be written in **Step 3 / Step 4 (after biometric face enrollment)**. Because the user was only in Step 1 (or awaiting Step 2 email verification), the Firestore document did not yet exist!
- As a consequence:
  1. `getDoc` returned `exists: false`.
  2. `acceptAuthUser` threw the missing-profile error.
  3. The error handler invoked `await signOut(...)`, set `authError`, and `RootNavigator.tsx` immediately replaced the entire view tree with the `Authentication Check` screen.
  4. The in-memory state of `RegisterScreen` was unmounted and completely destroyed.

### B. Firestore Security Rules Requirement Conflict
- In `firestore.rules`, lines 657–674 enforce:
  ```firestore
  match /users/{userId} {
    allow create: if
      ...
      isAuthenticated() &&
      isOwner(userId) &&
      request.auth.token.email_verified == true &&
      ...
  ```
- Firestore Security Rules strictly forbid creating a profile document before `email_verified == true`.
- Therefore, the client *cannot* pre-create the Firestore profile in Step 1 before email verification. The application architecture was mistakenly treating the absence of `users/{uid}` during registration as a system error rather than recognizing it as an **in-progress registration**.

---

## 2. Problem 2: Email Verification Flow & State Loss

### A. Lack of Non-Sensitive Progress Persistence
- In `RegisterScreen.tsx`, all registration progress (`step`, `name`, `phone`, `designation`, `email`) was stored strictly inside React `useState`.
- When an applicant minimized the mobile app to open Gmail (`media_1793721279194_f1c39023.jpg`) and tapped the confirmation link (`media_1793721289357_a388ab13.png`), Android's operating system memory manager frequently killed or recycled the background app process.
- Upon reopening the app, the in-memory state was gone. Firebase Auth restored the session for `authUser`, but with no persistent draft in `AsyncStorage`, `AuthContext` treated the returning user as an existing staff member trying to log in with an orphaned account, immediately throwing the missing profile error.

### B. Inability to Auto-Detect Verification Without User Action
- The application previously had no `AppState` listener. When the user confirmed their email in the browser and switched back to the Parth Mobile Care app, the application remained passive until a button was tapped, failing to query `authUser.reload()` automatically on app foregrounding.

---

## 3. Problem 3: Re-Registration & Sign-In Deadlock

When the user encountered the missing profile alert:
1. Trying to sign in via the Login Screen triggered `signInWithEmailAndPassword`, which succeeded in Auth, but immediately hit `getProfileForAuthUser`, throwing the exact same alert (`media_1793721262167_b479c17a.png`).
2. Trying to re-register via "Create Staff Account" failed with `auth/email-already-in-use` because the Firebase Auth user was already registered in Step 1.
3. The user was permanently locked in a broken state without manual intervention in Firebase Console.

---

## 4. Architectural Remediation Summary

| Component | Defect | Implemented Solution |
| :--- | :--- | :--- |
| [`src/types/index.ts`](file:///Users/chetan/ParthMobileCare/src/types/index.ts) | Missing explicit registration progress and multi-state auth models | Added `AuthStatus` union and `StaffRegistrationDraft` schema. |
| [`src/services/storageService.ts`](file:///Users/chetan/ParthMobileCare/src/services/storageService.ts) | No local persistence for registration progress | Implemented non-sensitive draft persistence (`@pmc_registration_draft`). Never stores passwords. |
| [`src/context/AuthContext.tsx`](file:///Users/chetan/ParthMobileCare/src/context/AuthContext.tsx) | Threw error when `users/{uid}` absent, destroying registration | Distinguishes active registration drafts from orphaned logins. Transitions to `authenticated_unverified` or `face_enrollment_pending` instead of throwing. |
| [`src/screens/RegisterScreen.tsx`](file:///Users/chetan/ParthMobileCare/src/screens/RegisterScreen.tsx) | Ephemeral state; no foreground detection; no graceful retry | Restores drafts; listens to `AppState` to auto-detect email verification; gracefully resumes existing account if email already in use. |
| [`src/navigation/RootNavigator.tsx`](file:///Users/chetan/ParthMobileCare/src/navigation/RootNavigator.tsx) | Replaced registration with error screen on auth events | Routes directly to `RegisterScreen` for in-progress registrations without flickering. |

