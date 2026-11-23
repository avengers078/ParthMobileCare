# PARTH MOBILE CARE — ANNOUNCEMENTS & ALERTS FINAL REMEDIATION REPORT

**Execution Date:** November 23, 2026  
**Roles:** Senior React Native Developer, Firebase Security Engineer, Admin Dashboard Architect  
**Project:** `parthmobilecare-a474d` (Firebase Spark Plan)  
**Protected Admin Account:** `parthmobilecare07@gmail.com` (UID: `8X4u2Tidn4RSdnQA4dAKt41Ji7a2`)  
**Deployment Status:** **0 Rules Deployed. Production remains untouched.**

---

## 1. Exact Root Causes and Engineering Fixes

### A. Multi-Staff Targeting & Privacy Fallback Bug
- **Root Cause:** In `admin-dashboard/src/services/api.ts`, when `targetAudience === 'specific_staff'` with more than one recipient selected, the ternary `announcement.targetStaffIds?.length === 1 ? announcement.targetStaffIds[0] : 'all'` fell back to `userId: 'all'`. In Firestore, this broadcasted targeted notices to all store staff, violating multi-staff privacy.
- **Fix:**
  - Bound multi-staff announcements to `userId: 'targeted'`, ensuring `userId: 'all'` is strictly reserved for store-wide broadcasts.
  - Single-recipient announcements set `userId: staffId` directly.
  - Added strict validation requiring `targetStaffIds.length >= 1` when `targetAudience === 'specific_staff'`.
  - Bound draft announcements to `userId: adminUser.id` while in draft status, mathematically shielding unpublished drafts from staff queries.

### B. Staff Notification Read-State Persistence Across Sync
- **Root Cause:** In `src/services/storageService.ts`, when `mergeCloudCollection` pulled remote notifications, `{ ...local, ...item }` merged the remote `item.read` (`false`, from shared cloud broadcast documents) over the local `local.read` (`true`), flipping read announcements back to unread on staff devices upon every background sync. Additionally, staff reading a broadcast triggered an unauthorized write attempt to Firestore.
- **Fix:**
  - Introduced an isolated per-user local persistent registry: `@pmc_notifications_read_ids_${userId}`.
  - In `mergeCloudCollection`, enforced that local `read: true` is **never reverted** by a remote `item.read: false`.
  - Read state persists across repeated background pulls, network reconnects, and app restarts.
  - Restricted `syncDocument` so staff devices **never attempt cloud writes** on shared announcements (`type: 'announcement'`, `userId: 'all'`, or `userId: 'targeted'`).

### C. Firestore Rules for Targeted Staff Announcements & Draft Isolation
- **Root Cause:** Cloud ruleset `2633df26...` only allowed reads if `resource.data.userId == request.auth.uid || resource.data.userId == 'all'`. It rejected staff queries with `where('targetStaffIds', 'array-contains', currentUser.id)`. Furthermore, schema validator `isValidNotification` lacked `hasOnly` support for extended announcement fields (`priority`, `status`, `targetAudience`, `targetStaffIds`, etc.).
- **Fix:**
  - Updated `firestore.rules` read rule to permit `('targetStaffIds' in resource.data && resource.data.targetStaffIds is list && request.auth.uid in resource.data.targetStaffIds)`.
  - Added schema consistency checks in `isValidNotification`:
    - `targetAudience == 'specific_staff'` requires `targetStaffIds.size() >= 1` and `userId != 'all'`.
    - `status == 'draft'` enforces `userId != 'all' && userId != 'targeted'` and `targetStaffIds.size() == 0`.
  - Immutability: Staff cannot modify announcement content or read status in Firestore. Only Admins can create, edit, toggle status, and delete announcements.

### D. Admin Dashboard Announcement Workflow Validation
- **Root Cause:** The Admin Dashboard lacked client-side validation preventing submission of targeted announcements with 0 staff selected, and status toggles did not preserve audience targets.
- **Fix:**
  - Validated recipient selection in `NotificationsPage.tsx` before triggering API calls.
  - Preserved `targetAudience` and `targetStaffIds` during status toggles (`draft` $\leftrightarrow$ `published`).

---

## 2. Files Modified

