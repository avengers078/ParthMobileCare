import React from 'react';
import { Moon, Sun } from 'lucide-react-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Badge } from './Badge';
import { AppIcon } from './AppIcon';
import { UserRole } from '../types';
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
  const { role } = useAuth();
  const { colors, isDark, toggleTheme } = useTheme();

  const getRoleVariant = (r: UserRole) => {
    if (r === 'admin') return 'danger';
    if (r === 'manager') return 'warning';
    return 'primary';
  };

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
            >
              <AppIcon name="chevron-left" size={20} color={colors.text} strokeWidth={2.2} />
            </TouchableOpacity>
          ) : null}

          <View style={styles.titleArea}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.rightContainer}>
          {!isCompact && rightAction}

          {/* Theme Toggle Button */}
          <TouchableOpacity
            style={[styles.themeButton, { borderColor: colors.border, backgroundColor: colors.borderLight }]}
            onPress={toggleTheme}
            activeOpacity={0.7}
          >
            {isDark ? (
              <Sun size={16} color={colors.text} strokeWidth={2} />
            ) : (
              <Moon size={16} color={colors.text} strokeWidth={2} />
            )}
          </TouchableOpacity>

          <View style={styles.roleWrapper}>
            <Badge label={role} variant={getRoleVariant(role)} size="medium" />
          </View>
        </View>
      </View>

      {actionRow ? (
        <View style={[styles.actionRow, styles.actionRowStart, actionRowStyle]}>
          {actionRow}
        </View>
      ) : isCompact && rightAction ? (
        <View style={[styles.actionRow, actionRowStyle]}>
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
  },
  themeButton: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  roleWrapper: {
    marginLeft: 2,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: SPACING.sm,
    width: '100%',
  },
  actionRowStart: {
    justifyContent: 'flex-start',
  },
});
