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
import { AppIcon } from './AppIcon';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  actionRow?: React.ReactNode;
  actionRowStyle?: StyleProp<ViewStyle>;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  rightAction,
  actionRow,
  actionRowStyle,
}) => {
  const { colors } = useTheme();

  const isCompact = Boolean(showBack && rightAction);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          borderBottomColor: 'transparent',
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.leftContainer}>
          {showBack && onBack ? (
            <TouchableOpacity
              onPress={onBack}
              style={[styles.backButton, { backgroundColor: colors.borderLight }]}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              accessibilityHint="Returns to previous screen"
              activeOpacity={0.7}
            >
              <AppIcon name="chevron-left" size={20} color={colors.text} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.titleArea}>
            <Text
              style={[styles.title, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={[styles.subtitle, { color: colors.textSecondary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.85}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {(!isCompact && rightAction) ? (
          <View style={styles.rightContainer}>
            {rightAction}
          </View>
        ) : null}
      </View>

      {actionRow ? (
        <View style={[styles.actionRow, styles.actionRowStart, actionRowStyle]}>
          {actionRow}
        </View>
      ) : isCompact && rightAction ? (
        <View style={[styles.actionRow, styles.actionRowStart, actionRowStyle]}>
          {rightAction}
        </View>
      ) : null}

    </View>
  );
};

export const AppHeader = Header;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 0,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  backArrow: {
    fontSize: 20,
    fontWeight: '700',
  },
  titleArea: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...TYPOGRAPHY.h2,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    marginTop: 2,
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    width: '100%',
    marginTop: SPACING.sm,
  },
  actionRowStart: {
    justifyContent: 'flex-start',
  },
});
