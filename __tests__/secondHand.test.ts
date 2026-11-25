import { User } from '../src/types';

jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    init: jest.fn().mockResolvedValue(true),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'test_uid' } })),
    getFirestore: jest.fn(() => ({})),
    getStorage: jest.fn(() => ({})),
  },
}));

import { SecondHandService } from '../src/services/secondHandService';

describe('Second-Hand Mobile Buy, Sell & IMEI Verification', () => {
  const mockStaff: User = {
    id: 'staff_1',
    name: 'Ankit Verma',
    email: 'ankit@parthmobile.com',
    phone: '9876543212',
    role: 'staff',
    designation: 'Sales Exec',
    joinedDate: '2024-01-01',
    basicSalary: 20000,
    monthlyTarget: 200000,
    isActive: true,
  };

  test('records second hand mobile purchase and adds to in-stock inventory', async () => {
    const purchase = await SecondHandService.recordPurchase(
      {
        customerName: 'Kishore Kumar',
        phone: '9825098765',
        address: 'Adajan, Surat',
        aadhaarNumber: '123456789012',
        brand: 'Apple',
        model: 'iPhone 14 128GB',
        imei: '864920048192099',
        condition: 'Mint condition',
        purchaseAmount: 38000,
        digitalSignatureUri: 'data:image/svg+xml;base64,sig',
      },
      mockStaff
    );

    expect(purchase.id).toBeDefined();
    expect(purchase.status).toBe('in_stock');
    expect(purchase.purchaseAmount).toBe(38000);
    expect(purchase.purchasedByStaffName).toBe('Ankit Verma');
  });

  test('records sale, computes gross profit & margin %, and issues invoice number', async () => {
    const sale = await SecondHandService.recordSale(
      {
        purchaseRecordId: 'pur_mock_1',
        buyerName: 'Nirav Modi',
        phone: '9898011223',
        address: 'Vesu, Surat',
        aadhaarNumber: '998877665544',
        brand: 'Apple',
        model: 'iPhone 14 128GB',
        imei: '864920048192099',
        purchaseAmount: 38000,
        sellingAmount: 44000,
        paymentMethod: 'UPI',
        digitalSignatureUri: 'data:image/svg+xml;base64,sig_buyer',
      },
      mockStaff
    );

    expect(sale.profitAmount).toBe(6000); // 44000 - 38000
    expect(sale.marginPercent).toBe(15.8); // (6000 / 38000) * 100
    expect(sale.invoiceNumber).toMatch(/^PMC-INV-/);
  });

  test('verifies IMEI tracking across device lifecycle', async () => {
    const verification = await SecondHandService.verifyIMEI('864920048192099');
    expect(verification.isKnown).toBe(true);
    expect(verification.imei).toBe('864920048192099');
  });

  test('records purchase with Aadhaar front and back photo URIs', async () => {
    const purchase = await SecondHandService.recordPurchase(
      {
        customerName: 'Pooja Patel',
        phone: '9825123456',
        address: 'Varachha, Surat',
        aadhaarNumber: '987654321098',
        aadhaarPhotoFront: 'https://example.com/front.jpg',
        aadhaarPhotoBack: 'https://example.com/back.jpg',
        brand: 'Samsung',
        model: 'Galaxy S23',
        imei: '354820048192011',
        condition: 'Good condition',
        purchaseAmount: 32000,
        digitalSignatureUri: 'data:image/svg+xml;base64,sig',
      },
      mockStaff
    );

    expect(purchase.aadhaarPhotoFront).toBe('https://example.com/front.jpg');
    expect(purchase.aadhaarPhotoBack).toBe('https://example.com/back.jpg');
    expect(purchase.rawAadhaarNumber).toBe('987654321098');
    expect(purchase.aadhaarNumber).toBe('XXXX-XXXX-1098');
  });

  test('records purchase with Cloudinary Aadhaar card photos and public IDs', async () => {
    const purchase = await SecondHandService.recordPurchase(
      {
        customerName: 'Anil Kumar',
        phone: '9898012345',
        address: 'Adajan, Surat',
        aadhaarNumber: '123456789012',
        aadhaarFrontUri: 'https://res.cloudinary.com/lbqtrrw5/image/upload/v1/kyc/pmc_aadhaar_front_123.jpg',
        aadhaarBackUri: 'https://res.cloudinary.com/lbqtrrw5/image/upload/v1/kyc/pmc_aadhaar_back_123.jpg',
        aadhaarFrontPublicId: 'parth_mobile_care/kyc/pmc_aadhaar_front_123',
        aadhaarBackPublicId: 'parth_mobile_care/kyc/pmc_aadhaar_back_123',
        brand: 'OnePlus',
        model: '11R 5G',
        imei: '862049102948201',
        condition: 'Like New',
        purchaseAmount: 26000,
        digitalSignatureUri: 'data:image/svg+xml;base64,sig',
      },
      mockStaff
    );

    expect(purchase.rawAadhaarNumber).toBe('123456789012');
    expect(purchase.aadhaarNumber).toBe('XXXX-XXXX-9012');
    expect(purchase.aadhaarFrontUri).toContain('res.cloudinary.com');
    expect(purchase.aadhaarFrontPublicId).toBe('parth_mobile_care/kyc/pmc_aadhaar_front_123');
    expect(purchase.aadhaarBackPublicId).toBe('parth_mobile_care/kyc/pmc_aadhaar_back_123');
  });

  test('records sale with buyer Aadhaar card photo and Cloudinary public ID', async () => {
    const sale = await SecondHandService.recordSale(
      {
        purchaseRecordId: 'pur_mock_123',
        buyerName: 'Vikram Joshi',
        phone: '9900112233',
        address: 'Rander, Surat',
        aadhaarNumber: '556677889900',
        aadhaarPhotoUri: 'https://res.cloudinary.com/lbqtrrw5/image/upload/v1/kyc/pmc_buyer_aadhaar_456.jpg',
        aadhaarPhotoPublicId: 'parth_mobile_care/kyc/pmc_buyer_aadhaar_456',
        brand: 'Apple',
        model: 'iPhone 13',
        imei: '354820048192099',
        purchaseAmount: 30000,
        sellingAmount: 35000,
        paymentMethod: 'UPI',
        digitalSignatureUri: 'data:image/svg+xml;base64,sig',
        warrantyMonths: 3,
      },
      mockStaff
    );

    expect(sale.rawAadhaarNumber).toBe('556677889900');
    expect(sale.aadhaarNumber).toBe('XXXX-XXXX-9900');
    expect(sale.aadhaarPhotoUri).toContain('res.cloudinary.com');
    expect(sale.aadhaarPhotoPublicId).toBe('parth_mobile_care/kyc/pmc_buyer_aadhaar_456');
    expect(sale.profitAmount).toBe(5000);
  });
});
