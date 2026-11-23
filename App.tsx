import React, { useEffect, useState, useRef, useCallback } from 'react';
import { StatusBar, View, Text, StyleSheet, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { ShopConfigProvider } from './src/context/ShopConfigContext';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { AlertProvider } from './src/context/AlertContext';
import { RootNavigator } from './src/navigation/RootNavigator';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import FirebaseService from './src/services/firebase';
import { useShopConfig } from './src/context/ShopConfigContext';

const APP_LOGO = require('./src/assets/logo.png');

function MainApp() {
  const { isDark } = useTheme();
  const { currentUser } = useAuth();
  const { reloadConfig } = useShopConfig();

  useEffect(() => {
    if (currentUser) reloadConfig();
  // Reload once per authenticated account; the context function is recreated per render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <RootNavigator />
    </>
  );
}

function InitialLoadingSplash({ message = 'Initializing security services...' }: { message?: string }) {
  return (
    <View style={splashStyles.container}>
      <View style={splashStyles.logoBox}>
        <Image source={APP_LOGO} style={splashStyles.logo} resizeMode="contain" />
      </View>
      <Text style={splashStyles.title}>Parth Mobile Care</Text>
      <Text style={splashStyles.tagline}>Staff & Customer Management System</Text>
      <Text style={splashStyles.statusText}>{message}</Text>
      <ActivityIndicator size="small" color="#194D9C" style={splashStyles.spinner} />
    </View>
  );
}

function InitializationErrorScreen({
  errorMessage,
  onRetry,
}: {
  errorMessage: string;
  onRetry: () => void;
}) {
  return (
    <View style={splashStyles.container}>
      <View style={splashStyles.logoBox}>
        <Image source={APP_LOGO} style={splashStyles.logo} resizeMode="contain" />
      </View>
      <View style={splashStyles.errorBadge}>
        <Text style={splashStyles.errorBadgeText}>INITIALIZATION FAILED</Text>
      </View>
      <Text style={splashStyles.title}>Service Connection Error</Text>
      <Text style={splashStyles.errorMessage}>{errorMessage}</Text>
      <TouchableOpacity
        style={splashStyles.retryButton}
        onPress={onRetry}
        activeOpacity={0.8}
      >
        <Text style={splashStyles.retryButtonText}>Retry Connection</Text>
      </TouchableOpacity>
      <Text style={splashStyles.hintText}>
        Ensure your device is connected to Wi-Fi or cellular network.
      </Text>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logoBox: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    elevation: 8,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
  },
  logo: {
    width: 114,
    height: 114,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 6,
  },
  statusText: {
    fontSize: 13,
    color: '#94A3B8',
    marginTop: 12,
  },
  spinner: {
    marginTop: 24,
  },
  errorBadge: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 12,
  },
  errorBadgeText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  errorMessage: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    marginTop: 10,
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  retryButton: {
    backgroundColor: '#194D9C',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#194D9C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  hintText: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 18,
  },
});

type InitStatus = 'loading' | 'success' | 'error';

const DEFAULT_SAFE_AREA_METRICS = initialWindowMetrics ?? {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

export default function App() {
  const [initStatus, setInitStatus] = useState<InitStatus>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const attemptRef = useRef(0);

  const startInitialization = useCallback(() => {
    const attemptId = ++attemptRef.current;
    setInitStatus('loading');
    setErrorMessage(null);

    // Timeout: If Firebase initialization exceeds 8000ms, fail with an explicit retryable error.
    // Never falsely mark Firebase as initialized when pending or failed!
    const timeoutId = setTimeout(() => {
      if (attemptRef.current === attemptId) {
        setInitStatus('error');
        setErrorMessage('Firebase service initialization timed out. Please check network connectivity and tap Retry.');
      }
    }, 8000);
    if (typeof (timeoutId as any)?.unref === 'function') {
      (timeoutId as any).unref();
    }

    FirebaseService.init()
      .then((success) => {
        if (attemptRef.current !== attemptId) return;
        clearTimeout(timeoutId);
        if (success) {
          setInitStatus('success');
          setErrorMessage(null);
        } else {
          setInitStatus('error');
          setErrorMessage('Failed to configure Firebase services. Tap Retry to reconnect.');
        }
      })
      .catch((err: any) => {
        if (attemptRef.current !== attemptId) return;
        clearTimeout(timeoutId);
        setInitStatus('error');
        setErrorMessage(err?.message || 'An unexpected error occurred during Firebase initialization.');
      });

    return () => {
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const cleanup = startInitialization();
    return () => {
      cleanup?.();
    };
  }, [startInitialization]);

  const handleRetry = useCallback(() => {
    FirebaseService.resetInit();
    startInitialization();
  }, [startInitialization]);

  return (
    <ErrorBoundary>
      <SafeAreaProvider initialMetrics={DEFAULT_SAFE_AREA_METRICS}>
        <ThemeProvider>
          <ShopConfigProvider>
            {initStatus === 'loading' && <InitialLoadingSplash />}
            {initStatus === 'error' && (
              <InitializationErrorScreen
                errorMessage={errorMessage || 'Firebase initialization failed.'}
                onRetry={handleRetry}
              />
            )}
            {initStatus === 'success' && (
              <AuthProvider>
                <AlertProvider>
                  <MainApp />
                </AlertProvider>
              </AuthProvider>
            )}
          </ShopConfigProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}