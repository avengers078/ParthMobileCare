import React, { createContext, useContext, useEffect, useRef, useState, useCallback, useMemo } from 'react';
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
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { User, UserRole, AuthStatus, StaffRegistrationDraft } from '../types';
import FirebaseService from '../services/firebase';
import { FirestoreSyncService, FIRESTORE_COLLECTIONS } from '../services/firestoreSync';
import { StorageService } from '../services/storageService';

interface AuthContextType {
  currentUser: User | null;
  role: UserRole;
  authStatus: AuthStatus;
  allUsers: User[];
  isLoading: boolean;
  authError: string | null;
  registrationDraft: StaffRegistrationDraft | null;
  retryAuth: () => void;
  login: (email: string, pass: string) => Promise<{ success: boolean; message: string }>;
  logout: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  updateUserProfile: (updated: Partial<User>) => Promise<void>;
  changePassword: (oldPass: string, newPass: string) => Promise<{ success: boolean; message: string }>;
  sendPasswordReset: (email: string) => Promise<void>;
  saveRegistrationProgress: (draft: Partial<StaffRegistrationDraft>) => Promise<void>;
  clearRegistrationProgress: () => Promise<void>;
  checkEmailVerification: () => Promise<{ verified: boolean; user?: FirebaseUser }>;
  restartRegistration: () => Promise<void>;
  onRegistrationSubmitted: (staffProfile: User) => Promise<void>;
  isAdmin: boolean;
  /** @deprecated Applications now support exactly two roles: 'admin' and 'staff'. isManager is permanently false. */
  isManager: boolean;
  isStaff: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [registrationDraft, setRegistrationDraft] = useState<StaffRegistrationDraft | null>(null);

  const profileUnsubscribeRef = useRef<(() => void) | null>(null);
  const authUnsubscribeRef = useRef<(() => void) | null>(null);
  const authTimeoutRef = useRef<NodeJS.Timeout | number | null>(null);
  const authAttemptRef = useRef<number>(0);
  const authEmittedRef = useRef<boolean>(false);

  const cleanupProfileListener = () => {
    if (profileUnsubscribeRef.current) {
      profileUnsubscribeRef.current();
      profileUnsubscribeRef.current = null;
    }
  };

  const cleanupAuthSubscription = () => {
    if (authTimeoutRef.current) {
      clearTimeout(authTimeoutRef.current);
      authTimeoutRef.current = null;
    }
    if (authUnsubscribeRef.current) {
      authUnsubscribeRef.current();
      authUnsubscribeRef.current = null;
    }
  };

  const refreshUsers = async () => {
    if (currentUser) setAllUsers([currentUser]);
  };

