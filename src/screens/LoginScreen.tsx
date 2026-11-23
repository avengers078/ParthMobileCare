import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Image,
} from 'react-native';
import { Eye, EyeOff, UserPlus } from 'lucide-react-native';

const APP_LOGO = require('../assets/logo.png');
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ScreenContainer,
  PrimaryButton,
  OutlineButton,
  Input,
  KeyboardAwareFormContainer,
} from '../components';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';
import { useAlert } from '../context/AlertContext';

const SCREEN_HEIGHT = Dimensions.get('screen').height;

export const LoginScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const { login, sendPasswordReset } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showError, showWarning } = useAlert();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordInputRef = useRef<any>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      showWarning('Validation Error', 'Please enter your account email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(identifier, password);
      if (!result.success) {
        if (result.message?.includes('Admin Web Dashboard') || result.message?.includes('Access Denied')) {
          showWarning('Admin Access Restricted', result.message);
        } else {
          showError('Sign In Failed', result.message);
        }
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      if (msg.includes('Admin Web Dashboard') || msg.includes('Access Denied')) {
        showWarning('Admin Access Restricted', msg);
      } else {
        showError('Sign In Failed', e);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!identifier.trim()) {
      showWarning('Reset Password', 'Enter your account email first.');
      return;
    }
    sendPasswordReset(identifier).then(() => {
      showSuccess('Reset Email Sent', 'Check your inbox for the password reset link.');
    }).catch((error: any) => {
      showError('Reset Failed', error);
    });
  };

  return (
    <ScreenContainer
      scrollable={false}
      edges={['top', 'bottom', 'left', 'right']}
      keyboardAvoiding={false}
    >
      <View style={styles.container}>
        <KeyboardAwareFormContainer
          cardMode={true}
          style={styles.formContainer}
          contentStyle={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
          bodyStyle={styles.cardBody}
          autoScrollOnFocus={false}
          onKeyboardChange={(visible) => {
            setKeyboardVisible(visible);
          }}
          header={
            <View style={styles.brandContainer}>
              <View style={styles.logoBox}>
                <Image
                  source={APP_LOGO}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.brandTitle, { color: colors.text }]}>
                Parth Mobile Care
              </Text>
              <Text style={[styles.brandTagline, { color: colors.textSecondary }]}>
                Staff & Customer Management System
              </Text>
            </View>
          }
        >
          <Text
            accessibilityLabel="Sign In to Account"
            style={[styles.formTitle, { color: colors.text }]}
          >
            Welcome Back
          </Text>
          <Text
            numberOfLines={2}
            style={[styles.formSub, { color: colors.textSecondary }]}
          >
            Sign in with your staff account.
          </Text>

          <Input
            label="Email"
            placeholder="staff@parthmobile.com"
            value={identifier}
            onChangeText={setIdentifier}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={() => passwordInputRef.current?.focus()}
            blurOnSubmit={false}
          />

          <Input
            ref={passwordInputRef}
            label="Password"
            placeholder="••••••••"
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            rightIcon={
              <TouchableOpacity
                onPress={() => setShowPassword(prev => !prev)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                accessibilityHint="Toggles password visibility"
              >
                {showPassword ? (
                  <EyeOff size={20} color={colors.textSecondary} />
                ) : (
                  <Eye size={20} color={colors.textSecondary} />
                )}
              </TouchableOpacity>
            }
          />

          <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn}>
            <Text style={[styles.forgotText, { color: colors.primary }]}>
              Forgot Password?
            </Text>
          </TouchableOpacity>

          <PrimaryButton
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            size="large"
            style={{ marginTop: SPACING.sm }}
          />

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textSecondary }]}>OR</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>

          <OutlineButton
            title="New staff? Create Account"
            onPress={() => {
              navigation?.navigate('Register');
            }}
            size="large"
            icon={<UserPlus size={18} color={colors.primary} />}
          />
        </KeyboardAwareFormContainer>

        {/* App Footer outside the card */}
        {!keyboardVisible && (
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Parth Mobile Care • Staff Mobile Application
          </Text>
        )}
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: SCREEN_HEIGHT >= 800 ? SPACING.huge : SPACING.xxl,
    paddingBottom: SPACING.md,
  },
  formContainer: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
  },
  card: {
    borderRadius: RADIUS.xl,
  },
  cardBody: {
    padding: SPACING.xl,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  logoBox: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
    backgroundColor: '#FFFFFF',
    elevation: 6,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: 100,
    height: 100,
  },
  brandTitle: {
    ...TYPOGRAPHY.h1,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  brandTagline: {
    ...TYPOGRAPHY.caption,
    marginTop: 4,
    textAlign: 'center',
  },
  formTitle: {
    ...TYPOGRAPHY.h2,
  },
  formSub: {
    ...TYPOGRAPHY.caption,
    marginTop: 4,
    marginBottom: SPACING.md,
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginVertical: SPACING.xs,
  },
  forgotText: {
    ...TYPOGRAPHY.caption,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    ...TYPOGRAPHY.captionSmall,
    fontWeight: '700',
    marginHorizontal: SPACING.md,
  },
  footerText: {
    ...TYPOGRAPHY.captionSmall,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
});
