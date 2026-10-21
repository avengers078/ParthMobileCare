import { CustomerLead, LeadHistoryItem, LeadStatus, User } from '../types';
import { StorageService } from './storageService';
import { MESSAGE_TEMPLATES, sendWhatsAppMessage } from '../utils/whatsapp';
import { getTodayDateString } from '../utils/format';

export class LeadService {
  /**
   * Fetch all leads or filter by status
   */
  static async getLeads(statusFilter?: LeadStatus): Promise<CustomerLead[]> {
    const leads = await StorageService.getLeads();
    if (statusFilter) {
      return leads.filter(l => l.status === statusFilter);
    }
    return leads;
  }

  /**
   * Create a new Customer Lead
   */
  static async createLead(
    leadData: Omit<CustomerLead, 'id' | 'createdAt' | 'updatedAt' | 'history' | 'status'>,
    currentUser: User,
    initialStatus: LeadStatus = 'new',
    triggerWhatsApp: boolean = true
  ): Promise<CustomerLead> {
    const timestamp = new Date().toISOString();
    const newLead: CustomerLead = {
      ...leadData,
      id: `lead_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      status: initialStatus,
      createdBy: currentUser.id,
      createdByName: currentUser.name,
      createdAt: timestamp,
      updatedAt: timestamp,
      history: [
        {
          timestamp,
          updatedBy: currentUser.name,
          status: initialStatus,
          notes: leadData.remarks || 'Lead captured at Parth Mobile Care',
        },
      ],
    };

    await StorageService.saveLead(newLead);

    // Add In-App Notification
    await StorageService.addNotification({
      title: 'New Customer Lead',
      body: `${newLead.name} (${newLead.interestedBrand} ${newLead.interestedModel}) registered by ${currentUser.name}`,
      type: 'lead',
      relatedId: newLead.id,
    });

    // Automated Customer Communication (WhatsApp) per PDF page 4
    if (triggerWhatsApp && newLead.phone) {
      sendWhatsAppMessage(newLead.phone, MESSAGE_TEMPLATES.LEAD_CREATED).catch(err =>
        console.log('Automated WhatsApp dispatch handled:', err)
      );
    }

    // Schedule Real Follow-up Reminder Notification
    if (newLead.followUpDate) {
      const timeDisplay = newLead.followUpTime ? ` at ${newLead.followUpTime}` : '';
      await StorageService.addNotification({
        title: 'Follow-Up Scheduled ⏰',
        body: `Follow-up call with ${newLead.name} (${newLead.phone}) scheduled for ${newLead.followUpDate}${timeDisplay}.`,
        type: 'follow_up',
        relatedId: newLead.id,
      });
    }

    return newLead;
  }

  /**
   * Update existing lead status, notes, or follow-up schedule
   */
  static async updateLeadStatus(
    leadId: string,
    newStatus: LeadStatus,
    notes: string,
    currentUser: User,
    followUpDate?: string,
    followUpTime?: string
  ): Promise<CustomerLead | null> {
    const leads = await StorageService.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return null;

    const timestamp = new Date().toISOString();
    const historyItem: LeadHistoryItem = {
      timestamp,
      updatedBy: currentUser.name,
      status: newStatus,
      notes: notes || `Status changed to ${newStatus}`,
    };

    const updatedLead: CustomerLead = {
      ...lead,
      status: newStatus,
      followUpDate: followUpDate || lead.followUpDate,
      followUpTime: followUpTime || lead.followUpTime,
      updatedAt: timestamp,
      history: [historyItem, ...(lead.history || [])],
    };

    await StorageService.saveLead(updatedLead);

    if (newStatus === 'purchased') {
      // PDF page 4: "Thank you for shopping with Parth Mobile Care. We hope to serve you again."
      sendWhatsAppMessage(updatedLead.phone, MESSAGE_TEMPLATES.PURCHASE_COMPLETED).catch(
        err => console.log('WhatsApp purchase alert handled:', err)
      );
    }

    return updatedLead;
  }

  /**
   * Update full details of a customer lead (name, phone, brand, model, budget, etc.)
   */
  static async updateLeadDetails(
    leadId: string,
    updatedData: Partial<CustomerLead>,
    currentUser: User
  ): Promise<CustomerLead | null> {
    const leads = await StorageService.getLeads();
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return null;

    const timestamp = new Date().toISOString();
    const historyItem: LeadHistoryItem = {
      timestamp,
      updatedBy: currentUser.name,
      status: (updatedData.status || lead.status) as LeadStatus,
      notes: 'Customer details updated by ' + currentUser.name,
    };

    const updatedLead: CustomerLead = {
      ...lead,
      ...updatedData,
      updatedAt: timestamp,
      history: [historyItem, ...(lead.history || [])],
    };

    await StorageService.saveLead(updatedLead);

    // Schedule Follow-Up Notification if date/time changed
    if (
      updatedData.followUpDate &&
      (updatedData.followUpDate !== lead.followUpDate || updatedData.followUpTime !== lead.followUpTime)
    ) {
      const timeDisplay = updatedLead.followUpTime ? ` at ${updatedLead.followUpTime}` : '';
      await StorageService.addNotification({
        title: 'Follow-Up Rescheduled ⏰',
        body: `Follow-up call with ${updatedLead.name} (${updatedLead.phone}) updated to ${updatedLead.followUpDate}${timeDisplay}.`,
        type: 'follow_up',
        relatedId: updatedLead.id,
      });
    }

    return updatedLead;
  }

  /**
   * Delete customer lead
   */
  static async deleteLead(leadId: string): Promise<void> {
    await StorageService.deleteLead(leadId);
  }

  /**
   * Fetch leads that have follow-ups scheduled for today or earlier
   */
  static async getDueFollowUps(): Promise<CustomerLead[]> {
    const today = getTodayDateString();
    const leads = await StorageService.getLeads();
    return leads.filter(
      l =>
        (l.status === 'follow_up' || l.status === 'new' || l.status === 'interested') &&
        l.followUpDate &&
        l.followUpDate <= today
    );
  }
}

