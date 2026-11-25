import { FaceAuth } from 'react-native-offline-face-auth';
import {
  removePersonnel as nativeRemovePersonnel,
  loadAll as nativeLoadAll,
} from 'react-native-offline-face-auth/src/secure/templateStore';
import { collection, getDocs, query, where } from 'firebase/firestore';

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
          challenges: ['blink', 'turn_left', 'turn_right', 'turn_head', 'smile'],
          thresholds: {
            fineThreshold: 0.64,
            coarseThreshold: 0.45,
            matchCosine: 0.64,
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

function decodeEmbeddingB64(b64: string): number[] {
  try {
    const bin = typeof globalThis.atob === 'function'
      ? globalThis.atob(b64)
      : typeof Buffer !== 'undefined'
      ? Buffer.from(b64, 'base64').toString('binary')
      : '';
    if (!bin) return [];
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const floatArr = new Float32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
    return Array.from(floatArr);
  } catch {
    return [];
  }
}

function calculateCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom > 0 ? dot / denom : 0;
}

/** Check duplicate safely without throwing if native store is not available */
export async function safeCheckDuplicate(
  embeddingB64: string,
  currentUserId?: string
): Promise<{ isDuplicate: boolean; personnelId?: string; score: number; personnelName?: string }> {
  // 1. Native FaceAuth hardware/SecureKV duplicate scan
  try {
    await initializeOnDeviceFaceAuth();
    if (isFaceAuthReady()) {
      const nativeResult = await FaceAuth.checkDuplicate(embeddingB64);
      if (nativeResult.isDuplicate && nativeResult.personnelId && (!currentUserId || nativeResult.personnelId !== currentUserId)) {
        return nativeResult;
      }
    }
  } catch (error) {
    console.warn('[FaceAuth] checkDuplicate fallback:', error);
  }

  // 2. Cross-account face template scan against LOCAL stored biometric descriptors
  const candidateVector = decodeEmbeddingB64(embeddingB64);
  try {
    const { StorageService } = await import('./storageService');
    const templates = await StorageService.getFaceTemplates();

    if (candidateVector.length > 0 && Array.isArray(templates)) {
      for (const tmpl of templates) {
        if (tmpl.userId && (!currentUserId || tmpl.userId !== currentUserId) && tmpl.status === 'active') {
          if (Array.isArray(tmpl.faceDescriptor) && tmpl.faceDescriptor.length > 0) {
            const similarity = calculateCosineSimilarity(candidateVector, tmpl.faceDescriptor);
            if (similarity >= 0.62) {
              return {
                isDuplicate: true,
                personnelId: tmpl.userId,
                score: similarity,
                personnelName: tmpl.userName,
              };
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('[FaceAuth] StorageService duplicate check fallback:', e);
  }

  // 3. Cross-device Firestore-based face descriptor scan
  // This catches duplicates even when the first registration happened on a different device
  // or when local templates were cleared (app reinstall, data wipe, etc.)
  if (candidateVector.length > 0) {
    try {
      const FirebaseService = (await import('./firebase')).default;
      const db = FirebaseService.getFirestore();
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('hasFaceRegistered', '==', true));
      const snapshot = await getDocs(q);

      for (const docSnap of snapshot.docs) {
        const data = docSnap.data();
        const docUserId = data.id || docSnap.id;

        // Skip the current user's own record
        if (currentUserId && docUserId === currentUserId) continue;

        // Check if this user has a stored face descriptor in Firestore
        if (Array.isArray(data.faceDescriptor) && data.faceDescriptor.length > 0) {
          const similarity = calculateCosineSimilarity(candidateVector, data.faceDescriptor);
          if (similarity >= 0.62) {
            return {
              isDuplicate: true,
              personnelId: docUserId,
              score: similarity,
              personnelName: data.name || 'Existing Staff',
            };
          }
        }
      }
    } catch (firestoreErr) {
      console.warn('[FaceAuth] Firestore cross-device duplicate check error (non-fatal):', firestoreErr);
      // Non-fatal: if Firestore is unreachable, local checks (Layer 1 & 2) still apply
    }
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

