import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { FaceAuth, FaceAuthView, type AuthMode, type AuthResult, type FaceAuthModels } from 'react-native-offline-face-auth';
import { useTensorflowModel } from 'react-native-fast-tflite';
import { useTheme } from '../context/ThemeContext';
import { initializeOnDeviceFaceAuth } from '../services/onDeviceFaceAuth';

const blazeFaceAsset = require('../assets/faceModels/blazeface.tflite');
const faceMeshAsset = require('../assets/faceModels/face_mesh.tflite');
const faceNetAsset = require('../assets/faceModels/facenet_512.tflite');
const spoof27Asset = require('../assets/faceModels/spoof_2_7.tflite');
const spoof40Asset = require('../assets/faceModels/spoof_4_0.tflite');

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
  const blaze = useTensorflowModel(blazeFaceAsset);
  const mesh = useTensorflowModel(faceMeshAsset);
  const embedding = useTensorflowModel(faceNetAsset);
  const live27 = useTensorflowModel(spoof27Asset);
  const live40 = useTensorflowModel(spoof40Asset);

  useEffect(() => {
    let mounted = true;
    initializeOnDeviceFaceAuth().then(
      () => mounted && setReady(true),
      reason => mounted && setError(reason instanceof Error ? reason.message : 'Could not initialize face recognition.'),
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
  if (error || modelErrorMessage) {
    return <View style={styles.center}><Text style={[styles.message, { color: colors.danger }]}>{error || modelErrorMessage}</Text></View>;
  }
  if (!ready || !models) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={[styles.message, { color: colors.textSecondary }]}>Preparing on-device face recognition…</Text></View>;
  }

  return (
    <FaceAuthView
      key={sessionKey}
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
  center: { flex: 1, minHeight: 280, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  message: { textAlign: 'center', fontSize: 14 },
});
