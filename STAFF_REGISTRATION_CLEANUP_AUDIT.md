# Parth Mobile Care — Staff Registration Cleanup & Dry-Run Audit

**Date:** 2026-11-05  
**Environment:** Firebase Production Project (`parthmobilecare-a474d`)  
**Audit Status:** DRY-RUN COMPLETE (ZERO DESTRUCTIVE WRITES OR DELETIONS EXECUTED)  
**Execution Tool:** `scripts/cleanup_orphan_staff.mjs`  

---

## 1. Executive Summary

This audit was conducted to identify unsuccessful and incomplete staff registrations for the Parth Mobile Care staff mobile application. The objective is to safely reset unsuccessful staff registrations so these staff members can re-register using their legitimate email addresses.

As strictly instructed:
1. **Zero destructive actions have been executed.**
2. A complete live audit across both Firebase Authentication and Firestore was conducted.
3. Every account has been classified with strict invariants protecting Store Administrators and Active Staff.

---

## 2. Invariant Protections (Zero-Risk Guarantee)

The following safety invariants are hard-coded into the cleanup engine:

1. **Admin Account Protection**:
   - `NmX4ySVJ6NPHytFA6XLnY9GYoCg1` (`parthmobileindia@gmail.com` / `parthpatel@example.com`) is the registered store administrator.
   - It is permanently protected from deletion.
2. **Active Staff Protection**:
   - `user_staff_1792925577356` (`staff@gmail.com`, Ramesh Patel) is an approved active staff member.
   - It is permanently protected from deletion.
3. **Business Data Protection**:
   - No documents in `attendance`, `leads`, `second_hand_purchases`, `second_hand_sales`, `salary_slips`, `notifications`, or `shop_config` are ever touched.
4. **Targeting Scope**:
   - Only accounts with role `"staff"` that are either marked `registrationStatus in ["pending", "rejected"]` AND `isActive == false`, OR orphan Authentication accounts created during failed staff registrations, can ever be considered for reset.

---

## 3. Live Production Database Audit Results

### Summary Table

| Account UID | Email | Display Name | Role | Reg Status | Active | In Auth? | Auth Verified? | Recommendation / Action |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `NmX4ySVJ6NPHytFA6XLnY9GYoCg1` | `parthmobileindia@gmail.com` | Parth | `admin` | *(none)* | `true` | **YES** | `false` | **PRESERVE (MANDATORY ADMIN)** |
| `user_staff_1792925577356` | `staff@gmail.com` | Ramesh Patel | `staff` | *(none)* | `true` | **NO** | *(n/a)* | **PRESERVE (ACTIVE STAFF)** |
| `0pvoT5eSdLSUeu7tZEh5WMYJLQB3` | `chetanluhar65@gmail.com` | *(no doc)* | `staff` | `orphaned_auth` | `false` | **YES** | `true` | **RESET & DELETE (ORPHAN AUTH)** |
| `Ew2zdaJlhFd2OlBWA1nQxisQ6O92` | `chetanluharchetanluhar@gmail.com` | *(no doc)* | `staff` | `orphaned_auth` | `false` | **YES** | `true` | **RESET & DELETE (ORPHAN AUTH)** |
| `HC53UujKJJbSm3sPdk2jUXQrSRG2` | `iamtonystark879@gmail.com` | *(no doc)* | `staff` | `orphaned_auth` | `false` | **YES** | `true` | **RESET & DELETE (ORPHAN AUTH)** |
| `zg98aKNCRqcPNwkpBtiXKbXLYqR2` | `chetan.skillupahmedabad@gmail.com` | *(no doc)* | `staff` | `orphaned_auth` | `false` | **YES** | `true` | **RESET & DELETE (ORPHAN AUTH)** |

---

## 4. Analysis of Candidate Orphan Accounts

Notice the critical finding:
In Firestore `users/`, there are currently **0** profiles with `registrationStatus == "pending"` or `"rejected"`.

### Why are these 4 accounts Orphan Authentication accounts?
During earlier registration attempts on Android:
1. Staff signed up with their email and password in Step 1 (`createUserWithEmailAndPassword`). The Firebase Auth account was created.
2. The verification email was sent, and the user verified their email (`emailVerified: true`).
3. The user captured 3 of 3 face biometrics in Step 3.
4. When the user pressed "Submit Registration", the write to Firestore `users/{uid}` failed with **Permission Denied** due to the root causes identified in `STAFF_REGISTRATION_PERMISSION_ROOT_CAUSE_REPORT.md`.
5. Because the Firestore write failed, the Firestore profile was **never created**, leaving an orphan Firebase Authentication record.
6. When the staff member attempts to register again with their email address, Firebase Auth rejects it with:
   `auth/email-already-in-use: An account with this email already exists.`

### Reset Proposal
Deleting these 4 orphan Firebase Auth accounts will:
- Completely free the email addresses (`chetanluhar65@gmail.com`, `chetanluharchetanluhar@gmail.com`, `iamtonystark879@gmail.com`, and `chetan.skillupahmedabad@gmail.com`).
- Allow the staff members to complete fresh registrations through the updated and fixed registration flow.
- Maintain zero risk to existing store operations.

---

## 5. Next Steps & Approval Required

In accordance with the safety instructions, **no accounts have been deleted**.

When you approve this audit, run:
```bash
node scripts/cleanup_orphan_staff.mjs --execute
```
This will safely delete only the 4 orphan candidate accounts and log the result of each operation.

