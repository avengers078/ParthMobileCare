import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';

const APP_LOGO = require('../assets/logo.png');
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ScreenContainer,
  AppCard,
  PrimaryButton,
  Input,
} from '../components';
import { SPACING, TYPOGRAPHY } from '../theme';

export const LoginScreen: React.FC = () => {
  const { login, sendPasswordReset } = useAuth();
  const { colors } = useTheme();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert('Error', 'Please enter your Firebase account email and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(identifier, password);
      if (!result.success) {
        Alert.alert('Sign In Failed', result.message);
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!identifier.trim()) {
      Alert.alert('Reset Password', 'Enter your account email first.');
      return;
    }
    sendPasswordReset(identifier).then(() => {
      Alert.alert('Reset Email Sent', 'Check your inbox for the Firebase password reset link.');
    }).catch((error: any) => {
      Alert.alert('Reset Failed', error?.message || 'Could not send a password reset email.');
    });
  };

  return (
    <ScreenContainer edges={['top', 'bottom', 'left', 'right']} keyboardAvoiding={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Brand Header with official mascot logo */}
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

          {/* Credentials Form */}
          <AppCard style={styles.card}>
            <Text style={[styles.formTitle, { color: colors.text }]}>
              Sign In to Account
            </Text>
            <Text style={[styles.formSub, { color: colors.textSecondary }]}>
              Use the email and password for your Firebase account:
            </Text>

            <Input
              label="Email"
              placeholder="admin@parthmobile.com"
              value={identifier}
              onChangeText={setIdentifier}
              autoCapitalize="none"
            />

            <Input
              label="Password"
              placeholder="••••••••"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
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
          </AppCard>

          {/* App Footer */}
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Parth Mobile Care • Enterprise CRM v1.0.0
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  content: {
    padding: SPACING.xl,
    justifyContent: 'center',
    flexGrow: 1,
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
  },
  brandTagline: {
    ...TYPOGRAPHY.caption,
    marginTop: 4,
  },
  card: {
    padding: SPACING.xl,
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
  footerText: {
    ...TYPOGRAPHY.captionSmall,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
});
