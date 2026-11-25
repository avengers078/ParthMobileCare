import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Mail,
  Phone,
  Shield,
  KeyRound,
  CheckCircle2,
  XCircle,
  Eye,
  Edit2,
  Power,
  AlertCircle,
  Clock,
  Target,
  DollarSign,
  Smartphone,
  RefreshCw,
  RotateCcw,
  Check,
  X,
  ScanFace,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { CloudinaryService } from '../services/cloudinaryService';
import { useAuth } from '../context/AuthContext';
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
import { User, UserRole, StaffInvitation, DeviceChangeRequest, AttendanceRecord, CustomerLead, SalarySlip } from '../types';
import { NavigationParams } from '../utils/notificationRouter';

interface StaffPageProps {
  initialParams?: NavigationParams | null;
  onClearParams?: () => void;
}

export const StaffPage: React.FC<StaffPageProps> = ({ initialParams, onClearParams }) => {
  const { currentUser, sendPasswordReset } = useAuth();
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [invitations, setInvitations] = useState<StaffInvitation[]>([]);
  const [deviceRequests, setDeviceRequests] = useState<DeviceChangeRequest[]>([]);
  const [activeViewTab, setActiveViewTab] = useState<'directory' | 'registrations' | 'faces' | 'invitations' | 'devices'>('directory');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'staff'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailTab, setDetailTab] = useState<'profile' | 'attendance' | 'leads' | 'payroll'>('profile');
  const [staffAttendance, setStaffAttendance] = useState<AttendanceRecord[]>([]);
  const [staffLeads, setStaffLeads] = useState<CustomerLead[]>([]);
  const [staffSlips, setStaffSlips] = useState<SalarySlip[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusDialogStaff, setStatusDialogStaff] = useState<User | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<User | null>(null);
  const [generatedInvitation, setGeneratedInvitation] = useState<StaffInvitation | null>(null);
  const [resetDeviceStaff, setResetDeviceStaff] = useState<User | null>(null);
  const [revokeConfirmToken, setRevokeConfirmToken] = useState<string | null>(null);
  const [approveRegStaff, setApproveRegStaff] = useState<User | null>(null);
  const [viewingPhotoStaff, setViewingPhotoStaff] = useState<User | null>(null);
  const [regSalary, setRegSalary] = useState(20000);
  const [regTarget, setRegTarget] = useState(200000);
  const [rejectTarget, setRejectTarget] = useState<{
    type: 'registration' | 'change' | 'face' | 'staff_registration';
    staffId: string;
    staffName: string;
    requestId?: string;
  } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'staff' as UserRole,
    designation: '',
    basicSalary: 20000,
    monthlyTarget: 200000,
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const loadStaff = async (forceRefresh = false) => {
    if (users.length === 0) {
      setLoading(true);
    }
    try {
      const [u, inv, dcr] = await Promise.all([
        ApiService.getUsers(forceRefresh).catch(() => []),
        ApiService.getStaffInvitations(forceRefresh).catch(() => []),
        ApiService.getDeviceChangeRequests(forceRefresh).catch(() => []),
      ]);
      setUsers(u);
      setInvitations(inv);
      setDeviceRequests(dcr);
    } catch (err) {
      console.warn('Error loading staff & invitations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveDeviceRegistration = async (staff: User) => {
    if (!currentUser) return;
    try {
      setSubmitting(true);
      await ApiService.approveDeviceRegistration(staff.id, { id: currentUser.id, name: currentUser.name });
      showSuccess(`Approved device for ${staff.name}. Attendance is now enabled.`);
      await loadStaff();
    } catch (e: any) {
      showError(e, 'Failed to approve device.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRejectRegistration = (staff: User) => {
    setRejectReason('');
    setRejectTarget({
      type: 'registration',
      staffId: staff.id,
      staffName: staff.name,
    });
  };

  const handleOpenRejectChange = (req: DeviceChangeRequest) => {
    setRejectReason('');
    setRejectTarget({
      type: 'change',
      staffId: req.userId,
      staffName: req.userName,
      requestId: req.id,
    });
  };

  const handleOpenApproveRegistration = (staff: User) => {
    setApproveRegStaff(staff);
    setRegSalary(staff.basicSalary || 20000);
    setRegTarget(staff.monthlyTarget || 200000);
  };

  const handleConfirmApproveRegistration = async () => {
    if (!currentUser || !approveRegStaff) return;
    try {
      setSubmitting(true);
      await ApiService.approveStaffRegistration(
        approveRegStaff.id,
        {
          basicSalary: Number(regSalary),
          monthlyTarget: Number(regTarget),
        },
        {
          id: currentUser.id,
          name: currentUser.name,
        }
      );
      showSuccess(`Approved staff account for ${approveRegStaff.name}. Account is now active.`);
      setApproveRegStaff(null);
      await loadStaff();
    } catch (e: any) {
      showError(e, 'Failed to approve staff registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenRejectStaffRegistration = (staff: User) => {
    setRejectReason('');
    setRejectTarget({
      type: 'staff_registration',
      staffId: staff.id,
      staffName: staff.name,
    });
  };

  const handleConfirmReject = async () => {
    if (!currentUser || !rejectTarget) return;
    if (!rejectReason.trim()) {
      showError('Please specify a rejection reason.');
      return;
    }
    try {
      setSubmitting(true);
      if (rejectTarget.type === 'registration') {
        await ApiService.rejectDeviceRegistration(rejectTarget.staffId, rejectReason, {
          id: currentUser.id,
          name: currentUser.name,
        });
        showSuccess(`Rejected device registration for ${rejectTarget.staffName}.`);
      } else if (rejectTarget.type === 'change' && rejectTarget.requestId) {
        await ApiService.rejectDeviceChangeRequest(rejectTarget.requestId, rejectReason, {
          id: currentUser.id,
          name: currentUser.name,
        });
        showSuccess(`Rejected device change request for ${rejectTarget.staffName}.`);
      } else if (rejectTarget.type === 'face') {
        await ApiService.rejectFaceEnrollment(rejectTarget.staffId, rejectReason, {
          id: currentUser.id,
          name: currentUser.name,
        });
        showSuccess(`Rejected biometric face enrollment for ${rejectTarget.staffName}.`);
      } else if (rejectTarget.type === 'staff_registration') {
        await ApiService.rejectStaffRegistration(rejectTarget.staffId, rejectReason, {
          id: currentUser.id,
          name: currentUser.name,
        });
        showSuccess(`Rejected staff registration for ${rejectTarget.staffName}.`);
      }
      setRejectTarget(null);
      await loadStaff();
    } catch (e: any) {
      showError(e, 'Failed to process rejection.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveFace = async (staff: User) => {
    if (!currentUser) return;
    try {
      setSubmitting(true);
      await ApiService.approveFaceEnrollment(staff.id, {
        id: currentUser.id,
        name: currentUser.name,
      });
      showSuccess(`Approved biometric face enrollment for ${staff.name}. Attendance verification is active.`);
      await loadStaff();
      if (selectedStaff?.id === staff.id) {
        setSelectedStaff(prev => prev ? { ...prev, faceEnrollmentStatus: 'approved', hasFaceRegistered: true } : null);
      }
    } catch (e: any) {
      showError(e, 'Failed to approve face enrollment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDetail = async (staff: User) => {
    setSelectedStaff(staff);
    setDetailTab('profile');
    setDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const [allAtt, allLeads, allSlips] = await Promise.all([
        ApiService.getAttendanceRecords(200).catch(() => []),
        ApiService.getLeads().catch(() => []),
        ApiService.getSalarySlips().catch(() => []),
      ]);
      setStaffAttendance(allAtt.filter(a => a.userId === staff.id));
      setStaffLeads(allLeads.filter(l => l.assignedTo === staff.id || l.createdBy === staff.id));
      setStaffSlips(allSlips.filter(s => s.staffId === staff.id));
    } catch (e) {
      console.warn('Could not load staff history:', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApproveDeviceChange = async (req: DeviceChangeRequest) => {
    if (!currentUser) return;
    try {
      setSubmitting(true);
      await ApiService.approveDeviceChangeRequest(req.id, req, {
        id: currentUser.id,
        name: currentUser.name,
      });
      showSuccess(`Approved replacement device for ${req.userName}. Attendance is now active on ${req.newDeviceModel}.`);
      await loadStaff();
    } catch (e: any) {
      showError(e, 'Failed to approve device replacement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmResetDevice = async () => {
    if (!currentUser || !resetDeviceStaff) return;
    try {
      setSubmitting(true);
      await ApiService.resetStaffDeviceBinding(resetDeviceStaff.id, {
        id: currentUser.id,
        name: currentUser.name,
      });
      showSuccess(`Reset device binding for ${resetDeviceStaff.name}. They must register a new device on next login.`);
      setResetDeviceStaff(null);
      if (selectedStaff?.id === resetDeviceStaff.id) {
        setSelectedStaff(null);
        setDetailModalOpen(false);
      }
      await loadStaff();
    } catch (e: any) {
      showError(e, 'Failed to reset device binding.');
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  useEffect(() => {
    if (!initialParams || loading) return;

    const subTab = initialParams.subTab || initialParams.type;

    if (subTab === 'registrations' || initialParams.type === 'staff_registration') {
      setActiveViewTab('registrations');
      if (initialParams.staffId) {
        const match = users.find(u => u.id === initialParams.staffId);
        if (match) {
          setSearch(match.name || match.email || initialParams.staffId);
        } else if (users.length > 0) {
          showError(new Error('Record unavailable'), 'This record is no longer available.');
        }
      }
      onClearParams?.();
    } else if (subTab === 'devices' || initialParams.type === 'device_binding') {
      setActiveViewTab('devices');
      if (initialParams.requestId) {
        const match = deviceRequests.find(r => r.id === initialParams.requestId);
        if (match) {
          setSearch(match.userName || initialParams.requestId);
        }
      } else if (initialParams.staffId) {
        setSearch(initialParams.staffId);
      }
      onClearParams?.();
    } else if (subTab === 'faces' || initialParams.type === 'face_enrollment') {
      setActiveViewTab('faces');
      if (initialParams.staffId) {
        const match = users.find(u => u.id === initialParams.staffId);
        if (match) {
          setSearch(match.name || match.email || initialParams.staffId);
        }
      }
      onClearParams?.();
    } else if (initialParams.staffId) {
      setActiveViewTab('directory');
      const target = users.find(u => u.id === initialParams.staffId);
      if (target) {
        handleOpenDetail(target);
      } else if (users.length > 0) {
        showError(new Error('Record unavailable'), 'This record is no longer available.');
      }
      onClearParams?.();
    }
  }, [initialParams, users, deviceRequests, loading]);

  const handleOpenAdd = () => {
    setFormData({
      name: '',
      email: '',
      phone: '',
      role: 'staff',
      designation: 'Sales Executive',
      basicSalary: 20000,
      monthlyTarget: 200000,
    });
    setErrorMsg('');
    setSuccessMsg('');
    setAddModalOpen(true);
  };

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setErrorMsg('Full name, email, and 10-digit mobile number are required.');
      return;
    }

    setSubmitting(true);
    try {
      const inv = await ApiService.createStaffInvitation(
        {
          name: formData.name.trim(),
          email: formData.email.trim(),
          phone: formData.phone.trim(),
          role: 'staff',
          designation: formData.designation.trim(),
          basicSalary: Number(formData.basicSalary),
          monthlyTarget: Number(formData.monthlyTarget),
        },
        {
          id: currentUser?.id || 'admin',
          name: currentUser?.name || 'Administrator',
        }
      );
      setGeneratedInvitation(inv);
      showSuccess(`Secure invitation generated for ${inv.name}. Send token or link to staff.`);
      setAddModalOpen(false);
      await loadStaff();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to create staff invitation.');
      showError(err, 'Failed to create staff invitation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (staff: User) => {
    setSelectedStaff(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      phone: staff.phone,
      role: staff.role,
      designation: staff.designation,
      basicSalary: staff.basicSalary || 20000,
      monthlyTarget: staff.monthlyTarget || 200000,
    });
    setErrorMsg('');
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;
    setErrorMsg('');

    setSubmitting(true);
    try {
      await ApiService.saveUser(
        {
          ...selectedStaff,
          name: formData.name.trim(),
          phone: formData.phone.trim(),
          role: formData.role,
          designation: formData.designation.trim(),
          basicSalary: Number(formData.basicSalary),
          monthlyTarget: Number(formData.monthlyTarget),
        },
        {
          id: currentUser?.id || 'admin',
          name: currentUser?.name || 'Administrator',
        }
      );
      showSuccess(`Updated profile for ${formData.name.trim()}.`);
      setEditModalOpen(false);
      await loadStaff();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to update profile.');
      showError(err, 'Failed to update profile.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendInvite = async (staff: User) => {
    try {
      await sendPasswordReset(staff.email);
      showSuccess(`Password reset & setup email dispatched to ${staff.name} (${staff.email}).`);
    } catch (err: any) {
      showError(err, 'Could not send password reset email.');
    }
  };

  const handleRevokeInvitation = async (token: string) => {
    try {
      await ApiService.revokeStaffInvitation(token, {
        id: currentUser?.id || 'admin',
        name: currentUser?.name || 'Administrator',
      });
      showSuccess(`Invitation ${token} has been revoked.`);
      await loadStaff();
    } catch (err: any) {
      showError(err, 'Failed to revoke invitation.');
    } finally {
      setRevokeConfirmToken(null);
    }
  };

  const handleToggleStatus = async () => {
    if (!statusDialogStaff) return;
    setSubmitting(true);
    const newStatus = statusDialogStaff.isActive === false;

    try {
      const res = await ApiService.setStaffAccountStatus(statusDialogStaff.id, newStatus, {
        id: currentUser?.id || 'admin',
        name: currentUser?.name || 'Administrator',
      });
      setStatusDialogStaff(null);
      await loadStaff();
      showSuccess(res?.message || (newStatus ? `Reactivated account for ${statusDialogStaff.name}.` : `Deactivated account for ${statusDialogStaff.name}.`));
    } catch (err: any) {
      showError(err, 'Failed to change account status.');
    } finally {
      setSubmitting(false);
    }
  };

  const isFacePending = (u: User) =>
    u.faceEnrollmentStatus === 'pending_approval' ||
    u.faceEnrollmentStatus === 'pending_review' ||
    u.faceEnrollmentStatus === 'pending' ||
    u.faceEnrollmentStatus === 'pending_recovery' ||
    (Boolean(u.hasFaceRegistered) && !u.faceApprovedAt && u.faceEnrollmentStatus !== 'approved' && u.faceEnrollmentStatus !== 'rejected');

  const pendingFacesCount = users.filter(isFacePending).length;

  const filtered = users.filter(u => {
    const q = search.toLowerCase().trim();
    const matchSearch =
      !q ||
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.designation?.toLowerCase().includes(q) ||
      u.id?.toLowerCase().includes(q);

    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && u.isActive !== false) ||
      (filterStatus === 'inactive' && u.isActive === false);

    return matchSearch && matchRole && matchStatus;
  });

  const activeStaffList = filtered.filter(u => u.registrationStatus !== 'pending');

  const paginatedStaffList = activeStaffList.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const staffExportData = activeStaffList.map(u => ({
    Staff_Name: u.name,
    Email: u.email,
    Phone: u.phone,
    Role: u.role,
    Designation: u.designation || 'Sales Executive',
    Basic_Salary: u.basicSalary || 20000,
    Monthly_Target: u.monthlyTarget || 200000,
    Status: u.isActive !== false ? 'ACTIVE' : 'DEACTIVATED',
    Device_Model: u.deviceModel || '—',
    Device_ID: u.deviceId || '—',
    Device_Binding: u.deviceBindingStatus || '—',
    Face_Enrollment: u.faceEnrollmentStatus || (u.hasFaceRegistered ? 'approved' : 'unregistered'),
    Joined_Date: u.joinedDate || '—',
  }));

  return (
    <div className="space-y-6 min-w-0">
      {/* Header and Controls */}
      <div className="bg-white dark:bg-[#0F192C] p-4 sm:p-5 rounded-2xl border border-slate-200/80 dark:border-[#24344D] shadow-sm space-y-4 min-w-0">
        {/* Row 1: View Sub-Tabs (Scrollable Track) */}
        <div className="flex bg-slate-100 dark:bg-[#0D1729] p-1 rounded-xl border border-transparent dark:border-[#24344D] overflow-x-auto scrollbar-none max-w-full min-w-0">
          <button
            onClick={() => setActiveViewTab('directory')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
              activeViewTab === 'directory'
                ? 'bg-white dark:bg-[#194D9C] text-brand-700 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-[#E8EEF8]'
            }`}
          >
            Active Staff ({users.filter(u => u.registrationStatus !== 'pending').length})
          </button>
          <button
            onClick={() => setActiveViewTab('registrations')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
              activeViewTab === 'registrations'
                ? 'bg-white dark:bg-[#194D9C] text-brand-700 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-[#E8EEF8]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Registration Requests</span>
            {users.filter(u => u.registrationStatus === 'pending').length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                {users.filter(u => u.registrationStatus === 'pending').length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveViewTab('faces')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
              activeViewTab === 'faces'
                ? 'bg-white dark:bg-[#194D9C] text-brand-700 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-[#E8EEF8]'
            }`}
          >
            <ScanFace className="w-3.5 h-3.5" />
            <span>Face Enrollments</span>
            {pendingFacesCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                {pendingFacesCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveViewTab('invitations')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap shrink-0 ${
              activeViewTab === 'invitations'
                ? 'bg-white dark:bg-[#194D9C] text-brand-700 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-[#E8EEF8]'
            }`}
          >
            Pending Invitations ({invitations.filter(i => i.status === 'pending').length})
          </button>
          <button
            onClick={() => setActiveViewTab('devices')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 whitespace-nowrap shrink-0 ${
              activeViewTab === 'devices'
                ? 'bg-white dark:bg-[#194D9C] text-brand-700 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-[#94A3B8] dark:hover:text-[#E8EEF8]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Device Binding</span>
            {deviceRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                {deviceRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {/* Row 2: Search, Filters, Export, and Primary Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-[#24344D]/60 min-w-0">
          {(activeViewTab === 'directory' || activeViewTab === 'faces') ? (
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
              {/* Search */}
              <div className="w-full sm:w-60 min-w-0">
                <Input
                  placeholder={activeViewTab === 'faces' ? 'Search face profiles...' : 'Search staff...'}
                  icon={Search}
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onClear={() => setSearch('')}
                />
              </div>

              {/* Status Filter */}
              {activeViewTab === 'directory' && (
                <div className="w-full sm:w-36 min-w-0">
                  <Select
                    value={filterStatus}
                    onChange={e => setFilterStatus(e.target.value as any)}
                    options={[
                      { value: 'all', label: 'All Statuses' },
                      { value: 'active', label: 'Active Only' },
                      { value: 'inactive', label: 'Deactivated' },
                    ]}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start sm:self-auto">
            {activeViewTab === 'directory' && (
              <ExportDropdown
                data={staffExportData}
                filename="ParthMobileCare_Staff_Directory"
                sheetName="Staff"
                disabled={activeStaffList.length === 0}
              />
            )}

            <Button
              variant="primary"
              size="sm"
              icon={UserPlus}
              onClick={handleOpenAdd}
            >
              Invite Staff Member
            </Button>
          </div>
        </div>
      </div>

      {activeViewTab === 'registrations' ? (
        /* Registration Requests Table */
        <div className="bg-white dark:bg-[#0F192C] rounded-2xl border border-slate-200 dark:border-[#24344D] shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-[#24344D] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-500" />
                <span>Pending Staff Registration Requests</span>
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Staff members who submitted their profile, verified their email, and completed on-device biometric enrollment.
              </p>
            </div>
          </div>

          {users.filter(u => u.registrationStatus === 'pending').length === 0 ? (
            <EmptyState
              title="No Pending Registration Requests"
              description="New staff members can register directly via the Parth Mobile Care mobile app."
              icon={Users}
            />
          ) : (
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Designation</th>
                    <th className="py-3 px-4">Email Status</th>
                    <th className="py-3 px-4">Face Biometrics</th>
                    <th className="py-3 px-4">Bound Device</th>
                    <th className="py-3 px-4">Submitted At</th>
                    <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-800/90 z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.filter(u => u.registrationStatus === 'pending').map(applicant => (
                    <tr key={applicant.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          {applicant.avatarUrl ? (
                            <img
                              src={applicant.avatarUrl}
                              alt={applicant.name}
                              className="w-11 h-11 rounded-full object-cover border-2 border-brand-500 shadow-sm cursor-pointer hover:scale-105 transition-transform shrink-0"
                              onClick={() => setViewingPhotoStaff(applicant)}
                              title="Click to inspect face photo"
                            />
                          ) : (
                            <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">
                              {applicant.name.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                              <span>{applicant.name}</span>
                              {applicant.avatarUrl && (
                                <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-semibold px-1.5 py-0.5 rounded">
                                  Face Photo
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400">{applicant.email} • {applicant.phone}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                        {applicant.designation || 'Staff'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={applicant.emailVerified ? 'success' : 'warning'}>
                          {applicant.emailVerified ? 'Verified' : 'Unverified'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={applicant.faceEnrollmentStatus === 'approved' ? 'success' : 'warning'}>
                          {applicant.faceEnrollmentStatus === 'approved' ? 'Approved' : 'Pending Review'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        <div>{applicant.deviceModel || 'Mobile Device'}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {applicant.deviceId ? `${applicant.deviceId.substring(0, 16)}...` : '—'}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {applicant.createdAt ? new Date(applicant.createdAt).toLocaleString() : applicant.joinedDate || '—'}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                        <div className="inline-flex items-center gap-1.5 justify-end">
                          <Button
                            variant="success"
                            size="xs"
                            onClick={() => handleOpenApproveRegistration(applicant)}
                            disabled={submitting}
                          >
                            Approve
                          </Button>
                          <Button
                            variant="danger"
                            size="xs"
                            onClick={() => handleOpenRejectStaffRegistration(applicant)}
                            disabled={submitting}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeViewTab === 'faces' ? (
        /* Biometric Face Enrollment Approval & Management View */
        <div className="space-y-6">
          {/* Section 1: Pending Biometric Face Enrollment Requests */}
          <div className="bg-white dark:bg-[#0F192C] rounded-2xl border border-slate-200 dark:border-[#24344D] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-[#24344D] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#E8EEF8] flex items-center space-x-2">
                  <ScanFace className="w-4 h-4 text-amber-500" />
                  <span>Pending Biometric Face Enrollment Requests</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
                  Staff members awaiting administrator biometric review. Review staff name, email, UID, and bound phone before approving.
                </p>
              </div>
              <button
                onClick={() => loadStaff(true)}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-[#17243A] hover:bg-slate-200 dark:hover:bg-[#1C2A42] text-slate-700 dark:text-[#E8EEF8] rounded-lg flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {users.filter(isFacePending).length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="font-semibold text-slate-600 dark:text-[#E8EEF8]">No Pending Face Enrollments</p>
                <p className="text-[11px] text-slate-400 dark:text-[#71839D] mt-1">
                  All staff biometric face profiles are reviewed and up to date.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead className="bg-slate-50 dark:bg-[#0D1729] text-slate-500 dark:text-[#94A3B8] font-semibold border-b border-slate-100 dark:border-[#24344D] uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Staff UID</th>
                      <th className="py-3 px-4">Bound Phone / Device</th>
                      <th className="py-3 px-4">Biometric Status</th>
                      <th className="py-3 px-4">Submitted Date</th>
                      <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-[#0D1729] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.filter(isFacePending).map(staff => (
                      <tr key={staff.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            {staff.avatarUrl ? (
                              <img
                                src={staff.avatarUrl}
                                alt={staff.name}
                                className="w-11 h-11 rounded-full object-cover border-2 border-brand-500 shadow-sm cursor-pointer hover:scale-105 transition-transform shrink-0"
                                onClick={() => setViewingPhotoStaff(staff)}
                                title="Click to inspect face photo"
                              />
                            ) : (
                              <div className="w-11 h-11 rounded-full bg-slate-100 dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold shrink-0">
                                {staff.name.charAt(0)}
                              </div>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                <span>{staff.name}</span>
                                {staff.avatarUrl && (
                                  <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-semibold px-1.5 py-0.5 rounded">
                                    Photo
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">{staff.email}</div>
                              <div className="text-[10px] text-slate-400">{staff.designation || 'Sales Executive'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {staff.id}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          <div className="font-semibold text-brand-700 dark:text-blue-400">
                            {staff.deviceModel || 'Unregistered Phone'}
                          </div>
                          {staff.deviceId && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {staff.deviceId.substring(0, 16)}...
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant="warning" size="sm">
                            PENDING APPROVAL
                          </Badge>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {staff.faceModelVersion || 'MobileFaceNet v1'}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500">
                          {staff.faceRegistrationDate
                            ? new Date(staff.faceRegistrationDate).toLocaleString()
                            : staff.joinedDate
                            ? new Date(staff.joinedDate).toLocaleDateString()
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                          <button
                            onClick={() => handleApproveFace(staff)}
                            disabled={submitting}
                            className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm inline-flex items-center space-x-1"
                            title="Approve biometric face verification for attendance"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => {
                              setRejectTarget({
                                type: 'face',
                                staffId: staff.id,
                                staffName: staff.name,
                              });
                              setRejectReason('');
                            }}
                            disabled={submitting}
                            className="px-3 py-1.5 text-xs bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 font-semibold rounded-lg inline-flex items-center space-x-1"
                            title="Reject face enrollment with mandatory reason"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                          <button
                            onClick={() => handleOpenDetail(staff)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg inline-flex items-center"
                            title="View Staff Profile"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Staff Biometric Directory & Verification Status */}
          <div className="bg-white dark:bg-[#0F192C] rounded-2xl border border-slate-200 dark:border-[#24344D] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-[#24344D]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#E8EEF8] flex items-center space-x-2">
                <Shield className="w-4 h-4 text-brand-600 dark:text-blue-400" />
                <span>Staff Biometric Face Profiles & Verification Status</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Overview of on-device biometric enrollment for all staff members. Attendance Punch In requires both an approved physical phone and approved face biometric.
              </p>
            </div>

            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-[#0D1729] text-slate-500 dark:text-[#94A3B8] font-semibold border-b border-slate-100 dark:border-[#24344D] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Staff UID</th>
                    <th className="py-3 px-4">Biometric Status</th>
                    <th className="py-3 px-4">Approval Metadata</th>
                    <th className="py-3 px-4">Model Engine</th>
                    <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-[#0D1729] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users
                    .filter(u => {
                      if (!search.trim()) return true;
                      const q = search.toLowerCase();
                      return (
                        u.name?.toLowerCase().includes(q) ||
                        u.email?.toLowerCase().includes(q) ||
                        u.id?.toLowerCase().includes(q)
                      );
                    })
                    .map(u => {
                      const isPending = isFacePending(u);
                      const isApproved = u.faceEnrollmentStatus === 'approved';
                      const isRejected = u.faceEnrollmentStatus === 'rejected';

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-4">
                            <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                            <div className="text-[10px] text-slate-400">{u.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                              {u.id}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {isApproved ? (
                              <Badge variant="success" size="sm">
                                APPROVED
                              </Badge>
                            ) : isPending ? (
                              <Badge variant="warning" size="sm">
                                PENDING APPROVAL
                              </Badge>
                            ) : isRejected ? (
                              <Badge variant="danger" size="sm">
                                REJECTED
                              </Badge>
                            ) : (
                              <Badge variant="neutral" size="sm">
                                NOT ENROLLED
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-[10px] text-slate-500">
                            {isApproved && u.faceApprovedAt ? (
                              <div>
                                <span>Approved {new Date(u.faceApprovedAt).toLocaleDateString()}</span>
                                {u.faceApprovedBy && (
                                  <div className="text-slate-400">by {u.faceApprovedBy}</div>
                                )}
                              </div>
                            ) : isRejected && u.faceRejectionReason ? (
                              <div className="text-rose-500 italic max-w-xs truncate" title={u.faceRejectionReason}>
                                Reason: {u.faceRejectionReason}
                              </div>
                            ) : isPending ? (
                              <span className="text-amber-600 dark:text-amber-400 font-medium">Awaiting Admin Review</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300 text-[11px]">
                            {u.faceModelVersion || 'MobileFaceNet v1'}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                            {isPending && (
                              <>
                                <button
                                  onClick={() => handleApproveFace(u)}
                                  disabled={submitting}
                                  className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectTarget({
                                      type: 'face',
                                      staffId: u.id,
                                      staffName: u.name,
                                    });
                                    setRejectReason('');
                                  }}
                                  disabled={submitting}
                                  className="px-2.5 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-300 font-semibold rounded-lg"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {isApproved && (
                              <button
                                onClick={() => {
                                  setRejectTarget({
                                    type: 'face',
                                    staffId: u.id,
                                    staffName: u.name,
                                  });
                                  setRejectReason('');
                                }}
                                disabled={submitting}
                                className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:hover:bg-rose-950/40 text-slate-600 dark:text-slate-300 rounded-lg inline-flex items-center space-x-1"
                                title="Revoke face enrollment"
                              >
                                <RotateCcw className="w-3 h-3" />
                                <span>Revoke / Re-enroll</span>
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenDetail(u)}
                              className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg inline-flex items-center space-x-1"
                            >
                              <Eye className="w-3 h-3" />
                              <span>View Profile</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeViewTab === 'invitations' ? (
        /* Pending Invitations Table */
        <div className="bg-white dark:bg-[#0F192C] rounded-2xl border border-slate-200 dark:border-[#24344D] shadow-sm overflow-hidden">
          {invitations.length === 0 ? (
            <EmptyState
              title="No Pending Invitations"
              description="Click 'Invite Staff Member' to generate a secure activation token for a new employee."
              icon={KeyRound}
            />
          ) : (
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-[#0D1729] text-slate-500 dark:text-[#94A3B8] font-semibold border-b border-slate-100 dark:border-[#24344D] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Invited Name</th>
                    <th className="py-3.5 px-4">Contact</th>
                    <th className="py-3.5 px-4">Designation</th>
                    <th className="py-3.5 px-4">Invitation Token</th>
                    <th className="py-3.5 px-4">Expires</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right sticky right-0 bg-slate-50 dark:bg-[#0D1729] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invitations.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {inv.name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                        <div>{inv.email}</div>
                        <div className="text-[10px] text-slate-400">{inv.phone}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                        {inv.designation} (₹{inv.basicSalary?.toLocaleString('en-IN')})
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-brand-600 dark:text-blue-400">
                        {inv.token}
                      </td>
                      <td className="py-3 px-4 text-[11px] text-slate-500">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant={
                            inv.status === 'accepted'
                              ? 'success'
                              : inv.status === 'pending'
                              ? 'warning'
                              : 'danger'
                          }
                          size="sm"
                        >
                          {inv.status.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                        {inv.status === 'pending' && (
                          <>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(inv.token);
                                setSuccessMsg(`Copied token for ${inv.name} to clipboard!`);
                              }}
                              className="px-2 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg"
                              title="Copy Token"
                            >
                              Copy Code
                            </button>
                            <button
                              onClick={() => setRevokeConfirmToken(inv.token)}
                              className="px-2 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg"
                              title="Revoke Token"
                            >
                              Revoke
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : activeViewTab === 'devices' ? (
        /* Device Management View */
        <div className="space-y-6">
          {/* Section 1: Pending Device Change / Replacement Requests */}
          <div className="bg-white dark:bg-[#0F192C] rounded-2xl border border-slate-200 dark:border-[#24344D] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-[#24344D] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#E8EEF8] flex items-center space-x-2">
                  <Smartphone className="w-4 h-4 text-amber-500" />
                  <span>Pending Device Change Requests</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
                  Staff members requesting authorization to bind a new or replacement phone for attendance.
                </p>
              </div>
              <button
                onClick={() => loadStaff(true)}
                className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-[#17243A] hover:bg-slate-200 dark:hover:bg-[#1C2A42] text-slate-700 dark:text-[#E8EEF8] rounded-lg flex items-center space-x-1"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh</span>
              </button>
            </div>

            {deviceRequests.filter(r => r.status === 'pending').length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="font-semibold text-slate-600 dark:text-[#E8EEF8]">No Pending Device Requests</p>
                <p className="text-[11px] text-slate-400 dark:text-[#71839D] mt-1">All staff devices are verified and up to date.</p>
              </div>
            ) : (
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left text-xs min-w-[850px]">
                  <thead className="bg-slate-50 dark:bg-[#0D1729] text-slate-500 dark:text-[#94A3B8] font-semibold border-b border-slate-100 dark:border-[#24344D] uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Staff Member</th>
                      <th className="py-3 px-4">Previous Device</th>
                      <th className="py-3 px-4">New Device</th>
                      <th className="py-3 px-4">Reason Given</th>
                      <th className="py-3 px-4">Requested At</th>
                      <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-[#0D1729] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {deviceRequests.filter(r => r.status === 'pending').map(req => (
                      <tr key={req.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{req.userName}</div>
                          <div className="text-[10px] text-slate-400">{req.userEmail}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                          <span className="font-medium">{req.currentDeviceModel || 'None'}</span>
                          {req.currentDeviceId && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              {req.currentDeviceId.substring(0, 16)}...
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-200">
                          <span className="font-bold text-brand-600 dark:text-blue-400">{req.newDeviceModel}</span>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {req.newDeviceId.substring(0, 16)}...
                          </div>
                        </td>
                        <td className="py-3 px-4 max-w-xs text-slate-700 dark:text-slate-300">
                          <span className="italic">"{req.reason}"</span>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-slate-500">
                          {new Date(req.createdAt).toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right space-x-2 whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                          <button
                            onClick={() => handleApproveDeviceChange(req)}
                            disabled={submitting}
                            className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleOpenRejectChange(req)}
                            disabled={submitting}
                            className="px-2.5 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-600 font-semibold rounded-lg"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Staff Device Inventory */}
          <div className="bg-white dark:bg-[#0F192C] rounded-2xl border border-slate-200 dark:border-[#24344D] shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-[#24344D]">
              <h3 className="text-sm font-bold text-slate-900 dark:text-[#E8EEF8] flex items-center space-x-2">
                <Shield className="w-4 h-4 text-brand-600 dark:text-blue-400" />
                <span>Staff Device Inventory & Binding Status</span>
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5">
                Every staff account is cryptographically bound to a single approved physical phone for attendance.
              </p>
            </div>

            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs min-w-[850px]">
                <thead className="bg-slate-50 dark:bg-[#0D1729] text-slate-500 dark:text-[#94A3B8] font-semibold border-b border-slate-100 dark:border-[#24344D] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Staff Member</th>
                    <th className="py-3 px-4">Bound Device</th>
                    <th className="py-3 px-4">Installation ID</th>
                    <th className="py-3 px-4">Binding Status</th>
                    <th className="py-3 px-4">Approval Metadata</th>
                    <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-[#0D1729] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map(u => {
                    const status = u.deviceBindingStatus || (u.deviceId ? 'approved' : 'unregistered');
                    return (
                      <tr key={u.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 dark:text-white">{u.name}</div>
                          <div className="text-[10px] text-slate-400">{u.designation || u.role}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                          {u.deviceModel ? (
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {u.deviceModel} ({u.devicePlatform || 'mobile'})
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No device bound</span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono text-[10px] text-slate-500">
                          {u.deviceId ? `${u.deviceId.substring(0, 18)}...` : '—'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={
                              status === 'approved'
                                ? 'success'
                                : status === 'pending_approval'
                                ? 'warning'
                                : status === 'rejected'
                                ? 'danger'
                                : 'neutral'
                            }
                            size="sm"
                          >
                            {status === 'pending_approval'
                              ? 'PENDING APPROVAL'
                              : status.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-[10px] text-slate-500">
                          {status === 'approved' && u.deviceApprovedAt ? (
                            <div>
                              <span>Approved {new Date(u.deviceApprovedAt).toLocaleDateString()}</span>
                              {u.deviceApprovedBy && (
                                <div className="text-slate-400">by {u.deviceApprovedBy}</div>
                              )}
                            </div>
                          ) : status === 'rejected' && u.deviceRejectionReason ? (
                            <div className="text-rose-500 italic max-w-xs truncate">
                              {u.deviceRejectionReason}
                            </div>
                          ) : u.deviceRegisteredAt ? (
                            <div>Registered {new Date(u.deviceRegisteredAt).toLocaleDateString()}</div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                          {status === 'pending_approval' && (
                            <>
                              <button
                                onClick={() => handleApproveDeviceRegistration(u)}
                                disabled={submitting}
                                className="px-2.5 py-1 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleOpenRejectRegistration(u)}
                                disabled={submitting}
                                className="px-2.5 py-1 text-[11px] bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {u.deviceId && status === 'approved' && (
                            <button
                              onClick={() => setResetDeviceStaff(u)}
                              disabled={submitting}
                              className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-amber-50 hover:text-amber-700 dark:bg-slate-800 dark:hover:bg-amber-950 text-slate-700 dark:text-slate-300 rounded-lg transition-colors flex items-center space-x-1 inline-flex"
                              title="Reset bound device"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Reset Device</span>
                            </button>
                          )}
                          {status === 'rejected' && (
                            <button
                              onClick={() => setResetDeviceStaff(u)}
                              disabled={submitting}
                              className="px-2.5 py-1 text-[11px] bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg inline-flex items-center space-x-1"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Clear / Allow Re-register</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Staff Table */
        <div className="bg-white dark:bg-[#0F192C] rounded-2xl border border-slate-200 dark:border-[#24344D] shadow-sm overflow-hidden">
          {loading && users.length === 0 ? (
            <div className="p-6 space-y-3 animate-pulse">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-full" />
              ))}
            </div>
          ) : activeStaffList.length === 0 ? (
            <EmptyState
              title="No Staff Records Found"
              description="No staff members match the current search query or filter selection."
              icon={Users}
            />
          ) : (
            <>
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left text-xs min-w-[880px]">
                  <thead className="bg-slate-50 dark:bg-[#0D1729] text-slate-500 dark:text-[#94A3B8] font-semibold border-b border-slate-100 dark:border-[#24344D] uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3.5 px-4">Member Name</th>
                      <th className="py-3.5 px-4">Contact</th>
                      <th className="py-3.5 px-4">Designation</th>
                      <th className="py-3.5 px-4">Role</th>
                      <th className="py-3.5 px-4">Salary & Target</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right sticky right-0 bg-slate-50 dark:bg-[#0D1729] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {paginatedStaffList.map(staff => (
                      <tr key={staff.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        {/* Name */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden">
                              {staff.avatarUrl ? (
                                <img
                                  src={CloudinaryService.getDeviceThumbnailUrl(staff.avatarUrl)}
                                  alt={staff.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                staff.name?.[0]?.toUpperCase() || 'U'
                              )}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{staff.name}</p>
                              <span className="text-[10px] text-slate-400 font-mono truncate block max-w-[140px]">
                                {staff.id}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center space-x-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            <span>{staff.email}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 mt-0.5 text-slate-400 text-[11px]">
                            <Phone className="w-3.5 h-3.5" />
                            <span>{staff.phone}</span>
                          </div>
                        </td>

                        {/* Designation */}
                        <td className="py-3.5 px-4 font-medium text-slate-800 dark:text-slate-200">
                          {staff.designation || 'Sales Executive'}
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4">
                          <Badge variant={staff.role === 'admin' ? 'primary' : 'neutral'} size="sm">
                            {staff.role === 'admin' ? 'Administrator' : 'Staff'}
                          </Badge>
                        </td>

                        {/* Salary & Target */}
                        <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                          <div>₹{(staff.basicSalary || 20000).toLocaleString('en-IN')} / mo</div>
                          <div className="text-[10px] text-slate-400">
                            Target: ₹{(staff.monthlyTarget || 200000).toLocaleString('en-IN')}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <Badge variant={staff.isActive !== false ? 'success' : 'danger'} size="sm">
                            {staff.isActive !== false ? 'Active' : 'Deactivated'}
                          </Badge>
                          {isFacePending(staff) && (
                            <button
                              onClick={() => {
                                setActiveViewTab('faces');
                                setSearch(staff.name);
                              }}
                              className="mt-1 flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 transition-colors"
                              title="Pending Face Biometric Approval — Click to review"
                            >
                              <ScanFace className="w-3 h-3" />
                              <span>Face Pending</span>
                            </button>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                          <div className="inline-flex items-center justify-end gap-1">
                            <ActionButton
                              icon={Eye}
                              label="View Details & History"
                              onClick={() => handleOpenDetail(staff)}
                              variant="ghost"
                            />
                            <ActionButton
                              icon={Edit2}
                              label="Edit Staff"
                              onClick={() => handleOpenEdit(staff)}
                              variant="ghost"
                            />
                            <ActionButton
                              icon={KeyRound}
                              label="Send Password Reset Email"
                              onClick={() => handleResendInvite(staff)}
                              variant="ghost"
                            />
                            <ActionButton
                              icon={Power}
                              label={staff.isActive !== false ? 'Deactivate Account' : 'Reactivate Account'}
                              onClick={() => setStatusDialogStaff(staff)}
                              variant={staff.isActive !== false ? 'danger' : 'success'}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {activeStaffList.length > 0 && (
                <TablePagination
                  currentPage={currentPage}
                  totalItems={activeStaffList.length}
                  pageSize={pageSize}
                  onPageChange={page => setCurrentPage(page)}
                  onPageSizeChange={size => {
                    setPageSize(size);
                    setCurrentPage(1);
                  }}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* Add Staff / Generate Invitation Modal (Spark Compatible) */}
      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Generate Staff Invitation Token">
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generates a tamper-proof staff activation token. The employee enters this invitation code in the Parth Mobile Care app to set their own password and activate their account.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Ramesh Patel"
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="ramesh@parthmobile.com"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Number *</label>
              <input
                type="text"
                required
                maxLength={10}
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })}
                placeholder="10-digit number"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Role</label>
              <input
                type="text"
                readOnly
                value="Staff Member (Restricted)"
                className="w-full px-3.5 py-2 text-xs bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={e => setFormData({ ...formData, designation: e.target.value })}
                placeholder="Sales Executive"
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Basic Salary (₹ / mo)</label>
              <input
                type="number"
                value={formData.basicSalary}
                onChange={e => setFormData({ ...formData, basicSalary: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Monthly Target (₹)</label>
              <input
                type="number"
                value={formData.monthlyTarget}
                onChange={e => setFormData({ ...formData, monthlyTarget: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setAddModalOpen(false)}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-xl shadow disabled:opacity-50"
            >
              {submitting ? 'Generating Token...' : 'Create Staff Invitation'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Generated Invitation Success Modal */}
      <Modal
        isOpen={!!generatedInvitation}
        onClose={() => setGeneratedInvitation(null)}
        title="Staff Invitation Token Ready"
      >
        {generatedInvitation && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-2xl space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-slate-900 dark:text-white text-sm">{generatedInvitation.name}</h4>
                  <p className="text-slate-500">{generatedInvitation.email} | {generatedInvitation.phone}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">{generatedInvitation.designation}</p>
                </div>
                <Badge variant="warning" size="sm">7 DAYS VALIDITY</Badge>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">Invitation Token Code:</span>
                <div className="flex items-center space-x-2 mt-1">
                  <span className="font-mono font-extrabold text-sm text-brand-700 dark:text-blue-300 bg-white dark:bg-[#0D1729] px-3 py-1.5 rounded-xl border border-blue-200 dark:border-[#24344D] select-all">
                    {generatedInvitation.token}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInvitation.token);
                      showSuccess('Invitation token copied to clipboard!');
                    }}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold"
                  >
                    Copy Token
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-slate-600 dark:text-slate-300 text-xs">
              <p className="font-semibold text-slate-900 dark:text-white">How the employee registers:</p>
              <ol className="list-decimal pl-4 space-y-1 text-slate-500 dark:text-slate-400 text-[11px]">
                <li>Staff opens the <strong>Parth Mobile Care</strong> mobile application.</li>
                <li>Taps <strong>"Invited Staff? Set Up Account"</strong> on the Login screen.</li>
                <li>Enters token code <strong>{generatedInvitation.token}</strong> and chooses their password.</li>
              </ol>
            </div>

            <div className="flex justify-between items-center pt-2">
              <a
                href={`https://wa.me/91${generatedInvitation.phone}?text=${encodeURIComponent(
                  `Hello ${generatedInvitation.name},\n\nYou have been invited to join Parth Mobile Care as ${generatedInvitation.designation}.\n\nYour Activation Token: ${generatedInvitation.token}\n\nPlease open the Parth Mobile Care app, tap "Invited Staff? Set Up Account", enter your token, and create your password.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center space-x-1.5"
              >
                <span>Share via WhatsApp</span>
              </a>

              <button
                type="button"
                onClick={() => setGeneratedInvitation(null)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white text-xs font-bold rounded-xl"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Staff Modal */}
      <Modal isOpen={editModalOpen} onClose={() => setEditModalOpen(false)} title="Edit Staff Profile">
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
              <input
                type="text"
                value={formData.designation}
                onChange={e => setFormData({ ...formData, designation: e.target.value })}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Role</label>
              <select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value as UserRole })}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              >
                <option value="staff">Staff</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Basic Salary (₹)</label>
              <input
                type="number"
                value={formData.basicSalary}
                onChange={e => setFormData({ ...formData, basicSalary: Number(e.target.value) })}
                className="w-full px-3.5 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-3">
            <button
              type="button"
              onClick={() => setEditModalOpen(false)}
              className="px-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-xl shadow disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Staff Detail Modal */}
      <Modal isOpen={detailModalOpen} onClose={() => setDetailModalOpen(false)} title="Staff Member Profile & History" size="3xl">
        {selectedStaff && (
          <div className="space-y-4 text-xs">
            {/* Staff Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center space-x-3 min-w-0">
                <div className="w-12 h-12 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold text-lg shrink-0">
                  {selectedStaff.name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">{selectedStaff.name}</h4>
                  <p className="text-slate-500 truncate">{selectedStaff.designation || 'Sales Executive'}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">UID: {selectedStaff.id}</p>
                </div>
              </div>

              {/* Sub-Tabs */}
              <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1 shrink-0 self-start sm:self-auto">
                {(['profile', 'attendance', 'leads', 'payroll'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setDetailTab(tab)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-lg capitalize transition-colors ${
                      detailTab === tab
                        ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* TAB 1: Profile & Hardware Security */}
            {detailTab === 'profile' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Email Address</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5 truncate" title={selectedStaff.email}>{selectedStaff.email}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Mobile Number</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{selectedStaff.phone}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Basic Salary</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">₹{(selectedStaff.basicSalary || 20000).toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Monthly Sales Target</span>
                    <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">₹{(selectedStaff.monthlyTarget || 200000).toLocaleString('en-IN')}</p>
                  </div>
                </div>

                {/* Biometric Face Verification Management */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Biometric Face Authentication</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedStaff.faceEnrollmentStatus === 'approved'
                          ? 'Approved for Face Recognition Attendance'
                          : selectedStaff.faceEnrollmentStatus === 'pending_recovery'
                          ? 'Face Recovery Pending Administrator Verification'
                          : selectedStaff.faceEnrollmentStatus === 'pending_approval' || (selectedStaff.hasFaceRegistered && !selectedStaff.faceApprovedAt)
                          ? 'Pending Administrator Review & Approval'
                          : selectedStaff.faceEnrollmentStatus === 'rejected'
                          ? `Rejected: ${selectedStaff.faceRejectionReason || 'Template rejected'}`
                          : 'Not Enrolled / Pending Setup'}
                      </p>
                    </div>
                    <Badge
                      variant={
                        selectedStaff.faceEnrollmentStatus === 'approved'
                          ? 'success'
                          : selectedStaff.faceEnrollmentStatus === 'pending_recovery'
                          ? 'warning'
                          : selectedStaff.faceEnrollmentStatus === 'pending_approval' || (selectedStaff.hasFaceRegistered && !selectedStaff.faceApprovedAt)
                          ? 'warning'
                          : selectedStaff.faceEnrollmentStatus === 'rejected'
                          ? 'danger'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {(selectedStaff.faceEnrollmentStatus || (selectedStaff.hasFaceRegistered ? 'pending_approval' : 'unregistered')).toUpperCase()}
                    </Badge>
                  </div>

                  {/* Actions for Face Enrollment */}
                  {(selectedStaff.faceEnrollmentStatus === 'pending_approval' || selectedStaff.faceEnrollmentStatus === 'pending_recovery' || (selectedStaff.hasFaceRegistered && selectedStaff.faceEnrollmentStatus !== 'approved')) && (
                    <div className="flex items-center space-x-2 pt-1 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => handleApproveFace(selectedStaff)}
                        disabled={submitting}
                        className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold flex items-center space-x-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Approve Face Enrollment</span>
                      </button>
                      <button
                        onClick={() => {
                          setRejectTarget({
                            type: 'face',
                            staffId: selectedStaff.id,
                            staffName: selectedStaff.name,
                          });
                          setRejectReason('');
                        }}
                        disabled={submitting}
                        className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 rounded-lg text-xs font-semibold flex items-center space-x-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Reject Face Enrollment</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Device Hardware Binding */}
                <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl space-y-2 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400">Device Hardware Binding</span>
                      <p className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {selectedStaff.deviceModel ? `${selectedStaff.deviceModel} (${selectedStaff.devicePlatform || 'mobile'})` : 'No device bound'}
                      </p>
                      {selectedStaff.deviceId && (
                        <p className="text-[10px] text-slate-400 font-mono truncate max-w-sm mt-0.5">
                          Hardware ID: {selectedStaff.deviceId}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant={
                        selectedStaff.deviceBindingStatus === 'approved'
                          ? 'success'
                          : selectedStaff.deviceBindingStatus === 'pending_approval'
                          ? 'warning'
                          : selectedStaff.deviceBindingStatus === 'rejected'
                          ? 'danger'
                          : 'neutral'
                      }
                      size="sm"
                    >
                      {(selectedStaff.deviceBindingStatus || (selectedStaff.deviceId ? 'approved' : 'unregistered')).toUpperCase()}
                    </Badge>
                  </div>

                  {selectedStaff.deviceId && (
                    <div className="pt-1 border-t border-slate-200 dark:border-slate-700">
                      <button
                        onClick={() => setResetDeviceStaff(selectedStaff)}
                        className="px-2.5 py-1 text-[11px] bg-amber-50 hover:bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 rounded-lg flex items-center space-x-1"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Reset Device Binding</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: Attendance History */}
            {detailTab === 'attendance' && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {detailLoading ? (
                  <p className="text-slate-400 py-6 text-center">Loading attendance history...</p>
                ) : staffAttendance.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">No attendance records found for this staff member.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[420px]">
                      <thead>
                        <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
                          <th className="pb-1.5">Date</th>
                          <th className="pb-1.5">Punch In</th>
                          <th className="pb-1.5">Punch Out</th>
                          <th className="pb-1.5">Hours</th>
                          <th className="pb-1.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {staffAttendance.slice(0, 15).map(att => (
                          <tr key={att.id} className="py-1">
                            <td className="py-1.5 font-medium">{att.date}</td>
                            <td className="py-1.5 text-slate-500">{att.punchInTime || '—'}</td>
                            <td className="py-1.5 text-slate-500">{att.punchOutTime || '—'}</td>
                            <td className="py-1.5">{att.totalHours || 0}h</td>
                            <td className="py-1.5 text-right">
                              <Badge variant={att.isLate ? 'warning' : 'success'} size="sm">
                                {att.status.toUpperCase()}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: Leads Pipeline */}
            {detailTab === 'leads' && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {detailLoading ? (
                  <p className="text-slate-400 py-6 text-center">Loading leads...</p>
                ) : staffLeads.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">No assigned leads found for this staff member.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[450px]">
                      <thead>
                        <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
                          <th className="pb-1.5">Customer</th>
                          <th className="pb-1.5">Phone</th>
                          <th className="pb-1.5">Interested Model</th>
                          <th className="pb-1.5">Budget</th>
                          <th className="pb-1.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {staffLeads.slice(0, 15).map(lead => (
                          <tr key={lead.id} className="py-1">
                            <td className="py-1.5 font-bold">{lead.name}</td>
                            <td className="py-1.5 text-slate-500">{lead.phone}</td>
                            <td className="py-1.5">{lead.interestedBrand} {lead.interestedModel}</td>
                            <td className="py-1.5 font-mono">₹{lead.budget.toLocaleString('en-IN')}</td>
                            <td className="py-1.5 text-right">
                              <Badge variant={lead.status === 'purchased' ? 'success' : lead.status === 'lost' ? 'danger' : 'info'} size="sm">
                                {lead.status.toUpperCase()}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 4: Payroll & Salary Slips */}
            {detailTab === 'payroll' && (
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {detailLoading ? (
                  <p className="text-slate-400 py-6 text-center">Loading salary history...</p>
                ) : staffSlips.length === 0 ? (
                  <p className="text-slate-400 py-6 text-center">No salary slips generated for this staff member yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[420px]">
                      <thead>
                        <tr className="text-[10px] uppercase text-slate-400 border-b border-slate-200 dark:border-slate-700">
                          <th className="pb-1.5">Period</th>
                          <th className="pb-1.5">Basic</th>
                          <th className="pb-1.5">Incentive</th>
                          <th className="pb-1.5">Net Payout</th>
                          <th className="pb-1.5 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {staffSlips.map(slip => (
                          <tr key={slip.id} className="py-1">
                            <td className="py-1.5 font-medium">{slip.month}</td>
                            <td className="py-1.5 text-slate-500">₹{slip.basicSalary.toLocaleString('en-IN')}</td>
                            <td className="py-1.5 text-emerald-600 font-semibold">+₹{slip.salesIncentive.toLocaleString('en-IN')}</td>
                            <td className="py-1.5 font-bold">₹{slip.netSalary.toLocaleString('en-IN')}</td>
                            <td className="py-1.5 text-right">
                              <Badge variant={slip.isPaid ? 'success' : 'warning'} size="sm">
                                {slip.isPaid ? 'PAID' : 'UNPAID'}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm Reset Device Dialog */}
      {resetDeviceStaff && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setResetDeviceStaff(null)}
          onConfirm={handleConfirmResetDevice}
          title="Reset Staff Device Binding"
          message={`Are you sure you want to reset the bound device for ${resetDeviceStaff.name}? This will revoke their attendance permissions on their current phone (${resetDeviceStaff.deviceModel || 'Current Phone'}). They will be prompted to register their phone again upon their next login.`}
          confirmText="Reset Device"
          isDestructive={true}
          loading={submitting}
        />
      )}

      {/* Reject Device Modal */}
      {rejectTarget && (
        <Modal
          isOpen={true}
          onClose={() => setRejectTarget(null)}
          title={`Reject ${
            rejectTarget.type === 'staff_registration'
              ? 'Staff Registration'
              : rejectTarget.type === 'registration'
              ? 'Device Registration'
              : rejectTarget.type === 'face'
              ? 'Biometric Face Enrollment'
              : 'Device Change'
          } — ${rejectTarget.staffName}`}
        >
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-400">
              {rejectTarget.type === 'staff_registration'
                ? 'Please enter the reason for rejecting this staff registration request. The applicant will see this reason in their mobile app.'
                : 'Please enter the reason for rejecting this request. The staff member will be informed of this reason in their app.'}
            </p>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Rejection Reason *
              </label>
              {/* Quick Preset Buttons for Admin Convenience */}
              <div className="flex flex-wrap gap-1.5 mb-2">
                <button
                  type="button"
                  onClick={() => setRejectReason('Duplicate Face: This person is already registered under an existing staff account.')}
                  className="px-2 py-1 text-[11px] bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-lg border border-rose-200 dark:border-rose-800 font-medium hover:bg-rose-100 transition-colors"
                >
                  Duplicate Face Detected
                </button>
                <button
                  type="button"
                  onClick={() => setRejectReason('Unclear Face Photo: Please retake a clear, frontal photo with good lighting.')}
                  className="px-2 py-1 text-[11px] bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-200 dark:border-amber-800 font-medium hover:bg-amber-100 transition-colors"
                >
                  Unclear Face Photo
                </button>
                <button
                  type="button"
                  onClick={() => setRejectReason('Device Verification Failed: Bound device could not be authenticated.')}
                  className="px-2 py-1 text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 font-medium hover:bg-slate-200 transition-colors"
                >
                  Device Issue
                </button>
              </div>
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={3}
                placeholder="e.g. Identity could not be verified; details do not match store employment records."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectTarget(null)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={submitting || !rejectReason.trim()}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-semibold shadow-sm"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Approve Staff Registration Modal */}
      {approveRegStaff && (
        <Modal
          isOpen={true}
          onClose={() => setApproveRegStaff(null)}
          title={`Approve Staff Registration — ${approveRegStaff.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center space-x-3.5">
              {approveRegStaff.avatarUrl ? (
                <img
                  src={approveRegStaff.avatarUrl}
                  alt={approveRegStaff.name}
                  className="w-16 h-16 rounded-xl object-cover border-2 border-emerald-500 shadow-md cursor-pointer hover:opacity-90 shrink-0"
                  onClick={() => setViewingPhotoStaff(approveRegStaff)}
                  title="Click to view full photo"
                />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-700 flex flex-col items-center justify-center text-slate-500 text-xs font-bold shrink-0">
                  <ScanFace className="w-6 h-6 mb-0.5 opacity-60" />
                  <span className="text-[10px]">No Photo</span>
                </div>
              )}
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white text-sm flex items-center justify-between">
                  <span className="truncate">{approveRegStaff.name}</span>
                  {approveRegStaff.avatarUrl && (
                    <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 font-semibold px-2 py-0.5 rounded-full shrink-0">
                      Face Captured
                    </span>
                  )}
                </div>
                <div className="text-slate-500 truncate">{approveRegStaff.email} • {approveRegStaff.phone}</div>
                <div className="text-slate-500">Designation: <span className="font-semibold text-slate-700 dark:text-slate-300">{approveRegStaff.designation || 'Staff'}</span></div>
                <div className="text-slate-500">Device: <span className="font-semibold text-slate-700 dark:text-slate-300">{approveRegStaff.deviceModel || 'Mobile Device'}</span></div>
              </div>
            </div>

            <p className="text-slate-600 dark:text-slate-400">
              Set the monthly compensation and sales target for this staff member before activating their account.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Basic Monthly Salary (₹) *
                </label>
                <input
                  type="number"
                  value={regSalary}
                  onChange={e => setRegSalary(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Monthly Target (₹) *
                </label>
                <input
                  type="number"
                  value={regTarget}
                  onChange={e => setRegTarget(Number(e.target.value))}
                  min={0}
                  className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="pt-2 flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setApproveRegStaff(null)}
                className="px-3 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApproveRegistration}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold shadow-md flex items-center space-x-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>{submitting ? 'Approving...' : 'Approve & Activate Staff'}</span>
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Staff Face Verification Photo Modal & Duplicate Inspector */}
      {viewingPhotoStaff && (
        <Modal
          isOpen={true}
          onClose={() => setViewingPhotoStaff(null)}
          title={`Face Verification — ${viewingPhotoStaff.name}`}
        >
          <div className="space-y-4 text-xs">
            <div className="text-center">
              {viewingPhotoStaff.avatarUrl ? (
                <div className="inline-block relative rounded-2xl overflow-hidden border-2 border-brand-500 shadow-xl bg-slate-900 max-w-xs mx-auto">
                  <img
                    src={viewingPhotoStaff.avatarUrl}
                    alt={viewingPhotoStaff.name}
                    className="w-full max-h-80 object-cover"
                  />
                </div>
              ) : (
                <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-slate-400">
                  <ScanFace className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">No Face Photo Uploaded</p>
                  <p className="text-[11px] text-slate-400 mt-1">This staff member enrolled with biometric descriptors only.</p>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/80 rounded-xl space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-900 dark:text-white text-sm">{viewingPhotoStaff.name}</span>
                <Badge variant={viewingPhotoStaff.registrationStatus === 'approved' ? 'success' : 'warning'}>
                  {viewingPhotoStaff.registrationStatus === 'approved' ? 'Active Staff' : 'Pending Approval'}
                </Badge>
              </div>
              <p className="text-slate-500">{viewingPhotoStaff.email} • {viewingPhotoStaff.phone}</p>
              <p className="text-slate-500">Designation: <span className="font-semibold text-slate-700 dark:text-slate-300">{viewingPhotoStaff.designation || 'Staff'}</span></p>
              <p className="text-slate-500">Bound Device: <span className="font-semibold text-slate-700 dark:text-slate-300">{viewingPhotoStaff.deviceModel || 'Mobile Device'}</span></p>
            </div>

            {/* Visual Duplicate Face Warning */}
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/50 rounded-xl">
              <p className="font-semibold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-amber-600" />
                <span>Anti-Duplicate Verification</span>
              </p>
              <p className="text-amber-800 dark:text-amber-400 text-[11px] leading-relaxed">
                Inspect this face photo carefully. If this face belongs to an existing staff member or was previously registered under a different name, reject this registration to prevent duplicate accounts.
              </p>
            </div>

            {/* Other Active Staff Face Photos for Visual Comparison */}
            {users.filter(u => u.id !== viewingPhotoStaff.id && u.avatarUrl).length > 0 && (
              <div>
                <h5 className="font-bold text-slate-700 dark:text-slate-300 mb-2">Compare With Registered Staff:</h5>
                <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-1">
                  {users
                    .filter(u => u.id !== viewingPhotoStaff.id && u.avatarUrl)
                    .map(existing => (
                      <div
                        key={existing.id}
                        className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-brand-500"
                        title={`Click to inspect: ${existing.name} (${existing.designation})`}
                        onClick={() => setViewingPhotoStaff(existing)}
                      >
                        <img
                          src={existing.avatarUrl}
                          alt={existing.name}
                          className="w-7 h-7 rounded-full object-cover border border-slate-300 dark:border-slate-600"
                        />
                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 max-w-[90px] truncate">
                          {existing.name}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-between items-center">
              {viewingPhotoStaff.registrationStatus === 'pending' && (
                <Button
                  variant="danger"
                  size="xs"
                  onClick={() => {
                    const target = viewingPhotoStaff;
                    setViewingPhotoStaff(null);
                    handleOpenRejectStaffRegistration(target);
                  }}
                >
                  Reject Duplicate Face
                </Button>
              )}
              <Button
                variant="secondary"
                size="xs"
                onClick={() => setViewingPhotoStaff(null)}
                className="ml-auto"
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Deactivation/Reactivation Dialog */}
      {statusDialogStaff && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setStatusDialogStaff(null)}
          onConfirm={handleToggleStatus}
          title={statusDialogStaff.isActive !== false ? 'Deactivate Staff Account' : 'Reactivate Staff Account'}
          message={`Are you sure you want to ${
            statusDialogStaff.isActive !== false ? 'deactivate' : 'reactivate'
          } account for ${statusDialogStaff.name}? ${
            statusDialogStaff.isActive !== false
              ? 'They will lose access to the staff mobile app and store operations until reactivated.'
              : 'This will re-enable their account to access store operations.'
          }`}
          isDestructive={statusDialogStaff.isActive !== false}
          confirmText={statusDialogStaff.isActive !== false ? 'Deactivate Account' : 'Reactivate'}
          loading={submitting}
        />
      )}

      {/* Confirm Revoke Invitation Dialog */}
      {revokeConfirmToken && (
        <ConfirmDialog
          isOpen={true}
          onClose={() => setRevokeConfirmToken(null)}
          onConfirm={() => handleRevokeInvitation(revokeConfirmToken)}
          title="Revoke Staff Invitation"
          message="Are you sure you want to revoke this staff invitation? This token will no longer be valid for registration."
          isDestructive={true}
          confirmText="Revoke Invitation"
          loading={submitting}
        />
      )}
    </div>
  );
};