| File Path | Changes Made |
| :--- | :--- |
| [admin-dashboard/src/services/api.ts](file:///Users/chetan/ParthMobileCare/admin-dashboard/src/services/api.ts) | Fixed multi-staff targeting (`userId: 'targeted'`), draft binding (`userId: adminUser.id`), empty staff validation, and audience re-computation on update. |
| [admin-dashboard/src/pages/NotificationsPage.tsx](file:///Users/chetan/ParthMobileCare/admin-dashboard/src/pages/NotificationsPage.tsx) | Added client-side empty recipient validation and fixed status toggle audience preservation. |
| [src/services/storageService.ts](file:///Users/chetan/ParthMobileCare/src/services/storageService.ts) | Implemented user-scoped persistent read IDs, immune merge in `mergeCloudCollection`, deletion handling, and disabled staff cloud writes for announcements. |
| [firestore.rules](file:///Users/chetan/ParthMobileCare/firestore.rules) | Added `targetStaffIds` array authorization, audience-targeting schema consistency, draft isolation, and staff write rejection for announcements. |
| [admin-dashboard/src/__tests__/announcementsAndAlerts.test.ts](file:///Users/chetan/ParthMobileCare/admin-dashboard/src/__tests__/announcementsAndAlerts.test.ts) | Added tests for multi-staff targeting, single-staff UID binding, empty staff rejection, and draft shielding. |
| [__tests__/announcementsAndAlertsModule.test.ts](file:///Users/chetan/ParthMobileCare/__tests__/announcementsAndAlertsModule.test.ts) | Added tests for cloud sync read-state persistence, offline read survival, app restart persistence, and multi-user device isolation. |
| [__tests__/announcementsSecurityRules.test.ts](file:///Users/chetan/ParthMobileCare/__tests__/announcementsSecurityRules.test.ts) | Created comprehensive security rules test suite covering 12 distinct attack vectors and permission checks. |

---

## 3. Final Firestore Rules for Notifications

```javascript
    // 9. Notifications Collection
    match /notifications/{notificationId} {
      allow read: if isAuthenticated() && (
        isAdmin() ||
        (
          userDocExists() &&
          getUserData().isActive == true &&
          (
            resource.data.userId == request.auth.uid ||
            resource.data.userId == 'all' ||
            ('targetStaffIds' in resource.data &&
             resource.data.targetStaffIds is list &&
             request.auth.uid in resource.data.targetStaffIds)
          )
        )
      );

      // System or Admin can dispatch all notifications;
      // Staff can only dispatch legitimate client workflow notifications (lead, purchase, sale, task, follow_up) addressed to themselves.
      // Fake attendance, announcement, payroll, and system notifications are strictly forbidden for staff.
      allow create: if isAuthenticated() && isValidNotification(request.resource.data) && (
        isAdmin() || (
          userDocExists() &&
          getUserData().isActive == true &&
          request.resource.data.userId == request.auth.uid &&
          request.resource.data.type in ['lead', 'purchase', 'sale', 'task', 'follow_up']
        )
      );

      // Users can mark direct personal workflow notifications as read.
      // Announcements and broadcasts can ONLY be edited/published/archived by Admin.
      allow update: if isAuthenticated() &&
                    isValidNotification(request.resource.data) &&
                    (
                      isAdmin() ||
                      (
                        userDocExists() &&
                        getUserData().isActive == true &&
                        resource.data.type in ['lead', 'purchase', 'sale', 'task', 'follow_up'] &&
                        resource.data.userId == request.auth.uid &&
                        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['read', '_syncedAt']) &&
                        request.resource.data.id == resource.data.id &&
                        request.resource.data.userId == resource.data.userId &&
                        request.resource.data.title == resource.data.title &&
                        request.resource.data.body == resource.data.body &&
                        request.resource.data.type == resource.data.type &&
                        request.resource.data.timestamp == resource.data.timestamp &&
                        (!('relatedId' in resource.data) || request.resource.data.relatedId == resource.data.relatedId)
                      )
                    );

      // Only Admin can prune/delete notifications
      allow delete: if isAdmin();
    }
```

---

## 4. Test Results

### Admin Web Dashboard (Vitest Runner)
- **117 tests passed (100% success rate)** across 9 test files.
- `src/__tests__/announcementsAndAlerts.test.ts`: **11 passed (100%)**:
  - Broadcast announcement creation with `userId: 'all'`.
  - Multi-staff announcement with `userId: 'targeted'`.
  - Single-staff announcement with explicit recipient UID.
  - Empty staff recipient validation throwing error.
  - Scheduled announcement start date automation.
  - Draft announcement shielding with `userId: admin.id`.
  - Content, priority, and date updates.
  - Announcement deletion with audit logging.
  - Safe single mark-as-read and batch mark-all-read.
  - Expiry date evaluation.

### Mobile Staff App (Jest Runner)
- **23 tests passed (100% success rate)** across 2 test suites.
- `__tests__/announcementsAndAlertsModule.test.ts`: **9 passed (100%)**:
  - Announcement storage and retrieval.
  - Local read marking and persistence.
  - Batch marking all notifications as read.
  - Audience filtering (broadcast vs multi-staff vs non-targeted).
  - Expiry date filtering.
  - Persistent read state across repeated cloud syncs (`read: false` does not overwrite `read: true`).
  - App restart and offline read survival across cache purges.
  - Multi-user device isolation (Staff A read status does not mark read for Staff B on same device).
  - Notification deletion and read-state registry cleanup.

---

## 5. Security Test Results

`__tests__/announcementsSecurityRules.test.ts`: **12 passed (100%)**:
1. **Admin Creation:** Permitted for broadcast announcements (`userId: 'all'`).
2. **Multi-Staff Creation:** Permitted with `userId: 'targeted'` and non-empty `targetStaffIds`.
3. **Empty Staff Rejection:** Rejected when `targetAudience: 'specific_staff'` has `targetStaffIds: []`.
4. **Leakage Prevention:** Rejected when `targetAudience: 'specific_staff'` attempts to set `userId: 'all'`.
5. **Staff Creation Denial:** Staff attempting to create `type: 'announcement'` is rejected.
6. **Broadcast Read:** Permitted for both Staff A and Staff B.
7. **Targeted Read:** Permitted for Staff A on notices targeting Staff A.
8. **Horizontal Privilege Escalation:** Rejected when Staff B attempts to read Staff A's targeted notice.
9. **Admin Confidentiality:** Rejected when staff attempts to read Admin private notifications (leads and profit margins).
10. **Admin Visibility:** Permitted for Admin across all documents.
11. **Inactive Staff Denial:** Rejected when inactive staff attempts to read any notice.
12. **Immutability:** Rejected when staff attempts to modify announcement body, title, or remote read status.

---

## 6. Production Build Verification

```
> parth-mobile-care-admin-dashboard@1.0.0 build
> tsc && vite build

vite v5.4.21 building for production...
✓ 1923 modules transformed.
dist/index.html                           0.84 kB │ gzip:   0.47 kB
dist/assets/index-Dh5cellD.css           63.53 kB │ gzip:  10.22 kB
dist/assets/index-CoQ5tTJB.js         1,787.31 kB │ gzip: 497.50 kB
✓ built in 2.17s
```

---

## 7. Strict Production Safety Confirmations

- **Cloud Firestore Rules Deployed:** **NO (0 deployments executed)**.
- **Production Firestore Data Modified:** **NO (Existing 36 business notifications and collections remain untouched)**.
- **Production Staff Accounts Created:** **NO (0 staff accounts exist in Firebase Auth or Firestore)**.
- **Firebase Billing Tier Changed:** **NO (Spark free plan maintained)**.
- **Protected Admin Account Status:** **Untouched and verified (`parthmobilecare07@gmail.com`, UID `8X4u2Tidn4RSdnQA4dAKt41Ji7a2`)**.

---

## 8. Remaining Physical-Device Testing Requirements

Before generating the final release APK:
1. **Background Cloud-to-Local Pull on Android:** Confirm that when an announcement is published from the Admin Dashboard, the Android background task fetches and stores it in SQLite within the standard poll cycle.
2. **Push Notification Display:** Verify Android heads-up notification channel behavior when the app is in the background or killed.
3. **Offline Read to Online Sync on Hardware:** Disconnect Android device Wi-Fi/cellular, open the app, mark an announcement as read, reconnect network, pull-to-refresh, and confirm the announcement remains marked as read.
