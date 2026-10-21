import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS } from '../theme';

export interface BadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'dark' | 'purple';
  size?: 'small' | 'medium';
  style?: StyleProp<ViewStyle>;
}

export const Badge: React.FC<BadgeProps> = ({
  label,
  variant = 'primary',
  size = 'small',
  style,
}) => {
  const { isDark } = useTheme();

  const getColors = () => {
    switch (variant) {
      case 'dark':
        return {
          bg: isDark ? '#1F2937' : '#111827',
          text: '#FFFFFF',
        };
      case 'success':
        return {
          bg: isDark ? 'rgba(34, 197, 94, 0.2)' : '#DCFCE7',
          text: isDark ? '#4ADE80' : '#15803D',
        };
      case 'warning':
        return {
          bg: isDark ? 'rgba(245, 158, 11, 0.2)' : '#FEF3C7',
          text: isDark ? '#FBBF24' : '#B45309',
        };
      case 'danger':
        return {
          bg: isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2',
          text: isDark ? '#F87171' : '#B91C1C',
        };
      case 'info':
        return {
          bg: isDark ? 'rgba(14, 165, 233, 0.2)' : '#E0F2FE',
          text: isDark ? '#38BDF8' : '#0369A1',
        };
      case 'purple':
        return {
          bg: isDark ? 'rgba(139, 92, 246, 0.2)' : '#F5F3FF',
          text: isDark ? '#A78BFA' : '#6D28D9',
        };
      case 'neutral':
        return {
          bg: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
          text: isDark ? '#CBD5E1' : '#475569',
        };
      default: // primary
        return {
          bg: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF',
          text: isDark ? '#93C5FD' : '#194D9C',
        };
    }
  };

  const badgeColors = getColors();

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: badgeColors.bg },
        size === 'small' ? styles.small : styles.medium,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { color: badgeColors.text },
          size === 'small' ? styles.textSmall : styles.textMedium,
        ]}
      >
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  small: {
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  medium: {
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  textSmall: {
    fontSize: 10,
  },
  textMedium: {
    fontSize: 12,
  },
});
