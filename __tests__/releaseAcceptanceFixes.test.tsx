import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { StorageService } from '../src/services/storageService';
import { CloudinaryService } from '../src/services/cloudinaryService';
import { SecondHandService } from '../src/services/secondHandService';
import { MultiDeviceInspectionCapture } from '../src/components/MultiDeviceInspectionCapture';
import { evaluateQuality, largestFace } from 'react-native-offline-face-auth/src/qualityGate';
import { DEFAULT_THRESHOLDS } from 'react-native-offline-face-auth/src/config';
import { SecondHandPurchase, User } from '../src/types';

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

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#194D9C',
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      danger: '#EF4444',
      success: '#10B981',
    },
    isDark: false,
  }),
}));

const mockUser: User = {
  id: 'usr_staff_001',
  name: 'Store Staff',
  email: 'staff@parthmobile.com',
  mobile: '9876543210',
  role: 'staff',
  isActive: true,
  createdAt: '2026-01-01',
};

describe('Parth Mobile Care — Release Acceptance Fixes Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Area 1: In-Memory Storage Cache Invalidation & Freshness', () => {
    it('invalidates purchase cache upon recording a new second-hand purchase', async () => {
      // Prime memory cache using Map with the exact key
      const initialPurchase = { id: 'pur_initial', brand: 'Apple', model: 'iPhone 13', imei: '111111111111111', status: 'in_stock' as const };
      (StorageService as any).memoryCache.set('@pmc_second_hand_purchases', [initialPurchase]);

      const newPurchase: SecondHandPurchase = {
        id: 'pur_new_001',
        brand: 'Samsung',
        model: 'Galaxy S23',
        imei: '222222222222222',
        purchaseAmount: 35000,
        condition: 'Good',
        devicePhotos: ['https://res.cloudinary.com/lbqtrrw5/image/upload/v1/devices/samsung.jpg'],
        deviceInspectionPhotos: ['https://res.cloudinary.com/lbqtrrw5/image/upload/v1/devices/samsung.jpg'],
        purchaseDate: '2026-11-22',
        purchaseTime: '12:00:00',
        purchasedByStaffId: 'staff_1',
        purchasedByStaffName: 'Chetan',
        status: 'in_stock',
      };

      await StorageService.savePurchase(newPurchase);

      // Verify that the memory cache is refreshed with the new purchase
      const cached = (StorageService as any).memoryCache.get('@pmc_second_hand_purchases');
      expect(cached).toBeDefined();
      const found = cached.find((p: any) => p.id === 'pur_new_001');
      expect(found).toBeTruthy();
      expect(found.brand).toBe('Samsung');
    });
  });

  describe('Area 4: Face Recognition Quality Gate Calibration', () => {
    it('verifies calibrated thresholds are within optimal ranges', () => {
      expect(DEFAULT_THRESHOLDS.centerMargin).toBeLessThanOrEqual(0.04);
      expect(DEFAULT_THRESHOLDS.minFaceArea).toBeLessThanOrEqual(0.10);
      expect(DEFAULT_THRESHOLDS.fineThreshold).toBeLessThanOrEqual(0.72);
      expect(DEFAULT_THRESHOLDS.maxYaw).toBeGreaterThanOrEqual(35);
    });

    it('evaluates quality gate successfully for naturally framed face without false off_center lock', () => {
      // Normal mobile front camera detection coordinates (cy = 0.35, cx = 0.50, width = 0.40, height = 0.40)
      const detectedFace = {
        box: {
          x: 0.30,
          y: 0.15,
          width: 0.40,
          height: 0.40,
        },
        score: 0.95,
        landmarks: [],
        headPose: { yaw: 2, pitch: 3, roll: 0 },
      };

      const result = evaluateQuality(
        { faces: [detectedFace as any], brightness: 120 },
        DEFAULT_THRESHOLDS
      );

      expect(result.ok).toBe(true);
      expect(result.issues).not.toContain('off_center');
      expect(result.issues).not.toContain('face_too_small');
      expect(result.guidance).toBe('');
    });

    it('evaluates off-center correctly only when face is genuinely outside the boundary', () => {
      // Genuine off-center face placed at cx = 0.01 (1% from edge)
      const edgeFace = {
        box: {
          x: -0.10,
          y: 0.20,
          width: 0.22,
          height: 0.22,
        },
        score: 0.90,
        landmarks: [],
        headPose: { yaw: 0, pitch: 0, roll: 0 },
      };

      const result = evaluateQuality(
        { faces: [edgeFace as any], brightness: 120 },
        DEFAULT_THRESHOLDS
      );

      expect(result.ok).toBe(false);
      expect(result.issues).toContain('off_center');
      expect(result.guidance).toBe('Center your face');
    });
  });

  describe('Area 5: Multi-Device Inspection Photos (up to 4 Images)', () => {
    it('renders 4 inspection slots with replace and remove options for existing photos', () => {
      const mockPhotos = [
        'https://res.cloudinary.com/lbqtrrw5/image/upload/v1/parth_mobile_care/devices/front.jpg',
        'https://res.cloudinary.com/lbqtrrw5/image/upload/v1/parth_mobile_care/devices/back.jpg',
      ];
      const onChangeMock = jest.fn();

      let renderer: any;
      act(() => {
        renderer = ReactTestRenderer.create(
          <MultiDeviceInspectionCapture
            photos={mockPhotos}
            onChange={onChangeMock}
            brand="Vivo"
            maxPhotos={4}
          />
        );
      });

      const root = renderer.root;
      // Should display 2/4 in counter badge
      const textNodes = root.findAllByType(Text);
      const counterText = textNodes.find((t: any) => {
        const textContent = Array.isArray(t.props.children) ? t.props.children.join('') : String(t.props.children);
        return textContent === '2/4';
      });
      expect(counterText).toBeTruthy();

      // Should display images
      const images = root.findAllByType(Image);
      expect(images.length).toBe(2);

      // Should render next slot (slot 3 · Display / Screen) with Camera and Gallery buttons
      const buttons = root.findAllByType(TouchableOpacity);
      const cameraBtn = buttons.find((b: any) => {
        const txt = b.findAllByType(Text);
        return txt.some((t: any) => t.props.children === 'Camera');
      });
      const galleryBtn = buttons.find((b: any) => {
        const txt = b.findAllByType(Text);
        return txt.some((t: any) => t.props.children === 'Gallery');
      });
      expect(cameraBtn).toBeTruthy();
      expect(galleryBtn).toBeTruthy();
    });

    it('persists up to 4 inspection photos in SecondHandPurchase records', async () => {
      const fourPhotos = [
        'https://res.cloudinary.com/lbqtrrw5/image/upload/v1/devices/photo1.jpg',
        'https://res.cloudinary.com/lbqtrrw5/image/upload/v1/devices/photo2.jpg',
        'https://res.cloudinary.com/lbqtrrw5/image/upload/v1/devices/photo3.jpg',
        'https://res.cloudinary.com/lbqtrrw5/image/upload/v1/devices/photo4.jpg',
      ];

      const purchaseData: Omit<SecondHandPurchase, 'id' | 'purchaseDate' | 'purchaseTime' | 'purchasedByStaffId' | 'purchasedByStaffName' | 'status'> = {
        brand: 'OnePlus',
        model: '11R',
        imei: '864209753124680',
        purchaseAmount: 28000,
        condition: 'Mint',
        customerName: 'Kishan Sharma',
        customerPhone: '9876543211',
        aadhaarNumber: '123456789012',
        devicePhotos: fourPhotos,
        deviceInspectionPhotos: fourPhotos,
      };

      const result = await SecondHandService.recordPurchase(purchaseData, mockUser);
      expect(result.deviceInspectionPhotos).toHaveLength(4);
      expect(result.devicePhotos).toHaveLength(4);
      expect(result.deviceInspectionPhotos).toEqual(fourPhotos);
    });
  });

  describe('Area 6: Sensitive KYC Document Quarantine Verification', () => {
    it('strictly isolates Aadhaar and biometric data from Cloudinary upload', async () => {
      // CloudinaryService must reject uploads with sensitive tags or folder names
      const rejectFrontAadhaar = await CloudinaryService.uploadImage('file:///local/storage/aadhaar_front.jpg', {
        folder: 'aadhaar' as any,
        tags: ['aadhaar_card'],
      });
      expect(rejectFrontAadhaar.success).toBe(false);
      expect(rejectFrontAadhaar.error).toMatch(/sensitive KYC/i);

      const rejectBiometric = await CloudinaryService.uploadImage('file:///local/storage/face_biometric.dat', {
        folder: 'face' as any,
        tags: ['face_biometric'],
      });
      expect(rejectBiometric.success).toBe(false);
      expect(rejectBiometric.error).toMatch(/sensitive KYC/i);
    });
  });
});
