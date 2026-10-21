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
import { BriefcaseBusiness, Crown, ShieldCheck, Smartphone } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  ScreenContainer,
  AppCard,
  PrimaryButton,
  Input,
} from '../components';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';

export const LoginScreen: React.FC = () => {
  const { login, switchUserRole } = useAuth();
  const { colors, isDark } = useTheme();

  const [identifier, setIdentifier] = useState('admin@parthmobile.com');
  const [password, setPassword] = useState('password123');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim()) {
      Alert.alert('Error', 'Please enter your email or phone number.');
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
    Alert.alert(
      'Reset Password',
      'Password reset link will be sent to registered email or mobile number via SMS.',
      [{ text: 'OK' }]
    );
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
              Enter email or registered mobile number to continue:
            </Text>

            <Input
              label="Email or Mobile Number"
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

          {/* Quick Demo Role Selector */}
          <AppCard style={styles.demoCard}>
            <Text style={[styles.demoTitle, { color: colors.text }]}>
              Quick Role Testing
            </Text>
            <Text style={[styles.demoSub, { color: colors.textSecondary }]}>
              One-tap sign in to test role-based permissions:
            </Text>

            <View style={styles.demoButtonsContainer}>
              <TouchableOpacity
                style={[
                  styles.demoBtn,
                  {
                    borderColor: colors.danger,
                    backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2',
                  },
                ]}
                onPress={() => switchUserRole('admin')}
                activeOpacity={0.7}
              >
                <View style={styles.roleLabel}><Crown size={14} color={colors.danger} /><Text style={[styles.demoBtnRole, { color: colors.danger }]}>ADMIN</Text></View>
                <Text style={[styles.demoBtnName, { color: colors.text }]}>Parth Patel</Text>
                <Text style={[styles.demoBtnSub, { color: colors.textSecondary }]}>Owner & Admin</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.demoBtn,
                  {
                    borderColor: colors.warning,
                    backgroundColor: isDark ? 'rgba(245,158,11,0.1)' : '#FFFBEB',
                  },
                ]}
                onPress={() => switchUserRole('manager')}
                activeOpacity={0.7}
              >
                <View style={styles.roleLabel}><ShieldCheck size={14} color={colors.warning} /><Text style={[styles.demoBtnRole, { color: colors.warning }]}>MANAGER</Text></View>
                <Text style={[styles.demoBtnName, { color: colors.text }]}>Rahul Sharma</Text>
                <Text style={[styles.demoBtnSub, { color: colors.textSecondary }]}>Floor Manager</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.demoBtn,
                  {
                    borderColor: colors.primary,
                    backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#EFF6FF',
                  },
                ]}
                onPress={() => switchUserRole('staff')}
                activeOpacity={0.7}
              >
                <View style={styles.roleLabel}><BriefcaseBusiness size={14} color={colors.primary} /><Text style={[styles.demoBtnRole, { color: colors.primary }]}>STAFF</Text></View>
                <Text style={[styles.demoBtnName, { color: colors.text }]}>Ankit Verma</Text>
                <Text style={[styles.demoBtnSub, { color: colors.textSecondary }]}>Sales Exec</Text>
              </TouchableOpacity>
            </View>
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
  demoCard: {
    marginTop: SPACING.md,
    padding: SPACING.lg,
  },
  demoTitle: {
    ...TYPOGRAPHY.bodyBold,
  },
  demoSub: {
    ...TYPOGRAPHY.captionSmall,
    marginTop: 2,
    marginBottom: SPACING.md,
  },
  demoButtonsContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  demoBtn: {
    flex: 1,
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  demoBtnRole: {
    fontSize: 10,
    fontWeight: '800',
  },
  roleLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  demoBtnName: {
    ...TYPOGRAPHY.caption,
    fontWeight: '700',
    marginTop: 2,
  },
  demoBtnSub: {
    fontSize: 10,
    marginTop: 1,
  },
  footerText: {
    ...TYPOGRAPHY.captionSmall,
    textAlign: 'center',
    marginTop: SPACING.xxl,
  },
});
