import { SecondHandService } from '../src/services/secondHandService';
import { StorageService } from '../src/services/storageService';
import { User } from '../src/types';

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
  });
});
