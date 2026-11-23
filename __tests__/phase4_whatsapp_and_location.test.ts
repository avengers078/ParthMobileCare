import { LocationService } from '../src/services/locationService';
import { PdfService } from '../src/services/pdfService';
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { SecondHandSale, ShopConfig } from '../src/types';

NativeModules.PdfModule = {
  generatePdfFromHtml: jest.fn(),
  shareFileToWhatsApp: jest.fn(),
  printPdf: jest.fn(),
};

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    getAuth: jest.fn(),
    getFirestore: jest.fn(),
    getStorage: jest.fn(),
  },
}));

const mockSale: SecondHandSale = {
  id: 'sale-123',
  invoiceNumber: 'PMC-INV-202611-4015',
  brand: 'Apple',
  model: 'iPhone 15 Pro',
  imei: '354892019283741',
  buyerName: 'Vicky Malothra',
  phone: '9853398538',
  address: 'Surat, Gujarat',
  aadhaarNumber: '123456789012',
  sellingAmount: 80000,
  purchaseAmount: 65000,
  profitAmount: 15000,
  marginPercent: 23,
  paymentMethod: 'UPI',
  saleDate: '2026-11-02',
  saleTime: '10:00:00',
  soldByStaffId: 'staff-1',
  soldByStaffName: 'Staff User',
  digitalSignatureUri: 'data:image/png;base64,mock',
};

const mockShopConfig: ShopConfig = {
  shopName: 'Parth Mobile Care',
  tagline: 'Smart Mobile Solution',
  phone: '9876543210',
  alternatePhone: '9876543211',
  email: 'parth@example.com',
  shopAddress: 'Shop 12, Mobile Market, Surat',
  gstNumber: '24AAACP1234A1Z5',
  latitude: 21.1702,
  longitude: 72.8311,
  allowedRadiusMeters: 30,
  openingTime: '10:00',
  closingTime: '21:00',
};

describe('Phase 4: WhatsApp PDF Sharing & Location Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Platform.OS = 'android';
  });

  describe('Part 1: WhatsApp PDF Generation & Document Sharing', () => {
    test('generateTaxInvoicePdfFile calls native PdfModule.generatePdfFromHtml', async () => {
      (NativeModules.PdfModule.generatePdfFromHtml as jest.Mock).mockResolvedValue('/data/user/0/cache/invoices/PMC-INV-202611-4015.pdf');

      const filePath = await PdfService.generateTaxInvoicePdfFile(mockSale, mockShopConfig);
      expect(filePath).toBe('/data/user/0/cache/invoices/PMC-INV-202611-4015.pdf');
      expect(NativeModules.PdfModule.generatePdfFromHtml).toHaveBeenCalledWith(
        expect.stringContaining('Tax Invoice'),
        'PMC-INV-202611-4015.pdf'
      );
    });

    test('shareTaxInvoiceViaWhatsApp generates PDF and shares document to WhatsApp', async () => {
      (NativeModules.PdfModule.generatePdfFromHtml as jest.Mock).mockResolvedValue('/data/user/0/cache/invoices/PMC-INV-202611-4015.pdf');
      (NativeModules.PdfModule.shareFileToWhatsApp as jest.Mock).mockResolvedValue(true);

      const result = await PdfService.shareTaxInvoiceViaWhatsApp(mockSale, mockShopConfig);
      expect(result).toBe(true);
      expect(NativeModules.PdfModule.generatePdfFromHtml).toHaveBeenCalled();
      expect(NativeModules.PdfModule.shareFileToWhatsApp).toHaveBeenCalledWith(
        '/data/user/0/cache/invoices/PMC-INV-202611-4015.pdf',
        expect.stringContaining('PMC-INV-202611-4015'),
        '9853398538'
      );
    });
  });

  describe('Part 2: Centralized GPS Location Engine', () => {
    test('requestLocationPermissions returns granted when fine permission is accepted', async () => {
      Platform.OS = 'android';
      PermissionsAndroid.check = jest.fn().mockResolvedValue(true);

      const status = await LocationService.requestLocationPermissions();
      expect(status.granted).toBe(true);
      expect(status.isPrecise).toBe(true);
    });

    test('validateAttendanceFix verifies distance within shop geofence', () => {
      const fix = {
        latitude: 21.1702,
        longitude: 72.8311,
        accuracy: 10,
        timestamp: Date.now(),
      };

      const validation = LocationService.validateAttendanceFix(fix, 150);
      expect(validation.valid).toBe(true);
    });

    test('validateAttendanceFix rejects fixes with poor accuracy', () => {
      const fix = {
        latitude: 21.1702,
        longitude: 72.8311,
        accuracy: 250, // exceeds 150m
        timestamp: Date.now(),
      };

      const validation = LocationService.validateAttendanceFix(fix, 150);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('accuracy is too low');
    });

    test('validateAttendanceFix rejects stale GPS fixes older than 5 minutes', () => {
      const fix = {
        latitude: 21.1702,
        longitude: 72.8311,
        accuracy: 10,
        timestamp: Date.now() - (6 * 60 * 1000), // 6 minutes old
      };

      const validation = LocationService.validateAttendanceFix(fix, 150);
      expect(validation.valid).toBe(false);
      expect(validation.reason).toContain('stale');
    });
  });
});
