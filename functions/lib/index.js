"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerTime = exports.correctAttendanceRecord = exports.rejectStaffEnrollment = exports.approveStaffEnrollment = exports.repairStaffProfile = exports.setStaffAccountStatus = exports.resendStaffInvitation = exports.createStaffAccount = void 0;
exports.normalizePhone = normalizePhone;
exports.normalizeEmail = normalizeEmail;
exports.validateCreateStaffInput = validateCreateStaffInput;
exports.verifyCallerIsActiveAdmin = verifyCallerIsActiveAdmin;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const emailService_1 = require("./emailService");
// Initialize Admin SDK once if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const auth = admin.auth();
/**
 * Validates and normalizes phone number (supports 10-digit Indian numbers or E.164 format)
 */
function normalizePhone(rawPhone) {
    if (!rawPhone || typeof rawPhone !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Phone number is required.');
    }
    const cleaned = rawPhone.replace(/[\s\-\(\)]/g, '').trim();
    const digitsOnly = cleaned.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
        return `+91${digitsOnly}`;
    }
    if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        return `+${digitsOnly}`;
    }
    if (cleaned.startsWith('+') && digitsOnly.length >= 10 && digitsOnly.length <= 15) {
        return cleaned;
    }
    throw new https_1.HttpsError('invalid-argument', 'Enter a valid 10-digit mobile number.');
}
/**
 * Validates and normalizes email
 */
function normalizeEmail(rawEmail) {
    if (!rawEmail || typeof rawEmail !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Email address is required.');
    }
    const email = rawEmail.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email) || email.length > 254) {
        throw new https_1.HttpsError('invalid-argument', 'A valid email address is required.');
    }
    return email;
}
/**
 * Validates incoming staff creation payload
 */
function validateCreateStaffInput(data) {
    if (!data || typeof data !== 'object') {
        throw new https_1.HttpsError('invalid-argument', 'Request payload must be an object.');
    }
    const rawName = data.name;
    if (!rawName || typeof rawName !== 'string' || rawName.trim().length < 2) {
        throw new https_1.HttpsError('invalid-argument', 'Full name is required (at least 2 characters).');
    }
    if (rawName.trim().length > 100) {
        throw new https_1.HttpsError('invalid-argument', 'Full name cannot exceed 100 characters.');
    }
    const name = rawName.trim();
    const email = normalizeEmail(data.email);
    const phone = normalizePhone(data.phone);
    const role = data.role === 'admin' ? 'admin' : 'staff';
    let designation = typeof data.designation === 'string' ? data.designation.trim() : '';
    if (!designation) {
        designation = role === 'admin' ? 'Store Administrator' : 'Sales Executive';
    }
    else if (designation.length > 100) {
        throw new https_1.HttpsError('invalid-argument', 'Designation cannot exceed 100 characters.');
    }
    let basicSalary = 20000;
    if (data.basicSalary !== undefined && data.basicSalary !== null) {
        const parsedSalary = Number(data.basicSalary);
        if (isNaN(parsedSalary) || parsedSalary < 0) {
            throw new https_1.HttpsError('invalid-argument', 'Basic salary must be a non-negative number.');
        }
        basicSalary = Math.round(parsedSalary * 100) / 100;
    }
    let monthlyTarget = 200000;
    if (data.monthlyTarget !== undefined && data.monthlyTarget !== null) {
        const parsedTarget = Number(data.monthlyTarget);
        if (isNaN(parsedTarget) || parsedTarget < 0) {
            throw new https_1.HttpsError('invalid-argument', 'Monthly target must be a non-negative number.');
        }
        monthlyTarget = Math.round(parsedTarget * 100) / 100;
    }
    return {
        name,
        email,
        phone,
        role,
        designation,
        basicSalary,
        monthlyTarget,
    };
}
/**
 * Verifies that the caller is an authenticated and active administrator
 */
