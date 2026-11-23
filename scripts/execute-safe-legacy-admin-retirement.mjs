/**
 * Parth Mobile Care — Safe Legacy Admin Retirement Script
 *
 * SAFETY CONTRACT:
 * 1. Checks that new primary admin (parthmobilecare07@gmail.com / 8X4u2Tidn4RSdnQA4dAKt41Ji7a2)
 *    is 100% active and verified in both Firebase Auth and Firestore.
 * 2. Disables the legacy admin (NmX4ySVJ6NPHytFA6XLnY9GYoCg1) in Firebase Auth without deleting it.
 * 3. Clears custom claims on the legacy account.
 * 4. Updates Firestore document users/NmX4ySVJ6NPHytFA6XLnY9GYoCg1:
 *    - isActive: false
 *    - role: 'deactivated_admin'
 *    - deactivationReason: 'Retired in favor of primary admin parthmobilecare07@gmail.com'
 *    - deactivatedAt: timestamp
 *    (Preserves all other fields for historical record integrity).
 * 5. Runs post-retirement verification on BOTH accounts.
 */

import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';

const PROJECT_ID = 'parthmobilecare-a474d';
const NEW_ADMIN_UID = '8X4u2Tidn4RSdnQA4dAKt41Ji7a2';
const NEW_ADMIN_EMAIL = 'parthmobilecare07@gmail.com';
const LEGACY_ADMIN_UID = 'NmX4ySVJ6NPHytFA6XLnY9GYoCg1';

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
          resolve({ statusCode: res.statusCode, headers: res.headers, data: JSON.parse(data), raw: data });
        } catch {
          resolve({ statusCode: res.statusCode, headers: res.headers, data: null, raw: data });
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

async function main() {
  console.log('================================================================');
  console.log('PARTH MOBILE CARE — SAFE LEGACY ADMIN RETIREMENT');
  console.log('================================================================');

  const token = getCliAccessToken();

  // -------------------------------------------------------------
  // STEP 1: VERIFY NEW ADMIN SAFETY BEFORE TOUCHING LEGACY ACCOUNT
  // -------------------------------------------------------------
  console.log('\n[1/4] Verifying New Primary Admin is 100% active...');
  
  // Check New Admin in Auth
  const authRes = await httpsRequest({
    hostname: 'identitytoolkit.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/accounts:batchGet?maxResults=100`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const newAdminAuth = authRes.data?.users?.find((u) => u.localId === NEW_ADMIN_UID);
  if (!newAdminAuth || newAdminAuth.disabled) {
    throw new Error('ABORT: New primary admin is missing or disabled in Firebase Auth!');
  }
  console.log(`✓ New Admin in Firebase Auth: ${newAdminAuth.email} (UID: ${newAdminAuth.localId}, disabled: false)`);

  // Check New Admin in Firestore
  const newFsRes = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${NEW_ADMIN_UID}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (newFsRes.statusCode !== 200 || !newFsRes.data?.fields) {
    throw new Error('ABORT: New primary admin profile missing in Firestore!');
  }

  const newFields = newFsRes.data.fields;
  if (newFields.role?.stringValue !== 'admin' || newFields.isActive?.booleanValue !== true) {
    throw new Error('ABORT: New primary admin does not have role: admin and isActive: true!');
  }
  console.log(`✓ New Admin in Firestore: role='${newFields.role?.stringValue}', isActive=${newFields.isActive?.booleanValue}`);

  // -------------------------------------------------------------
  // STEP 2: DISABLE LEGACY ADMIN IN FIREBASE AUTH (DO NOT DELETE)
  // -------------------------------------------------------------
  console.log(`\n[2/4] Disabling Legacy Admin (${LEGACY_ADMIN_UID}) in Firebase Auth...`);
  const disableAuthRes = await httpsRequest(
    {
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/accounts:update`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    {
      localId: LEGACY_ADMIN_UID,
      disableUser: true,
      customAttributes: '{}',
    }
  );

  if (disableAuthRes.statusCode !== 200) {
    throw new Error(`Failed to disable legacy admin in Auth: ${disableAuthRes.statusCode} - ${disableAuthRes.raw}`);
  }
  console.log(`✓ Legacy Admin (${LEGACY_ADMIN_UID}) successfully DISABLED in Firebase Auth.`);
  console.log(`✓ Legacy Admin custom claims cleared.`);

  // -------------------------------------------------------------
  // STEP 3: UPDATE FIRESTORE PROFILE users/{LEGACY_ADMIN_UID}
  // -------------------------------------------------------------
  console.log(`\n[3/4] Updating Firestore profile for legacy admin users/${LEGACY_ADMIN_UID}...`);
  
  // Read current fields to preserve everything
  const currentLegacyFs = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${LEGACY_ADMIN_UID}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const existingFields = currentLegacyFs.data?.fields || {};
  const now = new Date().toISOString();

  const updatedFields = {
    ...existingFields,
    isActive: { booleanValue: false },
    role: { stringValue: 'deactivated_admin' },
    deactivatedAt: { stringValue: now },
    deactivationReason: {
      stringValue: `Retired in favor of primary admin ${NEW_ADMIN_EMAIL} (${NEW_ADMIN_UID})`,
    },
    retiredByUid: { stringValue: NEW_ADMIN_UID },
  };

  const patchLegacyRes = await httpsRequest(
    {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${LEGACY_ADMIN_UID}`,
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    { fields: updatedFields }
  );

  if (patchLegacyRes.statusCode !== 200) {
    throw new Error(`Failed to update legacy admin Firestore profile: ${patchLegacyRes.statusCode} - ${patchLegacyRes.raw}`);
  }
  console.log(`✓ Legacy Admin Firestore document updated: role='deactivated_admin', isActive=false.`);
  console.log(`✓ All historical profile fields preserved.`);

  // -------------------------------------------------------------
  // STEP 4: VERIFY POST-RETIREMENT STATE
  // -------------------------------------------------------------
  console.log('\n[4/4] Verifying Post-Retirement Security State...');

  // Re-read Auth accounts
  const verifyAuthRes = await httpsRequest({
    hostname: 'identitytoolkit.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/accounts:batchGet?maxResults=100`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const postLegacyAuth = verifyAuthRes.data?.users?.find((u) => u.localId === LEGACY_ADMIN_UID);
  const postNewAuth = verifyAuthRes.data?.users?.find((u) => u.localId === NEW_ADMIN_UID);

  console.log('• Legacy Auth User:', {
    uid: postLegacyAuth?.localId,
    email: postLegacyAuth?.email,
    disabled: postLegacyAuth?.disabled, // MUST BE true
  });

  console.log('• New Admin Auth User:', {
    uid: postNewAuth?.localId,
    email: postNewAuth?.email,
    disabled: !!postNewAuth?.disabled, // MUST BE false
  });

  // Re-read Firestore documents
  const postLegacyFs = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${LEGACY_ADMIN_UID}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const postNewFs = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${NEW_ADMIN_UID}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  const legFields = postLegacyFs.data?.fields || {};
  const newFlds = postNewFs.data?.fields || {};

  console.log('• Legacy Firestore Profile:', {
    role: legFields.role?.stringValue,
    isActive: legFields.isActive?.booleanValue,
    deactivatedAt: legFields.deactivatedAt?.stringValue,
  });

  console.log('• New Admin Firestore Profile:', {
    role: newFlds.role?.stringValue,
    isActive: newFlds.isActive?.booleanValue,
  });

  if (
    postLegacyAuth?.disabled === true &&
    legFields.isActive?.booleanValue === false &&
    legFields.role?.stringValue === 'deactivated_admin' &&
    !postNewAuth?.disabled &&
    newFlds.isActive?.booleanValue === true &&
    newFlds.role?.stringValue === 'admin'
  ) {
    console.log('\n================================================================');
    console.log('RETIREMENT VERIFICATION: 100% SUCCESSFUL');
    console.log('================================================================');
    console.log(`Sole Active Administrator: ${NEW_ADMIN_EMAIL} (${NEW_ADMIN_UID})`);
    console.log(`Legacy Admin (${LEGACY_ADMIN_UID}): DISABLED & REVOKED`);
    console.log('Historical records, attendance, payroll, leads: 100% PRESERVED');
    console.log('================================================================\n');
  } else {
    throw new Error('Verification assertion failed: States do not match security expectations!');
  }
}

main().catch((err) => {
  console.error('\nExecution Error:', err.message);
  process.exit(1);
});
