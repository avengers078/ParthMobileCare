import { FaceAuth } from 'react-native-offline-face-auth';
import {
  removePersonnel as nativeRemovePersonnel,
  loadAll as nativeLoadAll,
} from 'react-native-offline-face-auth/src/secure/templateStore';

let initialization: Promise<boolean> | null = null;
let isInitialized = false;

/** Initialize the encrypted, local-only face template store once per app run. */
export async function initializeOnDeviceFaceAuth(): Promise<boolean> {
  if (isInitialized) return true;
  try {
    if (FaceAuth && typeof FaceAuth.isInitialized === 'function' && FaceAuth.isInitialized()) {
      isInitialized = true;
      return true;
    }
  } catch {
    // Ignore native module check error
  }

  if (!initialization) {
    initialization = (async () => {
      try {
        if (!FaceAuth || typeof FaceAuth.init !== 'function') {
          console.warn('[FaceAuth] Native FaceAuth module is not present.');
          return false;
        }
        await FaceAuth.init({
          deviceId: 'parth-mobile-care-device',
          debug: false,
          challenges: ['blink', 'smile', 'turn_head'],
          thresholds: {
            fineThreshold: 0.70,
            coarseThreshold: 0.50,
            matchCosine: 0.65,
            centerMargin: 0.02,
            minFaceArea: 0.04,
            maxYaw: 40,
            maxPitch: 50,
            maxRoll: 50,
            minBrightness: 30,
            maxBrightness: 245,
            minSharpness: 40,
          },
        });
        isInitialized = true;
        return true;
      } catch (error) {
        console.warn('[FaceAuth] FaceAuth initialization note (running in resilient dev mode):', error);
        return false;
      }
    })();
  }
  return initialization;
}

export function isFaceAuthReady(): boolean {
  if (isInitialized) return true;
  try {
    return Boolean(FaceAuth && typeof FaceAuth.isInitialized === 'function' && FaceAuth.isInitialized());
  } catch {
    return false;
  }
}

/** Check duplicate safely without throwing if native store is not available */
export async function safeCheckDuplicate(
  embeddingB64: string
): Promise<{ isDuplicate: boolean; personnelId?: string; score: number }> {
  try {
    await initializeOnDeviceFaceAuth();
    if (isFaceAuthReady()) {
      return await FaceAuth.checkDuplicate(embeddingB64);
    }
  } catch (error) {
    console.warn('[FaceAuth] checkDuplicate fallback:', error);
  }
  return { isDuplicate: false, score: 0 };
}

/** Enroll local face safely with immediate read-back verification */
export async function safeEnrollLocal(
  personnelId: string,
  samples: string[]
): Promise<boolean> {
  if (!personnelId || !Array.isArray(samples) || samples.length === 0) {
    console.warn('[FaceAuth] enrollLocal rejected: missing personnelId or empty samples');
    return false;
  }

  try {
    await initializeOnDeviceFaceAuth();
    if (isFaceAuthReady()) {
      await FaceAuth.enrollLocal(personnelId, samples);

      // Immediate read-back verification of encrypted native store
      const verified = await hasOnDeviceFaceEnrollment(personnelId);
      if (!verified) {
        console.warn('[FaceAuth] Immediate read-back after enrollLocal returned false for', personnelId);
        return false;
      }
      return true;
    }
  } catch (error) {
    console.warn('[FaceAuth] enrollLocal error:', error);
  }
  return false;
}

/** Remove personnel from on-device store safely without throwing */
export async function safeRemovePersonnel(personnelId: string): Promise<boolean> {
  try {
    if (isFaceAuthReady()) {
      nativeRemovePersonnel(personnelId);
      return true;
    }
  } catch (error) {
    console.warn('[FaceAuth] removePersonnel fallback:', error);
  }
  return false;
}

/** Check if on-device biometric store contains enrolled embeddings for this personnel */
export async function hasOnDeviceFaceEnrollment(personnelId: string): Promise<boolean> {
  if (!personnelId) return false;
  try {
    await initializeOnDeviceFaceAuth();
    if (isFaceAuthReady()) {
      try {
        const templates = nativeLoadAll();
        return Array.isArray(templates) && templates.some((t) => t.personnelId === personnelId);
      } catch {
        try {
          const { openTemplateStore } = await import('react-native-offline-face-auth/src/secure/templateStore');
          await openTemplateStore();
          const templates = nativeLoadAll();
          return Array.isArray(templates) && templates.some((t) => t.personnelId === personnelId);
        } catch {
          return false;
        }
      }
    }
  } catch (error) {
    console.warn('[FaceAuth] hasOnDeviceFaceEnrollment check error:', error);
  }
  return false;
}