  const acceptAuthUser = async (authUser: FirebaseUser | null) => {
    cleanupProfileListener();

    if (!authUser) {
      setCurrentUser(null);
      setAllUsers([]);
      setAuthStatus('unauthenticated');
      await StorageService.clearSensitiveUserData();
      return;
    }

    // Attempt to read staff profile from Firestore with timeout & local cache safeguard
    const userDocRef = doc(FirebaseService.getFirestore(), 'users', authUser.uid);
    let docSnap: any = null;
    try {
      const getDocPromise = getDoc(userDocRef);
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      docSnap = await Promise.race([getDocPromise, timeoutPromise]);
    } catch (readErr: any) {
      console.warn('[AuthContext] Error reading user profile:', readErr);
    }

    // Fallback: If network timed out or failed, inspect local persistent cache
    if (!docSnap || !docSnap.exists || !docSnap.exists()) {
      const cached = await StorageService.getCurrentUser().catch(() => null);
      if (cached && cached.id === authUser.uid) {
        setCurrentUser(cached);
        setAllUsers([cached]);
        if (cached.registrationStatus === 'pending') {
          setAuthStatus('approval_pending');
          attachProfileListener(authUser.uid);
          return;
        } else if (cached.registrationStatus === 'approved' && cached.isActive) {
          setAuthStatus('approved_staff');
          attachProfileListener(authUser.uid);
          return;
        } else if (cached.registrationStatus === 'rejected') {
          setAuthStatus('rejected');
          attachProfileListener(authUser.uid);
          return;
        }
      }
    }

    // 1. Profile exists in Firestore
    if (docSnap && docSnap.exists && docSnap.exists()) {
      const rawData = docSnap.data();

      // Check for Admin / Manager accessing mobile application
      if (rawData?.role === 'admin' || rawData?.role === 'manager') {
        console.warn(`[AuthContext] Access Denied: User ${authUser.uid} has role '${rawData?.role}'. Mobile app is staff-only.`);
        cleanupProfileListener();
        await signOut(FirebaseService.getAuth()).catch(() => {});
        await StorageService.clearSensitiveUserData();
        setCurrentUser(null);
        setAllUsers([]);
        setAuthStatus('unauthorized_role');
        setAuthError('Access Denied: Store administrators must use the Parth Mobile Care Admin Web Dashboard. This mobile app is exclusively for staff members.');
        throw new Error('Access Denied: Store administrators must use the Parth Mobile Care Admin Web Dashboard. This mobile app is exclusively for staff members.');
      }

      const rawRole = rawData?.role;
      if (!['admin', 'manager', 'staff'].includes(rawRole)) {
        cleanupProfileListener();
        await signOut(FirebaseService.getAuth()).catch(() => {});
        await StorageService.clearSensitiveUserData();
        setCurrentUser(null);
        setAllUsers([]);
        setAuthStatus('error');
        setAuthError('Your Firestore staff profile has an invalid role. Contact an administrator.');
        throw new Error('Your Firestore staff profile has an invalid role. Contact an administrator.');
      }

      const isPendingOrRejected = rawData?.registrationStatus === 'pending' || rawData?.registrationStatus === 'rejected';
      if (rawData?.isActive === false && !isPendingOrRejected) {
        cleanupProfileListener();
        await signOut(FirebaseService.getAuth()).catch(() => {});
        await StorageService.clearSensitiveUserData();
        setCurrentUser(null);
        setAllUsers([]);
        setAuthStatus('inactive');
        setAuthError('This staff account is inactive. Contact an administrator.');
        throw new Error('This staff account is inactive. Contact an administrator.');
      }

      // Valid Staff Profile
      const profile: User = {
        ...rawData,
        id: authUser.uid,
        role: 'staff',
        email: rawData?.email || authUser.email || '',
        isActive: !!rawData?.isActive,
        registrationStatus: rawData?.registrationStatus || (rawData?.isActive ? 'approved' : 'pending'),
      } as User;

      // Handle Pending Approval
      if (profile.registrationStatus === 'pending') {
        setCurrentUser(profile);
        setAllUsers([profile]);
        await StorageService.setCurrentUser(profile);
        setAuthStatus('approval_pending');
        attachProfileListener(authUser.uid);
        return;
      }

      // Handle Rejected Registration
      if (profile.registrationStatus === 'rejected') {
        setCurrentUser(profile);
        setAllUsers([profile]);
        await StorageService.setCurrentUser(profile);
        setAuthStatus('rejected');
        attachProfileListener(authUser.uid);
        return;
      }

      // Handle Approved Profile
      if (profile.registrationStatus === 'approved') {
        if (!profile.isActive) {
          setCurrentUser(profile);
          setAllUsers([profile]);
          setAuthStatus('inactive');
          attachProfileListener(authUser.uid);
          return;
        }

        // Active and Approved Staff
        setCurrentUser(profile);
        setAllUsers([profile]);
        await StorageService.setCurrentUser(profile);
        await StorageService.clearStaffRegistrationDraft();
        setAuthStatus('approved_staff');

        // Real-time synchronization
        FirestoreSyncService.pullAllCloudToLocal(profile).catch((e) =>
          console.warn('[AuthContext] Background sync error on approval:', e)
        );

        attachProfileListener(authUser.uid);
        return;
      }
    }

    // 2. Profile DOES NOT exist in Firestore: Incomplete Registration Flow
    // Reload fresh Firebase Auth user status to get latest emailVerified state
    try {
      await authUser.reload();
    } catch (_) {}

    const authInstanceUser = FirebaseService.getAuth().currentUser;
    const freshAuthUser = (authInstanceUser?.uid === authUser.uid ? authInstanceUser : authUser) || authUser;
    let draft = await StorageService.getStaffRegistrationDraft();

    // Any authenticated user who does not yet have a Firestore profile is an in-progress staff applicant.
    // They are guided to complete email verification (Step 2) or face biometrics (Step 3).
    const isVerifiedApplicant = !!freshAuthUser.emailVerified;

    // Ensure an active draft exists in local storage so registration resumes seamlessly
    if (!draft || (!draft.uid && !draft.email) || (draft.uid && draft.uid !== freshAuthUser.uid)) {
      draft = {
        uid: freshAuthUser.uid,
        name: freshAuthUser.displayName || 'Staff Member',
        email: freshAuthUser.email || '',
        phone: '',
        designation: 'Sales Executive',
        step: isVerifiedApplicant ? 'face_enrollment' : 'verify_email',
        emailVerified: isVerifiedApplicant,
        registeredAt: new Date().toISOString(),
      };
      await StorageService.saveStaffRegistrationDraft(draft);
    } else {
      draft.uid = freshAuthUser.uid;
      draft.email = freshAuthUser.email || draft.email;
      draft.emailVerified = isVerifiedApplicant;
      if (isVerifiedApplicant && draft.step === 'verify_email') {
        draft.step = 'face_enrollment';
      }
      await StorageService.saveStaffRegistrationDraft(draft);
    }
    setRegistrationDraft(draft);

    if (!freshAuthUser.emailVerified) {
      // User has created Auth account but not yet verified email
      const pendingProfile: User = {
        id: freshAuthUser.uid,
        name: draft?.name || freshAuthUser.displayName || 'Staff Applicant',
        email: freshAuthUser.email || '',
        phone: draft?.phone || '',
        role: 'staff',
        designation: draft?.designation || 'Staff',
        joinedDate: new Date().toISOString().split('T')[0],
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        registrationStatus: 'pending',
        emailVerified: false,
      };
      setCurrentUser(pendingProfile);
      setAllUsers([pendingProfile]);
      setAuthStatus('authenticated_unverified');
      setAuthError(null);
      return;
    }

    // User has verified email, but face enrollment or profile submission is incomplete
    const isFaceDone = (draft?.sampleCount || 0) >= 3;
    const pendingProfile: User = {
      id: freshAuthUser.uid,
      name: draft?.name || freshAuthUser.displayName || 'Staff Applicant',
      email: freshAuthUser.email || '',
      phone: draft?.phone || '',
      role: 'staff',
      designation: draft?.designation || 'Staff',
      joinedDate: new Date().toISOString().split('T')[0],
      basicSalary: 0,
      monthlyTarget: 0,
      isActive: false,
      registrationStatus: 'pending',
      emailVerified: true,
      faceEnrollmentStatus: isFaceDone ? 'pending_review' : 'not_enrolled',
    };
    setCurrentUser(pendingProfile);
    setAllUsers([pendingProfile]);
    setAuthStatus(isFaceDone ? 'registration_incomplete' : 'face_enrollment_pending');
    setAuthError(null);
  };

