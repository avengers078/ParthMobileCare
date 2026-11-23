import { NotificationService } from '../src/services/notificationService';
import { StorageService } from '../src/services/storageService';
import { LeadService } from '../src/services/leadService';
import { User } from '../src/types';
import fs from 'fs';
import path from 'path';

// Mock Firebase service
jest.mock('../src/services/firebase', () => ({
  __esModule: true,
  default: {
    getFirestore: jest.fn(() => ({})),
    getAuth: jest.fn(() => ({ currentUser: { uid: 'test_uid' } })),
    getStorage: jest.fn(() => ({})),
    init: jest.fn().mockResolvedValue(true),
  },
}));

describe('Firebase Security & Notification Verification', () => {
  const mockStaffUser: User = {
    id: 'staff_101',
    name: 'Rahul Staff',
    email: 'rahul@parthmobile.com',
    phone: '9876543210',
    role: 'staff',
    designation: 'Sales Executive',
    joinedDate: '2024-01-01',
    basicSalary: 18000,
    monthlyTarget: 150000,
    isActive: true,
  };

  describe('1. Storage & Firestore Security Rules Integrity', () => {
    test('storage.rules exists and blocks public unauthenticated access', () => {
      const storageRulesPath = path.join(__dirname, '..', 'storage.rules');
      expect(fs.existsSync(storageRulesPath)).toBe(true);

      const content = fs.readFileSync(storageRulesPath, 'utf8');
      expect(content).toContain("service firebase.storage");
      expect(content).toContain("function isAuthenticated()");
      expect(content).toContain("match /kyc/{purchaseId}/{fileName}");
      expect(content).toContain("match /signatures/{recordId}/{fileName}");
      expect(content).toContain("match /salary_slips/{staffId}/{fileName}");
      // Default deny present
      expect(content).toContain("allow read, write: if false;");
      // No public read / write
      expect(content).not.toContain("allow read, write: if true;");
      expect(content).not.toContain("allow read: if true;");
    });

    test('firebase.json includes both firestore and storage configurations', () => {
      const fbJsonPath = path.join(__dirname, '..', 'firebase.json');
      expect(fs.existsSync(fbJsonPath)).toBe(true);

      const parsed = JSON.parse(fs.readFileSync(fbJsonPath, 'utf8'));
      expect(parsed.firestore).toBeDefined();
      expect(parsed.firestore.rules).toBe('firestore.rules');
      expect(parsed.storage).toBeDefined();
      expect(parsed.storage.rules).toBe('storage.rules');
    });

    test('firestore.rules enforces role check and restricts salary and shop config', () => {
      const firestoreRulesPath = path.join(__dirname, '..', 'firestore.rules');
      expect(fs.existsSync(firestoreRulesPath)).toBe(true);

      const content = fs.readFileSync(firestoreRulesPath, 'utf8');
      expect(content).toContain("function isAdmin()");
      expect(content).toContain("function isManagerOrAdmin()");
      expect(content).toContain("match /salary_slips/{slipId}");
      expect(content).toContain("resource.data.staffId == request.auth.uid");
      expect(content).toContain("match /shop_config/{configId}");
      expect(content).toContain("allow create, update: if isAdmin()");
    });
  });

  describe('2. Lead Reminders & In-App Event Notifications', () => {
    beforeEach(async () => {
      jest.clearAllMocks();
    });

    test('LeadService triggers follow-up notification when follow-up date is provided', async () => {
      const lead = await LeadService.createLead(
        {
          name: 'Pooja Sharma',
          phone: '9876543220',
          interestedBrand: 'Samsung',
          interestedModel: 'Galaxy S24',
          budget: 65000,
          remarks: 'Looking for 256GB violet variant',
          followUpDate: '2026-10-26',
          followUpTime: '15:00',
        },
        mockStaffUser,
        'new',
        false // Do not invoke external deep link in test
      );

      expect(lead.id).toBeDefined();
      expect(lead.createdBy).toBe(mockStaffUser.id);
      expect(lead.followUpDate).toBe('2026-10-26');

      const notifs = await StorageService.getNotifications();
      const followUpNotif = notifs.find(n => n.type === 'follow_up' && n.relatedId === lead.id);
      expect(followUpNotif).toBeDefined();
      expect(followUpNotif?.title).toContain('Follow-Up Scheduled');
    });

    test('NotificationService checks due follow-ups and prevents duplicate alerts', async () => {
      const count1 = await NotificationService.checkAndTriggerLeadReminders();
      expect(typeof count1).toBe('number');

      // Immediate second check should not duplicate notifications
      const count2 = await NotificationService.checkAndTriggerLeadReminders();
      expect(count2).toBe(0);
    });

    test('NotificationService handles Android permission check safely', async () => {
      const result = await NotificationService.requestNotificationPermission();
      expect(result).toHaveProperty('granted');
      expect(typeof result.granted).toBe('boolean');
    });
  });

  describe('3. PII and External Integration Safety', () => {
    test('Aadhaar number masking in PDF receipts avoids exposing full 12 digits', () => {
      const pdfServicePath = path.join(__dirname, '..', 'src', 'services', 'pdfService.ts');
      const content = fs.readFileSync(pdfServicePath, 'utf8');
      expect(content).toContain("XXXX-XXXX-' + sale.aadhaarNumber.slice(-4)");
    });

    test('External WhatsApp and SMS utilities are client deep-links, not silent server gateways', () => {
      const waPath = path.join(__dirname, '..', 'src', 'utils', 'whatsapp.ts');
      const content = fs.readFileSync(waPath, 'utf8');
      expect(content).toContain('whatsapp://send?phone=');
      expect(content).toContain('sms:');
      // Must not contain hardcoded 3rd party SMS gateway API secrets
      expect(content).not.toContain('TWILIO_AUTH_TOKEN');
      expect(content).not.toContain('MSG91_AUTH_KEY');
    });
  });
});

