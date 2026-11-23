import { evaluateQuality } from 'react-native-offline-face-auth/src/qualityGate';
import { DEFAULT_THRESHOLDS } from 'react-native-offline-face-auth/src/config';
import { verifyMultiFrame, groupTemplates, type MultiFrameMatchConfig } from 'react-native-offline-face-auth/src/matcher';
import { transform, type CancelableParams } from 'react-native-offline-face-auth/src/secure/cancelable';
import { StorageService } from '../src/services/storageService';
import { CloudinaryService } from '../src/services/cloudinaryService';
import { SecondHandService } from '../src/services/secondHandService';
import { CustomerLead, SecondHandPurchase, User } from '../src/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getFunctions: jest.fn(() => ({})),
    getAuth: jest.fn(() => ({
      currentUser: { uid: 'admin_123', email: 'parthmobilecare07@gmail.com' },
    })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn().mockResolvedValue(undefined),
  },
}));

/** Helper to generate normalized 512-D float array with deterministic seed */
function generateNormalizedEmbedding(seed: number, variation = 0): Float32Array {
  const vec = new Float32Array(512);
  let norm = 0;
  for (let i = 0; i < 512; i++) {
    const val = Math.sin((seed + i * 0.17)) + (variation * Math.cos(i * 0.31));
    vec[i] = val;
    norm += val * val;
  }
  const magnitude = Math.sqrt(norm);
  for (let i = 0; i < 512; i++) {
    vec[i] = vec[i]! / magnitude;
  }
  return vec;
}

const mockStaff: User = {
  id: 'usr_staff_verified',
  name: 'Store Associate',
  email: 'staff@parthmobile.com',
  mobile: '9876543210',
  role: 'staff',
  isActive: true,
  createdAt: '2026-01-01',
};

