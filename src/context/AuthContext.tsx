import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  EmailAuthProvider,
  onAuthStateChanged,
  reauthenticateWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
  sendPasswordResetEmail,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { User, UserRole } from '../types';
import FirebaseService from '../services/firebase';
import { FirestoreSyncService, FIRESTORE_COLLECTIONS } from '../services/firestoreSync';
import { StorageService } from '../services/storageService';

interface AuthContextType {
  currentUser: User | null;
  role: UserRole;
  allUsers: User[];
  isLoading: boolean;
  login: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  updateUserProfile: (updated: Partial<User>) => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  sendPasswordReset: (email: string) => Promise<void>;
  isAdmin: boolean;
  isManager: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getProfileForAuthUser = async (authUser: FirebaseUser): Promise<User> => {
  const profileRef = doc(FirebaseService.getFirestore(), 'users', authUser.uid);
  const snapshot = await getDoc(profileRef);
  if (!snapshot.exists()) {
    throw new Error('Your Firebase account is signed in, but its staff profile is missing. Ask an administrator to create users/' + authUser.uid + ' in Firestore.');
  }

  const profile = snapshot.data() as User;
  if (profile.isActive === false) {
    throw new Error('This staff account is inactive. Contact an administrator.');
  }
  if (!['admin', 'manager', 'staff'].includes(profile.role)) {
    throw new Error('Your Firestore staff profile has an invalid role. Contact an administrator.');
  }

  return { ...profile, id: authUser.uid, email: profile.email || authUser.email || '' };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUsers = async () => {
    const remoteUsers = await FirestoreSyncService.fetchCollection<User>(FIRESTORE_COLLECTIONS.USERS);
    const normalized = remoteUsers.map(user => ({ ...user, id: user.id }));
    if (normalized.length) setAllUsers(normalized);
    else if (currentUser) setAllUsers([currentUser]);
  };

  const acceptAuthUser = async (authUser: FirebaseUser | null) => {
    if (!authUser) {
      setCurrentUser(null);
      setAllUsers([]);
      await StorageService.setCurrentUser(null);
      return;
    }

    const profile = await getProfileForAuthUser(authUser);
    await FirestoreSyncService.pullAllCloudToLocal();
    const remoteUsers = await FirestoreSyncService.fetchCollection<User>(FIRESTORE_COLLECTIONS.USERS);
    const normalized = remoteUsers.map(user => ({ ...user, id: user.id }));
    setAllUsers(normalized.length ? normalized : [profile]);
    setCurrentUser(profile);
    await StorageService.setCurrentUser(profile);
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let mounted = true;

    FirebaseService.init().then(() => {
      if (!mounted) return;
      unsubscribe = onAuthStateChanged(FirebaseService.getAuth(), async authUser => {
        setIsLoading(true);
        try {
          await acceptAuthUser(authUser);
        } catch (error) {
          console.warn('Firebase account profile could not be loaded:', error);
          setCurrentUser(null);
          setAllUsers([]);
          await StorageService.setCurrentUser(null);
          if (authUser) await signOut(FirebaseService.getAuth()).catch(() => {});
        } finally {
          setIsLoading(false);
        }
      });
    }).catch(error => {
      console.warn('Firebase initialization failed:', error);
      if (mounted) setIsLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  // Firebase auth subscription is installed once for the app lifetime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !pass) return { success: false, message: 'Enter your Firebase account email and password.' };

    try {
      const credential = await signInWithEmailAndPassword(FirebaseService.getAuth(), cleanEmail, pass);
      await acceptAuthUser(credential.user);
      return { success: true, message: 'Signed in successfully.' };
    } catch (error: any) {
      if (FirebaseService.getAuth().currentUser) await signOut(FirebaseService.getAuth()).catch(() => {});
      const message = error?.code === 'auth/invalid-credential' || error?.code === 'auth/wrong-password' || error?.code === 'auth/user-not-found'
        ? 'Email or password is incorrect.'
        : error?.message || 'Firebase sign in failed.';
      return { success: false, message };
    }
  };

  const logout = async () => {
    await signOut(FirebaseService.getAuth());
  };

  const updateUserProfile = async (updated: Partial<User>) => {
    if (!currentUser) return;
    const modified: User = { ...currentUser, ...updated, id: currentUser.id };
    await StorageService.saveUser(modified);
    setCurrentUser(modified);
    await refreshUsers();
  };

  const changePassword = async (oldPass: string, newPass: string) => {
    const auth = FirebaseService.getAuth();
    const authUser = auth.currentUser;
    if (!authUser?.email) return { success: false, message: 'Sign in with email and password to change your password.' };
    try {
      const credential = EmailAuthProvider.credential(authUser.email, oldPass);
      await reauthenticateWithCredential(authUser, credential);
      await updatePassword(authUser, newPass);
      return { success: true, message: 'Password updated successfully.' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Password update failed.' };
    }
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(FirebaseService.getAuth(), email.trim().toLowerCase());
  };

  const role: UserRole = currentUser?.role || 'staff';
  const isAdmin = role === 'admin';
  const isManager = role === 'manager' || role === 'admin';
  const isStaff = role === 'staff';

  return (
    <AuthContext.Provider value={{
      currentUser, role, allUsers, isLoading, login, logout, refreshUsers,
      updateUserProfile, changePassword, sendPasswordReset, isAdmin, isManager, isStaff,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
