import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  AppState,
} from 'react-native';
import { X, RefreshCw, ShieldCheck, AlertTriangle } from 'lucide-react-native';
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

const MAX_ATTEMPTS = 3;

export const FaceVerificationModal: React.FC<FaceVerificationModalProps> = ({
  visible,
  user,
  action,
  onSuccess,
  onClose,
}) => {
  const { colors } = useTheme();
  const [attempt, setAttempt] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [failure, setFailure] = useState('');
  const [working, setWorking] = useState(false);
  const [showCoaching, setShowCoaching] = useState(false);

  // Reset state when modal is opened
  useEffect(() => {
    if (visible) {
      setAttempt(0);
      setFailedAttempts(0);
      setFailure('');
      setWorking(false);
      setShowCoaching(false);
    }
  }, [visible]);

  // Coaching timer: if verification hasn't succeeded within 12 seconds, display helpful guidance
  useEffect(() => {
    if (!visible || failure || working) {
      setShowCoaching(false);
      return;
    }
    setShowCoaching(false);
    const timer = setTimeout(() => {
      setShowCoaching(true);
    }, 12000);
    return () => clearTimeout(timer);
  }, [visible, attempt, failure, working]);

  // Protect against app backgrounding during biometric verification
  useEffect(() => {
    if (!visible) return;

    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'background' || nextState === 'inactive') {
        onClose();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [visible, onClose]);

  const handleResult = (result: AuthResult) => {
    // 1. Strict 1:1 Matching Guard: Prevent fallback or match to a different staff member
    if (result.personnelId && result.personnelId !== user.id) {
      const nextCount = failedAttempts + 1;
      setFailedAttempts(nextCount);
      setFailure('Mismatched staff face. Verification must be performed by the authenticated staff member.');
      return;
    }

    if (!result.ok || !result.challengePassed) {
      const nextCount = failedAttempts + 1;
      setFailedAttempts(nextCount);

      if (nextCount >= MAX_ATTEMPTS) {
        setFailure('Face verification failed repeatedly. Please contact your store administrator.');
        return;
      }

      const remaining = MAX_ATTEMPTS - nextCount;
      const attemptNote = ` (${remaining} attempt${remaining === 1 ? '' : 's'} remaining)`;

      if (result.failureReason === 'no_template') {
        setFailure('Your face profile is not registered on this device. Please complete face enrollment first.');
      } else if (
        result.failureReason === 'liveness_failed' ||
        result.failureReason === 'challenge_failed'
      ) {
        setFailure(`Liveness check did not pass. Follow the prompt and try again.${attemptNote}`);
      } else {
        setFailure(`Face not matched. Please look directly at the camera and try again.${attemptNote}`);
      }
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

  const handleRetry = () => {
    setFailure('');
    setAttempt(val => val + 1);
  };

  const isExhausted = failedAttempts >= MAX_ATTEMPTS;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
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
            <Text style={styles.title}>
              {action === 'punch_in' ? 'Punch In' : 'Punch Out'} · Face Check
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Close face verification"
            style={styles.close}
          >
            <X size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {showCoaching && !failure && !working ? (
          <View style={styles.coachingCard}>
            <Text style={styles.coachingText}>
              Taking a moment? Hold the phone steady at eye level with good lighting.
            </Text>
            <TouchableOpacity onPress={handleRetry} style={styles.coachingRetryBtn}>
              <RefreshCw size={12} color="#fff" />
              <Text style={styles.coachingRetryText}>Refresh Camera</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {failure ? (
          <View
            style={[
              styles.failureCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <View style={styles.failureRow}>
              <AlertTriangle size={20} color={colors.danger} />
              <Text style={[styles.failure, { color: colors.danger }]}>{failure}</Text>
            </View>

            {isExhausted ? (
              <TouchableOpacity
                style={[styles.closeFailBtn, { backgroundColor: colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.closeFailText, { color: colors.text }]}>
                  Contact Store Administrator
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.retry, { backgroundColor: colors.primary }]}
                onPress={handleRetry}
              >
                <RefreshCw size={16} color="#fff" />
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}

        {working ? (
          <View style={styles.working}>
            <ActivityIndicator color="#fff" size="large" />
            <Text style={styles.workingText}>Face verified. Recording attendance…</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  title: { color: '#fff', fontSize: 15, fontWeight: '700' },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  failureCard: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 74,
    padding: 18,
    gap: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  failureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  failure: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  retry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
  },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  closeFailBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
  },
  closeFailText: { fontWeight: '700', fontSize: 13 },
  working: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 40,
    alignItems: 'center',
    gap: 8,
  },
  workingText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  coachingCard: {
    position: 'absolute',
    top: 76,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  coachingText: {
    color: '#F8FAFC',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  coachingRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(25,77,156,0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  coachingRetryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
