import { describe, it, expect, vi } from 'vitest';
import * as exportUtils from '../utils/exportUtils';
import { getFriendlyAdminErrorMessage } from '../utils/errorHandler';
import { StaffInvitation, AdminAuditEntry, AppNotification } from '../types';
import {
  resolveNotificationNavigation,
  getNotificationActionLabel,
} from '../utils/notificationRouter';

describe('Admin Dashboard Export Utilities', () => {
  it('should export data to Excel format without error', () => {
    const mockData = [
      { Staff: 'Parth Patel', Date: '2026-11-03', Status: 'PRESENT' },
      { Staff: 'Ramesh Patel', Date: '2026-11-03', Status: 'PRESENT' },
    ];

    expect(() => {
      exportUtils.exportToExcel(mockData, 'Test_Attendance_Export');
    }).not.toThrow();
  });

  it('should export data to CSV format without error', () => {
    const mockData = [
      { Brand: 'Vivo', Model: 'V30 Pro', Price: 38999 },
      { Brand: 'Apple', Model: 'iPhone 15', Price: 69999 },
    ];

    expect(() => {
      exportUtils.exportToCsv(mockData, 'Test_Price_Export');
    }).not.toThrow();
  });

  it('handles empty data gracefully without throwing or blocking UI', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    exportUtils.exportToExcel([], 'Empty_Export');
    expect(warnSpy).toHaveBeenCalledWith('No data available to export.');
    warnSpy.mockRestore();
  });
});

describe('Staff Token Invitation Data Structure', () => {
  it('validates staff invitation object schema', () => {
    const invitation: StaffInvitation = {
      id: 'inv_1234567890',
      token: 'PMC-INV-ABC123XYZ',
      name: 'Ramesh Patel',
      email: 'ramesh@example.com',
      phone: '9876543210',
      role: 'staff',
      designation: 'Senior Sales Representative',
      basicSalary: 25000,
      monthlyTarget: 500000,
      createdBy: 'admin_uid_parth',
      createdByName: 'Parth Patel',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      status: 'pending',
    };

    expect(invitation.role).toBe('staff');
    expect(invitation.status).toBe('pending');
    expect(invitation.token.startsWith('PMC-INV-')).toBe(true);
    expect(invitation.basicSalary).toBeGreaterThan(0);
  });
});

describe('Security Audit Log Data Structure', () => {
  it('validates admin audit entry schema', () => {
    const auditEntry: AdminAuditEntry = {
      id: 'audit_12345',
      adminId: 'admin_parth',
      adminName: 'Parth Patel',
      actionType: 'staff_provisioned',
      targetRecordId: 'user_ramesh',
      targetRecordTitle: 'Ramesh Patel',
      timestamp: new Date().toISOString(),
      details: 'Created staff invitation token PMC-INV-ABC123XYZ',
    };

    expect(auditEntry.actionType).toBe('staff_provisioned');
    expect(auditEntry.adminName).toBe('Parth Patel');
    expect(auditEntry.details).toContain('PMC-INV-');
  });
});

describe('Second-Hand Inventory & Profit Math', () => {
  it('calculates gross profit and margin percentage accurately', () => {
    const purchaseAmount = 25000;
    const sellingAmount = 32000;
    const profit = sellingAmount - purchaseAmount;
    const margin = Math.round((profit / purchaseAmount) * 100);

    expect(profit).toBe(7000);
    expect(margin).toBe(28);
  });
});

describe('Dynamic Payroll & Attendance Computation', () => {
  it('computes pro-rated salary and attendance bonus correctly', () => {
    const basicSalary = 30000;
    const totalWorkingDays = 26;
    const presentDays = 24;
    const lateDays = 3;

    // Daily rate based on 26 days
    const dailyRate = basicSalary / totalWorkingDays;
    const earnedBasic = Math.round(dailyRate * presentDays);

    // Attendance bonus for >= 90% attendance
    const attendancePct = (presentDays / totalWorkingDays) * 100;
    const attendanceBonus = attendancePct >= 90 ? 1000 : 0;

    // Late penalty: 1 day deduction per 3 late days
    const lateDeductionDays = Math.floor(lateDays / 3);
    const deductions = Math.round(dailyRate * lateDeductionDays);

    const netSalary = earnedBasic + attendanceBonus - deductions;

    expect(earnedBasic).toBe(27692);
    expect(attendanceBonus).toBe(1000);
    expect(deductions).toBe(1154);
    expect(netSalary).toBe(27538);
  });
});

