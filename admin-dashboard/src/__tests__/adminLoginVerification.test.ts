import { describe, it, expect } from 'vitest';
import { User } from '../types';

describe('Admin Dashboard Login & Root Cause Diagnostics', () => {
  const TARGET_EMAIL = 'parthmobilecare07@gmail.com';
  const TARGET_UID = '8X4u2Tidn4RSdnQA4dAKt41Ji7a2';

  // AuthContext logic replica for error mapping
  const mapAuthErrorToUiMessage = (error: any): string => {
    const code = error?.code || '';
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return 'Invalid email or password.';
    } else if (code === 'auth/too-many-requests') {
      return 'Too many failed login attempts. Please try again later or reset your password.';
    } else if (code === 'auth/network-request-failed') {
      return 'Network connection failed. Please check your internet connectivity and try again.';
    }
    return error?.message || 'Login failed.';
  };

  const verifyAndLoadAdminProfile = (
    userData: Partial<User> | null,
    fUser: { uid: string; email?: string | null } | null
  ): User => {
    if (!fUser) throw new Error('No user is signed in.');
    if (!userData) {
      throw new Error(
        'Your account signed in to Firebase Auth, but its staff profile was not found in database records. Administrator profile required.'
      );
    }
    if (userData.isActive === false) {
      throw new Error('This account is inactive. Contact the store owner.');
    }
    if (userData.role !== 'admin') {
      throw new Error(
        'Access Denied: The Admin Dashboard is strictly restricted to store administrators. Staff accounts cannot access this portal.'
      );
    }
    return {
      ...(userData as User),
      id: fUser.uid,
      email: userData.email || fUser.email || '',
      role: 'admin',
    };
  };

  it('1. Correctly maps Firebase auth/invalid-credential to "Invalid email or password."', () => {
    const firebaseAuthError = {
      code: 'auth/invalid-credential',
      message: 'Firebase: Error (auth/invalid-credential).',
    };
    const uiMessage = mapAuthErrorToUiMessage(firebaseAuthError);
    expect(uiMessage).toBe('Invalid email or password.');
  });

  it('2. Distinguishes profile-not-found error from auth credential rejection without masking', () => {
    let thrownError: any = null;
    try {
      verifyAndLoadAdminProfile(null, { uid: TARGET_UID, email: TARGET_EMAIL });
    } catch (err: any) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.message).toContain('Administrator profile required');
    // UI mapping does NOT convert non-auth error into "Invalid email or password."
    const uiMessage = mapAuthErrorToUiMessage(thrownError);
    expect(uiMessage).not.toBe('Invalid email or password.');
    expect(uiMessage).toContain('Administrator profile required');
  });

  it('3. Distinguishes inactive account error from auth credential rejection', () => {
    let thrownError: any = null;
    try {
      verifyAndLoadAdminProfile(
        { id: TARGET_UID, role: 'admin', isActive: false },
        { uid: TARGET_UID, email: TARGET_EMAIL }
      );
    } catch (err: any) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.message).toBe('This account is inactive. Contact the store owner.');
    const uiMessage = mapAuthErrorToUiMessage(thrownError);
    expect(uiMessage).toBe('This account is inactive. Contact the store owner.');
  });

  it('4. Distinguishes staff role rejection from auth credential rejection', () => {
    let thrownError: any = null;
    try {
      verifyAndLoadAdminProfile(
        { id: 'staff_1', role: 'staff', isActive: true },
        { uid: 'staff_1', email: 'staff@example.com' }
      );
    } catch (err: any) {
      thrownError = err;
    }

    expect(thrownError).toBeDefined();
    expect(thrownError.message).toContain('Access Denied');
    const uiMessage = mapAuthErrorToUiMessage(thrownError);
    expect(uiMessage).toContain('Access Denied');
  });

  it('5. Successfully authorizes target admin profile when active and role is admin', () => {
    const validProfile: Partial<User> = {
      id: TARGET_UID,
      email: TARGET_EMAIL,
      name: 'Parth Patel',
      role: 'admin',
      designation: 'Store Owner & Admin',
      isActive: true,
      phone: '9824018382',
    };

    const user = verifyAndLoadAdminProfile(validProfile, { uid: TARGET_UID, email: TARGET_EMAIL });
    expect(user.id).toBe(TARGET_UID);
    expect(user.email).toBe(TARGET_EMAIL);
    expect(user.role).toBe('admin');
    expect(user.isActive).toBe(true);
  });
});
