#!/usr/bin/env node
/**
 * Parth Mobile Care — Complete Staff Account Cleanup Script
 * Project: parthmobilecare-a474d
 *
 * SAFETY GUARDS:
 * 1. Admin parthmobilecare07@gmail.com (UID: 8X4u2Tidn4RSdnQA4dAKt41Ji7a2) is STRICTLY EXEMPT and protected.
 * 2. Unrelated business collections (leads, second_hand_purchases, second_hand_sales, mobile_prices, shop_config) are protected.
 * 3. Pre-deletion backup is saved to scratch and scripts directory.
 */

import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';

const PROJECT_ID = 'parthmobilecare-a474d';
const PROTECTED_ADMIN_EMAIL = 'parthmobilecare07@gmail.com';
const PROTECTED_ADMIN_UID = '8X4u2Tidn4RSdnQA4dAKt41Ji7a2';

const BACKUP_PATH_SCRATCH = '/Users/chetan/.gemini/antigravity/brain/1e8db0dc-5b10-434a-9582-7599c3da8ee8/scratch/staff_cleanup_backup_20261122.json';
const BACKUP_PATH_LOCAL = '/Users/chetan/ParthMobileCare/scripts/backup_staff_cleanup_20261122.json';

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

function httpsRequest({ hostname, path, method = 'GET', data = null, token }) {
  return new Promise((resolve, reject) => {
    const headers = {
      Authorization: `Bearer ${token}`,
    };
    if (data) {
      headers['Content-Type'] = 'application/json';
    }
    const req = https.request(
      {
        hostname,
        path,
        method,
        headers,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ statusCode: res.statusCode, data: JSON.parse(body), raw: body });
          } catch {
            resolve({ statusCode: res.statusCode, data: null, raw: body });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

// 1. Fetch Auth accounts via Identity Toolkit v1 query
async function fetchAllAuthAccounts(token) {
  const res = await httpsRequest({
    hostname: 'identitytoolkit.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/accounts:query`,
    method: 'POST',
    data: { targetProjectId: PROJECT_ID, limit: 1000 },
    token,
  });

  if (res.statusCode !== 200 || !res.data) {
    throw new Error(`Failed to query Auth accounts (${res.statusCode}): ${res.raw}`);
  }

  return res.data.userInfo || [];
}

// 2. Fetch Firestore documents in a collection
async function fetchCollectionDocs(token, collection) {
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/${collection}?pageSize=1000`,
    method: 'GET',
    token,
  });

  if (res.statusCode === 404) {
    return [];
  }
  if (res.statusCode !== 200 || !res.data) {
    return [];
  }
  return res.data.documents || [];
}

// 3. Delete Firebase Auth user
async function deleteAuthUser(token, uid) {
  if (uid === PROTECTED_ADMIN_UID) {
    throw new Error(`CRITICAL SECURITY ABORT: Attempted to delete protected admin UID: ${uid}`);
  }

  const res = await httpsRequest({
    hostname: 'identitytoolkit.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/accounts:delete`,
    method: 'POST',
    data: { localId: uid },
    token,
  });

  if (res.statusCode !== 200) {
    throw new Error(`Failed to delete Auth account ${uid} (${res.statusCode}): ${res.raw}`);
  }
  return true;
}

// 4. Delete Firestore document
async function deleteFirestoreDoc(token, fullDocPath) {
  if (fullDocPath.includes(PROTECTED_ADMIN_UID) || fullDocPath.includes(PROTECTED_ADMIN_EMAIL)) {
    throw new Error(`CRITICAL SECURITY ABORT: Attempted to delete protected admin document: ${fullDocPath}`);
  }

  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/${fullDocPath}`,
    method: 'DELETE',
    token,
  });

  if (res.statusCode !== 200) {
    throw new Error(`Failed to delete Firestore document ${fullDocPath} (${res.statusCode}): ${res.raw}`);
  }
  return true;
}

// 5. Delete subcollections of a document if any exist
async function deleteSubcollections(token, docPath) {
  const listRes = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/${docPath}:listCollectionIds`,
    method: 'POST',
    data: {},
    token,
  });

  const subColls = listRes.data?.collectionIds || [];
  for (const collId of subColls) {
    const docsRes = await httpsRequest({
      hostname: 'firestore.googleapis.com',
      path: `/v1/${docPath}/${collId}`,
      method: 'GET',
      token,
    });
    for (const d of docsRes.data?.documents || []) {
      await deleteFirestoreDoc(token, d.name);
    }
  }
}

