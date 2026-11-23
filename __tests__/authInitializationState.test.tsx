import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '../src/context/AuthContext';
import { RootNavigator } from '../src/navigation/RootNavigator';
import { ThemeProvider } from '../src/context/ThemeContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const firebaseMock = require('../jest.firebaseMock');

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({})),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
    getFunctions: jest.fn(() => ({})),
    resetInit: jest.fn(),
  },
}));

jest.mock('../src/services/firestoreSync', () => ({
  FirestoreSyncService: {
    pullAllCloudToLocal: jest.fn().mockResolvedValue(true),
    fetchCollection: jest.fn().mockResolvedValue([]),
  },
  FIRESTORE_COLLECTIONS: {
    USERS: 'users',
  },
}));

describe('AuthContext & RootNavigator Auth State Hardening', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  test('when onAuthStateChanged has not emitted within timeout, marks authError and never treats user as authenticated', async () => {
    jest.useFakeTimers();

    // Mock onAuthStateChanged to never emit
    firebaseMock.onAuthStateChanged.mockImplementation(() => () => {});

    let capturedAuth: any;
    const TestConsumer = () => {
      capturedAuth = useAuth();
      return null;
    };

    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>
      );
      await Promise.resolve();
    });

    // Initially loading
    expect(capturedAuth.isLoading).toBe(true);
    expect(capturedAuth.currentUser).toBeNull();
    expect(capturedAuth.authError).toBeNull();

    // Fast-forward past timeout (7000ms)
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(7500);
      await Promise.resolve();
    });

    // Verification: Must NOT be treated as authenticated
    expect(capturedAuth.isLoading).toBe(false);
    expect(capturedAuth.currentUser).toBeNull();
    expect(capturedAuth.authError).toContain('timed out');

    jest.useRealTimers();
  });

  test('when authError is present, RootNavigator renders Authentication Notice error screen and never routes to protected screens', async () => {
    jest.useFakeTimers();

    firebaseMock.onAuthStateChanged.mockImplementation(() => () => {});

    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <ThemeProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      );
      await Promise.resolve();
    });

    // Fast-forward past timeout
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(7500);
      await Promise.resolve();
    });

    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('AUTHENTICATION NOTICE');
    expect(tree).toContain('Retry Verification');
    // Must NOT contain protected MainTabs or Home
    expect(tree).not.toContain('HomeTab');
    expect(tree).not.toContain('LeadsTab');

    jest.useRealTimers();
  });

  test('when onAuthStateChanged emits null, successfully routes to LoginScreen and clears authError', async () => {
    let authCallback: any = null;
    firebaseMock.onAuthStateChanged.mockImplementation((_auth: any, cb: any) => {
      authCallback = cb;
      return () => {};
    });

    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
          <ThemeProvider>
            <AuthProvider>
              <RootNavigator />
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      );
      await Promise.resolve();
    });

    // Emit unauthenticated user (null)
    await ReactTestRenderer.act(async () => {
      authCallback(null);
      await Promise.resolve();
    });

    const tree = JSON.stringify(renderer.toJSON());
    expect(tree).toContain('Sign In to Account');
    expect(tree).toContain('staff@parthmobile.com');
  });
});

