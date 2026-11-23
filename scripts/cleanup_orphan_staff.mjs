#!/usr/bin/env node
/**
 * Parth Mobile Care — Approved Staff Orphan Auth Account Deletion Script
 * 
 * Safely deletes only the 4 authorized orphan Firebase Authentication accounts.
 * 
 * Target UIDs (Authorized by Administrator):
 *   1. 0pvoT5eSdLSUeu7tZEh5WMYJLQB3 — chetanluhar65@gmail.com
 *   2. Ew2zdaJlhFd2OlBWA1nQxisQ6O92 — chetanluharchetanluhar@gmail.com
 *   3. HC53UujKJJbSm3sPdk2jUXQrSRG2 — iamtonystark879@gmail.com
 *   4. zg98aKNCRqcPNwkpBtiXKbXLYqR2 — chetan.skillupahmedabad@gmail.com
 */

import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';

const REQUIRED_PROJECT_ID = 'parthmobilecare-a474d';
const isExecute = process.argv.includes('--execute');

const PROTECTED_ACCOUNTS = new Set([
  'NmX4ySVJ6NPHytFA6XLnY9GYoCg1', // Legacy Admin UID (for reference)
  'user_staff_1792925577356',     // Active Staff UID
  'parthmobilecare07@gmail.com',  // Primary Admin Email
  'staff@gmail.com',               // Active Staff Email
]);

const APPROVED_DELETION_TARGETS = new Map([
  ['0pvoT5eSdLSUeu7tZEh5WMYJLQB3', 'chetanluhar65@gmail.com'],
  ['Ew2zdaJlhFd2OlBWA1nQxisQ6O92', 'chetanluharchetanluhar@gmail.com'],
  ['HC53UujKJJbSm3sPdk2jUXQrSRG2', 'iamtonystark879@gmail.com'],
  ['zg98aKNCRqcPNwkpBtiXKbXLYqR2', 'chetan.skillupahmedabad@gmail.com'],
]);

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
          const parsed = data ? JSON.parse(data) : {};
          resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed, raw: data });
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

