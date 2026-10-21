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