  const attachProfileListener = (uid: string) => {
    try {
      const userDocRef = doc(FirebaseService.getFirestore(), 'users', uid);
      profileUnsubscribeRef.current = onSnapshot(
        userDocRef,
        async (docSnap) => {
          if (!docSnap.exists() || docSnap.data()?.role !== 'staff') {
            console.warn(`[AuthContext] Session invalidated: user ${uid} has non-staff role or profile removed.`);
            cleanupProfileListener();
            await signOut(FirebaseService.getAuth()).catch(() => {});
            await StorageService.clearSensitiveUserData();
            setCurrentUser(null);
            setAllUsers([]);
            setAuthStatus('unauthenticated');
            return;
          }

          const freshData = docSnap.data();
          const updatedProfile: User = {
            ...freshData,
            id: uid,
            role: 'staff',
            email: freshData.email || '',
            isActive: !!freshData.isActive,
            registrationStatus: freshData.registrationStatus || (freshData.isActive ? 'approved' : 'pending'),
          } as User;

          if (updatedProfile.registrationStatus === 'approved') {
            if (updatedProfile.isActive) {
              setAuthStatus('approved_staff');
              setCurrentUser((prev) => {
                if (prev && (!prev.isActive || prev.registrationStatus !== 'approved')) {
                  FirestoreSyncService.pullAllCloudToLocal(updatedProfile).catch((e) =>
                    console.warn('[AuthContext] Background sync error on approval:', e)
                  );
                  StorageService.clearStaffRegistrationDraft().catch(() => {});
                }
                return updatedProfile;
              });
            } else {
              setAuthStatus('inactive');
              setCurrentUser(updatedProfile);
            }
          } else if (updatedProfile.registrationStatus === 'rejected') {
            setAuthStatus('rejected');
            setCurrentUser(updatedProfile);
          } else {
            setAuthStatus('approval_pending');
            setCurrentUser(updatedProfile);
          }
        },
        (err) => {
          console.warn('[AuthContext] User document onSnapshot listener error:', err);
        }
      );
    } catch (e) {
      console.warn('[AuthContext] Failed to attach profile listener:', e);
    }
  };

