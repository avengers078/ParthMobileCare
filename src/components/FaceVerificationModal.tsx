import React, { useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { X, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { type AuthResult } from 'react-native-offline-face-auth';
import { FaceVerificationToken, User } from '../types';
import { FaceRecognitionService } from '../services/faceRecognitionService';
import { OnDeviceFaceAuthView } from './OnDeviceFaceAuthView';
import { useTheme } from '../context/ThemeContext';

interface FaceVerificationModalProps {
  visible: boolean;
  user: User;
  action: 'punch_in' | 'punch_out';
  onSuccess: (token: FaceVerificationToken) => void;
  onClose: () => void;
}

export const FaceVerificationModal: React.FC<FaceVerificationModalProps> = ({ visible, user, action, onSuccess, onClose }) => {
  const { colors } = useTheme();
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState('');
  const [working, setWorking] = useState(false);

  const handleResult = (result: AuthResult) => {
    if (!result.ok || !result.challengePassed) {
      setFailure(result.failureReason === 'no_template'
        ? 'No on-device face profile is enrolled for this staff member.'
        : result.failureReason === 'liveness_failed' || result.failureReason === 'challenge_failed'
          ? 'Liveness check did not pass. Follow the prompt and try again.'
          : 'Face verification failed. Center your face and try again.');
      return;
    }

    setFailure('');
    setWorking(true);
    const token = FaceRecognitionService.generateVerificationToken(
      user.id,
      action,
      result.matchScore,
      result.livenessScore,
      ['ON_DEVICE_FACE_MATCH', 'ACTIVE_LIVENESS_CHALLENGE'],
    );
    setTimeout(() => {
      setWorking(false);
      onSuccess(token);
    }, 500);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        {visible ? (
          <OnDeviceFaceAuthView
            mode="verify"
            personnelId={user.id}
            sessionKey={attempt}
            onResult={handleResult}
            onClose={onClose}
          />
        ) : null}
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <ShieldCheck size={18} color="#fff" />
            <Text style={styles.title}>{action === 'punch_in' ? 'Punch In' : 'Punch Out'} · Face Check</Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close face verification" style={styles.close}>
            <X size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {failure ? (
          <View style={styles.failureCard}>
            <Text style={[styles.failure, { color: colors.danger }]}>{failure}</Text>
            <TouchableOpacity style={[styles.retry, { backgroundColor: colors.primary }]} onPress={() => { setFailure(''); setAttempt(value => value + 1); }}>
              <RefreshCw size={16} color="#fff" />
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {working ? <View style={styles.working}><ActivityIndicator color="#fff" /><Text style={styles.workingText}>Face verified. Recording attendance…</Text></View> : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { position: 'absolute', left: 16, right: 16, top: 52, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.58)' },
  title: { color: '#fff', fontSize: 15, fontWeight: '700' },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.58)' },
  failureCard: { position: 'absolute', left: 20, right: 20, bottom: 74, padding: 16, gap: 12, alignItems: 'center', borderRadius: 14, backgroundColor: '#fff' },
  failure: { textAlign: 'center', fontSize: 14 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
  working: { position: 'absolute', left: 20, right: 20, bottom: 40, alignItems: 'center', gap: 8 },
  workingText: { color: '#fff', fontWeight: '600' },
});
