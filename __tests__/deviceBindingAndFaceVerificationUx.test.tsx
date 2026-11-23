import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AppState } from 'react-native';
import { DeviceBindingModal } from '../src/components/DeviceBindingModal';
import { FaceVerificationModal } from '../src/components/FaceVerificationModal';
import { DeviceBindingService } from '../src/services/deviceBindingService';
import { DeviceSecurityService } from '../src/services/deviceSecurityService';
import { FaceRecognitionService } from '../src/services/faceRecognitionService';
import { User } from '../src/types';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'test_staff_uid' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
    getFunctions: jest.fn(() => ({})),
  },
}));

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#194D9C',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      text: '#1E293B',
      textSecondary: '#64748B',
      border: '#E2E8F0',
      danger: '#EF4444',
      success: '#10B981',
      warning: '#F59E0B',
      card: '#FFFFFF',
    },
    isDark: false,
  }),
}));

const mockShowSuccess = jest.fn();
const mockShowError = jest.fn();
const mockShowWarning = jest.fn();
const mockShowInfo = jest.fn();

jest.mock('../src/context/AlertContext', () => ({
  useAlert: () => ({
    showSuccess: mockShowSuccess,
    showError: mockShowError,
    showWarning: mockShowWarning,
    showInfo: mockShowInfo,
  }),
}));

let mockOnDeviceResult: any = null;
jest.mock('../src/components/OnDeviceFaceAuthView', () => ({
  OnDeviceFaceAuthView: ({ onResult }: any) => {
    mockOnDeviceResult = onResult;
    const { View, Text } = require('react-native');
    return (
      <View testID="on-device-face-auth-view">
        <Text>Camera Viewfinder Active</Text>
      </View>
    );
  },
}));

const findTouchableWithText = (root: any, text: string) => {
  const matches = root.findAll((node: any) => {
    if (!node.props || typeof node.props.onPress !== 'function') return false;
    const texts = node.findAll((n: any) => n.props && (typeof n.props.children === 'string' || Array.isArray(n.props.children)));
    return texts.some((txt: any) => {
      const c = txt.props.children;
      if (typeof c === 'string') return c.includes(text);
      if (Array.isArray(c)) return c.join('').includes(text);
      return false;
    });
  });
  return matches[matches.length - 1] || matches[0];
};

