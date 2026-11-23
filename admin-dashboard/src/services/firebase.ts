import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import { getStorage, FirebaseStorage } from 'firebase/storage';

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyAdvwIbQjNYQQ4E9kgixdyJRlTk9W_GBHY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'parthmobilecare-a474d.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'parthmobilecare-a474d',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'parthmobilecare-a474d.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '369865629891',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:369865629891:web:parthmobilecare-dashboard-web',
};

export const FIRESTORE_COLLECTIONS = {
  USERS: 'users',
  ATTENDANCE: 'attendance',
  LEADS: 'leads',
  MOBILE_PRICES: 'mobile_prices',
  SECOND_HAND_PURCHASES: 'second_hand_purchases',
  SECOND_HAND_SALES: 'second_hand_sales',
  SALES_TARGETS: 'sales_targets',
  SALARY_SLIPS: 'salary_slips',
  NOTIFICATIONS: 'notifications',
  SHOP_CONFIG: 'shop_config',
  DEVICE_CHANGE_REQUESTS: 'device_change_requests',
} as const;

export const AUTHORIZED_ADMIN_EMAILS: readonly string[] = Object.freeze([
  'parthmobilecare07@gmail.com',
]);

export const app: FirebaseApp = getApps().length ? getApp() : initializeApp(DEFAULT_FIREBASE_CONFIG);
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const functions: Functions = getFunctions(app, 'us-central1');
export const storage: FirebaseStorage = getStorage(app);

