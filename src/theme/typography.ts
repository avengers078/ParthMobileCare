import { Platform, TextStyle } from 'react-native';

// Use Inter when bundled by the host app; fall back to the platform sans face.
const fontFamily = Platform.select({
  ios: 'Inter',
  android: 'Inter',
  default: 'System',
}) || 'System';

export const TYPOGRAPHY: Record<string, TextStyle> = {
  h1: {
    fontFamily,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  h2: {
    fontFamily,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  h3: {
    fontFamily,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
  bodyMedium: {
    fontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  bodyBold: {
    fontFamily,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  caption: {
    fontFamily,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  captionSmall: {
    fontFamily,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '500',
  },
  button: {
    fontFamily,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
};