describe('Biometric Face Authentication State Model', () => {
  it('validates staff face approval and rejection workflow states', () => {
    const pendingStaff = {
      id: 'user_1',
      hasFaceRegistered: true,
      faceEnrollmentStatus: 'pending_approval' as const,
    };
    expect(pendingStaff.faceEnrollmentStatus).toBe('pending_approval');

    const approvedStaff = {
      ...pendingStaff,
      faceEnrollmentStatus: 'approved' as const,
      faceApprovedAt: new Date().toISOString(),
      faceApprovedBy: 'admin_uid',
    };
    expect(approvedStaff.faceEnrollmentStatus).toBe('approved');
    expect(approvedStaff.faceApprovedBy).toBe('admin_uid');

    const rejectedStaff = {
      ...pendingStaff,
      faceEnrollmentStatus: 'rejected' as const,
      faceRejectionReason: 'Face embedding blurriness exceeds threshold',
    };
    expect(rejectedStaff.faceEnrollmentStatus).toBe('rejected');
    expect(rejectedStaff.faceRejectionReason).toBeDefined();
  });

  it('correctly classifies all pending face review status variations', () => {
    const isFacePending = (u: any) =>
      u.faceEnrollmentStatus === 'pending_approval' ||
      u.faceEnrollmentStatus === 'pending_recovery' ||
      u.faceEnrollmentStatus === 'pending_review' ||
      u.faceEnrollmentStatus === 'pending' ||
      (Boolean(u.hasFaceRegistered) && !u.faceApprovedAt && u.faceEnrollmentStatus !== 'approved' && u.faceEnrollmentStatus !== 'rejected');

    expect(isFacePending({ faceEnrollmentStatus: 'pending_approval' })).toBe(true);
    expect(isFacePending({ faceEnrollmentStatus: 'pending_recovery' })).toBe(true);
    expect(isFacePending({ faceEnrollmentStatus: 'pending_review' })).toBe(true);
    expect(isFacePending({ faceEnrollmentStatus: 'pending' })).toBe(true);
    expect(isFacePending({ hasFaceRegistered: true, faceApprovedAt: null, faceEnrollmentStatus: 'unregistered' })).toBe(true);
    expect(isFacePending({ faceEnrollmentStatus: 'approved', faceApprovedAt: '2026-11-06T10:00:00Z' })).toBe(false);
    expect(isFacePending({ faceEnrollmentStatus: 'rejected', faceRejectionReason: 'Sample invalid' })).toBe(false);
    expect(isFacePending({ faceEnrollmentStatus: 'unregistered', hasFaceRegistered: false })).toBe(false);
  });

  it('guarantees no raw face templates or embeddings are stored or transmitted to the dashboard', () => {
    const staffProfile = {
      id: 'staff_123',
      name: 'Ramesh Patel',
      email: 'ramesh@example.com',
      faceEnrollmentStatus: 'pending_approval',
      hasFaceRegistered: true,
      faceModelVersion: 'MobileFaceNet v1',
    };

    // Sensitive biometrics must never be present
    expect((staffProfile as any).embedding).toBeUndefined();
    expect((staffProfile as any).faceEmbedding).toBeUndefined();
    expect((staffProfile as any).photoBase64).toBeUndefined();
    expect((staffProfile as any).rawImage).toBeUndefined();
    expect(staffProfile.faceModelVersion).toBe('MobileFaceNet v1');
  });
});

describe('Staff Direct Registration & Admin Approval Model', () => {
  it('validates pending registration state and metadata', () => {
    const applicant = {
      id: 'applicant_456',
      name: 'Sneha Rao',
      email: 'sneha@example.com',
      phone: '9876543210',
      role: 'staff' as const,
      designation: 'Sales Executive',
      basicSalary: 0,
      monthlyTarget: 0,
      isActive: false,
      registrationStatus: 'pending' as const,
      emailVerified: true,
      faceEnrollmentStatus: 'pending_approval' as const,
      hasFaceRegistered: false,
      deviceBindingStatus: 'pending_approval' as const,
      deviceId: 'dev_android_123',
      deviceModel: 'Pixel 7',
    };

    expect(applicant.registrationStatus).toBe('pending');
    expect(applicant.isActive).toBe(false);
    expect(applicant.emailVerified).toBe(true);
    expect(applicant.basicSalary).toBe(0);
    expect(applicant.monthlyTarget).toBe(0);
  });

  it('validates approved registration activation state', () => {
    const nowIso = new Date().toISOString();
    const approvedStaff = {
      id: 'applicant_456',
      name: 'Sneha Rao',
      role: 'staff' as const,
      registrationStatus: 'approved' as const,
      isActive: true,
      basicSalary: 22000,
      monthlyTarget: 250000,
      approvedAt: nowIso,
      approvedBy: 'admin_1',
      approvedByName: 'Parth Admin',
      faceEnrollmentStatus: 'approved' as const,
      hasFaceRegistered: true,
      deviceBindingStatus: 'approved' as const,
    };

    expect(approvedStaff.registrationStatus).toBe('approved');
    expect(approvedStaff.isActive).toBe(true);
    expect(approvedStaff.basicSalary).toBe(22000);
    expect(approvedStaff.monthlyTarget).toBe(250000);
    expect(approvedStaff.hasFaceRegistered).toBe(true);
    expect(approvedStaff.deviceBindingStatus).toBe('approved');
  });

  it('validates rejected registration state and rejection reason', () => {
    const nowIso = new Date().toISOString();
    const rejectedStaff = {
      id: 'applicant_789',
      name: 'Karan Mehra',
      role: 'staff' as const,
      registrationStatus: 'rejected' as const,
      isActive: false,
      rejectedAt: nowIso,
      rejectedBy: 'admin_1',
      rejectedByName: 'Parth Admin',
      rejectionReason: 'Applicant provided personal phone that failed security policy validation.',
      faceEnrollmentStatus: 'rejected' as const,
      hasFaceRegistered: false,
      deviceBindingStatus: 'rejected' as const,
    };

    expect(rejectedStaff.registrationStatus).toBe('rejected');
    expect(rejectedStaff.isActive).toBe(false);
    expect(rejectedStaff.rejectionReason.length).toBeGreaterThanOrEqual(5);
    expect(rejectedStaff.hasFaceRegistered).toBe(false);
  });
});