async function verifyCallerIsActiveAdmin(callerUid, authUserToken) {
    let callerDocSnap = await db.collection('users').doc(callerUid).get();
    let callerData = callerDocSnap.exists ? (callerDocSnap.data() || {}) : null;
    // Fallback: lookup by email if caller document was created with email key or un-synced UID
    if (!callerData && authUserToken?.email) {
        const emailQuery = await db.collection('users').where('email', '==', authUserToken.email.toLowerCase()).limit(1).get();
        if (!emailQuery.empty) {
            callerData = emailQuery.docs[0].data();
        }
    }
    const isSuperAdminEmail = authUserToken?.email === 'admin@parthmobile.com';
    const hasAdminClaim = authUserToken?.role === 'admin';
    if (!callerData && !isSuperAdminEmail && !hasAdminClaim) {
        throw new https_1.HttpsError('permission-denied', 'Caller profile does not exist in store records. Action forbidden.');
    }
    const callerRole = String(callerData?.role || authUserToken?.role || (isSuperAdminEmail ? 'admin' : '')).toLowerCase();
    if (callerRole !== 'admin') {
        throw new https_1.HttpsError('permission-denied', 'Unauthorized: Only store administrators can provision new accounts.');
    }
    if (callerData && callerData.isActive === false) {
        throw new https_1.HttpsError('permission-denied', 'Caller account is inactive or disabled. Action forbidden.');
    }
    return callerData || { id: callerUid, role: 'admin', isActive: true };
}
/**
 * Callable Cloud Function v2 to create staff accounts with Firebase Admin SDK.
 * Handles validation, Auth user creation, custom claims, Firestore doc creation,
 * initial sales target creation, secure password setup link, and rollback on failure.
 */
exports.createStaffAccount = (0, https_1.onCall)({
    region: 'us-central1',
    maxInstances: 10,
    cors: true,
}, async (request) => {
    // 1. Authenticated caller check
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required. You must be signed in as an administrator to create staff accounts.');
    }
    const callerUid = request.auth.uid;
    // 2. Authorize caller against Firestore trusted record
    await verifyCallerIsActiveAdmin(callerUid, request.auth.token);
    // 3. Validate & normalize inputs
    const validated = validateCreateStaffInput(request.data);
    // 4. Duplicate checks in Auth & Firestore
    try {
        const existingAuthUser = await auth.getUserByEmail(validated.email);
        if (existingAuthUser) {
            throw new https_1.HttpsError('already-exists', `An account with email ${validated.email} already exists in Firebase Auth.`);
        }
    }
    catch (err) {
        if (err instanceof https_1.HttpsError)
            throw err;
        if (err.code !== 'auth/user-not-found') {
            throw new https_1.HttpsError('internal', `Failed to check existing account: ${err.message || err}`);
        }
    }
    const firestoreDuplicate = await db
        .collection('users')
        .where('email', '==', validated.email)
        .limit(1)
        .get();
    if (!firestoreDuplicate.empty) {
        throw new https_1.HttpsError('already-exists', `A staff record with email ${validated.email} already exists in store records.`);
    }
    // 5. Create Firebase Auth User
    let newUid = null;
    try {
        const createdUser = await auth.createUser({
            email: validated.email,
            displayName: validated.name,
            disabled: false,
        });
        newUid = createdUser.uid;
        // Set Custom Claims for security rules
        await auth.setCustomUserClaims(newUid, {
            role: validated.role,
        });
    }
    catch (authError) {
        if (authError.code === 'auth/email-already-exists') {
            throw new https_1.HttpsError('already-exists', 'An account with this email already exists.');
        }
        throw new https_1.HttpsError('internal', `Failed to create Firebase Authentication user: ${authError.message || authError}`);
    }
    // 6. Create Firestore user document and initial sales target with Rollback handling
    const today = new Date();
    const joinedDate = today.toISOString().slice(0, 10);
    const monthKey = joinedDate.substring(0, 7);
    const userDocRef = db.collection('users').doc(newUid);
    const targetDocRef = db.collection('sales_targets').doc(`target_${newUid}_${monthKey}`);
    try {
        const batch = db.batch();
        batch.set(userDocRef, {
            id: newUid,
            name: validated.name,
            email: validated.email,
            phone: validated.phone,
            role: validated.role,
            designation: validated.designation,
            joinedDate,
            basicSalary: validated.basicSalary,
            monthlyTarget: validated.monthlyTarget,
            isActive: true,
            hasFaceRegistered: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: callerUid,
        });
        batch.set(targetDocRef, {
            id: `target_${newUid}_${monthKey}`,
            staffId: newUid,
            staffName: validated.name,
            month: monthKey,
            targetAmount: validated.monthlyTarget,
            achievedAmount: 0,
            targetUnits: 15,
            achievedUnits: 0,
            incentivePercent: 2.0,
            calculatedIncentive: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        await batch.commit();
    }
    catch (dbError) {
        // Rollback Auth user creation to avoid orphaned Auth record
        if (newUid) {
            try {
                await auth.deleteUser(newUid);
                console.warn(`Rollback: Deleted orphaned Auth user ${newUid} after database write failure.`);
            }
            catch (rollbackErr) {
                console.error(`Rollback failed for user ${newUid}:`, rollbackErr);
            }
        }
        throw new https_1.HttpsError('internal', `Failed to write staff profile to database. Creation was aborted: ${dbError.message || dbError}`);
    }
    // 7. Generate secure password setup / invite link
    let inviteLink = '';
    try {
        inviteLink = await auth.generatePasswordResetLink(validated.email);
    }
    catch (linkErr) {
        console.warn(`Could not generate invite link for ${validated.email}:`, linkErr);
        inviteLink = '';
    }
    // 8. Attempt email delivery via configured provider
    let emailDelivered = false;
    let emailProvider;
    let emailError;
    if (inviteLink) {
        try {
            const emailResult = await (0, emailService_1.sendPasswordSetupEmail)({
                to: validated.email,
                name: validated.name,
                inviteLink,
                isResend: false,
            });
            emailDelivered = emailResult.delivered;
            emailProvider = emailResult.provider;
            emailError = emailResult.error;
        }
        catch (err) {
            emailDelivered = false;
            emailError = err?.message || String(err);
        }
    }
    return {
        success: true,
        uid: newUid,
        email: validated.email,
        name: validated.name,
        role: validated.role,
        inviteLink,
        emailDelivered,
        emailProvider,
        emailError,
        message: emailDelivered
            ? 'Staff account created and invitation email sent successfully.'
            : 'Staff account created successfully. Email delivery not configured or pending.',
    };
});
/**
 * Callable function to regenerate a secure password setup / reset invitation link for an active staff member.
 * Only callable by active administrators.
 */
exports.resendStaffInvitation = (0, https_1.onCall)({
    region: 'us-central1',
    maxInstances: 10,
    cors: true,
}, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required. You must be signed in as an administrator.');
    }
    await verifyCallerIsActiveAdmin(request.auth.uid, request.auth.token);
    const email = normalizeEmail(request.data?.email);
    let authUser;
    try {
        authUser = await auth.getUserByEmail(email);
    }
    catch (err) {
        if (err.code === 'auth/user-not-found') {
            throw new https_1.HttpsError('not-found', `No Firebase Auth account found for ${email}.`);
        }
        throw new https_1.HttpsError('internal', `Failed to lookup user: ${err.message || err}`);
    }
    const docSnap = await db.collection('users').doc(authUser.uid).get();
    if (!docSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Staff profile record does not exist in store records.');
    }
    const userData = docSnap.data() || {};
    if (userData.isActive === false) {
        throw new https_1.HttpsError('failed-precondition', 'Cannot send invitation to a deactivated account. Reactivate the account first.');
    }
    const inviteLink = await auth.generatePasswordResetLink(email);
    let emailDelivered = false;
    let emailProvider;
    let emailError;
    try {
        const emailResult = await (0, emailService_1.sendPasswordSetupEmail)({
            to: email,
            name: userData.name || '',
            inviteLink,
            isResend: true,
        });
        emailDelivered = emailResult.delivered;
        emailProvider = emailResult.provider;
        emailError = emailResult.error;
    }
    catch (err) {
        emailDelivered = false;
        emailError = err?.message || String(err);
    }
    return {
        success: true,
        email,
        inviteLink,
        emailDelivered,
        emailProvider,
        emailError,
        message: emailDelivered
            ? 'Password setup invitation emailed successfully.'
            : 'Password setup link regenerated. Email delivery not configured or pending.',
    };
});
/**
 * Callable function to activate or deactivate a staff member.
 * When deactivating, it disables the Auth user, revokes refresh tokens for true server-side invalidation,
 * and updates Firestore.
 */
