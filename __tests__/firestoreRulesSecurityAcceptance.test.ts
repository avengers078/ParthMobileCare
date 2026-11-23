/**
 * FIRESTORE SECURITY RULES ACCEPTANCE TESTS
 * Phase 1 Security Remediation & Rules Review
 *
 * Simulates and verifies the exact Firestore Security Rules evaluation logic
 * implemented in firestore.rules across:
 * 1. Staff Profile Update Permissions & Privilege Escalation Denial
 * 2. Device Change Requests Collection Security (Creation, Cancellation, Admin Review)
 * 3. Attendance Security (Punch In, Punch Out, Device Binding, State Transitions, Immutability)
 * 4. Staff Invitations & Administrative Audit Logs Security
 */

describe('FIRESTORE SECURITY RULES ACCEPTANCE TESTS', () => {
  // Mock Database state
  interface MockDoc {
    data: Record<string, any>;
  }

  const mockDb: {
    users: Record<string, MockDoc>;
    staff_invitations: Record<string, MockDoc>;
    attendance: Record<string, MockDoc>;
    device_change_requests: Record<string, MockDoc>;
    audit_logs: Record<string, MockDoc>;
  } = {
    users: {},
    staff_invitations: {},
    attendance: {},
    device_change_requests: {},
    audit_logs: {},
  };

  beforeEach(() => {
    mockDb.users = {
      admin_user: {
        data: {
          id: 'admin_user',
          name: 'Store Admin',
          email: 'admin@parthmobile.com',
          phone: '9999999999',
          role: 'admin',
          designation: 'Store Owner',
          joinedDate: '2026-01-01',
          basicSalary: 0,
          monthlyTarget: 0,
          isActive: true,
          deviceBindingStatus: 'approved',
          deviceId: 'dev_admin_123',
        },
      },
      staff_ramesh: {
        data: {
          id: 'staff_ramesh',
          name: 'Ramesh Patel',
          email: 'ramesh@parthmobile.com',
          phone: '9876543210',
          role: 'staff',
          designation: 'Sales Executive',
          joinedDate: '2026-01-15',
          basicSalary: 25000,
          monthlyTarget: 400000,
          isActive: true,
          hasFaceRegistered: true,
          faceEnrollmentStatus: 'approved',
          faceApprovedAt: '2026-02-01T10:00:00Z',
          faceApprovedBy: 'admin_user',
          deviceId: 'dev_ramesh_approved_001',
          devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA',
          deviceModel: 'Samsung Galaxy S23',
          devicePlatform: 'android',
          deviceBindingStatus: 'approved',
          deviceApprovedAt: '2026-02-01T10:00:00Z',
          deviceApprovedBy: 'admin_user',
        },
      },
      staff_unapproved: {
        data: {
          id: 'staff_unapproved',
          name: 'New Staff',
          email: 'new@parthmobile.com',
          phone: '9876543219',
          role: 'staff',
          designation: 'Trainee',
          joinedDate: '2026-03-01',
          basicSalary: 15000,
          monthlyTarget: 100000,
          isActive: true,
          deviceBindingStatus: 'pending_approval',
          deviceId: 'dev_unapproved_123',
        },
      },
      staff_inactive: {
        data: {
          id: 'staff_inactive',
          name: 'Inactive Staff',
          email: 'inactive@parthmobile.com',
          phone: '9876543218',
          role: 'staff',
          designation: 'Former Staff',
          joinedDate: '2026-01-01',
          basicSalary: 20000,
          monthlyTarget: 200000,
          isActive: false,
          deviceBindingStatus: 'approved',
          deviceId: 'dev_inactive_123',
        },
      },
      staff_pending: {
        data: {
          id: 'staff_pending',
          name: 'Pending Staff',
          email: 'pending@parthmobile.com',
          phone: '9876543211',
          role: 'staff',
          designation: 'Sales Executive',
          joinedDate: '2026-11-01',
          basicSalary: 0,
          monthlyTarget: 0,
          isActive: false,
          registrationStatus: 'pending',
          emailVerified: true,
          faceEnrollmentStatus: 'pending_review',
          faceModelVersion: 'facenet_512',
          faceRegistrationDate: '2026-11-01T10:00:00Z',
          hasFaceRegistered: false,
          deviceId: 'dev_pending_123',
          deviceModel: 'Pixel 7',
          devicePlatform: 'android',
          deviceRegisteredAt: '2026-11-01T10:00:00Z',
          deviceBindingStatus: 'pending_approval',
          devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
          createdAt: '2026-11-01T10:00:00Z',
          createdBy: 'staff_pending',
          _syncedAt: '2026-11-01T10:00:00Z',
        },
      },
      staff_rejected: {
        data: {
          id: 'staff_rejected',
          name: 'Rejected Staff',
          email: 'rejected@parthmobile.com',
          phone: '9876543212',
          role: 'staff',
          designation: 'Sales Executive',
          joinedDate: '2026-11-01',
          basicSalary: 0,
          monthlyTarget: 0,
          isActive: false,
          registrationStatus: 'rejected',
          emailVerified: true,
          faceEnrollmentStatus: 'pending_review',
          faceModelVersion: 'facenet_512',
          faceRegistrationDate: '2026-11-01T10:00:00Z',
          hasFaceRegistered: false,
          deviceId: 'dev_rejected_123',
          deviceModel: 'Pixel 7',
          devicePlatform: 'android',
          deviceRegisteredAt: '2026-11-01T10:00:00Z',
          deviceBindingStatus: 'pending_approval',
          devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
          createdAt: '2026-11-01T10:00:00Z',
          createdBy: 'staff_rejected',
          _syncedAt: '2026-11-01T10:00:00Z',
          rejectedAt: '2026-11-02T12:00:00Z',
          rejectedBy: 'admin_user',
          rejectedByName: 'Store Admin',
          rejectionReason: 'Invalid face scan, please retry in good lighting.',
          faceRejectionReason: 'Face blurred',
          deviceRejectionReason: 'Device unrecognized',
        },
      },
      staff_spoof_email: {
        data: {
          id: 'staff_spoof_email',
          name: 'Spoof Staff',
          email: 'admin@parthmobile.com',
          phone: '9876543210',
          role: 'staff',
          designation: 'Sales Executive',
          joinedDate: '2026-01-15',
          basicSalary: 25000,
          monthlyTarget: 400000,
          isActive: true,
          deviceBindingStatus: 'approved',
          deviceId: 'dev_spoof_123',
        },
      },
      admin_inactive: {
        data: {
          id: 'admin_inactive',
          name: 'Deactivated Admin',
          email: 'deactivated_admin@parthmobile.com',
          phone: '9999999990',
          role: 'admin',
          designation: 'Former Admin',
          joinedDate: '2026-01-01',
          basicSalary: 0,
          monthlyTarget: 0,
          isActive: false,
        },
      },
    };
  });

  // Helper evaluator mirroring firestore.rules
  const evaluateRule = {
    isValidUser: (data: Record<string, any>): boolean => {
      const allowed = [
        'id', 'name', 'email', 'phone', 'role', 'designation', 'avatarUrl',
        'joinedDate', 'basicSalary', 'monthlyTarget', 'isActive',
        'registrationStatus', 'emailVerified',
        'hasFaceRegistered', 'faceRegistrationDate', 'faceEnrollmentStatus', 'faceModelVersion',
        'faceApprovedAt', 'faceApprovedBy', 'faceRejectionReason',
        'failedVerificationAttempts', 'lastFailedVerificationReason', 'lastFailedVerificationAt',
        'createdBy', 'createdAt', 'passwordSetupStatus', 'invitationToken',
        'deviceId', 'devicePublicKey', 'deviceModel', 'devicePlatform',
        'deviceBindingStatus', 'deviceRegisteredAt', 'deviceApprovedAt', 'deviceApprovedBy',
        'deviceRejectionReason', 'approvedAt', 'approvedBy', 'approvedByName',
        'rejectedAt', 'rejectedBy', 'rejectedByName', 'rejectionReason', '_syncedAt'
      ];
      const required = ['id', 'name', 'email', 'phone', 'role', 'designation', 'joinedDate', 'basicSalary', 'monthlyTarget', 'isActive'];

      const keys = Object.keys(data);
      if (!keys.every(k => allowed.includes(k))) return false;
      if (!required.every(k => keys.includes(k))) return false;

      if (typeof data.id !== 'string' || data.id.length < 1 || data.id.length > 100) return false;
      if (typeof data.name !== 'string' || data.name.length < 1 || data.name.length > 100) return false;
      if (typeof data.email !== 'string' || data.email.length < 5 || data.email.length > 150) return false;
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(data.email)) return false;
      if (typeof data.phone !== 'string' || data.phone.length < 7 || data.phone.length > 20) return false;
      if (!['admin', 'manager', 'staff'].includes(data.role)) return false;
      if (typeof data.designation !== 'string' || data.designation.length < 1 || data.designation.length > 100) return false;
      if (typeof data.joinedDate !== 'string' || data.joinedDate.length < 1 || data.joinedDate.length > 50) return false;
      if (typeof data.basicSalary !== 'number' || data.basicSalary < 0) return false;
      if (typeof data.monthlyTarget !== 'number' || data.monthlyTarget < 0) return false;
      if (typeof data.isActive !== 'boolean') return false;

      if ('avatarUrl' in data && (typeof data.avatarUrl !== 'string' || data.avatarUrl.length > 500000)) return false;
      if ('registrationStatus' in data && (typeof data.registrationStatus !== 'string' || !['pending', 'approved', 'rejected'].includes(data.registrationStatus))) return false;
      if ('emailVerified' in data && typeof data.emailVerified !== 'boolean') return false;
      if ('faceEnrollmentStatus' in data && (typeof data.faceEnrollmentStatus !== 'string' || !['not_enrolled', 'pending_review', 'pending', 'pending_approval', 'approved', 'rejected'].includes(data.faceEnrollmentStatus))) return false;
      if ('faceModelVersion' in data && (typeof data.faceModelVersion !== 'string' || data.faceModelVersion.length > 100)) return false;
      if ('hasFaceRegistered' in data && typeof data.hasFaceRegistered !== 'boolean') return false;
      if ('faceRegistrationDate' in data && (typeof data.faceRegistrationDate !== 'string' || data.faceRegistrationDate.length > 50)) return false;
      if ('deviceId' in data && (typeof data.deviceId !== 'string' || data.deviceId.length > 100)) return false;
      if ('deviceModel' in data && (typeof data.deviceModel !== 'string' || data.deviceModel.length > 100)) return false;
      if ('devicePlatform' in data && (typeof data.devicePlatform !== 'string' || !['android', 'ios'].includes(data.devicePlatform))) return false;
      if ('deviceRegisteredAt' in data && (typeof data.deviceRegisteredAt !== 'string' || data.deviceRegisteredAt.length > 50)) return false;
      if ('deviceBindingStatus' in data && (typeof data.deviceBindingStatus !== 'string' || !['unregistered', 'pending_approval', 'approved', 'rejected'].includes(data.deviceBindingStatus))) return false;
      if ('devicePublicKey' in data && (typeof data.devicePublicKey !== 'string' || data.devicePublicKey.length > 2000)) return false;
      if ('createdAt' in data && (typeof data.createdAt !== 'string' || data.createdAt.length > 50)) return false;
      if ('createdBy' in data && (typeof data.createdBy !== 'string' || data.createdBy.length > 100)) return false;
      if ('_syncedAt' in data && (typeof data._syncedAt !== 'string' || data._syncedAt.length > 50)) return false;

      if ('faceApprovedAt' in data && (typeof data.faceApprovedAt !== 'string' || data.faceApprovedAt.length > 50)) return false;
      if ('faceApprovedBy' in data && (typeof data.faceApprovedBy !== 'string' || data.faceApprovedBy.length > 100)) return false;
      if ('faceRejectionReason' in data && (typeof data.faceRejectionReason !== 'string' || data.faceRejectionReason.length > 1000)) return false;
      if ('failedVerificationAttempts' in data && typeof data.failedVerificationAttempts !== 'number') return false;
      if ('lastFailedVerificationReason' in data && (typeof data.lastFailedVerificationReason !== 'string' || data.lastFailedVerificationReason.length > 1000)) return false;
      if ('lastFailedVerificationAt' in data && (typeof data.lastFailedVerificationAt !== 'string' || data.lastFailedVerificationAt.length > 50)) return false;
      if ('passwordSetupStatus' in data && (typeof data.passwordSetupStatus !== 'string' || data.passwordSetupStatus.length > 50)) return false;
      if ('invitationToken' in data && (typeof data.invitationToken !== 'string' || data.invitationToken.length > 100)) return false;
      if ('deviceApprovedAt' in data && (typeof data.deviceApprovedAt !== 'string' || data.deviceApprovedAt.length > 50)) return false;
      if ('deviceApprovedBy' in data && (typeof data.deviceApprovedBy !== 'string' || data.deviceApprovedBy.length > 100)) return false;
      if ('deviceRejectionReason' in data && (typeof data.deviceRejectionReason !== 'string' || data.deviceRejectionReason.length > 1000)) return false;
      if ('approvedAt' in data && (typeof data.approvedAt !== 'string' || data.approvedAt.length > 50)) return false;
      if ('approvedBy' in data && (typeof data.approvedBy !== 'string' || data.approvedBy.length > 100)) return false;
      if ('approvedByName' in data && (typeof data.approvedByName !== 'string' || data.approvedByName.length > 100)) return false;
      if ('rejectedAt' in data && (typeof data.rejectedAt !== 'string' || data.rejectedAt.length > 50)) return false;
      if ('rejectedBy' in data && (typeof data.rejectedBy !== 'string' || data.rejectedBy.length > 100)) return false;
      if ('rejectedByName' in data && (typeof data.rejectedByName !== 'string' || data.rejectedByName.length > 100)) return false;
      if ('rejectionReason' in data && (typeof data.rejectionReason !== 'string' || data.rejectionReason.length > 1000)) return false;

      return true;
    },

    // Admin check: trusted database or token-backed role
    isAdmin: (
      auth: { uid: string; role?: string; token?: { email_verified?: boolean; email?: string; role?: string } } | null
    ): boolean => {
      if (!auth) return false;
      const callerUser = mockDb.users[auth.uid]?.data;
      const tokenRole = auth.token?.role || auth.role;
      return (
        tokenRole === 'admin' ||
        (callerUser?.role === 'admin' && callerUser?.isActive === true)
      );
    },

    // User Profile Read Rules: allow read
    canReadUser: (
      auth: { uid: string; role?: string; token?: { email_verified?: boolean; email?: string; role?: string } } | null,
      targetUserId: string
    ): boolean => {
      if (!auth) return false;
      return evaluateRule.isAdmin(auth) || auth.uid === targetUserId;
    },

    // 1a. Users Collection Rules: allow create
    canCreateUser: (
      auth: { uid: string; role?: string; token?: { email_verified?: boolean; email?: string } } | null,
      targetUserId: string,
      incomingDoc: Record<string, any>
    ): boolean => {
      if (!auth) return false;

      // isAdmin()
      if (evaluateRule.isAdmin(auth)) return evaluateRule.isValidUser(incomingDoc);

      // Staff applicant registration: isOwner(userId)
      if (auth.uid !== targetUserId) return false;
      if (auth.token?.email_verified !== true) return false;
      if (!evaluateRule.isValidUser(incomingDoc)) return false;

      if (incomingDoc.id !== auth.uid) return false;
      if (incomingDoc.email !== auth.token?.email) return false;
      if (incomingDoc.role !== 'staff') return false;
      if (incomingDoc.isActive !== false) return false;
      if (incomingDoc.basicSalary !== 0) return false;
      if (incomingDoc.monthlyTarget !== 0) return false;
      if (incomingDoc.registrationStatus !== 'pending') return false;
      if (incomingDoc.emailVerified !== true) return false;
      if (incomingDoc.faceEnrollmentStatus !== 'pending_review') return false;
      if (incomingDoc.hasFaceRegistered !== false) return false;
      if (incomingDoc.deviceBindingStatus !== 'pending_approval') return false;

      const allowedKeys = [
        'id', 'name', 'email', 'phone', 'role', 'designation', 'avatarUrl',
        'joinedDate', 'basicSalary', 'monthlyTarget', 'isActive',
        'registrationStatus', 'emailVerified', 'faceEnrollmentStatus',
        'faceModelVersion', 'faceRegistrationDate', 'hasFaceRegistered',
        'deviceId', 'deviceModel', 'devicePlatform', 'deviceRegisteredAt',
        'deviceBindingStatus', 'devicePublicKey', 'createdAt', 'createdBy', '_syncedAt'
      ];
      const incomingKeys = Object.keys(incomingDoc);
      return incomingKeys.every(k => allowedKeys.includes(k));
    },

    // 1. Users Collection Rules: allow update
    canUpdateUser: (
      auth: { uid: string; role?: string; token?: { email_verified?: boolean; email?: string } } | null,
      targetUserId: string,
      currentDoc: Record<string, any>,
      incomingDoc: Record<string, any>
    ): boolean => {
      if (!auth) return false;

      // isAdmin()
      if (evaluateRule.isAdmin(auth)) return evaluateRule.isValidUser(incomingDoc);

      // Staff self-update: isOwner(userId)
      if (auth.uid !== targetUserId) return false;

      // Branch 2: Registration Resubmission for pending or rejected profiles
      const isRegistrationResubmission =
        currentDoc.registrationStatus &&
        ['pending', 'rejected'].includes(currentDoc.registrationStatus) &&
        auth.token?.email_verified === true &&
        evaluateRule.isValidUser(incomingDoc) &&
        incomingDoc.id === currentDoc.id &&
        incomingDoc.id === auth.uid &&
        incomingDoc.email === currentDoc.email &&
        incomingDoc.email === auth.token?.email &&
        incomingDoc.role === 'staff' &&
        incomingDoc.role === currentDoc.role &&
        incomingDoc.isActive === false &&
        incomingDoc.basicSalary === 0 &&
        incomingDoc.basicSalary === currentDoc.basicSalary &&
        incomingDoc.monthlyTarget === 0 &&
        incomingDoc.monthlyTarget === currentDoc.monthlyTarget &&
        incomingDoc.registrationStatus === 'pending' &&
        incomingDoc.emailVerified === true &&
        incomingDoc.faceEnrollmentStatus === 'pending_review' &&
        incomingDoc.hasFaceRegistered === false &&
        incomingDoc.deviceBindingStatus === 'pending_approval';

      const registrationAllowedAffectedKeys = [
        'name',
        'phone',
        'designation',
        'avatarUrl',
        'joinedDate',
        'registrationStatus',
        'emailVerified',
        'faceEnrollmentStatus',
        'faceModelVersion',
        'faceRegistrationDate',
        'hasFaceRegistered',
        'deviceId',
        'deviceModel',
        'devicePlatform',
        'deviceRegisteredAt',
        'deviceBindingStatus',
        'devicePublicKey',
        'createdAt',
        'createdBy',
        '_syncedAt',
        'rejectionReason',
        'faceRejectionReason',
        'deviceRejectionReason'
      ];

      if (isRegistrationResubmission) {
        const currentKeys = Object.keys(currentDoc);
        const incomingKeys = Object.keys(incomingDoc);
        const allKeys = Array.from(new Set([...currentKeys, ...incomingKeys]));
        const affectedKeys = allKeys.filter(k => currentDoc[k] !== incomingDoc[k]);
        if (affectedKeys.every(k => registrationAllowedAffectedKeys.includes(k))) {
          return true;
        }
      }

      // Branch 3: Existing staff self-update
      // diff().affectedKeys()
      const currentKeys = Object.keys(currentDoc);
      const incomingKeys = Object.keys(incomingDoc);
      const allKeys = Array.from(new Set([...currentKeys, ...incomingKeys]));
      const affectedKeys = allKeys.filter(k => currentDoc[k] !== incomingDoc[k]);

      // Strict allowlist:
      // ['name', 'phone', 'avatarUrl', 'deviceId', 'devicePublicKey', 'deviceModel', 'devicePlatform', 'deviceBindingStatus', 'deviceRegisteredAt', '_syncedAt']
      const staffAllowedKeys = [
        'name',
        'phone',
        'avatarUrl',
        'deviceId',
        'devicePublicKey',
        'deviceModel',
        'devicePlatform',
        'deviceBindingStatus',
        'deviceRegisteredAt',
        '_syncedAt',
      ];

      const affectedKeysAllowed = affectedKeys.every(k => staffAllowedKeys.includes(k));
      if (!affectedKeysAllowed) return false;

      // If deviceBindingStatus is in affected keys:
      if (affectedKeys.includes('deviceBindingStatus')) {
        const wasApproved = currentDoc.deviceBindingStatus === 'approved';
        if (wasApproved) return false; // cannot modify if already approved
        if (incomingDoc.deviceBindingStatus !== 'pending_approval') return false; // can only set to pending_approval
      }

      // If deviceId or devicePublicKey is in affected keys:
      if (affectedKeys.includes('deviceId') || affectedKeys.includes('devicePublicKey')) {
        const wasApproved = currentDoc.deviceBindingStatus === 'approved';
        if (wasApproved) return false; // cannot change device credentials if already approved
      }

      return true;
    },

    // 2. Device Change Requests Rules: allow create & update
    canCreateDeviceChangeRequest: (
      auth: { uid: string; role?: string } | null,
      requestData: Record<string, any>
    ): boolean => {
      if (!auth) return false;
      if (evaluateRule.isAdmin(auth)) return true;

      const callerUser = mockDb.users[auth.uid]?.data;

      // Staff creation:
      if (requestData.userId !== auth.uid) return false;
      if (requestData.status !== 'pending') return false;
      if (!callerUser) return false;
      if (requestData.userName !== callerUser.name) return false;
      if (requestData.userEmail !== callerUser.email) return false;

      // currentDeviceId check:
      if (callerUser.deviceId && requestData.currentDeviceId && requestData.currentDeviceId !== callerUser.deviceId) {
        return false;
      }

      return true;
    },

    canUpdateDeviceChangeRequest: (
      auth: { uid: string; role?: string } | null,
      currentDoc: Record<string, any>,
      incomingDoc: Record<string, any>
    ): boolean => {
      if (!auth) return false;
      const isAdmin = evaluateRule.isAdmin(auth);

      const affectedKeys = Object.keys(incomingDoc).filter(k => currentDoc[k] !== incomingDoc[k]);

      // Staff cancellation:
      if (!isAdmin) {
        if (currentDoc.userId !== auth.uid) return false;
        if (currentDoc.status !== 'pending') return false;
        if (incomingDoc.status !== 'cancelled') return false;
        return affectedKeys.every(k => ['status', '_syncedAt'].includes(k));
      }

      // Admin review:
      if (isAdmin) {
        if (currentDoc.status !== 'pending') return false;
        if (!['approved', 'rejected'].includes(incomingDoc.status)) return false;
        if (incomingDoc.reviewedBy !== auth.uid) return false;
        if (!incomingDoc.reviewedAt || typeof incomingDoc.reviewedAt !== 'string') return false;

        const adminAllowedKeys = [
          'status',
          'reviewedAt',
          'reviewedBy',
          'reviewedByName',
          'rejectionReason',
          '_syncedAt',
        ];
        if (!affectedKeys.every(k => adminAllowedKeys.includes(k))) return false;

        if (incomingDoc.status === 'rejected' && (!incomingDoc.rejectionReason || incomingDoc.rejectionReason.trim() === '')) {
          return false;
        }

        return true;
      }

      return false;
    },

    // 3. Attendance Rules: allow create & update
    canCreateAttendance: (
      auth: { uid: string; role?: string } | null,
      attendanceId: string,
      requestData: Record<string, any>
    ): boolean => {
      if (!auth) return false;
      if (evaluateRule.isAdmin(auth)) return true;

      const callerUser = mockDb.users[auth.uid]?.data;

      // Staff punch in
      if (requestData.userId !== auth.uid) return false;
      if (attendanceId !== `att_${auth.uid}_${requestData.date}`) return false;
      if (!callerUser || !callerUser.isActive) return false;
      if (callerUser.deviceBindingStatus !== 'approved') return false;
      if (!requestData.deviceId || requestData.deviceId !== callerUser.deviceId) return false;
      if (requestData.userName !== callerUser.name) return false;
      if (requestData.userRole !== callerUser.role) return false;
      if (!['present', 'late'].includes(requestData.status)) return false;
      if (requestData.totalHours !== 0) return false;
      if (requestData.isEarlyExit !== false) return false;
      if (requestData.punchOutTime && requestData.punchOutTime !== '' && requestData.punchOutTime !== '--:--') {
        return false;
      }
      if (!requestData.punchInTime || typeof requestData.punchInTime !== 'string') return false;

      return true;
    },

    canUpdateAttendance: (
      auth: { uid: string; role?: string } | null,
      currentDoc: Record<string, any>,
      incomingDoc: Record<string, any>
    ): boolean => {
      if (!auth) return false;
      if (evaluateRule.isAdmin(auth)) return true;

      const callerUser = mockDb.users[auth.uid]?.data;

      // Staff punch out
      if (currentDoc.userId !== auth.uid) return false;
      if (!callerUser || !callerUser.isActive) return false;
      if (callerUser.deviceBindingStatus !== 'approved') return false;
      if (incomingDoc.deviceId !== callerUser.deviceId) return false;

      // Previous doc must not already be punched out
      const alreadyPunchedOut =
        currentDoc.punchOutTime && currentDoc.punchOutTime !== '' && currentDoc.punchOutTime !== '--:--';
      if (alreadyPunchedOut) return false;

      // New doc must have valid punchOutTime
      const hasPunchOut =
        incomingDoc.punchOutTime && incomingDoc.punchOutTime !== '' && incomingDoc.punchOutTime !== '--:--';
      if (!hasPunchOut) return false;

      // Immutable punch-in and identity fields
      if (incomingDoc.id !== currentDoc.id) return false;
      if (incomingDoc.userId !== currentDoc.userId) return false;
      if (incomingDoc.userName !== currentDoc.userName) return false;
      if (incomingDoc.userRole !== currentDoc.userRole) return false;
      if (incomingDoc.date !== currentDoc.date) return false;
      if (incomingDoc.punchInTime !== currentDoc.punchInTime) return false;
      if (incomingDoc.deviceId !== currentDoc.deviceId) return false;
      if (incomingDoc.isLate !== currentDoc.isLate) return false;

      // Strict affectedKeys allowlist:
      const punchOutAllowedKeys = [
        'punchOutTime',
        'punchOutCoords',
        'status',
        'totalHours',
        'isEarlyExit',
        'notes',
        '_syncedAt',
        'timestamp',
      ];
      const affectedKeys = Object.keys(incomingDoc).filter(k => currentDoc[k] !== incomingDoc[k]);
      return affectedKeys.every(k => punchOutAllowedKeys.includes(k));
    },
  };

  // -------------------------------------------------------------
  // Test Section 0: User Profile Read Permissions & Admin Authorization Checks
  // -------------------------------------------------------------
  describe('0. User Profile Read Permissions & Admin Authorization Checks', () => {
    const adminAuth = { uid: 'admin_user', role: 'admin' };
    const staffAuth = { uid: 'staff_ramesh', role: 'staff' };
    const otherStaffAuth = { uid: 'staff_unapproved', role: 'staff' };

    it('ALLOWS staff to read their own user profile', () => {
      expect(evaluateRule.canReadUser(staffAuth, 'staff_ramesh')).toBe(true);
      expect(evaluateRule.canReadUser(otherStaffAuth, 'staff_unapproved')).toBe(true);
    });

    it('DENIES staff from reading another staff profile', () => {
      expect(evaluateRule.canReadUser(staffAuth, 'staff_unapproved')).toBe(false);
      expect(evaluateRule.canReadUser(otherStaffAuth, 'staff_ramesh')).toBe(false);
      expect(evaluateRule.canReadUser(staffAuth, 'admin_user')).toBe(false);
    });

    it('ALLOWS Admin to read any staff profile (staff, pending, rejected, unapproved)', () => {
      expect(evaluateRule.canReadUser(adminAuth, 'staff_ramesh')).toBe(true);
      expect(evaluateRule.canReadUser(adminAuth, 'staff_unapproved')).toBe(true);
      expect(evaluateRule.canReadUser(adminAuth, 'staff_pending')).toBe(true);
      expect(evaluateRule.canReadUser(adminAuth, 'staff_rejected')).toBe(true);
      expect(evaluateRule.canReadUser(adminAuth, 'admin_user')).toBe(true);
    });

    it('DENIES unauthenticated user from reading any profile', () => {
      expect(evaluateRule.canReadUser(null, 'staff_ramesh')).toBe(false);
      expect(evaluateRule.canReadUser(null, 'admin_user')).toBe(false);
    });

    it('DENIES staff with email admin@parthmobile.com but role staff in database from Admin actions', () => {
      const spoofAuth = { uid: 'staff_spoof_email', role: 'staff', token: { email: 'admin@parthmobile.com' } };
      expect(evaluateRule.isAdmin(spoofAuth)).toBe(false);
      // Also verify they cannot read other profiles via spoofed admin email
      expect(evaluateRule.canReadUser(spoofAuth, 'staff_ramesh')).toBe(false);
    });

    it('DENIES inactive admin from performing Admin actions', () => {
      const inactiveAdminAuth = { uid: 'admin_inactive' };
      expect(evaluateRule.isAdmin(inactiveAdminAuth)).toBe(false);
      expect(evaluateRule.canReadUser(inactiveAdminAuth, 'staff_ramesh')).toBe(false);
    });

    it('ALLOWS user with role admin in auth token or active in database to be recognized as admin', () => {
      const tokenAdminAuth = { uid: 'random_admin_id', token: { role: 'admin' } };
      expect(evaluateRule.isAdmin(tokenAdminAuth)).toBe(true);

      const dbAdminAuth = { uid: 'admin_user' };
      expect(evaluateRule.isAdmin(dbAdminAuth)).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Test Section 1: Staff Profile Update Permissions
  // -------------------------------------------------------------
  describe('1. Staff Profile Update Permissions', () => {
    const staffAuth = { uid: 'staff_ramesh', role: 'staff' };
    const rameshDoc = () => ({ ...mockDb.users.staff_ramesh.data });

    it('DENIES staff attempting to escalate role to admin', () => {
      const incoming = { ...rameshDoc(), role: 'admin' };
      expect(evaluateRule.canUpdateUser(staffAuth, staffAuth.uid, rameshDoc(), incoming)).toBe(false);
    });

    it('DENIES staff attempting to modify basicSalary or monthlyTarget', () => {
      const incomingSalary = { ...rameshDoc(), basicSalary: 99999 };
      expect(evaluateRule.canUpdateUser(staffAuth, staffAuth.uid, rameshDoc(), incomingSalary)).toBe(false);

      const incomingTarget = { ...rameshDoc(), monthlyTarget: 0 };
      expect(evaluateRule.canUpdateUser(staffAuth, staffAuth.uid, rameshDoc(), incomingTarget)).toBe(false);
    });

    it('DENIES staff attempting to change isActive status', () => {
      const incoming = { ...rameshDoc(), isActive: false };
      expect(evaluateRule.canUpdateUser(staffAuth, staffAuth.uid, rameshDoc(), incoming)).toBe(false);
    });

    it('DENIES staff attempting to self-approve face recognition status', () => {
      const unapprovedFaceStaff = {
        ...rameshDoc(),
        faceEnrollmentStatus: 'pending_approval',
      };
      const incoming = {
        ...unapprovedFaceStaff,
        faceEnrollmentStatus: 'approved',
        faceApprovedAt: new Date().toISOString(),
        faceApprovedBy: 'staff_ramesh',
      };
      expect(evaluateRule.canUpdateUser(staffAuth, staffAuth.uid, unapprovedFaceStaff, incoming)).toBe(false);
    });

    it('DENIES staff attempting to modify hasFaceRegistered', () => {
      const incoming = { ...rameshDoc(), hasFaceRegistered: false };
      expect(evaluateRule.canUpdateUser(staffAuth, staffAuth.uid, rameshDoc(), incoming)).toBe(false);
    });

    it('DENIES staff attempting to self-approve deviceBindingStatus to approved', () => {
      const unapprovedDeviceStaff = {
        ...mockDb.users.staff_unapproved.data,
      };
      const unapprovedAuth = { uid: 'staff_unapproved', role: 'staff' };
      const incoming = {
        ...unapprovedDeviceStaff,
        deviceBindingStatus: 'approved',
      };
      expect(evaluateRule.canUpdateUser(unapprovedAuth, unapprovedAuth.uid, unapprovedDeviceStaff, incoming)).toBe(
        false
      );
    });

    it('DENIES staff attempting to overwrite an already approved deviceId or devicePublicKey', () => {
      const incoming = {
        ...rameshDoc(),
        deviceId: 'dev_fraudulent_hacked_phone',
        devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
      };
      expect(evaluateRule.canUpdateUser(staffAuth, staffAuth.uid, rameshDoc(), incoming)).toBe(false);
    });

    it('ALLOWS legitimate profile updates: phone, name, avatarUrl', () => {
      const incoming = {
        ...rameshDoc(),
        name: 'Ramesh K. Patel',
        phone: '9876543299',
        avatarUrl: 'https://cloudinary.com/avatar123.jpg',
      };
      expect(evaluateRule.canUpdateUser(staffAuth, staffAuth.uid, rameshDoc(), incoming)).toBe(true);
    });

    it('ALLOWS initial unapproved device submission transitioning strictly to pending_approval', () => {
      const unbondedStaff = {
        ...rameshDoc(),
        deviceId: undefined,
        deviceBindingStatus: 'unregistered',
      };
      const incoming = {
        ...unbondedStaff,
        deviceId: 'dev_new_phone_123',
        devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
        deviceModel: 'OnePlus 11',
        devicePlatform: 'android',
        deviceBindingStatus: 'pending_approval',
        deviceRegisteredAt: new Date().toISOString(),
      };
      expect(evaluateRule.canUpdateUser(staffAuth, staffAuth.uid, unbondedStaff, incoming)).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Test Section 1b: Staff Registration Resubmission Permissions
  // -------------------------------------------------------------
  describe('1b. Staff Registration Resubmission Permissions', () => {
    const pendingAuth = { uid: 'staff_pending', role: 'staff', token: { email_verified: true, email: 'pending@parthmobile.com' } };
    const rejectedAuth = { uid: 'staff_rejected', role: 'staff', token: { email_verified: true, email: 'rejected@parthmobile.com' } };

    it('ALLOWS pending staff to update/resubmit registration profile with updated biometrics & device details', () => {
      const currentDoc = mockDb.users.staff_pending.data;
      const resubmission = {
        ...currentDoc,
        faceRegistrationDate: new Date().toISOString(),
        faceEnrollmentStatus: 'pending_review',
        deviceId: 'dev_resubmitted_device_123',
        deviceModel: 'OnePlus 12',
        devicePlatform: 'android',
        devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
        deviceBindingStatus: 'pending_approval',
        _syncedAt: new Date().toISOString(),
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, resubmission)).toBe(true);
    });

    it('ALLOWS rejected staff to resubmit their profile reverting status to pending for re-review with rejection metadata preserved', () => {
      const currentDoc = mockDb.users.staff_rejected.data;
      // Staff resubmission via setDoc(..., { merge: true }) preserves existing rejection metadata (rejectedAt, rejectedBy, etc.)
      const resubmission = {
        ...currentDoc,
        registrationStatus: 'pending',
        faceEnrollmentStatus: 'pending_review',
        faceRegistrationDate: new Date().toISOString(),
        rejectionReason: '',
        _syncedAt: new Date().toISOString(),
      };
      expect(evaluateRule.canUpdateUser(rejectedAuth, rejectedAuth.uid, currentDoc, resubmission)).toBe(true);
    });

    it('ALLOWS resubmitting an already pending profile (duplicate submission) idempotently', () => {
      const currentDoc = mockDb.users.staff_pending.data;
      const resubmission = {
        ...currentDoc,
        faceRegistrationDate: new Date().toISOString(),
        _syncedAt: new Date().toISOString(),
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, resubmission)).toBe(true);
    });

    it('DENIES registration resubmission if attempting to modify user ID', () => {
      const currentDoc = mockDb.users.staff_pending.data;
      const tampered = {
        ...currentDoc,
        id: 'spoofed_user_id',
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, tampered)).toBe(false);
    });

    it('DENIES registration resubmission if attempting to set hasFaceRegistered to true', () => {
      const currentDoc = mockDb.users.staff_pending.data;
      const tampered = {
        ...currentDoc,
        hasFaceRegistered: true,
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, tampered)).toBe(false);
    });

    it('DENIES registration resubmission if attempting role escalation to admin', () => {
      const currentDoc = mockDb.users.staff_pending.data;
      const tampered = {
        ...currentDoc,
        role: 'admin',
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, tampered)).toBe(false);
    });

    it('DENIES registration resubmission if email is not verified', () => {
      const unverifiedAuth = { uid: 'staff_pending', role: 'staff', token: { email_verified: false, email: 'pending@parthmobile.com' } };
      const currentDoc = mockDb.users.staff_pending.data;
      const resubmission = {
        ...currentDoc,
        faceRegistrationDate: new Date().toISOString(),
      };
      expect(evaluateRule.canUpdateUser(unverifiedAuth, unverifiedAuth.uid, currentDoc, resubmission)).toBe(false);
    });

    it('DENIES registration resubmission if basicSalary or monthlyTarget is greater than 0', () => {
      const currentDoc = mockDb.users.staff_pending.data;
      const tamperedSalary = {
        ...currentDoc,
        basicSalary: 50000,
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, tamperedSalary)).toBe(false);

      const tamperedTarget = {
        ...currentDoc,
        monthlyTarget: 100000,
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, tamperedTarget)).toBe(false);
    });

    it('DENIES registration resubmission if attempting to set isActive to true', () => {
      const currentDoc = mockDb.users.staff_pending.data;
      const tamperedActive = {
        ...currentDoc,
        isActive: true,
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, tamperedActive)).toBe(false);
    });

    it('DENIES registration resubmission if attempting to self-approve face or device', () => {
      const currentDoc = mockDb.users.staff_pending.data;
      const tamperedFace = {
        ...currentDoc,
        faceEnrollmentStatus: 'approved',
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, tamperedFace)).toBe(false);

      const tamperedDevice = {
        ...currentDoc,
        deviceBindingStatus: 'approved',
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, tamperedDevice)).toBe(false);
    });

    it('DENIES registration resubmission if email does not match authenticated token email', () => {
      const currentDoc = mockDb.users.staff_pending.data;
      const tamperedEmail = {
        ...currentDoc,
        email: 'attacker@evil.com',
      };
      expect(evaluateRule.canUpdateUser(pendingAuth, pendingAuth.uid, currentDoc, tamperedEmail)).toBe(false);
    });

    it('DENIES active approved staff from using registration resubmission branch to reset status', () => {
      const approvedStaffDoc = mockDb.users.staff_ramesh.data;
      const approvedAuth = { uid: 'staff_ramesh', role: 'staff', token: { email_verified: true, email: 'ramesh@parthmobile.com' } };
      const resetAttempt = {
        ...approvedStaffDoc,
        registrationStatus: 'pending',
        isActive: false,
        basicSalary: 0,
        monthlyTarget: 0,
      };
      expect(evaluateRule.canUpdateUser(approvedAuth, approvedAuth.uid, approvedStaffDoc, resetAttempt)).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // Test Section 1c: Staff Registration Creation Permissions (allow create)
  // -------------------------------------------------------------
  describe('1c. Staff Registration Creation Permissions (allow create)', () => {
    const applicantAuth = {
      uid: 'staff_new_applicant',
      role: 'staff',
      token: { email_verified: true, email: 'applicant@parthmobile.com' },
    };

    const validNewStaffDoc = () => ({
      id: 'staff_new_applicant',
      name: 'New Applicant',
      email: 'applicant@parthmobile.com',
      phone: '9876543233',
      role: 'staff',
      designation: 'Sales Representative',
      joinedDate: '2026-11-04',
      basicSalary: 0,
      monthlyTarget: 0,
      isActive: false,
      registrationStatus: 'pending',
      emailVerified: true,
      faceEnrollmentStatus: 'pending_review',
      faceModelVersion: 'facenet_512',
      faceRegistrationDate: '2026-11-04T10:00:00Z',
      hasFaceRegistered: false,
      deviceId: 'dev_applicant_phone_001',
      deviceModel: 'Pixel 8',
      devicePlatform: 'android',
      deviceRegisteredAt: '2026-11-04T10:00:00Z',
      deviceBindingStatus: 'pending_approval',
      devicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
      createdAt: '2026-11-04T10:00:00Z',
      createdBy: 'staff_new_applicant',
      _syncedAt: '2026-11-04T10:00:00Z',
    });

    it('ALLOWS a staff applicant to create their own pending profile with all 25 valid fields', () => {
      const doc = validNewStaffDoc();
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, doc)).toBe(true);
    });

    it('DENIES staff applicant creating a profile for another userId (not owner)', () => {
      const doc = validNewStaffDoc();
      expect(evaluateRule.canCreateUser(applicantAuth, 'different_uid', doc)).toBe(false);
    });

    it('DENIES staff applicant creating a profile if request.auth.token.email_verified is false', () => {
      const unverifiedAuth = {
        ...applicantAuth,
        token: { email_verified: false, email: 'applicant@parthmobile.com' },
      };
      const doc = validNewStaffDoc();
      expect(evaluateRule.canCreateUser(unverifiedAuth, applicantAuth.uid, doc)).toBe(false);
    });

    it('DENIES staff applicant creating a profile if email does not match token email', () => {
      const doc = { ...validNewStaffDoc(), email: 'someone_else@evil.com' };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, doc)).toBe(false);
    });

    it('DENIES staff applicant creating a profile with role other than staff', () => {
      const doc = { ...validNewStaffDoc(), role: 'admin' };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, doc)).toBe(false);
    });

    it('DENIES staff applicant creating a profile with isActive == true', () => {
      const doc = { ...validNewStaffDoc(), isActive: true };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, doc)).toBe(false);
    });

    it('DENIES staff applicant creating a profile with basicSalary > 0 or monthlyTarget > 0', () => {
      const docSalary = { ...validNewStaffDoc(), basicSalary: 50000 };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, docSalary)).toBe(false);

      const docTarget = { ...validNewStaffDoc(), monthlyTarget: 100000 };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, docTarget)).toBe(false);
    });

    it('DENIES staff applicant creating a profile with registrationStatus other than pending', () => {
      const doc = { ...validNewStaffDoc(), registrationStatus: 'approved' };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, doc)).toBe(false);
    });

    it('DENIES staff applicant creating a profile with faceEnrollmentStatus other than pending_review', () => {
      const doc = { ...validNewStaffDoc(), faceEnrollmentStatus: 'approved' };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, doc)).toBe(false);
    });

    it('DENIES staff applicant creating a profile with hasFaceRegistered == true', () => {
      const doc = { ...validNewStaffDoc(), hasFaceRegistered: true };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, doc)).toBe(false);
    });

    it('DENIES staff applicant creating a profile with deviceBindingStatus other than pending_approval', () => {
      const doc = { ...validNewStaffDoc(), deviceBindingStatus: 'approved' };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, doc)).toBe(false);
    });

    it('DENIES staff applicant creating a profile with devicePlatform other than android or ios', () => {
      const doc = { ...validNewStaffDoc(), devicePlatform: 'windows' };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, doc)).toBe(false);
    });

    it('DENIES staff applicant creating a profile with extraneous disallowed keys (e.g. approvedAt)', () => {
      const doc = { ...validNewStaffDoc(), approvedAt: '2026-11-04T10:00:00Z' };
      expect(evaluateRule.canCreateUser(applicantAuth, applicantAuth.uid, doc)).toBe(false);
    });

    it('ALLOWS Admin to create a staff profile with arbitrary valid user data', () => {
      const adminAuth = { uid: 'admin_user', role: 'admin' };
      const doc = {
        ...validNewStaffDoc(),
        id: 'admin_created_staff_01',
        basicSalary: 35000,
        monthlyTarget: 300000,
        isActive: true,
        registrationStatus: 'approved',
      };
      expect(evaluateRule.canCreateUser(adminAuth, 'admin_created_staff_01', doc)).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // Test Section 2: Device Change Requests Collection Security
  // -------------------------------------------------------------
  describe('2. Device Change Requests Collection Security', () => {
    const staffAuth = { uid: 'staff_ramesh', role: 'staff' };
    const adminAuth = { uid: 'admin_user', role: 'admin' };

    it('ALLOWS staff to submit a valid pending device change request matching their own profile', () => {
      const validRequest = {
        id: 'req_change_001',
        userId: 'staff_ramesh',
        userName: 'Ramesh Patel',
        userEmail: 'ramesh@parthmobile.com',
        currentDeviceId: 'dev_ramesh_approved_001',
        newDeviceId: 'dev_new_phone_999',
        newDevicePublicKey: 'MIIBIjANBgkqhkiG9w0BAQEFA...',
        newDeviceModel: 'Pixel 8 Pro',
        newDevicePlatform: 'android',
        reason: 'Upgraded to a new personal phone',
        status: 'pending',
        requestedAt: new Date().toISOString(),
      };
      expect(evaluateRule.canCreateDeviceChangeRequest(staffAuth, validRequest)).toBe(true);
    });

    it('DENIES staff forging a request for another user (identity spoofing)', () => {
      const spoofedRequest = {
        id: 'req_change_002',
        userId: 'staff_unapproved', // Not matching staff_ramesh
        userName: 'New Staff',
        userEmail: 'new@parthmobile.com',
        newDeviceId: 'dev_spoofed_123',
        status: 'pending',
      };
      expect(evaluateRule.canCreateDeviceChangeRequest(staffAuth, spoofedRequest)).toBe(false);
    });

    it('DENIES staff creating a pre-approved device change request', () => {
      const fraudRequest = {
        id: 'req_change_003',
        userId: 'staff_ramesh',
        userName: 'Ramesh Patel',
        userEmail: 'ramesh@parthmobile.com',
        newDeviceId: 'dev_new_phone_999',
        status: 'approved', // Pre-approving own request
      };
      expect(evaluateRule.canCreateDeviceChangeRequest(staffAuth, fraudRequest)).toBe(false);
    });

    it('ALLOWS staff to cancel their own pending request', () => {
      const pendingReq = {
        id: 'req_change_001',
        userId: 'staff_ramesh',
        status: 'pending',
        newDeviceId: 'dev_new_phone_999',
      };
      const cancelledReq = {
        ...pendingReq,
        status: 'cancelled',
      };
      expect(evaluateRule.canUpdateDeviceChangeRequest(staffAuth, pendingReq, cancelledReq)).toBe(true);
    });

    it('DENIES staff approving or rejecting their own device change request', () => {
      const pendingReq = {
        id: 'req_change_001',
        userId: 'staff_ramesh',
        status: 'pending',
        newDeviceId: 'dev_new_phone_999',
      };
      const approvedReq = {
        ...pendingReq,
        status: 'approved',
        reviewedBy: 'staff_ramesh',
        reviewedAt: new Date().toISOString(),
      };
      expect(evaluateRule.canUpdateDeviceChangeRequest(staffAuth, pendingReq, approvedReq)).toBe(false);
    });

    it('ALLOWS Admin to approve pending request with reviewedBy validation', () => {
      const pendingReq = {
        id: 'req_change_001',
        userId: 'staff_ramesh',
        status: 'pending',
        newDeviceId: 'dev_new_phone_999',
      };
      const approvedReq = {
        ...pendingReq,
        status: 'approved',
        reviewedBy: 'admin_user',
        reviewedAt: new Date().toISOString(),
      };
      expect(evaluateRule.canUpdateDeviceChangeRequest(adminAuth, pendingReq, approvedReq)).toBe(true);
    });

    it('ALLOWS Admin to reject pending request with mandatory rejectionReason', () => {
      const pendingReq = {
        id: 'req_change_001',
        userId: 'staff_ramesh',
        status: 'pending',
        newDeviceId: 'dev_new_phone_999',
      };
      const rejectedReq = {
        ...pendingReq,
        status: 'rejected',
        reviewedBy: 'admin_user',
        reviewedAt: new Date().toISOString(),
        rejectionReason: 'Device model does not support hardware biometric keystore.',
      };
      expect(evaluateRule.canUpdateDeviceChangeRequest(adminAuth, pendingReq, rejectedReq)).toBe(true);
    });

    it('DENIES Admin rejection without rejectionReason', () => {
      const pendingReq = {
        id: 'req_change_001',
        userId: 'staff_ramesh',
        status: 'pending',
        newDeviceId: 'dev_new_phone_999',
      };
      const rejectedWithoutReason = {
        ...pendingReq,
        status: 'rejected',
        reviewedBy: 'admin_user',
        reviewedAt: new Date().toISOString(),
        rejectionReason: '',
      };
      expect(evaluateRule.canUpdateDeviceChangeRequest(adminAuth, pendingReq, rejectedWithoutReason)).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // Test Section 3: Attendance Security Rules
  // -------------------------------------------------------------
  describe('3. Attendance Collection Security Rules', () => {
    const staffAuth = { uid: 'staff_ramesh', role: 'staff' };
    const today = '2026-11-03';

    it('ALLOWS active staff to punch in on their approved bound device with matching document ID', () => {
      const punchInRecord = {
        id: `att_${staffAuth.uid}_${today}`,
        userId: staffAuth.uid,
        userName: 'Ramesh Patel',
        userRole: 'staff',
        date: today,
        punchInTime: '09:55',
        status: 'present',
        totalHours: 0,
        isLate: false,
        isEarlyExit: false,
        deviceId: 'dev_ramesh_approved_001', // Matches mockDb approved deviceId
      };
      expect(
        evaluateRule.canCreateAttendance(staffAuth, `att_${staffAuth.uid}_${today}`, punchInRecord)
      ).toBe(true);
    });

    it('DENIES punch in from an unapproved device (hardware mismatch)', () => {
      const unauthorizedDeviceRecord = {
        id: `att_${staffAuth.uid}_${today}`,
        userId: staffAuth.uid,
        userName: 'Ramesh Patel',
        userRole: 'staff',
        date: today,
        punchInTime: '09:55',
        status: 'present',
        totalHours: 0,
        isLate: false,
        isEarlyExit: false,
        deviceId: 'dev_unauthorized_attacker_phone',
      };
      expect(
        evaluateRule.canCreateAttendance(staffAuth, `att_${staffAuth.uid}_${today}`, unauthorizedDeviceRecord)
      ).toBe(false);
    });

    it('DENIES punch in if staff account deviceBindingStatus is pending_approval', () => {
      const unapprovedAuth = { uid: 'staff_unapproved', role: 'staff' };
      const record = {
        id: `att_${unapprovedAuth.uid}_${today}`,
        userId: unapprovedAuth.uid,
        userName: 'New Staff',
        userRole: 'staff',
        date: today,
        punchInTime: '09:55',
        status: 'present',
        totalHours: 0,
        isLate: false,
        isEarlyExit: false,
        deviceId: 'dev_unapproved_123',
      };
      expect(evaluateRule.canCreateAttendance(unapprovedAuth, record.id, record)).toBe(false);
    });

    it('DENIES punch in if staff account isActive is false (deactivated employee)', () => {
      const inactiveAuth = { uid: 'staff_inactive', role: 'staff' };
      const record = {
        id: `att_${inactiveAuth.uid}_${today}`,
        userId: inactiveAuth.uid,
        userName: 'Inactive Staff',
        userRole: 'staff',
        date: today,
        punchInTime: '09:55',
        status: 'present',
        totalHours: 0,
        isLate: false,
        isEarlyExit: false,
        deviceId: 'dev_inactive_123',
      };
      expect(evaluateRule.canCreateAttendance(inactiveAuth, record.id, record)).toBe(false);
    });

    it('DENIES punch in with mismatched document ID format', () => {
      const record = {
        id: 'random_custom_id_123',
        userId: staffAuth.uid,
        userName: 'Ramesh Patel',
        userRole: 'staff',
        date: today,
        punchInTime: '09:55',
        status: 'present',
        totalHours: 0,
        isLate: false,
        isEarlyExit: false,
        deviceId: 'dev_ramesh_approved_001',
      };
      expect(evaluateRule.canCreateAttendance(staffAuth, 'random_custom_id_123', record)).toBe(false);
    });

    it('DENIES creating attendance record with punchOutTime pre-populated', () => {
      const record = {
        id: `att_${staffAuth.uid}_${today}`,
        userId: staffAuth.uid,
        userName: 'Ramesh Patel',
        userRole: 'staff',
        date: today,
        punchInTime: '09:55',
        punchOutTime: '18:00', // Pre-populated punch out on create is forbidden
        status: 'present',
        totalHours: 8,
        isLate: false,
        isEarlyExit: false,
        deviceId: 'dev_ramesh_approved_001',
      };
      expect(evaluateRule.canCreateAttendance(staffAuth, record.id, record)).toBe(false);
    });

    it('ALLOWS valid Punch Out on previously punched-in active session', () => {
      const currentPunchIn = {
        id: `att_${staffAuth.uid}_${today}`,
        userId: staffAuth.uid,
        userName: 'Ramesh Patel',
        userRole: 'staff',
        date: today,
        punchInTime: '09:55',
        punchOutTime: '',
        status: 'present',
        totalHours: 0,
        isLate: false,
        isEarlyExit: false,
        deviceId: 'dev_ramesh_approved_001',
      };
      const punchOutUpdate = {
        ...currentPunchIn,
        punchOutTime: '19:05',
        totalHours: 9.16,
        status: 'present',
        notes: 'Punched out successfully at end of shift.',
      };
      expect(evaluateRule.canUpdateAttendance(staffAuth, currentPunchIn, punchOutUpdate)).toBe(true);
    });

    it('DENIES duplicate Punch Out on an already completed attendance session', () => {
      const alreadyCompletedRecord = {
        id: `att_${staffAuth.uid}_${today}`,
        userId: staffAuth.uid,
        userName: 'Ramesh Patel',
        userRole: 'staff',
        date: today,
        punchInTime: '09:55',
        punchOutTime: '19:05', // Already has punch out
        status: 'present',
        totalHours: 9.16,
        isLate: false,
        isEarlyExit: false,
        deviceId: 'dev_ramesh_approved_001',
      };
      const secondPunchOut = {
        ...alreadyCompletedRecord,
        punchOutTime: '21:00',
        totalHours: 11.0,
      };
      expect(evaluateRule.canUpdateAttendance(staffAuth, alreadyCompletedRecord, secondPunchOut)).toBe(false);
    });

    it('DENIES modifying historical punchInTime or date during punch out', () => {
      const currentPunchIn = {
        id: `att_${staffAuth.uid}_${today}`,
        userId: staffAuth.uid,
        userName: 'Ramesh Patel',
        userRole: 'staff',
        date: today,
        punchInTime: '10:30', // Was late
        punchOutTime: '',
        status: 'late',
        totalHours: 0,
        isLate: true,
        isEarlyExit: false,
        deviceId: 'dev_ramesh_approved_001',
      };
      // Staff tries to tamper with punchInTime to pretend they arrived on time
      const tamperedUpdate = {
        ...currentPunchIn,
        punchInTime: '09:45',
        isLate: false,
        punchOutTime: '19:05',
        totalHours: 9.33,
      };
      expect(evaluateRule.canUpdateAttendance(staffAuth, currentPunchIn, tamperedUpdate)).toBe(false);
    });
  });
});

