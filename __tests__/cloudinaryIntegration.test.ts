jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'staff_chetan_test' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
}));

import { CloudinaryService, MAX_IMAGE_SIZE_BYTES, ALLOWED_IMAGE_MIME_TYPES } from '../src/services/cloudinaryService';
import { StorageService } from '../src/services/storageService';
import { SecondHandService } from '../src/services/secondHandService';
import { LeadService } from '../src/services/leadService';
import { SecondHandPurchase, CustomerLead, User } from '../src/types';

describe('Cloudinary Media Integration & Security Test Suite', () => {
  const originalFetch = global.fetch;

  beforeEach(async () => {
    jest.clearAllMocks();
    CloudinaryService.configure({ cloudName: 'mock_store', uploadPreset: 'mock_preset' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    CloudinaryService.configure({ cloudName: '', uploadPreset: '' });
  });

  it('identifies disconnected state when credentials are unset and pauses uploads', async () => {
    CloudinaryService.configure({ cloudName: '', uploadPreset: '' });
    expect(CloudinaryService.isConfigured()).toBe(false);
    const res = await CloudinaryService.uploadImage('file:///test/image.jpg');
    expect(res.success).toBe(false);
    expect(res.error).toContain('disconnected');
  });

  // --- 1. Successful Image Upload ---
  it('successfully uploads an ordinary device image and returns secure HTTPS URL', async () => {
    const mockCloudinaryResponse = {
      secure_url: 'https://res.cloudinary.com/parthmobilecare/image/upload/v1794038000/parth_mobile_care/devices/device_vivo_v30.jpg',
      public_id: 'parth_mobile_care/devices/device_vivo_v30',
      format: 'jpg',
      bytes: 245000,
      width: 1200,
      height: 900,
      created_at: '2026-11-07T17:00:00Z',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue(mockCloudinaryResponse),
    } as any);

    const result = await CloudinaryService.uploadImage('file:///data/user/0/com.parthmobilecare/cache/vivo_v30.jpg', {
      folder: 'devices',
      tags: ['device_inspection', 'Vivo'],
    });

    expect(result.success).toBe(true);
    expect(result.secureUrl).toBe(mockCloudinaryResponse.secure_url);
    expect(result.publicId).toBe(mockCloudinaryResponse.public_id);
    expect(result.format).toBe('jpg');
    expect(result.bytes).toBe(245000);
  });

  // --- 2. Invalid File Format ---
  it('validates permitted formats and rejects unpermitted file formats (PDF, TFLite, EXE)', () => {
    expect(CloudinaryService.validateImageMeta('jpg').valid).toBe(true);
    expect(CloudinaryService.validateImageMeta('jpeg').valid).toBe(true);
    expect(CloudinaryService.validateImageMeta('png').valid).toBe(true);
    expect(CloudinaryService.validateImageMeta('webp').valid).toBe(true);
    expect(CloudinaryService.validateImageMeta('image/png').valid).toBe(true);

    const pdfCheck = CloudinaryService.validateImageMeta('pdf');
    expect(pdfCheck.valid).toBe(false);
    expect(pdfCheck.error).toContain('Unsupported image format');

    const tfliteCheck = CloudinaryService.validateImageMeta('tflite');
    expect(tfliteCheck.valid).toBe(false);

    const exeCheck = CloudinaryService.validateImageMeta('exe');
    expect(exeCheck.valid).toBe(false);
  });

  // --- 3. File Larger than 5 MB ---
  it('rejects image files exceeding the 5 MB size limit', () => {
    const validSize = 4.5 * 1024 * 1024; // 4.5 MB
    const oversized = 5.2 * 1024 * 1024; // 5.2 MB

    const validCheck = CloudinaryService.validateImageMeta('jpg', validSize);
    expect(validCheck.valid).toBe(true);

    const overCheck = CloudinaryService.validateImageMeta('jpg', oversized);
    expect(overCheck.valid).toBe(false);
    expect(overCheck.error).toContain('exceeds maximum allowed limit');
  });

  // --- 4. Network Interruption / Timeout ---
  it('gracefully handles network timeout and aborts without crashing', async () => {
    global.fetch = jest.fn().mockImplementation(() => {
      const err: any = new Error('The user aborted a request.');
      err.name = 'AbortError';
      return Promise.reject(err);
    });

    const result = await CloudinaryService.uploadImage('file:///test/image.jpg', {
      folder: 'devices',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Upload timed out');
  });

  // --- 5. Cloudinary API Failure Handling ---
  it('handles Cloudinary HTTP errors (400, 401, 500) and extracts detailed API error message', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        error: { message: 'Upload preset not found or invalid' },
      }),
    } as any);

    const result = await CloudinaryService.uploadImage('file:///test/broken.jpg', {
      folder: 'devices',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Upload preset not found or invalid');
  });

  // --- 6. Security Gate: Biometrics & Sensitive KYC Rejection ---
  it('strictly rejects any attempts to upload face biometrics or sensitive KYC documents to Cloudinary', async () => {
    const biometricAttempt = await CloudinaryService.uploadImage('file:///test/facenet_embedding_vector.tflite', {
      folder: 'devices',
      tags: ['biometric', 'facenet'],
    });
    expect(biometricAttempt.success).toBe(false);
    expect(biometricAttempt.error).toContain('Security Violation: Biometric face data and sensitive KYC');

    const aadhaarAttempt = await CloudinaryService.uploadImage('file:///test/customer_aadhaar_card_front.jpg', {
      folder: 'devices',
      tags: ['aadhaar', 'kyc'],
    });
    expect(aadhaarAttempt.success).toBe(false);
    expect(aadhaarAttempt.error).toContain('Security Violation: Biometric face data and sensitive KYC');
  });

  // --- 7. Multiple Image Uploads for Device Inspection ---
  it('supports sequential multi-image upload for multi-angle device inspection', async () => {
    let uploadCount = 0;
    global.fetch = jest.fn().mockImplementation(() => {
      uploadCount++;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            secure_url: `https://res.cloudinary.com/parthmobilecare/image/upload/v1/devices/inspect_${uploadCount}.jpg`,
            public_id: `devices/inspect_${uploadCount}`,
          }),
      } as any);
    });

    const sources = [
      'file:///local/front.jpg',
      'file:///local/back.jpg',
      'file:///local/screen.jpg',
      'file:///local/ports.jpg',
    ];

    const multiRes = await CloudinaryService.uploadMultipleImages(sources, {
      folder: 'devices',
    });

    expect(multiRes.success).toBe(true);
    expect(multiRes.urls.length).toBe(4);
    expect(multiRes.urls[0]).toContain('inspect_1.jpg');
    expect(multiRes.urls[3]).toContain('inspect_4.jpg');
  });

  // --- 8. Deduplication Guard ---
  it('prevents duplicate uploads and returns existing Cloudinary HTTPS URLs immediately', async () => {
    const existingUrl = 'https://res.cloudinary.com/parthmobilecare/image/upload/v1234/devices/vivo_v30.jpg';
    const fetchSpy = jest.fn();
    global.fetch = fetchSpy;

    const res = await CloudinaryService.uploadImage(existingUrl);
    expect(res.success).toBe(true);
    expect(res.secureUrl).toBe(existingUrl);
    expect(fetchSpy).not.toHaveBeenCalled(); // No network roundtrip required
  });

  // --- 9. Image URL Persistence in Firestore Records ---
  it('persists deviceInspectionPhotos and billImageUri in SecondHandPurchase records', async () => {
    const mockStaff: User = {
      id: 'staff_chetan_test',
      name: 'Chetan Luhar',
      email: 'chetan@parthmobilecare.com',
      phone: '9876543210',
      role: 'staff',
      designation: 'Technician',
      joinedDate: '2026-10-15',
      basicSalary: 25000,
      monthlyTarget: 300000,
      isActive: true,
    };

    const inspectionPhotos = [
      'https://res.cloudinary.com/parthmobilecare/image/upload/v1/devices/front.jpg',
      'https://res.cloudinary.com/parthmobilecare/image/upload/v1/devices/back.jpg',
    ];
    const billUrl = 'https://res.cloudinary.com/parthmobilecare/image/upload/v1/devices/invoice_bill.jpg';

    const recorded = await SecondHandService.recordPurchase(
      {
        brand: 'OnePlus',
        model: '11R 256GB',
        imei: '864920048192039',
        condition: 'Mint condition',
        purchaseAmount: 28000,
        devicePhotos: inspectionPhotos,
        deviceInspectionPhotos: inspectionPhotos,
        billImageUri: billUrl,
      },
      mockStaff
    );

    expect(recorded.id).toBeDefined();
    expect(recorded.deviceInspectionPhotos).toEqual(inspectionPhotos);
    expect(recorded.billImageUri).toBe(billUrl);

    // Verify persistence in StorageService
    const stored = await StorageService.getPurchases();
    const found = stored.find((p) => p.id === recorded.id);
    expect(found).toBeDefined();
    expect(found?.deviceInspectionPhotos?.length).toBe(2);
    expect(found?.billImageUri).toBe(billUrl);
  });

  // --- 10. Persistence in Customer Repair Inquiries (Leads) ---
  it('persists customer repair inquiry photos in CustomerLead records', async () => {
    const mockStaff: User = {
      id: 'staff_chetan_test',
      name: 'Chetan Luhar',
      email: 'chetan@parthmobilecare.com',
      phone: '9876543210',
      role: 'staff',
      designation: 'Technician',
      joinedDate: '2026-10-15',
      basicSalary: 25000,
      monthlyTarget: 300000,
      isActive: true,
    };

    const repairPhotos = [
      'https://res.cloudinary.com/parthmobilecare/image/upload/v1/leads/cracked_screen_iphone.jpg',
      'https://res.cloudinary.com/parthmobilecare/image/upload/v1/leads/bent_chassis.jpg',
    ];

    const lead = await LeadService.createLead(
      {
        name: 'Rahul Sharma',
        phone: '9988776655',
        interestedBrand: 'Apple',
        interestedModel: 'iPhone 14 Screen Replacement',
        budget: 6500,
        remarks: 'Display glass completely shattered, touch responding intermittently.',
        inquiryPhotos: repairPhotos,
        repairPhotos: repairPhotos,
      },
      mockStaff,
      'new',
      false
    );

    expect(lead.id).toBeDefined();
    expect(lead.inquiryPhotos).toEqual(repairPhotos);

    // Verify storage persistence
    const allLeads = await StorageService.getLeads();
    const storedLead = allLeads.find((l) => l.id === lead.id);
    expect(storedLead).toBeDefined();
    expect(storedLead?.inquiryPhotos?.length).toBe(2);
  });

  // --- 11. Responsive CDN Delivery Transformation URLs ---
  it('generates auto-format and auto-quality delivery URLs for device thumbnails and previews', () => {
    const rawUrl = 'https://res.cloudinary.com/parthmobilecare/image/upload/v1/devices/phone_sample.jpg';

    const thumb = CloudinaryService.getDeviceThumbnailUrl(rawUrl);
    expect(thumb).toContain('/upload/f_auto,q_auto,c_fill,w_300/');
    expect(thumb).toContain('devices/phone_sample.jpg');

    const preview = CloudinaryService.getOptimizedImageUrl(rawUrl, {
      width: 1200,
      crop: 'limit',
      quality: 'auto:best',
    });
    expect(preview).toContain('/upload/f_auto,q_auto:best,c_limit,w_1200/');
  });

  // --- 12. Safe Empty/Invalid URL Fallbacks ---
  it('safely handles missing, null, or invalid image URLs without throwing exceptions', () => {
    expect(CloudinaryService.getOptimizedImageUrl('')).toBe('');
    expect(CloudinaryService.getDeviceThumbnailUrl('')).toBe('');
    expect(CloudinaryService.isCloudinaryUrl(undefined)).toBe(false);
    expect(CloudinaryService.isCloudinaryUrl('https://example.com/other.png')).toBe(false);
    expect(CloudinaryService.isCloudinaryUrl('https://res.cloudinary.com/parthmobilecare/image/upload/test.jpg')).toBe(true);
  });
});
