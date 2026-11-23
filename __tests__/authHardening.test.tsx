import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StorageService } from '../src/services/storageService';

const firebaseMock = require('../jest.firebaseMock');

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({
      currentUser: {
        uid: 'auth_admin_123',
        email: 'admin@parthmobile.com',
        getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'admin' } }),
      },
    })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
    getFunctions: jest.fn(() => ({})),
  },
}));

jest.mock('../src/services/firestoreSync', () => ({
  FirestoreSyncService: {
    pullAllCloudToLocal: jest.fn().mockResolvedValue(true),
    fetchCollection: jest.fn().mockResolvedValue([]),
  },
  FIRESTORE_COLLECTIONS: {
    USERS: 'users',
  },
}));

import { AuthProvider, useAuth } from '../src/context/AuthContext';

describe('Phase 2: Authentication & Staff Login Hardening', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  describe('StorageService.clearSensitiveUserData', () => {
    it('clears user session, team list, sales targets, and salary slips from local cache', async () => {
      await AsyncStorage.setItem('@pmc_current_user', JSON.stringify({ id: 'u1', name: 'Test' }));
      await AsyncStorage.setItem('@pmc_users_list', JSON.stringify([{ id: 'u1' }]));
      await AsyncStorage.setItem('@pmc_salary_slips', JSON.stringify([{ id: 's1' }]));
      await AsyncStorage.setItem('@pmc_sales_targets', JSON.stringify([{ id: 't1' }]));

      // Verify they exist
      expect(await AsyncStorage.getItem('@pmc_current_user')).not.toBeNull();
      expect(await AsyncStorage.getItem('@pmc_salary_slips')).not.toBeNull();

      // Clear
      await StorageService.clearSensitiveUserData();

      expect(await AsyncStorage.getItem('@pmc_current_user')).toBeNull();
      expect(await AsyncStorage.getItem('@pmc_users_list')).toBeNull();
      expect(await AsyncStorage.getItem('@pmc_salary_slips')).toBeNull();
      expect(await AsyncStorage.getItem('@pmc_sales_targets')).toBeNull();
    });
  });

  describe('AuthContext Login, Verification & Session Invalidation', () => {
    const setupContext = async () => {
      let contextVal: any = null;
      const Consumer = () => {
        contextVal = useAuth();
        return null;
      };

      await ReactTestRenderer.act(async () => {
        ReactTestRenderer.create(
          <AuthProvider>
            <Consumer />
          </AuthProvider>
        );
      });

      return {
        get: () => contextVal,
      };
    };

    it('blocks Admin from logging into mobile and instructs to use Web Dashboard', async () => {
      firebaseMock.signInWithEmailAndPassword.mockResolvedValueOnce({
        user: {
          uid: 'admin_uid_1',
          email: 'admin@parthmobile.com',
          getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'admin' } }),
        },
      });

      firebaseMock.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'admin_uid_1',
          name: 'Parth Patel',
          email: 'admin@parthmobile.com',
          role: 'admin',
          isActive: true,
          basicSalary: 60000,
          monthlyTarget: 500000,
        }),
      });

      const ctx = await setupContext();
      let loginResult: any;

      await ReactTestRenderer.act(async () => {
        loginResult = await ctx.get().login('admin@parthmobile.com', 'password123');
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.message).toContain('Admin Web Dashboard');
      expect(ctx.get().currentUser).toBeNull();
      expect(ctx.get().isAdmin).toBe(false);
      expect(ctx.get().isStaff).toBe(false);
    });

    it('successfully logs in Staff and routes to staff experience', async () => {
      firebaseMock.signInWithEmailAndPassword.mockResolvedValueOnce({
        user: {
          uid: 'staff_uid_1',
          email: 'staff@parthmobile.com',
          getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'staff' } }),
        },
      });

      firebaseMock.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'staff_uid_1',
          name: 'Suresh Kumar',
          email: 'staff@parthmobile.com',
          role: 'staff',
          isActive: true,
          basicSalary: 22000,
          monthlyTarget: 180000,
        }),
      });

      const ctx = await setupContext();
      let loginResult: any;

      await ReactTestRenderer.act(async () => {
        loginResult = await ctx.get().login('staff@parthmobile.com', 'staffpass123');
      });

      expect(loginResult.success).toBe(true);
      expect(ctx.get().currentUser?.role).toBe('staff');
      expect(ctx.get().isAdmin).toBe(false);
      expect(ctx.get().isStaff).toBe(true);
    });

    it('transitions to registration flow when staff profile is missing from Firestore', async () => {
      firebaseMock.signInWithEmailAndPassword.mockResolvedValueOnce({
        user: {
          uid: 'applicant_uid',
          email: 'applicant@example.com',
          reload: jest.fn().mockResolvedValue(undefined),
          getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
        },
      });

      // Document does not exist in Firestore (registration incomplete)
      firebaseMock.getDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const ctx = await setupContext();
      let loginResult: any;

      await ReactTestRenderer.act(async () => {
        loginResult = await ctx.get().login('applicant@example.com', 'password123');
      });

      expect(loginResult.success).toBe(true);
      expect(ctx.get().authStatus).toBe('authenticated_unverified');
      expect(ctx.get().currentUser?.id).toBe('applicant_uid');
      expect(ctx.get().currentUser?.registrationStatus).toBe('pending');
    });

    it('rejects login when staff account is deactivated', async () => {
      firebaseMock.signInWithEmailAndPassword.mockResolvedValueOnce({
        user: {
          uid: 'inactive_staff_uid',
          email: 'inactive@example.com',
          getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'staff' } }),
        },
      });

      // Profile exists but isActive is false
      firebaseMock.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'inactive_staff_uid',
          name: 'Inactive Staff',
          email: 'inactive@example.com',
          role: 'staff',
          isActive: false,
        }),
      });

      const ctx = await setupContext();
      let loginResult: any;

      await ReactTestRenderer.act(async () => {
        loginResult = await ctx.get().login('inactive@example.com', 'password123');
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.message).toContain('This staff account is inactive');
      expect(firebaseMock.signOut).toHaveBeenCalled();
      expect(ctx.get().currentUser).toBeNull();
    });

    it('rejects login when Firestore role is invalid or unauthorized', async () => {
      firebaseMock.signInWithEmailAndPassword.mockResolvedValueOnce({
        user: {
          uid: 'hacker_uid',
          email: 'hacker@example.com',
          getIdTokenResult: jest.fn().mockResolvedValue({ claims: {} }),
        },
      });

      firebaseMock.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'hacker_uid',
          name: 'Hacker',
          email: 'hacker@example.com',
          role: 'superuser_unauthorized',
          isActive: true,
        }),
      });

      const ctx = await setupContext();
      let loginResult: any;

      await ReactTestRenderer.act(async () => {
        loginResult = await ctx.get().login('hacker@example.com', 'password123');
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.message).toContain('invalid role');
      expect(firebaseMock.signOut).toHaveBeenCalled();
    });

    it('invalidates active session and signs out when Firestore onSnapshot detects deactivation', async () => {
      let snapshotCallback: ((snap: any) => void) | null = null;
      firebaseMock.onSnapshot.mockImplementation((_ref: any, cb: any) => {
        snapshotCallback = cb;
        return jest.fn(); // unsubscribe
      });

      firebaseMock.signInWithEmailAndPassword.mockResolvedValueOnce({
        user: {
          uid: 'active_staff_uid',
          email: 'staff@parthmobile.com',
          getIdTokenResult: jest.fn().mockResolvedValue({ claims: { role: 'staff' } }),
        },
      });

      firebaseMock.getDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          id: 'active_staff_uid',
          name: 'Active Staff',
          email: 'staff@parthmobile.com',
          role: 'staff',
          isActive: true,
        }),
      });

      const ctx = await setupContext();

      await ReactTestRenderer.act(async () => {
        await ctx.get().login('staff@parthmobile.com', 'staffpass');
      });

      expect(ctx.get().currentUser?.id).toBe('active_staff_uid');

      // Now simulate admin deactivating this staff account in Firestore while app is running
      expect(snapshotCallback).not.toBeNull();
      await ReactTestRenderer.act(async () => {
        snapshotCallback!({
          exists: () => true,
          data: () => ({
            id: 'active_staff_uid',
            name: 'Active Staff',
            isActive: false, // DEACTIVATED
          }),
        });
      });

      // Session must be terminated immediately
      expect(firebaseMock.signOut).toHaveBeenCalled();
      expect(ctx.get().currentUser).toBeNull();
    });

    it('wipes sensitive local cache on logout', async () => {
      await AsyncStorage.setItem('@pmc_current_user', JSON.stringify({ id: 'u1' }));
      await AsyncStorage.setItem('@pmc_salary_slips', JSON.stringify([{ id: 's1' }]));

      const ctx = await setupContext();

      await ReactTestRenderer.act(async () => {
        await ctx.get().logout();
      });

      expect(firebaseMock.signOut).toHaveBeenCalled();
      expect(await AsyncStorage.getItem('@pmc_current_user')).toBeNull();
      expect(await AsyncStorage.getItem('@pmc_salary_slips')).toBeNull();
    });
  });
});
