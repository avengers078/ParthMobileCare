import React, { useEffect, useState, useMemo } from 'react';
import {
  UserCheck,
  Plus,
  Search,
  Filter,
  Phone,
  Calendar,
  Clock,
  MessageCircle,
  Tag,
  DollarSign,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sparkles,
  Camera,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { CloudinaryService } from '../services/cloudinaryService';
import { useToast } from '../context/ToastContext';
import {
  Modal,
  Badge,
  ConfirmDialog,
  EmptyState,
  Button,
  ActionButton,
  Input,
  Select,
  Card,
  ExportDropdown,
  TablePagination,
} from '../components/common';
import { useAuth } from '../context/AuthContext';
import { CustomerLead, LeadStatus, User } from '../types';
import { NavigationParams } from '../utils/notificationRouter';

interface LeadsPageProps {
  initialParams?: NavigationParams | null;
  onClearParams?: () => void;
}

export const LeadsPage: React.FC<LeadsPageProps> = ({ initialParams, onClearParams }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [leads, setLeads] = useState<CustomerLead[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterStaff, setFilterStaff] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmLead, setDeleteConfirmLead] = useState<CustomerLead | null>(null);
  const [selectedLead, setSelectedLead] = useState<CustomerLead | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    alternatePhone: '',
    interestedBrand: 'Vivo',
    interestedModel: '',
    budget: 20000,
    source: 'Walk-in',
    remarks: '',
    status: 'new' as LeadStatus,
    followUpDate: '',
    followUpTime: '',
    assignedTo: '',
  });
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const loadLeads = async () => {
    setLoading(true);
    try {
      const [l, u] = await Promise.all([
        ApiService.getLeads(),
        ApiService.getUsers(),
      ]);
      setLeads(l);
      setUsers(u);
    } catch (err) {
      console.warn('Leads load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    loadLeads();

    // Real-time listener for customer leads
    const unsubLeads = ApiService.subscribeToLeads(
      (liveLeads) => {
        setLeads(liveLeads);
        setLoading(false);
      },
      (err) => console.warn('[LeadsPage] Leads listener fallback:', err)
    );

    // Real-time listener for staff users (for assignment dropdown)
    const unsubUsers = ApiService.subscribeToUsers(
      (liveUsers) => {
        setUsers(liveUsers);
      },
      (err) => console.warn('[LeadsPage] Users listener fallback:', err)
    );

    return () => {
      unsubLeads();
      unsubUsers();
    };
  }, []);

  useEffect(() => {
    if (!initialParams || loading) return;

    if (initialParams.type === 'follow_up' && !initialParams.recordId) {
      setFilterStatus('follow_up');
      onClearParams?.();
      return;
    }

    if (initialParams.recordId) {
      const target = leads.find(l => l.id === initialParams.recordId);
      if (target) {
        handleOpenEdit(target);
        onClearParams?.();
      } else if (leads.length > 0) {
        showError(new Error('Record unavailable'), 'This record is no longer available.');
        onClearParams?.();
      }
    }
  }, [initialParams, leads, loading]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      phone: '',
      alternatePhone: '',
      interestedBrand: 'Vivo',
      interestedModel: '',
      budget: 20000,
      source: 'Walk-in',
      remarks: '',
      status: 'new',
      followUpDate: '',
      followUpTime: '',
      assignedTo: currentUser?.id || '',
    });
    setFormError('');
    setAddModalOpen(true);
  };

  const handleSaveNewLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.phone.trim() || !formData.interestedModel.trim()) {
      setFormError('Customer name, phone number, and interested model are required.');
      return;
    }

    if (formData.phone.replace(/\D/g, '').length < 10) {
      setFormError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setFormSubmitting(true);
    try {
      const newId = `lead_${Date.now()}`;
      const now = new Date().toISOString();
      const assignedUser = users.find(u => u.id === formData.assignedTo);

      const sourcePrefix = formData.source ? `[Source: ${formData.source}] ` : '';
      const cleanRemarks = formData.remarks.replace(/^\[Source:\s*[^\]]+\]\s*/, '').trim();
      const finalRemarks = `${sourcePrefix}${cleanRemarks}`.trim();

      const leadPayload: CustomerLead = {
        id: newId,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        alternatePhone: formData.alternatePhone.trim() || undefined,
        interestedBrand: formData.interestedBrand,
        interestedModel: formData.interestedModel.trim(),
        budget: Number(formData.budget),
        remarks: finalRemarks,
        status: formData.status,
        followUpDate: formData.followUpDate || undefined,
        followUpTime: formData.followUpTime || undefined,
        createdBy: currentUser?.id || 'admin',
        createdByName: currentUser?.name || 'Administrator',
        assignedTo: formData.assignedTo || undefined,
        assignedToName: assignedUser?.name || undefined,
        createdAt: now,
        updatedAt: now,
        history: [
          {
            timestamp: now,
            updatedBy: currentUser?.name || 'Admin',
            status: formData.status,
            notes: finalRemarks || 'Initial inquiry captured.',
          },
        ],
      };

      await ApiService.saveLead(leadPayload);
      showSuccess('New customer lead created successfully.');
      setAddModalOpen(false);
      await loadLeads();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save lead.');
      showError(err, 'Failed to save lead.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleOpenEdit = (lead: CustomerLead) => {
    setSelectedLead(lead);
    const match = lead.remarks?.match(/^\[Source:\s*([^\]]+)\]\s*(.*)$/s);
    const currentSource = match ? match[1] : 'Walk-in';
    const currentCleanRemarks = match ? match[2] : lead.remarks || '';

    setFormData({
      name: lead.name,
      phone: lead.phone,
      alternatePhone: lead.alternatePhone || '',
      interestedBrand: lead.interestedBrand,
      interestedModel: lead.interestedModel,
      budget: lead.budget,
      source: currentSource,
      remarks: currentCleanRemarks,
      status: lead.status,
      followUpDate: lead.followUpDate || '',
      followUpTime: lead.followUpTime || '',
      assignedTo: lead.assignedTo || '',
    });
    setFormError('');
    setEditModalOpen(true);
  };

  const handleUpdateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;

    setFormSubmitting(true);
    try {
      const now = new Date().toISOString();
      const assignedUser = users.find(u => u.id === formData.assignedTo);

      const sourcePrefix = formData.source ? `[Source: ${formData.source}] ` : '';
      const cleanRemarks = formData.remarks.replace(/^\[Source:\s*[^\]]+\]\s*/, '').trim();
      const finalRemarks = `${sourcePrefix}${cleanRemarks}`.trim();

      const updatedHistory = [...(selectedLead.history || [])];
      if (formData.status !== selectedLead.status || finalRemarks !== selectedLead.remarks) {
        updatedHistory.unshift({
          timestamp: now,
          updatedBy: currentUser?.name || 'Admin',
          status: formData.status,
          notes: finalRemarks || `Status updated to ${formData.status}`,
        });
      }

      const updatedLead: CustomerLead = {
        ...selectedLead,
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        alternatePhone: formData.alternatePhone.trim() || undefined,
        interestedBrand: formData.interestedBrand,
        interestedModel: formData.interestedModel.trim(),
        budget: Number(formData.budget),
        remarks: finalRemarks,
        status: formData.status,
        followUpDate: formData.followUpDate || undefined,
        followUpTime: formData.followUpTime || undefined,
        assignedTo: formData.assignedTo || undefined,
        assignedToName: assignedUser?.name || undefined,
        updatedAt: now,
        history: updatedHistory.slice(0, 50),
      };

      await ApiService.saveLead(updatedLead);
      if (formData.assignedTo !== selectedLead.assignedTo) {
        await ApiService.logAdminAction({
          adminId: currentUser?.id || 'admin',
          adminName: currentUser?.name || 'Administrator',
          actionType: 'lead_reassigned',
          targetRecordId: selectedLead.id,
          targetRecordTitle: selectedLead.name,
          details: `Reassigned from ${selectedLead.assignedToName || 'Unassigned'} to ${assignedUser?.name || 'Unassigned'}`,
        });
      }
      showSuccess('Lead details updated successfully.');
      setEditModalOpen(false);
      await loadLeads();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to update lead.');
      showError(err, 'Failed to update lead.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleInlineStatusChange = async (lead: CustomerLead, newStatus: LeadStatus) => {
    try {
      const now = new Date().toISOString();
      const updatedHistory = [
        {
          timestamp: now,
          updatedBy: currentUser?.name || 'Admin',
          status: newStatus,
          notes: `Quick status updated to ${newStatus}`,
        },
        ...(lead.history || []),
      ];

      const updatedLead: CustomerLead = {
        ...lead,
        status: newStatus,
        updatedAt: now,
        history: updatedHistory.slice(0, 50),
      };

      await ApiService.saveLead(updatedLead);
      showSuccess(`Lead status updated to ${newStatus}.`);
      await loadLeads();
    } catch (err: any) {
      showError(err, 'Failed to update lead status.');
    }
  };

  const handleDeleteLead = async () => {
    if (!deleteConfirmLead) return;
    setFormSubmitting(true);
    try {
      await ApiService.deleteLead(deleteConfirmLead.id);
      await ApiService.logAdminAction({
        adminId: currentUser?.id || 'admin',
        adminName: currentUser?.name || 'Administrator',
        actionType: 'lead_deleted',
        targetRecordId: deleteConfirmLead.id,
        targetRecordTitle: deleteConfirmLead.name,
        details: `Deleted lead: ${deleteConfirmLead.interestedModel} (Phone: ${deleteConfirmLead.phone})`,
      });
      showSuccess('Lead removed successfully.');
      setDeleteConfirmLead(null);
      await loadLeads();
    } catch (err: any) {
      showError(err, 'Failed to delete lead.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        l.name?.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.interestedModel?.toLowerCase().includes(q);

      const matchStatus = filterStatus === 'all' || l.status === filterStatus;
      const matchStaff = filterStaff === 'all' || l.assignedTo === filterStaff || l.createdBy === filterStaff;
      const matchSource = filterSource === 'all' || (l.remarks && l.remarks.includes(`[Source: ${filterSource}]`));

      return matchSearch && matchStatus && matchStaff && matchSource;
    });
  }, [leads, search, filterStatus, filterStaff, filterSource]);

  // Paginated records
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Export prepared data
  const exportData = useMemo(() => {
    return filtered.map(l => ({
      Customer_Name: l.name,
      Phone: l.phone,
      Alternate_Phone: l.alternatePhone || '—',
      Brand: l.interestedBrand,
      Model: l.interestedModel,
      Budget: l.budget,
      Status: l.status.toUpperCase(),
      Assigned_Staff: l.assignedToName || 'Unassigned',
      Follow_Up_Date: l.followUpDate || '—',
      Follow_Up_Time: l.followUpTime || '—',
      Created_By: l.createdByName || '—',
      Created_At: l.createdAt,
      Remarks: l.remarks || '',
    }));
  }, [filtered]);

  const getStatusBadgeVariant = (st: LeadStatus) => {
    switch (st) {
      case 'new':
        return 'info';
      case 'follow_up':
        return 'warning';
      case 'interested':
        return 'primary';
      case 'purchased':
        return 'success';
      case 'lost':
        return 'danger';
      default:
        return 'neutral';
    }
  };

  const statusCounts = useMemo(() => {
    return {
      all: leads.length,
      new: leads.filter(l => l.status === 'new').length,
      follow_up: leads.filter(l => l.status === 'follow_up').length,
      interested: leads.filter(l => l.status === 'interested').length,
      purchased: leads.filter(l => l.status === 'purchased').length,
      lost: leads.filter(l => l.status === 'lost').length,
    };
  }, [leads]);

  return (
    <div className="space-y-6">
      {/* Top Controls Card */}
      <Card noPadding>
        {/* Status Filter Tabs */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2 overflow-x-auto scrollbar-none min-w-0 max-w-full">
          {[
            { id: 'all', label: 'All Inquiries', count: statusCounts.all },
            { id: 'new', label: 'New', count: statusCounts.new },
            { id: 'follow_up', label: 'Follow-ups', count: statusCounts.follow_up },
            { id: 'interested', label: 'High Interest', count: statusCounts.interested },
            { id: 'purchased', label: 'Purchased', count: statusCounts.purchased },
            { id: 'lost', label: 'Lost', count: statusCounts.lost },
          ].map(tab => {
            const active = filterStatus === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterStatus(tab.id);
                  setCurrentPage(1);
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-all ${
                  active
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Detailed Filter Bar */}
        <div className="p-4 sm:p-5 space-y-3 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0">
            {/* Search Input */}
            <div className="w-full sm:max-w-md min-w-0 flex-1">
              <Input
                placeholder="Search name, phone, model..."
                icon={Search}
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                onClear={() => setSearch('')}
              />
            </div>

            {/* Action Cluster */}
            <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
              <ExportDropdown
                data={exportData}
                filename="ParthMobileCare_Leads"
                sheetName="Leads"
                disabled={filtered.length === 0}
              />

              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={handleOpenAdd}
              >
                Add New Lead
              </Button>

              <Button
                variant="outline"
                size="sm"
                icon={RotateCcw}
                onClick={loadLeads}
                loading={loading}
                title="Refresh Leads"
                className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
              />
            </div>
          </div>

          {/* Secondary Filters */}
          <div className="flex flex-wrap items-center gap-2.5 pt-0.5">
            <div className="w-full sm:w-44">
              <Select
                value={filterSource}
                onChange={e => {
                  setFilterSource(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Sources</option>
                <option value="Walk-in">Walk-in</option>
                <option value="Phone Inquiry">Phone Call</option>
                <option value="WhatsApp">WhatsApp</option>
                <option value="Social Media">Social Media</option>
                <option value="Referral">Referral</option>
              </Select>
            </div>

            <div className="w-full sm:w-48">
              <Select
                value={filterStaff}
                onChange={e => {
                  setFilterStaff(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Assignees</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        </div>

        {/* Leads Table */}
        {filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Customer Leads Found"
              description="No inquiries match your active search terms or status filters."
              actionText="Add First Lead"
              onAction={handleOpenAdd}
            />
          </div>
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs min-w-[880px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800 select-none">
                <tr>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Interested Model</th>
                  <th className="py-3 px-4">Budget</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Follow-up</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-800/95 z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedLeads.map(lead => {
                  const sMatch = lead.remarks?.match(/^\[Source:\s*([^\]]+)\]\s*(.*)$/s);
                  const sName = sMatch ? sMatch[1] : null;
                  const cleanNote = sMatch ? sMatch[2] : lead.remarks;
                  const isOverdue =
                    lead.followUpDate &&
                    lead.followUpDate < todayStr &&
                    lead.status !== 'purchased' &&
                    lead.status !== 'lost';

                  return (
                    <tr
                      key={lead.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">
                          {lead.name}
                        </p>
                        <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mt-0.5">
                          <Phone className="w-3 h-3" />
                          <span>{lead.phone}</span>
                          {((lead.inquiryPhotos && lead.inquiryPhotos.length > 0) || (lead.repairPhotos && lead.repairPhotos.length > 0)) && (
                            <span className="inline-flex items-center gap-1 text-[10px] text-brand-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded font-bold ml-1">
                              <Camera className="w-2.5 h-2.5" />
                              {((lead.inquiryPhotos || lead.repairPhotos) || []).length}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="flex items-center space-x-1.5 flex-wrap">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {lead.interestedBrand} {lead.interestedModel}
                          </span>
                          {sName && (
                            <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-950/60 text-brand-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900 rounded text-[10px] font-bold">
                              {sName}
                            </span>
                          )}
                        </div>
                        {cleanNote && (
                          <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                            {cleanNote}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                        ₹{lead.budget.toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4">
                        {/* Quick inline status switcher */}
                        <select
                          value={lead.status}
                          onChange={e => handleInlineStatusChange(lead, e.target.value as LeadStatus)}
                          className="text-[11px] font-bold rounded-lg px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="new">NEW</option>
                          <option value="follow_up">FOLLOW-UP</option>
                          <option value="interested">INTERESTED</option>
                          <option value="purchased">PURCHASED</option>
                          <option value="lost">LOST</option>
                        </select>
                      </td>

                      <td className="py-3.5 px-4">
                        {lead.followUpDate ? (
                          <div>
                            <div className="flex items-center space-x-1 text-slate-700 dark:text-slate-300 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>{lead.followUpDate}</span>
                            </div>
                            {isOverdue && (
                              <span className="inline-block mt-0.5 text-[10px] font-bold text-rose-600">
                                Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                        {lead.assignedToName || lead.createdByName || 'Unassigned'}
                      </td>

                      <td className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                        <div className="inline-flex items-center justify-end gap-1">
                          {/* Direct sanitized WhatsApp link */}
                          <ActionButton
                            as="a"
                            href={`https://wa.me/91${lead.phone.replace(/\D/g, '').slice(-10)}?text=${encodeURIComponent(
                              `Hello ${lead.name}, greetings from Parth Mobile Care regarding your inquiry for ${lead.interestedBrand} ${lead.interestedModel}.`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            icon={MessageCircle}
                            label="Chat on WhatsApp"
                            variant="whatsapp"
                          />
                          <ActionButton
                            icon={Edit2}
                            label="Edit Lead Details"
                            onClick={() => handleOpenEdit(lead)}
                            variant="ghost"
                          />
                          <ActionButton
                            icon={Trash2}
                            label="Delete Lead"
                            onClick={() => setDeleteConfirmLead(lead)}
                            variant="danger"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filtered.length > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalItems={filtered.length}
            pageSize={pageSize}
            onPageChange={page => setCurrentPage(page)}
            onPageSizeChange={size => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </Card>

      {/* Add Lead Modal */}
      <Modal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        title="Create Customer Lead"
        subtitle="Capture new customer inquiry or store walk-in interest"
      >
        <form onSubmit={handleSaveNewLead} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Customer Name"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Anand Shah"
            />
            <Input
              label="Mobile Number"
              required
              maxLength={10}
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
              placeholder="10-digit mobile number"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Brand"
              value={formData.interestedBrand}
              onChange={e => setFormData({ ...formData, interestedBrand: e.target.value })}
            >
              {['Vivo', 'Oppo', 'Samsung', 'Apple', 'OnePlus', 'Xiaomi', 'Realme', 'Motorola', 'Other'].map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>

            <div className="sm:col-span-2">
              <Input
                label="Interested Model"
                required
                value={formData.interestedModel}
                onChange={e => setFormData({ ...formData, interestedModel: e.target.value })}
                placeholder="e.g. V50 Pro 8GB/256GB"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Budget (₹)"
              type="number"
              value={formData.budget}
              onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })}
            />

            <Select
              label="Lead Source"
              value={formData.source}
              onChange={e => setFormData({ ...formData, source: e.target.value })}
            >
              <option value="Walk-in">Walk-in</option>
              <option value="Phone Inquiry">Phone Call</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Social Media">Social Media</option>
              <option value="Referral">Referral</option>
              <option value="Other">Other</option>
            </Select>

            <Select
              label="Assigned Staff"
              value={formData.assignedTo}
              onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
            >
              <option value="">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Follow-up Date"
              type="date"
              value={formData.followUpDate}
              onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
            />
            <Input
              label="Follow-up Time"
              value={formData.followUpTime}
              onChange={e => setFormData({ ...formData, followUpTime: e.target.value })}
              placeholder="e.g. 11:30 AM"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Customer Remarks / Specific Requirements
            </label>
            <textarea
              rows={2}
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              placeholder="e.g. Asking for exchange discount on old device or specific color preference..."
              className="w-full rounded-xl border border-slate-200 dark:border-[#24344D] bg-white dark:bg-[#0D1729] p-3 text-xs text-slate-900 dark:text-[#E8EEF8] placeholder-slate-400 dark:placeholder-[#71839D] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-[#194D9C]"
            />
          </div>

          {/* Repair / Inquiry Photos Gallery */}
          {selectedLead && ((selectedLead.inquiryPhotos && selectedLead.inquiryPhotos.length > 0) || (selectedLead.repairPhotos && selectedLead.repairPhotos.length > 0)) && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                <Camera className="w-3.5 h-3.5 text-brand-600" />
                Device Damage / Repair Photos ({((selectedLead.inquiryPhotos || selectedLead.repairPhotos) || []).length})
              </span>
              <div className="grid grid-cols-4 gap-2">
                {((selectedLead.inquiryPhotos || selectedLead.repairPhotos) || []).map((imgUrl, idx) => (
                  <a
                    key={idx}
                    href={imgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:opacity-90"
                  >
                    <img
                      src={CloudinaryService.getDeviceThumbnailUrl(imgUrl)}
                      alt={`Inquiry photo #${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                      View
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-[#24344D]">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setAddModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={formSubmitting}
            >
              Save Customer Lead
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Lead Modal */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Update Customer Lead"
        subtitle={selectedLead && <span>Inquiry ID: {selectedLead.id}</span>}
      >
        <form onSubmit={handleUpdateLead} className="space-y-4">
          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Customer Name"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
            />
            <Input
              label="Mobile Number"
              required
              maxLength={10}
              value={formData.phone}
              onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Brand"
              value={formData.interestedBrand}
              onChange={e => setFormData({ ...formData, interestedBrand: e.target.value })}
            >
              {['Vivo', 'Oppo', 'Samsung', 'Apple', 'OnePlus', 'Xiaomi', 'Realme', 'Motorola', 'Other'].map(b => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </Select>

            <div className="sm:col-span-2">
              <Input
                label="Interested Model"
                required
                value={formData.interestedModel}
                onChange={e => setFormData({ ...formData, interestedModel: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Budget (₹)"
              type="number"
              value={formData.budget}
              onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })}
            />

            <Select
              label="Lead Status"
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as LeadStatus })}
            >
              <option value="new">New Inquiry</option>
              <option value="follow_up">Follow-up</option>
              <option value="interested">Interested</option>
              <option value="purchased">Purchased</option>
              <option value="lost">Lost</option>
            </Select>

            <Select
              label="Assigned Staff"
              value={formData.assignedTo}
              onChange={e => setFormData({ ...formData, assignedTo: e.target.value })}
            >
              <option value="">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Follow-up Date"
              type="date"
              value={formData.followUpDate}
              onChange={e => setFormData({ ...formData, followUpDate: e.target.value })}
            />
            <Input
              label="Follow-up Time"
              value={formData.followUpTime}
              onChange={e => setFormData({ ...formData, followUpTime: e.target.value })}
              placeholder="e.g. 02:00 PM"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Update Notes / Conversation Summary
            </label>
            <textarea
              rows={2}
              value={formData.remarks}
              onChange={e => setFormData({ ...formData, remarks: e.target.value })}
              className="w-full rounded-xl border border-slate-200 dark:border-[#24344D] bg-white dark:bg-[#0D1729] p-3 text-xs text-slate-900 dark:text-[#E8EEF8] placeholder-slate-400 dark:placeholder-[#71839D] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-[#194D9C]"
            />
          </div>

          {/* Repair / Inquiry Photos Gallery */}
          {selectedLead && ((selectedLead.inquiryPhotos && selectedLead.inquiryPhotos.length > 0) || (selectedLead.repairPhotos && selectedLead.repairPhotos.length > 0)) && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mb-2">
                <Camera className="w-3.5 h-3.5 text-brand-600" />
                Device Damage / Repair Photos ({((selectedLead.inquiryPhotos || selectedLead.repairPhotos) || []).length})
              </span>
              <div className="grid grid-cols-4 gap-2">
                {((selectedLead.inquiryPhotos || selectedLead.repairPhotos) || []).map((imgUrl, idx) => (
                  <a
                    key={idx}
                    href={imgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 hover:opacity-90"
                  >
                    <img
                      src={CloudinaryService.getDeviceThumbnailUrl(imgUrl)}
                      alt={`Inquiry photo #${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                      View
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-[#24344D]">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setEditModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              loading={formSubmitting}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Lead Confirm Dialog */}
      <ConfirmDialog
        isOpen={Boolean(deleteConfirmLead)}
        onClose={() => setDeleteConfirmLead(null)}
        onConfirm={handleDeleteLead}
        title="Delete Customer Lead"
        message={
          deleteConfirmLead && (
            <span>
              Are you sure you want to permanently delete lead for{' '}
              <strong className="text-slate-900 dark:text-white">{deleteConfirmLead.name}</strong> (
              {deleteConfirmLead.interestedBrand} {deleteConfirmLead.interestedModel})? This action will be logged in the security audit trail.
            </span>
          )
        }
        confirmText="Delete Lead"
        isDestructive
        loading={formSubmitting}
      />
    </div>
  );
};