exports.setStaffAccountStatus = (0, https_1.onCall)({
    region: 'us-central1',
    maxInstances: 10,
    cors: true,
}, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required. You must be signed in as an administrator.');
    }
    await verifyCallerIsActiveAdmin(request.auth.uid, request.auth.token);
    const targetUid = request.data?.uid;
    const isActive = Boolean(request.data?.isActive);
    if (!targetUid || typeof targetUid !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Valid staff UID is required.');
    }
    if (targetUid === request.auth.uid && !isActive) {
        throw new https_1.HttpsError('invalid-argument', 'Administrators cannot deactivate their own account.');
    }
    const targetDocRef = db.collection('users').doc(targetUid);
    const targetDoc = await targetDocRef.get();
    if (!targetDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Staff profile record not found.');
    }
    // Server-side session invalidation & Auth state update
    try {
        if (!isActive) {
            await auth.updateUser(targetUid, { disabled: true });
            await auth.revokeRefreshTokens(targetUid);
        }
        else {
            await auth.updateUser(targetUid, { disabled: false });
        }
    }
    catch (authErr) {
        console.warn(`Auth update warning for ${targetUid}:`, authErr);
    }
    await targetDocRef.update({
        isActive,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        success: true,
        uid: targetUid,
        isActive,
        message: isActive ? 'Account reactivated successfully.' : 'Account deactivated and active sessions revoked.',
    };
});
/**
 * Callable function to inspect and repair an existing Firebase Authentication user's
 * matching Firestore profile without losing records or creating duplicate accounts.
 * Only callable by active store administrators.
 */
