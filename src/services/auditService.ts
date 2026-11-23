import { StorageService } from './storageService';
import { AdminAuditActionType, AdminAuditEntry } from '../types';

export interface LogActionParams {
  adminId: string;
  adminName: string;
  actionType: AdminAuditActionType | string;
  targetRecordId: string;
  targetRecordTitle?: string;
  details?: string;
  beforeValue?: Record<string, any>;
  afterValue?: Record<string, any>;
}

export interface AuditLogFilter {
  actionType?: string;
  targetRecordId?: string;
  adminId?: string;
  startDate?: string;
  endDate?: string;
}

export class AuditService {
  /**
   * Sanitizes object to remove sensitive keys (passwords, auth tokens, secrets)
   */
  private static sanitizeValues(obj?: Record<string, any>): Record<string, any> | undefined {
    if (!obj || typeof obj !== 'object') return undefined;
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'secret', 'inviteLink', 'privateKey', 'apiKey'];

    for (const [key, value] of Object.entries(obj)) {
      if (sensitiveKeys.some(s => key.toLowerCase().includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeValues(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Appends an immutable audit log entry.
   * ordinary users and admins cannot edit or delete logged entries.
   */
  static async logAction(params: LogActionParams): Promise<AdminAuditEntry> {
    const entry = await StorageService.addAdminAuditLog({
      adminId: params.adminId,
      adminName: params.adminName,
      actionType: params.actionType,
      targetRecordId: params.targetRecordId,
      targetRecordTitle: params.targetRecordTitle,
      details: params.details,
      beforeValue: this.sanitizeValues(params.beforeValue),
      afterValue: this.sanitizeValues(params.afterValue),
    });
    return entry;
  }

  /**
   * Retrieves audit logs with optional filtering (sorted newest first)
   */
  static async getLogs(filter?: AuditLogFilter): Promise<AdminAuditEntry[]> {
    let logs = await StorageService.getAdminAuditLogs();

    if (!filter) return logs;

    if (filter.actionType && filter.actionType !== 'all') {
      logs = logs.filter(l => l.actionType === filter.actionType);
    }
    if (filter.targetRecordId) {
      logs = logs.filter(l => l.targetRecordId === filter.targetRecordId);
    }
    if (filter.adminId) {
      logs = logs.filter(l => l.adminId === filter.adminId);
    }
    if (filter.startDate) {
      logs = logs.filter(l => l.timestamp >= filter.startDate!);
    }
    if (filter.endDate) {
      logs = logs.filter(l => l.timestamp <= filter.endDate!);
    }

    return logs;
  }

  /**
   * Retrieves all audit actions related to a specific staff member or target entity
   */
  static async getLogsForRecord(targetRecordId: string): Promise<AdminAuditEntry[]> {
    return this.getLogs({ targetRecordId });
  }

  /**
   * Action Type Human Labels for UI display
   */
  static getActionLabel(actionType: string): string {
    switch (actionType) {
      case 'staff_create':
        return 'Staff Created';
      case 'staff_edit':
        return 'Staff Profile Updated';
      case 'staff_activate':
        return 'Staff Activated';
      case 'staff_deactivate':
        return 'Staff Deactivated';
      case 'staff_bulk_action':
        return 'Staff Bulk Operation';
      case 'attendance_correction':
        return 'Attendance Corrected';
      case 'salary_update':
        return 'Salary Structure Changed';
      case 'salary_payment_confirmed':
        return 'Salary Payment Confirmed';
      case 'price_update':
        return 'Mobile Price Updated';
      case 'price_create':
        return 'Mobile Price Created';
      case 'purchase_create':
        return 'Purchase Recorded';
      case 'purchase_update':
        return 'Purchase Modified';
      case 'sale_create':
        return 'Sale Recorded';
      case 'sale_update':
        return 'Sale Modified';
      case 'lead_create':
        return 'Lead Created';
      case 'lead_update':
        return 'Lead Updated';
      case 'lead_status_change':
        return 'Lead Status Changed';
      case 'kyc_document_access':
        return 'KYC Document Accessed';
      case 'kyc_document_download':
        return 'KYC Document Downloaded';
      case 'settings_update':
        return 'Store Settings Updated';
      default:
        return actionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  }
}

