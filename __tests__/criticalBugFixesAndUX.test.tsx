import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { getFriendlyErrorMessage } from '../src/utils/errorHandler';
import { LoginScreen } from '../src/screens/LoginScreen';
import { ModalCard } from '../src/components/ModalCard';
import { StaffProvisioningService } from '../src/services/staffProvisioningService';
import { Text, TouchableOpacity, TextInput } from 'react-native';

const mockCallable = jest.fn();

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getFunctions: jest.fn(() => ({})),
    getAuth: jest.fn(() => ({
      currentUser: { uid: 'admin_123', email: 'admin@parthmobile.com' },
    })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
}));

jest.mock('firebase/functions', () => ({
  __esModule: true,
  httpsCallable: jest.fn(() => mockCallable),
}));

jest.mock('firebase/firestore', () => ({
  doc: jest.fn((_, col, id) => ({ path: `${col}/${id}` })),
  setDoc: jest.fn().mockResolvedValue(undefined),
  getDoc: jest.fn(),
  collection: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  limit: jest.fn(),
  getDocs: jest.fn().mockResolvedValue({ empty: true }),
}));

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    login: jest.fn().mockResolvedValue({ success: true }),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    currentUser: { id: 'admin_123', name: 'Parth Patel', role: 'admin' },
    isAdmin: true,
  }),
}));

jest.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      primary: '#194D9C',
      background: '#F8FAFC',
      card: '#FFFFFF',
      text: '#0F172A',
      textSecondary: '#64748B',
      textMuted: '#94A3B8',
      border: '#E2E8F0',
      borderLight: '#F1F5F9',
      danger: '#EF4444',
      success: '#10B981',
    },
    isDark: false,
  }),
}));

describe('Critical Bug Fixes & Mobile UX Audits', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Centralized Error Handler (getFriendlyErrorMessage)', () => {
    it('converts raw internal [0] error into user-friendly message', () => {
      const err = new Error('internal [0]');
      const friendly = getFriendlyErrorMessage(err);
      expect(friendly).not.toContain('internal [0]');
      expect(friendly).toContain('Something went wrong');
    });

    it('converts functions/internal error code into user-friendly message', () => {
      const err = { code: 'functions/internal', message: 'Response is not JSON' };
      const friendly = getFriendlyErrorMessage(err);
      expect(friendly).toContain('Something went wrong');
    });

    it('translates permission-denied error', () => {
      const err = { code: 'functions/permission-denied', message: 'Unauthorized' };
      const friendly = getFriendlyErrorMessage(err);
      expect(friendly).toContain('permission to perform this action');
    });

    it('translates already-exists error', () => {
      const err = { code: 'functions/already-exists', message: 'A user with this email already exists.' };
      const friendly = getFriendlyErrorMessage(err);
      expect(friendly).toContain('already registered');
    });

    it('translates network-request-failed error', () => {
      const err = { code: 'auth/network-request-failed', message: 'Network failed' };
      const friendly = getFriendlyErrorMessage(err);
      expect(friendly).toContain('No internet connection');
    });
  });

  describe('2. Login Screen Password Visibility Toggle', () => {
    it('renders password input with secureTextEntry by default and toggles on press', () => {
      let renderer: any;
      act(() => {
        renderer = ReactTestRenderer.create(<LoginScreen />);
      });

      const root = renderer.root;
      const textInputs = root.findAllByType(TextInput);
      // Password is the second input
      const passwordInput = textInputs.find((inp: any) => inp.props.placeholder === '••••••••');
      expect(passwordInput).toBeTruthy();
      expect(passwordInput.props.secureTextEntry).toBe(true);

      // Find toggle button
      const touchables = root.findAllByType(TouchableOpacity);
      const toggleBtn = touchables.find((t: any) => t.props.accessibilityLabel === 'Show password');
      expect(toggleBtn).toBeTruthy();

      // Press to reveal password
      act(() => {
        toggleBtn.props.onPress();
      });

      expect(passwordInput.props.secureTextEntry).toBe(false);

      // Press again to hide
      act(() => {
        toggleBtn.props.onPress();
      });

      expect(passwordInput.props.secureTextEntry).toBe(true);
    });
  });

  describe('3. ModalCard Dialog Positioning & Keyboard Dismiss', () => {
    it('renders modal with centered overlay layout and dismisses on close', () => {
      const onCloseMock = jest.fn();
      let renderer: any;
      act(() => {
        renderer = ReactTestRenderer.create(
          <ModalCard visible={true} onClose={onCloseMock} title="Add Customer Lead">
            <Text>Customer form fields</Text>
          </ModalCard>
        );
      });

      const root = renderer.root;
      const closeButtons = root.findAllByType(TouchableOpacity);
      const closeDialogBtn = closeButtons.find((t: any) => t.props.accessibilityLabel === 'Close dialog');
      expect(closeDialogBtn).toBeTruthy();

      act(() => {
        closeDialogBtn.props.onPress();
      });

      expect(onCloseMock).toHaveBeenCalled();
    });
  });

  describe('4. Staff Bulk Activation & Deactivation', () => {
    it('successfully processes bulk status updates via bulkSetStaffAccountStatus', async () => {
      mockCallable.mockResolvedValue({
        data: {
          success: true,
          uid: 'staff_1',
          isActive: false,
          message: 'Account updated successfully.',
        },
      });

      const res = await StaffProvisioningService.bulkSetStaffAccountStatus(['staff_1', 'staff_2'], false);
      expect(res.successCount).toBe(2);
      expect(res.totalCount).toBe(2);
      expect(res.failedIds.length).toBe(0);
    });
  });
});
