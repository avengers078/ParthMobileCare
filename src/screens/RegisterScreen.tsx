import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Keyboard,
  BackHandler,
  TouchableWithoutFeedback,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  Eye,
  EyeOff,
  User as UserIcon,
  Mail,
  Phone,
  Briefcase,
  Lock,
  CheckCircle,
  ScanFace,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
} from 'lucide-react-native';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  signOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { type AuthResult } from 'react-native-offline-face-auth';

import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { useAuth } from '../context/AuthContext';
import {
  ScreenContainer,
  AppCard,
  PrimaryButton,
  OutlineButton,
  Input,
  KeyboardAwareFormContainer,
} from '../components';
import { OnDeviceFaceAuthView } from '../components/OnDeviceFaceAuthView';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';
import FirebaseService from '../services/firebase';
import { StorageService } from '../services/storageService';
import { DeviceSecurityService } from '../services/deviceSecurityService';
import { FaceRecognitionService } from '../services/faceRecognitionService';
import { safeCheckDuplicate, safeEnrollLocal } from '../services/onDeviceFaceAuth';

const APP_LOGO = require('../assets/logo.png');
const REQUIRED_SAMPLES = 3;

interface RegisterScreenProps {
  navigation: any;
}

type RegistrationStep = 'details' | 'verify_email' | 'face_enrollment' | 'submitting';

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { showSuccess, showError, showWarning } = useAlert();
  const {
    authStatus,
    registrationDraft,
    saveRegistrationProgress,
    clearRegistrationProgress,
    checkEmailVerification,
    restartRegistration,
    onRegistrationSubmitted,
  } = useAuth();

  const [step, setStep] = useState<RegistrationStep>('details');
  const [createdUser, setCreatedUser] = useState<FirebaseUser | null>(null);
  const [submittingSlow, setSubmittingSlow] = useState(false);

  useEffect(() => {
    let t: any = null;
    if (step === 'submitting') {
      t = setTimeout(() => setSubmittingSlow(true), 4000);
    } else {
      setSubmittingSlow(false);
    }
    return () => {
      if (t) clearTimeout(t);
    };
  }, [step]);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [designation, setDesignation] = useState('Sales Executive');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Keyboard awareness and scrolling refs
  const scrollViewRef = useRef<any>(null);
  const nameInputRef = useRef<any>(null);
  const emailInputRef = useRef<any>(null);
  const phoneInputRef = useRef<any>(null);
  const designationInputRef = useRef<any>(null);
  const passwordInputRef = useRef<any>(null);
  const confirmPasswordInputRef = useRef<any>(null);

  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // Email verification state
  const [checkingVerification, setCheckingVerification] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  // Face enrollment state
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [sessionKey, setSessionKey] = useState(1);
  const [sampleCount, setSampleCount] = useState(0);
  const [faceError, setFaceError] = useState('');
  const samplesRef = useRef<string[]>([]);
  const isCapturingRef = useRef(false);
  const isSubmittingRef = useRef(false);
  // Store the first sample's descriptor for Firestore cross-device duplicate detection
  const faceDescriptorRef = useRef<number[]>([]);

  // 1. Resume saved registration state from storage & auth state
  useEffect(() => {
    if (registrationDraft) {
      if (registrationDraft.name && !name) setName(registrationDraft.name);
      if (registrationDraft.email && !email) setEmail(registrationDraft.email);
      if (registrationDraft.phone && !phone) setPhone(registrationDraft.phone);
      if (registrationDraft.designation && !designation) setDesignation(registrationDraft.designation);
    }

    const currentAuth = FirebaseService.getAuth().currentUser;
    if (currentAuth) {
      setCreatedUser(currentAuth);
      if (currentAuth.email && !email) setEmail(currentAuth.email);
    }

    if (authStatus === 'face_enrollment_pending' || registrationDraft?.step === 'face_enrollment') {
      setStep('face_enrollment');
    } else if (authStatus === 'authenticated_unverified' || registrationDraft?.step === 'verify_email') {
      setStep('verify_email');
    }
  }, [authStatus, registrationDraft]);

  // 2. Automatically detect email verification when app resumes from background (e.g. Gmail / Browser)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && step === 'verify_email') {
        try {
          const res = await checkEmailVerification();
          if (res.verified) {
            await saveRegistrationProgress({ step: 'face_enrollment', emailVerified: true });
            setStep('face_enrollment');
            showSuccess('Email Verified!', 'Your email confirmation was detected. Please complete face enrollment.');
          }
        } catch (_) {}
      }
    };

    const sub = AppState.addEventListener('change', handleAppStateChange);
    return () => sub.remove();
  }, [step]);

  // Validation for Step 1
  const validateForm = (): boolean => {
    if (!name.trim() || name.trim().length < 2) {
      showWarning('Validation Error', 'Full Name must be at least 2 characters.');
      return false;
    }
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      showWarning('Validation Error', 'Please enter a valid email address.');
      return false;
    }
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      showWarning('Validation Error', 'Please enter a valid 10-digit mobile number.');
      return false;
    }
    if (!designation.trim()) {
      showWarning('Validation Error', 'Please enter your designation or job title.');
      return false;
    }
    if (!password || password.length < 6) {
      showWarning('Validation Error', 'Password must be at least 6 characters long.');
      return false;
    }
    if (password !== confirmPassword) {
      showWarning('Validation Error', 'Passwords do not match.');
      return false;
    }
    return true;
  };

  // Step 1: Create Firebase Auth Account & Send Verification Email
  const handleProceedToEmailVerification = async () => {
    Keyboard.dismiss();
    if (!validateForm()) return;
    setLoading(true);
    try {
      const auth = FirebaseService.getAuth();
      const cleanEmail = email.trim().toLowerCase();
      let user: FirebaseUser;

      // 1. Persist registration draft BEFORE creating Firebase Auth user so
      // onAuthStateChanged immediately detects an active registration and does not sign out
      await saveRegistrationProgress({
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        designation: designation.trim(),
        step: 'verify_email',
        emailVerified: false,
        registeredAt: new Date().toISOString(),
      });

      try {
        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        user = cred.user;
        await sendEmailVerification(user);
      } catch (createErr: any) {
        if (createErr?.code === 'auth/email-already-in-use') {
          // Attempt sign in to resume if password matches
          try {
            const loginCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
            user = loginCred.user;
            await user.reload();
            if (!user.emailVerified) {
              await sendEmailVerification(user).catch(() => {});
            }
          } catch {
            throw new Error('An account with this email already exists. Please sign in or use a different email.');
          }
        } else {
          throw createErr;
        }
      }

      setCreatedUser(user);
      await saveRegistrationProgress({
        uid: user.uid,
        name: name.trim(),
        email: cleanEmail,
        phone: phone.trim(),
        designation: designation.trim(),
        step: user.emailVerified ? 'face_enrollment' : 'verify_email',
        emailVerified: !!user.emailVerified,
        registeredAt: new Date().toISOString(),
      });

      if (user.emailVerified) {
        setStep('face_enrollment');
        showSuccess('Email Already Verified', 'Proceeding directly to face enrollment.');
      } else {
        setStep('verify_email');
        showSuccess(
          'Verification Email Sent',
          `A verification link has been sent to ${cleanEmail}. Please verify before continuing.`
        );
      }
    } catch (err: any) {
      showError('Registration Error', err?.message || 'Failed to initialize account.');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  // Step 2: Check Email Verification
  const handleCheckEmailVerified = async () => {
    Keyboard.dismiss();
    setCheckingVerification(true);
    try {
      const result = await checkEmailVerification();
      if (result.verified) {
        await saveRegistrationProgress({ step: 'face_enrollment', emailVerified: true });
        setStep('face_enrollment');
        showSuccess('Email Verified!', 'Your email has been confirmed. Now proceed with face enrollment.');
      } else {
        showWarning(
          'Email Not Verified Yet',
          'We have not detected your email confirmation yet. Please check your inbox or spam folder and tap the verification link, then tap this button again.'
        );
      }
    } catch (err: any) {
      showError('Verification Check Failed', err?.message || 'Could not verify email status.');
    } finally {
      setCheckingVerification(false);
    }
  };

  const handleResendVerificationEmail = async () => {
    const auth = FirebaseService.getAuth();
    const userToResend = createdUser || auth.currentUser;
    if (!userToResend) return;
    setResendingEmail(true);
    try {
      await sendEmailVerification(userToResend);
      showSuccess('Email Resent', 'A fresh verification link has been sent to your email.');
    } catch (err: any) {
      showError('Resend Failed', err?.message || 'Failed to resend verification email.');
    } finally {
      setResendingEmail(false);
    }
  };

  // Step 3: Handle Face Capture
  const handleFaceCaptureResult = async (result: AuthResult) => {
    const auth = FirebaseService.getAuth();
    const activeUser = createdUser || auth.currentUser;

    // Strict atomic check: immediately drop any incoming frames if already processing,
    // if required samples are already collected, if not in face_enrollment step, or if user is missing
    if (
      isCapturingRef.current ||
      samplesRef.current.length >= REQUIRED_SAMPLES ||
      step !== 'face_enrollment' ||
      !activeUser
    ) {
      return;
    }

    if (!result.ok || !result.challengePassed || !result.embeddingB64) {
      if (!result.ok) {
        setFaceError(
          result.failureReason === 'liveness_failed' || result.failureReason === 'challenge_failed'
            ? 'Liveness check failed. Please look straight into the camera and follow prompts.'
            : 'Could not capture a clear face image. Please try again.'
        );
      }
      return;
    }

    // Acquire lock synchronously BEFORE awaiting any async operations
    isCapturingRef.current = true;
    setLoading(true);
    setFaceError('');

    try {
      const duplicate = await safeCheckDuplicate(result.embeddingB64, activeUser.uid);
      if (duplicate.isDuplicate && duplicate.personnelId && duplicate.personnelId !== activeUser.uid) {
        // Permanent hard-lock: immediately drop all future frames and invalidate capture attempt
        isCapturingRef.current = true;
        samplesRef.current = [];
        setSampleCount(0);
        setLoading(false);
        const duplicateMsg = `Biometric Conflict: This face is already enrolled under staff account (${duplicate.personnelName || 'Existing Staff'}). Duplicate face registration is strictly prohibited.`;
        setFaceError(duplicateMsg);
        showError('Biometric Conflict Detected', duplicateMsg);
        return;
      }

      // Guard check: ensure we do not exceed required samples
      if (samplesRef.current.length >= REQUIRED_SAMPLES) {
        return;
      }

      samplesRef.current = [...samplesRef.current, result.embeddingB64];
      const currentCount = Math.min(samplesRef.current.length, REQUIRED_SAMPLES);
      setSampleCount(currentCount);

      // Store the first sample's decoded descriptor for Firestore cross-device check
      if (samplesRef.current.length === 1) {
        try {
          const bin = typeof globalThis.atob === 'function'
            ? globalThis.atob(result.embeddingB64)
            : typeof Buffer !== 'undefined'
            ? Buffer.from(result.embeddingB64, 'base64').toString('binary')
            : '';
          if (bin) {
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const floatArr = new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
            faceDescriptorRef.current = Array.from(floatArr);
          }
        } catch {
          // Non-fatal: descriptor will remain empty
        }
      }

      if (currentCount < REQUIRED_SAMPLES) {
        // Cooldown period: give user time to acknowledge sample capture and stabilize
        await new Promise((resolve) => setTimeout(resolve, 1200));
        setSessionKey((prev) => prev + 1);
        isCapturingRef.current = false;
        setLoading(false);
        return;
      }

      // Exactly REQUIRED_SAMPLES (3) collected! Keep isCapturingRef = true permanently.
      await safeEnrollLocal(activeUser.uid, samplesRef.current);
      const regRes = await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: activeUser.uid,
        userName: name.trim(),
        registeredBy: activeUser.uid,
        consentObtained: true,
        sampleCount: REQUIRED_SAMPLES,
        approvalStatus: 'pending',
        sampleEmbeddingB64: samplesRef.current[0],
      });

      if (!regRes.success || !regRes.template) {
        throw new Error(regRes.error || 'Could not verify biometric template persistence on this device.');
      }

      // Immediate read-back verification of template integrity
      const verifiedTemplate = await StorageService.getFaceTemplate(activeUser.uid);
      if (!verifiedTemplate || verifiedTemplate.userId !== activeUser.uid || verifiedTemplate.status !== 'active') {
        throw new Error('Biometric data read-back verification failed on this device. Please retry face enrollment.');
      }

      await saveRegistrationProgress({ step: 'submitting', sampleCount: REQUIRED_SAMPLES });

      // Advance to Step 4: Submission
      await handleSubmitRegistration(activeUser);
    } catch (err: any) {
      setFaceError(err?.message || 'Failed to process face sample.');
      isCapturingRef.current = false;
      setLoading(false);
    }
  };

  // Step 4: Final Document Submission to Firestore
  const handleSubmitRegistration = async (user: FirebaseUser) => {
    if (isSubmittingRef.current) {
      return;
    }
    isSubmittingRef.current = true;
    Keyboard.dismiss();
    setStep('submitting');
    setLoading(true);
    try {
      const auth = FirebaseService.getAuth();
      const currentUser = auth.currentUser || user;

      if (!currentUser) {
        showError('Session Expired', 'Authentication session not found. Please return to step 1 and sign up.');
        setStep('details');
        return;
      }

      // 1. Force reload user from Firebase Auth to ensure latest verification state
      try {
        await currentUser.reload();
      } catch (reloadErr: any) {
        if (__DEV__) console.warn('[RegistrationSubmit] User reload warning:', reloadErr);
        if (reloadErr?.code === 'auth/network-request-failed' || String(reloadErr?.message).includes('network')) {
          showError('Network Failure', 'Unable to reach Firebase authentication server. Please check your internet connection.');
          return;
        }
      }

      // 2. Check email verification on auth user object
      if (!currentUser.emailVerified) {
        showWarning(
          'Email Not Verified',
          'Please verify your email address via the link sent to your inbox before submitting registration.'
        );
        setStep('verify_email');
        return;
      }

      // 3. Force refresh ID Token so token claims contain email_verified: true
      let idTokenResult = await currentUser.getIdTokenResult(true);
      if (!idTokenResult?.claims?.email_verified) {
        // Retry token refresh once in case of replication latency
        await currentUser.getIdToken(true);
        idTokenResult = await currentUser.getIdTokenResult(true);
        if (!idTokenResult?.claims?.email_verified) {
          showError(
            'Stale Firebase ID Token',
            'Your email verification is confirmed but security token claims are still updating. Please tap Submit Registration again in a few seconds.'
          );
          return;
        }
      }

      // Diagnostic logging (development only - zero sensitive biometrics or credentials)
      if (__DEV__) {
        if (__DEV__) console.log('[RegistrationDiagnostics]', {
          uid: currentUser.uid,
          email: currentUser.email,
          emailVerifiedOnUser: currentUser.emailVerified,
          emailVerifiedInTokenClaims: idTokenResult.claims.email_verified,
          documentPath: `users/${currentUser.uid}`,
          operation: 'setDoc',
        });
      }

      const activeDraft = registrationDraft || (await StorageService.getStaffRegistrationDraft());
      const staffName = (name.trim() || activeDraft?.name || currentUser.displayName || 'Staff Member').trim();
      // Ensure email matches currentUser.email exactly as registered in Firebase Auth (canonical lowercase)
      const staffEmail = (currentUser.email || email.trim() || activeDraft?.email || '').trim().toLowerCase();
      const staffPhone = (phone.trim() || activeDraft?.phone || '').trim();
      const staffDesignation = (designation.trim() || activeDraft?.designation || 'Sales Executive').trim();

      // Payload validation
      if (!staffName || staffName.length < 1 || staffName.length > 100) {
        showError('Invalid Registration Payload', 'Full Name must be between 1 and 100 characters.');
        return;
      }
      if (!staffEmail || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(staffEmail)) {
        showError('Invalid Registration Payload', 'A valid email address is required.');
        return;
      }
      if (!staffPhone || staffPhone.length < 7 || staffPhone.length > 20) {
        showError('Invalid Registration Payload', 'A valid phone number (between 7 and 20 digits) is required.');
        return;
      }
      if (!staffDesignation || staffDesignation.length < 1 || staffDesignation.length > 100) {
        showError('Invalid Registration Payload', 'Designation must be between 1 and 100 characters.');
        return;
      }

      const deviceInfo = await DeviceSecurityService.getDeviceInfo();
      const nowIso = new Date().toISOString();
      const userDocRef = doc(FirebaseService.getFirestore(), 'users', currentUser.uid);

      if (userDocRef.id !== currentUser.uid) {
        showError('Security Error', 'Authenticated user ID does not match target document path.');
        return;
      }

      // On resubmission, preserve immutable existing metadata if document already exists
      const existingDocSnap = await getDoc(userDocRef).catch(() => null);
      const existingData = existingDocSnap && existingDocSnap.exists() ? existingDocSnap.data() : null;

      const createdAt = existingData?.createdAt || nowIso;
      const createdBy = existingData?.createdBy || currentUser.uid;
      const joinedDate = existingData?.joinedDate || nowIso.split('T')[0];

      // If already pending, preserve existing registered device identity for idempotent duplicate submission.
      // Strict verification: zero fake device IDs or synthetic public keys.
      const isPending = existingData?.registrationStatus === 'pending';
      const rawDeviceId = isPending && existingData?.deviceId
        ? existingData.deviceId
        : deviceInfo?.installationId?.trim();

      const rawPublicKey = isPending && existingData?.devicePublicKey
        ? existingData.devicePublicKey
        : deviceInfo?.publicKey?.trim();

      if (!rawDeviceId || rawDeviceId.length < 1 || rawDeviceId.length > 100) {
        showError(
          'Device Registration Error',
          'A hardware-backed installation identifier could not be verified on this device. Please grant credentials storage and retry.'
        );
        return;
      }

      if (!rawPublicKey || rawPublicKey.length < 1 || rawPublicKey.length > 2000) {
        showError(
          'Device Registration Error',
          'A hardware-backed asymmetric device public key could not be established on this device. Please retry.'
        );
        return;
      }

      const deviceId = rawDeviceId;
      const devicePublicKey = rawPublicKey;

      const deviceModel = (isPending && existingData?.deviceModel)
        ? existingData.deviceModel
        : deviceInfo?.model || 'Mobile Device';

      const rawPlatform = (isPending && existingData?.devicePlatform)
        ? existingData.devicePlatform
        : Platform.OS;
      const devicePlatform = rawPlatform === 'ios' ? 'ios' : 'android';

      const deviceRegisteredAt = (isPending && existingData?.deviceRegisteredAt)
        ? existingData.deviceRegisteredAt
        : nowIso;

      const staffPayload = {
        id: currentUser.uid,
        name: staffName,
        email: staffEmail,
        phone: staffPhone,
        role: 'staff',
        designation: staffDesignation,
        joinedDate,
        basicSalary: 0,
        monthlyTarget: 0,
        isActive: false,
        registrationStatus: 'pending',
        emailVerified: true,
        faceEnrollmentStatus: 'pending_review',
        faceModelVersion: 'facenet_512',
        hasFaceRegistered: false,
        faceRegistrationDate: nowIso,
        // Store face descriptor in Firestore for cross-device duplicate detection
        faceDescriptor: faceDescriptorRef.current.length > 0 ? faceDescriptorRef.current : [],
        deviceId,
        deviceModel,
        devicePlatform,
        deviceRegisteredAt,
        deviceBindingStatus: 'pending_approval',
        devicePublicKey,
        createdAt,
        createdBy,
        _syncedAt: nowIso,
      };

      // 15-second timeout protection around Firestore setDoc
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Registration submission timed out after 15 seconds. Please check your network and retry.')), 15000)
      );

      await Promise.race([
        setDoc(userDocRef, staffPayload, { merge: true }),
        timeoutPromise,
      ]);

      // Immediately synchronize AuthContext state so RootNavigator transitions to RegistrationStatus
      await onRegistrationSubmitted(staffPayload as any);
      await clearRegistrationProgress();
      setLoading(false);
      isSubmittingRef.current = false;

      showSuccess(
        'Registration Submitted',
        'Your staff account has been submitted for Administrator review. Redirecting to status portal...',
        () => {
          if (navigation?.replace) {
            navigation.replace('RegistrationStatus');
          } else if (navigation?.navigate) {
            navigation.navigate('RegistrationStatus');
          }
        }
      );
    } catch (err: any) {
      if (__DEV__) console.warn('[RegistrationSubmit] Submission failed:', {
        code: err?.code,
        message: err?.message,
      });

      const errCode = err?.code;
      const errMsg = String(err?.message || '');

      if (errCode === 'permission-denied') {
        showError(
          'Firestore Permission Denied',
          'Registration submission was rejected by security rules. Ensure your email is confirmed and retry.'
        );
      } else if (errCode === 'unavailable' || errMsg.includes('network') || errMsg.includes('offline') || errMsg.includes('transport')) {
        showError(
          'Network Failure',
          'Unable to connect to Firebase servers. Please check your internet connection and retry.'
        );
      } else if (errCode === 'already-exists') {
        showError(
          'Duplicate Registration',
          'A registration profile already exists for this staff account. Please sign in.'
        );
      } else {
        showError('Submission Failed', errMsg || 'Could not save your registration profile. Please retry.');
      }

      setStep('face_enrollment');
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const handleCancelAndBack = async () => {
    Keyboard.dismiss();
    await restartRegistration();
    navigation?.goBack?.();
  };

  const isStep1Active = true;
  const isLine1Active = step === 'verify_email' || step === 'face_enrollment' || step === 'submitting';
  const isStep2Active = step === 'verify_email' || step === 'face_enrollment' || step === 'submitting';
  const isLine2Active = step === 'face_enrollment' || step === 'submitting';
  const isStep3Active = step === 'face_enrollment' || step === 'submitting';

  return (
    <ScreenContainer scrollable={false} edges={['top', 'left', 'right', 'bottom']} keyboardAvoiding={false}>
      <View style={styles.container}>
        <KeyboardAwareFormContainer
          cardMode={true}
          style={styles.formContainer}
          contentStyle={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          bodyStyle={styles.cardBody}
          autoScrollOnFocus={false}
          onKeyboardChange={(visible, height) => {
            setKeyboardVisible(visible);
            setKeyboardHeight(height);
          }}
          header={
            <View style={styles.headerContainer}>
              {/* Header */}
              <View style={styles.headerBox}>
                <View style={styles.logoContainer}>
                  <Image
                    source={APP_LOGO}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>
                  Create Staff Account
                </Text>
                <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                  Fill in your details to join as store staff.
                </Text>
              </View>

              {/* Stepper Indicator - Centered with equal circle dimensions and equal line lengths */}
              <View style={styles.stepperContainer}>
                <View style={[styles.stepDot, isStep1Active && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, isStep1Active && styles.stepDotTextActive]}>1</Text>
                </View>
                <View style={[styles.stepLine, isLine1Active && styles.stepLineActive]} />
                <View style={[styles.stepDot, isStep2Active && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, isStep2Active && styles.stepDotTextActive]}>2</Text>
                </View>
                <View style={[styles.stepLine, isLine2Active && styles.stepLineActive]} />
                <View style={[styles.stepDot, isStep3Active && styles.stepDotActive]}>
                  <Text style={[styles.stepDotText, isStep3Active && styles.stepDotTextActive]}>3</Text>
                </View>
              </View>
            </View>
          }
          footer={
            !keyboardVisible ? (
              <Text style={[styles.footerText, { color: colors.textMuted }]}>
                Parth Mobile Care • Attendance & Staff Portal
              </Text>
            ) : undefined
          }
        >
          {/* Step 1: Details */}
          {step === 'details' && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                Step 1: Personal Details
              </Text>
              <Text
                numberOfLines={2}
                style={[styles.stepDesc, { color: colors.textSecondary }]}
              >
                Enter your basic details and set a password.
              </Text>

              {/* Full Name Field */}
              <View>
                <Input
                  ref={nameInputRef}
                  label="Full Name *"
                  placeholder="e.g. Ramesh Patel"
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  returnKeyType="next"
                  onSubmitEditing={() => emailInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Email Address Field */}
              <View>
                <Input
                  ref={emailInputRef}
                  label="Email Address *"
                  placeholder="ramesh@parthmobilecare.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => phoneInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Mobile Number Field */}
              <View>
                <Input
                  ref={phoneInputRef}
                  label="Mobile Number *"
                  placeholder="9876543210"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={10}
                  returnKeyType="next"
                  onSubmitEditing={() => designationInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Designation Field */}
              <View>
                <Input
                  ref={designationInputRef}
                  label="Designation *"
                  placeholder="Sales Executive"
                  value={designation}
                  onChangeText={setDesignation}
                  returnKeyType="next"
                  onSubmitEditing={() => passwordInputRef.current?.focus()}
                  blurOnSubmit={false}
                />
              </View>

              {/* Password Field */}
              <View>
                <Input
                  ref={passwordInputRef}
                  label="Password (min. 6 characters) *"
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                  autoCapitalize="none"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmPasswordInputRef.current?.focus()}
                  blurOnSubmit={false}
                  rightIcon={
                    <TouchableOpacity
                      onPress={() => setShowPassword(!showPassword)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                      accessibilityHint="Toggles password visibility"
                    >
                      {showPassword ? (
                        <EyeOff size={20} color={colors.textSecondary} />
                      ) : (
                        <Eye size={20} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  }
                />
              </View>

              {/* Confirm Password Field */}
              <View>
                <Input
                  ref={confirmPasswordInputRef}
                  label="Confirm Password *"
                  placeholder="••••••••"
                  secureTextEntry={!showPassword}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  autoCapitalize="none"
                  returnKeyType="done"
                  onSubmitEditing={handleProceedToEmailVerification}
                />
              </View>

              {/* Actions */}
              <PrimaryButton
                title="Continue"
                onPress={handleProceedToEmailVerification}
                loading={loading}
                size="large"
                icon={<ArrowRight size={18} color="#FFFFFF" />}
                style={{ marginTop: SPACING.md }}
              />

              <OutlineButton
                title="Back to Sign In"
                onPress={handleCancelAndBack}
                size="large"
                style={{ marginTop: SPACING.sm, marginBottom: SPACING.lg }}
              />
            </View>
          )}

          {/* Step 2: Email Verification */}
          {step === 'verify_email' && (
            <View style={styles.stepContent}>
              <View style={styles.stepCenterHeader}>
                <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                  <Mail size={32} color="#2563EB" />
                </View>
                <Text style={[styles.stepTitle, { color: colors.text, textAlign: 'center' }]}>
                  Step 2: Verify Email
                </Text>
                <Text style={[styles.stepDesc, { color: colors.textSecondary, textAlign: 'center' }]}>
                  We sent a verification link to:
                </Text>
                <Text style={[styles.emailHighlight, { color: colors.primary }]}>{email}</Text>
              </View>

              <View
                style={[styles.infoBanner, { backgroundColor: colors.background, borderColor: colors.border }]}
              >
                <Text style={[styles.infoBannerText, { color: colors.textSecondary, textAlign: 'center' }]}>
                  Check your email and tap the verification link. Then return here.
                </Text>
              </View>

              <PrimaryButton
                title="I've Verified My Email"
                onPress={handleCheckEmailVerified}
                loading={checkingVerification}
                size="large"
                icon={<CheckCircle size={18} color="#FFFFFF" />}
                style={{ marginTop: SPACING.md }}
              />

              <OutlineButton
                title="Resend Link"
                onPress={handleResendVerificationEmail}
                loading={resendingEmail}
                size="large"
                icon={<RotateCcw size={18} color={colors.primary} />}
                style={{ marginTop: SPACING.xs }}
              />

              <TouchableOpacity onPress={handleCancelAndBack} style={styles.cancelLink}>
                <Text style={[styles.cancelLinkText, { color: colors.textSecondary }]}>
                  Cancel and Start Over
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 3: Face Enrollment */}
          {step === 'face_enrollment' && (
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>Step 3: Face Verification</Text>
              <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                Position your face inside the frame. Capture all 3 samples to complete verification.
              </Text>

              {/* Consent Card */}
              {!consentAgreed ? (
                <View
                  style={[
                    styles.consentBox,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                >
                  <ShieldCheck size={28} color="#16A34A" style={{ marginBottom: SPACING.xs }} />
                  <Text style={[styles.consentTitle, { color: colors.text }]}>
                    Face Attendance Setup
                  </Text>
                  <Text style={[styles.consentBody, { color: colors.textSecondary }]}>
                    Your face is used only for daily attendance at Parth Mobile Care. Facial data is securely stored on your phone.
                  </Text>
                  <PrimaryButton
                    title="I Agree & Begin"
                    onPress={() => {
                      Keyboard.dismiss();
                      samplesRef.current = [];
                      faceDescriptorRef.current = [];
                      isCapturingRef.current = false;
                      setSampleCount(0);
                      setFaceError('');
                      setSessionKey((prev) => prev + 1);
                      setConsentAgreed(true);
                    }}
                    size="large"
                    style={{ marginTop: SPACING.md, width: '100%' }}
                  />
                </View>
              ) : (
                /* Live Camera Enrollment */
                <View style={styles.cameraSection}>
                  <View style={styles.sampleCounter}>
                    <Text style={[styles.sampleCounterText, { color: colors.primary }]}>
                      {sampleCount} of {REQUIRED_SAMPLES} completed
                    </Text>
                  </View>

                  {faceError ? (
                    <View style={styles.errorBanner}>
                      <Text style={styles.errorText}>{faceError}</Text>
                    </View>
                  ) : null}

                  {sampleCount >= REQUIRED_SAMPLES ? (
                    <View style={{ width: '100%', marginBottom: SPACING.sm }}>
                      <PrimaryButton
                        title="Submit Registration"
                        onPress={() => {
                          const auth = FirebaseService.getAuth();
                          const activeUser = auth.currentUser || createdUser;
                          if (activeUser) handleSubmitRegistration(activeUser);
                        }}
                        loading={loading}
                        size="large"
                      />
                    </View>
                  ) : null}

                  {sampleCount < REQUIRED_SAMPLES ? (
                    <View style={styles.cameraFrame}>
                      <OnDeviceFaceAuthView
                        mode="enroll"
                        personnelId={createdUser?.uid || registrationDraft?.uid || FirebaseService.getAuth().currentUser?.uid}
                        sessionKey={sessionKey}
                        onResult={handleFaceCaptureResult}
                        onClose={() => {
                          samplesRef.current = [];
                          faceDescriptorRef.current = [];
                          isCapturingRef.current = false;
                          setSampleCount(0);
                          setFaceError('');
                          setConsentAgreed(false);
                        }}
                      />
                    </View>
                  ) : (
                    <View
                      style={[
                        styles.cameraFinishedBox,
                        {
                          backgroundColor: isDark ? 'rgba(22,163,74,0.1)' : '#F0FDF4',
                          borderColor: '#16A34A',
                        },
                      ]}
                    >
                      <CheckCircle size={48} color="#16A34A" />
                      <Text style={[styles.completedTitle, { color: colors.text }]}>
                        Face Verification Complete
                      </Text>
                      <Text style={[styles.completedText, { color: colors.textSecondary }]}>
                        All 3 face samples verified and encrypted on this device. Camera has been safely closed.
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Step 4: Submitting */}
          {step === 'submitting' && (
            <View style={[styles.stepContent, { alignItems: 'center', paddingVertical: SPACING.xl }]}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.submittingTitle, { color: colors.text }]}>
                Submitting Registration...
              </Text>
              <Text style={[styles.submittingDesc, { color: colors.textSecondary }]}>
                Setting up your staff profile for store administrator approval.
              </Text>
              {submittingSlow && (
                <View style={{ marginTop: 24, width: '100%', alignItems: 'center' }}>
                  <Text style={[styles.submittingDesc, { color: colors.textSecondary, marginBottom: 12 }]}>
                    Submission taking longer than usual?
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: colors.primary, width: '100%', paddingVertical: 12, alignItems: 'center', borderRadius: RADIUS.md }}
                    onPress={() => {
                      if (navigation?.replace) navigation.replace('RegistrationStatus');
                      else navigation?.navigate('RegistrationStatus');
                    }}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>Check Approval Status</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={{ marginTop: 12, padding: 8 }}
                    onPress={() => {
                      setStep('face_enrollment');
                      setLoading(false);
                      isSubmittingRef.current = false;
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 13, textDecorationLine: 'underline' }}>Retry Face Capture</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </KeyboardAwareFormContainer>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  formContainer: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  card: {
    borderRadius: RADIUS.xl,
  },
  cardBody: {
    padding: SPACING.lg,
  },
  stepContent: {
    width: '100%',
  },
  headerContainer: {
    width: '100%',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  innerContainer: {
    width: '100%',
    alignItems: 'center',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FFFFFF',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  logo: {
    width: 58,
    height: 58,
  },
  title: {
    ...TYPOGRAPHY.titleMedium,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.captionMedium,
    marginTop: 2,
    textAlign: 'center',
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 220,
    paddingHorizontal: SPACING.sm,
    marginTop: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  stepDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotActive: {
    backgroundColor: '#194D9C',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  stepDotTextActive: {
    color: '#FFFFFF',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#E2E8F0',
    marginHorizontal: SPACING.xs,
  },
  stepLineActive: {
    backgroundColor: '#194D9C',
  },
  stepTitle: {
    ...TYPOGRAPHY.titleSmall,
    fontWeight: '800',
    marginBottom: 4,
  },
  stepTitleCompact: {
    fontSize: 15,
    lineHeight: 18,
    marginBottom: 2,
  },
  stepDesc: {
    ...TYPOGRAPHY.bodySmall,
    marginBottom: SPACING.md,
  },
  stepDescCompact: {
    marginBottom: SPACING.xs,
  },
  stepCenterHeader: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  emailHighlight: {
    ...TYPOGRAPHY.subtitleSmall,
    fontWeight: '800',
    marginTop: 4,
  },
  infoBanner: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  infoBannerText: {
    ...TYPOGRAPHY.captionSmall,
    lineHeight: 18,
  },
  cancelLink: {
    marginTop: SPACING.md,
    alignItems: 'center',
    padding: SPACING.xs,
  },
  cancelLinkText: {
    ...TYPOGRAPHY.captionMedium,
    textDecorationLine: 'underline',
  },
  consentBox: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
  },
  consentTitle: {
    ...TYPOGRAPHY.subtitleSmall,
    fontWeight: '800',
    marginBottom: SPACING.xs,
  },
  consentBody: {
    ...TYPOGRAPHY.captionSmall,
    lineHeight: 18,
    textAlign: 'center',
  },
  cameraSection: {
    alignItems: 'center',
  },
  sampleCounter: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    marginBottom: SPACING.xs,
  },
  sampleCounterText: {
    fontSize: 12,
    fontWeight: '700',
  },
  errorBanner: {
    backgroundColor: '#FEE2E2',
    padding: SPACING.xs,
    borderRadius: RADIUS.sm,
    marginBottom: SPACING.xs,
    width: '100%',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 11,
    textAlign: 'center',
  },
  cameraFrame: {
    width: '100%',
    height: 440,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: '#000000',
  },
  cameraFinishedBox: {
    width: '100%',
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: SPACING.md,
  },
  completedTitle: {
    ...TYPOGRAPHY.titleSmall,
    fontWeight: '800',
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  completedText: {
    ...TYPOGRAPHY.captionMedium,
    marginTop: 4,
    textAlign: 'center',
    lineHeight: 18,
  },
  submittingTitle: {
    ...TYPOGRAPHY.titleSmall,
    fontWeight: '800',
    marginTop: SPACING.md,
  },
  submittingDesc: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  footerText: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: SPACING.lg,
  },
});
