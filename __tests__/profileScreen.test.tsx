import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { Alert } from 'react-native';
import { ProfileScreen } from '../src/screens/ProfileScreen';
import { ThemeProvider } from '../src/context/ThemeContext';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    getAuth: jest.fn(),
    getFirestore: jest.fn(),
    getStorage: jest.fn(),
  },
}));

jest.mock('../src/services/attendanceService', () => ({
  AttendanceService: {
    getCurrentPosition: jest.fn().mockResolvedValue({ latitude: 20.0, longitude: 73.0 }),
  },
}));

jest.mock('../src/services/staffPerformanceService', () => ({
  StaffPerformanceService: {
    getSalarySlip: jest.fn().mockResolvedValue(null),
    getStaffTarget: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../src/services/pdfService', () => ({
  PdfService: {
    printOrSavePdf: jest.fn().mockResolvedValue(true),
  },
}));

const mockLogout = jest.fn();
const mockSendPasswordReset = jest.fn();
const mockNavigate = jest.fn();
const mockShowConfirm = jest.fn();

jest.mock('../src/context/AlertContext', () => ({
  useAlert: () => ({
    showAlert: jest.fn(),
    showSuccess: jest.fn(),
    showError: jest.fn(),
    showWarning: jest.fn(),
    showInfo: jest.fn(),
    showConfirm: mockShowConfirm,
    hideAlert: jest.fn(),
  }),
}));

const mockUser = {
  id: 'usr-1',
  name: 'Chetan Sharma',
  email: 'chetan@parthmobile.com',
  phone: '9876543210',
  role: 'staff' as const,
  designation: 'Senior Sales Specialist',
  joinedDate: '2024-01-15',
  hasFaceRegistered: true,
};

jest.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: mockUser,
    role: 'staff',
    isAdmin: false,
    isStaff: true,
    logout: mockLogout,
    sendPasswordReset: mockSendPasswordReset,
  }),
}));

jest.mock('../src/context/ShopConfigContext', () => ({
  useShopConfig: () => ({
    config: {
      shopName: 'Parth Mobile Care',
      shopAddress: 'Shop 4, Main Market, Nashik Road',
      gstNumber: '27AAAAA0000A1Z5',
      latitude: 19.9975,
      longitude: 73.7898,
      allowedRadiusMeters: 50,
      openingTime: '09:30',
      closingTime: '21:00',
    },
    updateConfig: jest.fn(),
  }),
}));

describe('ProfileScreen UI Improvement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders dark/night mode toggle button at the top in ProfileScreen header', async () => {
    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProfileScreen navigation={{ navigate: mockNavigate }} />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const themeBtn = root.find(
      (node: any) =>
        (node.props?.accessibilityLabel === 'Switch to dark mode' ||
         node.props?.accessibilityLabel === 'Switch to light mode') &&
        typeof node.props?.onPress === 'function'
    );
    expect(themeBtn).toBeDefined();

    // Trigger theme toggle press
    await ReactTestRenderer.act(async () => {
      themeBtn.props.onPress();
    });
  });

  it('renders modern profile header with circular avatar, user name, role and contact details', async () => {
    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProfileScreen navigation={{ navigate: mockNavigate }} />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const textNodes = root.findAllByType('Text').map((t: any) => {
      if (Array.isArray(t.props.children)) {
        return t.props.children.join('');
      }
      return String(t.props.children || '');
    });

    // Circular avatar initial
    expect(textNodes).toContain('C');
    // Name
    expect(textNodes).toContain('Chetan Sharma');
    // Role & designation
    expect(textNodes).toContain('Staff');
    expect(textNodes).toContain('Senior Sales Specialist');
    // Contact
    expect(textNodes.some((t: string) => t.includes('9876543210'))).toBe(true);
    expect(textNodes.some((t: string) => t.includes('chetan@parthmobile.com'))).toBe(true);
  });

  it('renders organized Account Information card with real user data', async () => {
    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProfileScreen navigation={{ navigate: mockNavigate }} />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const textNodes = root.findAllByType('Text').map((t: any) => {
      if (Array.isArray(t.props.children)) {
        return t.props.children.join('');
      }
      return String(t.props.children || '');
    });

    expect(textNodes).toContain('Account Information');
    expect(textNodes).toContain('Full Name');
    expect(textNodes).toContain('Mobile Number');
    expect(textNodes).toContain('Email Address');
    expect(textNodes).toContain('Role & Designation');
    expect(textNodes).toContain('Joined Date');
    expect(textNodes).toContain('2024-01-15');
    expect(textNodes).toContain('Biometric Verification');
    expect(textNodes).toContain('Enrolled & Verified');
  });

  it('renders theme toggle in header and omits redundant preferences card', async () => {
    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProfileScreen navigation={{ navigate: mockNavigate }} />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const textNodes = root.findAllByType('Text').map((t: any) => {
      if (Array.isArray(t.props.children)) {
        return t.props.children.join('');
      }
      return String(t.props.children || '');
    });

    // Preferences card is removed since header has quick theme toggle
    expect(textNodes).not.toContain('Preferences');
  });

  it('renders Store Details card with shop information', async () => {
    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProfileScreen navigation={{ navigate: mockNavigate }} />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const textNodes = root.findAllByType('Text').map((t: any) => {
      if (Array.isArray(t.props.children)) {
        return t.props.children.join('');
      }
      return String(t.props.children || '');
    });

    expect(textNodes).toContain('Store Details');
    expect(textNodes).toContain('Shop Name');
    expect(textNodes).toContain('Parth Mobile Care');
    expect(textNodes).toContain('GST Number');
    expect(textNodes).toContain('27AAAAA0000A1Z5');
  });

  it('renders Account Actions card with password reset and omits admin-only staff management', async () => {
    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProfileScreen navigation={{ navigate: mockNavigate }} />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const textNodes = root.findAllByType('Text').map((t: any) => {
      if (Array.isArray(t.props.children)) {
        return t.props.children.join('');
      }
      return String(t.props.children || '');
    });

    expect(textNodes).toContain('Account Actions');
    expect(textNodes).toContain('Reset Password');
    expect(textNodes).not.toContain('Manage Staff & Sales Targets');
  });

  it('renders prominent red-accented Sign Out card with confirmation alert', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <ProfileScreen navigation={{ navigate: mockNavigate }} />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const signOutBtn = root.find(
      (node: any) =>
        node.props?.accessibilityLabel === 'Sign Out' &&
        typeof node.props?.onPress === 'function'
    );
    expect(signOutBtn).toBeDefined();

    // Trigger sign out press
    await ReactTestRenderer.act(async () => {
      signOutBtn.props.onPress();
    });

    expect(mockShowConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Sign Out',
        message: 'Are you sure you want to sign out of your account?',
        destructive: true,
      })
    );
  });
});
