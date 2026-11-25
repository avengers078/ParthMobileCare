import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { FaceAuth, FaceAuthView, type AuthMode, type AuthResult, type FaceAuthModels } from 'react-native-offline-face-auth';
import * as TFLite from 'react-native-fast-tflite';
import { useTheme } from '../context/ThemeContext';
import { initializeOnDeviceFaceAuth } from '../services/onDeviceFaceAuth';

const blazeFaceAsset = require('../assets/faceModels/blazeface.tflite');
const faceMeshAsset = require('../assets/faceModels/face_mesh.tflite');
const faceNetAsset = require('../assets/faceModels/facenet_512.tflite');
const spoof27Asset = require('../assets/faceModels/spoof_2_7.tflite');
const spoof40Asset = require('../assets/faceModels/spoof_4_0.tflite');

/**
 * Generates a UNIQUE random mock embedding for dev mode.
 * Each call produces a different random 512-d vector so that duplicate face
 * detection works correctly even when using the dev override bypass button.
 * In production, real camera embeddings from FaceNet are used instead.
 */
function createMockEmbeddingB64(): string {
  const floats = new Float32Array(512);
  // Use Math.random() to produce a unique embedding per capture session
  for (let i = 0; i < 512; i++) floats[i] = (Math.random() - 0.5) * 2.0;
  // L2-normalize the vector for realistic cosine similarity behavior
  let norm = 0;
  for (let i = 0; i < 512; i++) norm += floats[i] * floats[i];
  norm = Math.sqrt(norm);
  if (norm > 0) { for (let i = 0; i < 512; i++) floats[i] /= norm; }
  const bytes = new Uint8Array(floats.buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  if (typeof btoa === 'function') return btoa(binary);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i];
    const b1 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b2 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    out += chars[b0 >> 2];
    out += chars[((b0 & 3) << 4) | (b1 >> 4)];
    out += i + 1 < bytes.length ? chars[((b1 & 15) << 2) | (b2 >> 6)] : '=';
    out += i + 2 < bytes.length ? chars[b2 & 63] : '=';
  }
  return out;
}

const dummyErrorPlugin = {
  state: 'error' as const,
  model: undefined,
  error: new Error('Native TFLite module is not installed in this build.'),
};

const isNativeTfliteAvailable = () => typeof (global as any).__loadTensorflowModel === 'function';
const useFallbackModel = (_asset: any) => dummyErrorPlugin;
const useModelHook = (asset: any, delegate?: any) => {
  if (!isNativeTfliteAvailable() || typeof (TFLite as any)?.useTensorflowModel !== 'function') {
    return dummyErrorPlugin;
  }
  return (TFLite as any).useTensorflowModel(asset, delegate);
};

interface OnDeviceFaceAuthViewProps {
  mode: AuthMode;
  personnelId?: string;
  sessionKey: number;
  onResult: (result: AuthResult) => void;
  onClose: () => void;
}

export const OnDeviceFaceAuthView: React.FC<OnDeviceFaceAuthViewProps> = ({
  mode,
  personnelId,
  sessionKey,
  onResult,
  onClose,
}) => {
  const { colors } = useTheme();
  const [ready, setReady] = useState(FaceAuth.isInitialized());
  const [error, setError] = useState('');
  const blaze = useModelHook(blazeFaceAsset);
  const mesh = useModelHook(faceMeshAsset);
  const embedding = useModelHook(faceNetAsset);
  const live27 = useModelHook(spoof27Asset);
  const live40 = useModelHook(spoof40Asset);

  useEffect(() => {
    let mounted = true;
    initializeOnDeviceFaceAuth().then(
      () => mounted && setReady(true),
      () => mounted && setReady(true),
    );
    return () => { mounted = false; };
  }, []);

  const models = useMemo<FaceAuthModels | undefined>(() => {
    if (blaze.state !== 'loaded' || mesh.state !== 'loaded' || embedding.state !== 'loaded' || live27.state !== 'loaded' || live40.state !== 'loaded') return undefined;
    return {
      blazeface: blaze.model,
      faceMesh: mesh.model,
      embedding: embedding.model,
      liveness0: live27.model,
      liveness1: live40.model,
    } as unknown as FaceAuthModels;
  }, [blaze, mesh, embedding, live27, live40]);

  const modelError = [blaze, mesh, embedding, live27, live40]
    .find(model => model.state === 'error');

  const modelErrorMessage = modelError?.state === 'error' ? modelError.error.message : '';
  const rawMessage = error || modelErrorMessage;

  if (rawMessage) {
    const isNativeMissing =
      rawMessage.includes('Native TFLite') ||
      rawMessage.includes('GenericPassword') ||
      rawMessage.includes('RNGetRandomValues');
    const displayMessage = isNativeMissing
      ? (__DEV__
          ? 'On-device camera AI is operating in simulated dev mode.\nUse Dev Override to complete this action.'
          : 'Biometric verification hardware or AI service is unavailable. Please ensure camera permissions are granted or contact your administrator.')
      : rawMessage;

    return (
      <View style={styles.center}>
        <Text style={[styles.message, { color: isNativeMissing ? colors.warning || '#D97706' : colors.danger }]}>
          {displayMessage}
        </Text>
        {__DEV__ && (
          <TouchableOpacity
            style={[styles.fallbackBtn, { backgroundColor: colors.primary }]}
            onPress={() => {
              onResult({
                ok: true,
                challengePassed: true,
                matchScore: 0.95,
                livenessScore: 0.98,
                isSpoof: false,
                embeddingB64: createMockEmbeddingB64(),
              } as any);
            }}
          >
            <Text style={styles.fallbackBtnText}>Bypass Face Check (Dev Override)</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>Close</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!ready || !models) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
        <Text style={[styles.message, { color: colors.textSecondary }]}>Preparing on-device face recognition…</Text>
      </View>
    );
  }

  return (
    <FaceAuthView
      sessionKey={sessionKey}
      mode={mode}
      personnelId={personnelId}
      models={models}
      onResult={onResult}
      onClose={onClose}
      style={styles.camera}
    />
  );
};

const styles = StyleSheet.create({
  camera: { flex: 1 },
  center: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 },
  message: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  fallbackBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  fallbackBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  closeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  closeBtnText: {
    fontSize: 13,
  },
});
