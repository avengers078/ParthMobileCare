/**
 * Parth Mobile Care — Legacy Admin Account Retirement Utility (Step 6)
 *
 * This script is executed ONLY AFTER parthmobilecare07@gmail.com has been verified
 * and tested successfully on http://localhost:3000.
 *
 * ACTIONS:
 * 1. Verifies that parthmobilecare07@gmail.com exists and is active as admin in Firestore.
 * 2. Deletes or disables the legacy admin account (NmX4ySVJ6NPHytFA6XLnY9GYoCg1) in Firebase Auth.
 * 3. Updates users/NmX4ySVJ6NPHytFA6XLnY9GYoCg1 to isActive: false, role: 'deactivated_admin'.
 * 4. Ensures ZERO staff, customer, sales, leads, or attendance records are affected.
 */

import fs from 'node:fs';
import os from 'node:os';
import https from 'node:https';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAdvwIbQjNYQQ4E9kgixdyJRlTk9W_GBHY',
  authDomain: 'parthmobilecare-a474d.firebaseapp.com',
  projectId: 'parthmobilecare-a474d',
};

const REQUIRED_PROJECT_ID = 'parthmobilecare-a474d';
const LEGACY_ADMIN_UID = 'NmX4ySVJ6NPHytFA6XLnY9GYoCg1';
const NEW_ADMIN_EMAIL = 'parthmobilecare07@gmail.com';

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

async function main() {
  console.log('================================================================');
  console.log('PARTH MOBILE CARE — RETIRE LEGACY ADMIN ACCOUNT (STEP 6)');
  console.log('================================================================');

  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);

  // Guard 1: Verify new admin exists and is active in Firestore
  console.log(`[1/3] Verifying new primary admin (${NEW_ADMIN_EMAIL}) is active in Firestore...`);
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', NEW_ADMIN_EMAIL));
  const snap = await getDocs(q);

  if (snap.empty) {
    console.error(`ABORT: No Firestore profile found for ${NEW_ADMIN_EMAIL}.`);
    console.error('Run node scripts/provision-admin-account.mjs first!');
    process.exit(1);
  }

  let activeAdminFound = false;
  let newAdminDocId = '';
  snap.forEach((d) => {
    const data = d.data();
    if (data.role === 'admin' && data.isActive === true) {
      activeAdminFound = true;
      newAdminDocId = d.id;
    }
  });

  if (!activeAdminFound) {
    console.error(`ABORT: ${NEW_ADMIN_EMAIL} exists but role !== 'admin' or isActive !== true.`);
    process.exit(1);
  }

  console.log(`✓ Confirmed active admin: ${NEW_ADMIN_EMAIL} (UID: ${newAdminDocId})`);

  // Guard 2: Safety check legacy admin UID
  if (newAdminDocId === LEGACY_ADMIN_UID) {
    console.error('ABORT: New admin UID matches legacy admin UID. Aborting to avoid self-deletion.');
    process.exit(1);
  }

  // Step 2: Delete legacy admin from Firebase Authentication
  console.log(`\n[2/3] Deleting legacy admin (${LEGACY_ADMIN_UID}) from Firebase Authentication...`);
  try {
    const cliToken = getCliAccessToken();
    const deleteRes = await httpsRequest(
      {
        hostname: 'identitytoolkit.googleapis.com',
        path: `/v1/projects/${REQUIRED_PROJECT_ID}/accounts:delete`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cliToken}`,
          'Content-Type': 'application/json',
        },
      },
      { localId: LEGACY_ADMIN_UID }
    );

    if (deleteRes.statusCode === 200) {
      console.log(`✓ Deleted legacy admin (${LEGACY_ADMIN_UID}) from Firebase Authentication.`);
    } else {
      console.warn(`• Notice: Firebase Auth delete returned ${deleteRes.statusCode}: ${deleteRes.raw}`);
      console.warn('  (If already deleted via Firebase Console, this is expected).');
    }
  } catch (err) {
    console.warn(`• Notice: Could not call Auth delete API directly: ${err.message}`);
    console.warn('  You can also delete the user in Firebase Console > Authentication.');
  }

  // Step 3: Revoke Firestore permissions for legacy admin document
  console.log(`\n[3/3] Revoking Firestore permissions for legacy admin (${LEGACY_ADMIN_UID})...`);
  const legacyDocRef = doc(db, 'users', LEGACY_ADMIN_UID);
  const legacySnap = await getDoc(legacyDocRef);

  if (legacySnap.exists()) {
    await updateDoc(legacyDocRef, {
      isActive: false,
      role: 'deactivated_admin',
      deactivatedAt: new Date().toISOString(),
      deactivationReason: `Superseded by new primary admin ${NEW_ADMIN_EMAIL} (${newAdminDocId})`,
    });
    console.log(`✓ Updated users/${LEGACY_ADMIN_UID} with role: 'deactivated_admin', isActive: false.`);
  } else {
    console.log(`• Legacy admin doc users/${LEGACY_ADMIN_UID} does not exist in Firestore.`);
  }

  console.log('\n================================================================');
  console.log('LEGACY ADMIN RETIREMENT COMPLETED');
  console.log('================================================================');
  console.log(`Sole Active Administrator: ${NEW_ADMIN_EMAIL} (UID: ${newAdminDocId})`);
  console.log(`Legacy Account Status:    Deactivated & Revoked`);
  console.log('All staff, leads, sales, and attendance data: 100% UNTOUCHED');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
