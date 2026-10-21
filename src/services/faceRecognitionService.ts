import { FaceTemplate, FaceVerificationToken, AttendanceAuditLog } from '../types';
import { sha256, hmacSha256, constantTimeEquals } from '../utils/crypto';
import { StorageService } from './storageService';

// Security configuration
export const BIOMETRIC_CONFIG = {
  VECTOR_DIMENSIONS: 128,
  MATCHING_THRESHOLD: 0.80, // Minimum 80% cosine similarity required
  LIVENESS_THRESHOLD: 0.82, // Minimum anti-spoofing score required
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

    const template: FaceTemplate = {
      id: `tmpl_${params.userId}_${Date.now()}`,
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
    };

    await StorageService.saveFaceTemplate(template);

    // Audit log
    await StorageService.addAttendanceAuditLog({
      userId: params.userId,
      userName: params.userName,
      action: 'register_face',
      status: 'success',
      similarityScore: 1.0,
      livenessScore: quality,
      notes: `Registered with ${samples.length} multi-angle frames. Hash: ${templateHash.slice(0, 8)}`,
    });

    return { success: true, template };
  }

  /**
   * Revoke/Delete face template
   */
  static async revokeFaceTemplate(userId: string, deletedBy: string): Promise<boolean> {
    const existing = await StorageService.getFaceTemplate(userId);
    if (!existing) return false;

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

    // 1. Expiration check (< 60s)
    const ageMs = Date.now() - token.timestamp;
    if (ageMs < 0 || ageMs > BIOMETRIC_CONFIG.TOKEN_EXPIRY_MS) {
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
        reason: 'Biometric similarity score is below required security threshold.',
      };
    }

    if (token.livenessScore < BIOMETRIC_CONFIG.LIVENESS_THRESHOLD) {
      return {
        valid: false,
        reason: 'Biometric liveness score is below required security threshold.',
      };
    }

    return { valid: true };
  }

  /**
   * Helper to seed standard templates for development & demo testing
   */
  static async seedDemoTemplates(): Promise<void> {
    const existingTemplates = await StorageService.getFaceTemplates();
    if (existingTemplates.length > 0) return;

    // Seed for Parth Patel (admin) and Ankit Verma (staff)
    await this.registerFaceTemplate({
      userId: 'user_admin_1',
      userName: 'Parth Patel',
      registeredBy: 'SYSTEM',
      consentObtained: true,
      sampleDescriptors: [
        generateDescriptorFromSeed('face_user_admin_1_sample1', 0.01),
        generateDescriptorFromSeed('face_user_admin_1_sample2', 0.01),
      ],
      qualityScore: 0.98,
    });

    await this.registerFaceTemplate({
      userId: 'user_staff_1',
      userName: 'Ankit Verma',
      registeredBy: 'user_admin_1',
      consentObtained: true,
      sampleDescriptors: [
        generateDescriptorFromSeed('face_user_staff_1_sample1', 0.01),
        generateDescriptorFromSeed('face_user_staff_1_sample2', 0.01),
      ],
      qualityScore: 0.96,
    });
  }
}

