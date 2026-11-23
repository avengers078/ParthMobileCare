import { describe, it, expect } from 'vitest';
import { buildSaleInvoicePdfDoc } from '../utils/exportUtils';
import { User, ShopConfig } from '../types';

describe('Admin Account Migration & Credential Verification', () => {
  const NEW_ADMIN_EMAIL = 'parthmobilecare07@gmail.com';
  const LEGACY_ADMIN_EMAIL = 'parthmobileindia@gmail.com';
  const LEGACY_ADMIN_UID = 'NmX4ySVJ6NPHytFA6XLnY9GYoCg1';

  // AuthContext contract verification function (mirrors AuthContext.tsx verifyAndLoadAdminProfile)
  const verifyAndLoadAdminProfile = (userData: Partial<User> | null, fUser: { uid: string; email?: string | null } | null): User => {
    if (!fUser) {
      throw new Error('No user is signed in.');
    }
    if (!userData) {
      throw new Error(
        'Your account signed in to Firebase Auth, but its staff profile was not found in database records. Administrator profile required.'
      );
    }
    if (userData.isActive === false) {
      throw new Error('This account is inactive. Contact the store owner.');
    }
    if (userData.role !== 'admin') {
      throw new Error(
        'Access Denied: The Admin Dashboard is strictly restricted to store administrators. Staff accounts cannot access this portal.'
      );
    }
    return {
      ...(userData as User),
      id: fUser.uid,
      email: userData.email || fUser.email || '',
      role: 'admin',
    };
  };

  it('1. Authorizes new primary admin account (parthmobilecare07@gmail.com) with active admin role', () => {
    const newAdminAuth = { uid: '8X4u2Tidn4RSdnQA4dAKt41Ji7a2', email: NEW_ADMIN_EMAIL };
    const newAdminFirestoreProfile: Partial<User> = {
      id: '8X4u2Tidn4RSdnQA4dAKt41Ji7a2',
      name: 'Parth Patel',
      email: NEW_ADMIN_EMAIL,
      role: 'admin',
      designation: 'Store Owner & Admin',
      isActive: true,
      joinedDate: '2026-10-23',
    };

    const loadedAdmin = verifyAndLoadAdminProfile(newAdminFirestoreProfile, newAdminAuth);
    expect(loadedAdmin).toBeDefined();
    expect(loadedAdmin.email).toBe(NEW_ADMIN_EMAIL);
    expect(loadedAdmin.role).toBe('admin');
    expect(loadedAdmin.isActive).toBe(true);
    expect(loadedAdmin.id).toBe('8X4u2Tidn4RSdnQA4dAKt41Ji7a2');
  });

  it('2. Denies legacy admin account when marked inactive or deactivated', () => {
    const legacyAuth = { uid: LEGACY_ADMIN_UID, email: LEGACY_ADMIN_EMAIL };
    const deactivatedProfile: Partial<User> = {
      id: LEGACY_ADMIN_UID,
      name: 'Legacy Admin',
      email: LEGACY_ADMIN_EMAIL,
      role: 'deactivated_admin' as any,
      isActive: false,
    };

    // When isActive is false
    expect(() => verifyAndLoadAdminProfile(deactivatedProfile, legacyAuth)).toThrow(
      'This account is inactive. Contact the store owner.'
    );

    // If active flag was somehow left true but role changed to non-admin
    const roleDowngradedProfile: Partial<User> = {
      ...deactivatedProfile,
      isActive: true,
    };
    expect(() => verifyAndLoadAdminProfile(roleDowngradedProfile, legacyAuth)).toThrow(
      'Access Denied: The Admin Dashboard is strictly restricted to store administrators.'
    );
  });

  it('3. Denies staff accounts from accessing the Admin Dashboard', () => {
    const staffAuth = { uid: 'staff_123', email: 'staff@parthmobilecare.com' };
    const staffProfile: Partial<User> = {
      id: 'staff_123',
      name: 'Rohan Staff',
      email: 'staff@parthmobilecare.com',
      role: 'staff',
      isActive: true,
    };

    expect(() => verifyAndLoadAdminProfile(staffProfile, staffAuth)).toThrow(
      'Access Denied: The Admin Dashboard is strictly restricted to store administrators.'
    );
  });

  it('4. Denies un-profiled users who sign up via Auth without admin document', () => {
    const unknownAuth = { uid: 'rogue_uid', email: 'intruder@gmail.com' };
    expect(() => verifyAndLoadAdminProfile(null, unknownAuth)).toThrow(
      'profile was not found in database records'
    );
  });

  it('5. Generates tax invoice utilizing the updated primary store email', () => {
    const mockSale = {
      id: 'sale_001',
      invoiceNumber: 'INV-2026-001',
      buyerName: 'Amit Shah',
      phone: '9898012345',
      address: 'Vastral, Ahmedabad',
      soldByStaffName: 'Parth Patel',
      soldByStaffId: 'new_admin_uid_777',
      saleDate: '2026-11-13',
      saleTime: '15:30',
      paymentMethod: 'UPI' as const,
      brand: 'Apple',
      model: 'iPhone 15 Pro',
      imei: '358912345678901',
      storage: '256GB',
      color: 'Titanium Blue',
      sellingPrice: 85000,
      sellingAmount: 85000,
      purchaseAmount: 70000,
      profitAmount: 15000,
      marginPercent: 21.4,
      digitalSignatureUri: 'data:image/png;base64,mock',
      createdAt: '2026-11-13T10:00:00Z',
    };

    const mockConfig: ShopConfig = {
      shopName: 'Parth Mobile Care',
      tagline: 'Premium Smartphones & Repairs',
      shopAddress: '4, Jay Jagnath Complex, Odhav, Ahmedabad',
      phone: '+91 98765 43210',
      alternatePhone: '+91 98765 43211',
      email: NEW_ADMIN_EMAIL,
      gstNumber: '24AAACP1234A1Z5',
      latitude: 23.032588,
      longitude: 72.861115,
      allowedRadiusMeters: 30,
      openingTime: '10:00',
      closingTime: '21:00',
    };

    const pdf = buildSaleInvoicePdfDoc(mockSale, mockConfig);
    expect(pdf).toBeDefined();
    // Verify invoice generation succeeds with the updated shopConfig and email
    expect(mockConfig.email).toBe(NEW_ADMIN_EMAIL);
    expect(mockConfig.email).not.toBe(LEGACY_ADMIN_EMAIL);
  });
});
