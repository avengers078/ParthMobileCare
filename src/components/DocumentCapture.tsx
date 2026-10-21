import React, { useState, useEffect } from 'react';
import { Camera, RefreshCw } from 'lucide-react-native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  Platform,
  PermissionsAndroid,
  ActivityIndicator,
} from 'react-native';
import {
  launchCamera,
  launchImageLibrary,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { useTheme } from '../context/ThemeContext';

interface DocumentCaptureProps {
  label: string;
  hint?: string;
  currentUri?: string;
  onCapture: (uri: string) => void;
  required?: boolean;
  errorMessage?: string;
}

export const DocumentCapture: React.FC<DocumentCaptureProps> = ({
  label,
  hint,
  currentUri,
  onCapture,
  required = false,
  errorMessage,
}) => {
  const { colors, isDark } = useTheme();
  const [photoUri, setPhotoUri] = useState<string | undefined>(currentUri);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setPhotoUri(currentUri);
  }, [currentUri]);

  /**
   * Request Android Camera Permission gracefully
   */
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
          message: `Parth Mobile Care needs access to your camera to take a photo of ${label}.`,
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

  /**
   * Request Android Photo Library / Media Permission gracefully
   */
  const requestGalleryPermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    // Android 13+ (API 33+) uses READ_MEDIA_IMAGES or system Photo Picker
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
            message: `Parth Mobile Care needs access to select ${label} from your gallery.`,
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          }
        );
        return result === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Media images permission error:', err);
        return true; // Fall back to photo picker
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
            message: `Parth Mobile Care needs storage permission to select ${label} from your gallery.`,
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

  const handleLaunchCamera = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;

    const options: CameraOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1600,
      maxWidth: 1600,
      quality: 0.8,
      saveToPhotos: false,
      cameraType: label.toLowerCase().includes('customer') ? 'front' : 'back',
    };

    setIsLoading(true);
    try {
      const response = await launchCamera(options);

      if (response.didCancel) {
        // User closed camera without taking a photo
        return;
      }

      if (response.errorCode) {
        Alert.alert(
          'Camera Error',
          response.errorMessage || 'Unable to access camera.'
        );
        return;
      }

      if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
        const selectedUri = response.assets[0].uri;
        setPhotoUri(selectedUri);
        onCapture(selectedUri);
      }
    } catch (error: any) {
      Alert.alert('Camera Error', error?.message || 'Failed to capture photo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLaunchGallery = async () => {
    const hasPermission = await requestGalleryPermission();
    if (!hasPermission) {
      Alert.alert(
        'Permission Denied',
        'Gallery permission was not granted. Please enable gallery access in Android Settings.'
      );
      return;
    }

    const options: ImageLibraryOptions = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1600,
      maxWidth: 1600,
      quality: 0.8,
      selectionLimit: 1,
    };

    setIsLoading(true);
    try {
      const response = await launchImageLibrary(options);

      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        Alert.alert(
          'Gallery Error',
          response.errorMessage || 'Unable to open gallery.'
        );
        return;
      }

      if (response.assets && response.assets.length > 0 && response.assets[0].uri) {
        const selectedUri = response.assets[0].uri;
        setPhotoUri(selectedUri);
        onCapture(selectedUri);
      }
    } catch (error: any) {
      Alert.alert('Gallery Error', error?.message || 'Failed to select image from gallery.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePickDocument = () => {
    Alert.alert(
      'Upload Document / Photo',
      `Choose source for ${label}:`,
      [
        {
          text: 'Take Photo (Camera)',
          onPress: handleLaunchCamera,
        },
        {
          text: 'Upload from Gallery',
          onPress: handleLaunchGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  const handleRemove = () => {
    setPhotoUri(undefined);
    onCapture('');
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label} {required ? '*' : ''}
      </Text>
      {hint ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text>
      ) : null}

      {isLoading ? (
        <View
          style={[
            styles.uploadBox,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
              borderColor: colors.primary,
            },
          ]}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[styles.uploadText, { color: colors.primary, marginTop: 8 }]}>
            Opening camera / gallery...
          </Text>
        </View>
      ) : photoUri ? (
        <View
          style={[
            styles.previewContainer,
            {
              borderColor: errorMessage ? colors.danger : colors.border,
              backgroundColor: colors.card,
            },
          ]}
        >
          <Image
            source={{ uri: photoUri }}
            style={styles.previewImage}
            resizeMode="cover"
          />
          <View style={styles.previewOverlay}>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: colors.danger }]}
              onPress={handleRemove}
              activeOpacity={0.8}
            >
              <Text style={styles.smallBtnText}>Remove</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.smallBtn, { backgroundColor: colors.primary }]}
              onPress={handlePickDocument}
              activeOpacity={0.8}
            >
              <Text style={styles.smallBtnText}>Replace</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handlePickDocument}
          style={[
            styles.uploadBox,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
              borderColor: errorMessage ? colors.danger : colors.border,
            },
          ]}
        >
          <Camera
            size={28}
            color={errorMessage ? colors.danger : colors.primary}
            strokeWidth={1.8}
          />
          <Text
            style={[
              styles.uploadText,
              { color: errorMessage ? colors.danger : colors.primary },
            ]}
          >
            Tap to Capture or Upload {label}
          </Text>
          <Text style={[styles.uploadSubtext, { color: colors.textMuted }]}>
            Supported: Camera & Device Gallery (JPG, PNG)
          </Text>
        </TouchableOpacity>
      )}

      {errorMessage ? (
        <Text style={[styles.errorText, { color: colors.danger }]}>
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    marginBottom: 6,
  },
  uploadBox: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadText: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  uploadSubtext: {
    fontSize: 11,
    marginTop: 4,
  },
  previewContainer: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    height: 140,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
  },
  smallBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 6,
  },
  smallBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
    marginLeft: 2,
  },
});
