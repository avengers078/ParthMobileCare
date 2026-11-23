import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  View,
  AccessibilityRole,
  Insets,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  icon?: React.ReactNode;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  hitSlop?: Insets | number;
}

export const Button: React.FC<ButtonProps> = React.memo(({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  icon,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  testID,
  hitSlop,
}) => {
  const { colors, isDark } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
          borderWidth: 1,
          borderColor: isDark ? colors.border : '#E2E8F0',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1.5,
          borderColor: colors.primary,
        };
      case 'danger':
        return {
          backgroundColor: colors.danger,
        };
      case 'success':
        return {
          backgroundColor: colors.accent,
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
        };
      case 'primary':
      default:
        return {
          backgroundColor: colors.primary,
        };
    }
  };

  const getTextColor = (): string => {
    if (disabled) return colors.textMuted;
    switch (variant) {
      case 'secondary':
        return isDark ? '#FFFFFF' : '#1E293B';
      case 'outline':
      case 'ghost':
        return colors.primary;
      case 'danger':
      case 'success':
      case 'primary':
      default:
        return '#FFFFFF';
    }
  };

  const getSizeStyle = (): ViewStyle => {
    switch (size) {
      case 'small':
        return {
          minHeight: 40,
          paddingVertical: 9,
          paddingHorizontal: SPACING.md,
          borderRadius: RADIUS.md,
        };
      case 'large':
        return {
          minHeight: 52,
          paddingVertical: 14,
          paddingHorizontal: SPACING.xl,
          borderRadius: RADIUS.md,
        };
      case 'medium':
      default:
        return {
          minHeight: 46,
          paddingVertical: 11,
          paddingHorizontal: SPACING.lg,
          borderRadius: RADIUS.md,
        };
    }
  };

  const defaultHitSlop: Insets | undefined =
    size === 'small'
      ? { top: 4, bottom: 4, left: 4, right: 4 }
      : size === 'medium'
      ? { top: 2, bottom: 2, left: 2, right: 2 }
      : undefined;

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: Boolean(disabled || loading),
        busy: Boolean(loading),
      }}
      testID={testID}
      hitSlop={hitSlop !== undefined ? hitSlop : defaultHitSlop}
      style={[
        styles.button,
        getContainerStyle(),
        getSizeStyle(),
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon ? <View style={styles.iconBox}>{icon}</View> : null}
          <Text
            style={[
              styles.text,
              { color: getTextColor() },
              size === 'small' && styles.textSmall,
              size === 'large' && styles.textLarge,
              textStyle,
            ]}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {title}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
});

export const PrimaryButton: React.FC<Omit<ButtonProps, 'variant'>> = React.memo((props) => (
  <Button {...props} variant="primary" />
));

export const SecondaryButton: React.FC<Omit<ButtonProps, 'variant'>> = React.memo((props) => (
  <Button {...props} variant="secondary" />
));

export const OutlineButton: React.FC<Omit<ButtonProps, 'variant'>> = React.memo((props) => (
  <Button {...props} variant="outline" />
));

export interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  size?: number;
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  accessibilityRole?: AccessibilityRole;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  hitSlop?: Insets | number;
}

export const IconButton: React.FC<IconButtonProps> = React.memo(({
  icon,
  onPress,
  size = 40,
  backgroundColor,
  style,
  disabled = false,
  accessibilityRole = 'button',
  accessibilityLabel,
  accessibilityHint,
  testID,
  hitSlop,
}) => {
  const { colors } = useTheme();

  // If size < 48, default hitSlop expands touch area to 48x48
  const slopDelta = Math.max(0, Math.ceil((48 - size) / 2));
  const defaultHitSlop: Insets | undefined =
    slopDelta > 0
      ? { top: slopDelta, bottom: slopDelta, left: slopDelta, right: slopDelta }
      : undefined;

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      testID={testID}
      hitSlop={hitSlop !== undefined ? hitSlop : defaultHitSlop}
      style={[
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: RADIUS.md,
          backgroundColor: backgroundColor || colors.borderLight,
          borderColor: colors.border,
          borderWidth: 1,
        },
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 1,
    maxWidth: '100%',
    paddingHorizontal: 2,
  },
  iconBox: {
    marginRight: SPACING.sm,
    flexShrink: 0,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    ...TYPOGRAPHY.button,
    letterSpacing: 0.1,
    flexShrink: 1,
    textAlign: 'center',
  },
  textSmall: {
    fontSize: 13,
  },
  textLarge: {
    fontSize: 16,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
});
