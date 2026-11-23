# Parth Mobile Care — Face Enrollment Camera & Sample Counter Bug Fix Report

**Report Date:** November 4, 2026  
**Module:** Staff Mobile Application (`com.parthmobilecare`)  
**Feature:** Step 3: Face Biometrics (Direct Staff Registration)  
**Status:** **RESOLVED & VERIFIED ON ANDROID EMULATOR**

---

## 1. Executive Summary

During testing of **Step 3: Face Biometrics** of Staff Registration, three critical bugs were encountered (as captured in the user's screenshots):
1. **Bug 1 (Misaligned Face Guide & Cropped Preview):** The face oval guide was positioned at the very bottom edge of the container, partially covered by the "Look straight at the camera" banner, and the face preview was aggressively cropped vertically (cutting off forehead and chin).
2. **Bug 2 (Sample Counter Exceeding Limit):** The sample counter displayed `"Captured: 8 of 3 samples"`, accumulating far beyond the required 3 samples.
3. **Bug 3 (Black Camera Preview Screen):** After capturing samples, the camera surface turned pitch black, halting biometrics capture.

All three bugs were thoroughly analyzed, root-caused, repaired at the architectural level, verified with unit tests (all 28 suites / 263 tests passing), and confirmed via live Android Emulator testing.

---

## 2. Root Cause Analysis & Architecture Fixes

### Bug 1: Face Does Not Fit Camera Frame & Misaligned Oval Guide

* **Root Causes:**
  1. **Window-Relative vs. Container-Relative Geometry:** `FaceMaskOverlay.tsx` was relying on `useWindowDimensions()` to compute the center of the oval cutout:
     $$\text{cy} = \text{height} \times 0.45$$
     On modern Android screens, `height` is $\approx 915\,\text{px} \implies \text{cy} = 411.75\,\text{px}$. However, inside `RegisterScreen.tsx`, the camera container was constrained with `minHeight: 280`. Placing the center of the oval at $y = 411.75\,\text{px}$ in a $280\,\text{px}$ container pushed the center $131\,\text{px}$ below the container's bottom edge, leaving only the very top rim of the oval visible at the bottom of the card.
  2. **Container Aspect Ratio Mismatch:** The camera stream delivered $720 \times 1280$ portrait video ($9:16$). Cramming this stream into a shallow $280\,\text{px}$ high container with `resizeMode="cover"` cropped over $50\%$ of the vertical frame, zooming in tightly on the nose/glasses and chopping off the user's forehead and chin.
* **Fix Applied:**
  1. **Dynamic Container Measurement (`onLayout`):** Patched `FaceMaskOverlay.tsx` to measure its actual parent container dimensions via `onLayout` (`const { width: w, height: h } = e.nativeEvent.layout`).
  2. **Centered Geometry:** Set $\text{cx} = \text{width} \times 0.5$, $\text{cy} = \text{height} \times 0.44$, with radius constraints:
     $$\text{rx} = \min(\text{round}(\text{width} \times 0.30), 125)$$
     $$\text{ry} = \min(\text{round}(\text{height} \times 0.32), 155)$$
     For a $360 \times 380$ container, the oval top sits at $y = 45.2\,\text{px}$ and bottom sits at $y = 289.2\,\text{px}$, leaving $42.8\,\text{px}$ of clear space above the bottom guidance bar (`hintBar`).
  3. **Natural Portrait Ratio:** Updated `styles.cameraFrame` in `RegisterScreen.tsx` to `height: 380, width: '100%'`, giving the preview container a natural portrait aspect ratio that fits the complete face (forehead, ears, cheeks, chin) comfortably.

---

### Bug 2: Sample Counter Showing "8 of 3 samples"

* **Root Causes:**
  1. **Asynchronous React State Lock:** `handleFaceCaptureResult` previously guarded execution using React state `loading` (`if (loading) return;`). Because React state updates are asynchronous, rapid consecutive frames arriving from VisionCamera worklets (30 FPS) simultaneously entered `handleFaceCaptureResult` before a re-render occurred.
  2. **Unbounded Accumulation:** `samplesRef.current` was updated via `[...samplesRef.current, result.embeddingB64]` without checking `samplesRef.current.length < REQUIRED_SAMPLES`, allowing frames to continue accumulating up to 8 samples while network calls were in progress.
* **Fix Applied:**
  1. **Synchronous Atomic Ref Lock (`isCapturingRef`):** Introduced `isCapturingRef = useRef(false)`. Before executing any asynchronous operation, `isCapturingRef.current = true` is set synchronously, immediately discarding any concurrent frame arrivals.
  2. **Strict Limit Guards:** Added strict guards at the start and before appending:
     ```typescript
     if (isCapturingRef.current || samplesRef.current.length >= REQUIRED_SAMPLES || step !== 'face_enrollment' || !activeUser) {
       return;
     }
     ```
  3. **Strict Math Clamping:** The counter is clamped to `Math.min(samplesRef.current.length, REQUIRED_SAMPLES)`, ensuring the UI counter can never mathematically exceed 3.
  4. **Pacing Cooldown (1200ms):** When a sample is accepted and fewer than 3 samples exist, the system enforces a 1200ms cooldown so the user can observe the progress badge and stabilize before the next sample is captured.

---

### Bug 3: Camera Preview Turns Pitch Black

* **Root Causes:**
  1. **Camera Component Destruction via `key={sessionKey}`:** In `OnDeviceFaceAuthView.tsx`, `<FaceAuthView key={sessionKey} />` passed `sessionKey` as the React `key`. Every time a sample was captured, `sessionKey` incremented, forcing React to completely unmount and destroy the `<FaceAuthView>` and its internal `<Camera>` component.
  2. **Android Camera2 Session Collision:** In `react-native-vision-camera`, stopping an active Camera2 session on Android is asynchronous (200–500ms). When a new `<Camera>` mounts instantly while the previous native session is still closing, Android throws `CameraAccessException.CAMERA_IN_USE` or `CAMERA_DISCONNECTED`, leaving the SurfaceView disconnected and completely pitch black.
* **Fix Applied:**
  1. **Continuous `<Camera>` Lifecycle:** Removed `key={sessionKey}` from `<FaceAuthView>` in `OnDeviceFaceAuthView.tsx`. `<FaceAuthView>` and `<Camera>` remain continuously mounted.
  2. **Prop-Driven Session Reset:** Updated `FaceAuthView` to accept `sessionKey` as a prop:
     ```typescript
     useEffect(() => {
       if (isFirstMountRef.current) {
         isFirstMountRef.current = false;
         return;
       }
       setHint('Position your face in the frame');
       setChallenge(undefined);
       setVerifying(false);
       cancel();
       start();
     }, [sessionKey, cancel, start]);
     ```
     Advancing `sessionKey` resets the auth session and guidance on the running video frame stream without closing or unmounting the camera hardware.
  3. **Camera Error Callback:** Added `onError` handler to `<Camera>` to safely capture and log hardware events without black-screen crashing.

---

## 3. Files Modified

| File | Changes |
| :--- | :--- |
| `scripts/patch-face-auth.js` | Added patch logic for `FaceMaskOverlay.tsx` (container dimensions via `onLayout`, centering) and `FaceAuthView.tsx` (`sessionKey` prop, restart pipeline without camera unmount, `onError`). |
| `src/components/OnDeviceFaceAuthView.tsx` | Replaced `key={sessionKey}` with `sessionKey={sessionKey}` so `<Camera>` is never destroyed between sample captures. |
| `src/screens/RegisterScreen.tsx` | Added `isCapturingRef` atomic lock, clamped counter to exactly `REQUIRED_SAMPLES` (3), added 1200ms pacing cooldown, increased `cameraFrame` to `height: 380`, and added state cleanup on step exit. |
| `src/components/FaceRegistrationModal.tsx` | Added `isCapturingRef` atomic lock, clamped sample collection to exactly 3, and added cooldown. |
| `__tests__/faceEnrollmentCameraBugFix.test.ts` | Created dedicated test suite validating overlay geometry, 3-sample clamping under rapid frames, concurrent lock drops, and camera continuity. |

---

## 4. Automated Test Verification

### 4.1. TypeScript Verification
```bash
$ npx tsc --noEmit
# Exit code 0 (0 errors)
```

### 4.2. Unit & Integration Test Suites
```bash
$ npm test -- --watchman=false
Test Suites: 28 passed, 28 total
Tests:       263 passed, 263 total
Snapshots:   0 total
Time:        3.703 s
```

### 4.3. Admin Dashboard Test Suites
```bash
$ npm --prefix admin-dashboard test -- --run
Test Files  1 passed (1)
Tests       11 passed (11)
```

---

## 5. Android Emulator Live Verification

The application was run on an Android 14 / API 34 Pixel 8 Pro emulator (`emulator-5554`) connected to Metro.

1. **Step 3 Face Biometrics Layout:**
   - Face oval guide is centered with $45.2\,\text{px}$ clearance at top and $42.8\,\text{px}$ clearance above the bottom guidance bar.
   - Camera frame ($380\,\text{px}$ height) provides a natural portrait frame with zero vertical cutoff.
   - Verified in screenshot: `docs/screenshots/face_enrollment_aligned.png`
2. **Sample Capture Progression:**
   - Sample 1 captured: badge displays `"Captured: 1 of 3 samples"`. Camera preview remains active.
   - Sample 2 captured: badge displays `"Captured: 2 of 3 samples"`. Camera preview remains active.
   - Rapid-fire consecutive frame burst (5 rapid taps):
     - Synchronous `isCapturingRef` dropped all excess frames.
     - Counter locked firmly at `"Captured: 3 of 3 samples"`.
     - Verified in screenshot: `docs/screenshots/face_enrollment_counter_3_of_3.png`
3. **No Pitch-Black Camera Screen:**
   - The camera stream remained active and visible throughout the entire enrollment process across all samples.

---

## 6. Constraints Adherence

- **Free Firebase Spark Plan:** 100% compliant. No Cloud Functions, Blaze upgrades, or Firebase Storage used.
- **TFLite AI Models:** All models (`facenet_512.tflite`, `blazeface.tflite`, `face_mesh.tflite`, `spoof_2_7.tflite`, `spoof_4_0.tflite`) remain intact and unaltered.
- **Security & Liveness:** Full anti-spoofing and liveness challenge gates remain strictly enforced on-device.

