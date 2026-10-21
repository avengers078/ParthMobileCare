import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Platform,
  View,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { RADIUS, SPACING, SHADOWS } from '../../theme';

export interface AnimatedCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onLongPress?: () => void;
  highlightBorder?: boolean;
  noPadding?: boolean;
  activeScale?: number;
  testID?: string;
  disabled?: boolean;
}

/**
 * AnimatedCard
 * Provides a high-end spring press animation (0.975 scale) with subtle elevation dip,
 * native bounded ripple on Android, and an elegant 5-8% highlight overlay.
 * Follows design patterns from Apple Wallet, Airbnb, Stripe, and Linear.
 */
export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  style,
  containerStyle,
  onPress,
  onLongPress,
  highlightBorder = false,
  noPadding = false,
  activeScale = 0.975,
  testID,
  disabled = false,
}) => {
  const { colors, isDark } = useTheme();

  // Animation values
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const handlePressIn = () => {
    if (disabled || (!onPress && !onLongPress)) return;

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: activeScale,
        useNativeDriver: true,
        speed: 30,
        bounciness: 0,
      }),
      Animated.timing(overlayAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePressOut = () => {
    if (disabled || (!onPress && !onLongPress)) return;

    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 20,
        bounciness: 6, // Natural gentle bounce on release
      }),
      Animated.timing(overlayAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const isInteractive = Boolean(onPress || onLongPress) && !disabled;

  const flattened = (StyleSheet.flatten(style) || {}) as ViewStyle;

  // Extract layout properties that must be applied to the outer Animated.View
  // so that flexbox layouts (e.g. flex: 1 in row grids, margins, widths) work properly
  const outerLayoutStyle: ViewStyle = {};
  const innerCardStyle: ViewStyle = { ...flattened };

  const layoutKeys: (keyof ViewStyle)[] = [
    'flex',
    'flexGrow',
    'flexShrink',
    'flexBasis',
    'width',
    'minWidth',
    'maxWidth',
    'alignSelf',
    'margin',
    'marginHorizontal',
    'marginVertical',
    'marginTop',
    'marginBottom',
    'marginLeft',
    'marginRight',
    'zIndex',
  ];

  layoutKeys.forEach((key) => {
    if (flattened[key] !== undefined) {
      // @ts-ignore
      outerLayoutStyle[key] = flattened[key];
      // Keep min/max constraints on inner as well for safety
      if (!['minWidth', 'maxWidth'].includes(key)) {
        // @ts-ignore
        delete innerCardStyle[key];
      }
    }
  });

  const baseContainerStyle = [
    styles.card,
    {
      backgroundColor: colors.card,
      borderColor: highlightBorder
        ? colors.primary
        : isDark
        ? 'rgba(255, 255, 255, 0.08)'
        : 'rgba(0, 0, 0, 0.04)',
      borderWidth: 1,
      ...(outerLayoutStyle.flex !== undefined ? { flex: 1, width: '100%' } : {}),
    },
    SHADOWS.card,
    noPadding && styles.noPadding,
    innerCardStyle,
  ];

  if (!isInteractive) {
    return (
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: highlightBorder
              ? colors.primary
              : isDark
              ? 'rgba(255, 255, 255, 0.08)'
              : 'rgba(0, 0, 0, 0.04)',
            borderWidth: 1,
          },
          SHADOWS.card,
          noPadding && styles.noPadding,
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  // Ripple color for Android
  const rippleColor = isDark
    ? 'rgba(255, 255, 255, 0.06)'
    : 'rgba(37, 99, 235, 0.07)';

  return (
    <Animated.View
      style={[
        outerLayoutStyle,
        containerStyle,
        {
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        android_ripple={{
          color: rippleColor,
          borderless: false,
        }}
        style={({ pressed }) => [
          baseContainerStyle,
          Platform.OS === 'ios' && pressed && { opacity: 0.96 },
        ]}
      >
        {children}

        {/* Elegant subtle press tint overlay */}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            styles.overlay,
            {
              backgroundColor: isDark ? '#FFFFFF' : colors.primary,
              opacity: overlayAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, isDark ? 0.05 : 0.06],
              }),
            },
          ]}
        />
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginVertical: SPACING.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  noPadding: {
    padding: 0,
  },
  overlay: {
    borderRadius: RADIUS.xl,
  },
});
