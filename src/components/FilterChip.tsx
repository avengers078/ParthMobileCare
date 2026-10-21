import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  StyleProp,
  View,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING } from '../theme';

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
  count?: number;
  icon?: string | React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const FilterChip: React.FC<FilterChipProps> = ({
  label,
  active,
  onPress,
  count,
  icon,
  style,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active
            ? colors.primary
            : isDark
            ? 'rgba(255, 255, 255, 0.06)'
            : '#F1F5F9',
          borderColor: active
            ? colors.primary
            : isDark
            ? colors.border
            : 'transparent',
        },
        style,
      ]}
    >
      {icon ? (
        <View style={styles.iconContainer}>
          {typeof icon === 'string' ? (
            <Text style={{ fontSize: 13, color: active ? '#FFFFFF' : undefined }}>{icon}</Text>
          ) : React.isValidElement(icon) ? (
            React.cloneElement(icon as React.ReactElement<any>, {
              color: active ? '#FFFFFF' : ((icon as any).props?.color || colors.textSecondary),
            })
          ) : (
            icon
          )}
        </View>
      ) : null}

      <Text
        style={[
          styles.label,
          {
            color: active
              ? '#FFFFFF'
              : isDark
              ? colors.textSecondary
              : '#4B5563',
            fontWeight: active ? '600' : '500',
          },
        ]}
      >
        {label}
      </Text>

      {count !== undefined ? (
        <View
          style={[
            styles.countBadge,
            {
              backgroundColor: active
                ? 'rgba(255, 255, 255, 0.25)'
                : isDark
                ? 'rgba(255, 255, 255, 0.1)'
                : '#E2E8F0',
            },
          ]}
        >
          <Text
            style={[
              styles.countText,
              { color: active ? '#FFFFFF' : colors.textSecondary },
            ]}
          >
            {count}
          </Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    height: 38,
  },
  iconContainer: {
    marginRight: 6,
  },
  label: {
    fontSize: 13,
    letterSpacing: -0.1,
  },
  countBadge: {
    marginLeft: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
