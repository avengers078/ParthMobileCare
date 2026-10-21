import { PALETTE, ThemeColors } from './colors';
import { SPACING } from './spacing';
import { RADIUS } from './radius';
import { SHADOWS } from './shadows';
import { TYPOGRAPHY } from './typography';

export const lightTheme = {
  isDark: false,
  colors: {
    ...PALETTE.light,
    primary: PALETTE.primary,
    primaryLight: PALETTE.primaryLight,
    primaryDark: PALETTE.primaryDark,
    success: PALETTE.success,
    successLight: PALETTE.successLight,
    successDark: PALETTE.successDark,
    warning: PALETTE.warning,
    warningLight: PALETTE.warningLight,
    warningDark: PALETTE.warningDark,
    danger: PALETTE.danger,
    dangerLight: PALETTE.dangerLight,
    dangerDark: PALETTE.dangerDark,
    info: PALETTE.info,
    infoLight: PALETTE.infoLight,
    infoDark: PALETTE.infoDark,
    purple: PALETTE.purple,
    purpleLight: PALETTE.purpleLight,
  } as ThemeColors,
  spacing: SPACING,
  radius: RADIUS,
  shadows: SHADOWS,
  typography: TYPOGRAPHY,
};

export const darkTheme = {
  isDark: true,
  colors: {
    ...PALETTE.dark,
    primary: PALETTE.primary,
    primaryLight: 'rgba(37, 99, 235, 0.2)',
    primaryDark: PALETTE.primaryDark,
    success: PALETTE.success,
    successLight: 'rgba(34, 197, 94, 0.2)',
    successDark: PALETTE.successDark,
    warning: PALETTE.warning,
    warningLight: 'rgba(245, 158, 11, 0.2)',
    warningDark: PALETTE.warningDark,
    danger: PALETTE.danger,
    dangerLight: 'rgba(239, 68, 68, 0.2)',
    dangerDark: PALETTE.dangerDark,
    info: PALETTE.info,
    infoLight: 'rgba(14, 165, 233, 0.2)',
    infoDark: PALETTE.infoDark,
    purple: PALETTE.purple,
    purpleLight: 'rgba(139, 92, 246, 0.2)',
  } as ThemeColors,
  spacing: SPACING,
  radius: RADIUS,
  shadows: SHADOWS,
  typography: TYPOGRAPHY,
};

export type AppTheme = typeof lightTheme;
