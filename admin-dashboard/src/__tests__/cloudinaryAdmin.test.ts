import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CloudinaryService } from '../services/cloudinaryService';

describe('Admin Dashboard Cloudinary Service', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    CloudinaryService.configure({ cloudName: '', uploadPreset: '' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    CloudinaryService.configure({ cloudName: '', uploadPreset: '' });
  });

  it('identifies disconnected state when credentials are unset and pauses uploads', async () => {
    expect(CloudinaryService.isConfigured()).toBe(false);
    const blob = new Blob(['test'], { type: 'image/jpeg' });
    const res = await CloudinaryService.uploadImage(blob);
    expect(res.success).toBe(false);
    expect(res.error).toContain('disconnected');
  });

  it('validates file formats and rejects unsupported file extensions', () => {
    expect(CloudinaryService.validateImageMeta('jpg').valid).toBe(true);
    expect(CloudinaryService.validateImageMeta('png').valid).toBe(true);
    expect(CloudinaryService.validateImageMeta('webp').valid).toBe(true);
    expect(CloudinaryService.validateImageMeta('pdf').valid).toBe(false);
    expect(CloudinaryService.validateImageMeta('exe').valid).toBe(false);
  });

  it('rejects files larger than 5 MB', () => {
    const valid = CloudinaryService.validateImageMeta('jpg', 4 * 1024 * 1024);
    expect(valid.valid).toBe(true);

    const oversized = CloudinaryService.validateImageMeta('jpg', 6 * 1024 * 1024);
    expect(oversized.valid).toBe(false);
    expect(oversized.error).toContain('exceeds maximum allowed limit');
  });

  it('blocks sensitive KYC and biometric keywords from uploading', async () => {
    const res = await CloudinaryService.uploadImage('test_aadhaar_card.png');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Security Violation');
  });

  it('successfully uploads an image file when configured and returns secure HTTPS URL', async () => {
    CloudinaryService.configure({ cloudName: 'demo_store', uploadPreset: 'demo_preset' });
    const mockResponse = {
      secure_url: 'https://res.cloudinary.com/demo_store/image/upload/v1/devices/phone.jpg',
      public_id: 'parth_mobile_care/devices/phone',
      format: 'jpg',
      bytes: 150000,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockResponse),
    } as any);

    const blob = new Blob(['sample-image-data'], { type: 'image/jpeg' });
    const res = await CloudinaryService.uploadImage(blob, {
      folder: 'devices',
      tags: ['test'],
    });

    expect(res.success).toBe(true);
    expect(res.secureUrl).toBe(mockResponse.secure_url);
  });

  it('successfully uploads Aadhaar card KYC document to Cloudinary and returns secureUrl and publicId', async () => {
    CloudinaryService.configure({ cloudName: 'demo_store', uploadPreset: 'demo_preset' });
    const mockKycResponse = {
      secure_url: 'https://res.cloudinary.com/demo_store/image/upload/v1/kyc/pmc_aadhaar_front.jpg',
      public_id: 'parth_mobile_care/kyc/pmc_aadhaar_front',
      format: 'jpg',
      bytes: 220000,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(mockKycResponse),
    } as any);

    const blob = new Blob(['sample-aadhaar-front'], { type: 'image/jpeg' });
    const res = await CloudinaryService.uploadKycDocument(blob, {
      folder: 'kyc',
      tags: ['pmc_kyc', 'aadhaar_front'],
    });

    expect(res.success).toBe(true);
    expect(res.secureUrl).toBe(mockKycResponse.secure_url);
    expect(res.publicId).toBe(mockKycResponse.public_id);
  });

  it('generates auto-format and auto-quality delivery transformation URLs', () => {
    const url = 'https://res.cloudinary.com/parthmobilecare/image/upload/v1/devices/phone.jpg';
    const thumb = CloudinaryService.getDeviceThumbnailUrl(url);
    expect(thumb).toContain('/upload/f_auto,q_auto,c_fill,w_300/');
    expect(thumb).toContain('devices/phone.jpg');
  });
});