exports.repairStaffProfile = (0, https_1.onCall)({
    region: 'us-central1',
    maxInstances: 10,
    cors: true,
}, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required. Only store administrators can repair profiles.');
    }
    await verifyCallerIsActiveAdmin(request.auth.uid, request.auth.token);
    const email = normalizeEmail(request.data?.email);
    const assignedRole = request.data?.defaultRole === 'admin' ? 'admin' : 'staff';
    const designation = request.data?.designation?.trim() || (assignedRole === 'admin' ? 'Store Administrator' : 'Sales Executive');
    let authUser;
    try {
        authUser = await auth.getUserByEmail(email);
    }
    catch (err) {
        if (err.code === 'auth/user-not-found') {
            throw new https_1.HttpsError('not-found', `No Firebase Authentication user exists for ${email}. Create account first.`);
        }
        throw new https_1.HttpsError('internal', `Failed to lookup Auth user: ${err.message || err}`);
    }
    const userDocRef = db.collection('users').doc(authUser.uid);
    const docSnap = await userDocRef.get();
    if (!docSnap.exists) {
        // Create missing Firestore user profile linked to actual Auth UID
        const today = new Date().toISOString().slice(0, 10);
        await userDocRef.set({
            id: authUser.uid,
            name: authUser.displayName || email.split('@')[0],
            email: authUser.email || email,
            phone: authUser.phoneNumber || '+910000000000',
            role: assignedRole,
            designation,
            joinedDate: today,
            basicSalary: 20000,
            monthlyTarget: 200000,
            isActive: !authUser.disabled,
            hasFaceRegistered: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
        });
        // Synchronize custom claims
        await auth.setCustomUserClaims(authUser.uid, { role: assignedRole });
        return {
            success: true,
            uid: authUser.uid,
            email: authUser.email || email,
            role: assignedRole,
            wasCreated: true,
            message: `Created missing Firestore profile for ${email} linked to Auth UID ${authUser.uid}.`,
        };
    }
    // Profile exists — verify and repair role / status
    const existingData = docSnap.data() || {};
    const effectiveRole = (existingData.role === 'admin' || existingData.role === 'staff')
        ? existingData.role
        : assignedRole;
    await userDocRef.update({
        isActive: !authUser.disabled,
        role: effectiveRole,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await auth.setCustomUserClaims(authUser.uid, { role: effectiveRole });
    return {
        success: true,
        uid: authUser.uid,
        email: authUser.email || email,
        role: effectiveRole,
        wasCreated: false,
        message: `Verified and repaired existing profile for ${email} (UID: ${authUser.uid}).`,
    };
});
/**
 * Callable function to approve a staff member's face enrollment.
 * Only callable by active store administrators.
 */
exports.approveStaffEnrollment = (0, https_1.onCall)({
    region: 'us-central1',
    maxInstances: 10,
    cors: true,
}, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required. Only store administrators can approve enrollments.');
    }
    const adminData = await verifyCallerIsActiveAdmin(request.auth.uid, request.auth.token);
    const targetUid = request.data?.targetUid;
    if (!targetUid || typeof targetUid !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Valid target UID is required.');
    }
    const userDocRef = db.collection('users').doc(targetUid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Staff profile record not found.');
    }
    const userData = userDoc.data() || {};
    const now = admin.firestore.FieldValue.serverTimestamp();
    await userDocRef.update({
        hasFaceRegistered: true,
        faceEnrollmentStatus: 'approved',
        faceApprovedAt: now,
        faceApprovedBy: request.auth.uid,
        faceRejectionReason: admin.firestore.FieldValue.delete(),
        updatedAt: now,
    });
    // Write immutable server-side audit log
    await db.collection('attendance_audit_logs').add({
        userId: targetUid,
        userName: userData.name || 'Staff',
        action: 'enrollment_approved',
        status: 'success',
        adminId: request.auth.uid,
        adminName: adminData.name || 'Administrator',
        timestamp: now,
        notes: `Biometric face enrollment approved by ${adminData.name || 'Administrator'}.`,
    });
    return {
        success: true,
        uid: targetUid,
        message: `Biometric face enrollment approved for ${userData.name || targetUid}.`,
    };
});
/**
 * Callable function to reject a staff member's face enrollment with a recorded reason.
 * Only callable by active store administrators.
 */
