import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Camera, Check, CheckCircle2, ShieldCheck, X } from 'lucide-react-native';
import { FaceAuth, type AuthResult } from 'react-native-offline-face-auth';
import { FaceTemplate, User } from '../types';
import { FaceRecognitionService } from '../services/faceRecognitionService';
import { StorageService } from '../services/storageService';
import { OnDeviceFaceAuthView } from './OnDeviceFaceAuthView';
import { useTheme } from '../context/ThemeContext';

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
  const [step, setStep] = useState<RegistrationStep>('consent');
  const [existingTemplate, setExistingTemplate] = useState<FaceTemplate | null>(null);
  const [consentAgreed, setConsentAgreed] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const samples = useRef<string[]>([]);

  useEffect(() => {
    if (!visible || !staff) return;
    let mounted = true;
    setConsentAgreed(false);
    setSampleCount(0);
    setError('');
    samples.current = [];
    StorageService.getFaceTemplate(staff.id).then(template => {
      if (!mounted) return;
      setExistingTemplate(template);
      setStep(template ? 'completed' : 'consent');
    });
    return () => { mounted = false; };
  }, [visible, staff]);

  const beginEnrollment = () => {
    if (!consentAgreed) {
      Alert.alert('Consent Required', 'Confirm that the staff member gave informed consent before enrolling their face.');
      return;
    }
    samples.current = [];
    setSampleCount(0);
    setError('');
    setStep('capture');
    setSessionKey(value => value + 1);
  };

  const handleCaptureResult = async (result: AuthResult) => {
    if (!result.ok || !result.challengePassed || !result.embeddingB64 || !staff || busy) {
      if (!result.ok) setError(result.failureReason === 'liveness_failed' || result.failureReason === 'challenge_failed'
        ? 'Liveness check failed. Follow the camera prompt and try again.'
        : 'Could not capture a clear face. Please try again.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const duplicate = await FaceAuth.checkDuplicate(result.embeddingB64);
      if (duplicate.isDuplicate && duplicate.personnelId !== staff.id) {
        throw new Error('This face is already enrolled to another staff account. Ask a manager to review the existing profile.');
      }
      samples.current = [...samples.current, result.embeddingB64];
      setSampleCount(samples.current.length);

      if (samples.current.length < REQUIRED_SAMPLES) {
        setSessionKey(value => value + 1);
        return;
      }

      await FaceAuth.enrollLocal(staff.id, samples.current);
      const saved = await FaceRecognitionService.registerOnDeviceFaceTemplate({
        userId: staff.id,
        userName: staff.name,
        registeredBy: currentUserId,
        consentObtained: true,
        sampleCount: samples.current.length,
      });
      if (!saved.success || !saved.template) throw new Error(saved.error || 'Could not save the on-device profile.');
      setExistingTemplate(saved.template);
      setStep('completed');
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Face enrollment failed.');
      setSessionKey(value => value + 1);
    } finally {
      setBusy(false);
    }
  };

  const revokeTemplate = () => {
    if (!staff) return;
    Alert.alert('Revoke Face Profile', `Remove the active face profile for ${staff.name}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Revoke', style: 'destructive', onPress: async () => {
        setBusy(true);
        try {
          await FaceRecognitionService.revokeFaceTemplate(staff.id, currentUserId);
          setExistingTemplate(null);
          setStep('consent');
          setConsentAgreed(false);
          onSuccess();
        } catch (reason) {
          Alert.alert('Error', reason instanceof Error ? reason.message : 'Could not revoke face profile.');
        } finally { setBusy(false); }
      } },
    ]);
  };

  const checkboxStyle = {
    backgroundColor: consentAgreed ? colors.primary : 'transparent',
    borderColor: consentAgreed ? colors.primary : colors.border,
  };

  if (!staff) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerTitle}><Camera size={18} color={colors.primary} /><Text style={[styles.title, { color: colors.text }]}>On-device Face Enrollment</Text></View>
            <TouchableOpacity onPress={onClose} accessibilityLabel="Close face enrollment"><X size={20} color={colors.textSecondary} /></TouchableOpacity>
          </View>

          {visible && step === 'capture' ? (
            <View style={styles.captureWrap}>
              <OnDeviceFaceAuthView mode="enroll" sessionKey={sessionKey} onResult={handleCaptureResult} onClose={onClose} />
              <View style={styles.captureInfo}>
                <Text style={[styles.progress, { color: colors.text }]}>Live sample {Math.min(sampleCount + 1, REQUIRED_SAMPLES)} of {REQUIRED_SAMPLES}</Text>
                <Text style={[styles.hint, { color: colors.textSecondary }]}>Follow the randomized blink, smile, or head-turn instruction. Samples stay on this device.</Text>
                {busy ? <ActivityIndicator color={colors.primary} /> : null}
                {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
                {error ? <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={() => { setError(''); setSessionKey(value => value + 1); }}><Text style={styles.primaryText}>Retry sample</Text></TouchableOpacity> : null}
                <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => { setStep('consent'); samples.current = []; setSampleCount(0); }}><Text style={{ color: colors.textSecondary }}>Cancel enrollment</Text></TouchableOpacity>
              </View>
            </View>
          ) : step === 'completed' && existingTemplate ? (
            <View style={styles.content}>
              <CheckCircle2 size={42} color={colors.success} />
              <Text style={[styles.heading, { color: colors.text }]}>Face profile active</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>{staff.name} can punch in and out using live on-device face matching and liveness checks.</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>The encrypted embedding is stored in the device’s secure local store. No face image is saved.</Text>
              <TouchableOpacity style={[styles.secondaryButton, { borderColor: colors.danger }]} disabled={busy} onPress={revokeTemplate}><Text style={[styles.revokeText, { color: colors.danger }]}>Revoke face profile</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={onClose}><Text style={styles.primaryText}>Done</Text></TouchableOpacity>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <ShieldCheck size={38} color={colors.primary} />
              <Text style={[styles.heading, { color: colors.text }]}>Privacy and consent</Text>
              <Text style={[styles.hint, { color: colors.textSecondary }]}>The camera captures three live samples. Face matching and liveness checks run on this device. The face embedding is stored in encrypted local storage; camera frames are not saved or uploaded.</Text>
              <TouchableOpacity style={[styles.consentRow, { borderColor: consentAgreed ? colors.primary : colors.border }]} onPress={() => setConsentAgreed(value => !value)}>
                <View style={[styles.checkbox, checkboxStyle]}>{consentAgreed ? <Check size={14} color="#fff" /> : null}</View>
                <Text style={[styles.hint, { color: colors.text }]}>I confirm {staff.name} has given informed consent for biometric attendance.</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={!consentAgreed} style={[styles.primaryButton, { backgroundColor: consentAgreed ? colors.primary : colors.border }]} onPress={beginEnrollment}><Text style={styles.primaryText}>Start live enrollment</Text></TouchableOpacity>
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
  header: { minHeight: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '700' },
  content: { padding: 22, gap: 14, alignItems: 'center' },
  heading: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  hint: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  consentRow: { width: '100%', padding: 12, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 22, height: 22, borderWidth: 1, borderRadius: 5, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { width: '100%', minHeight: 46, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  secondaryButton: { minHeight: 40, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  revokeText: { fontWeight: '700' },
  retryButton: { minHeight: 40, minWidth: 132, paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  captureWrap: { flex: 1, minHeight: 450 },
  captureInfo: { position: 'absolute', left: 14, right: 14, bottom: 14, alignItems: 'center', padding: 12, gap: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.96)' },
  progress: { fontWeight: '700' },
  error: { textAlign: 'center', fontSize: 13 },
});
