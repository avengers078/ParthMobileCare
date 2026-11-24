import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { Camera, Image as ImageIcon, X, RefreshCw, Plus, CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { CloudinaryService } from '../services/cloudinaryService';
import { RADIUS, SPACING } from '../theme';

interface MultiDeviceInspectionCaptureProps {
  photos: string[];
  onChange: (photos: string[]) => void;
  brand?: string;
  maxPhotos?: number;
}

const SLOT_LABELS = ['Front View', 'Back Panel', 'Display / Screen', 'Ports & Edges'];
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export const MultiDeviceInspectionCapture: React.FC<MultiDeviceInspectionCaptureProps> = ({
  photos = [],
  onChange,
  brand = 'Device',
  maxPhotos = 4,
}) => {
  const { colors, isDark } = useTheme();
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [replacingIndex, setReplacingIndex] = useState<number | null>(null);

  const requestCameraPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
      const granted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.CAMERA
      );
      if (granted) return true;

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission Required',
          message: 'Parth Mobile Care needs access to your camera to take device inspection photos.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        }
      );

      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        return true;
      } else {
        Alert.alert(
          'Permission Denied',
          'Camera permission is required to take photos. Please enable camera access in Android App Settings.'
        );
        return false;
      }
    } catch (err) {
      console.warn('Camera permission check error:', err);
      return false;
    }
  };

  const requestGalleryPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    const apiLevel = Platform.Version;
    if (typeof apiLevel === 'number' && apiLevel >= 33) {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
        );
        if (granted) return true;

        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
          {
            title: 'Photo Access Required',
            message: 'Parth Mobile Care needs access to select device inspection photos from your gallery.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Media images permission error:', err);
        return true;
      }
    } else {
      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
        );
        if (granted) return true;

        const result = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission Required',
            message: 'Parth Mobile Care needs storage permission to select photos from your gallery.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Storage permission check error:', err);
        return true;
      }
    }
  };

  const processAndUpload = async (uri: string, targetIndex?: number) => {
    if (!CloudinaryService.isConfigured()) {
      Alert.alert(
        'Cloud Storage Paused',
        'Cloud image upload is temporarily paused until storage is connected. Purchase details and customer digital signature can still be recorded normally.'
      );
      return;
    }

    const slotIdx = targetIndex !== undefined ? targetIndex : photos.length;
    setUploadingIndex(slotIdx);

    try {
      const uploadRes = await CloudinaryService.uploadImage(uri, {
        folder: 'devices',
        tags: ['device_inspection', brand, `slot_${slotIdx + 1}`],
      });

      if (uploadRes.success && uploadRes.secureUrl) {
        if (targetIndex === undefined && photos.includes(uploadRes.secureUrl)) {
          Alert.alert('Duplicate Photo', 'This inspection photo has already been uploaded for another angle.');
          return;
        }
        if (targetIndex !== undefined) {
          // Replace existing photo at index
          const next = [...photos];
          next[targetIndex] = uploadRes.secureUrl;
          onChange(next);
        } else {
          // Add new photo
          onChange([...photos, uploadRes.secureUrl]);
        }
      } else {
        Alert.alert('Upload Failed', uploadRes.error || 'Could not upload inspection photo.');
      }
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Network error while uploading photo.');
    } finally {
      setUploadingIndex(null);
      setReplacingIndex(null);
    }
  };

  const handleLaunchCamera = async (targetIndex?: number) => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const options: CameraOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1600,
      maxWidth: 1600,
      quality: 0.8,
      saveToPhotos: false,
      cameraType: 'back',
    };

    try {
      const response = await launchCamera(options);
      if (response.didCancel) return;

      if (response.errorCode) {
        Alert.alert('Camera Error', response.errorMessage || 'Unable to access camera.');
        return;
      }

      if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
        const asset = response.assets[0];
        if (asset.uri) {
          if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
            Alert.alert('File Too Large', 'Please select a photo smaller than 10MB.');
            return;
          }
          await processAndUpload(asset.uri, targetIndex);
        }
      }
    } catch (err: any) {
      Alert.alert('Camera Error', err?.message || 'Failed to capture photo.');
    }
  };

  const handleLaunchGallery = async (targetIndex?: number) => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) return;

    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1600,
      maxWidth: 1600,
      quality: 0.8,
      selectionLimit: 1,
    };

    try {
      const response = await launchImageLibrary(options);
      if (response.didCancel) return;

      if (response.errorCode) {
        Alert.alert('Gallery Error', response.errorMessage || 'Unable to access gallery.');
        return;
      }

      if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
        const asset = response.assets[0];
        if (asset.uri) {
          if (asset.fileSize && asset.fileSize > MAX_FILE_SIZE_BYTES) {
            Alert.alert('File Too Large', 'Please select a photo smaller than 10MB.');
            return;
          }
          await processAndUpload(asset.uri, targetIndex);
        }
      }
    } catch (err: any) {
      Alert.alert('Gallery Error', err?.message || 'Failed to select photo.');
    }
  };

  const handleRemovePhoto = (index: number) => {
    Alert.alert(
      'Remove Photo',
      `Are you sure you want to remove ${SLOT_LABELS[index] || `Photo ${index + 1}`}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            onChange(photos.filter((_, i) => i !== index));
          },
        },
      ]
    );
  };

  const isUploading = uploadingIndex !== null;

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.title, { color: colors.text }]}>
            Device Inspection Photos
          </Text>
          <View style={[styles.counterBadge, { backgroundColor: photos.length === maxPhotos ? '#10B981' : colors.primary }]}>
            <Text style={styles.counterText}>{photos.length}/{maxPhotos}</Text>
          </View>
        </View>

        {isUploading && (
          <View style={styles.uploadingBadge}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.uploadingText, { color: colors.primary }]}>
              Uploading {uploadingIndex! + 1} of {maxPhotos}...
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.subHint, { color: colors.textSecondary }]}>
        Capture all 4 angles: Front, Back, Screen, Ports & Edges
      </Text>

      {/* Grid of 4 Photo Slots */}
      <View style={styles.grid}>
        {Array.from({ length: maxPhotos }).map((_, idx) => {
          const photoUrl = photos[idx];
          const isCurrentUploading = uploadingIndex === idx;
          const slotLabel = SLOT_LABELS[idx] || `Photo ${idx + 1}`;
          const isSlotActive = Boolean(photoUrl);
          const isNextSlot = !photoUrl && idx === photos.length;

          if (isCurrentUploading) {
            return (
              <View
                key={idx}
                style={[
                  styles.slotCard,
                  styles.slotLoading,
                  { backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderColor: colors.primary },
                ]}
              >
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingLabel, { color: colors.primary }]}>
                  Uploading...
                </Text>
              </View>
            );
          }

          if (isSlotActive) {
            return (
              <View
                key={idx}
                style={[
                  styles.slotCard,
                  { backgroundColor: isDark ? '#1E293B' : '#F8FAFC', borderColor: colors.border },
                ]}
              >
                <Image
                  source={{ uri: CloudinaryService.getDeviceThumbnailUrl(photoUrl) }}
                  style={styles.thumbnail}
                  resizeMode="cover"
                />

                <View style={styles.slotFooter}>
                  <Text style={[styles.slotBadgeText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {idx + 1}. {slotLabel}
                  </Text>
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      onPress={() => {
                        Alert.alert('Replace Photo', `Replace ${slotLabel}:`, [
                          { text: 'Camera', onPress: () => handleLaunchCamera(idx) },
                          { text: 'Gallery', onPress: () => handleLaunchGallery(idx) },
                          { text: 'Cancel', style: 'cancel' },
                        ]);
                      }}
                      style={[styles.smallBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}
                    >
                      <RefreshCw size={11} color={colors.text} />
                      <Text style={[styles.smallBtnText, { color: colors.text }]}>Replace</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => handleRemovePhoto(idx)}
                      style={[styles.smallBtn, styles.removeBtn]}
                    >
                      <X size={11} color="#EF4444" />
                      <Text style={[styles.smallBtnText, { color: '#EF4444' }]}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }

          if (isNextSlot) {
            return (
              <View
                key={idx}
                style={[
                  styles.slotCard,
                  styles.slotAdd,
                  {
                    backgroundColor: isDark ? 'rgba(25,77,156,0.1)' : 'rgba(25,77,156,0.04)',
                    borderColor: colors.primary,
                  },
                ]}
              >
                <View style={styles.nextSlotHeader}>
                  <Plus size={16} color={colors.primary} />
                  <Text style={[styles.nextSlotTitle, { color: colors.primary }]}>
                    {idx + 1}. {slotLabel}
                  </Text>
                </View>

                <View style={styles.addButtonsRow}>
                  <TouchableOpacity
                    onPress={() => handleLaunchCamera(undefined)}
                    disabled={isUploading}
                    style={[styles.addChoiceBtn, { backgroundColor: colors.primary }]}
                  >
                    <Camera size={13} color="#FFFFFF" />
                    <Text style={styles.addChoiceBtnText}>Camera</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleLaunchGallery(undefined)}
                    disabled={isUploading}
                    style={[styles.addChoiceBtn, { backgroundColor: isDark ? '#334155' : '#E2E8F0' }]}
                  >
                    <ImageIcon size={13} color={colors.text} />
                    <Text style={[styles.addChoiceBtnText, { color: colors.text }]}>Gallery</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }

          // Placeholder slot (ahead of next slot)
          return (
            <View
              key={idx}
              style={[
                styles.slotCard,
                styles.slotPlaceholder,
                { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: colors.border },
              ]}
            >
              <Text style={[styles.placeholderNumber, { color: colors.textSecondary }]}>
                {idx + 1}
              </Text>
              <Text style={[styles.placeholderLabel, { color: colors.textSecondary }]}>
                {slotLabel}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: SPACING.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontSize: 13,
    fontWeight: '700',
  },
  counterBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  counterText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  uploadingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  uploadingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  subHint: {
    fontSize: 11,
    marginBottom: SPACING.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  slotCard: {
    width: '48.5%',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: 'hidden',
    minHeight: 130,
    justifyContent: 'space-between',
  },
  slotLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
    gap: 6,
  },
  loadingLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  thumbnail: {
    width: '100%',
    height: 80,
    backgroundColor: '#E2E8F0',
  },
  slotFooter: {
    padding: 6,
    gap: 4,
  },
  slotBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  smallBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
    gap: 2,
  },
  smallBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  removeBtn: {
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  slotAdd: {
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 8,
  },
  nextSlotHeader: {
    alignItems: 'center',
    gap: 2,
  },
  nextSlotTitle: {
    fontSize: 11,
    fontWeight: '700',
  },
  addButtonsRow: {
    flexDirection: 'row',
    gap: 6,
    width: '100%',
  },
  addChoiceBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: RADIUS.xs,
    gap: 3,
  },
  addChoiceBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  slotPlaceholder: {
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    opacity: 0.5,
  },
  placeholderNumber: {
    fontSize: 16,
    fontWeight: '800',
  },
  placeholderLabel: {
    fontSize: 10,
    marginTop: 2,
  },
});
