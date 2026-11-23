# Parth Mobile Care — Staff Auth Account Deletion Report

**Date & Time:** 2026-11-05T06:31:17.851Z  
**Project ID:** `parthmobilecare-a474d` (Verified Production Firebase)  
**Authorization:** Explicit Administrator Approval Granted  
**Execution Script:** `scripts/cleanup_orphan_staff.mjs --execute`  
**Deletion Status:** COMPLETED SUCCESSFULLY & INDEPENDENTLY VERIFIED  

---

## 1. Executive Summary

Four (4) orphan Firebase Authentication accounts resulting from previous failed staff registrations were authorized for deletion. These accounts had no corresponding Firestore user document, but prevented staff from registering anew due to `auth/email-already-in-use`.

All four accounts have been **deleted from Firebase Authentication** and **verified absent** via individual Identity Toolkit lookup API calls.

---

## 2. Pre-Execution Safety Verification

Prior to performing deletions, the following invariants were verified live against project `parthmobilecare-a474d`:

1. **Store Administrator Integrity Verified:**
   - UID: `NmX4ySVJ6NPHytFA6XLnY9GYoCg1` (`parthmobileindia@gmail.com` / `parthpatel@example.com`)
   - Role: `admin`, `isActive: true`
   - Verified present and strictly protected in `PROTECTED_ACCOUNTS`.
2. **Active Staff Member Integrity Verified:**
   - UID: `user_staff_1792925577356` (`staff@gmail.com`, Ramesh Patel)
   - Role: `staff`, `isActive: true`
   - Verified present and strictly protected in `PROTECTED_ACCOUNTS`.
3. **Orphan Account State Verified:**
   - Every candidate UID matched its authorized email address exactly.
   - None of the 4 candidate UIDs had a profile in Firestore `users/`.
   - None of the 4 candidate UIDs belonged to an Admin or Manager.

---

## 3. Account-by-Account Deletion Results

| # | UID | Email | Initial Status | Deletion Operation | Post-Execution Lookup Verification | Final Status |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `0pvoT5eSdLSUeu7tZEh5WMYJLQB3` | `chetanluhar65@gmail.com` | Orphan Auth | `SUCCESS` | `CONFIRMED ABSENT (404 / null)` | **DELETED SUCCESSFULLY** |
| 2 | `Ew2zdaJlhFd2OlBWA1nQxisQ6O92` | `chetanluharchetanluhar@gmail.com` | Orphan Auth | `SUCCESS` | `CONFIRMED ABSENT (404 / null)` | **DELETED SUCCESSFULLY** |
| 3 | `HC53UujKJJbSm3sPdk2jUXQrSRG2` | `iamtonystark879@gmail.com` | Orphan Auth | `SUCCESS` | `CONFIRMED ABSENT (404 / null)` | **DELETED SUCCESSFULLY** |
| 4 | `zg98aKNCRqcPNwkpBtiXKbXLYqR2` | `chetan.skillupahmedabad@gmail.com` | Orphan Auth | `SUCCESS` | `CONFIRMED ABSENT (404 / null)` | **DELETED SUCCESSFULLY** |

---

## 4. Post-Execution Live Database Audit

### A. Firebase Authentication Remaining Accounts
A full query (`accounts:batchGet`) of Firebase Authentication in `parthmobilecare-a474d` confirms:
- **Total Accounts Remaining:** Exactly 1
- **Remaining Account UID:** `NmX4ySVJ6NPHytFA6XLnY9GYoCg1` (`parthpatel@example.com` / `parthmobileindia@gmail.com`) — Store Administrator.
- All 4 orphan test staff accounts are absent.

### B. Firestore `users/` Collection Audit
A full query of Firestore `users/` collection in `parthmobilecare-a474d` confirms:
- **Total User Documents:** Exactly 2
- **Document 1:** `NmX4ySVJ6NPHytFA6XLnY9GYoCg1` (Name: Parth, Role: `admin`, `isActive: true`) — **INTACT & PROTECTED**
- **Document 2:** `user_staff_1792925577356` (Name: Ramesh Patel, Role: `staff`, `isActive: true`) — **INTACT & PROTECTED**

### C. Other Collections & Data
- Zero documents in `attendance`, `leads`, `second_hand_purchases`, `second_hand_sales`, `salary_slips`, `notifications`, or `shop_config` were touched or modified.
- Zero Cloud Functions were deployed.
- Zero Firestore security rules were deployed.

---

## 5. Resulting State & Registration Readiness

The four email addresses:
1. `chetanluhar65@gmail.com`
2. `chetanluharchetanluhar@gmail.com`
3. `iamtonystark879@gmail.com`
4. `chetan.skillupahmedabad@gmail.com`

are now **completely released** in Firebase Authentication. Staff members can now register afresh through the updated mobile app without encountering `auth/email-already-in-use`.

