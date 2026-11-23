import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import { User } from '../types';

interface AuthContextType {
  currentUser: User | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const verifyAndLoadAdminProfile = async (fUser: FirebaseUser): Promise<User> => {
    const profileRef = doc(db, 'users', fUser.uid);
    const snap = await getDoc(profileRef);

    if (!snap.exists()) {
      throw new Error(
        'Your account signed in to Firebase Auth, but its staff profile was not found in database records. Administrator profile required.'
      );
    }

    const data = snap.data() as User;
    if (data.isActive === false) {
      throw new Error('This account is inactive. Contact the store owner.');
    }

    if (data.role !== 'admin') {
      throw new Error(
        'Access Denied: The Admin Dashboard is strictly restricted to store administrators. Staff accounts cannot access this portal.'
      );
    }

    // Check token custom claims
    try {
      const token = await fUser.getIdTokenResult();
      if (token.claims.role && token.claims.role !== 'admin') {
        throw new Error('Cryptographic token claims mismatch: Non-admin role assigned.');
      }
    } catch (err: any) {
      if (err.message?.includes('Access Denied') || err.message?.includes('mismatch')) {
        throw err;
      }
    }

    return {
      ...data,
      id: fUser.uid,
      email: data.email || fUser.email || '',
      role: 'admin',
    };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fUser) => {
      setIsLoading(true);
      if (fUser) {
        try {
          const profile = await verifyAndLoadAdminProfile(fUser);
          setFirebaseUser(fUser);
          setCurrentUser(profile);
        } catch (error) {
          console.warn('Dashboard admin profile verification failed:', error);
          await signOut(auth).catch(() => {});
          setFirebaseUser(null);
          setCurrentUser(null);
        }
      } else {
        setFirebaseUser(null);
        setCurrentUser(null);
      }
      setIsLoading(false);
    });

    if (import.meta.env.DEV) {
      (window as any).__DEV_SET_ADMIN__ = (adminProfile: User) => {
        setCurrentUser(adminProfile);
        setFirebaseUser({ uid: adminProfile.id, email: adminProfile.email } as any);
        setIsLoading(false);
      };
    }

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass ? pass.trim() : '';

    if (!cleanEmail || !cleanPass) {
      return { success: false, message: 'Please enter your administrator email and password.' };
    }

    try {
      let credential;
      try {
        credential = await signInWithEmailAndPassword(auth, cleanEmail, pass);
      } catch (firstAuthErr: any) {
        // If initial attempt failed with invalid credentials and password contained accidental leading/trailing whitespace, try trimmed password
        if (
          (firstAuthErr?.code === 'auth/invalid-credential' || firstAuthErr?.code === 'auth/wrong-password') &&
          pass !== cleanPass
        ) {
          credential = await signInWithEmailAndPassword(auth, cleanEmail, cleanPass);
        } else {
          throw firstAuthErr;
        }
      }

      const profile = await verifyAndLoadAdminProfile(credential.user);
      setFirebaseUser(credential.user);
      setCurrentUser(profile);
      return { success: true, message: 'Signed in successfully.' };
    } catch (error: any) {
      console.error('[PMC Auth] Dashboard sign-in error:', {
        code: error?.code,
        message: error?.message,
      });

      await signOut(auth).catch(() => {});
      setFirebaseUser(null);
      setCurrentUser(null);

      const code = error?.code || '';
      let message = error?.message || 'Login failed.';

      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        message = 'Invalid email or password.';
      } else if (code === 'auth/too-many-requests') {
        message = 'Too many failed login attempts. Please try again later or reset your password.';
      } else if (code === 'auth/network-request-failed') {
        message = 'Network connection failed. Please check your internet connectivity and try again.';
      }

      return { success: false, message };
    }
  };

  const logout = async () => {
    await signOut(auth);
    setFirebaseUser(null);
    setCurrentUser(null);
  };

  const sendPasswordReset = async (email: string) => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Please enter a valid administrator email address.');
    }
    try {
      await sendPasswordResetEmail(auth, cleanEmail);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-email') {
        throw new Error('Please enter a valid email address.');
      } else if (code === 'auth/too-many-requests') {
        throw new Error('Too many requests. Please wait a few moments before trying again.');
      } else if (code === 'auth/network-request-failed') {
        throw new Error('Network connection failed. Please check your internet connectivity.');
      }
      throw err;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        firebaseUser,
        isLoading,
        login,
        logout,
        sendPasswordReset,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