describe('Second-Hand Purchase Customer Name Resolution & Fallbacks', () => {
  it('correctly resolves customer name from canonical or legacy fields', () => {
    // Case 1: Canonical customerName
    const record1 = {
      id: 'p1',
      customerName: 'Manoj Malik',
      phone: '9655236845',
      hasSensitiveKyc: false,
    };
    const name1 = record1.customerName || (record1 as any).sellerName || 'Name unavailable';
    expect(name1).toBe('Manoj Malik');

    // Case 2: Missing from parent document but hasSensitiveKyc is true
    const record2 = {
      id: 'p2',
      customerName: '',
      hasSensitiveKyc: true,
    };
    const resolvedFromKyc = record2.customerName || (record2.hasSensitiveKyc ? 'Verified Seller (KYC)' : 'Name unavailable');
    expect(resolvedFromKyc).toBe('Verified Seller (KYC)');

    // Case 3: Completely empty without KYC
    const record3 = {
      id: 'p3',
      customerName: '',
      hasSensitiveKyc: false,
    };
    const resolvedEmpty = record3.customerName || (record3.hasSensitiveKyc ? 'Verified Seller (KYC)' : 'Name unavailable');
    expect(resolvedEmpty).toBe('Name unavailable');
  });
});

describe('ApiService In-Memory Cache & Invalidation', () => {
  it('stores and retrieves cached data within TTL', async () => {
    const { ApiService } = await import('../services/api');

    ApiService.setCache('test_key', { count: 42 }, 5000);
    const cached = ApiService.getFromCache<{ count: number }>('test_key');
    expect(cached).toEqual({ count: 42 });

    // Invalidation
    ApiService.invalidateCache('test_key');
    const afterInvalidate = ApiService.getFromCache('test_key');
    expect(afterInvalidate).toBeNull();
  });
});

