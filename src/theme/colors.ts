export const PALETTE = {
  // Brand Primary (LeadIQ / Linear style modern SaaS Blue)
  primary: '#194D9C',
  primaryLight: '#EAF2FF',
  primaryDark: '#123A78',
  primaryHover: '#123A78',

  // Semantic Status Colors
  success: '#22C55E',
  successLight: '#F0FDF4',
  successDark: '#15803D',

  warning: '#F59E0B',
  warningLight: '#FFFBEB',
  warningDark: '#B45309',

  danger: '#EF4444',
  dangerLight: '#FEF2F2',
  dangerDark: '#B91C1C',

  info: '#0EA5E9',
  infoLight: '#F0F9FF',
  infoDark: '#0369A1',

  purple: '#8B5CF6',
  purpleLight: '#F5F3FF',

  // Light Theme Surfaces
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F5F9', // Slate 100
    card: '#FFFFFF',
    cardSubtle: '#F8FAFC',
    text: '#0F172A',
    textPrimary: '#0F172A',
    textSecondary: '#64748B',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    borderSubtle: '#F3F4F6',
    borderLight: '#F1F5F9',
    accent: '#22C55E',
    accentLight: '#F0FDF4',
    cardShadow: 'rgba(0, 0, 0, 0.05)',
    statusBar: 'dark-content' as const,
  },

  // Dark Theme Surfaces
  dark: {
    background: '#0B0F19', // Deep OLED/SaaS Slate
    surface: '#111827', // Gray 900
    surfaceSubtle: '#1F2937', // Gray 800
    card: '#161F30',
    cardSubtle: '#1F2937',
    text: '#F9FAFB', // Gray 50
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF', // Gray 400
    textMuted: '#6B7280', // Gray 500
    border: '#1F2937', // Gray 800
    borderSubtle: '#18202F',
    borderLight: '#1F2937',
    accent: '#22C55E',
    accentLight: 'rgba(34, 197, 94, 0.15)',
    cardShadow: 'rgba(0, 0, 0, 0.4)',
    statusBar: 'light-content' as const,
  },
};

/**
 * Canonical THEME_COLORS source of truth used across the application.
 * Re-exported in src/constants/index.ts for backward compatibility.
 */
export const THEME_COLORS = {
  light: {
    primary: PALETTE.primary,
    primaryLight: PALETTE.primaryLight,
    primaryDark: PALETTE.primaryDark,
    accent: PALETTE.light.accent,
    accentLight: PALETTE.light.accentLight,
    success: PALETTE.success,
    successLight: PALETTE.successLight,
    danger: PALETTE.danger,
    dangerLight: PALETTE.dangerLight,
    warning: PALETTE.warning,
    warningLight: PALETTE.warningLight,
    info: PALETTE.info,
    infoLight: PALETTE.infoLight,
    purple: PALETTE.purple,
    purpleLight: PALETTE.purpleLight,
    background: PALETTE.light.background,
    card: PALETTE.light.card,
    cardSubtle: PALETTE.light.cardSubtle,
    surface: PALETTE.light.surface,
    surfaceSubtle: PALETTE.light.surfaceSubtle,
    text: PALETTE.light.text,
    textSecondary: PALETTE.light.textSecondary,
    textMuted: PALETTE.light.textMuted,
    border: PALETTE.light.border,
    borderLight: PALETTE.light.borderLight,
    statusBar: PALETTE.light.statusBar,
  },
  dark: {
    primary: PALETTE.primary,
    primaryLight: 'rgba(37, 99, 235, 0.2)',
    primaryDark: PALETTE.primaryDark,
    accent: PALETTE.dark.accent,
    accentLight: PALETTE.dark.accentLight,
    success: PALETTE.success,
    successLight: 'rgba(34, 197, 94, 0.2)',
    danger: PALETTE.danger,
    dangerLight: 'rgba(239, 68, 68, 0.2)',
    warning: PALETTE.warning,
    warningLight: 'rgba(245, 158, 11, 0.2)',
    info: PALETTE.info,
    infoLight: 'rgba(14, 165, 233, 0.2)',
    purple: PALETTE.purple,
    purpleLight: 'rgba(139, 92, 246, 0.2)',
    background: PALETTE.dark.background,
    card: PALETTE.dark.card,
    cardSubtle: PALETTE.dark.cardSubtle,
    surface: PALETTE.dark.surface,
    surfaceSubtle: PALETTE.dark.surfaceSubtle,
    text: PALETTE.dark.text,
    textSecondary: PALETTE.dark.textSecondary,
    textMuted: PALETTE.dark.textMuted,
    border: PALETTE.dark.border,
    borderLight: PALETTE.dark.borderLight,
    statusBar: PALETTE.dark.statusBar,
  },
};

export type ThemeColors = Omit<typeof PALETTE.light, 'statusBar'> & {
  statusBar: 'dark-content' | 'light-content';
  primary: string;
  primaryLight: string;
  primaryDark: string;
  success: string;
  successLight: string;
  successDark: string;
  warning: string;
  warningLight: string;
  warningDark: string;
  danger: string;
  dangerLight: string;
  dangerDark: string;
  info: string;
  infoLight: string;
  infoDark: string;
  purple: string;
  purpleLight: string;
};