async function fetchAuthUsers(token) {
  const res = await httpsRequest({
    hostname: 'identitytoolkit.googleapis.com',
    path: `/v1/projects/${REQUIRED_PROJECT_ID}/accounts:batchGet?maxResults=100`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.statusCode !== 200) {
    throw new Error(`Failed to fetch Auth accounts (${res.statusCode}): ${res.raw}`);
  }

  return res.data.users || [];
}

async function fetchFirestoreUsers(token) {
  const res = await httpsRequest({
    hostname: 'firestore.googleapis.com',
    path: `/v1/projects/${REQUIRED_PROJECT_ID}/databases/(default)/documents/users`,
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.statusCode !== 200) {
    throw new Error(`Failed to fetch Firestore users (${res.statusCode}): ${res.raw}`);
  }

  return (res.data.documents || []).map((doc) => {
    const uid = doc.name.split('/').pop();
    const f = doc.fields || {};
    return {
      uid,
      name: f.name?.stringValue,
      email: f.email?.stringValue,
      role: f.role?.stringValue,
      isActive: f.isActive?.booleanValue,
    };
  });
}

async function deleteAuthUser(token, uid) {
  const res = await httpsRequest(
    {
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/projects/${REQUIRED_PROJECT_ID}/accounts:delete`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    { localId: uid }
  );

  return res.statusCode === 200;
}

async function lookupAuthUser(token, uid) {
  const res = await httpsRequest(
    {
      hostname: 'identitytoolkit.googleapis.com',
      path: `/v1/projects/${REQUIRED_PROJECT_ID}/accounts:lookup`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
    { localId: [uid] }
  );

  if (res.statusCode === 200 && res.data?.users && res.data.users.length > 0) {
    return res.data.users[0];
  }
  return null;
}

async function main() {
  console.log('='.repeat(90));
  console.log(`Parth Mobile Care — Approved Orphan Staff Auth Deletion`);
  console.log(`Execution Mode:  ${isExecute ? 'EXECUTE DELETION' : 'DRY RUN'}`);
  console.log(`Project ID:      ${REQUIRED_PROJECT_ID}`);
  console.log(`Timestamp:       ${new Date().toISOString()}`);
  console.log('='.repeat(90));

  if (!isExecute) {
    console.log('\n[DRY RUN] Use --execute to run the authorized deletions.');
    return;
  }

  const token = getCliAccessToken();

  // 1. Pre-execution verification
  console.log('\n[1/3] PRE-EXECUTION VERIFICATION...');
  const [authUsers, firestoreUsers] = await Promise.all([
    fetchAuthUsers(token),
    fetchFirestoreUsers(token),
  ]);

  const authMap = new Map(authUsers.map((u) => [u.localId, u]));
  const firestoreMap = new Map(firestoreUsers.map((u) => [u.uid, u]));

  // Verify Admin exists
  const adminDoc = firestoreMap.get('NmX4ySVJ6NPHytFA6XLnY9GYoCg1');
  if (!adminDoc || adminDoc.role !== 'admin' || !adminDoc.isActive) {
    throw new Error('FATAL: Admin account not found or in invalid state! Aborting.');
  }
  console.log(`  ✓ Store Admin account verified: ${adminDoc.uid} (${adminDoc.email})`);

  // Verify Active Staff exists
  const staffDoc = firestoreMap.get('user_staff_1792925577356');
  if (!staffDoc || staffDoc.role !== 'staff' || !staffDoc.isActive) {
    throw new Error('FATAL: Active staff account not found or in invalid state! Aborting.');
  }
  console.log(`  ✓ Active Staff account verified: ${staffDoc.uid} (${staffDoc.email})`);

  // Verify every candidate UID + Email pair in Auth
  for (const [targetUid, targetEmail] of APPROVED_DELETION_TARGETS.entries()) {
    const authAccount = authMap.get(targetUid);
    if (!authAccount) {
      throw new Error(`FATAL: Candidate UID ${targetUid} not found in Firebase Auth! Aborting.`);
    }
    if (authAccount.email.toLowerCase() !== targetEmail.toLowerCase()) {
      throw new Error(`FATAL: Candidate UID ${targetUid} email mismatch: expected ${targetEmail}, found ${authAccount.email}! Aborting.`);
    }
    if (firestoreMap.has(targetUid)) {
      throw new Error(`FATAL: Candidate UID ${targetUid} has an unexpected Firestore profile! Aborting.`);
    }
    if (PROTECTED_ACCOUNTS.has(targetUid) || PROTECTED_ACCOUNTS.has(targetEmail)) {
      throw new Error(`FATAL: Candidate UID ${targetUid} is in PROTECTED_ACCOUNTS! Aborting.`);
    }
    console.log(`  ✓ Target verified for deletion: ${targetUid} <${targetEmail}> (Confirmed Orphan)`);
  }

  // 2. Execution
  console.log('\n[2/3] EXECUTING DELETIONS OF 4 ORPHAN AUTH ACCOUNTS...');
  const executionResults = [];

  for (const [targetUid, targetEmail] of APPROVED_DELETION_TARGETS.entries()) {
    process.stdout.write(`  Deleting ${targetUid} (${targetEmail})... `);
    try {
      const deleted = await deleteAuthUser(token, targetUid);
      if (deleted) {
        console.log('SUCCESS');
        executionResults.push({ uid: targetUid, email: targetEmail, status: 'DELETED' });
      } else {
        console.log('FAILED');
        executionResults.push({ uid: targetUid, email: targetEmail, status: 'FAILED' });
      }
    } catch (err) {
      console.log(`ERROR: ${err.message}`);
      executionResults.push({ uid: targetUid, email: targetEmail, status: 'ERROR', error: err.message });
    }
  }

  // 3. Post-execution verification
  console.log('\n[3/3] POST-EXECUTION VERIFICATION (LOOKUP VIA IDENTITY TOOLKIT)...');
  const verificationResults = [];

  for (const [targetUid, targetEmail] of APPROVED_DELETION_TARGETS.entries()) {
    const account = await lookupAuthUser(token, targetUid);
    const stillExists = account !== null;
    const verifiedDeleted = !stillExists;

    console.log(`  UID: ${targetUid} <${targetEmail}> -> ${verifiedDeleted ? 'CONFIRMED ABSENT (DELETED)' : 'WARNING: ACCOUNT STILL EXISTS!'}`);

    verificationResults.push({
      uid: targetUid,
      email: targetEmail,
      deletedSuccessfully: verifiedDeleted,
      accountStillExists: stillExists,
    });
  }

  // Confirm Admin still intact
  const postAdminAuth = await lookupAuthUser(token, 'NmX4ySVJ6NPHytFA6XLnY9GYoCg1');
  console.log(`\n  ✓ Admin account integrity check: ${postAdminAuth ? 'INTACT & ACTIVE' : 'FATAL: ADMIN MISSING'}`);

  console.log('\n' + '='.repeat(90));
  console.log(`FINAL DELETION SUMMARY:`);
  console.log(`  Targeted:            4`);
  console.log(`  Confirmed Deleted:   ${verificationResults.filter(r => r.deletedSuccessfully).length}`);
  console.log(`  Still Existing:      ${verificationResults.filter(r => r.accountStillExists).length}`);
  console.log('='.repeat(90) + '\n');

  return { executionResults, verificationResults };
}

main().catch((err) => {
  console.error('\n[FATAL ERROR]:', err);
  process.exit(1);
});
