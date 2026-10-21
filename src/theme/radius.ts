export const RADIUS = {
  xs: 4,
  sm: 8,
  md: 12, // Inputs & Buttons (min 44-48px touch height)
  lg: 16, // Standard Cards
  xl: 20, // Modal Cards & Hero Elements
  xxl: 24, // Bottom Sheets
  full: 999, // Badges, Pills & Avatars
} as const;

export type RadiusKey = keyof typeof RADIUS;