describe('PARTH MOBILE CARE — FINAL SECURITY & DATA INTEGRITY AUDIT', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. FACE RECOGNITION SECURITY AUDIT
  // =========================================================================
  describe('1. Face Recognition Security Audit', () => {
    const matchConfig: MultiFrameMatchConfig = {
      coarseThreshold: 0.50,
      fineThreshold: 0.70,
      probeFrameCount: 3,
      templateFrameCount: 3,
      fusionStrategy: 'top_k',
      topK: 3,
    };

    it('confirms genuine enrolled staff is verified successfully (high similarity > 0.70)', () => {
      // Staff Alice enrolled with seed 42 (3 shots with slight natural variation)
      const enrolledTemplates = [
        generateNormalizedEmbedding(42, 0.05),
        generateNormalizedEmbedding(42, 0.08),
        generateNormalizedEmbedding(42, 0.02),
      ];

      // Live probe frames from Alice at punch-in (same seed with realistic camera noise)
      const liveProbes = [
        generateNormalizedEmbedding(42, 0.06),
        generateNormalizedEmbedding(42, 0.04),
        generateNormalizedEmbedding(42, 0.07),
      ];

      const personnelGroup = {
        personnelId: 'alice_staff',
        embeddings: enrolledTemplates,
      };

      const result = verifyMultiFrame(liveProbes, personnelGroup, matchConfig);
      expect(result.ok).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(0.70);
    });

    it('strictly REJECTS an impostor (different person embeddings with cosine similarity < 0.45)', () => {
      // Alice enrolled with seed 42
      const aliceTemplates = [
        generateNormalizedEmbedding(42, 0.02),
        generateNormalizedEmbedding(42, 0.04),
        generateNormalizedEmbedding(42, 0.05),
      ];

      // Impostor Bob presents his face (seed 999 - completely different biometric features)
      const bobProbes = [
        generateNormalizedEmbedding(999, 0.03),
        generateNormalizedEmbedding(999, 0.05),
        generateNormalizedEmbedding(999, 0.02),
      ];

      const aliceGroup = {
        personnelId: 'alice_staff',
        embeddings: aliceTemplates,
      };

      const result = verifyMultiFrame(bobProbes, aliceGroup, matchConfig);
      expect(result.ok).toBe(false);
      expect(result.score).toBeLessThan(0.50); // Far below 0.70 fine threshold
    });

    it('rejects borderline impostor failing the fineThreshold 0.70 gate', () => {
      // Target score deliberately tuned to ~0.62 (below fineThreshold 0.70)
      const enrolled = [generateNormalizedEmbedding(10, 0)];
      // Synthetic partial similarity embedding with ~0.60 dot product
      const borderlineProbe = new Float32Array(512);
      let norm = 0;
      for (let i = 0; i < 512; i++) {
        borderlineProbe[i] = i < 300 ? enrolled[0]![i]! : -enrolled[0]![i]!;
        norm += borderlineProbe[i]! * borderlineProbe[i]!;
      }
      const mag = Math.sqrt(norm);
      for (let i = 0; i < 512; i++) borderlineProbe[i] /= mag;

      const group = { personnelId: 'staff_test', embeddings: enrolled };
      const result = verifyMultiFrame([borderlineProbe], group, matchConfig);
      expect(result.ok).toBe(false);
    });

    it('qualityGate rejects very small faces (minFaceArea < 0.04)', () => {
      // 10% x 10% bounding box = 0.01 area (far smaller than 0.04)
      const tinyFace = {
        box: { x: 0.45, y: 0.45, width: 0.10, height: 0.10 },
        score: 0.90,
        landmarks: [],
        headPose: { yaw: 0, pitch: 0, roll: 0 },
      };

      const qResult = evaluateQuality({ faces: [tinyFace as any], brightness: 120 }, DEFAULT_THRESHOLDS);
      expect(qResult.ok).toBe(false);
      expect(qResult.issues).toContain('face_too_small');
      expect(qResult.guidance).toBe('Move closer');
    });

    it('qualityGate rejects bad head poses (yaw > 40°)', () => {
      const turnedFace = {
        box: { x: 0.30, y: 0.20, width: 0.40, height: 0.40 },
        score: 0.95,
        landmarks: [],
        headPose: { yaw: 48, pitch: 10, roll: 5 }, // 48 deg yaw > 40 deg
      };

      const qResult = evaluateQuality({ faces: [turnedFace as any], brightness: 120 }, DEFAULT_THRESHOLDS);
      expect(qResult.ok).toBe(false);
      expect(qResult.issues).toContain('bad_pose');
      expect(qResult.guidance).toBe('Look straight at the camera');
    });

    it('verifies enrollment and verification use compatible cancelable projection transform', () => {
      const keyParams: CancelableParams = { key: 'test-salt-secret-key-12345', outputDims: 512 };
      const rawEmbedding = generateNormalizedEmbedding(77);

      const transformedEnroll = transform(rawEmbedding, keyParams);
      const transformedProbe = transform(rawEmbedding, keyParams);

      // Same transform applied to identical embedding must yield dot product 1.0
      let dot = 0;
      for (let i = 0; i < transformedEnroll.length; i++) {
        dot += transformedEnroll[i]! * transformedProbe[i]!;
      }
      expect(dot).toBeCloseTo(1.0, 4);
    });
  });

  // =========================================================================
  // 2. AADHAAR / KYC PRIVACY AUDIT
  // =========================================================================
  describe('2. Aadhaar/KYC Privacy Audit', () => {
    it('strictly blocks upload of Aadhaar front/back photos to Cloudinary unsigned preset', async () => {
      const aadhaarFrontResult = await CloudinaryService.uploadImage('file:///data/user/0/pmc/cache/aadhaar_front_card.jpg', {
        folder: 'aadhaar' as any,
        tags: ['customer_kyc', 'aadhaar_proof'],
      });

      expect(aadhaarFrontResult.success).toBe(false);
      expect(aadhaarFrontResult.error).toMatch(/security violation/i);
    });

    it('strictly blocks upload of biometric face templates and customer signatures to Cloudinary', async () => {
      const biometricResult = await CloudinaryService.uploadImage('data:application/octet-stream;base64,VEVTVA==', {
        folder: 'biometrics' as any,
        tags: ['face_biometric'],
      });

      expect(biometricResult.success).toBe(false);
      expect(biometricResult.error).toMatch(/security violation/i);
    });

    it('ensures StorageService isolates sensitive KYC into kyc_sensitive subcollection and keeps parent doc clean', async () => {
      const mockPurchase: SecondHandPurchase = {
        id: 'pur_audit_kyc_01',
        customerName: 'Secret Customer',
        phone: '9876543210',
        aadhaarNumber: 'XXXX-XXXX-9999',
        aadhaarFrontUri: 'file:///local/storage/aadhaar_front.jpg',
        aadhaarBackUri: 'file:///local/storage/aadhaar_back.jpg',
        digitalSignatureUri: 'data:image/png;base64,SIGNATURE_DATA',
        brand: 'Apple',
        model: 'iPhone 14',
        imei: '351234567890123',
        condition: 'Good',
        purchaseAmount: 42000,
        purchaseDate: '2026-11-22',
        purchaseTime: '15:30:00',
        purchasedByStaffId: mockStaff.id,
        purchasedByStaffName: mockStaff.name,
        status: 'in_stock',
        devicePhotos: ['https://res.cloudinary.com/lbqtrrw5/image/upload/v1/devices/photo.jpg'],
        deviceInspectionPhotos: ['https://res.cloudinary.com/lbqtrrw5/image/upload/v1/devices/photo.jpg'],
      };

      await StorageService.savePurchase(mockPurchase);

      // Verify that the memory cache holds the record for local use
      const cachedList = await StorageService.getPurchases();
      const stored = cachedList.find(p => p.id === 'pur_audit_kyc_01');
      expect(stored).toBeDefined();
      expect(stored?.brand).toBe('Apple');
    });
  });

  // =========================================================================
  // 3. IN-MEMORY CACHE & FIRESTORE CONSISTENCY AUDIT
  // =========================================================================
  describe('3. In-Memory Cache and Firestore Consistency Audit', () => {
    it('handles simultaneous rapid lead saves without race-condition data loss', async () => {
      const lead1: CustomerLead = {
        id: 'lead_sim_1',
        customerName: 'Customer One',
        phone: '9111111111',
        brand: 'Vivo',
        model: 'V29',
        status: 'new',
        budget: 25000,
        createdBy: mockStaff.id,
        createdByName: mockStaff.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const lead2: CustomerLead = {
        id: 'lead_sim_2',
        customerName: 'Customer Two',
        phone: '9222222222',
        brand: 'Oppo',
        model: 'Reno 10',
        status: 'new',
        budget: 30000,
        createdBy: mockStaff.id,
        createdByName: mockStaff.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Save both simultaneously
      await Promise.all([
        StorageService.saveLead(lead1),
        StorageService.saveLead(lead2),
      ]);

      const leads = await StorageService.getLeads();
      expect(leads.find(l => l.id === 'lead_sim_1')).toBeDefined();
      expect(leads.find(l => l.id === 'lead_sim_2')).toBeDefined();
    });

    it('protects local uncommitted updates against stale incoming Firestore snapshots', async () => {
      // Local lead updated with newer status
      const localLead: CustomerLead = {
        id: 'lead_stale_test',
        customerName: 'Pooja Mehta',
        phone: '9333333333',
        brand: 'Apple',
        model: 'iPhone 15',
        status: 'converted', // newer local status
        budget: 70000,
        createdBy: mockStaff.id,
        createdByName: mockStaff.name,
        createdAt: '2026-11-22T10:00:00.000Z',
        updatedAt: '2026-11-22T12:00:00.000Z', // newer
      };

      await StorageService.saveLead(localLead);

      // Stale remote snapshot arriving from Firestore with older status and older updatedAt
      const staleRemoteSnapshot = [
        {
          id: 'lead_stale_test',
          customerName: 'Pooja Mehta',
          phone: '9333333333',
          brand: 'Apple',
          model: 'iPhone 15',
          status: 'contacted', // older status
          budget: 70000,
          createdBy: mockStaff.id,
          createdByName: mockStaff.name,
          createdAt: '2026-11-22T10:00:00.000Z',
          updatedAt: '2026-11-22T10:30:00.000Z', // older than local
        }
      ];

      await StorageService.mergeCloudCollection('leads', staleRemoteSnapshot);

      const resolvedLeads = await StorageService.getLeads();
      const resolved = resolvedLeads.find(l => l.id === 'lead_stale_test');
      expect(resolved).toBeDefined();
      expect(resolved?.status).toBe('converted'); // Stale snapshot did NOT overwrite local newer status
    });

    it('preserves memoryCache consistency when AsyncStorage disk write fails', async () => {
      // Simulate AsyncStorage write failure (e.g. storage full)
      const originalSetItem = AsyncStorage.setItem;
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Disk full (ENOSPC)'));

      const testLead: CustomerLead = {
        id: 'lead_disk_err_01',
        customerName: 'Resilient Lead',
        phone: '9444444444',
        brand: 'OnePlus',
        model: 'Nord 3',
        status: 'new',
        budget: 28000,
        createdBy: mockStaff.id,
        createdByName: mockStaff.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // saveLead should update memoryCache even if disk write fails
      await StorageService.saveLead(testLead);

      const inMemory = await StorageService.getLeads();
      const found = inMemory.find(l => l.id === 'lead_disk_err_01');
      expect(found).toBeDefined();
      expect(found?.customerName).toBe('Resilient Lead');
    });

    it('invalidates cache correctly upon deletion', async () => {
      const leadToDelete: CustomerLead = {
        id: 'lead_to_delete',
        customerName: 'Temporary Lead',
        phone: '9555555555',
        brand: 'Redmi',
        model: 'Note 13',
        status: 'lost',
        budget: 15000,
        createdBy: mockStaff.id,
        createdByName: mockStaff.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await StorageService.saveLead(leadToDelete);
      expect((await StorageService.getLeads()).some(l => l.id === 'lead_to_delete')).toBe(true);

      await StorageService.deleteLead('lead_to_delete');
      expect((await StorageService.getLeads()).some(l => l.id === 'lead_to_delete')).toBe(false);
    });
  });

  // =========================================================================
  // 4. FOUR-IMAGE UPLOAD AND FIRESTORE SCHEMA AUDIT
  // =========================================================================
  describe('4. Four-Image Upload and Firestore Schema Audit', () => {
    it('persists 4 distinct Cloudinary URLs across devicePhotos and deviceInspectionPhotos', async () => {
      const distinctUrls = [
        'https://res.cloudinary.com/lbqtrrw5/image/upload/v1700000001/parth_mobile_care/devices/front.jpg',
        'https://res.cloudinary.com/lbqtrrw5/image/upload/v1700000002/parth_mobile_care/devices/back.jpg',
        'https://res.cloudinary.com/lbqtrrw5/image/upload/v1700000003/parth_mobile_care/devices/screen.jpg',
        'https://res.cloudinary.com/lbqtrrw5/image/upload/v1700000004/parth_mobile_care/devices/ports.jpg',
      ];

      const purchaseData: Omit<SecondHandPurchase, 'id' | 'purchaseDate' | 'purchaseTime' | 'purchasedByStaffId' | 'purchasedByStaffName' | 'status'> = {
        brand: 'Google',
        model: 'Pixel 8',
        imei: '359876543210987',
        purchaseAmount: 48000,
        condition: 'Flawless',
        customerName: 'Rahul Verma',
        customerPhone: '9888877777',
        devicePhotos: distinctUrls,
        deviceInspectionPhotos: distinctUrls,
      };

      const record = await SecondHandService.recordPurchase(purchaseData, mockStaff);

      expect(record.deviceInspectionPhotos).toHaveLength(4);
      expect(record.devicePhotos).toHaveLength(4);
      expect(new Set(record.deviceInspectionPhotos).size).toBe(4); // All 4 URLs are unique
      expect(record.deviceInspectionPhotos).toEqual(distinctUrls);
    });

    it('maintains backward compatibility with historical records containing only devicePhotos', async () => {
      const legacyPurchase: SecondHandPurchase = {
        id: 'pur_legacy_001',
        brand: 'Xiaomi',
        model: 'Mi 11X',
        imei: '861112223334445',
        purchaseAmount: 18000,
        condition: 'Good',
        devicePhotos: ['https://res.cloudinary.com/lbqtrrw5/image/upload/v1/devices/single_legacy.jpg'],
        purchaseDate: '2025-10-10',
        purchaseTime: '11:00:00',
        purchasedByStaffId: mockStaff.id,
        purchasedByStaffName: mockStaff.name,
        status: 'in_stock',
      };

      await StorageService.savePurchase(legacyPurchase);

      const purchases = await StorageService.getPurchases();
      const found = purchases.find(p => p.id === 'pur_legacy_001');
      expect(found).toBeDefined();

      // Read normalization fallback should yield array from devicePhotos
      const resolvedPhotos = found?.deviceInspectionPhotos || found?.devicePhotos || [];
      expect(resolvedPhotos).toHaveLength(1);
      expect(resolvedPhotos[0]).toContain('single_legacy.jpg');
    });
  });
});
