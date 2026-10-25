import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  initializeAuth,
  type Auth,
} from 'firebase/auth';
import {
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Firebase's RN-specific persistence export is selected by Metro's
// react-native resolver condition and is not included in the web type barrel.
const { getReactNativePersistence } = require('@firebase/auth');

// Firebase web config values identify the project; access to data is controlled
// by Firebase Auth and the project's Firestore/Storage security rules.
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyAdvwIbQjNYQQ4E9kgixdyJRlTk9W_GBHY',
  authDomain: 'parthmobilecare-a474d.firebaseapp.com',
  projectId: 'parthmobilecare-a474d',
  storageBucket: 'parthmobilecare-a474d.firebasestorage.app',
  messagingSenderId: '369865629891',
  appId: '1:369865629891:android:2e8cbf1f7472691c3e8276',
};

export interface FirestoreTestResult {
  success: boolean;
  step: 'initialization' | 'write' | 'read' | 'delete' | 'complete';
  projectId: string;
  message: string;
  errorCode?: string;
  timestamp: string;
  data?: any;
}

class FirebaseService {
  private static app: FirebaseApp | null = null;
  private static auth: Auth | null = null;
  private static isConfigured = false;
  private static initPromise: Promise<boolean> | null = null;

  private static getOrCreateApp(): FirebaseApp {
    if (this.app) return this.app;
    this.app = getApps().length ? getApp() : initializeApp(DEFAULT_FIREBASE_CONFIG);
    return this.app;
  }

  /** Initialize Firebase before the app's providers start issuing sync calls. */
  static init(): Promise<boolean> {
    if (this.initPromise) return this.initPromise;

    const initialization = Promise.resolve().then(async () => {
      try {
        const app = this.getOrCreateApp();
        try {
          // Persist Firebase Auth sessions across app restarts on React Native.
          this.auth = initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage),
          });
        } catch (error: any) {
          // Fast refresh or another module may already have initialized Auth.
          if (error?.code !== 'auth/already-initialized') throw error;
          this.auth = getAuth(app);
        }
        this.isConfigured = true;
        return true;
      } catch (error) {
        this.isConfigured = false;
        this.initPromise = null;
        console.warn('Firebase initialization failed; local data remains available.', error);
        return false;
      }
    });

    this.initPromise = initialization;
    return initialization;
  }

  static isReady(): boolean {
    return this.isConfigured;
  }

  static getAppInstance(): FirebaseApp {
    return this.getOrCreateApp();
  }

  static getProjectId(): string {
    return DEFAULT_FIREBASE_CONFIG.projectId;
  }

  static getAuth(): Auth {
    const app = this.getOrCreateApp();
    if (this.auth) return this.auth;
    try {
      this.auth = getAuth(app);
    } catch {
      return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
    }
    return this.auth;
  }

  static getFirestore(): Firestore {
    return getFirestore(this.getOrCreateApp());
  }

  static getStorage(): FirebaseStorage {
    return getStorage(this.getOrCreateApp());
  }

  /** Diagnostic probe for the configured project's Cloud Firestore database. */
  static async testFirestoreConnection(): Promise<FirestoreTestResult> {
    const timestamp = new Date().toISOString();
    const projectId = this.getProjectId();

    try {
      if (!(await this.init())) throw new Error('Firebase could not be initialized.');
      const testDocRef = doc(this.getFirestore(), '_connection_test', 'connectivity_check');
      const payload = { test: true, source: 'ParthMobileCare App', testedAt: timestamp };

      try {
        await setDoc(testDocRef, payload);
      } catch (error: any) {
        const permissionDenied = error?.code === 'permission-denied';
        return {
          success: false,
          step: 'write',
          projectId,
          errorCode: error?.code || 'write-failed',
          message: permissionDenied
            ? 'Firebase is initialized, but Firestore rules denied the diagnostic write. Sign-in and security rules must allow this operation.'
            : error?.message || 'Firestore write operation failed.',
          timestamp,
        };
      }

      let readData: any;
      try {
        const snapshot = await getDoc(testDocRef);
        readData = snapshot.exists() ? snapshot.data() : null;
      } catch (error: any) {
        return {
          success: false,
          step: 'read',
          projectId,
          errorCode: error?.code || 'read-failed',
          message: error?.message || 'Firestore read operation failed.',
          timestamp,
        };
      }

      try {
        await deleteDoc(testDocRef);
      } catch (error) {
        console.warn('Firestore diagnostic cleanup failed:', error);
      }

      return {
        success: true,
        step: 'complete',
        projectId,
        message: 'Cloud Firestore read, write, and delete operations verified successfully.',
        timestamp,
        data: readData,
      };
    } catch (error: any) {
      return {
        success: false,
        step: 'initialization',
        projectId,
        errorCode: error?.code || 'initialization-failed',
        message: error?.message || 'Unexpected Firebase initialization error.',
        timestamp,
      };
    }
  }
}

export default FirebaseService;
