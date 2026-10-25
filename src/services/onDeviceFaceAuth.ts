import { FaceAuth } from 'react-native-offline-face-auth';

let initialization: Promise<void> | null = null;

/** Initialize the encrypted, local-only face template store once per app run. */
export function initializeOnDeviceFaceAuth(): Promise<void> {
  if (!initialization) {
    initialization = FaceAuth.init({
      deviceId: 'parth-mobile-care-device',
      debug: false,
      challenges: ['blink', 'smile', 'turn_head'],
      thresholds: { fineThreshold: 0.8, matchCosine: 0.8 },
    }).catch(error => {
      initialization = null;
      throw error;
    });
  }
  return initialization;
}
