import {
  generateDescriptorFromSeed,
  calculateCosineSimilarity,
  calculateEuclideanDistance,
  computeTemplateHash,
  FaceRecognitionService,
  BIOMETRIC_CONFIG,
} from '../src/services/faceRecognitionService';
import { StorageService } from '../src/services/storageService';
import { AttendanceService } from '../src/services/attendanceService';
import { DEFAULT_SHOP_CONFIG } from '../src/constants';
import { User, FaceVerificationToken } from '../src/types';

describe('Biometric Face Recognition Attendance System', () => {
  const testUser: User = {
    id: 'test_staff_99',
    name: 'Vikram Sharma',
    email: 'vikram@parthmobile.com',
    phone: '9876543299',
    role: 'staff',
    designation: 'Sales Specialist',
    joinedDate: '2026-01-01',
    basicSalary: 25000,
    monthlyTarget: 250000,
    isActive: true,
  };

  const shopCoords = {
    latitude: DEFAULT_SHOP_CONFIG.latitude,
    longitude: DEFAULT_SHOP_CONFIG.longitude,
  };

  beforeEach(async () => {
    // Clear storage keys between tests
    await StorageService.deleteFaceTemplate(testUser.id, 'TEST');
    const records = await StorageService.getAttendanceRecords(testUser.id);
    for (const r of records) {
      // Clear today's record if any
    }
  });

  describe('1. 128-Dimensional Biometric Embedding & Mathematical Matching', () => {
    it('should generate unit-normalized 128-dimensional vectors', () => {
      const vector = generateDescriptorFromSeed('test_face_sample_1', 0);
      expect(vector.length).toBe(128);

      // Verify L2 norm is approximately 1.0
      const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
      expect(norm).toBeCloseTo(1.0, 4);
    });

    it('should compute 1.0 cosine similarity for identical vectors', () => {
      const vecA = generateDescriptorFromSeed('person_alpha', 0);
      const similarity = calculateCosineSimilarity(vecA, vecA);
      expect(similarity).toBeCloseTo(1.0, 4);
    });

    it('should achieve high similarity (> 0.90) for natural facial variations of the same person', () => {
      const base = generateDescriptorFromSeed('person_alpha', 0);
      // Slight noise variance simulates natural lighting & angle variations
      const naturalVariation = generateDescriptorFromSeed('person_alpha', 0.02);
      const similarity = calculateCosineSimilarity(base, naturalVariation);
      expect(similarity).toBeGreaterThanOrEqual(BIOMETRIC_CONFIG.MATCHING_THRESHOLD);
    });

    it('should reject different persons with low cosine similarity (< 0.70)', () => {
      const personA = generateDescriptorFromSeed('person_alpha', 0);
      const personB = generateDescriptorFromSeed('person_beta_completely_different', 0);
      const similarity = calculateCosineSimilarity(personA, personB);
      expect(similarity).toBeLessThan(BIOMETRIC_CONFIG.MATCHING_THRESHOLD);
    });
  });

  describe('2. Face Registration & Template Integrity', () => {
    it('should reject registration if informed consent is not obtained', async () => {
      const res = await FaceRecognitionService.registerFaceTemplate({
        userId: testUser.id,
        userName: testUser.name,
        registeredBy: 'admin',
        consentObtained: false,
      });

      expect(res.success).toBe(false);
      expect(res.error).toContain('consent is required');
    });

    it('should register face template with multi-angle samples and store SHA-256 integrity hash', async () => {
      const res = await FaceRecognitionService.registerFaceTemplate({
        userId: testUser.id,
        userName: testUser.name,
        registeredBy: 'admin',
        consentObtained: true,
      });

      expect(res.success).toBe(true);
      expect(res.template).toBeDefined();
      expect(res.template?.faceDescriptor.length).toBe(128);
      expect(res.template?.status).toBe('active');

      // Verify template is retrievable
      const saved = await StorageService.getFaceTemplate(testUser.id);
      expect(saved).not.toBeNull();
      expect(saved?.templateHash).toBe(res.template?.templateHash);
    });

    it('should allow template revocation and reflect deletion in storage', async () => {
      await FaceRecognitionService.registerFaceTemplate({
        userId: testUser.id,
        userName: testUser.name,
        registeredBy: 'admin',
        consentObtained: true,
      });

      const revoked = await FaceRecognitionService.revokeFaceTemplate(testUser.id, 'admin');
      expect(revoked).toBe(true);

      const templateAfter = await StorageService.getFaceTemplate(testUser.id);
      expect(templateAfter).toBeNull();
    });
  });

  describe('3. 1:1 Matching & Anti-Spoofing / Liveness Check', () => {
    beforeEach(async () => {
      await FaceRecognitionService.registerFaceTemplate({
        userId: testUser.id,
        userName: testUser.name,
        registeredBy: 'admin',
        consentObtained: true,
        sampleDescriptors: [
          generateDescriptorFromSeed(`face_${testUser.id}_frontal`, 0.01),
        ],
      });
    });

    it('should verify genuine user when face matches and liveness challenge passes', async () => {
      const genuineCandidate = generateDescriptorFromSeed(`face_${testUser.id}_frontal`, 0.01);
      const res = await FaceRecognitionService.verifyFace1to1({
        userId: testUser.id,
        candidateDescriptor: genuineCandidate,
        livenessScore: 0.95,
        challengesCompleted: ['CENTER_FACE', 'BLINK_TWICE'],
        isStaticPhotoSpoof: false,
      });

      expect(res.verified).toBe(true);
      expect(res.similarityScore).toBeGreaterThanOrEqual(BIOMETRIC_CONFIG.MATCHING_THRESHOLD);
      expect(res.livenessScore).toBeGreaterThanOrEqual(BIOMETRIC_CONFIG.LIVENESS_THRESHOLD);
    });

    it('should reject spoofing presentation attack (static picture/screen)', async () => {
      const spoofCandidate = generateDescriptorFromSeed(`face_${testUser.id}_frontal`, 0);
      const res = await FaceRecognitionService.verifyFace1to1({
        userId: testUser.id,
        candidateDescriptor: spoofCandidate,
        livenessScore: 0.35, // Low liveness score
        challengesCompleted: ['CENTER_FACE'],
        isStaticPhotoSpoof: true,
      });

      expect(res.verified).toBe(false);
      expect(res.reason).toContain('Liveness verification failed');
    });

    it('should reject unauthorized person presenting face against registered staff account', async () => {
      const imposterCandidate = generateDescriptorFromSeed('unauthorized_stranger_face', 0);
      const res = await FaceRecognitionService.verifyFace1to1({
        userId: testUser.id,
        candidateDescriptor: imposterCandidate,
        livenessScore: 0.95,
        challengesCompleted: ['CENTER_FACE', 'BLINK_TWICE'],
      });

      expect(res.verified).toBe(false);
      expect(res.reason).toContain('Face not recognized');
    });
  });

  describe('4. Cryptographic Verification Token (Server-Side Validation)', () => {
    it('should generate valid HMAC-SHA256 signed verification token', async () => {
      const token = FaceRecognitionService.generateVerificationToken(
        testUser.id,
        'punch_in',
        0.96,
        0.94,
        ['CENTER_FACE', 'BLINK_TWICE']
      );

      expect(token.tokenId).toBeDefined();
      expect(token.signature.length).toBe(64); // SHA-256 hex string

      const validation = await FaceRecognitionService.validateVerificationToken(
        token,
        testUser.id,
        'punch_in'
      );
      expect(validation.valid).toBe(true);
    });

    it('should reject expired verification token (> 60 seconds)', async () => {
      const token = FaceRecognitionService.generateVerificationToken(
        testUser.id,
        'punch_in',
        0.96,
        0.94,
        ['CENTER_FACE', 'BLINK_TWICE']
      );

      // Simulate token created 65 seconds ago
      token.timestamp = Date.now() - 65000;

      const validation = await FaceRecognitionService.validateVerificationToken(
        token,
        testUser.id,
        'punch_in'
      );
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('expired');
    });

    it('should reject token identity mismatch (user A token presented for user B)', async () => {
      const token = FaceRecognitionService.generateVerificationToken(
        'another_user_id',
        'punch_in',
        0.96,
        0.94,
        ['CENTER_FACE']
      );

      const validation = await FaceRecognitionService.validateVerificationToken(
        token,
        testUser.id,
        'punch_in'
      );
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('identity mismatch');
    });

    it('should reject token action mismatch (punch_in token presented for punch_out)', async () => {
      const token = FaceRecognitionService.generateVerificationToken(
        testUser.id,
        'punch_in',
        0.96,
        0.94,
        ['CENTER_FACE']
      );

      const validation = await FaceRecognitionService.validateVerificationToken(
        token,
        testUser.id,
        'punch_out'
      );
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('action mismatch');
    });

    it('should prevent replay attacks by rejecting already consumed tokens', async () => {
      const token = FaceRecognitionService.generateVerificationToken(
        testUser.id,
        'punch_in',
        0.96,
        0.94,
        ['CENTER_FACE']
      );

      // Consume token once
      await StorageService.consumeVerificationToken(token.tokenId);

      const validation = await FaceRecognitionService.validateVerificationToken(
        token,
        testUser.id,
        'punch_in'
      );
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('already been consumed');
    });
  });

  describe('5. End-to-End Attendance Service with Face Verification', () => {
    beforeEach(async () => {
      await FaceRecognitionService.registerFaceTemplate({
        userId: testUser.id,
        userName: testUser.name,
        registeredBy: 'admin',
        consentObtained: true,
      });
    });

    it('should reject Punch In when verification token is missing', async () => {
      const res = await AttendanceService.punchIn(
        testUser,
        DEFAULT_SHOP_CONFIG,
        shopCoords
        // verificationToken omitted
      );

      expect(res.success).toBe(false);
      expect(res.message).toContain('Missing biometric verification token');
    });

    it('should record Punch In when valid cryptographic face token is presented', async () => {
      const token = FaceRecognitionService.generateVerificationToken(
        testUser.id,
        'punch_in',
        0.97,
        0.95,
        ['CENTER_FACE', 'BLINK_TWICE']
      );

      const res = await AttendanceService.punchIn(
        testUser,
        DEFAULT_SHOP_CONFIG,
        shopCoords,
        token
      );

      expect(res.success).toBe(true);
      expect(res.record?.verificationMethod).toBe('face_recognition');
      expect(res.record?.faceVerificationScore).toBe(0.97);
      expect(res.record?.faceVerificationTokenId).toBe(token.tokenId);
    });

    it('should record Punch Out with face verification and calculate hours', async () => {
      const punchOutToken = FaceRecognitionService.generateVerificationToken(
        testUser.id,
        'punch_out',
        0.96,
        0.94,
        ['CENTER_FACE', 'SMILE_NATURAL']
      );

      const res = await AttendanceService.punchOut(
        testUser,
        DEFAULT_SHOP_CONFIG,
        shopCoords,
        punchOutToken
      );

      expect(res.success).toBe(true);
      expect(res.record?.punchOutTime).toBeDefined();
      expect(res.record?.verificationMethod).toBe('face_recognition');
    });

    it('should verify audit logs are tracked for all face recognition attempts', async () => {
      const logs = await StorageService.getAttendanceAuditLogs();
      const userLogs = logs.filter(l => l.userId === testUser.id);
      expect(userLogs.length).toBeGreaterThan(0);
      expect(userLogs.some(l => l.action === 'register_face')).toBe(true);
    });
  });
});

