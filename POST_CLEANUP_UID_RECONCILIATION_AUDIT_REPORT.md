# Parth Mobile Care — Post-Cleanup UID Reconciliation Audit Report

**Date:** November 22, 2026  
**Firebase Project:** `parthmobilecare-a474d`  
**Audit Scope:** Read-Only Identity Mapping Reconciliation, Pre-Deletion Evidence Analysis & Residual Scan  

---

## 1. Executive Summary

A comprehensive post-cleanup read-only reconciliation audit was conducted to investigate the identity-mapping inconsistencies noted in the deletion report.

By cross-referencing the pre-deletion backup archive ([staff_and_old_admin_cleanup_backup.json](file:///Users/chetan/.gemini/antigravity/brain/1e8db0dc-5b10-434a-9582-7599c3da8ee8/scratch/staff_and_old_admin_cleanup_backup.json)), earlier project audit logs, and live Firebase Authentication and Firestore state queries:

1. **UID Mismatch Explained:** Auth UID `JszID7MNW2NV5yBonEbZxzKwxMJ3` and Firestore document `users/user_staff_1792925577356` did **not** share an account relationship. They were two separate orphan entities:
   - `JszID7MNW2NV5yBonEbZxzKwxMJ3` was an **orphan Auth account** (`firewreckm9irbrsl@gmail.com`) created during automated test registration without a Firestore document.
   - `user_staff_1792925577356` was an **orphan Firestore staff document** (`staff@gmail.com`, Ramesh Patel) created with a timestamp ID pattern on 2026-10-25 without an Auth account.
   Both were identified and permanently deleted.
2. **Previous Admin Email Mismatch Explained:** The previous Admin Auth email (`parthpatel@example.com`) and Firestore email (`parthmobileindia@gmail.com`) belonged to the **exact same UID (`NmX4ySVJ6NPHytFA6XLnY9GYoCg1`)**. The discrepancy stemmed from initial project scaffolding where a dummy Auth email was created while the operational store email was entered in Firestore. Both were permanently deleted.
3. **Current Admin Confirmed:** The primary production admin `parthmobilecare07@gmail.com` (UID: `8X4u2Tidn4RSdnQA4dAKt41Ji7a2`) is 100% active, verified, not disabled, and holds `role: 'admin'` and `isActive: true`. It is the **sole remaining account** in both Firebase Auth and Firestore.
4. **Residual Audit:** Exactly 0 staff Auth accounts, 0 staff Firestore profiles, 0 previous Admin accounts, and 0 staff device change requests remain.

---

## 2. Complete Auth UID-to-Firestore Profile Mapping of Deleted Accounts

| # | Entity Description | Firebase Auth UID | Auth Email | Firestore Doc Path | Firestore Email | Internal `id` Field | Relationship Nature | Deletion Status |
| :-: | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :---: |
| **1** | **Previous Admin Account** | `NmX4ySVJ6NPHytFA6XLnY9GYoCg1` | `parthpatel@example.com` | `users/NmX4ySVJ6NPHytFA6XLnY9GYoCg1` | `parthmobileindia@gmail.com` | `NmX4ySVJ6NPHytFA6XLnY9GYoCg1` | **Matched 1:1 by UID** | **Deleted** (Auth & Firestore) |
| **2** | **Registered Staff (Chetan)** | `pLQ1C2qPcnbkr6NWJeB2LMHmtCy2` | `chetanluhar65@gmail.com` | `users/pLQ1C2qPcnbkr6NWJeB2LMHmtCy2` | `chetanluhar65@gmail.com` | `pLQ1C2qPcnbkr6NWJeB2LMHmtCy2` | **Matched 1:1 by UID & Email** | **Deleted** (Auth & Firestore) |
| **3** | **Orphan Test Staff (Auth Only)** | `JszID7MNW2NV5yBonEbZxzKwxMJ3` | `firewreckm9irbrsl@gmail.com` | *(None - 404)* | *(None)* | *(None)* | **Orphan Auth User** | **Deleted** (Auth Only) |
| **4** | **Legacy Seed Staff (Firestore Only)**| *(None)* | *(None)* | `users/user_staff_1792925577356` | `staff@gmail.com` | `user_staff_1792925577356` | **Orphan Firestore Doc** | **Deleted** (Firestore Only) |

---

## 3. Investigation of Inconsistencies

### Inconsistency 1: Deleted Auth UID `JszID7MNW2NV5yBonEbZxzKwxMJ3` vs Firestore `user_staff_1792925577356`

#### Evidence from Pre-Deletion Backup & History:
1. **Auth Record `JszID7MNW2NV5yBonEbZxzKwxMJ3`:**
   - Email: `firewreckm9irbrsl@gmail.com`
   - Created At: `1795347863375` (2026-11-22T11:44:23.375Z — created earlier today during test registration probing).
   - An explicit probe to `https://firestore.googleapis.com/.../users/JszID7MNW2NV5yBonEbZxzKwxMJ3` returned **HTTP 404 Not Found**.
   - **Conclusion:** It was an orphan Firebase Authentication account with zero corresponding Firestore data.
2. **Firestore Record `user_staff_1792925577356`:**
   - Name: `Ramesh Patel`
   - Email: `staff@gmail.com`
   - Role: `staff`
   - Internal `id` Field: `"id": "user_staff_1792925577356"`
   - Joined Date: `2026-10-25`
   - Historical Audit Confirmation: In [STAFF_REGISTRATION_CLEANUP_AUDIT.md](file:///Users/chetan/ParthMobileCare/STAFF_REGISTRATION_CLEANUP_AUDIT.md#L45), `user_staff_1792925577356` was explicitly audited and documented as having Auth UID: `*(none)*`.
   - **Conclusion:** This was a synthetic mock staff document created directly in Firestore on 2026-10-25 using a timestamped ID (`user_staff_${Date.now()}`) without an Auth user.
3. **Reconciliation:**
   In the previous cleanup summary, listing 3 deleted Auth accounts alongside 3 deleted Firestore documents created the appearance of a 1:1 pair between `JszID7MNW2NV5yBonEbZxzKwxMJ3` and `user_staff_1792925577356`. In reality, both were independent orphan accounts (one Auth-only, one Firestore-only) that were correctly identified and deleted.

---

### Inconsistency 2: Previous Admin Email Mismatch (`parthpatel@example.com` vs `parthmobileindia@gmail.com`)

#### Evidence from Pre-Deletion Backup & History:
1. **Shared UID Invariant:**
   - Auth UID: `NmX4ySVJ6NPHytFA6XLnY9GYoCg1`
   - Firestore Document Path: `users/NmX4ySVJ6NPHytFA6XLnY9GYoCg1`
   - Firestore internal field `id`: `NmX4ySVJ6NPHytFA6XLnY9GYoCg1`
   - Both records undeniably belonged to the same historical administrator account.
2. **Why the Emails Differed:**
   - In early project development, the legacy administrator account was provisioned in Firebase Auth using dummy credentials (`parthpatel@example.com`), as recorded in [STAFF_MOBILE_ADMIN_REMOVAL_REPORT.md](file:///Users/chetan/ParthMobileCare/STAFF_MOBILE_ADMIN_REMOVAL_REPORT.md#L94).
   - In Firestore, the administrator's profile was created with the store's real business contact email: `parthmobileindia@gmail.com` (and phone `9824018382`).
   - Because Firebase Auth and Firestore maintain separate email fields that do not synchronize automatically, the two values remained divergent.
   - On 2026-11-21, this account was retired (`role: 'deactivated_admin'`, `isActive: false`) in favor of `parthmobilecare07@gmail.com`.
   - In the cleanup, both the Auth account and the Firestore document for UID `NmX4ySVJ6NPHytFA6XLnY9GYoCg1` were permanently deleted.

---

## 4. Current Primary Admin Verification (Live Query)

A direct, read-only query executed against Firebase Authentication and Firestore confirms the exact state of the primary Administrator:

### Firebase Authentication State:
```json
{
  "localId": "8X4u2Tidn4RSdnQA4dAKt41Ji7a2",
  "email": "parthmobilecare07@gmail.com",
  "emailVerified": true,
  "disabled": false,
  "createdAt": "1795237995915",
  "lastLoginAt": "1795346298920"
}
```

### Firestore Profile State (`users/8X4u2Tidn4RSdnQA4dAKt41Ji7a2`):
```json
{
  "id": "8X4u2Tidn4RSdnQA4dAKt41Ji7a2",
  "name": "Parth Patel",
  "email": "parthmobilecare07@gmail.com",
  "phone": "9824018382",
  "role": "admin",
  "isActive": true
}
```

**Status:** **100% PRESERVED, ACTIVE, AND UNTOUCHED.**

---

## 5. Full Read-Only Residual Audit Findings

A live scan across all collections in the Firebase project `parthmobilecare-a474d` confirmed:

| Resource Scope | Remaining Count | Remaining Identifiers | Verification Result |
| :--- | :---: | :--- | :---: |
| **Total Firebase Auth Accounts** | **`1`** | `8X4u2Tidn4RSdnQA4dAKt41Ji7a2` (`parthmobilecare07@gmail.com`) | **Zero Staff / Zero Old Admin** |
| **Total Firestore `users` Documents** | **`1`** | `users/8X4u2Tidn4RSdnQA4dAKt41Ji7a2` (`role: 'admin'`, `isActive: true`) | **Zero Staff / Zero Old Admin** |
| **`device_change_requests`** | **`0`** | None | **Clean** |
| **User Subcollections** | **`0`** | `users/8X4u2Tidn4RSdnQA4dAKt41Ji7a2` has zero subcollections | **Clean** |
| **Face Templates / Biometric Tables** | **`0`** | No root biometric collections exist | **Clean** |
| **Staff Invitations / Tokens** | **`0`** | No active staff token collections exist | **Clean** |
| **Shared Business Data Collections** | **`100% Intact`** | `leads`, `mobile_prices`, `second_hand_purchases`, `second_hand_sales`, `shop_config`, `audit_logs`, `notifications`, `sales_targets`, `salary_slips` | **Preserved** |

---

## 6. Discrepancy Resolution & Final Sign-Off

- **UID Mismatch:** Fully resolved and explained. Auth `JszID7MNW2NV5yBonEbZxzKwxMJ3` was orphan Auth-only; Firestore `user_staff_1792925577356` was orphan Firestore-only. Both have been removed.
- **Previous Admin Email Mismatch:** Fully resolved and explained. Both belonged to UID `NmX4ySVJ6NPHytFA6XLnY9GYoCg1`. Both have been removed.
- **Residual Accounts:** Confirmed zero remaining staff and zero remaining old admin accounts.
- **Current Admin:** Confirmed active, functional, and verified.
- **Unresolved Discrepancies:** **NONE**.