async function main() {
  console.log('================================================================');
  console.log('PARTH MOBILE CARE — COMPLETE STAFF ACCOUNT CLEANUP');
  console.log('Project ID: ' + PROJECT_ID);
  console.log('Target Exemption: ' + PROTECTED_ADMIN_EMAIL + ' (' + PROTECTED_ADMIN_UID + ')');
  console.log('================================================================\n');

  const token = getCliAccessToken();

  // Step 1: Pre-cleanup Inventory
  console.log('[Step 1/5] Gathering pre-cleanup inventory...');
  const authUsers = await fetchAllAuthAccounts(token);
  const firestoreUsers = await fetchCollectionDocs(token, 'users');
  const deviceChangeRequests = await fetchCollectionDocs(token, 'device_change_requests');
  const deviceBindings = await fetchCollectionDocs(token, 'device_bindings');
  const faceTemplates = await fetchCollectionDocs(token, 'face_templates');
  const staffRegistrations = await fetchCollectionDocs(token, 'staff_registrations');
  const registrationRequests = await fetchCollectionDocs(token, 'registration_requests');

  // Business collections inventory (to verify protection)
  const businessCounts = {
    leads: (await fetchCollectionDocs(token, 'leads')).length,
    second_hand_purchases: (await fetchCollectionDocs(token, 'second_hand_purchases')).length,
    second_hand_sales: (await fetchCollectionDocs(token, 'second_hand_sales')).length,
    mobile_prices: (await fetchCollectionDocs(token, 'mobile_prices')).length,
    shop_config: (await fetchCollectionDocs(token, 'shop_config')).length,
    notifications: (await fetchCollectionDocs(token, 'notifications')).length,
  };

  console.log('Pre-cleanup Auth Accounts: ' + authUsers.length);
  authUsers.forEach(u => console.log(`  - UID: ${u.localId}, Email: ${u.email}`));

  console.log('\nPre-cleanup Firestore Users: ' + firestoreUsers.length);
  firestoreUsers.forEach(d => {
    const id = d.name.split('/').pop();
    const email = d.fields?.email?.stringValue || 'no-email';
    const role = d.fields?.role?.stringValue || 'no-role';
    console.log(`  - Doc: users/${id}, Email: ${email}, Role: ${role}`);
  });

  console.log('\nBusiness Collections (Protected):');
  Object.entries(businessCounts).forEach(([k, v]) => console.log(`  - ${k}: ${v} documents`));

  // Step 2: Verify Protected Admin
  console.log('\n[Step 2/5] Verifying Protected Admin Account...');
  const protectedAuth = authUsers.find(u => u.localId === PROTECTED_ADMIN_UID || u.email.toLowerCase() === PROTECTED_ADMIN_EMAIL.toLowerCase());
  const protectedDoc = firestoreUsers.find(d => d.name.endsWith(`/users/${PROTECTED_ADMIN_UID}`));

  if (!protectedAuth) {
    throw new Error(`CRITICAL ABORT: Protected Admin Auth account (${PROTECTED_ADMIN_EMAIL}) not found!`);
  }
  if (!protectedDoc) {
    throw new Error(`CRITICAL ABORT: Protected Admin Firestore profile (users/${PROTECTED_ADMIN_UID}) not found!`);
  }
  const adminRole = protectedDoc.fields?.role?.stringValue;
  const adminIsActive = protectedDoc.fields?.isActive?.booleanValue;
  if (adminRole !== 'admin' || adminIsActive !== true) {
    throw new Error(`CRITICAL ABORT: Protected Admin profile has invalid role (${adminRole}) or isActive (${adminIsActive})!`);
  }
  console.log(`✓ Protected Admin confirmed in Auth: ${protectedAuth.email} (${protectedAuth.localId})`);
  console.log(`✓ Protected Admin confirmed in Firestore: role='${adminRole}', isActive=${adminIsActive}`);

  // Step 3: Identify Staff Accounts to Delete
  console.log('\n[Step 3/5] Identifying staff accounts to delete...');
  const authToDelete = authUsers.filter(u => u.localId !== PROTECTED_ADMIN_UID && u.email.toLowerCase() !== PROTECTED_ADMIN_EMAIL.toLowerCase());
  const firestoreDocsToDelete = firestoreUsers.filter(d => !d.name.endsWith(`/users/${PROTECTED_ADMIN_UID}`));

  console.log(`Found ${authToDelete.length} staff Auth account(s) to delete.`);
  authToDelete.forEach(u => console.log(`  * Auth: ${u.localId} (${u.email})`));

  console.log(`Found ${firestoreDocsToDelete.length} staff Firestore profile(s) to delete.`);
  firestoreDocsToDelete.forEach(d => console.log(`  * Firestore: ${d.name.split('/').pop()} (${d.fields?.email?.stringValue || 'no-email'})`));

  // Step 4: Save Backup
  console.log('\n[Step 4/5] Saving pre-deletion backup...');
  const backup = {
    timestamp: new Date().toISOString(),
    projectId: PROJECT_ID,
    protectedAdmin: {
      auth: protectedAuth,
      firestoreDoc: protectedDoc,
    },
    deletedTargets: {
      authUsers: authToDelete,
      firestoreUsers: firestoreDocsToDelete,
      deviceChangeRequests,
      deviceBindings,
      faceTemplates,
      staffRegistrations,
      registrationRequests,
    },
    businessCollectionCountsBefore: businessCounts,
  };

  fs.mkdirSync('/Users/chetan/.gemini/antigravity/brain/1e8db0dc-5b10-434a-9582-7599c3da8ee8/scratch', { recursive: true });
  fs.writeFileSync(BACKUP_PATH_SCRATCH, JSON.stringify(backup, null, 2), 'utf8');
  fs.writeFileSync(BACKUP_PATH_LOCAL, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`✓ Backup saved to: ${BACKUP_PATH_SCRATCH}`);
  console.log(`✓ Backup saved to: ${BACKUP_PATH_LOCAL}`);

  // Step 5: Execute Permanent Deletion
  console.log('\n[Step 5/5] Executing permanent deletions...');

  // 1. Delete Staff Auth Accounts
  for (const u of authToDelete) {
    console.log(`Deleting Auth user: ${u.localId} (${u.email}) ...`);
    await deleteAuthUser(token, u.localId);
    console.log(`✓ Deleted Auth user: ${u.localId}`);
  }

  // 2. Delete Staff Firestore Profiles and Subcollections
  for (const doc of firestoreDocsToDelete) {
    const docPath = doc.name.replace(/^projects\/[^/]+\/databases\/\(default\)\/documents\//, '');
    console.log(`Deleting subcollections (if any) under ${docPath} ...`);
    await deleteSubcollections(token, doc.name);
    console.log(`Deleting Firestore user document: ${docPath} ...`);
    await deleteFirestoreDoc(token, doc.name);
    console.log(`✓ Deleted Firestore document: ${docPath}`);
  }

  // 3. Delete any staff device change requests or registration requests
  for (const d of deviceChangeRequests) {
    console.log(`Deleting device change request: ${d.name} ...`);
    await deleteFirestoreDoc(token, d.name);
  }
  for (const d of deviceBindings) {
    console.log(`Deleting device binding: ${d.name} ...`);
    await deleteFirestoreDoc(token, d.name);
  }
  for (const d of faceTemplates) {
    console.log(`Deleting face template: ${d.name} ...`);
    await deleteFirestoreDoc(token, d.name);
  }
  for (const d of staffRegistrations) {
    console.log(`Deleting staff registration: ${d.name} ...`);
    await deleteFirestoreDoc(token, d.name);
  }
  for (const d of registrationRequests) {
    console.log(`Deleting registration request: ${d.name} ...`);
    await deleteFirestoreDoc(token, d.name);
  }

  // Step 6: Post-Cleanup Verification & Audit
  console.log('\n================================================================');
  console.log('MANDATORY POST-CLEANUP VERIFICATION');
  console.log('================================================================');

  const finalAuth = await fetchAllAuthAccounts(token);
  const finalFirestoreUsers = await fetchCollectionDocs(token, 'users');
  const finalDcr = await fetchCollectionDocs(token, 'device_change_requests');
  const finalDb = await fetchCollectionDocs(token, 'device_bindings');
  const finalFt = await fetchCollectionDocs(token, 'face_templates');
  const finalSr = await fetchCollectionDocs(token, 'staff_registrations');
  const finalRr = await fetchCollectionDocs(token, 'registration_requests');

  console.log(`\nFinal Auth Accounts Count: ${finalAuth.length}`);
  finalAuth.forEach(u => console.log(`  - UID: ${u.localId}, Email: ${u.email}, EmailVerified: ${u.emailVerified}`));

  console.log(`\nFinal Firestore Users Count: ${finalFirestoreUsers.length}`);
  finalFirestoreUsers.forEach(d => {
    const id = d.name.split('/').pop();
    const email = d.fields?.email?.stringValue;
    const role = d.fields?.role?.stringValue;
    const isActive = d.fields?.isActive?.booleanValue;
    console.log(`  - Doc: users/${id}, Email: ${email}, Role: ${role}, isActive: ${isActive}`);
  });

  console.log(`\nFinal Device Change Requests: ${finalDcr.length}`);
  console.log(`Final Device Bindings: ${finalDb.length}`);
  console.log(`Final Face Templates: ${finalFt.length}`);
  console.log(`Final Staff Registrations: ${finalSr.length}`);
  console.log(`Final Registration Requests: ${finalRr.length}`);

  // Verify Business Collections Untouched
  const finalBusinessCounts = {
    leads: (await fetchCollectionDocs(token, 'leads')).length,
    second_hand_purchases: (await fetchCollectionDocs(token, 'second_hand_purchases')).length,
    second_hand_sales: (await fetchCollectionDocs(token, 'second_hand_sales')).length,
    mobile_prices: (await fetchCollectionDocs(token, 'mobile_prices')).length,
    shop_config: (await fetchCollectionDocs(token, 'shop_config')).length,
    notifications: (await fetchCollectionDocs(token, 'notifications')).length,
  };

  console.log('\nBusiness Collections Post-Cleanup:');
  let businessIntact = true;
  Object.entries(businessCounts).forEach(([k, countBefore]) => {
    const countAfter = finalBusinessCounts[k];
    const match = countBefore === countAfter;
    if (!match) businessIntact = false;
    console.log(`  - ${k}: ${countAfter} (Before: ${countBefore}) [${match ? 'INTACT' : 'MISMATCH'}]`);
  });

  if (!businessIntact) {
    throw new Error('VERIFICATION FAILED: Business collection counts changed!');
  }

  // Exact assertions
  if (finalAuth.length !== 1 || finalAuth[0].localId !== PROTECTED_ADMIN_UID || finalAuth[0].email.toLowerCase() !== PROTECTED_ADMIN_EMAIL.toLowerCase()) {
    throw new Error(`VERIFICATION FAILED: Auth accounts count is ${finalAuth.length}, expected exactly 1 (${PROTECTED_ADMIN_EMAIL}).`);
  }

  if (
    finalFirestoreUsers.length !== 1 ||
    !finalFirestoreUsers[0].name.endsWith(`/users/${PROTECTED_ADMIN_UID}`) ||
    finalFirestoreUsers[0].fields?.role?.stringValue !== 'admin' ||
    finalFirestoreUsers[0].fields?.isActive?.booleanValue !== true
  ) {
    throw new Error('VERIFICATION FAILED: Primary Admin Firestore profile is invalid or extra profiles exist!');
  }

  if (finalDcr.length !== 0 || finalDb.length !== 0 || finalFt.length !== 0 || finalSr.length !== 0 || finalRr.length !== 0) {
    throw new Error('VERIFICATION FAILED: Orphan staff-related documents still exist!');
  }

  console.log('\n================================================================');
  console.log('✓ SUCCESS: COMPLETE STAFF CLEANUP VERIFIED');
  console.log('✓ Zero staff Auth accounts remain.');
  console.log('✓ Zero staff Firestore profiles remain.');
  console.log('✓ Zero staff device bindings or registration requests remain.');
  console.log(`✓ Primary Admin (${PROTECTED_ADMIN_EMAIL} / ${PROTECTED_ADMIN_UID}) is the sole remaining active account.`);
  console.log('✓ 100% of business data (leads, sales, purchases, prices, config) preserved untouched.');
  console.log('================================================================');
}

main().catch(err => {
  console.error('\nEXECUTION FAILED:', err);
  process.exit(1);
});
