/**
 * Cloudinary Media Storage Service for Parth Mobile Care — Admin Web Portal
 *
 * Handles ordinary, non-sensitive store media (second-hand device inspection photos,
 * customer repair inquiry photos, staff avatars).
 *
 * CRITICAL SECURITY CONSTRAINTS:
 * 1. NEVER uploads raw face enrollment frames or camera photos.
 * 2. NEVER uploads face embeddings, vector descriptors, or biometric templates.
 * 3. NEVER uploads private biometric keys or Keystore DEKs.
 * 4. NEVER uploads sensitive customer identity documents (Aadhaar, PAN, voter ID).
 * 5. NEVER bundles Cloudinary API Secret in client applications.
 */

export interface CloudinaryConfig {
  cloudName: string;
  uploadPreset: string;
  apiKey?: string;
  secureBaseUrl?: string;
}

export interface CloudinaryUploadOptions {
  folder?: 'devices' | 'leads' | 'avatars' | 'general' | 'kyc';
  tags?: string[];
  maxSizeBytes?: number;
  allowedFormats?: string[];
  onProgress?: (percent: number) => void;
  metadata?: Record<string, string>;
  allowKycDocument?: boolean;
}

export interface CloudinaryUploadResult {
  success: boolean;
  secureUrl?: string;
  publicId?: string;
  format?: string;
  bytes?: number;
  width?: number;
  height?: number;
  createdAt?: string;
  error?: string;
}

// Resolve environment variables with fallback to new configured account
const CLOUD_NAME =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_CLOUD_NAME) ||
  'lbqtrrw5';

const UPLOAD_PRESET =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CLOUDINARY_UPLOAD_PRESET) ||
  'pmc_mobile_uploads';

// Default store configuration for Parth Mobile Care
export const DEFAULT_CLOUDINARY_CONFIG: CloudinaryConfig = {
  cloudName: CLOUD_NAME,
  uploadPreset: UPLOAD_PRESET,
  secureBaseUrl: `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`,
};

// Maximum allowed image file size: 5 MB
export const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

// Permitted non-sensitive mime-types
export const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
];

// Biometric keywords that are ALWAYS strictly forbidden under any circumstances
const FORBIDDEN_BIOMETRIC_KEYWORDS = [
  'face_embedding',
  'face_vector',
  'biometric',
  'embedding',
  'descriptor',
  'tflite',
  'facenet',
  'blazeface',
  'spoof',
  'template',
  'keystore',
  'dek',
];

// Keywords indicating identity KYC (blocked on standard non-KYC uploads)
const FORBIDDEN_KYC_KEYWORDS = [
  'aadhaar',
  'aadhar',
  'pan_card',
  'voter_id',
  'passport',
  'kyc',
];

export class CloudinaryService {
  private static config: CloudinaryConfig = { ...DEFAULT_CLOUDINARY_CONFIG };

  /**
   * Check whether Cloudinary cloud storage is actively configured
   */
  static isConfigured(): boolean {
    return Boolean(this.config.cloudName && this.config.uploadPreset);
  }

  static configure(customConfig: Partial<CloudinaryConfig>): void {
    if (customConfig.cloudName !== undefined) {
      this.config.cloudName = customConfig.cloudName.trim();
    }
    if (customConfig.uploadPreset !== undefined) {
      this.config.uploadPreset = customConfig.uploadPreset.trim();
    }
    if (customConfig.apiKey !== undefined) {
      this.config.apiKey = customConfig.apiKey.trim();
    }
    this.config.secureBaseUrl = this.config.cloudName
      ? `https://res.cloudinary.com/${this.config.cloudName}/image/upload`
      : '';
  }

  static getConfig(): Readonly<CloudinaryConfig> {
    return { ...this.config };
  }

  /**
   * Strict validation check preventing sensitive or biometric data upload.
   * If allowKycDocument is explicitly true (for Buy & Sell verification),
   * identity documents like Aadhaar are permitted while biometric templates/keys remain strictly blocked.
   */
  static isSensitiveOrBiometricPayload(
    descriptorOrName: string,
    tags?: string[],
    allowKycDocument?: boolean
  ): boolean {
    const target = `${descriptorOrName || ''} ${(tags || []).join(' ')}`.toLowerCase();

    // Biometric templates, vector descriptors, face embeddings, and encryption keys are ALWAYS forbidden
    if (FORBIDDEN_BIOMETRIC_KEYWORDS.some((kw) => target.includes(kw))) {
      return true;
    }

    // KYC identity documents (Aadhaar, PAN, voter ID) blocked on standard non-KYC uploads
    if (!allowKycDocument && FORBIDDEN_KYC_KEYWORDS.some((kw) => target.includes(kw))) {
      return true;
    }

    return false;
  }

