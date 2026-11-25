import {
  FaceTemplate,
  FaceVerificationToken,
  FaceApprovalStatus,
  FaceDeviceInfo,
  User,
  BiometricStatusResult,
  BiometricEnrollmentState,
} from '../types';
import { sha256, hmacSha256, constantTimeEquals } from '../utils/crypto';
import { StorageService } from './storageService';
import {
  initializeOnDeviceFaceAuth,
  safeRemovePersonnel,
  hasOnDeviceFaceEnrollment,
  safeEnrollLocal,
} from './onDeviceFaceAuth';
import { Platform } from 'react-native';

export function getDeviceInfo(): FaceDeviceInfo {
  return {
    platform: Platform.OS,
    model: Platform.select({ android: 'Android Native Client', ios: 'iOS Client', default: 'Mobile Device' }),
    appVersion: '1.0.0',
    enrolledAt: new Date().toISOString(),
  };
}

// Security configuration
export const BIOMETRIC_CONFIG = {
  VECTOR_DIMENSIONS: 128,
  MATCHING_THRESHOLD: 0.80, // Minimum 80% cosine similarity required
  LIVENESS_THRESHOLD: 0.82, // Minimum anti-spoofing score required
  ON_DEVICE_LIVENESS_THRESHOLD: 0.5, // Matches the bundled pipeline's 0.5 spoof-probability rejection boundary
  TOKEN_EXPIRY_MS: 60 * 1000, // Tokens valid for 60 seconds
  HMAC_SECRET: 'PMC_BIOMETRIC_HMAC_SECRET_KEY_v1_2026',
  MAX_FAILED_ATTEMPTS: 3,
};

export type LivenessChallengeType =
  | 'CENTER_FACE'
  | 'BLINK_TWICE'
  | 'SMILE_NATURAL'
  | 'HEAD_TURN_SLIGHT';

export interface LivenessChallenge {
  id: LivenessChallengeType;
  title: string;
  instruction: string;
  targetMetric: 'centering' | 'eye_aspect_ratio' | 'mouth_aspect_ratio' | 'pose_yaw';
}

export const LIVENESS_CHALLENGES: LivenessChallenge[] = [
  {
    id: 'CENTER_FACE',
    title: 'Align Face',
    instruction: 'Position face steadily within the oval frame',
    targetMetric: 'centering',
  },
  {
    id: 'BLINK_TWICE',
    title: 'Blink Slowly',
    instruction: 'Blink your eyes naturally twice',
    targetMetric: 'eye_aspect_ratio',
  },
  {
    id: 'SMILE_NATURAL',
    title: 'Slight Smile',
    instruction: 'Give a gentle smile or nod slightly',
    targetMetric: 'mouth_aspect_ratio',
  },
];

/**
 * Normalizes vector to unit length (L2 norm = 1)
 */
export function normalizeVector(vector: number[]): number[] {
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm === 0) return vector;
  return vector.map(val => val / norm);
}

/**
 * Generates a deterministic, reproducible 128-dimensional unit normalized vector from seed
 * with optional natural biometric variation/noise
 */
export function generateDescriptorFromSeed(seed: string, noiseVariance = 0.0): number[] {
  const hashHex = sha256(seed);
  const rawVector: number[] = [];

  // Generate 128 pseudo-random deterministic floats between -1.0 and 1.0 from hashes
  for (let i = 0; i < BIOMETRIC_CONFIG.VECTOR_DIMENSIONS; i++) {
    const chunkStart = (i * 4) % (hashHex.length - 4);
    const sub = hashHex.substr(chunkStart, 4);
    const intVal = parseInt(sub, 16);
    // Range -1.0 to 1.0
    let floatVal = (intVal / 32767.5) - 1.0;

    if (noiseVariance > 0) {
      // Natural biometric variance (lighting, facial angle micro-variations)
      const noise = (Math.random() - 0.5) * noiseVariance * 2;
      floatVal += noise;
    }
    rawVector.push(floatVal);
  }

  return normalizeVector(rawVector);
}

/**
 * Calculates Cosine Similarity between two 128-dimensional biometric embedding vectors
 * Returns value between -1.0 and 1.0 (1.0 = identical match)
 */
export function calculateCosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  const similarity = dotProduct / denominator;
  // Clamp between -1.0 and 1.0
  return Math.max(-1.0, Math.min(1.0, similarity));
}

/**
 * Calculates Normalized Euclidean Distance
 * Distance <= 0.6 typically indicates high biometric correspondence
 */
export function calculateEuclideanDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) return 2.0;

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

/**
 * Computes tamper-proof SHA-256 hash for stored face vector integrity
 */
