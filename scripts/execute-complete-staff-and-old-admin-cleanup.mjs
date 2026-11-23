#!/usr/bin/env node
/**
 * Parth Mobile Care — Complete Staff & Old Admin Permanent Cleanup Script
 *
 * Project ID: parthmobilecare-a474d
 *
 * HARD GUARDS:
 * 1. Primary Admin (parthmobilecare07@gmail.com / 8X4u2Tidn4RSdnQA4dAKt41Ji7a2) is STRICTLY PROTECTED.
 * 2. Unrelated business collections (leads, mobile_prices, second_hand_purchases, shop_config, etc.) are NEVER touched.
 * 3. A full local JSON backup is generated prior to any deletion.
 */

import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';

const PROJECT_ID = 'parthmobilecare-a474d';
const PROTECTED_ADMIN_EMAIL = 'parthmobilecare07@gmail.com';
const PROTECTED_ADMIN_UID = '8X4u2Tidn4RSdnQA4dAKt41Ji7a2';
const BACKUP_PATH = '/Users/chetan/.gemini/antigravity/brain/1e8db0dc-5b10-434a-9582-7599c3da8ee8/scratch/staff_and_old_admin_cleanup_backup.json';

function getCliAccessToken() {
  const configPath = `${os.homedir()}/.config/configstore/firebase-tools.json`;
  if (!fs.existsSync(configPath)) {
    throw new Error(`Firebase CLI config not found at ${configPath}.`);
  }
  const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const token = cfg.tokens?.access_token;
  if (!token) {
    throw new Error('No access token found in firebase-tools.json.');
  }
  return token;
}

function httpsRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data), raw: data });
        } catch {
          resolve({ statusCode: res.statusCode, data: null, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

// 1. Download all Firebase Auth accounts
async function downloadAllAuthAccounts(token) {
  const res = await httpsRequest(
    {
      hostname: 'www.googleapis.com',
      path: '/identitytoolkit/v3/relyingparty/downloadAccount',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    { targetProjectId: PROJECT_ID, maxResults: 1000 }
  );

  if (res.statusCode !== 200 || !res.data) {
    throw new Error(`Failed to download Auth accounts (${res.statusCode}): ${res.raw}`);
  }

  return res.data.users || [];
}

// 2. Fetch all Firestore users
async function fetchAllFirestoreUsers(token) {
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.statusCode !== 200 || !res.data) {
    throw new Error(`Failed to fetch Firestore users (${res.statusCode}): ${res.raw}`);
  }

  return (res.data.documents || []).map((doc) => {
    const uid = doc.name.split('/').pop();
    const f = doc.fields || {};
    return {
      docName: doc.name,
      uid,
      name: f.name?.stringValue || f.displayName?.stringValue,
      email: f.email?.stringValue,
      role: f.role?.stringValue,
      isActive: f.isActive?.booleanValue,
      rawFields: f,
    };
  });
}

// 3. Fetch all device change requests
async function fetchDeviceChangeRequests(token) {
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/device_change_requests`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.statusCode !== 200 || !res.data) {
    return [];
  }

  return res.data.documents || [];
}

// 4. Delete Firebase Auth user
async function deleteAuthUser(token, uid) {
  if (uid === PROTECTED_ADMIN_UID) {
    throw new Error(`CRITICAL SECURITY ABORT: Attempted to delete protected admin UID: ${uid}`);
  }

  const res = await httpsRequest(
    {
      hostname: 'www.googleapis.com',
      path: '/identitytoolkit/v3/relyingparty/deleteAccount',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    { targetProjectId: PROJECT_ID, localId: uid }
  );

  if (res.statusCode !== 200) {
    throw new Error(`Failed to delete Auth account ${uid} (${res.statusCode}): ${res.raw}`);
  }

  return true;
}

// 5. Delete Firestore document by full document path
async function deleteFirestoreDoc(token, fullDocPath) {
  if (fullDocPath.includes(PROTECTED_ADMIN_UID)) {
    throw new Error(`CRITICAL SECURITY ABORT: Attempted to delete protected admin doc: ${fullDocPath}`);
  }

  const res = await httpsRequest(
    {
      hostname: 'firestore.googleapis.com',
      path: `/v1/${fullDocPath}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (res.statusCode !== 200) {
    throw new Error(`Failed to delete Firestore document ${fullDocPath} (${res.statusCode}): ${res.raw}`);
  }

  return true;
}

async function main() {
  console.log('================================================================');
  console.log('PARTH MOBILE CARE — COMPLETE STAFF & OLD ADMIN CLEANUP');
  console.log('Project: ' + PROJECT_ID);
  console.log('================================================================\n');

  const token = getCliAccessToken();

  // Phase 1: Pre-cleanup Inventory
  console.log('[Step 1/5] Gathering comprehensive pre-cleanup inventory...');
  const authUsers = await downloadAllAuthAccounts(token);
  const firestoreUsers = await fetchAllFirestoreUsers(token);
  const deviceChangeRequests = await fetchDeviceChangeRequests(token);

  console.log(` - Total Firebase Auth Accounts: ${authUsers.length}`);
  console.log(` - Total Firestore User Documents: ${firestoreUsers.length}`);
  console.log(` - Total Device Change Requests: ${deviceChangeRequests.length}\n`);

  // Phase 2: Verify Protected Admin
  console.log('[Step 2/5] Verifying Protected Primary Admin Account...');
  const protectedAuth = authUsers.find((u) => u.localId === PROTECTED_ADMIN_UID || u.email === PROTECTED_ADMIN_EMAIL);
  const protectedFirestore = firestoreUsers.find((u) => u.uid === PROTECTED_ADMIN_UID && u.email === PROTECTED_ADMIN_EMAIL);

  if (!protectedAuth) {
    throw new Error(`ABORT: Primary admin ${PROTECTED_ADMIN_EMAIL} (${PROTECTED_ADMIN_UID}) not found in Firebase Auth!`);
  }
  if (!protectedFirestore || protectedFirestore.role !== 'admin' || protectedFirestore.isActive !== true) {
    throw new Error(`ABORT: Primary admin Firestore profile is missing, inactive, or not admin!`);
  }

  console.log(`✓ Confirmed Primary Admin: ${protectedAuth.email} (UID: ${protectedAuth.localId})`);
  console.log(`✓ Confirmed Firestore Profile: role='${protectedFirestore.role}', isActive=${protectedFirestore.isActive}\n`);

  // Phase 3: Identify Target Deletion Accounts
  console.log('[Step 3/5] Identifying cleanup targets...');

  const authToDelete = authUsers.filter((u) => {
    return u.localId !== PROTECTED_ADMIN_UID && u.email !== PROTECTED_ADMIN_EMAIL;
  });

  const firestoreToDelete = firestoreUsers.filter((u) => {
    return u.uid !== PROTECTED_ADMIN_UID && u.email !== PROTECTED_ADMIN_EMAIL;
  });

  // Filter device_change_requests belonging to staff
  const staffUids = new Set(firestoreToDelete.map((u) => u.uid).concat(authToDelete.map((u) => u.localId)));
  const dcrToDelete = deviceChangeRequests.filter((dcr) => {
    return Array.from(staffUids).some((uid) => dcr.name.includes(uid));
  });

  console.log(` - Firebase Auth Accounts to Delete: ${authToDelete.length}`);
  authToDelete.forEach((u) => console.log(`   * Auth UID: ${u.localId} (${u.email || 'no email'})`));

  console.log(` - Firestore User Profiles to Delete: ${firestoreToDelete.length}`);
  firestoreToDelete.forEach((u) => console.log(`   * Firestore UID: ${u.uid} (${u.email || u.name}) [role: ${u.role}]`));

  console.log(` - Staff Device Change Requests to Delete: ${dcrToDelete.length}`);
  dcrToDelete.forEach((d) => console.log(`   * ${d.name.split('/').pop()}`));

  // Phase 4: Export Backup
  console.log(`\n[Step 4/5] Creating pre-deletion backup to ${BACKUP_PATH} ...`);
  const backupData = {
    timestamp: new Date().toISOString(),
    projectId: PROJECT_ID,
    protectedAdmin: {
      auth: protectedAuth,
      firestore: protectedFirestore,
    },
    targets: {
      authUsers: authToDelete,
      firestoreUsers: firestoreToDelete,
      deviceChangeRequests: dcrToDelete,
    },
  };
  fs.writeFileSync(BACKUP_PATH, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`✓ Backup successfully saved (${Buffer.byteLength(JSON.stringify(backupData))} bytes).\n`);

  // Phase 5: Execute Permanent Deletion
  console.log('[Step 5/5] Executing permanent deletion...');

  // 1. Delete Auth users
  console.log('\n--- 1. Deleting Firebase Authentication Accounts ---');
  let deletedAuthCount = 0;
  for (const u of authToDelete) {
    console.log(`Deleting Auth user: ${u.localId} (${u.email}) ...`);
    await deleteAuthUser(token, u.localId);
    deletedAuthCount++;
    console.log(`✓ Successfully deleted Auth user: ${u.localId}`);
  }

  // 2. Delete Firestore User Profiles
  console.log('\n--- 2. Deleting Firestore User Profiles ---');
  let deletedFirestoreCount = 0;
  for (const u of firestoreToDelete) {
    const fullPath = `projects/${PROJECT_ID}/databases/(default)/documents/users/${u.uid}`;
    console.log(`Deleting Firestore profile: users/${u.uid} (${u.email || u.name}) ...`);
    await deleteFirestoreDoc(token, fullPath);
    deletedFirestoreCount++;
    console.log(`✓ Successfully deleted Firestore user: ${u.uid}`);
  }

  // 3. Delete Staff Device Change Requests
  console.log('\n--- 3. Deleting Staff Device Change Requests ---');
  let deletedDcrCount = 0;
  for (const d of dcrToDelete) {
    console.log(`Deleting: ${d.name.split('/').pop()} ...`);
    await deleteFirestoreDoc(token, d.name);
    deletedDcrCount++;
    console.log(`✓ Deleted device change request`);
  }

  // Final Verification
  console.log('\n================================================================');
  console.log('RUNNING MANDATORY POST-CLEANUP VERIFICATION');
  console.log('================================================================');

  const finalAuth = await downloadAllAuthAccounts(token);
  const finalFirestore = await fetchAllFirestoreUsers(token);
  const finalDcr = await fetchDeviceChangeRequests(token);

  console.log(`\nFinal Firebase Auth Count: ${finalAuth.length}`);
  finalAuth.forEach((u) => console.log(` - UID: ${u.localId}, Email: ${u.email}, Disabled: ${u.disabled || false}`));

  console.log(`\nFinal Firestore Users Count: ${finalFirestore.length}`);
  finalFirestore.forEach((u) => console.log(` - UID: ${u.uid}, Email: ${u.email}, Role: ${u.role}, Active: ${u.isActive}`));

  console.log(`\nFinal Device Change Requests Count: ${finalDcr.length}`);

  const remainingStaffAuth = finalAuth.filter((u) => u.localId !== PROTECTED_ADMIN_UID);
  const remainingStaffFirestore = finalFirestore.filter((u) => u.uid !== PROTECTED_ADMIN_UID);

  if (remainingStaffAuth.length > 0 || remainingStaffFirestore.length > 0) {
    console.error('FAILED: Some staff accounts still remain!');
    process.exit(1);
  }

  if (finalAuth.length !== 1 || finalAuth[0].localId !== PROTECTED_ADMIN_UID) {
    console.error('FAILED: Expected exactly 1 Auth account (Primary Admin)!');
    process.exit(1);
  }

  if (finalFirestore.length !== 1 || finalFirestore[0].uid !== PROTECTED_ADMIN_UID || finalFirestore[0].role !== 'admin' || finalFirestore[0].isActive !== true) {
    console.error('FAILED: Primary admin Firestore profile is missing or invalid!');
    process.exit(1);
  }

  console.log('\n✓ ALL VERIFICATIONS PASSED: ZERO STAFF ACCOUNTS, ZERO OLD ADMIN ACCOUNTS.');
  console.log(`✓ PRIMARY ADMIN (${PROTECTED_ADMIN_EMAIL} / ${PROTECTED_ADMIN_UID}) IS THE SOLE REMAINING ACTIVE ACCOUNT.`);
}

main().catch((err) => {
  console.error('\nEXECUTION FAILED:', err);
  process.exit(1);
});
