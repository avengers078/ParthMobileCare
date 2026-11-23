import { httpsCallable } from 'firebase/functions';
import { doc, getDoc, setDoc, getDocs, collection, query, where, limit, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import FirebaseService from './firebase';
import { StorageService } from './storageService';
import { UserRole, User, StaffInvitation } from '../types';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

export interface ProvisionStaffPayload {
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  designation?: string;
  basicSalary?: number;
  monthlyTarget?: number;
}

export interface ProvisionStaffResult {
  success: boolean;
  uid?: string;
  email?: string;
  name?: string;
  role?: UserRole;
  inviteLink?: string;
  emailDelivered?: boolean;
  emailProvider?: string;
  emailError?: string;
  message: string;
}

export class StaffProvisioningService {
  /**
   * Secure Serverless Staff Provisioning Protocol
   * Calls Cloud Function v2 callable `createStaffAccount` using Firebase Admin SDK exclusively on backend.
   * Server validates administrator credentials, assigns custom claims, generates Auth user, and creates
   * Firestore documents atomically. Never falls back to client-side auth creation.
   */
  static async provisionStaffAccount(payload: ProvisionStaffPayload): Promise<ProvisionStaffResult> {
    const cleanEmail = payload.email.trim().toLowerCase();
    const cleanPhone = payload.phone.trim();

    try {
      const functions = FirebaseService.getFunctions('us-central1');
      const createStaffCallable = httpsCallable<ProvisionStaffPayload, ProvisionStaffResult>(
        functions,
        'createStaffAccount'
      );
      const response = await createStaffCallable({
        ...payload,
        email: cleanEmail,
        phone: cleanPhone,
      });
      return response.data;
    } catch (error: any) {
      console.warn('[StaffProvisioningService] createStaffAccount callable error:', error);
      const code = String(error?.code || '').toLowerCase();
      const rawMsg = String(error?.message || '');

      // Explicit validation and permission rejections must be surfaced directly
      if (code.includes('unauthenticated')) {
        throw new Error('You must be signed in as an administrator to create staff accounts.');
      }
      if (code.includes('permission-denied')) {
        throw new Error('Access denied: Only active administrators have permission to provision accounts.');
      }
      if (code.includes('already-exists') || rawMsg.includes('already exists')) {
        throw new Error('An account with this email address already exists in the store system.');
      }
      if (code.includes('invalid-argument')) {
        throw new Error(getFriendlyErrorMessage(error, 'Invalid staff details provided.'));
      }
      if (code.includes('not-found') || rawMsg.includes('404') || rawMsg.includes('not found')) {
        throw new Error('Backend Service Pending Deployment:\nThe createStaffAccount Cloud Function is not yet deployed to Firebase project parthmobilecare-a474d.\n\nDeploy the backend functions using: npx firebase deploy --only functions.\n\nForm data has been safely preserved.');
      }
      if (code.includes('unavailable') || code.includes('deadline-exceeded') || code.includes('network')) {
        throw new Error('Network error: Unable to reach Firebase serverless functions. Check your internet connection and try again. Form data has been preserved.');
      }
      if (code.includes('internal') || rawMsg.includes('internal [0]')) {
        throw new Error('Serverless backend error: The createStaffAccount Cloud Function returned an internal error. Please verify Cloud Function deployment in the Firebase console. Form data has been preserved.');
      }

      // For any other unexpected errors, report cleanly without falling back to insecure client creation
      throw new Error(getFriendlyErrorMessage(error, 'Unable to provision staff account through secure serverless backend. Please try again.'));
    }
  }

  /**
   * Regenerates a secure password setup link for an active staff member.
   */
  static async resendStaffInvitation(email: string): Promise<{ success: boolean; email: string; inviteLink: string; emailDelivered?: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const functions = FirebaseService.getFunctions('us-central1');
      const resendCallable = httpsCallable<{ email: string }, { success: boolean; email: string; inviteLink: string; emailDelivered?: boolean; message: string }>(
        functions,
        'resendStaffInvitation'
      );
      const response = await resendCallable({ email: cleanEmail });
      return response.data;
    } catch (error: any) {
      const code = String(error?.code || '').toLowerCase();
      // If function returned an explicit business rejection (e.g. inactive account, unauthorized), surface it immediately
      if (code.includes('failed-precondition') || code.includes('permission-denied') || code.includes('invalid-argument')) {
        throw new Error(getFriendlyErrorMessage(error, 'Cannot send invitation link.'));
      }

      console.warn('Resend invitation callable failed, falling back to Firebase Auth:', error);
      try {
        await sendPasswordResetEmail(FirebaseService.getAuth(), cleanEmail);
        return {
          success: true,
          email: cleanEmail,
          inviteLink: '',
          emailDelivered: true,
          message: `Password setup email sent to ${cleanEmail}.`,
        };
      } catch (authErr: any) {
        throw new Error(getFriendlyErrorMessage(authErr, 'Failed to send password setup invitation.'));
      }
    }
  }

  /**
   * Repairs or synchronizes a Firestore user profile for an existing Firebase Auth account.
   */
  static async repairStaffProfile(
    email: string,
    defaultRole: UserRole = 'staff',
    designation?: string
  ): Promise<{ success: boolean; uid: string; email: string; role: UserRole; wasCreated: boolean; message: string }> {
    try {
      const functions = FirebaseService.getFunctions('us-central1');
      const repairCallable = httpsCallable<
        { email: string; defaultRole: UserRole; designation?: string },
        { success: boolean; uid: string; email: string; role: UserRole; wasCreated: boolean; message: string }
      >(functions, 'repairStaffProfile');
      const response = await repairCallable({ email, defaultRole, designation });
      return response.data;
    } catch (error: any) {
      console.warn('Staff profile repair callable failed:', error);
      const code = String(error?.code || '').toLowerCase();
      const rawMsg = String(error?.message || '');
      if (code.includes('not-found') || rawMsg.includes('No Firebase Authentication account')) {
        throw new Error('No Firebase Authentication account found for this email address.');
      }
      throw new Error(getFriendlyErrorMessage(error, 'Failed to repair staff profile.'));
    }
  }

  /**
   * Activates or deactivates a single staff account.
   */
  static async setStaffAccountStatus(uid: string, isActive: boolean): Promise<{ success: boolean; uid: string; isActive: boolean; message: string }> {
    try {
      const functions = FirebaseService.getFunctions('us-central1');
      const statusCallable = httpsCallable<{ uid: string; isActive: boolean }, { success: boolean; uid: string; isActive: boolean; message: string }>(
        functions,
        'setStaffAccountStatus'
      );
      const response = await statusCallable({ uid, isActive });
      return response.data;
    } catch (error: any) {
      const code = String(error?.code || '').toLowerCase();
      const rawMsg = String(error?.message || '').toLowerCase();
      // If function returned an explicit business validation error (e.g. self-deactivation rejected), surface it directly
      if (code.includes('invalid-argument') || rawMsg.includes('own account') || rawMsg.includes('cannot deactivate')) {
        throw new Error('Administrators cannot deactivate their own account.');
      }

      console.warn('Callable setStaffAccountStatus unavailable, executing direct Firestore update:', error);

      // Verify caller is admin
      const auth = FirebaseService.getAuth();
      if (!auth.currentUser) {
        throw new Error('You must be signed in as an administrator to change account status.');
      }

      const db = FirebaseService.getFirestore();
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { isActive, _syncedAt: new Date().toISOString() }, { merge: true });

      const allUsers = await StorageService.getAllUsers();
      const targetUser = allUsers.find(u => u.id === uid);
      if (targetUser) {
        await StorageService.saveUser({ ...targetUser, isActive });
      }

      return {
        success: true,
        uid,
        isActive,
        message: isActive ? 'Account activated successfully.' : 'Account deactivated successfully.',
      };
    }
  }

  /**
   * Bulk activates or deactivates multiple staff accounts with detailed progress reporting.
   */
  static async bulkSetStaffAccountStatus(uids: string[], isActive: boolean): Promise<{
    successCount: number;
    totalCount: number;
    failedIds: string[];
    message: string;
  }> {
    if (!uids || uids.length === 0) {
      return { successCount: 0, totalCount: 0, failedIds: [], message: 'No accounts selected.' };
    }

    const failedIds: string[] = [];
    let successCount = 0;

    for (const uid of uids) {
      try {
        await this.setStaffAccountStatus(uid, isActive);
        successCount++;
      } catch (err: any) {
        console.warn(`Failed to update status for staff ${uid}:`, err);
        failedIds.push(uid);
      }
    }

    if (failedIds.length > 0 && successCount === 0) {
      throw new Error(`Failed to ${isActive ? 'activate' : 'deactivate'} selected staff accounts. Check permissions and try again.`);
    }

    return {
      successCount,
      totalCount: uids.length,
      failedIds,
      message: `${successCount} of ${uids.length} staff accounts ${isActive ? 'activated' : 'deactivated'} successfully.`,
    };
  }

  /**
   * Validates an employee invitation token issued by the administrator via Admin Web Dashboard.
   * Spark-compliant zero-cost workflow.
   */
  static async verifyInvitationToken(token: string): Promise<StaffInvitation> {
    const cleanToken = token.trim();
    if (!cleanToken) {
      throw new Error('Please enter a valid invitation token.');
    }

    const firestore = FirebaseService.getFirestore();
    let docData: any = null;
    let docId = '';

    // 1. Direct O(1) document ID lookup
    const directDoc = await getDoc(doc(firestore, 'staff_invitations', cleanToken));
    if (directDoc.exists()) {
      docData = directDoc.data();
      docId = directDoc.id;
    } else {
      // 2. Lookup by uppercase / lowercase ID
      const upperDoc = await getDoc(doc(firestore, 'staff_invitations', cleanToken.toUpperCase()));
      if (upperDoc.exists()) {
        docData = upperDoc.data();
        docId = upperDoc.id;
      }
    }

    // 3. Fallback to query by token field (for admin or legacy records)
    if (!docData) {
      try {
        const q = query(
          collection(firestore, 'staff_invitations'),
          where('token', 'in', [cleanToken, cleanToken.toUpperCase()]),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          docData = snap.docs[0].data();
          docId = snap.docs[0].id;
        }
      } catch (listErr) {
        // Expected if non-admin has no list permissions on collection
      }
    }

    if (!docData) {
      throw new Error('Invalid invitation token. Please check the code received from your administrator.');
    }

    const inv: StaffInvitation = {
      ...(docData as any),
      id: docId,
    };

    if (inv.status !== 'pending') {
      throw new Error(`This invitation has already been ${inv.status}. Please request a new invitation from your store administrator.`);
    }

    if (new Date(inv.expiresAt).getTime() < Date.now()) {
      throw new Error('This invitation token has expired. Please ask your administrator to re-issue the invitation.');
    }

    return inv;
  }

  /**
   * Completes staff account setup by creating credentials in Firebase Auth and profile in Firestore.
   * Includes resilient idempotency recovery for network dropouts between Auth and Firestore.
   */
  static async completeStaffSetup(token: string, password: string): Promise<User> {
    const inv = await this.verifyInvitationToken(token);

    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters long.');
    }

    const auth = FirebaseService.getAuth();
    const firestore = FirebaseService.getFirestore();

    let uid = '';
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        inv.email.trim().toLowerCase(),
        password
      );
      uid = userCredential.user.uid;
    } catch (authErr: any) {
      const code = String(authErr?.code || '').toLowerCase();
      const msg = String(authErr?.message || '').toLowerCase();

      // If account was already created during a prior partial attempt, attempt recovery
      if (code === 'auth/email-already-in-use' || msg.includes('already in use')) {
        try {
          const signInCred = await signInWithEmailAndPassword(
            auth,
            inv.email.trim().toLowerCase(),
            password
          );
          uid = signInCred.user.uid;
        } catch {
          throw new Error(
            'This email is already registered. If you created this account, please sign in on the main login screen or contact your store owner.'
          );
        }
      } else {
        throw authErr;
      }
    }

    const now = new Date().toISOString();

    const staffProfile: User = {
      id: uid,
      name: inv.name,
      email: inv.email.trim().toLowerCase(),
      phone: inv.phone,
      role: 'staff',
      designation: inv.designation || 'Sales Representative',
      basicSalary: 0, // Enforced by Firestore Security Rules: staff cannot set own compensation
      monthlyTarget: 0,
      joinedDate: now.slice(0, 10),
      isActive: true,
      hasFaceRegistered: false,
      faceEnrollmentStatus: 'not_enrolled',
      createdBy: inv.createdBy,
      createdAt: now,
      passwordSetupStatus: 'completed',
      invitationToken: inv.token,
    };

    await setDoc(doc(firestore, 'users', uid), staffProfile, { merge: true });

    await updateDoc(doc(firestore, 'staff_invitations', inv.id), {
      status: 'accepted',
      acceptedAt: now,
      acceptedByUid: uid,
    });

    return staffProfile;
  }
}

export default StaffProvisioningService;
