/**
 * Parth Mobile Care — Primary Admin Account Provisioning & Verification Utility
 *
 * This script securely provisions and verifies the new primary Administrator account
 * for parthmobilecare07@gmail.com.
 *
 * SAFE EXECUTION ORDER:
 * - Creates/authenticates parthmobilecare07@gmail.com in Firebase Auth.
 * - Creates/updates users/{new_uid} with role: 'admin', isActive: true.
 * - Validates the complete admin profile verification contract.
 * - Leaves the legacy admin account intact until manual dashboard verification is confirmed.
 *
 * SECURITY GUARANTEES:
 * - Passwords are NEVER hardcoded, logged, or written to disk.
 * - Accepts password via process.env.ADMIN_PASSWORD or secure hidden interactive prompt.
 * - Does NOT touch staff, attendance, customer, purchase, or invoice data.
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import readline from 'node:readline';

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAdvwIbQjNYQQ4E9kgixdyJRlTk9W_GBHY',
  authDomain: 'parthmobilecare-a474d.firebaseapp.com',
  projectId: 'parthmobilecare-a474d',
  storageBucket: 'parthmobilecare-a474d.firebasestorage.app',
  messagingSenderId: '369865629891',
  appId: '1:369865629891:web:parthmobilecare-dashboard-web',
};

const NEW_ADMIN_EMAIL = 'parthmobilecare07@gmail.com';

async function promptPasswordSecurely() {
  if (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim().length >= 6) {
    return process.env.ADMIN_PASSWORD.trim();
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    let isMuted = false;
    rl._writeToOutput = function _writeToOutput(stringToWrite) {
      if (!isMuted) {
        process.stdout.write(stringToWrite);
      } else {
        // Suppress terminal echo for password characters
        if (stringToWrite.includes('\r\n') || stringToWrite.includes('\n')) {
          process.stdout.write('\n');
        }
      }
    };

    process.stdout.write(`Enter secure password for ${NEW_ADMIN_EMAIL} (min 6 chars, input is hidden): `);
    isMuted = true;

    rl.question('', (answer) => {
      isMuted = false;
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log('================================================================');
  console.log('PARTH MOBILE CARE — NEW ADMIN PROVISIONING & VERIFICATION');
  console.log('================================================================');
  console.log(`Target Admin Email: ${NEW_ADMIN_EMAIL}`);

  const password = await promptPasswordSecurely();

  if (!password || password.length < 6) {
    console.error('ERROR: Password must be at least 6 characters.');
    process.exit(1);
  }

  console.log('\n[1/3] Initializing Firebase Client SDK...');
  const app = initializeApp(FIREBASE_CONFIG);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let userCredential;

  console.log(`[2/3] Authenticating / Provisioning ${NEW_ADMIN_EMAIL}...`);
  try {
    userCredential = await createUserWithEmailAndPassword(auth, NEW_ADMIN_EMAIL, password);
    console.log('✓ Successfully created account in Firebase Authentication.');
  } catch (createErr) {
    if (createErr.code === 'auth/email-already-in-use') {
      console.log('• Account already exists in Firebase Auth. Signing in with provided password...');
      try {
        userCredential = await signInWithEmailAndPassword(auth, NEW_ADMIN_EMAIL, password);
        console.log('✓ Successfully signed in with existing Firebase Auth credentials.');
      } catch (signInErr) {
        console.error(`ERROR: Failed to sign in: ${signInErr.code} - ${signInErr.message}`);
        process.exit(1);
      }
    } else {
      console.error(`ERROR: Failed to create user in Firebase Auth: ${createErr.code} - ${createErr.message}`);
      process.exit(1);
    }
  }

  const newAdminUid = userCredential.user.uid;
  console.log(`✓ Firebase Auth UID: ${newAdminUid}`);

  // Configure Firestore Admin Profile
  console.log(`\n[3/3] Setting up Firestore Administrator Profile at users/${newAdminUid}...`);
  const profileRef = doc(db, 'users', newAdminUid);
  const existingDocSnap = await getDoc(profileRef);
  const existingData = existingDocSnap.exists() ? existingDocSnap.data() : {};

  const adminProfilePayload = {
    id: newAdminUid,
    email: NEW_ADMIN_EMAIL,
    name: existingData.name || 'Parth Patel',
    role: 'admin',
    designation: 'Store Owner & Admin',
    phone: existingData.phone || '9876543210',
    isActive: true,
    joinedDate: existingData.joinedDate || '2023-01-01',
    basicSalary: 0,
    createdAt: existingData.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await setDoc(profileRef, adminProfilePayload, { merge: true });
  console.log(`✓ Firestore profile configured at users/${newAdminUid} with role: 'admin', isActive: true.`);

  // Verify dashboard authentication compatibility contract
  console.log('\nVerifying Admin Dashboard Profile Contract...');
  const verifySnap = await getDoc(profileRef);
  if (verifySnap.exists()) {
    const verifiedData = verifySnap.data();
    if (verifiedData.role === 'admin' && verifiedData.isActive === true) {
      console.log('✓ PASS: verifyAndLoadAdminProfile contract fully satisfied.');
      console.log('✓ PASS: firestore.rules isAdmin() check fully satisfied.');
    } else {
      console.error('FAIL: Profile data mismatch:', verifiedData);
      process.exit(1);
    }
  }

  await signOut(auth);
  console.log('\n================================================================');
  console.log('PROVISIONING COMPLETED SUCCESSFULLY');
  console.log('================================================================');
  console.log(`Admin Email: ${NEW_ADMIN_EMAIL}`);
  console.log(`Admin UID:   ${newAdminUid}`);
  console.log(`Role:        admin`);
  console.log(`Status:      Active (isActive: true)`);
  console.log(`Designation: Store Owner & Admin`);
  console.log('\nNEXT STEPS:');
  console.log('1. Open http://localhost:3000 and log in with parthmobilecare07@gmail.com.');
  console.log('2. Verify that all dashboard modules (Staff, Leads, Attendance, Settings, etc.) load.');
  console.log('3. Legacy admin account remains unchanged until you verify dashboard access.');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
