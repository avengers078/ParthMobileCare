import React, { useState, useRef, useContext } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  StyleProp,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';
import { ModalScrollContext } from './ModalCard';
import { FormScrollContext } from './ScreenContainer';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const InputComponent = React.forwardRef<any, InputProps>(({
  label,
  error,
  helperText,
  containerStyle,
  leftIcon,
  rightIcon,
  style,
  onFocus,
  onBlur,
  ...props
}, ref) => {
  const { colors, isDark } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<any>(null);
  const modalScroll = useContext(ModalScrollContext);
  const formScroll = useContext(FormScrollContext);

  return (
    <View ref={containerRef} style={[styles.container, containerStyle]}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
            borderColor: error
              ? colors.danger
              : isFocused
              ? colors.primary
              : colors.border,
            borderWidth: isFocused || error ? 1.5 : 1,
          },
        ]}
      >
        {leftIcon ? <View style={styles.iconContainer}>{leftIcon}</View> : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }, style]}
          accessibilityLabel={props.accessibilityLabel || label || props.placeholder}
          accessibilityState={{ disabled: props.editable === false }}
          accessibilityHint={error ? `Error: ${error}` : props.accessibilityHint}
          onFocus={(e) => {
            setIsFocused(true);
            if (modalScroll?.scrollToInput && containerRef.current) {
              modalScroll.scrollToInput(containerRef.current);
            } else if (formScroll?.scrollToInput && containerRef.current) {
              formScroll.scrollToInput(containerRef.current);
            }
            onFocus && onFocus(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur && onBlur(e);
          }}
          {...props}
        />
        {rightIcon ? (
          <View style={styles.iconContainer}>{rightIcon}</View>
        ) : null}
      </View>

      {error ? (
        <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
      ) : helperText ? (
        <Text style={[styles.helper, { color: colors.textMuted }]}>
          {helperText}
        </Text>
      ) : null}
    </View>
  );
});

export const Input = React.memo(InputComponent);
export const AppInput = Input;

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  input: {
    flex: 1,
    ...TYPOGRAPHY.body,
    paddingVertical: 10,
  },
  iconContainer: {
    marginHorizontal: 4,
  },
  error: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 4,
    fontWeight: '600',
  },
  helper: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 4,
  },
});
