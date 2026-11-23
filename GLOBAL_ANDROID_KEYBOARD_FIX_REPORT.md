# PARTH MOBILE CARE — GLOBAL ANDROID KEYBOARD RESPONSIVENESS FIX REPORT

**Date:** November 3, 2026  
**Status:** IMPLEMENTED & AUDITED GLOBALLY ACROSS ALL SCREENS AND MODALS  
**Platform:** React Native (Android & iOS) • Android 14+ Compatible  

---

## Executive Summary

To eliminate recurrent Android keyboard overlap issues across the entire application, an architectural, reusable keyboard handling system was implemented throughout the React Native codebase. The solution covers all standalone screens, modal dialogs, and reusable input components, ensuring that focused fields remain visible, forms scroll smoothly, and the Android hardware Back button dismisses the soft keyboard first without discarding entered data or exiting the active screen.

---

## 1. Global Architectural Foundations

### A. Global `FormScrollContext` in [`src/components/ScreenContainer.tsx`](file:///Users/chetan/ParthMobileCare/src/components/ScreenContainer.tsx)
Every screen wrapped in `<ScreenContainer scrollable={true}>` automatically provides a scroll targeting context:
```typescript
export interface FormScrollContextType {
  scrollToInput: (targetNode: any) => void;
  scrollViewRef?: React.RefObject<any>;
}

export const FormScrollContext = createContext<FormScrollContextType | null>(null);
```
- Listens to native `Keyboard` show/hide events.
- Dynamically computes `paddingBottom: keyboardVisible ? Math.max(keyboardHeight, 260) + 60 : 24`.
- Measures the focused node relative to the container scroll view using `measureLayout` or `measureInWindow`, automatically scrolling the field into view with comfortable headroom above the keyboard.

### B. Auto-Connecting Reusable [`src/components/Input.tsx`](file:///Users/chetan/ParthMobileCare/src/components/Input.tsx)
The global `Input` component connects automatically to both modal and screen-level scroll contexts:
```typescript
onFocus={(e) => {
  setIsFocused(true);
  if (modalScroll?.scrollToInput && containerRef.current) {
    modalScroll.scrollToInput(containerRef.current);
  } else if (formScroll?.scrollToInput && containerRef.current) {
    formScroll.scrollToInput(containerRef.current);
  }
  onFocus && onFocus(e);
}}
```
Any screen utilizing `Input` automatically benefits from automated scroll targeting with zero boiler-plate.

### C. Android Hardware Back Button Dismissal Guarantee
In both [`ScreenContainer.tsx`](file:///Users/chetan/ParthMobileCare/src/components/ScreenContainer.tsx) and [`ModalCard.tsx`](file:///Users/chetan/ParthMobileCare/src/components/ModalCard.tsx), an Android `BackHandler` listener intercepts hardware/gesture back presses:
```typescript
const backSub = BackHandler.addEventListener('hardwareBackPress', () => {
  if (keyboardVisible) {
    Keyboard.dismiss();
    return true; // Dismiss keyboard first, preserve form and screen state
  }
  return false;
});
```

---

## 2. Screen & Modal Coverage Audit

| Screen / Modal | Inputs Covered | Keyboard Handling Implementation |
| :--- | :--- | :--- |
| **Login Screen** ([`LoginScreen.tsx`](file:///Users/chetan/ParthMobileCare/src/screens/LoginScreen.tsx)) | Email, Password | Dynamic bottom padding (`keyboardHeight + 60`); focus chaining (`returnKeyType="next"` ➔ `"done"`); hardware back dismissal; background tap dismiss. |
| **Staff Registration** ([`RegisterScreen.tsx`](file:///Users/chetan/ParthMobileCare/src/screens/RegisterScreen.tsx)) | Full Name, Email, Phone, Designation, Password, Confirm Password | Focus chaining through all 6 inputs; dynamic inset buffer; auto-scroll to focused field; keyboard dismissed prior to camera face enrollment. |
| **Add / Edit Customer Lead** ([`ModalCard.tsx`](file:///Users/chetan/ParthMobileCare/src/components/ModalCard.tsx) in `LeadListScreen.tsx`) | Customer Name, Mobile, Alt Mobile, Requirement, Budget, Notes | Modal height dynamically calculated above keyboard (`availableHeightAboveKeyboard`); `ModalScrollContext.scrollToInput` auto-scrolls; hardware back dismisses keyboard without closing modal. |
| **Second-Hand Purchase Modal** ([`SecondHandScreen.tsx`](file:///Users/chetan/ParthMobileCare/src/screens/SecondHandScreen.tsx)) | Customer Name, Phone, Aadhaar, Brand, Model, RAM/Storage, IMEI, Condition, Amount, Notes | Full scrollability with 11 form fields; submit and digital signature sections reachable via scroll while keyboard active. |
| **Second-Hand Sale Modal** ([`SecondHandScreen.tsx`](file:///Users/chetan/ParthMobileCare/src/screens/SecondHandScreen.tsx)) | Buyer Name, Phone, Aadhaar, Sale Amount, Warranty, Notes | Form scales to available height; action buttons remain accessible. |
| **Device Binding Change Request** ([`DeviceBindingModal.tsx`](file:///Users/chetan/ParthMobileCare/src/components/DeviceBindingModal.tsx)) | Justification Reason | Multiline text input auto-positions above soft keyboard. |
| **Price List Search** ([`PriceListScreen.tsx`](file:///Users/chetan/ParthMobileCare/src/screens/PriceListScreen.tsx)) | Brand / Model Search | Tap-outside dismisses keyboard; flatlist scrolls freely. |

---

## 3. Strict Quality Invariants Enforced

1. **No Artificial Font Shrinking**: All text input font sizes remain strictly on typography tokens (`TYPOGRAPHY.bodyMedium`).
2. **No Field Removal**: All required regulatory, Aadhaar, and password confirmation fields are preserved.
3. **No Hardcoded Screen Heights**: Layout calculations utilize dynamic viewport dimensions (`useWindowDimensions()`) and safe area insets.
4. **No Nested `KeyboardAvoidingView` Conflicts**: Disabled outer redundant avoidance wrappers to allow native `windowSoftInputMode="adjustResize"` to govern activity resizing.

