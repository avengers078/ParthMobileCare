import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, SHADOWS } from '../theme';
import { AnimatedCard } from './common/AnimatedCard';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string | React.ReactNode;
  iconBgColor?: string;
  badgeText?: string;
  badgeVariant?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  valueColor?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  iconBgColor,
  badgeText,
  badgeVariant = 'primary',
  onPress,
  style,
  valueColor,
}) => {
  const { colors, isDark } = useTheme();

  const getBadgeStyle = () => {
    switch (badgeVariant) {
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
      default:
        return {
          bg: isDark ? 'rgba(37, 99, 235, 0.2)' : '#EFF6FF',
          text: isDark ? '#93C5FD' : '#194D9C',
        };
    }
  };

  const badgeColors = getBadgeStyle();

  const content = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: 'transparent',
        },
        SHADOWS.card,
        style,
      ]}
    >
      <View style={styles.topRow}>
        <View
          style={[
            styles.iconContainer,
            {
              backgroundColor:
                iconBgColor ||
                (isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF'),
            },
          ]}
        >
          {typeof icon === 'string' ? (
            <Text style={styles.iconEmoji}>{icon}</Text>
          ) : (
            icon
          )}
        </View>

        {badgeText ? (
          <View style={[styles.badge, { backgroundColor: badgeColors.bg }]}>
            <Text style={[styles.badgeText, { color: badgeColors.text }]}>
              {badgeText}
            </Text>
          </View>
        ) : null}
      </View>

      <Text
        style={[
          styles.value,
          { color: valueColor || colors.text },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
      >
        {value}
      </Text>

      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
    </View>
  );

  return (
    <AnimatedCard
      onPress={onPress}
      style={[styles.animatedContainer, style]}
      noPadding
    >
      {content}
    </AnimatedCard>
  );
};

const styles = StyleSheet.create({
  animatedContainer: {
    minWidth: 150,
    marginRight: SPACING.md,
    marginVertical: 0,
    borderRadius: RADIUS.lg,
  },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    borderWidth: 0,
    minWidth: 150,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.sm,
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconEmoji: {
    fontSize: 18,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginVertical: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});
