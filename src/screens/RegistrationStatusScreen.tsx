import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import {
  Clock,
  XCircle,
  ShieldAlert,
  LogOut,
  RefreshCw,
  User as UserIcon,
  Smartphone,
  ScanFace,
  CheckCircle2,
  Calendar,
} from 'lucide-react-native';
import { doc, getDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';
import { ScreenContainer, AppCard, PrimaryButton, OutlineButton } from '../components';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';
import FirebaseService from '../services/firebase';
import { User } from '../types';

const APP_LOGO = require('../assets/logo.png');

export const RegistrationStatusScreen: React.FC = () => {
  const { currentUser, logout, restartRegistration } = useAuth();
  const { colors } = useTheme();
  const { showSuccess, showWarning, showError } = useAlert();
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const isRejected = currentUser?.registrationStatus === 'rejected';

  const handleRestart = async () => {
    setRestarting(true);
    try {
      await restartRegistration();
    } catch {
      // Ignored
    } finally {
      setRestarting(false);
    }
  };

  const handleCheckStatus = async () => {
    if (!currentUser?.id) return;
    setChecking(true);
    try {
      const userRef = doc(FirebaseService.getFirestore(), 'users', currentUser.id);
      const snap = await getDoc(userRef);
      if (!snap.exists()) {
        showError('Profile Not Found', 'Your staff record could not be found. Please contact your store administrator.');
        return;
      }
      const data = snap.data() as User;
      if (data.registrationStatus === 'approved' && data.isActive) {
        showSuccess('Account Approved!', 'Your account has been approved by the Administrator. Loading your dashboard...');
      } else if (data.registrationStatus === 'rejected') {
        showWarning(
          'Registration Rejected',
          `Your registration request was rejected: ${data.rejectionReason || 'No specific reason provided.'}`
        );
      } else {
        showWarning(
          'Still Pending Review',
          'Your registration request is still pending Administrator review. Please check back later.'
        );
      }
    } catch (err: any) {
      showError('Check Failed', err?.message || 'Failed to check registration status.');
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
    } catch {
      // Ignored
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <ScreenContainer>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Logo and App Title */}
        <View style={styles.headerBox}>
          <View style={styles.logoContainer}>
            <Image source={APP_LOGO} style={styles.logo} resizeMode="contain" />
          </View>
          <Text style={[styles.appTitle, { color: colors.text }]}>Parth Mobile Care</Text>
          <Text style={[styles.appSubtitle, { color: colors.textSecondary }]}>
            Staff Account Setup
          </Text>
        </View>

        {/* Main Status Card */}
        <AppCard style={styles.card}>
          {isRejected ? (
            /* Rejected State */
            <View style={styles.stateContainer}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                <XCircle size={36} color="#DC2626" />
              </View>
              <View style={[styles.badge, { backgroundColor: '#FEF2F2', borderColor: '#FCA5A5' }]}>
                <Text style={[styles.badgeText, { color: '#DC2626' }]}>APPLICATION REJECTED</Text>
              </View>
              <Text style={[styles.statusTitle, { color: colors.text }]}>
                Registration Not Approved
              </Text>
              <Text style={[styles.statusDescription, { color: colors.textSecondary }]}>
                Your staff registration request was reviewed and rejected by the store administrator.
              </Text>

              {/* Rejection Reason Box */}
              <View style={[styles.reasonBox, { backgroundColor: '#FFF1F2', borderColor: '#FECDD3' }]}>
                <Text style={styles.reasonLabel}>REASON:</Text>
                <Text style={styles.reasonText}>
                  "{currentUser?.rejectionReason || 'Application does not meet onboarding criteria.'}"
                </Text>
                {currentUser?.rejectedByName && (
                  <Text style={styles.reasonMeta}>
                    Reviewed by: {currentUser.rejectedByName}
                  </Text>
                )}
              </View>
            </View>
          ) : (
            /* Pending State */
            <View style={styles.stateContainer}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Clock size={36} color="#D97706" />
              </View>
              <View style={[styles.badge, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Text style={[styles.badgeText, { color: '#D97706' }]}>WAITING FOR APPROVAL</Text>
              </View>
              <Text style={[styles.statusTitle, { color: colors.text }]}>
                Waiting for Approval
              </Text>
              <Text style={[styles.statusDescription, { color: colors.textSecondary }]}>
                Your details have been submitted. Store admin will review and approve your account shortly.
              </Text>
            </View>
          )}

          {/* Applicant Details Summary */}
          <View style={[styles.detailsBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Text style={[styles.detailsSectionTitle, { color: colors.textSecondary }]}>
              YOUR DETAILS
            </Text>

            <View style={styles.detailRow}>
              <UserIcon size={16} color={colors.textSecondary} style={styles.detailIcon} />
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Name:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>{currentUser?.name || '—'}</Text>
            </View>

            <View style={styles.detailRow}>
              <CheckCircle2 size={16} color="#16A34A" style={styles.detailIcon} />
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Email:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>
                {currentUser?.email || '—'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <ScanFace size={16} color="#2563EB" style={styles.detailIcon} />
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Face Attendance:</Text>
              <Text style={[styles.detailValue, { color: colors.primary }]}>
                {currentUser?.faceEnrollmentStatus === 'approved' ? 'Approved' : 'Completed (Under Review)'}
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Smartphone size={16} color="#7C3AED" style={styles.detailIcon} />
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Linked Phone:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {currentUser?.deviceModel || 'Phone'} (Pending Approval)
              </Text>
            </View>

            <View style={styles.detailRow}>
              <Calendar size={16} color={colors.textSecondary} style={styles.detailIcon} />
              <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>Role:</Text>
              <Text style={[styles.detailValue, { color: colors.text }]}>
                {currentUser?.designation || 'Staff'}
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {isRejected ? (
              <PrimaryButton
                title="Start New Registration"
                onPress={handleRestart}
                loading={restarting}
                size="large"
                style={styles.actionBtn}
              />
            ) : (
              <PrimaryButton
                title="Refresh Status"
                onPress={handleCheckStatus}
                loading={checking}
                size="large"
                icon={<RefreshCw size={18} color="#FFFFFF" />}
                style={styles.actionBtn}
              />
            )}

            <OutlineButton
              title="Sign Out"
              onPress={handleSignOut}
              loading={signingOut}
              size="large"
              icon={<LogOut size={18} color={colors.textSecondary} />}
              style={styles.actionBtn}
            />
          </View>
        </AppCard>

        {/* Support Help Text */}
        <Text style={[styles.footerHelp, { color: colors.textMuted }]}>
          Need urgent access? Reach out to your store manager or administrator directly.
        </Text>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    padding: SPACING.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100%',
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
    overflow: 'hidden',
  },
  logo: {
    width: 70,
    height: 70,
  },
  appTitle: {
    ...TYPOGRAPHY.titleMedium,
    fontWeight: '800',
  },
  appSubtitle: {
    ...TYPOGRAPHY.captionMedium,
    marginTop: 2,
  },
  card: {
    width: '100%',
    padding: SPACING.lg,
  },
  stateContainer: {
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: SPACING.xs,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTitle: {
    ...TYPOGRAPHY.titleSmall,
    fontWeight: '800',
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
  statusDescription: {
    ...TYPOGRAPHY.bodySmall,
    textAlign: 'center',
    marginTop: SPACING.xs,
    lineHeight: 18,
    paddingHorizontal: SPACING.sm,
  },
  reasonBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  reasonLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9F1239',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  reasonText: {
    ...TYPOGRAPHY.bodySmall,
    color: '#881337',
    fontStyle: 'italic',
  },
  reasonMeta: {
    ...TYPOGRAPHY.captionSmall,
    color: '#BE123C',
    marginTop: 6,
  },
  detailsBox: {
    width: '100%',
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginVertical: SPACING.sm,
  },
  detailsSectionTitle: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    marginBottom: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  detailIcon: {
    marginRight: SPACING.xs,
  },
  detailLabel: {
    ...TYPOGRAPHY.captionSmall,
    width: 110,
    fontWeight: '600',
  },
  detailValue: {
    ...TYPOGRAPHY.captionSmall,
    flex: 1,
    fontWeight: '700',
  },
  actions: {
    width: '100%',
    marginTop: SPACING.md,
  },
  actionBtn: {
    marginBottom: SPACING.xs,
  },
  footerHelp: {
    ...TYPOGRAPHY.captionSmall,
    textAlign: 'center',
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
});

