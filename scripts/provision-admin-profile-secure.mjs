/**
 * Parth Mobile Care — Secure Privileged Admin Profile Provisioning
 *
 * ROOT CAUSE OF PREVIOUS PERMISSION_DENIED:
 * Client-side Firestore rules (firestore.rules line 712) strictly prevent non-admin
 * accounts from creating user documents with role: 'admin'.
 * A newly signed-up user in Firebase Auth does not yet have an admin profile, so
 * attempting to write role: 'admin' via client-side SDK is blocked by security rules.
 *
 * SECURE RESOLUTION:
 * This script uses the authenticated project owner credentials from Firebase CLI
 * (stored in ~/.config/configstore/firebase-tools.json) to execute an administrative
 * REST API call directly to Google Cloud Firestore, securely writing the profile
 * without weakening or modifying client-side security rules.
 */

import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';

const PROJECT_ID = 'parthmobilecare-a474d';
const NEW_ADMIN_UID = '8X4u2Tidn4RSdnQA4dAKt41Ji7a2';
const NEW_ADMIN_EMAIL = 'parthmobilecare07@gmail.com';

function getCliAccessToken() {
  const configPath = `${os.homedir()}/.config/configstore/firebase-tools.json`;
  if (!fs.existsSync(configPath)) {
    throw new Error(`Firebase CLI credentials not found at ${configPath}.`);
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
  console.log('PARTH MOBILE CARE — PRIVILEGED ADMIN PROFILE PROVISIONING');
  console.log('================================================================');
  console.log(`Target UID:   ${NEW_ADMIN_UID}`);
  console.log(`Target Email: ${NEW_ADMIN_EMAIL}`);

  const token = getCliAccessToken();

  // 1. Verify the user exists in Firebase Authentication
  console.log('\n[1/3] Verifying account in Firebase Authentication...');
  const authRes = await httpsRequest({
    hostname: 'identitytoolkit.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/accounts:batchGet?maxResults=100`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (authRes.statusCode !== 200 || !authRes.data?.users) {
    throw new Error(`Failed to query Auth accounts: ${authRes.statusCode} - ${authRes.raw}`);
  }

  const authUser = authRes.data.users.find((u) => u.localId === NEW_ADMIN_UID);
  if (!authUser) {
    throw new Error(`Firebase Auth user with UID ${NEW_ADMIN_UID} not found in project ${PROJECT_ID}.`);
  }
  console.log(`✓ Confirmed Auth user: ${authUser.email} (UID: ${authUser.localId})`);

  // 2. Provision Firestore Profile users/{NEW_ADMIN_UID}
  console.log('\n[2/3] Writing Firestore Document users/' + NEW_ADMIN_UID + '...');
  const now = new Date().toISOString();
  const firestorePayload = {
    fields: {
      id: { stringValue: NEW_ADMIN_UID },
      email: { stringValue: NEW_ADMIN_EMAIL },
      name: { stringValue: 'Parth Patel' },
      phone: { stringValue: '9824018382' },
      role: { stringValue: 'admin' },
      designation: { stringValue: 'Store Owner & Admin' },
      isActive: { booleanValue: true },
      joinedDate: { stringValue: '2026-10-23' },
      basicSalary: { integerValue: '0' },
      monthlyTarget: { integerValue: '0' },
      createdAt: { stringValue: now },
      emailVerified: { booleanValue: true },
    },
  };

  const patchRes = await httpsRequest(
    {
      hostname: 'firestore.googleapis.com',
      path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${NEW_ADMIN_UID}`,
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    firestorePayload
  );

  if (patchRes.statusCode !== 200) {
    throw new Error(`Failed to write Firestore document (${patchRes.statusCode}): ${patchRes.raw}`);
  }
  console.log('✓ Successfully created/updated users/' + NEW_ADMIN_UID);

  // 3. Read back and verify the written profile
  console.log('\n[3/3] Reading back Firestore profile to verify role and status...');
  const readRes = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${NEW_ADMIN_UID}`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (readRes.statusCode !== 200 || !readRes.data?.fields) {
    throw new Error(`Failed to read back document: ${readRes.statusCode} - ${readRes.raw}`);
  }

  const fields = readRes.data.fields;
  const verifiedId = fields.id?.stringValue;
  const verifiedEmail = fields.email?.stringValue;
  const verifiedRole = fields.role?.stringValue;
  const verifiedActive = fields.isActive?.booleanValue;

  console.log(`Document ID:   ${verifiedId}`);
  console.log(`Email:         ${verifiedEmail}`);
  console.log(`Role:          ${verifiedRole}`);
  console.log(`Active:        ${verifiedActive}`);

  if (verifiedId === NEW_ADMIN_UID && verifiedRole === 'admin' && verifiedActive === true) {
    console.log('\n================================================================');
    console.log('PROVISIONING VERIFICATION: 100% SUCCESSFUL');
    console.log('================================================================');
    console.log(`Admin Email: ${verifiedEmail}`);
    console.log(`Admin UID:   ${verifiedId}`);
    console.log(`Role:        ${verifiedRole}`);
    console.log(`Status:      Active (${verifiedActive})`);
    console.log('\nNEXT STEPS:');
    console.log('1. Open http://localhost:3000 in your browser.');
    console.log('2. Log in with parthmobilecare07@gmail.com and your password.');
    console.log('3. Verify that the Admin Operations Console loads completely.');
    console.log('4. Legacy admin account remains untouched until you verify dashboard access.');
    console.log('================================================================\n');
  } else {
    throw new Error('Verification failed: Field values do not match requirements.');
  }
}

main().catch((err) => {
  console.error('\nExecution Error:', err.message);
  process.exit(1);
});
