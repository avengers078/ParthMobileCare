import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { Header } from '../src/components/Header';
import { THEME_COLORS } from '../src/constants';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    getAuth: jest.fn(),
    getFirestore: jest.fn(),
    getStorage: jest.fn(),
  },
}));

describe('Theme Architecture & Mode Selection', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('provides light and dark themes with correct palette tokens', () => {
    expect(THEME_COLORS.light.primary).toBe('#194D9C');
    expect(THEME_COLORS.dark.primary).toBe('#194D9C');
    expect(THEME_COLORS.dark.background).toBe('#0B0F19');
    expect(THEME_COLORS.dark.card).toBe('#161F30');
    expect(THEME_COLORS.dark.text).toBe('#F9FAFB');
  });

  it('switches between Light, Dark, and System Default and persists preference', async () => {
    let capturedContext: any = null;

    const TestComponent = () => {
      capturedContext = useTheme();
      return null;
    };

    let renderer: any;
    await ReactTestRenderer.act(async () => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );
    });

    // Default mode is system
    expect(capturedContext.themeMode).toBe('system');

    // Switch to dark
    await ReactTestRenderer.act(async () => {
      capturedContext.setThemeMode('dark');
    });

    expect(capturedContext.themeMode).toBe('dark');
    expect(capturedContext.isDark).toBe(true);
    expect(capturedContext.colors.card).toBe(THEME_COLORS.dark.card);

    const saved = await AsyncStorage.getItem('@pmc_theme_mode');
    expect(saved).toBe('dark');

    // Switch to light
    await ReactTestRenderer.act(async () => {
      capturedContext.setThemeMode('light');
    });

    expect(capturedContext.themeMode).toBe('light');
    expect(capturedContext.isDark).toBe(false);
    expect(capturedContext.colors.card).toBe(THEME_COLORS.light.card);

    const savedLight = await AsyncStorage.getItem('@pmc_theme_mode');
    expect(savedLight).toBe('light');

    // Switch to system
    await ReactTestRenderer.act(async () => {
      capturedContext.setThemeMode('system');
    });

    expect(capturedContext.themeMode).toBe('system');
    const savedSystem = await AsyncStorage.getItem('@pmc_theme_mode');
    expect(savedSystem).toBe('system');
  });
});

describe('Header Cleanliness & Admin Badge Removal', () => {
  it('renders title and subtitle without repeated admin badges or theme toggles', () => {
    let renderer: any;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <ThemeProvider>
          <Header title="Leads" subtitle="Customer Pipeline" />
        </ThemeProvider>
      );
    });

    const root = renderer.root;
    const textNodes = root.findAllByType('Text');
    const allTexts = textNodes.map((t: any) =>
      typeof t.props.children === 'string' ? t.props.children : ''
    );

    // Title and Subtitle are present
    expect(allTexts).toContain('Leads');
    expect(allTexts).toContain('Customer Pipeline');

    // No admin badge or staff badge is rendered in Header
    expect(allTexts.some((t: string) => t.toLowerCase() === 'admin')).toBe(false);
    expect(allTexts.some((t: string) => t.toLowerCase() === 'administrator')).toBe(false);
    expect(allTexts.some((t: string) => t.toLowerCase() === 'staff')).toBe(false);
  });
});