  const setupAuthSubscription = useCallback(() => {
    cleanupProfileListener();
    cleanupAuthSubscription();

    const currentAttempt = ++authAttemptRef.current;
    authEmittedRef.current = false;
    setIsLoading(true);
    setAuthError(null);

    const timeoutId = setTimeout(() => {
      if (authAttemptRef.current !== currentAttempt) return;
      if (!authEmittedRef.current) {
        setIsLoading(false);
        setAuthStatus('error');
        setAuthError('Authentication verification timed out. Tap Retry.');
      }
    }, 7000);
    if (typeof (timeoutId as any)?.unref === 'function') {
      (timeoutId as any).unref();
    }
    authTimeoutRef.current = timeoutId;

    FirebaseService.init()
      .then((success) => {
        if (authAttemptRef.current !== currentAttempt) return;
        if (!success) {
          clearTimeout(timeoutId);
          setIsLoading(false);
          setAuthStatus('error');
          setAuthError('Firebase service is not initialized.');
          return;
        }

        try {
          const auth = FirebaseService.getAuth();
          const unsubscribe = onAuthStateChanged(
            auth,
            async (authUser) => {
              if (authAttemptRef.current !== currentAttempt) return;
              authEmittedRef.current = true;
              clearTimeout(timeoutId);
              setAuthError(null);
              setIsLoading(true);

              try {
                await acceptAuthUser(authUser);
              } catch (error: any) {
                console.warn('[AuthContext] acceptAuthUser error:', error);
                cleanupProfileListener();
                setAuthStatus('error');
                setAuthError(error?.message || 'Failed to verify account profile.');
              } finally {
                if (authAttemptRef.current === currentAttempt) {
                  setIsLoading(false);
                }
              }
            },
            (err: any) => {
              if (authAttemptRef.current !== currentAttempt) return;
              clearTimeout(timeoutId);
              setIsLoading(false);
              setAuthStatus('error');
              setAuthError(err?.message || 'Authentication listener error.');
            }
          );

          authUnsubscribeRef.current = unsubscribe;
        } catch (authErr: any) {
          if (authAttemptRef.current !== currentAttempt) return;
          clearTimeout(timeoutId);
          setIsLoading(false);
          setAuthStatus('error');
          setAuthError(authErr?.message || 'Failed to initialize authentication listener.');
        }
      })
      .catch((error: any) => {
        if (authAttemptRef.current !== currentAttempt) return;
        clearTimeout(timeoutId);
        console.warn('Firebase initialization failed in AuthContext:', error);
        setIsLoading(false);
        setAuthStatus('error');
        setAuthError('Firebase initialization failed.');
      });

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const cleanup = setupAuthSubscription();
    return () => {
      cleanup?.();
      cleanupProfileListener();
      cleanupAuthSubscription();
    };
  }, [setupAuthSubscription]);

  const retryAuth = useCallback(() => {
    setupAuthSubscription();
  }, [setupAuthSubscription]);

