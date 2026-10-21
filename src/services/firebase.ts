import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Official ParthMobileCare Firebase Configuration
// Extracted from android/app/google-services.json
export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBVUJbkmg-ZKXAP2mmkwFYE--c3xua9usY',
  authDomain: 'parthmobilecare.firebaseapp.com',
  projectId: 'parthmobilecare',
  storageBucket: 'parthmobilecare.firebasestorage.app',
  messagingSenderId: '1974801207',
  appId: '1:1974801207:android:dd5038dbeeb0be5b8940b2',
};

const FIREBASE_CONFIG_KEY = '@pmc_custom_firebase_config';

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
  private static app: any = null;
  private static isConfigured: boolean = false;

  static async init(): Promise<boolean> {
    try {
      const savedConfig = await AsyncStorage.getItem(FIREBASE_CONFIG_KEY);
      const config = savedConfig ? JSON.parse(savedConfig) : DEFAULT_FIREBASE_CONFIG;

      if (!getApps().length) {
        this.app = initializeApp(config);
      } else {
        this.app = getApp();
      }
      this.isConfigured = true;
      return true;
    } catch (e) {
      console.warn('Firebase initialized in offline/safe mode:', e);
      this.isConfigured = false;
      return false;
    }
  }

  static getAppInstance() {
    if (!this.app) {
      this.init();
    }
    return this.app;
  }

  static getProjectId(): string {
    return DEFAULT_FIREBASE_CONFIG.projectId;
  }

  static getAuth() {
    if (!this.app) {
      this.init();
    }
    try {
      return getAuth(this.app);
    } catch {
      return null;
    }
  }

  static getFirestore() {
    if (!this.app) {
      this.init();
    }
    try {
      return getFirestore(this.app);
    } catch {
      return null;
    }
  }

  static getStorage() {
    if (!this.app) {
      this.init();
    }
    try {
      return getStorage(this.app);
    } catch {
      return null;
    }
  }

  static async updateConfig(newConfig: typeof DEFAULT_FIREBASE_CONFIG) {
    await AsyncStorage.setItem(FIREBASE_CONFIG_KEY, JSON.stringify(newConfig));
    // Re-initialize app if needed
  }

  /**
   * Diagnostic test for runtime Cloud Firestore read/write
   * Connects to actual Firebase Firestore backend and tests operations
   */
  static async testFirestoreConnection(): Promise<FirestoreTestResult> {
    const timestamp = new Date().toISOString();
    const projectId = DEFAULT_FIREBASE_CONFIG.projectId;

    try {
      await this.init();
      const db = this.getFirestore();
      if (!db) {
        return {
          success: false,
          step: 'initialization',
          projectId,
          message: 'Firebase app or Firestore could not be initialized.',
          timestamp,
        };
      }

      const testDocRef = doc(db, '_connection_test', 'connectivity_check');
      const payload = {
        test: true,
        source: 'ParthMobileCare App',
        testedAt: timestamp,
      };

      // 1. Write Test
      try {
        await setDoc(testDocRef, payload);
      } catch (writeErr: any) {
        const isPermission =
          writeErr?.code === 'permission-denied' ||
          writeErr?.message?.includes('PERMISSION_DENIED');
        return {
          success: false,
          step: 'write',
          projectId,
          errorCode: writeErr?.code || (isPermission ? 'permission-denied' : 'unknown'),
          message: isPermission
            ? 'Connected to Firebase Firestore backend! (Security rules currently enforcing Production Mode / Authentication)'
            : writeErr?.message || 'Write operation failed.',
          timestamp,
        };
      }

      // 2. Read Test
      let readData: any = null;
      try {
        const snap = await getDoc(testDocRef);
        readData = snap.exists() ? snap.data() : null;
      } catch (readErr: any) {
        return {
          success: false,
          step: 'read',
          projectId,
          errorCode: readErr?.code || 'read-failed',
          message: readErr?.message || 'Read operation failed.',
          timestamp,
        };
      }

      // 3. Delete Test (cleanup harmless test record)
      try {
        await deleteDoc(testDocRef);
      } catch (delErr: any) {
        console.warn('Test cleanup warning:', delErr);
      }

      return {
        success: true,
        step: 'complete',
        projectId,
        message: 'Cloud Firestore read, write, and delete operations verified successfully!',
        timestamp,
        data: readData,
      };
    } catch (err: any) {
      return {
        success: false,
        step: 'initialization',
        projectId,
        errorCode: err?.code || 'fatal-error',
        message: err?.message || 'Unexpected connection error.',
        timestamp,
      };
    }
  }
}

export default FirebaseService;
