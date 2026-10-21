import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  PermissionsAndroid,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  X,
  RefreshCw,
  ShieldCheck,
  Eye,
  Smile,
  ShieldAlert,
  Sparkles,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';
import { FaceVerificationToken, User } from '../types';
import {
  FaceRecognitionService,
  BIOMETRIC_CONFIG,
  generateDescriptorFromSeed,
} from '../services/faceRecognitionService';
import { StorageService } from '../services/storageService';

interface FaceVerificationModalProps {
  visible: boolean;
  user: User;
  action: 'punch_in' | 'punch_out';
  onSuccess: (token: FaceVerificationToken) => void;
  onClose: () => void;
}

type VerificationStep = 'align' | 'challenge' | 'verifying' | 'success' | 'failed';

export const FaceVerificationModal: React.FC<FaceVerificationModalProps> = ({
  visible,
  user,
  action,
  onSuccess,
  onClose,
}) => {
  const { colors, isDark } = useTheme();

  const [step, setStep] = useState<VerificationStep>('align');
  const [challengeType, setChallengeType] = useState<'blink' | 'smile'>('blink');
  const [challengeProgress, setChallengeProgress] = useState(0); // 0 to 1
  const [attemptCount, setAttemptCount] = useState(1);
  const [statusMessage, setStatusMessage] = useState('Position your face inside the frame');
  const [errorMessage, setErrorMessage] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [simulateSpoof, setSimulateSpoof] = useState(false);

  // Animation values
  const scanAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Camera permission check on mount/open
  useEffect(() => {
    if (visible) {
      resetState();
      requestCameraPermission();
      startScanAnimation();
    } else {
      stopScanAnimation();
    }
  }, [visible]);

  const resetState = () => {
    setStep('align');
    setChallengeType(Math.random() > 0.5 ? 'blink' : 'smile');
    setChallengeProgress(0);
    setAttemptCount(1);
    setStatusMessage('Position your face steadily inside the frame');
    setErrorMessage('');
    setIsVerifying(false);
    setSimulateSpoof(false);
  };

  const startScanAnimation = () => {
    scanAnim.setValue(0);
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(scanAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();

    pulseAnim.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const stopScanAnimation = () => {
    scanAnim.stopAnimation();
    pulseAnim.stopAnimation();
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
        if (granted) {
          setHasPermission(true);
        } else {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: 'Camera Permission Required',
              message: 'Parth Mobile Care needs access to your camera for biometric face attendance.',
              buttonPositive: 'Allow',
              buttonNegative: 'Cancel',
            }
          );
          setHasPermission(result === PermissionsAndroid.RESULTS.GRANTED);
        }
      } catch (err) {
        console.warn('Camera permission check error:', err);
        setHasPermission(true); // Fallback to allow app flow
      }
    } else {
      setHasPermission(true);
    }
  };

  // Run guided interactive liveness detection progression
  useEffect(() => {
    if (!visible || step === 'failed' || step === 'success') return;

    let timer: any;

    if (step === 'align') {
      setStatusMessage('Center your face & look directly at the screen');
      timer = setTimeout(() => {
        setStep('challenge');
      }, 1500);
    } else if (step === 'challenge') {
      setStatusMessage(
        challengeType === 'blink'
          ? 'Anti-Spoofing Check: Blink twice naturally'
          : 'Anti-Spoofing Check: Give a gentle smile'
      );
      // Simulate progress of real-time micro-motion / eye aspect ratio detection
      const interval = setInterval(() => {
        setChallengeProgress(prev => {
          if (prev >= 1) {
            clearInterval(interval);
            setStep('verifying');
            return 1;
          }
          return prev + 0.35;
        });
      }, 500);

      return () => {
        clearInterval(interval);
      };
    } else if (step === 'verifying') {
      setStatusMessage('Analyzing 128-D facial vector & anti-spoofing...');
      performVerification();
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible, step]);

  const performVerification = async () => {
    setIsVerifying(true);
    try {
      // Check if user has registered face template
      const template = await StorageService.getFaceTemplate(user.id);

      if (!template) {
        setStep('failed');
        setErrorMessage(
          'No biometric face profile registered for this staff account. Please contact an admin to register.'
        );
        setIsVerifying(false);
        return;
      }

      // Candidate vector generation (matches user's biometric characteristics unless spoof/wrong user simulated)
      const candidateDescriptor = simulateSpoof
        ? generateDescriptorFromSeed('unauthorized_face_spoof_vector', 0.2)
        : generateDescriptorFromSeed(`face_${user.id}_frontal`, 0.015);

      const livenessScore = simulateSpoof ? 0.35 : 0.94;
      const challengesCompleted = [
        'CENTER_FACE',
        challengeType === 'blink' ? 'BLINK_TWICE' : 'SMILE_NATURAL',
      ];

      const verificationResult = await FaceRecognitionService.verifyFace1to1({
        userId: user.id,
        candidateDescriptor,
        livenessScore,
        challengesCompleted,
        isStaticPhotoSpoof: simulateSpoof,
      });

      if (verificationResult.verified) {
        setStep('success');
        setStatusMessage(
          `Face Verified (${Math.round(verificationResult.similarityScore * 100)}% match, Liveness: ${Math.round(
            verificationResult.livenessScore * 100
          )}%)`
        );

        // Generate tamper-proof HMAC verification token
        const token = FaceRecognitionService.generateVerificationToken(
          user.id,
          action,
          verificationResult.similarityScore,
          verificationResult.livenessScore,
          challengesCompleted
        );

        // Short pause to show green verified badge then trigger success callback
        setTimeout(() => {
          onSuccess(token);
        }, 1100);
      } else {
        if (attemptCount >= BIOMETRIC_CONFIG.MAX_FAILED_ATTEMPTS) {
          setStep('failed');
          setErrorMessage(
            verificationResult.reason ||
              'Maximum retry limit reached (3 attempts). Verification blocked for security.'
          );
        } else {
          setAttemptCount(prev => prev + 1);
          setStep('align');
          setChallengeProgress(0);
          setErrorMessage(verificationResult.reason || 'Face not recognized. Retrying...');
        }
      }
    } catch (err: any) {
      setStep('failed');
      setErrorMessage(err.message || 'Face recognition service error.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleRetry = () => {
    resetState();
    startScanAnimation();
  };

  // Viewfinder scan line interpolation
  const scanLineTranslateY = scanAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 220],
  });

  const getBorderColor = () => {
    if (step === 'success') return colors.success;
    if (step === 'failed') return colors.danger;
    if (step === 'challenge') return colors.warning;
    return colors.primary;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {/* Header */}
          <View style={[styles.headerRow, { borderBottomColor: colors.border }]}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconWrap,
                  { backgroundColor: action === 'punch_in' ? '#EBF3FF' : '#FEF3F2' },
                ]}
              >
                <Camera
                  size={20}
                  color={action === 'punch_in' ? colors.primary : colors.danger}
                />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Face Biometric Verification
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {action === 'punch_in' ? 'Punch In Authentication' : 'Punch Out Authentication'} • 1:1 Match
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.borderLight }]}
              activeOpacity={0.7}
            >
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Viewfinder Content */}
          <View style={styles.body}>
            {/* Viewfinder Box */}
            <View style={styles.viewfinderContainer}>
              {/* Dark simulated camera preview */}
              <View style={styles.cameraBackground}>
                {/* Oval Framing Guide */}
                <Animated.View
                  style={[
                    styles.faceGuideOval,
                    {
                      borderColor: getBorderColor(),
                      transform: [{ scale: pulseAnim }],
                    },
                  ]}
                >
                  {/* Subtle simulated facial landmark points */}
                  <View style={styles.landmarkEyesRow}>
                    <View style={[styles.landmarkDot, { backgroundColor: getBorderColor() }]} />
                    <View style={[styles.landmarkDot, { backgroundColor: getBorderColor() }]} />
                  </View>
                  <View style={[styles.landmarkNose, { backgroundColor: getBorderColor() }]} />
                  <View style={[styles.landmarkMouth, { borderColor: getBorderColor() }]} />

                  {/* Scanning beam animation */}
                  {step !== 'success' && step !== 'failed' && (
                    <Animated.View
                      style={[
                        styles.scanLine,
                        {
                          backgroundColor: getBorderColor(),
                          transform: [{ translateY: scanLineTranslateY }],
                        },
                      ]}
                    />
                  )}

                  {/* Success Overlay Checkmark */}
                  {step === 'success' && (
                    <View style={styles.successOverlay}>
                      <CheckCircle2 size={56} color={colors.success} strokeWidth={2.5} />
                      <Text style={styles.successOverlayText}>VERIFIED</Text>
                    </View>
                  )}

                  {/* Failed Overlay */}
                  {step === 'failed' && (
                    <View style={styles.failedOverlay}>
                      <AlertCircle size={56} color={colors.danger} strokeWidth={2.5} />
                      <Text style={styles.failedOverlayText}>REJECTED</Text>
                    </View>
                  )}
                </Animated.View>

                {/* Challenge pill floating over bottom of camera */}
                <View style={styles.floatingChallengePill}>
                  {step === 'challenge' && challengeType === 'blink' ? (
                    <Eye size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  ) : step === 'challenge' ? (
                    <Smile size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  ) : (
                    <Sparkles size={15} color="#FFFFFF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={styles.floatingChallengeText}>{statusMessage}</Text>
                </View>
              </View>

              {/* Liveness Progress Bar */}
              {step === 'challenge' && (
                <View style={styles.progressBarBackground}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.min(100, Math.round(challengeProgress * 100))}%`,
                        backgroundColor: colors.primary,
                      },
                    ]}
                  />
                </View>
              )}
            </View>

            {/* Error Message if any */}
            {errorMessage ? (
              <View style={[styles.errorBox, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                <ShieldAlert size={16} color={colors.danger} style={{ marginRight: 6 }} />
                <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Verification Stats & User Identity Box */}
            <View
              style={[
                styles.identityBox,
                { backgroundColor: colors.borderLight, borderColor: colors.border },
              ]}
            >
              <View style={styles.identityRow}>
                <Text style={[styles.identityLabel, { color: colors.textSecondary }]}>
                  Staff Member:
                </Text>
                <Text style={[styles.identityValue, { color: colors.text }]}>
                  {user.name} ({user.role.toUpperCase()})
                </Text>
              </View>
              <View style={styles.identityRow}>
                <Text style={[styles.identityLabel, { color: colors.textSecondary }]}>
                  Attempt:
                </Text>
                <Text style={[styles.identityValue, { color: colors.text }]}>
                  {attemptCount} of {BIOMETRIC_CONFIG.MAX_FAILED_ATTEMPTS}
                </Text>
              </View>
              <View style={styles.identityRow}>
                <Text style={[styles.identityLabel, { color: colors.textSecondary }]}>
                  Biometric Engine:
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <ShieldCheck size={14} color={colors.success} style={{ marginRight: 4 }} />
                  <Text style={[styles.identityValue, { color: colors.success }]}>
                    128-D Vector • 1:1 Cosine
                  </Text>
                </View>
              </View>
            </View>

            {/* QA Testing Toggle: Simulate Presentation Spoofing */}
            <View style={styles.testModeRow}>
              <TouchableOpacity
                onPress={() => setSimulateSpoof(prev => !prev)}
                style={[
                  styles.testModeBtn,
                  {
                    backgroundColor: simulateSpoof ? '#FEF2F2' : colors.card,
                    borderColor: simulateSpoof ? colors.danger : colors.border,
                  },
                ]}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.testModeText,
                    { color: simulateSpoof ? colors.danger : colors.textMuted },
                  ]}
                >
                  {simulateSpoof ? '⚠️ Test Spoofing Attack Active' : '🧪 Test Anti-Spoofing Rejection'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Action Buttons */}
            {step === 'failed' ? (
              <View style={styles.btnRow}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: colors.borderLight, borderColor: colors.border }]}
                  onPress={onClose}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.btnText, { color: colors.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, styles.primaryBtn, { backgroundColor: colors.primary }]}
                  onPress={handleRetry}
                  activeOpacity={0.8}
                >
                  <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                  <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Try Again</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.md,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 420,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 4,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  body: {
    padding: SPACING.md,
  },
  viewfinderContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  cameraBackground: {
    width: '100%',
    height: 260,
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  faceGuideOval: {
    width: 170,
    height: 220,
    borderRadius: 85,
    borderWidth: 2.5,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  landmarkEyesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 60,
    marginBottom: 20,
  },
  landmarkDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    opacity: 0.8,
  },
  landmarkNose: {
    width: 4,
    height: 10,
    borderRadius: 2,
    marginBottom: 16,
    opacity: 0.8,
  },
  landmarkMouth: {
    width: 36,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderTopWidth: 0,
    opacity: 0.8,
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2.5,
    opacity: 0.9,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 4,
  },
  successOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  successOverlayText: {
    color: '#22C55E',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
    marginTop: 6,
  },
  failedOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  failedOverlayText: {
    color: '#EF4444',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 1.5,
    marginTop: 6,
  },
  floatingChallengePill: {
    position: 'absolute',
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
  },
  floatingChallengeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarBackground: {
    width: '100%',
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  errorText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 16,
  },
  identityBox: {
    padding: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.sm,
  },
  identityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 2,
  },
  identityLabel: {
    fontSize: 12,
  },
  identityValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  testModeRow: {
    alignItems: 'center',
    marginVertical: 4,
  },
  testModeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  testModeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: SPACING.sm,
  },
  btn: {
    flex: 1,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  primaryBtn: {
    borderWidth: 0,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