  const login = async (email: string, pass: string): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !pass) return { success: false, message: 'Enter your Firebase account email and password.' };

    try {
      const credential = await signInWithEmailAndPassword(FirebaseService.getAuth(), cleanEmail, pass);
      await acceptAuthUser(credential.user);
      setAuthError(null);
      return { success: true, message: 'Signed in successfully.' };
    } catch (error: any) {
      cleanupProfileListener();
      const message =
        error?.code === 'auth/invalid-credential' ||
        error?.code === 'auth/wrong-password' ||
        error?.code === 'auth/user-not-found'
          ? 'Email or password is incorrect.'
          : error?.message || 'Firebase sign in failed.';
      return { success: false, message };
    }
  };

  const logout = async () => {
    cleanupProfileListener();
    await signOut(FirebaseService.getAuth()).catch(() => {});
    await StorageService.clearSensitiveUserData();
    setCurrentUser(null);
    setAllUsers([]);
    setAuthStatus('unauthenticated');
    setAuthError(null);
  };

  const updateUserProfile = async (updated: Partial<User>) => {
    if (!currentUser) return;
    const modified: User = { ...currentUser, ...updated, id: currentUser.id };
    await StorageService.saveUser(modified);
    setCurrentUser(modified);
    await refreshUsers();
  };

  const changePassword = async (oldPass: string, newPass: string): Promise<{ success: boolean; message: string }> => {
    const auth = FirebaseService.getAuth();
    const user = auth.currentUser;
    if (!user || !user.email) return { success: false, message: 'No active session.' };
    try {
      const cred = EmailAuthProvider.credential(user.email, oldPass);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPass);
      return { success: true, message: 'Password updated successfully.' };
    } catch (error: any) {
      return { success: false, message: error?.message || 'Failed to update password.' };
    }
  };

  const sendPasswordReset = async (email: string): Promise<void> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) throw new Error('Please enter a valid email address.');
    await sendPasswordResetEmail(FirebaseService.getAuth(), cleanEmail);
  };

  const saveRegistrationProgress = async (draft: Partial<StaffRegistrationDraft>): Promise<void> => {
    const auth = FirebaseService.getAuth();
    const current = (await StorageService.getStaffRegistrationDraft()) || {
      uid: auth.currentUser?.uid || '',
      name: '',
      email: auth.currentUser?.email || '',
      phone: '',
      designation: 'Sales Executive',
      step: 'details',
      emailVerified: false,
      registeredAt: new Date().toISOString(),
    };
    const updated: StaffRegistrationDraft = { ...current, ...draft };
    await StorageService.saveStaffRegistrationDraft(updated);
    setRegistrationDraft(updated);
  };

  const clearRegistrationProgress = async (): Promise<void> => {
    await StorageService.clearStaffRegistrationDraft();
    setRegistrationDraft(null);
  };

  const checkEmailVerification = async (): Promise<{ verified: boolean; user?: FirebaseUser }> => {
    const auth = FirebaseService.getAuth();
    if (!auth.currentUser) return { verified: false };
    await auth.currentUser.reload();
    const freshUser = auth.currentUser;
    if (freshUser?.emailVerified) {
      await freshUser.getIdToken(true);
      await acceptAuthUser(freshUser);
      return { verified: true, user: freshUser };
    }
    return { verified: false, user: freshUser };
  };

  const restartRegistration = async (): Promise<void> => {
    cleanupProfileListener();
    await signOut(FirebaseService.getAuth()).catch(() => {});
    await StorageService.clearStaffRegistrationDraft();
    setRegistrationDraft(null);
    setCurrentUser(null);
    setAllUsers([]);
    setAuthStatus('unauthenticated');
    setAuthError(null);
  };

  const onRegistrationSubmitted = async (staffProfile: User): Promise<void> => {
    cleanupProfileListener();
    setCurrentUser(staffProfile);
    setAllUsers([staffProfile]);
    await StorageService.setCurrentUser(staffProfile);
    await StorageService.clearStaffRegistrationDraft();
    setRegistrationDraft(null);
    setAuthStatus('approval_pending');
    setAuthError(null);
    setIsLoading(false);
    attachProfileListener(staffProfile.id);
  };

  const value: AuthContextType = useMemo(
    () => ({
      currentUser,
      role: currentUser?.role || 'staff',
      authStatus,
      allUsers,
      isLoading,
      authError,
      registrationDraft,
      retryAuth,
      login,
      logout,
      refreshUsers,
      updateUserProfile,
      changePassword,
      sendPasswordReset,
      saveRegistrationProgress,
      clearRegistrationProgress,
      checkEmailVerification,
      restartRegistration,
      onRegistrationSubmitted,
      isAdmin: currentUser?.role === 'admin',
      isManager: false,
      isStaff: currentUser?.role === 'staff',
    }),
    [
      currentUser,
      authStatus,
      allUsers,
      isLoading,
      authError,
      registrationDraft,
      retryAuth,
      login,
      logout,
      refreshUsers,
      updateUserProfile,
      changePassword,
      sendPasswordReset,
      saveRegistrationProgress,
      clearRegistrationProgress,
      checkEmailVerification,
      restartRegistration,
      onRegistrationSubmitted,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
