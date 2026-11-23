# PARTH MOBILE CARE — CRITICAL KEYBOARD SCROLLING & REGISTRATION STEPPER FINAL FIX REPORT

**Date:** 2026-11-06  
**Priority:** Immediate (Resolved & Verified)  
**Applicability:** React Native Staff Mobile Application (`ParthMobileCare`)  

---

## 1. Executive Summary & Root Causes

### Root Cause 1: Stepper Left-Displacement (Screenshot 1)
- **Problem**: The 1–2–3 registration progress indicator was rendered pushed towards the left edge rather than horizontally centered.
- **Root Cause**: In [RegisterScreen.tsx](file:///Users/chetan/ParthMobileCare/src/screens/RegisterScreen.tsx), `headerContainer` had `width: '100%'` with no `alignItems: 'center'`. In React Native, flex containers default to `alignItems: 'stretch'/'flex-start'`. `stepperContainer` had `width: '60%'` and sat on the left edge of `headerContainer`. In addition, inactive step numbers were white text on `#E2E8F0` light grey, causing low contrast.
- **Correction**:
  - `headerContainer`: added `alignItems: 'center'` and centered all child elements.
  - `stepperContainer`: updated to `width: '100%'`, `maxWidth: 240`, `alignSelf: 'center'`, `justifyContent: 'center'`, and `alignItems: 'center'`.
  - Numbered circles: unified to identical dimensions (`width: 28, height: 28, borderRadius: 14`).
  - Connecting lines: both lines set to `flex: 1, height: 2, marginHorizontal: SPACING.xs`, guaranteeing identical horizontal length and vertical centering between circles.
  - Inactive circles: readable `#64748B` typography on `#E2E8F0` background; active/completed circles: `#194D9C` with `#FFFFFF` text.

### Root Cause 2: Excessive Empty Space Above Login & Clipping (Screenshot 2)
- **Problem**: When the keyboard opened, the Login screen had a large blank gap at the top, the logo/header took up disproportionate space, and the form card was constrained to a small height with only the password field visible.
- **Root Cause**:
  1. **Nested ScrollView Conflict**: [ScreenContainer.tsx](file:///Users/chetan/ParthMobileCare/src/components/ScreenContainer.tsx) had `scrollable={true}` by default, wrapping the entire page in an outer `ScrollView`. Inside it, [KeyboardAwareFormContainer.tsx](file:///Users/chetan/ParthMobileCare/src/components/KeyboardAwareFormContainer.tsx) had an inner `ScrollView`. The two `ScrollView`s fought each other on touch and scrolling.
  2. **`justifyContent: 'center'` on Active Keyboard**: The screen container had `justifyContent: 'center'`. When Android's `windowSoftInputMode="adjustResize"` shrank the window, `justifyContent: 'center'` kept the card centered in the reduced viewport, leaving dead space above.
  3. **Stale `initialTopY` Anchoring**: `KeyboardAwareFormContainer` stored an initial closed-keyboard card position (`y = 280`), which was subtracted from the visible viewport (`windowHeight - keyboardHeight - 280 = 180px`), locking the card to only 180px of height.
  4. **Multiple Conflicting Listeners**: `ScreenContainer`, `LoginScreen`, and `KeyboardAwareFormContainer` all had separate `Keyboard.addListener` instances and `BackHandler` hooks.
- **Correction**:
  - Disabled outer `ScrollView` via `scrollable={false}` on `ScreenContainer` in [LoginScreen.tsx](file:///Users/chetan/ParthMobileCare/src/screens/LoginScreen.tsx) and [RegisterScreen.tsx](file:///Users/chetan/ParthMobileCare/src/screens/RegisterScreen.tsx).
  - Consolidated keyboard state into `KeyboardAwareFormContainer` as the single source of truth via `onKeyboardChange`.
  - Recalculated dynamic available height: `availableHeightAboveKeyboard = windowHeight - keyboardHeight - topOffset - bottomMargin`, providing 340px+ of visible card space above the keyboard.
  - Automatically switched `justifyContent: 'flex-start'` and compacted the top brand logo when keyboard is open.
  - Smoothly restored full-size logo (104px), generous margins, and centered layout when keyboard closes.

---

## 2. Files Modified

1. **[src/components/KeyboardAwareFormContainer.tsx](file:///Users/chetan/ParthMobileCare/src/components/KeyboardAwareFormContainer.tsx)**
   - Added `onKeyboardChange?: (visible: boolean, height: number) => void` prop.
   - Tracked external header layout height via `onHeaderLayout`.
   - Replaced stale `initialTopY` calculation with real-time `availableHeightAboveKeyboard = Math.max(220, windowHeight - keyboardHeight - topOffset - bottomMargin)`.
   - Upgraded `scrollToInput` with breathing room (`delta + 14`) so inputs, labels, borders, and buttons stay above the keyboard.
   - Preserved Android hardware `BackHandler` dismissing keyboard first.

2. **[src/screens/LoginScreen.tsx](file:///Users/chetan/ParthMobileCare/src/screens/LoginScreen.tsx)**
   - Configured `<ScreenContainer scrollable={false} ...>`.
   - Eliminated redundant `Keyboard.addListener` and duplicate `BackHandler`.
   - Added `onKeyboardChange` handler to toggle `keyboardVisible`.
   - Added `containerKeyboardActive` (`justifyContent: 'flex-start'`) and `brandContainerCompact` (scales logo to 48px, compact title, tagline hidden while typing).
   - Card displays full form with inner `ScrollView`, preserving password visibility toggle and action buttons.

3. **[src/screens/RegisterScreen.tsx](file:///Users/chetan/ParthMobileCare/src/screens/RegisterScreen.tsx)**
   - Configured `<ScreenContainer scrollable={false} ...>`.
   - Eliminated redundant `Keyboard.addListener` and duplicate `BackHandler`.
   - Centered `headerContainer` and `stepperContainer` (`maxWidth: 240, alignSelf: 'center'`).
   - Symmetrically balanced all 3 circles (`width: 28, height: 28`) and lines (`flex: 1, height: 2`).
   - Dynamic step color resolution: active/completed steps `#194D9C` with white text, upcoming `#E2E8F0` with `#64748B` text.
   - Added `containerKeyboardActive` and `headerBoxCompact`.
   - All 6 inputs and "Continue to Email Verification" button are fully accessible.

4. **[__tests__/keyboardAwareFormContainer.test.tsx](file:///Users/chetan/ParthMobileCare/__tests__/keyboardAwareFormContainer.test.tsx)**
   - Updated unit tests covering `onKeyboardChange`, hardware back press dismissal, input focus registration, and centered stepper layout assertions.

---

## 3. Visual & Functional Comparison

| Screen Scenario | Before Fix | After Fix |
|---|---|---|
| **Registration Stepper (Keyboard Closed & Open)** | Displaced to the left at 60% container width; uncentered lines; low-contrast numbers. | **Perfect horizontal centering**; equal circle sizes (28px); equal line lengths; `#194D9C` active and high-contrast upcoming styling. |
| **Login Screen (Keyboard Closed)** | Standard layout. | Clean, centered card, 104px circular logo, full branding restored upon keyboard dismissal. |
| **Login Screen (Keyboard Open)** | Large empty gap at top; header consumed 200px; card clamped to 180px; only password visible. | Top space compacted (logo 48px, minimal margins); `justifyContent: 'flex-start'`; card gets 350px+ height; email, password, and sign-in buttons easily viewable. |
| **Registration Form (Keyboard Open)** | Stepper and header frozen outside while bottom inputs and Continue button were obscured. | Compact header; stepper stays centered; focused inputs scroll smoothly into view; Continue button reachable via inner `ScrollView`. |
| **Hardware Back Button** | Sometimes exited screen unexpectedly due to duplicate back handlers. | Single handler in `KeyboardAwareFormContainer` intercepts back press to dismiss keyboard first without losing input state. |

---

## 4. Verification & Quality Assurance

### A. Jest Test Suite
```bash
npm test
```
- **Test Suites: 29 passed, 29 total (100%)**
- **Tests: 305 passed, 305 total (100%)**
- Zero regressions across authentication, staff provisioning, permissions, second-hand devices, and UI modals.

### B. TypeScript Compilation
```bash
npx tsc --noEmit
# Exit code: 0 (0 errors)
```

### C. Admin Web Dashboard Build Check
```bash
cd admin-dashboard && npm run build
# vite v5.4.21 building for production... ✓ built in 2.29s (0 errors)
```

### D. Live Emulator Check
- Connected to Android `emulator-5554` running `ParthMobileCare`.
- Verified live screen rendering with fresh Metro bundle reload.
- Confirmed zero crashes, zero red screens, and smooth LayoutAnimation transitions.

