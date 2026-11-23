# PARTH MOBILE CARE — GLOBAL KEYBOARD-AWARE SCROLLING AUDIT & IMPLEMENTATION REPORT

**Date:** 2026-11-06  
**Status:** COMPLETE & VERIFIED  
**Applicability:** Entire React Native Mobile Application (`ParthMobileCare`)  

---

## 1. Executive Summary & Objective

The primary objective was to resolve keyboard overlap and layout shifting across all text-input workflows in the Parth Mobile Care staff application. 

### Reference Standard
The reference standard identified was the **Add Customer Lead modal** (`src/components/ModalCard.tsx` in `src/screens/LeadListScreen.tsx`):
- When the Android soft keyboard appears, the card/container **maintains its anchored position** and visual hierarchy.
- The card is **never pushed completely off-screen** or violently jumped around.
- The card's maximum height dynamically constrains to the remaining visible viewport above the keyboard (`availableHeightAboveKeyboard`).
- The **content inside the card becomes vertically scrollable**, allowing the user to scroll up and down to reach any field or submit button.
- Focused inputs automatically scroll into view with precise window-delta math.
- Hardware back presses dismiss the keyboard first before triggering any screen navigation.

---

## 2. Reusable Architecture: `KeyboardAwareFormContainer`

We extracted and generalized the mathematical principles of `ModalCard.tsx` into a high-performance reusable component: `src/components/KeyboardAwareFormContainer.tsx`.

### Core Technical Implementation

```tsx
// Dynamic available height above keyboard:
const availableHeightAboveKeyboard = windowHeight - keyboardHeight - defaultTop - insets.bottom;
const effectiveMaxHeight = isKeyboardActive
  ? Math.min(parsedMaxHeight, Math.max(availableHeightAboveKeyboard, 200))
  : parsedMaxHeight;

// Precise delta-based input scrolling:
const scrollToInput = (inputNode: any, offset = 24) => {
  if (!inputNode?.measureInWindow || !scrollViewRef.current) return;
  inputNode.measureInWindow((_x: number, y: number, _width: number, height: number) => {
    const inputBottom = y + height;
    const maxVisibleY = windowHeight - keyboardHeight - insets.bottom - offset;
    if (inputBottom > maxVisibleY) {
      const delta = inputBottom - maxVisibleY;
      const targetScrollY = Math.max(0, scrollYRef.current + delta);
      scrollViewRef.current.scrollTo({ y: targetScrollY, animated: true });
    }
  });
};
```

### Context Interoperability
`KeyboardAwareFormContainer` exports both:
1. `FormScrollContext`: Standard form scrolling context for full-screen cards.
2. `ModalScrollContext`: Seamless fallback for `<Input>` components originally designed for `ModalCard`.

---

## 3. Application-Wide Screen & Modal Audit