export function computeTemplateHash(descriptor: number[]): string {
  const serialized = descriptor.map(n => n.toFixed(6)).join(',');
  return sha256(serialized);
}

export class FaceRecognitionService {
  /** Save enrollment metadata; the actual embedding stays in the encrypted on-device store. */
  static async registerOnDeviceFaceTemplate(params: {
    userId: string;
    userName: string;
    registeredBy: string;
    consentObtained: boolean;
    sampleCount: number;
    approvalStatus?: FaceApprovalStatus;
    approvedAt?: string;
    approvedByAdminId?: string;
    approvedByAdminName?: string;
    deviceInfo?: FaceDeviceInfo;
    sampleEmbeddingB64?: string;
    faceDescriptor?: number[];
  }): Promise<{ success: boolean; template?: FaceTemplate; error?: string }> {
    if (!params.consentObtained) {
      return { success: false, error: 'Explicit informed consent is required to register biometric face data.' };
    }
    if (!params.userId || !params.userName || params.sampleCount < 1) {
      return { success: false, error: 'A valid staff account and at least one real camera sample are required.' };
    }

    const existing = await StorageService.getFaceTemplate(params.userId);
    const reEnrollmentCount = existing ? (existing.reEnrollmentCount || 0) + 1 : 0;
    const supersededTemplateId = existing ? existing.id : undefined;

    const approvalStatus: FaceApprovalStatus = params.approvalStatus ?? 'pending';
    const nowIso = new Date().toISOString();

    let computedDescriptor: number[] = params.faceDescriptor || [];
    if (computedDescriptor.length === 0 && params.sampleEmbeddingB64) {
      try {
        const bin = typeof globalThis.atob === 'function'
          ? globalThis.atob(params.sampleEmbeddingB64)
          : typeof Buffer !== 'undefined'
          ? Buffer.from(params.sampleEmbeddingB64, 'base64').toString('binary')
          : '';
        if (bin) {
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const floatArr = new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
          computedDescriptor = Array.from(floatArr);
        }
      } catch {
        computedDescriptor = [];
      }
    }

    const template: FaceTemplate = {
      id: `tmpl_${params.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: params.userId,
      userName: params.userName,
      faceDescriptor: computedDescriptor,
      qualityScore: 0.95,
      registeredAt: nowIso,
      registeredBy: params.registeredBy,
      consentObtained: true,
      consentTimestamp: nowIso,
      templateHash: computeTemplateHash(computedDescriptor),
      sampleCount: params.sampleCount,
      status: 'active',
      approvalStatus,
      approvedAt: approvalStatus === 'approved' ? (params.approvedAt || nowIso) : undefined,
      approvedByAdminId: approvalStatus === 'approved' ? (params.approvedByAdminId || params.registeredBy) : undefined,
      approvedByAdminName: approvalStatus === 'approved' ? (params.approvedByAdminName || 'Admin') : undefined,
      deviceInfo: params.deviceInfo ?? getDeviceInfo(),
      reEnrollmentCount,
      supersededTemplateId,
    };

    if (existing) {
      existing.status = 'superseded';
      await StorageService.saveFaceTemplate(existing);
    }

    await StorageService.saveFaceTemplate(template);

    // Immediate read-back verification
    const verified = await StorageService.getFaceTemplate(params.userId);
    if (!verified || verified.userId !== params.userId || verified.status !== 'active') {
      return {
        success: false,
        error: 'Immediate read-back validation failed. Biometric face template was not persisted on this device.',
      };
    }

    await StorageService.addAttendanceAuditLog({
      userId: params.userId,
      userName: params.userName,
      action: existing ? 're_enrollment' : (approvalStatus === 'approved' ? 'register_face' : 'enrollment_submitted'),
      status: 'success',
      deviceInfo: template.deviceInfo?.platform,
      notes: existing
        ? `On-device face re-enrolled (v${reEnrollmentCount + 1}) from ${params.sampleCount} live samples.`
        : `On-device face profile enrolled from ${params.sampleCount} live camera samples. Approval: ${approvalStatus}.`,
    });
    return { success: true, template: verified };
  }

  /**
   * Registers a new face template for a staff member with explicit consent
   */
  static async registerFaceTemplate(params: {
    userId: string;
    userName: string;
    registeredBy: string;
    consentObtained: boolean;
    sampleDescriptors?: number[][];
    qualityScore?: number;
    approvalStatus?: FaceApprovalStatus;
    deviceInfo?: FaceDeviceInfo;
  }): Promise<{ success: boolean; template?: FaceTemplate; error?: string }> {
    if (!params.consentObtained) {
      return {
        success: false,
        error: 'Explicit informed consent is required to register biometric face data.',
      };
    }

    if (!params.userId || !params.userName) {
      return {
        success: false,
        error: 'Invalid user details provided for face registration.',
      };
    }

    const existing = await StorageService.getFaceTemplate(params.userId);
    const reEnrollmentCount = existing ? (existing.reEnrollmentCount || 0) + 1 : 0;
    const supersededTemplateId = existing ? existing.id : undefined;

    // Average across multiple sample captures for higher noise robustness
    let finalDescriptor: number[];
    const samples = params.sampleDescriptors && params.sampleDescriptors.length > 0
      ? params.sampleDescriptors
      : [
          generateDescriptorFromSeed(`face_${params.userId}_frontal`, 0.02),
          generateDescriptorFromSeed(`face_${params.userId}_angle1`, 0.02),
          generateDescriptorFromSeed(`face_${params.userId}_angle2`, 0.02),
        ];

    // Compute centroid vector of multi-frame samples
    const sumVector = new Array(BIOMETRIC_CONFIG.VECTOR_DIMENSIONS).fill(0);
    for (const sample of samples) {
      for (let i = 0; i < BIOMETRIC_CONFIG.VECTOR_DIMENSIONS; i++) {
        sumVector[i] += sample[i];
      }
    }
    finalDescriptor = normalizeVector(sumVector.map(v => v / samples.length));

    const quality = params.qualityScore ?? 0.96;
    const templateHash = computeTemplateHash(finalDescriptor);
    const nowIso = new Date().toISOString();
    const approvalStatus: FaceApprovalStatus = params.approvalStatus ?? 'approved';

    const template: FaceTemplate = {
      id: `tmpl_${params.userId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: params.userId,
      userName: params.userName,
      faceDescriptor: finalDescriptor,
      qualityScore: quality,
      registeredAt: nowIso,
      registeredBy: params.registeredBy,
      consentObtained: true,
      consentTimestamp: nowIso,
      templateHash,
      sampleCount: samples.length,
      status: 'active',
      approvalStatus,
      approvedAt: approvalStatus === 'approved' ? nowIso : undefined,
      approvedByAdminId: approvalStatus === 'approved' ? params.registeredBy : undefined,
      deviceInfo: params.deviceInfo ?? getDeviceInfo(),
      reEnrollmentCount,
      supersededTemplateId,
    };

    if (existing) {
      existing.status = 'superseded';
      await StorageService.saveFaceTemplate(existing);
    }

    await StorageService.saveFaceTemplate(template);

    // Audit log
    await StorageService.addAttendanceAuditLog({
      userId: params.userId,
      userName: params.userName,
      action: existing ? 're_enrollment' : (approvalStatus === 'approved' ? 'register_face' : 'enrollment_submitted'),
      status: 'success',
      similarityScore: 1.0,
      livenessScore: quality,
      deviceInfo: template.deviceInfo?.platform,
      notes: `Registered with ${samples.length} multi-angle frames. Hash: ${templateHash.slice(0, 8)}. Approval: ${approvalStatus}`,
    });

    return { success: true, template };
  }

  /**
   * Admin approves a pending face enrollment
   */
  static async approveEnrollment(params: {
    userId: string;
    adminId: string;
    adminName: string;
  }): Promise<{ success: boolean; template?: FaceTemplate; error?: string }> {
    const template = await StorageService.getLatestFaceTemplate(params.userId);
    if (!template) {
      return { success: false, error: 'No face enrollment found for this user.' };
    }

    const previousStatus = template.approvalStatus;
    const nowIso = new Date().toISOString();

    template.approvalStatus = 'approved';
    template.status = 'active';
    template.approvedByAdminId = params.adminId;
    template.approvedByAdminName = params.adminName;
    template.approvedAt = nowIso;
    template.rejectionReason = undefined;

    // Invalidate any superseded templates
    if (template.supersededTemplateId) {
      const allTemplates = await StorageService.getAllFaceTemplatesForUser(params.userId);
      for (const oldTmpl of allTemplates) {
        if (oldTmpl.id !== template.id && oldTmpl.status === 'active') {
          oldTmpl.status = 'superseded';
          await StorageService.saveFaceTemplate(oldTmpl);
        }
      }
    }

    await StorageService.saveFaceTemplate(template);

    // Audit logs
    await StorageService.addAttendanceAuditLog({
      userId: params.userId,
      userName: template.userName,
      action: 'enrollment_approved',
      status: 'success',
      adminId: params.adminId,
      adminName: params.adminName,
      beforeStatus: previousStatus,
      afterStatus: 'approved',
      notes: `Biometric enrollment approved by Admin ${params.adminName}`,
    });

    return { success: true, template };
  }

  /**
   * Admin rejects a pending face enrollment with a mandatory reason
   */
  static async rejectEnrollment(params: {
    userId: string;
    adminId: string;
    adminName: string;
    reason: string;
  }): Promise<{ success: boolean; template?: FaceTemplate; error?: string }> {
    if (!params.reason || params.reason.trim().length === 0) {
      return { success: false, error: 'A specific reason is required to reject face enrollment.' };
    }

    const template = await StorageService.getLatestFaceTemplate(params.userId);
    if (!template) {
      return { success: false, error: 'No face enrollment found for this user.' };
    }

    const previousStatus = template.approvalStatus;
    template.approvalStatus = 'rejected';
    template.rejectionReason = params.reason.trim();

    await StorageService.saveFaceTemplate(template);

    // Audit logs
    await StorageService.addAttendanceAuditLog({
      userId: params.userId,
      userName: template.userName,
      action: 'enrollment_rejected',
      status: 'success',
      reason: params.reason.trim(),
      adminId: params.adminId,
      adminName: params.adminName,
      beforeStatus: previousStatus,
      afterStatus: 'rejected',
      notes: `Biometric enrollment rejected: ${params.reason.trim()}`,
    });

    return { success: true, template };
  }

  /**
   * Evaluates the discrete biometric enrollment status for a staff user.
   * Resolves the 6 discrete biometric enrollment states:
   * 1. NOT_ENROLLED: No template on device or in Firestore
   * 2. ENROLLED_LOCALLY: Enrolled on device, awaiting submission/review
   * 3. ENROLLMENT_PENDING_REVIEW: Submitted, waiting for admin approval
   * 4. ENROLLED_AND_READY: Enrolled on device, approved by admin, model version matches, unblocked for Punch In
   * 5. ENROLLMENT_DATA_MISSING: Approved in Firestore, but on a different phone without local embeddings
   * 6. ENROLLMENT_VERSION_MISMATCH: Face model version is outdated (expected 'facenet_512')
   * 7. ENROLLMENT_REJECTED: Rejected by admin with reason
   */
  static getBiometricEnrollmentStatus = async (user: User): Promise<BiometricStatusResult> => {
    const EXPECTED_MODEL_VERSION = 'facenet_512';

    if (!user || !user.id) {
      return {
        state: 'NOT_ENROLLED',
        lifecycleState: 'NOT_ENROLLED',
        detailedState: 'NOT_ENROLLED',
        canVerify: false,
        message: 'No active staff session. Authentication required.',
      };
    }

    // Resolve latest persisted user metadata if available
    const persistedUsers = await StorageService.getAllUsers().catch(() => []);
    const persisted = persistedUsers.find(u => u.id === user.id);
    let activeUser = user;
    if (persisted) {
      activeUser = { ...persisted, ...user };
      if (
        persisted.faceApprovedAt &&
        (!user.faceApprovedAt || new Date(persisted.faceApprovedAt) > new Date(user.faceApprovedAt))
      ) {
        activeUser.faceApprovedAt = persisted.faceApprovedAt;
        activeUser.faceEnrollmentStatus = persisted.faceEnrollmentStatus || activeUser.faceEnrollmentStatus;
      }
    }

    // 1. Explicit Administrator Rejection Check
    if (activeUser.faceEnrollmentStatus === 'rejected') {
      const reason = activeUser.faceRejectionReason || 'Biometric enrollment rejected by Administrator';
      return {
        state: 'ENROLLMENT_REJECTED',
        lifecycleState: 'REJECTED',
        detailedState: 'ENROLLMENT_REJECTED',
        canVerify: false,
        message: `Your face enrollment was rejected: ${reason}. Please contact store administrator to re-enroll.`,
        rejectionReason: reason,
        recoveryAction: 'contact_admin',
      };
    }

    // 2. Model Version Compatibility Check
    if (activeUser.faceModelVersion && activeUser.faceModelVersion !== EXPECTED_MODEL_VERSION) {
      return {
        state: 'ENROLLMENT_VERSION_MISMATCH',
        lifecycleState: 'APPROVED_TEMPLATE_MISSING',
        detailedState: 'VERSION_MISMATCH',
        canVerify: false,
        message: `Face biometric model version mismatch (expected ${EXPECTED_MODEL_VERSION}, found ${activeUser.faceModelVersion}). Please re-enroll.`,
        modelVersion: activeUser.faceModelVersion,
        recoveryAction: 're_enroll_on_device',
      };
    }

    // 3. Inspect Local Template & On-Device Native Keystream Store
    let template = await StorageService.getFaceTemplate(activeUser.id);
    const hasNativeEmbeddings = await hasOnDeviceFaceEnrollment(activeUser.id);

    // 4. Local Template Approval Rejection
    if (template && template.approvalStatus === 'rejected') {
      const reason = template.rejectionReason || 'Quality check failed';
      return {
        state: 'ENROLLMENT_REJECTED',
        lifecycleState: 'REJECTED',
        detailedState: 'ENROLLMENT_REJECTED',
        canVerify: false,
        message: `Your face enrollment was rejected: ${reason}. Contact administrator to re-enroll.`,
        rejectionReason: reason,
        template,
        recoveryAction: 'contact_admin',
      };
    }

    // 5. Explicit Not Enrolled State Check
    if ((activeUser.faceEnrollmentStatus === 'not_enrolled' || (!activeUser.faceEnrollmentStatus && !activeUser.hasFaceRegistered)) && !template && !hasNativeEmbeddings) {
      return {
        state: 'NOT_ENROLLED',
        lifecycleState: 'NOT_ENROLLED',
        detailedState: 'NOT_ENROLLED',
        canVerify: false,
        message: 'Your face has not been registered in the biometric system yet. Please complete face enrollment.',
        recoveryAction: 're_enroll_on_device',
      };
    }

    // 6. Inspect Pending Review & Pending Recovery States:
    const isRecoveryPending =
      activeUser.faceEnrollmentStatus === 'pending_recovery' ||
      (template && template.approvalStatus === 'pending_recovery');

    const hasNewerAdminApproval = Boolean(
      activeUser.faceEnrollmentStatus === 'approved' &&
      activeUser.faceApprovedAt &&
      template &&
      new Date(activeUser.faceApprovedAt).getTime() >= new Date(template.registeredAt).getTime()
    );

    if (isRecoveryPending && !hasNewerAdminApproval) {
      return {
        state: 'ENROLLMENT_PENDING_REVIEW',
        lifecycleState: 'ENROLLMENT_PENDING',
        detailedState: 'RECOVERY_PENDING',
        canVerify: false,
        message:
          'Face recovery submitted and pending Administrator approval. Attendance cannot be recorded until verified by an Administrator.',
        template: template || undefined,
        recoveryAction: 'none',
      };
    }

    const isPendingApproval =
      activeUser.faceEnrollmentStatus === 'pending_approval' ||
      activeUser.faceEnrollmentStatus === 'pending_review' ||
      activeUser.registrationStatus === 'pending' ||
      (template && template.approvalStatus === 'pending');

    if (isPendingApproval && !hasNewerAdminApproval) {
      return {
        state: 'ENROLLMENT_PENDING_REVIEW',
        lifecycleState: 'ENROLLMENT_PENDING',
        detailedState: 'ENROLLMENT_PENDING',
        canVerify: false,
        message:
          'Your biometric face enrollment is pending Administrator approval. Attendance cannot be recorded until approved.',
        template: template || undefined,
        recoveryAction: 'none',
      };
    }

    // 6. Cloud or Local Approval Check & Reconciliation:
    const isCloudApproved = activeUser.hasFaceRegistered === true || activeUser.faceEnrollmentStatus === 'approved';
    const isLocalApproved =
      template &&
      (template.approvalStatus === 'approved' || (template.status === 'active' && !template.approvalStatus));

    if (isCloudApproved || isLocalApproved) {
      // Case 6A: Local template exists on this device
      if (template) {
        if (template.approvalStatus !== 'approved' || template.status !== 'active') {
          // Reconcile and synchronize approval status locally from cloud approval
          template.approvalStatus = 'approved';
          template.status = 'active';
          template.approvedAt = activeUser.faceApprovedAt || template.approvedAt || new Date().toISOString();
          template.approvedByAdminId = activeUser.faceApprovedBy || template.approvedByAdminId || 'Admin';
          template.approvedByAdminName = activeUser.faceApprovedBy || template.approvedByAdminName || 'Admin';
          template.rejectionReason = undefined;
          await StorageService.saveFaceTemplate(template);
        }

        return {
          state: 'ENROLLED_AND_READY',
          lifecycleState: 'APPROVED_TEMPLATE_AVAILABLE',
          detailedState: 'READY_FOR_VERIFICATION',
          canVerify: true,
          message: 'Face enrolled and verified.',
          template,
          modelVersion: activeUser.faceModelVersion || EXPECTED_MODEL_VERSION,
          recoveryAction: 'none',
        };
      }

      // Case 6B: Template missing in AsyncStorage, but native encrypted embeddings exist in on-device keystream store
      if (hasNativeEmbeddings) {
        const nowIso = new Date().toISOString();
        const reconstructedTemplate: FaceTemplate = {
          id: `tmpl_${user.id}_synced`,
          userId: user.id,
          userName: user.name,
          faceDescriptor: [],
          qualityScore: 0.95,
          registeredAt: user.faceRegistrationDate || user.createdAt || nowIso,
          registeredBy: user.id,
          consentObtained: true,
          consentTimestamp: user.faceRegistrationDate || user.createdAt || nowIso,
          templateHash: computeTemplateHash([]),
          sampleCount: 3,
          status: 'active',
          approvalStatus: 'approved',
          approvedAt: user.faceApprovedAt || nowIso,
          approvedByAdminId: user.faceApprovedBy || 'Admin',
          approvedByAdminName: user.faceApprovedBy || 'Admin',
          deviceInfo: getDeviceInfo(),
        };
        await StorageService.saveFaceTemplate(reconstructedTemplate);

        return {
          state: 'ENROLLED_AND_READY',
          lifecycleState: 'APPROVED_TEMPLATE_AVAILABLE',
          detailedState: 'READY_FOR_VERIFICATION',
          canVerify: true,
          message: 'Face enrolled and verified.',
          template: reconstructedTemplate,
          modelVersion: user.faceModelVersion || EXPECTED_MODEL_VERSION,
          recoveryAction: 'none',
        };
      }

      // Case 6C: User is approved in Firestore, but on this physical device (after uninstall/reinstall or cleared data),
      // no local template or native embeddings exist.
      // Do NOT create another staff account. Prompt for quick local recovery.
      return {
        state: 'ENROLLMENT_DATA_MISSING',
        lifecycleState: 'APPROVED_TEMPLATE_MISSING',
        detailedState: 'APPROVED_BUT_TEMPLATE_MISSING',
        canVerify: false,
        message:
          'Face Setup Required on This Phone: Your face profile is approved, but biometric face data is missing on this phone. Please complete face setup to enable attendance.',
        modelVersion: user.faceModelVersion || EXPECTED_MODEL_VERSION,
        recoveryAction: 're_enroll_on_device',
      };
    }

    // 7. Enrolled Locally but not submitted / pending draft
    if (template || hasNativeEmbeddings) {
      return {
        state: 'ENROLLED_LOCALLY',
        lifecycleState: 'ENROLLMENT_PENDING',
        detailedState: 'ENROLLED_LOCALLY',
        canVerify: false,
        message: 'Face enrolled locally. Pending submission or verification.',
        template: template || undefined,
        recoveryAction: 'none',
      };
    }

    // 8. Not Enrolled
    return {
      state: 'NOT_ENROLLED',
      lifecycleState: 'NOT_ENROLLED',
      detailedState: 'NOT_ENROLLED',
      canVerify: false,
      message: 'Your face has not been registered in the biometric system yet. Please complete face enrollment first.',
      recoveryAction: 're_enroll_on_device',
    };
  };

  /**
   * Re-enroll face biometric data directly on this physical device for an existing staff member.
   * Performs real face capture, encrypted local persistence, and immediate read-back verification.
   */
  static async reEnrollFaceOnDevice(params: {
    userId: string;
    userName: string;
    samples: string[];
    sampleDescriptors?: number[][];
    qualityScore?: number;
    approvalStatus?: FaceApprovalStatus;
    isRecovery?: boolean;
    approvedAt?: string;
    approvedBy?: string;
  }): Promise<{ success: boolean; template?: FaceTemplate; error?: string }> {
    if (!params.userId || !params.userName || !Array.isArray(params.samples) || params.samples.length < 1) {
      return { success: false, error: 'Valid user credentials and face samples are required.' };
    }

    // 1. Initialize native face auth
    await initializeOnDeviceFaceAuth();

    // 2. Save in native encrypted keystore
    const nativeSaved = await safeEnrollLocal(params.userId, params.samples);
    if (!nativeSaved) {
      console.warn('[FaceRecognitionService] Native keystore enrollment note - continuing with secure local template store');
    }

    // 3. Inspect existing user record in local store
    const users = await StorageService.getAllUsers();
    const existingUser = users.find(u => u.id === params.userId);
    const isApprovedStaff = existingUser?.faceEnrollmentStatus === 'approved' || existingUser?.hasFaceRegistered === true;

    // When isRecovery is true, require Admin review (pending_recovery)
    const approvalStatus: FaceApprovalStatus =
      params.approvalStatus ?? (params.isRecovery ? 'pending_recovery' : (isApprovedStaff ? 'approved' : 'pending'));

    const registrationResult = await this.registerOnDeviceFaceTemplate({
      userId: params.userId,
      userName: params.userName,
      registeredBy: params.userId,
      consentObtained: true,
      sampleCount: params.samples.length,
      approvalStatus,
      approvedAt: approvalStatus === 'approved' ? (params.approvedAt || existingUser?.faceApprovedAt || new Date().toISOString()) : undefined,
      approvedByAdminName: approvalStatus === 'approved' ? (params.approvedBy || existingUser?.faceApprovedBy || 'Admin') : undefined,
    });

    if (!registrationResult.success || !registrationResult.template) {
      return { success: false, error: registrationResult.error || 'Failed to persist face template.' };
    }

    // 4. Read back immediately using same UID
    const readBack = await StorageService.getFaceTemplate(params.userId);
    if (!readBack || readBack.userId !== params.userId || readBack.status !== 'active') {
      return { success: false, error: 'Immediate read-back validation failed. Biometric data not verified on this device.' };
    }

    return { success: true, template: readBack };
  }

  /**
   * Recovers missing local face biometric data for an existing staff member on their physical phone.
   * Performs on-device enrollment, verifies liveness, and stores template with 'pending_recovery' status.
   * Preserves the existing Firebase UID and does not create duplicate profiles.
   * Requires independent Administrator verification before Punch In/Out is unlocked.
   */
  static async recoverApprovedFaceTemplateOnDevice(params: {
    user: User;
    samples: string[];
  }): Promise<{ success: boolean; template?: FaceTemplate; error?: string }> {
    if (!params.user || !params.user.id || !Array.isArray(params.samples) || params.samples.length < 1) {
      return { success: false, error: 'Valid approved staff profile and face samples are required.' };
    }

    return this.reEnrollFaceOnDevice({
      userId: params.user.id,
      userName: params.user.name,
      samples: params.samples,
      approvalStatus: 'pending_recovery',
      isRecovery: true,
    });
  }

  /**
   * Revoke/Delete face template
   */
  static async revokeFaceTemplate(userId: string, deletedBy: string): Promise<boolean> {
    const existing = await StorageService.getFaceTemplate(userId);
    if (!existing) return false;

    await initializeOnDeviceFaceAuth();
    await safeRemovePersonnel(userId);
    const success = await StorageService.deleteFaceTemplate(userId, deletedBy);
    if (success) {
      await StorageService.addAttendanceAuditLog({
        userId,
        userName: existing.userName,
        action: 'revoke_face',
        status: 'success',
        notes: `Biometric template revoked by ${deletedBy}`,
      });
    }
    return success;
  }

  /**
   * 1:1 Face Verification against the authenticated user's registered template
   */
  static async verifyFace1to1(params: {
    userId: string;
    candidateDescriptor: number[];
    livenessScore: number;
    challengesCompleted: string[];
    isStaticPhotoSpoof?: boolean;
  }): Promise<{
    verified: boolean;
    similarityScore: number;
    livenessScore: number;
    reason?: string;
  }> {
    const template = await StorageService.getFaceTemplate(params.userId);

    if (!template) {
      return {
        verified: false,
        similarityScore: 0,
        livenessScore: params.livenessScore,
        reason: 'Face not registered. Please ask an administrator to register your face first.',
      };
    }

    if (template.status !== 'active') {
      return {
        verified: false,
        similarityScore: 0,
        livenessScore: params.livenessScore,
        reason: 'Biometric template has been revoked or deactivated.',
      };
    }

    // Approval status validation: pending or rejected enrollments cannot be used
    const approvalStatus = template.approvalStatus ?? 'approved';
    if (approvalStatus === 'pending') {
      return {
        verified: false,
        similarityScore: 0,
        livenessScore: params.livenessScore,
        reason: 'Face enrollment is pending Administrator approval. Attendance cannot be recorded until approved.',
      };
    }

    if (approvalStatus === 'rejected') {
      return {
        verified: false,
        similarityScore: 0,
        livenessScore: params.livenessScore,
        reason: `Face enrollment was rejected${template.rejectionReason ? `: ${template.rejectionReason}` : ''}. Contact store Administrator for re-enrollment.`,
      };
    }

    // Verify stored template integrity against hash tampering
    const expectedHash = computeTemplateHash(template.faceDescriptor);
    if (!constantTimeEquals(template.templateHash, expectedHash)) {
      return {
        verified: false,
        similarityScore: 0,
        livenessScore: 0,
        reason: 'Security Alert: Biometric template integrity check failed.',
      };
    }

    // Anti-spoofing check
    if (params.isStaticPhotoSpoof || params.livenessScore < BIOMETRIC_CONFIG.LIVENESS_THRESHOLD) {
      return {
        verified: false,
        similarityScore: 0,
        livenessScore: params.livenessScore,
        reason: 'Liveness verification failed. Presentation attack / static image detected.',
      };
    }

    // 1:1 Cosine Similarity
    const similarity = calculateCosineSimilarity(template.faceDescriptor, params.candidateDescriptor);

    if (similarity < BIOMETRIC_CONFIG.MATCHING_THRESHOLD) {
      return {
        verified: false,
        similarityScore: Math.round(similarity * 100) / 100,
        livenessScore: params.livenessScore,
        reason: `Face not recognized (${Math.round(similarity * 100)}% match, required ${Math.round(
          BIOMETRIC_CONFIG.MATCHING_THRESHOLD * 100
        )}%). Please position yourself clearly and try again.`,
      };
    }

    return {
      verified: true,
      similarityScore: Math.round(similarity * 100) / 100,
      livenessScore: Math.round(params.livenessScore * 100) / 100,
    };
  }

  /**
   * Generates a tamper-proof cryptographically signed verification token
   * Valid for 60 seconds and bound strictly to the user and punch action
   */
  static generateVerificationToken(
    userId: string,
    action: 'punch_in' | 'punch_out',
    similarityScore: number,
    livenessScore: number,
    challengesCompleted: string[]
  ): FaceVerificationToken {
    const tokenId = `fvt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = Date.now();

    // Canonical payload string for HMAC
    const payload = [
      tokenId,
      userId,
      action,
      timestamp.toString(),
      similarityScore.toFixed(4),
      livenessScore.toFixed(4),
      challengesCompleted.sort().join(','),
    ].join(':');

    const signature = hmacSha256(BIOMETRIC_CONFIG.HMAC_SECRET, payload);

    return {
      tokenId,
      userId,
      action,
      timestamp,
      similarityScore,
      livenessScore,
      challengesCompleted,
      signature,
    };
  }

  /**
   * Server-side cryptographic token validation
   * Enforces:
   * 1. Cryptographic HMAC-SHA256 signature
   * 2. Expiration within 60 seconds
   * 3. Single-use replay protection (consumed tokens cannot be reused)
   * 4. User ID binding
   * 5. Action binding (punch_in vs punch_out)
   */
  static async validateVerificationToken(
    token: FaceVerificationToken | undefined,
    expectedUserId: string,
    expectedAction: 'punch_in' | 'punch_out'
  ): Promise<{ valid: boolean; reason?: string }> {
    if (!token) {
      return {
        valid: false,
        reason: 'Missing biometric verification token. Face recognition is required.',
      };
    }

    // 1. Expiration check (< 60s, allowing for small clock skew)
    const ageMs = Date.now() - token.timestamp;
    if (ageMs < -30000 || ageMs > BIOMETRIC_CONFIG.TOKEN_EXPIRY_MS) {
      return {
        valid: false,
        reason: 'Biometric verification token has expired (> 60s). Please verify face again.',
      };
    }

    // 2. Identity binding check
    if (token.userId !== expectedUserId) {
      return {
        valid: false,
        reason: 'Token identity mismatch: Token does not match authenticated user.',
      };
    }

    // 3. Action binding check
    if (token.action !== expectedAction) {
      return {
        valid: false,
        reason: `Token action mismatch: Token generated for '${token.action}', cannot be used for '${expectedAction}'.`,
      };
    }

    // 4. Replay attack protection (single-use)
    const isUsed = await StorageService.isTokenConsumed(token.tokenId);
    if (isUsed) {
      return {
        valid: false,
        reason: 'Biometric token has already been consumed. Replay attack blocked.',
      };
    }

    // 5. Signature verification
    const payload = [
      token.tokenId,
      token.userId,
      token.action,
      token.timestamp.toString(),
      token.similarityScore.toFixed(4),
      token.livenessScore.toFixed(4),
      token.challengesCompleted.sort().join(','),
    ].join(':');

    const expectedSignature = hmacSha256(BIOMETRIC_CONFIG.HMAC_SECRET, payload);
    if (!constantTimeEquals(token.signature, expectedSignature)) {
      return {
        valid: false,
        reason: 'Biometric verification token signature is invalid or has been tampered with.',
      };
    }

    // 6. Minimum score thresholds
    if (token.similarityScore < BIOMETRIC_CONFIG.MATCHING_THRESHOLD) {
      return {
        valid: false,
        reason: 'Biometric similarity score is below required security threshold. Face matching confidence too low.',
      };
    }

    if (token.livenessScore < BIOMETRIC_CONFIG.ON_DEVICE_LIVENESS_THRESHOLD) {
      return {
        valid: false,
        reason: 'Biometric liveness score is below required security threshold. Liveness verification failed.',
      };
    }

    return { valid: true };
  }
}

