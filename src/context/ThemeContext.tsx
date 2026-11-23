import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEME_COLORS } from '../constants';

export type ThemeMode = 'light' | 'dark' | 'system';

export type ColorPalette = {
  primary: string;
  primaryLight: string;
  primaryDark: string;
  accent: string;
  accentLight: string;
  success: string;
  successLight: string;
  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;
  info: string;
  infoLight: string;
  purple: string;
  purpleLight: string;
  background: string;
  card: string;
  cardSubtle: string;
  surface: string;
  surfaceSubtle: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderLight: string;
  statusBar: 'dark-content' | 'light-content';
};

interface ThemeContextType {
  isDark: boolean;
  colors: ColorPalette;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [systemScheme, setSystemScheme] = useState<'light' | 'dark' | null | undefined>(
    Appearance.getColorScheme()
  );
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    // Listen to device system appearance changes in real time
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemScheme(colorScheme);
    });

    AsyncStorage.getItem('@pmc_theme_mode')
      .then(saved => {
        if (saved === 'dark' || saved === 'light' || saved === 'system') {
          setThemeModeState(saved as ThemeMode);
        }
      })
      .catch(error => {
        console.warn('Theme preference unavailable; using system theme.', error);
      });

    return () => {
      subscription.remove();
    };
  }, []);

  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem('@pmc_theme_mode', mode);
    } catch (e) {
      console.warn('Failed to save theme preference', e);
    }
  }, []);

  const isDark =
    themeMode === 'system' ? systemScheme === 'dark' : themeMode === 'dark';

  const toggleTheme = useCallback(() => {
    const next: ThemeMode = isDark ? 'light' : 'dark';
    setThemeMode(next);
  }, [isDark, setThemeMode]);

  const colors = useMemo(() => (isDark ? THEME_COLORS.dark : THEME_COLORS.light), [isDark]);

  const value = useMemo(
    () => ({
      isDark,
      colors,
      themeMode,
      setThemeMode,
      toggleTheme,
    }),
    [isDark, colors, themeMode, setThemeMode, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