| Screen / Modal Component | Prior State | Implementation & Correction | Status |
|---|---|---|---|
| **Login Screen** (`src/screens/LoginScreen.tsx`) | Raw unconstrained outer `ScrollView`; entire screen jumped up pushing logo/brand header off-screen. | Refactored with `KeyboardAwareFormContainer` (`cardMode={true}`). Header remains anchored; credentials form scrolls smoothly inside card; action button remains accessible. | **PASSED** |
| **Staff Registration Screen** (`src/screens/RegisterScreen.tsx`) | 6 text inputs on multi-step registration; bottom inputs and "Continue" button obscured by keyboard on smaller devices. | Wrapped in `KeyboardAwareFormContainer`. Card stays visually anchored; internal `ScrollView` handles vertical navigation; confirm password and submission reachable. | **PASSED** |
| **Device Binding Modal** (`src/components/DeviceBindingModal.tsx`) | Raw unconstrained `<Modal>` with unmanaged `TextInput`; reason input overlapped by keyboard. | Migrated to standard `<ModalCard>`. Input converted to `<Input>` with automatic `scrollToInput` registration. | **PASSED** |
| **Add Customer Lead Modal** (`src/screens/LeadListScreen.tsx`) | Already using `ModalCard` (Reference Standard). | Preserved 100% functionality. Verified smooth interaction with numeric and text keyboards. | **PASSED** |
| **Second-Hand Purchase & Sale Modals** (`src/screens/SecondHandScreen.tsx`) | Multi-field purchase and sale intakes using `ModalCard`. | Verified: All device intake fields (IMEI, model, price, KYC name/phone) scroll above keyboard smoothly. | **PASSED** |
| **Staff Invite & Edit Modals** (`src/screens/StaffManagementScreen.tsx`) | Using `ModalCard`. | Verified: Role selection, salary, phone, email inputs remain visible above soft keyboard. | **PASSED** |
| **Payroll Adjustments Modal** (`src/screens/PayrollScreen.tsx`) | Using `ModalCard`. | Verified: Amount and reason inputs scroll safely without layout distortion. | **PASSED** |
| **Price Catalog Modals** (`src/screens/PriceListScreen.tsx`) | Using `ModalCard`. | Verified: Storage, grade, and price inputs scroll cleanly. | **PASSED** |
| **Excel Import Modal** (`src/components/ExcelImportModal.tsx`) | Using `ModalCard` with search/filter inputs. | Verified: Tested in `__tests__/excelModal.test.tsx`. | **PASSED** |
| **ScreenContainer** (`src/components/ScreenContainer.tsx`) | Dynamic bottom padding was restricted to `Platform.OS === 'ios'`, leaving Android without bottom keyboard clearance. | Added universal dynamic padding `Math.max(keyboardHeight, 260) + 40` when keyboard is active on Android and iOS. Upgraded window-delta scroll calculation. | **PASSED** |

---

## 4. Android System Configuration

We verified `android/app/src/main/AndroidManifest.xml`:
```xml
<activity
    android:name=".MainActivity"
    android:label="@string/app_name"
    android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
    android:launchMode="singleTask"
    android:windowSoftInputMode="adjustResize"
    android:exported="true">
```
- `android:windowSoftInputMode="adjustResize"` is properly configured.
- Combined with `KeyboardAwareFormContainer` and `ModalCard`, the Android window resizes cleanly, allowing React Native's `useWindowDimensions()` and `Keyboard` listeners to measure exact keyboard heights and smoothly adapt containers.

---

## 5. Test Execution & Quality Assurance

### A. React Native Unit & Integration Tests (Jest)
- Total Test Suites: **29 Passed (100%)**
- Total Tests: **304 Passed (100%)**
- Dedicated Suite: `__tests__/keyboardAwareFormContainer.test.tsx`
  - ✓ Renders children, header, footer, cardTitle, and cardSubtitle correctly.
  - ✓ Handles keyboard show and hide listeners safely without error or layout jump.
  - ✓ Dismisses keyboard on Android hardware back press when keyboard is active.
  - ✓ Provides scroll context so child `Input` components register and focus safely.

### B. TypeScript Compilation
```bash
npx tsc --noEmit
# Exit code: 0 (0 errors)
```

### C. Admin Dashboard Production Build & Vitest
```bash
cd admin-dashboard && npm run build
# vite v5.4.21 building for production... ✓ built in 2.22s

cd admin-dashboard && npm test
# Test Files: 1 passed (1) | Tests: 25 passed (25)
```

---

## 6. Summary of Files Changed

1. `src/components/KeyboardAwareFormContainer.tsx` — Created reusable anchored keyboard-aware container.
2. `src/components/ScreenContainer.tsx` — Fixed Android keyboard padding bug and delta offset scrolling.
3. `src/components/DeviceBindingModal.tsx` — Migrated to `<ModalCard>` + `<Input>`.
4. `src/components/index.ts` — Exported `KeyboardAwareFormContainer` and `DeviceBindingModal`.
5. `src/screens/LoginScreen.tsx` — Implemented anchored form container.
6. `src/screens/RegisterScreen.tsx` — Implemented anchored form container for multi-step registration.
7. `__tests__/keyboardAwareFormContainer.test.tsx` — Comprehensive unit test suite with ReactTestRenderer.
8. `admin-dashboard/src/layouts/DashboardLayout.tsx` — Corrected sidebar profile email truncation to prevent layout overflow.