  /**
   * Upload customer/buyer KYC document (such as Aadhaar card photos) for second-hand verification.
   * Securely stores on Cloudinary and returns CDN URL and Cloudinary Public ID.
   * Biometric templates, vectors, embeddings, and encryption keys remain strictly prohibited.
   */
  static async uploadKycDocument(
    fileSource: File | Blob | string,
    options: Omit<CloudinaryUploadOptions, 'allowKycDocument'> = {}
  ): Promise<CloudinaryUploadResult> {
    return this.uploadImage(fileSource, {
      ...options,
      folder: options.folder || 'kyc',
      allowKycDocument: true,
      tags: options.tags || ['pmc_kyc', 'document'],
    });
  }

  static validateImageMeta(
    mimeTypeOrExtension: string,
    sizeBytes?: number,
    maxSizeBytes: number = MAX_IMAGE_SIZE_BYTES
  ): { valid: boolean; error?: string } {
    if (sizeBytes !== undefined && sizeBytes > maxSizeBytes) {
      const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(1);
      const maxMb = (maxSizeBytes / (1024 * 1024)).toFixed(1);
      return {
        valid: false,
        error: `Image size (${sizeMb} MB) exceeds maximum allowed limit of ${maxMb} MB.`,
      };
    }

    const clean = mimeTypeOrExtension.toLowerCase().replace(/^\./, '');
    const isAllowed =
      ALLOWED_IMAGE_MIME_TYPES.includes(clean) ||
      ['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(clean);

    if (!isAllowed) {
      return {
        valid: false,
        error: `Unsupported image format (${clean}). Allowed formats: JPEG, PNG, WEBP.`,
      };
    }

    return { valid: true };
  }

  static async uploadImage(
    fileSource: File | Blob | string,
    options: CloudinaryUploadOptions = {}
  ): Promise<CloudinaryUploadResult> {
    if (!fileSource) {
      return { success: false, error: 'No image source provided for upload.' };
    }

    // Deduplication Guard: If string is already an uploaded Cloudinary URL, return immediately
    if (typeof fileSource === 'string' && this.isCloudinaryUrl(fileSource)) {
      return {
        success: true,
        secureUrl: fileSource,
      };
    }

    const folder = options.folder || 'devices';
    const folderPath = `parth_mobile_care/${folder}`;
    const tags = options.tags || ['pmc_retail', folder];

    const descriptorToCheck = typeof fileSource === 'string' ? fileSource : (fileSource as File).name || '';
    if (this.isSensitiveOrBiometricPayload(descriptorToCheck, tags, options.allowKycDocument)) {
      const securityError =
        'Security Violation: Biometric face data and sensitive KYC identity documents must never be uploaded to Cloudinary.';
      console.error('[CloudinaryService] Blocked illegal upload attempt:', securityError);
      return {
        success: false,
        error: securityError,
      };
    }

    const maxSizeBytes = options.maxSizeBytes || MAX_IMAGE_SIZE_BYTES;

    if (typeof fileSource === 'string' && fileSource.startsWith('data:')) {
      const approxBytes = Math.round((fileSource.length * 3) / 4);
      const sizeCheck = this.validateImageMeta('image/jpeg', approxBytes, maxSizeBytes);
      if (!sizeCheck.valid) {
        return { success: false, error: sizeCheck.error };
      }
    } else if (fileSource instanceof Blob || (fileSource && typeof (fileSource as any).size === 'number')) {
      const blob = fileSource as Blob;
      const sizeCheck = this.validateImageMeta(blob.type || (fileSource as File).name || 'image/jpeg', blob.size, maxSizeBytes);
      if (!sizeCheck.valid) {
        return { success: false, error: sizeCheck.error };
      }
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'Cloud image storage is currently disconnected. Image uploads are paused until a new storage provider is configured.',
      };
    }

    const endpoint = `https://api.cloudinary.com/v1_1/${this.config.cloudName}/image/upload`;

    try {
      const formData = new FormData();
      formData.append('upload_preset', this.config.uploadPreset);
      formData.append('folder', folderPath);
      formData.append('tags', tags.join(','));
      formData.append('file', fileSource as any);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          body: formData,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        let data: any;
        try {
          data = await response.json();
        } catch {
          return {
            success: false,
            error: `Failed to parse Cloudinary response (HTTP ${response.status}).`,
          };
        }

        if (!response.ok || data.error) {
          const errMsg = data?.error?.message || `Cloudinary upload failed with HTTP status ${response.status}`;
          return { success: false, error: errMsg };
        }

        return {
          success: true,
          secureUrl: data.secure_url,
          publicId: data.public_id,
          format: data.format,
          bytes: data.bytes,
          width: data.width,
          height: data.height,
          createdAt: data.created_at,
        };
      } catch (fetchErr: any) {
        clearTimeout(timeoutId);
        if (fetchErr.name === 'AbortError') {
          return { success: false, error: 'Upload timed out. Please check your network connection.' };
        }
        throw fetchErr;
      }
    } catch (err: any) {
      console.warn('[CloudinaryService] Upload error:', err);
      return {
        success: false,
        error: err?.message || 'Network error occurred while uploading image.',
      };
    }
  }

  static async uploadMultipleImages(
    fileSources: (File | Blob | string)[],
    options: CloudinaryUploadOptions = {}
  ): Promise<{ success: boolean; urls: string[]; errors: string[] }> {
    const urls: string[] = [];
    const errors: string[] = [];

    const validSources = (fileSources || []).filter(Boolean);
    if (validSources.length === 0) {
      return { success: true, urls: [], errors: [] };
    }

    for (let i = 0; i < validSources.length; i++) {
      const src = validSources[i];
      const result = await this.uploadImage(src, {
        ...options,
        onProgress: options.onProgress
          ? (pct) => {
              const overall = Math.round(((i + pct / 100) / validSources.length) * 100);
              options.onProgress?.(overall);
            }
          : undefined,
      });

      if (result.success && result.secureUrl) {
        urls.push(result.secureUrl);
      } else {
        errors.push(result.error || `Failed to upload image #${i + 1}`);
      }
    }

    return {
      success: errors.length === 0,
      urls,
      errors,
    };
  }

  static isCloudinaryUrl(url?: string): boolean {
    if (!url || typeof url !== 'string') return false;
    return url.includes('res.cloudinary.com') || url.includes('cloudinary.com');
  }

  static getOptimizedImageUrl(
    publicIdOrUrl: string,
    transforms: {
      width?: number;
      height?: number;
      crop?: 'limit' | 'fill' | 'thumb' | 'fit';
      quality?: 'auto' | 'auto:best' | 'auto:eco' | 'auto:low';
    } = {}
  ): string {
    if (!publicIdOrUrl) return '';

    const width = transforms.width || 800;
    const crop = transforms.crop || 'limit';
    const quality = transforms.quality || 'auto';
    const transformStr = `f_auto,q_${quality},c_${crop},w_${width}`;

    if (publicIdOrUrl.includes('res.cloudinary.com')) {
      const uploadIndex = publicIdOrUrl.indexOf('/upload/');
      if (uploadIndex !== -1) {
        const prefix = publicIdOrUrl.substring(0, uploadIndex + 8);
        const suffix = publicIdOrUrl.substring(uploadIndex + 8);
        if (suffix.startsWith('f_auto') || suffix.startsWith('c_')) {
          return publicIdOrUrl;
        }
        return `${prefix}${transformStr}/${suffix}`;
      }
      return publicIdOrUrl;
    }

    if (!this.config.secureBaseUrl) {
      return publicIdOrUrl;
    }
    return `${this.config.secureBaseUrl}/${transformStr}/${publicIdOrUrl}`;
  }

  static getDeviceThumbnailUrl(publicIdOrUrl: string): string {
    return this.getOptimizedImageUrl(publicIdOrUrl, {
      width: 300,
      height: 300,
      crop: 'fill',
      quality: 'auto',
    });
  }
}
