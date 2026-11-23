import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, Check, CheckCircle2, Clock, ShieldAlert, ShieldCheck, X } from 'lucide-react-native';
import { type AuthResult } from 'react-native-offline-face-auth';
import { FaceTemplate, FaceApprovalStatus, User } from '../types';
import { FaceRecognitionService } from '../services/faceRecognitionService';
import { StorageService } from '../services/storageService';
import { OnDeviceFaceAuthView } from './OnDeviceFaceAuthView';
import { safeCheckDuplicate, safeEnrollLocal } from '../services/onDeviceFaceAuth';
import { useTheme } from '../context/ThemeContext';
import { useAlert } from '../context/AlertContext';

interface FaceRegistrationModalProps {
  visible: boolean;
  staff: User | null;
  currentUserId: string;
  onSuccess: () => void;
  onClose: () => void;
}

type RegistrationStep = 'consent' | 'capture' | 'completed';
const REQUIRED_SAMPLES = 3;

export const FaceRegistrationModal: React.FC<FaceRegistrationModalProps> = ({ visible, staff, currentUserId, onSuccess, onClose }) => {
  const { colors } = useTheme();
  const { showWarning, showError, showConfirm } = useAlert();
  const [step, setStep] = useState<RegistrationStep>('consent');
  const [existingTemplate, setExistingTemplate] = useState<FaceTemplate | null>(null);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const samples = useRef<string[]>([]);
  const isCapturingRef = useRef(false);

  useEffect(() => {
    if (!visible || !staff) return;
    let mounted = true;
    setConsentAgreed(false);
    setSampleCount(0);
    setError('');
    samples.current = [];
    isCapturingRef.current = false;
    StorageService.getLatestFaceTemplate(staff.id).then(template => {
      if (!mounted) return;
      setExistingTemplate(template);
      setStep(template ? 'completed' : 'consent');
    });
    return () => { mounted = false; };
  }, [visible, staff]);

  const beginEnrollment = () => {
    if (!consentAgreed) {
      showWarning('Consent Required', 'Confirm that the staff member gave informed consent before enrolling their face.');
      return;
    }
    samples.current = [];
    isCapturingRef.current = false;
    setSampleCount(0);
    setError('');
    setStep('capture');
    setSessionKey(value => value + 1);
  };

  const handleCaptureResult = async (result: AuthResult) => {
    if (
      isCapturingRef.current ||
      samples.current.length >= REQUIRED_SAMPLES ||
      step !== 'capture' ||
      !staff
    ) {
      return;
    }
    if (!result.ok || !result.challengePassed || !result.embeddingB64) {
      if (!result.ok) {
        setError(result.failureReason === 'liveness_failed' || result.failureReason === 'challenge_failed'
          ? 'Liveness check failed. Follow the camera prompt and try again.'
          : 'Could not capture a clear face. Please try again.');
      }
      return;
    }
    isCapturingRef.current = true;
    setBusy(true);
    setError('');
    try {
      const duplicate = await safeCheckDuplicate(result.embeddingB64);
      if (duplicate.isDuplicate && duplicate.personnelId && duplicate.personnelId !== staff.id) {
        throw new Error('This face is already enrolled to another staff account. Ask a manager to review the existing profile.');
      }
      if (samples.current.length >= REQUIRED_SAMPLES) {
        return;
      }
      samples.current = [...samples.current, result.embeddingB64];
      const currentCount = Math.min(samples.current.length, REQUIRED_SAMPLES);
      setSampleCount(currentCount);

      if (currentCount < REQUIRED_SAMPLES) {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        setSessionKey(value => value + 1);
        isCapturingRef.current = false;
        setBusy(false);
        return;
      }

      await safeEnrollLocal(staff.id, samples.current);
      const isEnrolledByAdmin = currentUserId !== staff.id;
      const isAlreadyApproved = staff.faceEnrollmentStatus === 'approved' || staff.hasFaceRegistered === true;
      const initialApproval: FaceApprovalStatus = isEnrolledByAdmin
        ? 'approved'
        : (isAlreadyApproved ? 'pending_recovery' : 'pending');

      const saved = await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: staff.id,
        userName: staff.name,
        registeredBy: currentUserId,
        consentObtained: true,
        sampleCount: REQUIRED_SAMPLES,
        approvalStatus: initialApproval,
        approvedAt: initialApproval === 'approved' ? (staff.faceApprovedAt || new Date().toISOString()) : undefined,
        approvedByAdminName: initialApproval === 'approved' ? (staff.faceApprovedBy || 'Admin') : undefined,
      });
      if (!saved.success || !saved.template) throw new Error(saved.error || 'Could not save the on-device profile.');

      const verifiedTemplate = await StorageService.getFaceTemplate(staff.id);
      if (!verifiedTemplate || verifiedTemplate.userId !== staff.id) {
        throw new Error('Immediate read-back validation failed. Biometric face template was not persisted.');
      }

      setExistingTemplate(verifiedTemplate);
      setStep('completed');
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Face enrollment failed.');
      isCapturingRef.current = false;
      setBusy(false);
    }
  };

  const revokeTemplate = () => {
    if (!staff) return;
    showConfirm({
      title: 'Revoke Face Profile',
      message: `Remove the active face profile for ${staff.name}?`,
      confirmText: 'Revoke',
      cancelText: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        setBusy(true);
        try {
          await FaceRecognitionService.revokeFaceTemplate(staff.id, currentUserId);
          setExistingTemplate(null);
          setStep('consent');
          setConsentAgreed(false);
          onSuccess();
        } catch (reason) {
          showError('Revoke Failed', reason instanceof Error ? reason.message : 'Could not revoke face profile.');
        } finally {
          setBusy(false);
        }
      },
    });
  };

  const checkboxStyle = {
    backgroundColor: consentAgreed ? colors.primary : 'transparent',
    borderColor: consentAgreed ? colors.primary : colors.border,
  };

  if (!staff) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, step === 'capture' && styles.captureCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitle}>
              <Camera size={18} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>
                {staff.faceEnrollmentStatus === 'approved' || staff.hasFaceRegistered
                  ? 'Face Setup on This Phone'
                  : 'Biometric Face Enrollment'}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close face enrollment"><X size={20} color={colors.textSecondary} /></TouchableOpacity>
          </View>

          {visible && step === 'capture' ? (
            <View style={styles.captureWrap}>
              <View style={styles.cameraStage}>
                <OnDeviceFaceAuthView mode="enroll" sessionKey={sessionKey} onResult={handleCaptureResult} onClose={onClose} />
              </View>
              <View style={styles.captureInfo}>
                <Text style={[styles.progress, { color: colors.text }]}>Live sample {Math.min(sampleCount + 1, REQUIRED_SAMPLES)} of {REQUIRED_SAMPLES}</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>Follow the randomized blink, smile, or head-turn instruction. Samples stay encrypted on this device.</Text>
                {busy ? <ActivityIndicator color={colors.primary} /> : null}
                {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
                {error ? <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => { setError(''); setSessionKey(value => value + 1); }}><Text style={styles.primaryText}>Retry sample</Text></TouchableOpacity> : null}
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => { setStep('consent'); samples.current = []; setSampleCount(0); }}><Text style={{ color: colors.textSecondary }}>Cancel enrollment</Text></TouchableOpacity>
              </View>
            </View>
          ) : step === 'completed' && existingTemplate ? (
            <View style={styles.content}>
              {existingTemplate.approvalStatus === 'pending' ? (
                <>
                  <Clock size={42} color={colors.warning} />
                  <Text style={[styles.heading, { color: colors.text }]}>Enrollment Pending Approval</Text>
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>{staff.name}'s biometric face enrollment has been captured from {existingTemplate.sampleCount || 3} live samples.</Text>
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>An administrator must approve this enrollment before face-based punch in/out is enabled.</Text>
                </>
              ) : existingTemplate.approvalStatus === 'rejected' ? (
                <>
                  <ShieldAlert size={42} color={colors.danger} />
                  <Text style={[styles.heading, { color: colors.danger }]}>Face Enrollment Rejected</Text>
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>Reason: {existingTemplate.rejectionReason || 'Quality check failed. Please re-enroll in good lighting.'}</Text>
                  <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={() => { setStep('consent'); setConsentAgreed(false); }}><Text style={styles.primaryText}>Re-enroll Face</Text></TouchableOpacity>
                </>
              ) : (
                <>
                  <CheckCircle2 size={42} color={colors.success} />
                  <Text style={[styles.heading, { color: colors.text }]}>Face Profile Active & Approved</Text>
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>{staff.name} can punch in and out using live on-device face matching and liveness checks.</Text>
                  {existingTemplate.approvedAt && (
                    <Text style={[styles.hint, { color: colors.textSecondary, fontSize: 12 }]}>Approved on: {new Date(existingTemplate.approvedAt).toLocaleDateString()}</Text>
                  )}
                </>
              )}
              <Text style={[styles.hint, { color: colors.textSecondary, fontSize: 12 }]}>The encrypted embedding is stored in the device's secure local store. No raw face photo is stored.</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.danger }]} disabled={busy} onPress={revokeTemplate}><Text style={[styles.revokeText, { color: colors.danger }]}>Revoke</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary, flex: 1 }]} onPress={onClose}><Text style={styles.primaryText}>Done</Text></TouchableOpacity>
              </View>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <ShieldCheck size={38} color={colors.primary} />
              <Text style={[styles.heading, { color: colors.text }]}>
                {staff.faceEnrollmentStatus === 'approved' || staff.hasFaceRegistered
                  ? 'On-Device Face Setup'
                  : 'Privacy and Biometric Consent'}
              </Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>
                {staff.faceEnrollmentStatus === 'approved' || staff.hasFaceRegistered
                  ? 'Your staff account is approved. Complete 3 live camera samples on this phone to enable face verification for Punch In and Punch Out.'
                  : 'The front camera captures three live samples. Face matching and anti-spoofing liveness checks run entirely on-device. Biometric templates are encrypted at rest; camera frames are not uploaded to any server.'}
              </Text>
              <TouchableOpacity
                style={[styles.consentRow, { borderColor: consentAgreed ? colors.primary : colors.border }]}
                onPress={() => setConsentAgreed(value => !value)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: consentAgreed }}
              >
                <View style={[styles.checkbox, checkboxStyle]}>{consentAgreed ? <Check size={14} color="#fff" /> : null}</View>
                <Text style={[styles.hint, styles.consentText, { color: colors.text }]}>
                  {staff.faceEnrollmentStatus === 'approved' || staff.hasFaceRegistered
                    ? `I confirm ${staff.name} is setting up on-device face verification for daily attendance.`
                    : `I confirm ${staff.name} has provided explicit informed consent for biometric face recognition.`}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={!consentAgreed} style={[styles.primaryButton, { backgroundColor: consentAgreed ? colors.primary : colors.border }]} onPress={beginEnrollment}>
                <Text style={styles.primaryText}>
                  {staff.faceEnrollmentStatus === 'approved' || staff.hasFaceRegistered
                    ? 'Start Face Setup'
                    : 'Start Live Enrollment'}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.65)', padding: 16 },
  card: { maxHeight: '94%', minHeight: 380, borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  captureCard: { height: '94%', minHeight: 0 },
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  content: { padding: 22, gap: 14, alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  hint: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  consentRow: { width: '100%', padding: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  consentText: { flex: 1, flexShrink: 1, minWidth: 0, textAlign: 'left' },
  checkbox: { width: 22, height: 22, flexShrink: 0, marginTop: 1, borderWidth: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { width: '100%', minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  revokeText: { fontWeight: '700' },
  retryButton: { minHeight: 40, minWidth: 132, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  captureWrap: { flex: 1, minHeight: 0, padding: 12, gap: 10 },
  cameraStage: { flex: 1, minHeight: 0, overflow: 'hidden', borderRadius: 14 },
  captureInfo: { flexShrink: 0, alignItems: 'center', padding: 12, gap: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.96)' },
  progress: { fontWeight: '700' },
  error: { textAlign: 'center', fontSize: 13 },
});