exports.rejectStaffEnrollment = (0, https_1.onCall)({
    region: 'us-central1',
    maxInstances: 10,
    cors: true,
}, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required. Only store administrators can reject enrollments.');
    }
    const adminData = await verifyCallerIsActiveAdmin(request.auth.uid, request.auth.token);
    const targetUid = request.data?.targetUid;
    const reason = request.data?.reason?.trim();
    if (!targetUid || typeof targetUid !== 'string') {
        throw new https_1.HttpsError('invalid-argument', 'Valid target UID is required.');
    }
    if (!reason || reason.length < 3) {
        throw new https_1.HttpsError('invalid-argument', 'A specific rejection reason (at least 3 characters) is required.');
    }
    const userDocRef = db.collection('users').doc(targetUid);
    const userDoc = await userDocRef.get();
    if (!userDoc.exists) {
        throw new https_1.HttpsError('not-found', 'Staff profile record not found.');
    }
    const userData = userDoc.data() || {};
    const now = admin.firestore.FieldValue.serverTimestamp();
    await userDocRef.update({
        hasFaceRegistered: false,
        faceEnrollmentStatus: 'rejected',
        faceRejectionReason: reason,
        updatedAt: now,
    });
    // Write immutable server-side audit log
    await db.collection('attendance_audit_logs').add({
        userId: targetUid,
        userName: userData.name || 'Staff',
        action: 'enrollment_rejected',
        status: 'success',
        reason,
        adminId: request.auth.uid,
        adminName: adminData.name || 'Administrator',
        timestamp: now,
        notes: `Biometric face enrollment rejected: ${reason}`,
    });
    return {
        success: true,
        uid: targetUid,
        reason,
        message: `Biometric enrollment for ${userData.name || targetUid} rejected: ${reason}`,
    };
});
/**
 * Callable function for manual attendance review and administrative correction.
 * Only callable by active store administrators.
 */
exports.correctAttendanceRecord = (0, https_1.onCall)({
    region: 'us-central1',
    maxInstances: 10,
    cors: true,
}, async (request) => {
    if (!request.auth || !request.auth.uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication required. Only store administrators can correct attendance.');
    }
    const adminData = await verifyCallerIsActiveAdmin(request.auth.uid, request.auth.token);
    const { recordId, targetUid, date, punchInTime, reason } = request.data || {};
    if (!recordId || !targetUid || !date || !punchInTime || !reason?.trim()) {
        throw new https_1.HttpsError('invalid-argument', 'Missing required fields for attendance correction.');
    }
    const now = admin.firestore.FieldValue.serverTimestamp();
    const attendanceDocRef = db.collection('attendance').doc(recordId);
    const userDoc = await db.collection('users').doc(targetUid).get();
    const userData = userDoc.data() || {};
    await attendanceDocRef.set({
        id: recordId,
        userId: targetUid,
        userName: userData.name || 'Staff',
        userRole: userData.role || 'staff',
        date,
        punchInTime,
        status: 'present',
        totalHours: 8,
        isLate: false,
        isEarlyExit: false,
        verificationMethod: 'manual_override',
        notes: `Admin Manual Review Override by ${adminData.name || request.auth.uid}: ${reason.trim()}`,
        correctedByAdminId: request.auth.uid,
        correctionReason: reason.trim(),
        correctedAt: now,
        _syncedAt: new Date().toISOString(),
    }, { merge: true });
    // Write immutable server-side audit log
    await db.collection('attendance_audit_logs').add({
        userId: targetUid,
        userName: userData.name || 'Staff',
        action: 'attendance_corrected',
        status: 'success',
        adminId: request.auth.uid,
        adminName: adminData.name || 'Administrator',
        timestamp: now,
        notes: `Attendance manually corrected for ${date} by ${adminData.name || 'Admin'}. Reason: ${reason.trim()}`,
    });
    return {
        success: true,
        recordId,
        message: `Attendance record ${recordId} successfully corrected by administrator.`,
    };
});
/**
 * Callable function to retrieve trusted server timestamp for anti-clock-tampering verification.
 */
exports.getServerTime = (0, https_1.onCall)({
    region: 'us-central1',
    maxInstances: 20,
    cors: true,
}, async () => {
    return {
        serverTime: new Date().toISOString(),
        timestamp: Date.now(),
    };
});
//# sourceMappingURL=index.js.map