describe('Device Binding & Face Verification Final QA', () => {
  const baseStaffUser: User = {
    id: 'staff_chetan_101',
    name: 'Chetan Luhar',
    email: 'chetanluhar65@gmail.com',
    phone: '6355725237',
    role: 'staff',
    designation: 'Sales Executive',
    joinedDate: '2026-01-01',
    basicSalary: 20000,
    monthlyTarget: 200000,
    isActive: true,
    hasFaceRegistered: true,
    deviceId: 'dev_original_phone_id',
    deviceModel: 'Android Client',
    deviceBindingStatus: 'approved',
  };

  let appStateListener: any = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnDeviceResult = null;
    appStateListener = null;

    jest.spyOn(AppState, 'addEventListener').mockImplementation((event: any, handler: any) => {
      if (event === 'change') {
        appStateListener = handler;
      }
      return { remove: jest.fn() } as any;
    });
  });

  describe('1. DeviceBindingModal Staff-Friendly States & Accordion', () => {
    it('displays staff-friendly "Unrecognized Phone" when phone is mismatched and shows collapsed Phone Information accordion', async () => {
      jest.spyOn(DeviceSecurityService, 'getDeviceInfo').mockResolvedValue({
        installationId: 'dev_android_17939612345678901234',
        model: 'Vivo I2301',
        isHardwareBacked: true,
        publicKey: 'pubkey_test',
        keyAlgorithm: 'secp256r1',
        platform: 'android',
        appVersion: '1.0.0',
      });

      jest.spyOn(DeviceBindingService, 'checkDeviceStatus').mockResolvedValue({
        status: 'DEVICE_MISMATCH',
        canPunch: false,
        message: 'This phone is not approved for your attendance.',
        currentDeviceId: 'dev_android_17939612345678901234',
        registeredDeviceId: 'dev_original_phone_id',
        registeredModel: 'Android Client',
      });

      jest.spyOn(DeviceBindingService, 'getPendingDeviceChangeRequest').mockResolvedValue(null);

      let renderer: any;
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
          <DeviceBindingModal
            visible={true}
            currentUser={baseStaffUser}
            onClose={jest.fn()}
          />
        );
      });

      // Allow async loadDeviceInfo to resolve
      await ReactTestRenderer.act(async () => {
        await new Promise(resolve => setTimeout(resolve, 80));
      });

      const root = renderer.root;
      const textNodes = root.findAllByType('Text');
      const textContents = textNodes.map((n: any) =>
        Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)
      );

      expect(textContents.some((t: string) => t.includes('Unrecognized Phone'))).toBe(true);
      expect(textContents.some((t: string) => t.includes('Not Authorized'))).toBe(true);

      const requestAuthBtn = findTouchableWithText(root, 'Request Authorization for this Phone');
      expect(requestAuthBtn).toBeDefined();

      // Accordion is collapsed by default
      expect(textContents.some((t: string) => t === 'Vivo I2301')).toBe(false);

      const accordionHeader = findTouchableWithText(root, 'Phone Information');
      expect(accordionHeader).toBeDefined();

      await ReactTestRenderer.act(async () => {
        accordionHeader.props.onPress();
      });

      // After toggle, Vivo I2301 and details are visible
      const updatedTexts = root.findAllByType('Text').map((n: any) =>
        Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)
      );
      expect(updatedTexts.some((t: string) => t.includes('Vivo I2301'))).toBe(true);
      expect(updatedTexts.some((t: string) => t.includes('Hardware Protected'))).toBe(true);
      expect(updatedTexts.some((t: string) => t.includes('Android Client'))).toBe(true);
    });

    it('displays staff-friendly "Approval Pending" when a device change request is pending', async () => {
      jest.spyOn(DeviceSecurityService, 'getDeviceInfo').mockResolvedValue({
        installationId: 'dev_android_17939612345678901234',
        model: 'Vivo I2301',
        isHardwareBacked: true,
        publicKey: 'pubkey_test',
        keyAlgorithm: 'secp256r1',
        platform: 'android',
        appVersion: '1.0.0',
      });

      jest.spyOn(DeviceBindingService, 'checkDeviceStatus').mockResolvedValue({
        status: 'PENDING_APPROVAL',
        canPunch: false,
        message: 'Your device change request is waiting for administrator approval.',
        currentDeviceId: 'dev_android_17939612345678901234',
      });

      jest.spyOn(DeviceBindingService, 'getPendingDeviceChangeRequest').mockResolvedValue({
        id: 'dcr_1001',
        userId: baseStaffUser.id,
        userName: baseStaffUser.name,
        userEmail: baseStaffUser.email,
        currentDeviceId: 'dev_original_phone_id',
        currentDeviceModel: 'Android Client',
        newDeviceId: 'dev_android_17939612345678901234',
        newDevicePublicKey: 'pubkey_test',
        newDeviceModel: 'Vivo I2301',
        newDevicePlatform: 'android',
        reason: 'New phone bought for store work',
        status: 'pending',
        createdAt: '2026-11-06T10:00:00Z',
      });

      let renderer: any;
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
          <DeviceBindingModal
            visible={true}
            currentUser={baseStaffUser}
            onClose={jest.fn()}
          />
        );
      });

      await ReactTestRenderer.act(async () => {
        await new Promise(resolve => setTimeout(resolve, 80));
      });

      const root = renderer.root;
      const textContents = root.findAllByType('Text').map((n: any) =>
        Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)
      );

      expect(textContents.some((t: string) => t.includes('Approval Pending'))).toBe(true);
      expect(textContents.some((t: string) => t.includes('Awaiting Admin Approval'))).toBe(true);
      expect(textContents.some((t: string) => t.includes('New phone bought for store work'))).toBe(true);
      expect(findTouchableWithText(root, 'Cancel Request')).toBeDefined();
    });

    it('submits a device change request with staff-friendly reason validation', async () => {
      jest.spyOn(DeviceSecurityService, 'getDeviceInfo').mockResolvedValue({
        installationId: 'dev_android_17939612345678901234',
        model: 'Vivo I2301',
        isHardwareBacked: true,
        publicKey: 'pubkey_test',
        keyAlgorithm: 'secp256r1',
        platform: 'android',
        appVersion: '1.0.0',
      });

      jest.spyOn(DeviceBindingService, 'checkDeviceStatus').mockResolvedValue({
        status: 'DEVICE_MISMATCH',
        canPunch: false,
        message: 'This phone is not approved for your attendance.',
        currentDeviceId: 'dev_android_17939612345678901234',
      });

      jest.spyOn(DeviceBindingService, 'getPendingDeviceChangeRequest').mockResolvedValue(null);

      const submitSpy = jest.spyOn(DeviceBindingService, 'submitDeviceChangeRequest').mockResolvedValue({
        success: true,
        message: 'Change request submitted.',
      });

      let renderer: any;
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
          <DeviceBindingModal
            visible={true}
            currentUser={baseStaffUser}
            onClose={jest.fn()}
          />
        );
      });

      await ReactTestRenderer.act(async () => {
        await new Promise(resolve => setTimeout(resolve, 80));
      });

      const root = renderer.root;
      const openFormBtn = findTouchableWithText(root, 'Request Authorization for this Phone');
      expect(openFormBtn).toBeDefined();

      await ReactTestRenderer.act(async () => {
        openFormBtn.props.onPress();
      });

      // Find TextInput
      const input = root.findByType('TextInput');
      expect(input).toBeDefined();

      await ReactTestRenderer.act(async () => {
        input.props.onChangeText('My new Vivo phone for shop work');
      });

      const submitBtn = findTouchableWithText(root, 'Send Request to Admin');
      expect(submitBtn).toBeDefined();

      await ReactTestRenderer.act(async () => {
        submitBtn.props.onPress();
      });

      expect(submitSpy).toHaveBeenCalledWith(baseStaffUser, 'My new Vivo phone for shop work');
      expect(mockShowSuccess).toHaveBeenCalledWith('Request Sent', expect.any(String));
    });
  });

  describe('2. FaceVerificationModal Mandatory 1:1 Matching & Retry Limit', () => {
    it('generates verification token on successful face match and active challenge pass', async () => {
      const onSuccess = jest.fn();
      const onClose = jest.fn();

      const genTokenSpy = jest.spyOn(FaceRecognitionService, 'generateVerificationToken').mockReturnValue({
        tokenId: 'tok_success_1',
        userId: baseStaffUser.id,
        action: 'punch_in',
        timestamp: Date.now(),
        similarityScore: 0.94,
        livenessScore: 0.97,
        challengesCompleted: ['ON_DEVICE_FACE_MATCH', 'ACTIVE_LIVENESS_CHALLENGE'],
        signature: 'valid_sig',
      });

      await ReactTestRenderer.act(async () => {
        ReactTestRenderer.create(
          <FaceVerificationModal
            visible={true}
            user={baseStaffUser}
            action="punch_in"
            onSuccess={onSuccess}
            onClose={onClose}
          />
        );
      });

      expect(mockOnDeviceResult).not.toBeNull();

      // Simulate successful native on-device face match result
      await ReactTestRenderer.act(async () => {
        mockOnDeviceResult({
          ok: true,
          challengePassed: true,
          matchScore: 0.94,
          livenessScore: 0.97,
          isSpoof: false,
          embeddingB64: 'b64_embed',
        });
      });

      // Wait for success callback timeout
      await ReactTestRenderer.act(async () => {
        await new Promise(resolve => setTimeout(resolve, 600));
      });

      expect(genTokenSpy).toHaveBeenCalledWith(
        baseStaffUser.id,
        'punch_in',
        0.94,
        0.97,
        ['ON_DEVICE_FACE_MATCH', 'ACTIVE_LIVENESS_CHALLENGE']
      );
      expect(onSuccess).toHaveBeenCalled();
    });

    it('enforces retry counter and locks out with staff-friendly message after 3 failed attempts', async () => {
      const onSuccess = jest.fn();
      const onClose = jest.fn();

      let renderer: any;
      await ReactTestRenderer.act(async () => {
        renderer = ReactTestRenderer.create(
          <FaceVerificationModal
            visible={true}
            user={baseStaffUser}
            action="punch_in"
            onSuccess={onSuccess}
            onClose={onClose}
          />
        );
      });

      // Attempt 1 Failure
      await ReactTestRenderer.act(async () => {
        mockOnDeviceResult({
          ok: false,
          challengePassed: false,
          failureReason: 'match_failed',
        });
      });

      let texts = renderer.root.findAllByType('Text').map((n: any) =>
        Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)
      );
      expect(texts.some((t: string) => t.includes('Face not matched') && t.includes('2 attempts remaining'))).toBe(true);

      // Press Try Again -> Attempt 2 Failure
      const tryAgainBtn1 = findTouchableWithText(renderer.root, 'Try Again');
      expect(tryAgainBtn1).toBeDefined();

      await ReactTestRenderer.act(async () => {
        tryAgainBtn1.props.onPress();
      });

      await ReactTestRenderer.act(async () => {
        mockOnDeviceResult({
          ok: false,
          challengePassed: false,
          failureReason: 'liveness_failed',
        });
      });

      texts = renderer.root.findAllByType('Text').map((n: any) =>
        Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)
      );
      expect(texts.some((t: string) => t.includes('Liveness check did not pass') && t.includes('1 attempt remaining'))).toBe(true);

      // Press Try Again -> Attempt 3 Failure (Exhausted)
      const tryAgainBtn2 = findTouchableWithText(renderer.root, 'Try Again');
      expect(tryAgainBtn2).toBeDefined();

      await ReactTestRenderer.act(async () => {
        tryAgainBtn2.props.onPress();
      });

      await ReactTestRenderer.act(async () => {
        mockOnDeviceResult({
          ok: false,
          challengePassed: false,
          failureReason: 'match_failed',
        });
      });

      texts = renderer.root.findAllByType('Text').map((n: any) =>
        Array.isArray(n.props.children) ? n.props.children.join('') : String(n.props.children)
      );
      expect(texts.some((t: string) => t.includes('Face verification failed repeatedly. Please contact your store administrator.'))).toBe(true);

      // Try Again button must no longer exist
      const tryAgainAfterExhausted = findTouchableWithText(renderer.root, 'Try Again');
      expect(tryAgainAfterExhausted).toBeUndefined();

      // Contact Store Administrator button is present
      const contactBtn = findTouchableWithText(renderer.root, 'Contact Store Administrator');
      expect(contactBtn).toBeDefined();

      await ReactTestRenderer.act(async () => {
        contactBtn.props.onPress();
      });

      expect(onClose).toHaveBeenCalled();
      expect(onSuccess).not.toHaveBeenCalled();
    });

    it('cancels verification if app transitions to background or inactive', async () => {
      const onClose = jest.fn();

      await ReactTestRenderer.act(async () => {
        ReactTestRenderer.create(
          <FaceVerificationModal
            visible={true}
            user={baseStaffUser}
            action="punch_in"
            onSuccess={jest.fn()}
            onClose={onClose}
          />
        );
      });

      expect(appStateListener).not.toBeNull();

      // Simulate AppState event
      await ReactTestRenderer.act(async () => {
        appStateListener('background');
      });

      expect(onClose).toHaveBeenCalled();
    });
  });
});
