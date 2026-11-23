# PARTH MOBILE CARE — ANDROID KEYBOARD OVERLAP & REGISTRATION FORM RESPONSIVENESS FIX REPORT

**Date:** November 3, 2026  
**Status:** ACCEPTED & VERIFIED ON ANDROID EMULATOR (`emulator-5554`)  
**Platform:** React Native (Android & iOS) / Android 14+ / Spark Plan Compliant  

---

## Executive Summary

During testing of the newly introduced Direct Staff Registration workflow in the Parth Mobile Care mobile application, opening the soft keyboard in the registration screen caused the lower portion of the form—specifically the **Password** field, **Confirm Password** field, and action buttons (**"Continue to Email Verification"**, **"Back to Sign In"**)—to be obscured beneath the keyboard. The user was unable to view the focused fields, and automatic scrolling did not position the active field into view.

A permanent, architecture-level fix has been implemented across the layout, scroll engine, input focus chaining, and Android lifecycle listeners. Testing on a live Android emulator (`emulator-5554`) confirms:
- All 6 registration input fields are 100% accessible and automatically scroll into comfortable viewing range when focused.
- Both primary and secondary action buttons can be brought cleanly into view and tapped even while the keyboard remains visible.
- Form scrollability is preserved with smooth manual dragging while the keyboard is open.
- Tapping outside inputs dismisses the keyboard gracefully.
- Pressing Android's hardware/gesture Back button dismisses the keyboard first without exiting the registration screen.
- Advancing through subsequent registration steps (Step 2: Email Verification, Step 3: Face Enrollment) dismisses the keyboard and preserves the camera layout without distortion.

---

## 1. Root Cause Analysis

Inspection of the registration screen (`src/screens/RegisterScreen.tsx`) and container hierarchy revealed four interacting root causes:

1. **Nested Conflicting `KeyboardAvoidingView` Instances**:
   `ScreenContainer` was already configured with an internal `KeyboardAvoidingView` enabled by default (`keyboardAvoiding={true}`). `RegisterScreen` then instantiated its own child `KeyboardAvoidingView`. On Android with native `windowSoftInputMode="adjustResize"`, two competing avoidance layers resulted in layout jitter, incorrect height measurements, and prevented child scroll views from calculating the true visible window area.

2. **Missing Dynamic Bottom Inset on ScrollView**:
   When the Android soft keyboard appears under `adjustResize`, the window viewport shrinks. However, because the total height of the registration card content exceeded the reduced viewport height, the bottom fields remained pinned at the bottom limit without enough extra scroll buffer. The `ScrollView` lacked dynamic bottom padding (`paddingBottom: keyboardHeight + extraOffset`), causing the scroll engine to truncate scrolling before reaching the lowest inputs.

3. **Absence of Coordinated Input Chaining & Scroll Targeting**:
   Individual `Input` components were unreferenced (`ref`), had default return keys, and lacked `onFocus` programmatic scroll hooks. When a user tapped or navigated to the lower fields, React Native had no directive to offset the `ScrollView` to center the focused element above the keyboard toolbar.

4. **Default Android Hardware Back Button Dismissal Conflict**:
   Pressing the Android Back button with the soft keyboard open would sometimes bubble up to the React Navigation stack and trigger a screen pop instead of solely dismissing the soft keyboard.

---

## 2. Exact Files Changed

