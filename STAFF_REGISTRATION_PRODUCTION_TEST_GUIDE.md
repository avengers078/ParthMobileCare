# Parth Mobile Care — Staff Registration Production Test Guide

**Target Firebase Project:** `parthmobilecare-a474d`  
**Application:** Android Staff Mobile Application (`app-debug.apk`)  
**Cleared Test Emails Available for Testing:**
1. `chetanluhar65@gmail.com`
2. `chetanluharchetanluhar@gmail.com`
3. `iamtonystark879@gmail.com`
4. `chetan.skillupahmedabad@gmail.com`

---

## 1. Prerequisites (Deployment Step)

Before running the production registration test on a real phone or emulator:
1. Ensure the updated rules are deployed to Firebase production:
   ```bash
   firebase deploy --only firestore:rules --project parthmobilecare-a474d
   ```
2. Verify the Android build has completed and install the freshly built APK:
   ```bash
   adb install -r android/app/build/outputs/apk/debug/app-debug.apk
   ```

---

## 2. Step-by-Step Test Procedure

### Step 1: Account Creation & Details Form
1. Launch the Parth Mobile Care app on your Android device or emulator.
2. Tap **Create Staff Account** on the Sign In screen.
3. Fill in the registration form:
   - **Full Name:** e.g., `Chetan Luhar`
   - **Email:** One of the four cleared emails (e.g., `chetanluhar65@gmail.com`)
   - **Mobile Number:** Valid 10-digit phone number (e.g., `9876543210`)
   - **Designation:** e.g., `Sales Executive`
   - **Password & Confirm Password:** Min 6 characters (e.g., `Password@123`)
4. Tap **Continue to Email Verification**.
   - *Expected:* Account is initialized in Firebase Auth, and an email verification message is displayed.

### Step 2: Email Verification
1. Open Gmail or the email inbox for the chosen address.
2. Click the verification link sent by Firebase.
3. Return to the app and tap **I have verified my email**.
   - *Expected:* App reloads user state, refreshes the ID token, detects `emailVerified == true`, and navigates to Step 3 (Face Biometrics).

### Step 3: Face Biometrics Enrollment
1. Agree to the biometric consent checkbox.
2. Position your face in front of the front camera.
3. Capture sample 1, sample 2, and sample 3.
   - *Expected:* Status shows `Captured: 3 of 3 samples`.
4. Tap **Submit Registration**.
   - *Expected:* Success message appears: `"Your staff account has been submitted for Administrator review. Redirecting to status portal..."`
   - The app navigates to the Registration Status screen.

---

## 3. Production Verification & Evidence Checks

### Check A: Firestore Document Creation
Verify via command line or Firebase Console that `users/{uid}` has been created:
- `registrationStatus` == `"pending"`
- `isActive` == `false`
- `role` == `"staff"`
- `basicSalary` == `0`
- `monthlyTarget` == `0`
- `emailVerified` == `true`
- `hasFaceRegistered` == `false`
- `faceEnrollmentStatus` == `"pending_review"`
- `deviceBindingStatus` == `"pending_approval"`
- `deviceId` is non-empty
- `devicePublicKey` is non-empty

### Check B: Admin Web Dashboard Verification
1. Open the Admin Web Dashboard (`http://localhost:5173` or deployed URL).
2. Sign in as Admin (`NmX4ySVJ6NPHytFA6XLnY9GYoCg1`).
3. Navigate to **Staff Management**.
4. Confirm the newly registered staff member appears under **Pending Approvals**.
5. Do NOT approve yet.

### Check C: Access Denial Verification
1. In the mobile app, attempt to navigate to the Staff Home dashboard or perform attendance punches.
2. Confirm that access to Staff Home is blocked and the user remains on the pending status screen.

