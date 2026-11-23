import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  HelpCircle,
} from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { PALETTE } from '../../theme/colors';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AlertButtonConfig {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AppAlertOptions {
  type?: AlertType;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  buttons?: AlertButtonConfig[];
}

export interface AppAlertProps {
  visible: boolean;
  options: AppAlertOptions | null;
  onDismiss: () => void;
}

export const AppAlert: React.FC<AppAlertProps> = ({
  visible,
  options,
  onDismiss,
}) => {
  const { colors, isDark } = useTheme();

  // Ensure keyboard is dismissed so it doesn't obscure or compress alert content
  useEffect(() => {
    if (visible) {
      Keyboard.dismiss();
    }
  }, [visible]);

  if (!options) return null;

  const {
    type = 'info',
    title,
    message,
    confirmText = 'OK',
    cancelText = 'Cancel',
    destructive = false,
    onConfirm,
    onCancel,
    buttons,
  } = options;

  // Icon and accent styling based on alert type
  let IconComponent = Info;
  let iconColor = PALETTE.primary;
  let iconBgColor = PALETTE.primaryLight;

  switch (type) {
    case 'success':
      IconComponent = CheckCircle2;
      iconColor = PALETTE.success;
      iconBgColor = PALETTE.successLight;
      break;
    case 'error':
      IconComponent = AlertCircle;
      iconColor = PALETTE.danger;
      iconBgColor = PALETTE.dangerLight;
      break;
    case 'warning':
      IconComponent = AlertTriangle;
      iconColor = PALETTE.warning;
      iconBgColor = PALETTE.warningLight;
      break;
    case 'confirm':
      IconComponent = destructive ? AlertTriangle : HelpCircle;
      iconColor = destructive ? PALETTE.danger : PALETTE.primary;
      iconBgColor = destructive ? PALETTE.dangerLight : PALETTE.primaryLight;
      break;
    case 'info':
    default:
      IconComponent = Info;
      iconColor = PALETTE.primary;
      iconBgColor = PALETTE.primaryLight;
      break;
  }

  const handleConfirm = () => {
    onDismiss();
    if (onConfirm) onConfirm();
  };

  const handleCancel = () => {
    onDismiss();
    if (onCancel) onCancel();
  };

  const isConfirmation = type === 'confirm' || (buttons && buttons.length > 1);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
      <TouchableWithoutFeedback onPress={isConfirmation ? undefined : onDismiss}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.dialog,
                {
                  backgroundColor: colors.card,
                  borderColor: isDark ? colors.border : '#F1F5F9',
                },
              ]}
              accessibilityRole="alert"
              accessibilityLabel={`${title}. ${message}`}
            >
              {/* Type Icon Badge */}
              <View style={[styles.iconContainer, { backgroundColor: iconBgColor }]}>
                <IconComponent size={30} color={iconColor} strokeWidth={2.4} />
              </View>

              {/* Title & Description */}
              <Text style={[styles.title, { color: colors.text }]}>
                {title}
              </Text>

              <Text style={[styles.message, { color: colors.textSecondary }]}>
                {message}
              </Text>

              {/* Action Buttons */}
              {buttons && buttons.length > 0 ? (
                <View style={styles.buttonRow}>
                  {buttons.map((btn, index) => {
                    const isDestructive = btn.style === 'destructive';
                    const isCancel = btn.style === 'cancel';
                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.button,
                          styles.rowButton,
                          isCancel
                            ? [styles.cancelButton, { borderColor: colors.border, backgroundColor: colors.background }]
                            : isDestructive
                            ? [styles.confirmButton, { backgroundColor: PALETTE.danger }]
                            : [styles.confirmButton, { backgroundColor: colors.primary }],
                        ]}
                        activeOpacity={0.85}
                        onPress={() => {
                          onDismiss();
                          if (btn.onPress) btn.onPress();
                        }}
                      >
                        <Text
                          style={[
                            styles.buttonText,
                            isCancel ? [styles.cancelButtonText, { color: colors.textSecondary }] : styles.confirmButtonText,
                          ]}
                        >
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : isConfirmation ? (
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.rowButton,
                      styles.cancelButton,
                      { borderColor: colors.border, backgroundColor: colors.background },
                    ]}
                    activeOpacity={0.85}
                    onPress={handleCancel}
                    accessibilityRole="button"
                    accessibilityLabel={cancelText}
                  >
                    <Text style={[styles.buttonText, styles.cancelButtonText, { color: colors.textSecondary }]}>
                      {cancelText}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.rowButton,
                      styles.confirmButton,
                      { backgroundColor: destructive ? PALETTE.danger : colors.primary },
                    ]}
                    activeOpacity={0.85}
                    onPress={handleConfirm}
                    accessibilityRole="button"
                    accessibilityLabel={confirmText}
                  >
                    <Text style={[styles.buttonText, styles.confirmButtonText]}>
                      {confirmText}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.singleButtonContainer}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      styles.singleConfirmButton,
                      {
                        backgroundColor:
                          type === 'error'
                            ? PALETTE.danger
                            : type === 'warning'
                            ? PALETTE.warning
                            : colors.primary,
                      },
                    ]}
                    activeOpacity={0.85}
                    onPress={handleConfirm}
                    accessibilityRole="button"
                    accessibilityLabel={confirmText}
                  >
                    <Text style={[styles.buttonText, styles.confirmButtonText]}>
                      {confirmText}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 350,
    borderRadius: 18,
    borderWidth: 1,
    paddingTop: 22,
    paddingBottom: 18,
    paddingHorizontal: 20,
    alignItems: 'center',
    elevation: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  message: {
    fontSize: 13.5,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 18,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  singleButtonContainer: {
    width: '100%',
  },
  button: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowButton: {
    flex: 1,
  },
  confirmButton: {
    elevation: 2,
    shadowColor: '#194D9C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  singleConfirmButton: {
    width: '100%',
    elevation: 2,
    shadowColor: '#194D9C',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  cancelButton: {
    borderWidth: 1.2,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  cancelButtonText: {
    fontWeight: '600',
  },
});