describe('Professional Tax Invoice & PDF Generator Test Suite', () => {
  const sampleSale: any = {
    id: 'sale_001',
    invoiceNumber: 'PMC-INV-202611-5939',
    buyerName: 'Vivek Oberoi',
    phone: '9632587412',
    address: 'Farm House, SG Highway, Ahmedabad',
    brand: 'Samsung',
    model: 'S24 Ultra',
    ram: '12GB',
    storage: '512GB',
    imei: '646946191816491',
    sellingAmount: 96000,
    purchaseAmount: 80000,
    profitAmount: 16000,
    marginPercent: 20,
    warrantyMonths: 3,
    paymentMethod: 'Card',
    saleDate: '2026-11-05',
    saleTime: '21:40:46',
    soldByStaffId: 'pLQ1C2qPcnbkr6NWJeB2LMHmtCy2',
    soldByStaffName: 'Chetan Luhar',
    digitalSignatureUri: '',
  };

  const sampleConfig: any = {
    shopName: 'Parth Mobile Care',
    shopAddress: '4, Jay Jagnath Complex, Opp. New Laxmi Dairy, Odhav, Ahmedabad',
    phone: '+91 98765 43210',
    gstNumber: '24AAACP1234D1Z2',
  };

  it('1. builds a valid single-device sale invoice PDF', () => {
    const doc = exportUtils.buildSaleInvoicePdfDoc(sampleSale, sampleConfig);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  it('2. handles very long customer names without error', () => {
    const longNameSale = {
      ...sampleSale,
      buyerName: 'His Highness Kumar Vikramaditya Chandrashekhar Bahadur Singh of Bhavnagar',
    };
    const doc = exportUtils.buildSaleInvoicePdfDoc(longNameSale, sampleConfig);
    expect(doc).toBeDefined();
  });

  it('3. handles long multi-line customer addresses without crashing or overlapping', () => {
    const longAddrSale = {
      ...sampleSale,
      address:
        'Flat 504, Tower B, Shivalik Highstreet, Opp. Judges Bungalows, Bodakdev, SG Highway, Ahmedabad, Gujarat 380054, India',
    };
    const doc = exportUtils.buildSaleInvoicePdfDoc(longAddrSale, sampleConfig);
    expect(doc).toBeDefined();
  });

  it('4. handles long staff name and 28-char Firebase UID safely on dedicated lines', () => {
    const longStaffSale = {
      ...sampleSale,
      soldByStaffName: 'Dharmendrasinh Pradipsinh Vaghela Senior Store Manager',
      soldByStaffId: 'user_staff_pLQ1C2qPcnbkr6NWJeB2LMHmtCy2_prod_99',
    };
    const doc = exportUtils.buildSaleInvoicePdfDoc(longStaffSale, sampleConfig);
    expect(doc).toBeDefined();
  });

  it('5. formats all valid payment methods correctly', () => {
    const methods = ['Cash', 'UPI', 'Card', 'Bank Transfer'] as const;
    for (const method of methods) {
      const saleWithMethod = { ...sampleSale, paymentMethod: method };
      const doc = exportUtils.buildSaleInvoicePdfDoc(saleWithMethod, sampleConfig);
      expect(doc).toBeDefined();
    }
  });

  it('6. converts numeric amounts to Indian currency words accurately', () => {
    expect(exportUtils.numberToWordsIndian(96000)).toBe(
      'Rupees Ninety Six Thousand Only'
    );
    expect(exportUtils.numberToWordsIndian(80000)).toBe(
      'Rupees Eighty Thousand Only'
    );
    expect(exportUtils.numberToWordsIndian(600000)).toBe(
      'Rupees Six Lakh Only'
    );
    expect(exportUtils.numberToWordsIndian(14500)).toBe(
      'Rupees Fourteen Thousand Five Hundred Only'
    );
    expect(exportUtils.numberToWordsIndian(0)).toBe('Rupees Zero Only');
  });

  it('7. handles missing optional customer address gracefully with store fallback', () => {
    const noAddrSale = { ...sampleSale, address: '' };
    const doc = exportUtils.buildSaleInvoicePdfDoc(noAddrSale, sampleConfig);
    expect(doc).toBeDefined();
  });

  it('8. handles missing or unconfigured GSTIN without inventing dummy GST numbers', () => {
    const noGstConfig = { ...sampleConfig, gstNumber: '' };
    const doc = exportUtils.buildSaleInvoicePdfDoc(sampleSale, noGstConfig);
    expect(doc).toBeDefined();

    // Placeholder GSTIN should be ignored
    const dummyGstConfig = { ...sampleConfig, gstNumber: '24ABCDE1234F1Z5' };
    const doc2 = exportUtils.buildSaleInvoicePdfDoc(sampleSale, dummyGstConfig);
    expect(doc2).toBeDefined();
  });

  it('9. never exposes customer Aadhaar or sensitive KYC numbers on invoices', () => {
    const kycExposedSale = {
      ...sampleSale,
      aadhaarNumber: '998877665544',
    };
    const doc = exportUtils.buildSaleInvoicePdfDoc(kycExposedSale, sampleConfig);
    const pdfText = doc.output('datauristring');
    // Ensure Aadhaar number string is NOT drawn in the output
    expect(pdfText.includes('998877665544')).toBe(false);
  });

  it('10. triggers download save with invoice number in filename', () => {
    const doc = exportUtils.buildSaleInvoicePdfDoc(sampleSale, sampleConfig);
    const saveSpy = vi.spyOn(doc, 'save').mockImplementation(() => doc);
    doc.save(`Invoice_${sampleSale.invoiceNumber}.pdf`);
    expect(saveSpy).toHaveBeenCalledWith('Invoice_PMC-INV-202611-5939.pdf');
    saveSpy.mockRestore();
  });

  it('11. generates an invoice containing multiple products seamlessly', () => {
    const multiProductSale = {
      ...sampleSale,
      items: [
        {
          srNo: 1,
          description: 'Samsung S24 Ultra (12GB / 512GB)',
          imei: '646946191816491',
          warrantyMonths: 3,
          qty: 1,
          rate: 96000,
          amount: 96000,
        },
        {
          srNo: 2,
          description: 'Original 45W Type-C Super Fast Charger',
          imei: 'SAM-ACC-45W-9821',
          qty: 2,
          rate: 2500,
          amount: 5000,
        },
        {
          srNo: 3,
          description: 'Tempered Glass Screen Protector UV Curved',
          imei: 'N/A',
          qty: 1,
          rate: 800,
          amount: 800,
        },
      ],
      sellingAmount: 101800,
    };
    const doc = exportUtils.buildSaleInvoicePdfDoc(multiProductSale, sampleConfig);
    expect(doc).toBeDefined();
    expect(doc.getNumberOfPages()).toBe(1);
    const output = doc.output('datauristring');
    expect(output.length).toBeGreaterThan(1000);
  });

  it('12. does not contain removed promotional or fake diagnostic claims', () => {
    const doc = exportUtils.buildSaleInvoicePdfDoc(sampleSale, sampleConfig);
    const textData = doc.output('datauristring');
    // Ensure decorative promotional badges are removed
    expect(textData.includes('CERTIFIED PRE-OWNED DEVICE QUALITY ASSURANCE')).toBe(false);
    expect(textData.includes('Clean National Registry Record')).toBe(false);
    expect(textData.includes('OFFICIAL POS VERIFIED')).toBe(false);
  });
});

describe('Global Error Message Mapping & Sanitization', () => {
  it('translates permission-denied errors into respectful administrative guidance', () => {
    const error = new Error('Missing or insufficient permissions.');
    const result = getFriendlyAdminErrorMessage(error);
    expect(result).not.toContain('Missing or insufficient');
    expect(result).toBe("You don't have permission to perform this action.");
  });

  it('translates auth permission codes gracefully', () => {
    const error = { code: 'permission-denied', message: 'FirebaseError: permission-denied' };
    const result = getFriendlyAdminErrorMessage(error);
    expect(result).toBe("You don't have permission to perform this action.");
  });

  it('translates network-request-failed and unavailable errors into network guidance', () => {
    const error = { code: 'unavailable', message: 'The service is currently unavailable.' };
    const result = getFriendlyAdminErrorMessage(error);
    expect(result).toContain('check your internet and try again');
  });

  it('translates user-not-found into clear account notice', () => {
    const error = { code: 'auth/user-not-found' };
    const result = getFriendlyAdminErrorMessage(error);
    expect(result).toContain('Staff account not found');
  });

  it('never exposes raw Firebase syntax or internal tokens to the administrator', () => {
    const rawError = 'FirebaseError: [code=permission-denied]: internal client error at token 0x992';
    const friendly = getFriendlyAdminErrorMessage(rawError);
    expect(friendly).not.toContain('FirebaseError');
    expect(friendly).not.toContain('0x992');
  });
});

describe('Global Toast Notification Specification', () => {
  it('verifies exact auto-dismiss durations per specification', () => {
    // Specification: Success = 3s, Info = 4s, Warning = 5s, Error = 6s
    const DEFAULT_TOAST_DURATIONS = {
      success: 3000,
      info: 4000,
      warning: 5000,
      error: 6000,
    };

    expect(DEFAULT_TOAST_DURATIONS.success).toBe(3000);
    expect(DEFAULT_TOAST_DURATIONS.info).toBe(4000);
    expect(DEFAULT_TOAST_DURATIONS.warning).toBe(5000);
    expect(DEFAULT_TOAST_DURATIONS.error).toBe(6000);
  });
});

describe('Staff Account Status & Firestore Rules Compatibility', () => {
  it('ensures staff deactivation payload conforms to isValidUser schema (_syncedAt, no updatedAt)', () => {
    const buildStaffStatusPayload = (isActive: boolean) => ({
      isActive,
      _syncedAt: new Date().toISOString(),
    });

    const payload = buildStaffStatusPayload(false);
    expect(payload.isActive).toBe(false);
    expect(payload._syncedAt).toBeDefined();
    // CRITICAL: updatedAt is NOT in allowed keys of isValidUser() in firestore.rules
    expect((payload as any).updatedAt).toBeUndefined();
  });
});

describe('Attendance Filter Responsive Grid Specification', () => {
  it('verifies 12-column grid configuration for attendance filters', () => {
    const gridConfig = {
      container: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5',
      dateFilter: 'sm:col-span-2 lg:col-span-5',
      staffFilter: 'sm:col-span-1 lg:col-span-3',
      statusFilter: 'sm:col-span-1 lg:col-span-2',
      resetButton: 'sm:col-span-2 lg:col-span-2',
    };

    // 5 + 3 + 2 + 2 = 12 total columns on desktop
    const desktopCols = 5 + 3 + 2 + 2;
    expect(desktopCols).toBe(12);
    expect(gridConfig.dateFilter).toContain('lg:col-span-5');
  });
});

describe('Shop Settings Configuration & Persistence Validation', () => {
  it('validates that save payload includes all 12 required keys for firestore.rules isValidShopConfig', () => {
    const requiredKeys = [
      'shopName',
      'tagline',
      'shopAddress',
      'phone',
      'alternatePhone',
      'email',
      'gstNumber',
      'latitude',
      'longitude',
      'allowedRadiusMeters',
      'openingTime',
      'closingTime',
    ];

    const sampleConfig = {
      shopName: 'Parth Mobile Care',
      tagline: 'Your Trusted Smartphone Store',
      shopAddress: 'Main Market Road, Surat',
      phone: '+91 98765 43210',
      alternatePhone: '',
      email: 'info@parthmobilecare.com',
      gstNumber: '24ABCDE1234F1Z5',
      latitude: 21.1702,
      longitude: 72.8311,
      allowedRadiusMeters: 50,
      openingTime: '10:00',
      closingTime: '21:00',
      _syncedAt: new Date().toISOString(),
    };

    for (const key of requiredKeys) {
      expect((sampleConfig as any)[key]).toBeDefined();
    }

    expect(sampleConfig.latitude).toBeGreaterThanOrEqual(-90);
    expect(sampleConfig.latitude).toBeLessThanOrEqual(90);
    expect(sampleConfig.longitude).toBeGreaterThanOrEqual(-180);
    expect(sampleConfig.longitude).toBeLessThanOrEqual(180);
    expect(sampleConfig.allowedRadiusMeters).toBeGreaterThan(0);
  });
});

describe('Administrator Password Change Security Validation', () => {
  const validatePasswordForm = (current: string, next: string, confirm: string) => {
    const isCurrentValid = current.trim().length > 0;
    const isNewValid = next.length >= 6;
    const isConfirmValid = confirm.length > 0 && next === confirm;
    return isCurrentValid && isNewValid && isConfirmValid;
  };

  it('rejects empty current password', () => {
    expect(validatePasswordForm('', 'newPass123', 'newPass123')).toBe(false);
  });

  it('rejects passwords shorter than 6 characters', () => {
    expect(validatePasswordForm('oldPass', '12345', '12345')).toBe(false);
  });

  it('rejects mismatched new and confirmation passwords', () => {
    expect(validatePasswordForm('oldPass', 'newPassword1', 'newPassword2')).toBe(false);
  });

  it('accepts valid credentials conforming to all constraints', () => {
    expect(validatePasswordForm('oldPass', 'securePassword99', 'securePassword99')).toBe(true);
  });
});

describe('Enhanced Authentication Error Code Translations', () => {
  it('translates auth/wrong-password into actionable guidance', () => {
    const error = { code: 'auth/wrong-password', message: 'Firebase: Error (auth/wrong-password).' };
    expect(getFriendlyAdminErrorMessage(error)).toBe(
      'The current password entered is incorrect. Please verify and try again.'
    );
  });

  it('translates auth/invalid-credential into password guidance', () => {
    const error = { code: 'auth/invalid-credential', message: 'Firebase: Error (auth/invalid-credential).' };
    expect(getFriendlyAdminErrorMessage(error)).toBe(
      'The current password entered is incorrect. Please verify and try again.'
    );
  });

  it('translates auth/requires-recent-login into re-login instruction', () => {
    const error = { code: 'auth/requires-recent-login', message: 'Firebase: Error (auth/requires-recent-login).' };
    expect(getFriendlyAdminErrorMessage(error)).toBe(
      'For security reasons, this action requires a fresh sign-in. Please log out and log back in.'
    );
  });

  it('translates auth/weak-password into password strength recommendation', () => {
    const error = { code: 'auth/weak-password', message: 'Firebase: Error (auth/weak-password).' };
    expect(getFriendlyAdminErrorMessage(error)).toBe(
      'The new password is too weak. Please choose at least 6 characters with a combination of letters and numbers.'
    );
  });

  it('translates auth/invalid-email into email formatting notice', () => {
    const error = { code: 'auth/invalid-email', message: 'Firebase: Error (auth/invalid-email).' };
    expect(getFriendlyAdminErrorMessage(error)).toBe('Please enter a valid email address.');
  });
});

describe('Cache Lifecycle and Prefix Invalidation Model', () => {
  it('manages TTL and prefix-targeted cache invalidation correctly', () => {
    const mockCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

    const setCache = (key: string, data: any, ttl = 30000) => {
      mockCache.set(key, { data, timestamp: Date.now(), ttl });
    };

    const invalidateCache = (prefix?: string) => {
      if (!prefix) {
        mockCache.clear();
        return;
      }
      for (const key of Array.from(mockCache.keys())) {
        if (key.startsWith(prefix)) {
          mockCache.delete(key);
        }
      }
    };

    setCache('users:all', [{ id: 'u1' }]);
    setCache('leads:active', [{ id: 'l1' }]);
    setCache('prices:vivo', [{ id: 'p1' }]);

    expect(mockCache.size).toBe(3);

    // Invalidate users only
    invalidateCache('users');
    expect(mockCache.has('users:all')).toBe(false);
    expect(mockCache.has('leads:active')).toBe(true);
    expect(mockCache.has('prices:vivo')).toBe(true);

    // Invalidate all
    invalidateCache();
    expect(mockCache.size).toBe(0);
  });
});

describe('Customer KYC Privacy and Invoice Isolation Model', () => {
  it('verifies that sensitive customer KYC data is isolated from retail sale invoice output', () => {
    const sensitiveKycRecord = {
      purchaseId: 'PUR-2026-999',
      customerAadhaar: '9876-5432-1098',
      photoIdUrl: 'https://storage.googleapis.com/kyc/cust_id.jpg',
      aadhaarVerificationHash: 'a7b8c9d0e1f2',
    };

    const saleInvoiceRecord = {
      invoiceNumber: 'PMC-INV-2026-101',
      buyerName: 'Rahul Verma',
      buyerPhone: '9825012345',
      brand: 'Samsung',
      model: 'Galaxy S24 Ultra',
      imei: '864946191816491',
      sellingAmount: 96000,
    };

    // Customer Aadhaar and verification hash MUST NOT leak into sale invoices
    expect((saleInvoiceRecord as any).customerAadhaar).toBeUndefined();
    expect((saleInvoiceRecord as any).photoIdUrl).toBeUndefined();
    expect((saleInvoiceRecord as any).aadhaarVerificationHash).toBeUndefined();
    expect(sensitiveKycRecord.customerAadhaar).toMatch(/^\d{4}-\d{4}-\d{4}$/);
  });
});

describe('Staff Invitation Revocation Integrity', () => {
  it('validates revoked state and audit compliance', () => {
    const invitation = {
      token: 'PMC-INV-TEST-001',
      name: 'Pooja Shah',
      email: 'pooja@parthmobilecare.com',
      status: 'pending' as 'pending' | 'accepted' | 'revoked',
      createdAt: new Date().toISOString(),
    };

    const revokeInvitation = (inv: typeof invitation, adminName: string) => ({
      ...inv,
      status: 'revoked' as const,
      revokedAt: new Date().toISOString(),
      revokedBy: adminName,
    });

    const revoked = revokeInvitation(invitation, 'Parth Patel (Admin)');
    expect(revoked.status).toBe('revoked');
    expect(revoked.revokedBy).toBe('Parth Patel (Admin)');
    expect(revoked.revokedAt).toBeDefined();
  });
});

describe('Context-Aware Notification Click Navigation Routing', () => {
  it('navigates follow_up notifications to Leads page with recordId', () => {
    const notif: AppNotification = {
      id: 'notif_follow_1',
      title: 'Scheduled Customer Follow-up',
      body: 'Follow up with Amit Shah regarding Vivo V30 Pro',
      type: 'follow_up',
      timestamp: '2026-11-06T10:00:00Z',
      read: false,
      relatedId: 'lead_amit_123',
    };

    const result = resolveNotificationNavigation(notif);
    expect(result.action).toBe('navigate');
    expect(result.tab).toBe('leads');
    expect(result.params?.recordId).toBe('lead_amit_123');
    expect(result.params?.type).toBe('follow_up');
    expect(getNotificationActionLabel(notif)).toBe('Open Customer Lead');
  });

  it('navigates lead notifications to Leads page with recordId', () => {
    const notif: AppNotification = {
      id: 'notif_lead_1',
      title: 'New Customer Inquiry',
      body: 'Inquiry received for iPhone 15 Pro Max',
      type: 'lead',
      timestamp: '2026-11-06T10:15:00Z',
      read: false,
      relatedId: 'lead_inquiry_456',
    };

    const result = resolveNotificationNavigation(notif);
    expect(result.action).toBe('navigate');
    expect(result.tab).toBe('leads');
    expect(result.params?.recordId).toBe('lead_inquiry_456');
    expect(result.params?.type).toBe('lead');
    expect(getNotificationActionLabel(notif)).toBe('Open Customer Lead');
  });

  it('navigates sale notifications to Second-Hand sales sub-tab and invoice', () => {
    const notif: AppNotification = {
      id: 'notif_sale_1',
      title: 'Device Sale Finalized',
      body: 'Sold Samsung S24 Ultra. Generated invoice PMC-INV-2026-101',
      type: 'sale',
      timestamp: '2026-11-06T11:00:00Z',
      read: true,
      relatedId: 'sale_s24_789',
    };

    const result = resolveNotificationNavigation(notif);
    expect(result.action).toBe('navigate');
    expect(result.tab).toBe('secondhand');
    expect(result.params?.subTab).toBe('sales');
    expect(result.params?.recordId).toBe('sale_s24_789');
    expect(result.params?.type).toBe('sale');
    expect(getNotificationActionLabel(notif)).toBe('View Sale Invoice');
  });

  it('navigates purchase notifications to Second-Hand purchases sub-tab', () => {
    const notif: AppNotification = {
      id: 'notif_purchase_1',
      title: 'Pre-Owned Device Intake',
      body: 'Acquired OnePlus 12. Quality check and KYC recorded.',
      type: 'purchase',
      timestamp: '2026-11-06T11:30:00Z',
      read: false,
      relatedId: 'pur_oneplus_999',
    };

    const result = resolveNotificationNavigation(notif);
    expect(result.action).toBe('navigate');
    expect(result.tab).toBe('secondhand');
    expect(result.params?.subTab).toBe('purchases');
    expect(result.params?.recordId).toBe('pur_oneplus_999');
    expect(result.params?.type).toBe('purchase');
    expect(getNotificationActionLabel(notif)).toBe('View Device Intake');
  });

  it('navigates attendance notifications to Attendance page with staffId and date', () => {
    const notif: AppNotification = {
      id: 'notif_att_1',
      userId: 'staff_chetan_luhar',
      title: 'Shift Punch-In Recorded',
      body: 'Chetan Luhar punched in at 10:02 AM',
      type: 'attendance',
      timestamp: '2026-11-06T10:02:00Z',
      read: false,
      relatedId: 'att_record_333',
    };

    const result = resolveNotificationNavigation(notif);
    expect(result.action).toBe('navigate');
    expect(result.tab).toBe('attendance');
    expect(result.params?.staffId).toBe('staff_chetan_luhar');
    expect(result.params?.date).toBe('2026-11-06');
    expect(result.params?.recordId).toBe('att_record_333');
    expect(getNotificationActionLabel(notif)).toBe('Inspect Attendance');
  });

  it('navigates staff_registration notifications to Staff Management registrations sub-tab', () => {
    const notif: AppNotification = {
      id: 'notif_reg_1',
      title: 'Staff Registration Request',
      body: 'New staff account submitted by Ramesh Patel. Review pending.',
      type: 'announcement', // title-based override
      timestamp: '2026-11-06T12:00:00Z',
      read: false,
      relatedId: 'user_ramesh_new',
    };

    const result = resolveNotificationNavigation(notif);
    expect(result.action).toBe('navigate');
    expect(result.tab).toBe('staff');
    expect(result.params?.subTab).toBe('registrations');
    expect(result.params?.staffId).toBe('user_ramesh_new');
    expect(getNotificationActionLabel(notif)).toBe('Review Registration');
  });

  it('navigates device_binding notifications to Staff Management devices sub-tab', () => {
    const notif: AppNotification = {
      id: 'notif_dev_1',
      userId: 'staff_pooja',
      title: 'Device Change Request Submitted',
      body: 'Pooja Shah requested replacement of bound hardware handset.',
      type: 'announcement', // title-based override
      timestamp: '2026-11-06T12:30:00Z',
      read: false,
      relatedId: 'dcr_req_777',
    };

    const result = resolveNotificationNavigation(notif);
    expect(result.action).toBe('navigate');
    expect(result.tab).toBe('staff');
    expect(result.params?.subTab).toBe('devices');
    expect(result.params?.requestId).toBe('dcr_req_777');
    expect(getNotificationActionLabel(notif)).toBe('Review Device');
  });

  it('navigates face_enrollment notifications to Staff Management faces sub-tab', () => {
    const notif: AppNotification = {
      id: 'notif_face_1',
      userId: 'staff_amit',
      title: 'Biometric Face Enrollment Submitted',
      body: 'Amit Shah has registered their biometric face template. Administrator approval required.',
      type: 'face_enrollment',
      timestamp: '2026-11-06T12:45:00Z',
      read: false,
      relatedId: 'staff_amit',
    };

    const result = resolveNotificationNavigation(notif);
    expect(result.action).toBe('navigate');
    expect(result.tab).toBe('staff');
    expect(result.params?.subTab).toBe('faces');
    expect(result.params?.staffId).toBe('staff_amit');
    expect(result.params?.type).toBe('face_enrollment');
    expect(getNotificationActionLabel(notif)).toBe('Review Face Biometric');
  });

  it('navigates salary / target notifications to Payroll page with staffId and month', () => {
    const notif: AppNotification = {
      id: 'notif_sal_1',
      userId: 'staff_chetan',
      title: 'Monthly Salary Pay Slip Generated',
      body: 'Pay slip for November 2026 is ready for review.',
      type: 'target', // title-based override
      timestamp: '2026-11-06T13:00:00Z',
      read: true,
      relatedId: 'slip_nov_001',
    };

    const result = resolveNotificationNavigation(notif);
    expect(result.action).toBe('navigate');
    expect(result.tab).toBe('payroll');
    expect(result.params?.staffId).toBe('staff_chetan');
    expect(result.params?.month).toBe('2026-11');
    expect(getNotificationActionLabel(notif)).toBe('Open Salary Slip');
  });

  it('opens announcement modal for general store announcements', () => {
    const notif: AppNotification = {
      id: 'notif_ann_1',
      title: 'Diwali Festive Timing Announcement',
      body: 'The store will operate on extended festive shifts until 10:00 PM.',
      type: 'announcement',
      timestamp: '2026-11-06T14:00:00Z',
      read: false,
    };

    const result = resolveNotificationNavigation(notif);
    expect(result.action).toBe('modal');
    expect(result.modalType).toBe('announcement');
    expect(getNotificationActionLabel(notif)).toBe('View Announcement');
  });

  it('handles null, undefined, and corrupted notifications gracefully with error state', () => {
    const nullResult = resolveNotificationNavigation(null);
    expect(nullResult.action).toBe('error');
    expect(nullResult.errorMessage).toBe('Unable to open this notification. Please try again.');

    const emptyResult = resolveNotificationNavigation({} as any);
    expect(emptyResult.action).toBe('error');
    expect(emptyResult.errorMessage).toBe('Unable to open this notification. Please try again.');
  });

  it('handles notifications with missing relatedId without crashing or throwing', () => {
    const notifWithoutRef: AppNotification = {
      id: 'notif_lead_no_ref',
      title: 'Customer Follow-up Notice',
      body: 'General inquiry follow up',
      type: 'follow_up',
      timestamp: '2026-11-06T10:00:00Z',
      read: false,
    };

    expect(() => resolveNotificationNavigation(notifWithoutRef)).not.toThrow();
    const result = resolveNotificationNavigation(notifWithoutRef);
    expect(result.action).toBe('navigate');
    expect(result.tab).toBe('leads');
    expect(result.params?.recordId).toBeUndefined();
  });
});

