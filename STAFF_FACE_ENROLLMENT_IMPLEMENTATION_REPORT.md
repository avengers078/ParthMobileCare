# Parth Mobile Care — Staff Face Enrollment Implementation Report

## Executive Summary

As part of the Direct Staff Registration upgrade for the Parth Mobile Care React Native application, a completely self-contained, on-device facial biometric enrollment pipeline has been integrated into the registration intake workflow. This implementation replaces previous administrative invitation procedures with a secure, on-device biometric capture system compliant with the zero-cost Firebase Spark Plan.

---

## 1. Biometric Pipeline Architecture

### 1.1 Model Topology & On-Device Execution
The face enrollment pipeline operates strictly client-side on mobile devices via TensorFlow Lite (TFLite) without transmitting raw biometric photos or embeddings to any external servers:
1. **Face Detection**: `blazeface.tflite` detects the bounding box of the facial ROI (Region of Interest) and coordinates within the live camera feed.
2. **Face Mesh & Landmark Alignment**: `face_mesh.tflite` extracts facial landmarks to evaluate head pose, centering, yaw angle, and eye/mouth aspect ratios.
3. **Anti-Spoofing & Liveness Validation**: Dual passive anti-spoofing models (`spoof_2_7.tflite` and `spoof_4_0.tflite`) evaluate texture and depth gradients to prevent printed photo, replay, and mask attacks (rejection boundary: liveness threshold `0.5`).
4. **Embedding Generation**: `facenet_512.tflite` (MobileFaceNet architecture) extracts a 512-dimensional floating-point representation normalized to unit length ($L_2$ norm = 1.0).

### 1.2 Informed Biometric Consent
Prior to camera activation, the registration wizard presents an explicit informed consent agreement. In compliance with biometric data privacy standards:
- The applicant must explicitly confirm consent to the collection and processing of facial biometric features solely for work attendance authentication.
- Biometric vectors and hashes remain encrypted on-device.

---

## 2. Multi-Sample Capture Protocol

To maximize noise robustness and minimize false reject rates (FRR) under varied store lighting conditions:
1. **Sample Requirement**: The enrollment intake requires exactly **3 valid facial sample captures** (`REQUIRED_SAMPLES = 3`).
2. **Liveness & Quality Filtering**: Each sample must independently satisfy the anti-spoofing threshold and liveness challenge.
3. **Centroid Vector Calculation**: Upon capturing 3 samples, the centroid vector is computed and normalized, generating a robust template representation.
4. **Duplicate Prevention**: Before enrolling, `safeCheckDuplicate(embedding)` verifies that the applicant's face does not match any already enrolled staff member on the device or local database.

---

## 3. Storage & Metadata Synchronization

### 3.1 Local Persistence
The biometric template is securely stored in local SQLite / AsyncStorage via `safeEnrollLocal(userId, samples)` and `FaceRecognitionService.registerOnDeviceFaceTemplate`:
- **Template ID**: Cryptographically unique identifier (`tmpl_{userId}_{timestamp}_{nonce}`).
- **Template Hash**: SHA-256 hash of the normalized centroid embedding.
- **Approval Status**: Initialized to `pending` (or `pending_review`).

### 3.2 Firestore User Document State
When the staff registration document is submitted to Cloud Firestore (`users/{uid}`):
```json
{
  "id": "AUTH_UID",
  "faceEnrollmentStatus": "pending_review",
  "faceModelVersion": "facenet_512",
  "hasFaceRegistered": false,
  "faceRegistrationDate": "2026-11-03T20:27:00.000Z"
}
```
`hasFaceRegistered` remains strictly `false` until the store administrator formally approves the registration request via the Admin Web Dashboard. Unapproved staff are completely blocked from logging attendance.

---

## 4. Spark Plan Compliance Verification

| Requirement | Implementation Status | Verification |
| :--- | :--- | :--- |
| **No Cloud Functions** | All detection, alignment, liveness, and embedding extraction run on-device via TFLite. | Verified |
| **No Firebase Storage** | Raw photos are never uploaded or stored; only on-device embeddings are processed. | Verified |
| **No Paid APIs** | 0 Google Vision API, 0 AWS Rekognition, 0 third-party paid verification services. | Verified |
| **No Blaze Upgrade** | Operates 100% within Firebase Spark Free Tier quotas. | Verified |