| File Path | Description of Changes |
| :--- | :--- |
| [`src/screens/RegisterScreen.tsx`](file:///Users/chetan/ParthMobileCare/src/screens/RegisterScreen.tsx) | Configured outer `ScreenContainer` with `keyboardAvoiding={false}`; configured single top-level `KeyboardAvoidingView` with `behavior={Platform.OS === 'ios' ? 'padding' : undefined}`; added dynamic bottom padding (`Math.max(keyboardHeight, 260) + 60`); attached `useRef` to all 6 inputs and the `ScrollView`; added `returnKeyType="next"` / `returnKeyType="done"` with focus chaining; added `onLayout` tracking and `onFocus` automated scroll offsets; wrapped contents in `TouchableWithoutFeedback` with `accessible={false}`; added `BackHandler` listener for keyboard-first dismissal; added explicit `Keyboard.dismiss()` calls before advancing across registration steps. |
| [`src/types/index.ts`](file:///Users/chetan/ParthMobileCare/src/types/index.ts) | Added optional `_syncedAt?: string` to `User` interface to eliminate strict TypeScript compilation errors across auth models. |

---

## 3. Keyboard Handling & Architecture Changes

### A. Viewport & Avoidance Decoupling
In `src/screens/RegisterScreen.tsx`:
```tsx
// Outer container disables default wrapper to avoid nested conflicts
<ScreenContainer edges={['top', 'left', 'right', 'bottom']} keyboardAvoiding={false}>
  {/* Single avoidance view: iOS uses padding, Android relies on adjustResize */}
  <KeyboardAvoidingView
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    style={styles.keyboardContainer}
  >
    <ScrollView
      ref={scrollViewRef}
      style={styles.scrollView}
      contentContainerStyle={[
        styles.scrollContent,
        {
          paddingBottom: keyboardVisible
            ? Math.max(keyboardHeight, 260) + 60
            : SPACING.xxl + 40,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={true}
      bounces={false}
      overScrollMode="always"
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        ...
      </TouchableWithoutFeedback>
    </ScrollView>
  </KeyboardAvoidingView>
</ScreenContainer>
```

### B. Automated Scroll-to-Field on Focus
Each form input is wrapped with an `onLayout` measurement handler and triggered with an `onFocus` smooth scroll:
```tsx
const fieldPositions = useRef<Record<string, number>>({});

const registerFieldLayout = (field: string) => (e: any) => {
  fieldPositions.current[field] = e.nativeEvent.layout.y;
};

const scrollToField = (field: string) => () => {
  const y = fieldPositions.current[field];
  if (y !== undefined && scrollViewRef.current) {
    setTimeout(() => {
      // Offset accounts for header & card padding so field is positioned comfortably in visible viewport
      const targetScrollY = Math.max(0, y + 100);
      scrollViewRef.current?.scrollTo({
        y: targetScrollY,
        animated: true,
      });
    }, Platform.OS === 'android' ? 120 : 60);
  }
};
```

### C. Sequential Keyboard Navigation (Focus Chaining)
Every input has explicit keyboard action keys and `onSubmitEditing` hooks:
1. **Full Name** (`returnKeyType="next"`) ➔ focuses **Email Address**
2. **Email Address** (`returnKeyType="next"`) ➔ focuses **Mobile Number**
3. **Mobile Number** (`returnKeyType="next"`) ➔ focuses **Designation**
4. **Designation** (`returnKeyType="next"`) ➔ focuses **Password**
5. **Password** (`returnKeyType="next"`) ➔ focuses **Confirm Password**
6. **Confirm Password** (`returnKeyType="done"`) ➔ submits `handleProceedToEmailVerification()`

### D. Hardware Back Button Dismissal
```tsx
const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
  if (keyboardVisible) {
    Keyboard.dismiss();
    return true; // Dismiss keyboard first, do not exit registration
  }
  return false;
});
```

---

## 4. Android Configuration

The Android project manifest (`android/app/src/main/AndroidManifest.xml`) was verified to maintain:
```xml
android:windowSoftInputMode="adjustResize"
```
Under this setting:
- Android natively resizes the activity window when the soft keyboard is displayed.
- The React Native `ScrollView` with dynamic `paddingBottom` handles the internal content offset smoothly.
- No third-party native keyboard dependencies or bridging libraries were required, preserving Spark Plan and React Native 0.87 compatibility.

---

## 5. Live Emulator Verification Results

Testing was performed on the active Android Emulator (`emulator-5554` running Android 14 / API 34).

### Step-by-Step Test Log

| # | Test Scenario | Expected Outcome | Actual Result | Status |
| :---: | :--- | :--- | :--- | :---: |
| 1 | **Open Registration Screen** | Step 1 renders with all 6 fields and buttons visible | Rendered cleanly without clipping | **PASS** |
| 2 | **Tap "Full Name" Field** | Soft keyboard opens; input remains in view | Keyboard opened; text input remains in clear view | **PASS** |
| 3 | **Next Key Chaining** | Tapping "Next" on keyboard advances through Email, Phone, Designation, Password, Confirm Password | Chaining moved focus seamlessly down the form | **PASS** |
| 4 | **Tap "Confirm Password" Directly** | Form scrolls automatically; Confirm Password and action buttons appear above keyboard | Auto-scroll centered Confirm Password with action buttons visible | **PASS** |
| 5 | **Manual Scroll While Keyboard Open** | User can drag up and down to inspect earlier fields | Form scrolls smoothly with zero jitter or locking | **PASS** |
| 6 | **Password Visibility Toggle** | Eye icon toggles password obscuring without dismissing keyboard | Toggled between hidden and visible text cleanly | **PASS** |
| 7 | **Background Tap Dismissal** | Tapping empty area around card dismisses soft keyboard | Keyboard dismissed immediately | **PASS** |
| 8 | **Hardware Back Button Press** | Back button dismisses soft keyboard without popping screen | Keyboard dismissed; user stayed on Step 1 | **PASS** |
| 9 | **Step 2 Transition** | Submitting Step 1 dismisses keyboard and displays Email Verification | Keyboard dismissed; Email verification card centered | **PASS** |
| 10 | **Step 3 Transition** | Advancing to Face Enrollment opens camera preview without distortion | VisionCamera preview frames rendered correctly | **PASS** |

---

## 6. Visual Evidence (Before vs. After)

### Before Fix (Issue Reported)
In the initial report, opening the soft keyboard completely obscured the lower half of the form:
- Only fields down to *Designation / Role Title* were visible.
- *Password*, *Confirm Password*, *"Continue to Email Verification"*, and *"Back to Sign In"* were inaccessible.

### After Fix (Verified on Live Emulator)
When *Confirm Password* is tapped, the form automatically scrolls to place the active input, *"Continue to Email Verification"*, and *"Back to Sign In"* completely above the soft keyboard:

| State | Screenshot Reference | Description |
| :--- | :--- | :--- |
| **Initial Registration Form** | [`docs/screenshots/emulator_reg_step1.png`](file:///Users/chetan/ParthMobileCare/docs/screenshots/emulator_reg_step1.png) | Step 1 with all 6 input fields and action buttons visible |
| **Confirm Password Focused** | [`docs/screenshots/emulator_reg_confirm_password_focused.png`](file:///Users/chetan/ParthMobileCare/docs/screenshots/emulator_reg_confirm_password_focused.png) | Focused on Confirm Password with both buttons fully visible above the keyboard |
| **Scrolled to Top with Keyboard Open** | [`docs/screenshots/emulator_reg_scrolled_up_with_kb.png`](file:///Users/chetan/ParthMobileCare/docs/screenshots/emulator_reg_scrolled_up_with_kb.png) | User can freely scroll up to check previous fields while keyboard remains open |
| **Keyboard Dismissed via Back Button** | [`docs/screenshots/emulator_reg_after_back_dismiss.png`](file:///Users/chetan/ParthMobileCare/docs/screenshots/emulator_reg_after_back_dismiss.png) | Back button dismissed keyboard without leaving registration screen |

---

## 7. Quality & Integrity Checks

- **TypeScript Compilation**: `npx tsc --noEmit` passed with **0 errors**.
- **Unit Test Suite**: `npm test -- --watchman=false` passed (**26 suites, 238 tests passing**).
- **Admin Dashboard Build**: `npm --prefix admin-dashboard run build` passed with **0 errors**.
- **Admin Dashboard Tests**: `npm --prefix admin-dashboard run test:run` passed (**11 tests passing**).
- **Theme & Branding**: Parth Mobile Care primary blue (`#194D9C`) and card typography strictly preserved.
- **Firebase Spark Plan**: Zero paid cloud functions or external API services introduced.

