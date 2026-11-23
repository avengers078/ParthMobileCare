# Parth Mobile Care — Performance Regression Prevention Checklist

## 1. Objective & Performance Budgets
To maintain a high-speed, fluid, native-grade experience across Parth Mobile Care Android application, the following performance budgets must be strictly maintained for every future PR, feature, and build:

| Metric | Budget Target | Measurement Method |
| :--- | :--- | :--- |
| **Button / Tap Visual Feedback** | `< 100 ms` | Immediate active state on press without waiting for async handlers |
| **Bottom Tab Navigation Switch** | `< 100 ms` | Tab bar transition with lazy screen loading |
| **Initial Screen Content Render** | `< 300 ms` | First painted frame with cached data |
| **Add Lead Form Display** | `< 300 ms` | Modal mount time from tap to ready input |
| **Text Input Keystroke Response** | `< 50 ms` | Zero dropped frames or input lag while typing |
| **Data Fetch from Local Storage** | `< 5 ms` | Served instantly from `StorageService.memoryCache` |

---

## 2. Core Architectural Rules

### A. In-Memory Storage Cache (`StorageService.memoryCache`)
- **Rule:** Never perform repeated `AsyncStorage.getItem()` calls on screen focus or button tap.
- **Implementation:** `StorageService` maintains an in-memory `Map<string, any>` cache that serves all read queries (`getLeads`, `getPriceList`, `getPurchases`, `getSales`, `getAttendanceRecords`, `getAllUsers`, `getShopConfig`) in `< 1ms`.
- **Cache Invalidation:** Any mutation method (`saveLead`, `deleteLead`, `savePriceItem`, `deletePriceItem`, etc.) immediately updates both the in-memory cache and asynchronously persists to `AsyncStorage` and Firestore.
- **Audit Step:** Verify that repeated screen visits or tab switches do not trigger `AsyncStorage.getItem` calls.

### B. Lazy Modal Mounting Pattern
- **Rule:** Never mount hidden `<Modal>` child trees. In React Native, `<Modal visible={false}>` still mounts its children by default, causing massive memory overhead, measuring layout listeners, and keyboard event subscriptions.
- **Implementation:**
  1. `ModalCard` returns `null` immediately when `props.visible === false`.
  2. Screens mount heavy modals conditionally: `{isModalVisible && <HeavyModal visible={isModalVisible} ... />}`.
- **Audit Step:** In any screen with forms or detail modals, confirm that modal children are completely unmounted when not visible.

### C. Context Provider Stabilization & Memoization
- **Rule:** Never expose inline object literals in React Context values (e.g. `value={{ state, dispatch }}`).
- **Implementation:**
  - Wrap provider values in `useMemo()`:
    ```tsx
    const value = useMemo(() => ({ user, role, login, logout }), [user, role, login, logout]);
    ```
  - Wrap all context functions in `useCallback()`:
    ```tsx
    const reloadConfig = useCallback(async () => { ... }, []);
    ```
- **Audit Step:** Profile context consumer re-renders using React DevTools or test assertions to verify that unrelated component updates do not cause whole-app re-render storms.

### D. List Virtualization & Rendering Budgets
- **Rule:** FlatLists rendering inventory, leads, or purchase records must use tuned virtualization parameters.
- **Recommended FlatList Configuration:**
  ```tsx
  <FlatList
    data={items}
    keyExtractor={useCallback((item) => item.id, [])}
    renderItem={renderItemCallback}
    initialNumToRender={8}
    maxToRenderPerBatch={8}
    windowSize={5}
    removeClippedSubviews={Platform.OS === 'android'}
    updateCellsBatchingPeriod={50}
  />
  ```
- **Audit Step:** Never omit `keyExtractor` or pass an inline anonymous arrow function to `renderItem`.

### E. Screen Focus & Mount Deduplication
- **Rule:** Do not fetch data twice on screen mount (once in `useEffect` and once in `useFocusEffect`).
- **Implementation:** Use `isFirstLoadRef` to skip the duplicate fetch on initial screen mount:
  ```tsx
  const isFirstLoadRef = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstLoadRef.current) {
        isFirstLoadRef.current = false;
        return; // Already loaded by useEffect on mount
      }
      loadData();
    }, [loadData])
  );
  ```

---

## 3. Pre-Release Verification Checklist
Before building a release APK or tagging a production version:

- [ ] **Automated Tests:** Run all performance and unit tests:
  ```bash
  npm test -- __tests__/appPerformanceAndResponsiveness.test.tsx __tests__/criticalBugFixesAndUX.test.tsx __tests__/leadAndStaff.test.ts
  ```
- [ ] **Admin Dashboard Suite:** Run vitest suite to ensure shared data contracts remain intact:
  ```bash
  cd admin-dashboard && npm test -- --run
  ```
- [ ] **Release APK Compilation:** Verify clean release compilation without ProGuard or Hermes errors:
  ```bash
  cd android && ./gradlew assembleRelease
  ```
- [ ] **Physical Device Smoke Test:**
  - [ ] Tab switching between Leads, Inventory, Second Hand, and Profile responds in `< 100ms`.
  - [ ] Tapping "Add Lead" opens the modal in `< 300ms` without keyboard stutter.
  - [ ] Customer phone and name inputs accept continuous fast typing without lag.
  - [ ] WhatsApp dispatch and Cloudinary upload triggers execute smoothly.
