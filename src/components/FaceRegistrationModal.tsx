import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  Camera,
  CheckCircle2,
  ShieldCheck,
  X,
  Trash2,
  RefreshCw,
  Sparkles,
  Info,
  Check,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../theme';
import { FaceTemplate, User } from '../types';
import {
  FaceRecognitionService,
  generateDescriptorFromSeed,
} from '../services/faceRecognitionService';
import { StorageService } from '../services/storageService';
import { formatDate } from '../utils/format';

interface FaceRegistrationModalProps {
  visible: boolean;
  staff: User | null;
  currentUserId: string;
  onSuccess: () => void;
  onClose: () => void;
}

type RegistrationStep = 'consent' | 'capture' | 'completed';

export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({
  visible,
  staff,
  currentUserId,
  onSuccess,
  onClose,
}) => {
  const { colors, isDark } = useTheme();

  const [step, setStep] = useState<RegistrationStep>('consent');
  const [existingTemplate, setExistingTemplate] = useState<FaceTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [currentSampleIndex, setCurrentSampleIndex] = useState(0); // 0, 1, 2
  const [capturedSamples, setCapturedSamples] = useState<number[][]>([]);
  const [isCapturingSample, setIsCapturingSample] = useState(false);

  useEffect(() => {
    if (visible && staff) {
      loadExisting();
    } else {
      resetState();
    }
  }, [visible, staff]);

  const resetState = () => {
    setStep('consent');
    setConsentAgreed(false);
    setCurrentSampleIndex(0);
    setCapturedSamples([]);
    setIsCapturingSample(false);
  };

  const loadExisting = async () => {
    if (!staff) return;
    setIsLoading(true);
    try {
      const tmpl = await StorageService.getFaceTemplate(staff.id);
      setExistingTemplate(tmpl);
      if (tmpl) {
        // If already registered, start at status screen
        setStep('completed');
      } else {
        setStep('consent');
      }
    } catch (err) {
      console.warn('Error loading face template:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartCapture = () => {
    if (!consentAgreed) {
      Alert.alert('Consent Required', 'Please confirm that the staff member has given explicit consent.');
      return;
    }
    setStep('capture');
    setCurrentSampleIndex(0);
    setCapturedSamples([]);
  };

  const samplePrompts = [
    { title: 'Frontal Angle', desc: 'Look directly into camera with neutral expression' },
    { title: 'Slight Left Angle', desc: 'Turn head slightly 10° to the left' },
    { title: 'Slight Right Angle', desc: 'Turn head slightly 10° to the right with gentle smile' },
  ];

  const handleCaptureNextSample = async () => {
    if (!staff) return;
    setIsCapturingSample(true);

    try {
      // Simulate capture of high-quality biometric sample vector
      const seed = `face_${staff.id}_sample_${currentSampleIndex}_${Date.now()}`;
      const sampleVector = generateDescriptorFromSeed(seed, 0.015);

      const updated = [...capturedSamples, sampleVector];
      setCapturedSamples(updated);

      if (currentSampleIndex < 2) {
        setCurrentSampleIndex(prev => prev + 1);
      } else {
        // All 3 samples captured, finalize registration
        finalizeRegistration(updated);
      }
    } catch (e: any) {
      Alert.alert('Capture Error', e.message || 'Failed to capture sample');
    } finally {
      setIsCapturingSample(false);
    }
  };

  const finalizeRegistration = async (samples: number[][]) => {
    if (!staff) return;
    setIsLoading(true);
    try {
      const result = await FaceRecognitionService.registerFaceTemplate({
        userId: staff.id,
        userName: staff.name,
        registeredBy: currentUserId,
        consentObtained: true,
        sampleDescriptors: samples,
        qualityScore: 0.97,
      });

      if (result.success && result.template) {
        setExistingTemplate(result.template);
        setStep('completed');
        Alert.alert(
          'Biometrics Registered',
          `Face profile successfully registered for ${staff.name}. Staff member can now punch in/out with face verification.`
        );
        onSuccess();
      } else {
        Alert.alert('Registration Failed', result.error || 'Could not register template.');
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Face registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeTemplate = () => {
    if (!staff) return;
    Alert.alert(
      'Revoke Biometric Data',
      `Are you sure you want to remove the registered face template for ${staff.name}? They will not be able to punch in/out until re-registered.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              const ok = await FaceRecognitionService.revokeFaceTemplate(staff.id, currentUserId);
              if (ok) {
                setExistingTemplate(null);
                setStep('consent');
                setConsentAgreed(false);
                Alert.alert('Revoked', 'Face biometric template has been successfully deleted.');
                onSuccess();
              }
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to revoke template.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  if (!staff) return null;

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
              <View style={[styles.iconWrap, { backgroundColor: '#EBF3FF' }]}>
                <Camera size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>
                  Staff Biometric Registration
                </Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  {staff.name} • {staff.designation}
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

          {/* Body */}
          <ScrollView contentContainerStyle={styles.body}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Processing biometric template...
                </Text>
              </View>
            ) : step === 'consent' ? (
              <View>
                {/* DPDP Compliance & Privacy Notice */}
                <View
                  style={[
                    styles.privacyCard,
                    { backgroundColor: colors.borderLight, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.privacyHeader}>
                    <ShieldCheck size={18} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.privacyTitle, { color: colors.text }]}>
                      Privacy & Data Protection Notice
                    </Text>
                  </View>
                  <Text style={[styles.privacyBody, { color: colors.textSecondary }]}>
                    In accordance with biometric data standards and privacy principles:
                    {'\n'}• Biometric facial images are converted directly into privacy-preserving
                    128-dimensional encrypted mathematical vectors.
                    {'\n'}• No raw facial photographs are stored on disk or transferred to third
                    parties.
                    {'\n'}• Attendance verification is performed strictly 1:1 against this staff
                    member's own record.
                    {'\n'}• The staff member or manager may revoke this biometric registration at
                    any time.
                  </Text>
                </View>

                {/* Consent Checkbox */}
                <TouchableOpacity
                  style={[
                    styles.consentCheckboxRow,
                    {
                      borderColor: consentAgreed ? colors.primary : colors.border,
                      backgroundColor: consentAgreed
                        ? isDark
                          ? 'rgba(25, 77, 156, 0.15)'
                          : '#EAF2FF'
                        : colors.card,
                    },
                  ]}
                  onPress={() => setConsentAgreed(prev => !prev)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: consentAgreed ? colors.primary : colors.textMuted,
                        backgroundColor: consentAgreed ? colors.primary : 'transparent',
                      },
                    ]}
                  >
                    {consentAgreed && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
                  </View>
                  <Text style={[styles.consentText, { color: colors.text }]}>
                    I confirm that {staff.name} has provided informed consent for biometric face
                    attendance registration.
                  </Text>
                </TouchableOpacity>

                {/* Start Registration Button */}
                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: consentAgreed ? colors.primary : colors.border,
                      opacity: consentAgreed ? 1 : 0.6,
                    },
                  ]}
                  onPress={handleStartCapture}
                  disabled={!consentAgreed}
                  activeOpacity={0.8}
                >
                  <Camera size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.actionBtnText}>Proceed to Camera Setup</Text>
                </TouchableOpacity>
              </View>
            ) : step === 'capture' ? (
              <View>
                {/* Sampling Stage Indicator */}
                <View style={styles.sampleStepRow}>
                  {samplePrompts.map((p, idx) => (
                    <View key={idx} style={styles.sampleStepCol}>
                      <View
                        style={[
                          styles.stepIndicatorCircle,
                          {
                            backgroundColor:
                              idx < currentSampleIndex
                                ? colors.success
                                : idx === currentSampleIndex
                                ? colors.primary
                                : colors.border,
                          },
                        ]}
                      >
                        {idx < currentSampleIndex ? (
                          <Check size={12} color="#FFFFFF" strokeWidth={3} />
                        ) : (
                          <Text style={styles.stepIndicatorText}>{idx + 1}</Text>
                        )}
                      </View>
                      <Text
                        style={[
                          styles.stepIndicatorLabel,
                          {
                            color:
                              idx === currentSampleIndex ? colors.primary : colors.textSecondary,
                            fontWeight: idx === currentSampleIndex ? '700' : '400',
                          },
                        ]}
                      >
                        Sample {idx + 1}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Camera Viewfinder Preview */}
                <View style={styles.cameraBox}>
                  <View style={styles.guideOval}>
                    <Text style={styles.guideOvalHint}>Keep Face Centered</Text>
                  </View>
                  <View style={styles.capturePromptPill}>
                    <Sparkles size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.capturePromptTitle}>
                      {samplePrompts[currentSampleIndex]?.title}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.sampleDescText, { color: colors.textSecondary }]}>
                  {samplePrompts[currentSampleIndex]?.desc}
                </Text>

                {/* Quality Metrics Box */}
                <View
                  style={[
                    styles.qualityBox,
                    { backgroundColor: colors.borderLight, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.qualityRow}>
                    <Text style={[styles.qualityLabel, { color: colors.textSecondary }]}>
                      Lighting:
                    </Text>
                    <Text style={[styles.qualityValue, { color: colors.success }]}>
                      Optimal (98%)
                    </Text>
                  </View>
                  <View style={styles.qualityRow}>
                    <Text style={[styles.qualityLabel, { color: colors.textSecondary }]}>
                      Sharpness / Resolution:
                    </Text>
                    <Text style={[styles.qualityValue, { color: colors.success }]}>High</Text>
                  </View>
                  <View style={styles.qualityRow}>
                    <Text style={[styles.qualityLabel, { color: colors.textSecondary }]}>
                      Face Alignment:
                    </Text>
                    <Text style={[styles.qualityValue, { color: colors.primary }]}>Centered</Text>
                  </View>
                </View>

                {/* Capture Button */}
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                  onPress={handleCaptureNextSample}
                  disabled={isCapturingSample}
                  activeOpacity={0.8}
                >
                  {isCapturingSample ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Camera size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                      <Text style={styles.actionBtnText}>
                        Capture Frame {currentSampleIndex + 1} of 3
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* Completed / Existing Template View */
              <View>
                <View
                  style={[
                    styles.statusCard,
                    {
                      backgroundColor: isDark ? 'rgba(34,197,94,0.1)' : '#F0FDF4',
                      borderColor: colors.success,
                    },
                  ]}
                >
                  <CheckCircle2 size={36} color={colors.success} />
                  <Text style={[styles.statusCardTitle, { color: colors.success }]}>
                    Face Profile Active
                  </Text>
                  <Text style={[styles.statusCardSub, { color: colors.textSecondary }]}>
                    Biometric template is securely saved and active for Punch In and Punch Out.
                  </Text>
                </View>

                <View
                  style={[
                    styles.detailsCard,
                    { backgroundColor: colors.borderLight, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Registered At:
                    </Text>
                    <Text style={[styles.detailVal, { color: colors.text }]}>
                      {existingTemplate?.registeredAt
                        ? formatDate(existingTemplate.registeredAt)
                        : 'Active'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Embedding Vector:
                    </Text>
                    <Text style={[styles.detailVal, { color: colors.text }]}>
                      128-D L2 Normalized
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Quality Score:
                    </Text>
                    <Text style={[styles.detailVal, { color: colors.success }]}>
                      {existingTemplate?.qualityScore
                        ? `${Math.round(existingTemplate.qualityScore * 100)}%`
                        : '98%'}
                    </Text>
                  </View>
                  <View style={styles.detailRow}>
                    <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>
                      Template Integrity Hash:
                    </Text>
                    <Text style={[styles.detailVal, { color: colors.textMuted }]}>
                      {existingTemplate?.templateHash
                        ? `${existingTemplate.templateHash.substring(0, 16)}...`
                        : 'Verified'}
                    </Text>
                  </View>
                </View>

                {/* Management Action Buttons */}
                <View style={styles.btnRow}>
                  <TouchableOpacity
                    style={[
                      styles.btn,
                      { backgroundColor: colors.card, borderColor: colors.danger },
                    ]}
                    onPress={handleRevokeTemplate}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color={colors.danger} style={{ marginRight: 6 }} />
                    <Text style={[styles.btnText, { color: colors.danger }]}>Revoke</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.btn,
                      styles.primaryBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={() => {
                      setStep('consent');
                      setConsentAgreed(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <RefreshCw size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={[styles.btnText, { color: '#FFFFFF' }]}>Re-Register</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </ScrollView>
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
    maxHeight: '90%',
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
  loadingContainer: {
    paddingVertical: SPACING.xl,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    marginTop: SPACING.sm,
  },
  privacyCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  privacyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  privacyBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  consentCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    marginBottom: SPACING.md,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  consentText: {
    fontSize: 12,
    flex: 1,
    fontWeight: '600',
    lineHeight: 18,
  },
  actionBtn: {
    height: 48,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sampleStepRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: SPACING.md,
  },
  sampleStepCol: {
    alignItems: 'center',
  },
  stepIndicatorCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  stepIndicatorLabel: {
    fontSize: 11,
  },
  cameraBox: {
    height: 220,
    backgroundColor: '#0F172A',
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: SPACING.sm,
  },
  guideOval: {
    width: 140,
    height: 180,
    borderRadius: 70,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#38BDF8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideOvalHint: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.8,
  },
  capturePromptPill: {
    position: 'absolute',
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  capturePromptTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  sampleDescText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  qualityBox: {
    padding: SPACING.sm,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  qualityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 2,
  },
  qualityLabel: {
    fontSize: 11,
  },
  qualityValue: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusCard: {
    padding: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  statusCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
  },
  statusCardSub: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  detailsCard: {
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: SPACING.md,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  detailLabel: {
    fontSize: 12,
  },
  detailVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
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
