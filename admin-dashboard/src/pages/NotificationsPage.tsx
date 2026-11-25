import React, { useEffect, useState, useMemo } from 'react';
import {
  Bell,
  CheckCheck,
  Calendar,
  AlertCircle,
  Tag,
  ShoppingBag,
  Clock,
  Plus,
  Send,
  RotateCcw,
  Sparkles,
  ChevronRight,
  UserCheck,
  Smartphone,
  Users,
  Shield,
  Wallet,
  Edit2,
  Trash2,
  Eye,
  AlertTriangle,
  Zap,
  CheckCircle2,
  FileText,
  User,
  Filter,
} from 'lucide-react';
import { ApiService } from '../services/api';
import {
  Modal,
  Badge,
  EmptyState,
  Button,
  Input,
  Select,
  Card,
  TablePagination,
  ConfirmDialog,
} from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AppNotification, User as StaffUser } from '../types';
import { NavTab } from '../layouts/DashboardLayout';
import {
  NavigationParams,
  resolveNotificationNavigation,
  getNotificationActionLabel,
} from '../utils/notificationRouter';

interface NotificationsPageProps {
  onNavigate?: (tab: NavTab, params?: NavigationParams) => void;
}

export const NotificationsPage: React.FC<NotificationsPageProps> = ({ onNavigate }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const [announcementSubFilter, setAnnouncementSubFilter] = useState<'all' | 'published' | 'draft' | 'scheduled' | 'expired'>('all');
  const [navigatingId, setNavigatingId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Announcement Create/Edit Modal State
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementBody, setAnnouncementBody] = useState('');
  const [announcementPriority, setAnnouncementPriority] = useState<'normal' | 'high' | 'urgent'>('normal');
  const [announcementStatus, setAnnouncementStatus] = useState<'published' | 'draft'>('published');
  const [announcementAudience, setAnnouncementAudience] = useState<'all' | 'specific_staff'>('all');
  const [announcementTargetStaff, setAnnouncementTargetStaff] = useState<string[]>([]);
  const [announcementStartDate, setAnnouncementStartDate] = useState('');
  const [announcementExpiryDate, setAnnouncementExpiryDate] = useState('');
  const [announcementLoading, setAnnouncementLoading] = useState(false);
  const [announcementMsg, setAnnouncementMsg] = useState('');

  // Delete Confirmation Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [announcementToDelete, setAnnouncementToDelete] = useState<AppNotification | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Selected announcement for detailed inspection modal
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AppNotification | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [notifsData, usersData] = await Promise.all([
        ApiService.getNotifications(true),
        ApiService.getUsers().catch(() => []),
      ]);
      setNotifications(notifsData);
      setStaffUsers(usersData.filter(u => u.role === 'staff' && u.isActive));
    } catch (err) {
      console.warn('Notifications load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch fallback
    loadData();

    // Real-time listener for notifications
    const unsubNotifs = ApiService.subscribeToNotifications(
      (liveNotifs) => {
        setNotifications(liveNotifs);
        setLoading(false);
      },
      (err) => console.warn('[NotificationsPage] Notifications listener fallback:', err)
    );

    return () => {
      unsubNotifs();
    };
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await ApiService.markNotificationRead(id);
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, read: true } : n))
      );
    } catch (err: any) {
      console.warn('Could not mark read:', err);
      showError(err, 'Failed to update read status.');
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return;

    try {
      await ApiService.markAllNotificationsRead(unreadIds);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      showSuccess(`All ${unreadIds.length} notifications marked as read.`);
    } catch (err: any) {
      console.warn('Could not mark all as read:', err);
      showError(err, 'Failed to mark all as read.');
    }
  };

  const handleNotificationClick = async (n: AppNotification) => {
    if (navigatingId === n.id) return;

    setNavigatingId(n.id);
    const target = resolveNotificationNavigation(n);

    try {
      if (target.action === 'modal' || n.type === 'announcement') {
        setSelectedAnnouncement(n);
        if (!n.read) {
          await handleMarkAsRead(n.id);
        }
      } else if (target.action === 'navigate' && target.tab) {
        if (!onNavigate) {
          showError(new Error('Navigation failure'), 'Unable to open this notification. Please try again.');
          return;
        }

        onNavigate(target.tab, target.params);
        if (!n.read) {
          await handleMarkAsRead(n.id);
        }
      } else {
        showError(
          new Error('Navigation failure'),
          target.errorMessage || 'Unable to open this notification. Please try again.'
        );
      }
    } catch (err: any) {
      showError(err, 'Unable to open this notification. Please try again.');
    } finally {
      setNavigatingId(null);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setModalMode('create');
    setEditingId(null);
    setAnnouncementTitle('');
    setAnnouncementBody('');
    setAnnouncementPriority('normal');
    setAnnouncementStatus('published');
    setAnnouncementAudience('all');
    setAnnouncementTargetStaff([]);
    setAnnouncementStartDate(new Date().toISOString().split('T')[0]);
    setAnnouncementExpiryDate('');
    setAnnouncementMsg('');
    setAnnouncementModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: AppNotification, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setModalMode('edit');
    setEditingId(item.id);
    setAnnouncementTitle(item.title);
    setAnnouncementBody(item.body);
    setAnnouncementPriority(item.priority || 'normal');
    setAnnouncementStatus(item.status === 'draft' ? 'draft' : 'published');
    setAnnouncementAudience(item.targetAudience === 'specific_staff' ? 'specific_staff' : 'all');
    setAnnouncementTargetStaff(item.targetStaffIds || (item.userId && item.userId !== 'all' ? [item.userId] : []));
    setAnnouncementStartDate(item.startDate || (item.timestamp ? item.timestamp.split('T')[0] : ''));
    setAnnouncementExpiryDate(item.expiryDate || '');
    setAnnouncementMsg('');
    setAnnouncementModalOpen(true);
  };

  // Save (Create or Update) Announcement
  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedTitle = announcementTitle.trim();
    const trimmedBody = announcementBody.trim();

    if (!trimmedTitle || trimmedTitle.length < 3) {
      setAnnouncementMsg('Announcement title must be at least 3 characters.');
      return;
    }
    if (!trimmedBody || trimmedBody.length < 5) {
      setAnnouncementMsg('Announcement message must be at least 5 characters.');
      return;
    }
    if (announcementAudience === 'specific_staff' && announcementTargetStaff.length === 0) {
      setAnnouncementMsg('Please select at least one staff recipient or choose "All Store Staff".');
      return;
    }
    if (announcementExpiryDate && announcementStartDate && announcementExpiryDate < announcementStartDate) {
      setAnnouncementMsg('Expiry date cannot be earlier than start date.');
      return;
    }

    setAnnouncementLoading(true);
    setAnnouncementMsg('');

    const adminUser = {
      id: currentUser?.id || 'admin',
      name: currentUser?.name || 'Administrator',
    };

    try {
      if (modalMode === 'create') {
        await ApiService.createAnnouncement(
          {
            title: trimmedTitle,
            body: trimmedBody,
            priority: announcementPriority,
            status: announcementStatus,
            targetAudience: announcementAudience,
            targetStaffIds: announcementTargetStaff,
            startDate: announcementStartDate,
            expiryDate: announcementExpiryDate,
          },
          adminUser
        );
        showSuccess(
          announcementStatus === 'draft'
            ? 'Announcement saved as draft.'
            : 'Announcement broadcasted to store staff.'
        );
      } else if (modalMode === 'edit' && editingId) {
        // Calculate status: if startDate is in future and status is published, mark scheduled
        let finalStatus = announcementStatus;
        if (announcementStartDate && new Date(announcementStartDate).getTime() > Date.now() && finalStatus === 'published') {
          finalStatus = 'scheduled' as any;
        }

        await ApiService.updateAnnouncement(
          editingId,
          {
            title: trimmedTitle,
            body: trimmedBody,
            priority: announcementPriority,
            status: finalStatus as any,
            targetAudience: announcementAudience,
            targetStaffIds: announcementTargetStaff,
            startDate: announcementStartDate,
            expiryDate: announcementExpiryDate,
            userId: announcementAudience === 'specific_staff'
              ? (announcementTargetStaff.length === 1 ? announcementTargetStaff[0] : 'targeted')
              : 'all',
          },
          adminUser
        );
        showSuccess('Announcement updated successfully.');
      }

      setAnnouncementModalOpen(false);
      await loadData();
    } catch (err: any) {
      setAnnouncementMsg(err?.message || 'Failed to save announcement.');
      showError(err, 'Failed to save announcement.');
    } finally {
      setAnnouncementLoading(false);
    }
  };

  // Open Delete Confirmation
  const openDeleteModal = (item: AppNotification, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setAnnouncementToDelete(item);
    setDeleteConfirmOpen(true);
  };

  // Execute Delete
  const handleConfirmDelete = async () => {
    if (!announcementToDelete) return;

    setDeleteLoading(true);
    try {
      const adminUser = {
        id: currentUser?.id || 'admin',
        name: currentUser?.name || 'Administrator',
      };
      await ApiService.deleteAnnouncement(announcementToDelete.id, announcementToDelete.title, adminUser);
      showSuccess(`Announcement "${announcementToDelete.title}" deleted.`);
      setDeleteConfirmOpen(false);
      setAnnouncementToDelete(null);
      await loadData();
    } catch (err: any) {
      showError(err, 'Failed to delete announcement.');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Toggle Announcement Status (Published <-> Draft)
  const handleToggleStatus = async (item: AppNotification, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newStatus = item.status === 'draft' ? 'published' : 'draft';
    try {
      const adminUser = {
        id: currentUser?.id || 'admin',
        name: currentUser?.name || 'Administrator',
      };
      await ApiService.updateAnnouncement(
        item.id,
        {
          status: newStatus as any,
          targetAudience: item.targetAudience,
          targetStaffIds: item.targetStaffIds,
        },
        adminUser
      );
      showSuccess(`Announcement marked as ${newStatus}.`);
      setNotifications(prev =>
        prev.map(n => (n.id === item.id ? { ...n, status: newStatus as any } : n))
      );
    } catch (err: any) {
      showError(err, 'Failed to update announcement status.');
    }
  };

  // Check if an announcement is expired
  const isExpired = (item: AppNotification): boolean => {
    if (!item.expiryDate) return false;
    const nowStr = new Date().toISOString().split('T')[0];
    return item.expiryDate < nowStr;
  };

  // Filtering
  const filteredNotifications = useMemo(() => {
    return notifications.filter(n => {
      // Top Level Tab Filter
      if (filterType === 'unread') {
        if (n.read) return false;
      } else if (filterType !== 'all') {
        if (n.type !== filterType) return false;
      }

      // Announcement Sub-Filter (when filtering announcements specifically)
      if (filterType === 'announcement' || n.type === 'announcement') {
        if (announcementSubFilter === 'published') {
          if (n.status === 'draft' || isExpired(n)) return false;
        } else if (announcementSubFilter === 'draft') {
          if (n.status !== 'draft') return false;
        } else if (announcementSubFilter === 'scheduled') {
          if (n.status !== 'scheduled') return false;
        } else if (announcementSubFilter === 'expired') {
          if (!isExpired(n)) return false;
        }
      }

      return true;
    });
  }, [notifications, filterType, announcementSubFilter]);

  const paginatedNotifications = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredNotifications.slice(start, start + pageSize);
  }, [filteredNotifications, currentPage, pageSize]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const announcementCount = notifications.filter(n => n.type === 'announcement').length;

  const getTypeIcon = (type: string, priority?: string) => {
    if (type === 'announcement') {
      if (priority === 'urgent') return <AlertTriangle className="w-4 h-4 text-rose-500" />;
      if (priority === 'high') return <Zap className="w-4 h-4 text-amber-500" />;
      return <Sparkles className="w-4 h-4 text-brand-500" />;
    }
    switch (type) {
      case 'follow_up':
        return <Calendar className="w-4 h-4 text-amber-500" />;
      case 'attendance':
        return <Clock className="w-4 h-4 text-brand-500" />;
      case 'sale':
        return <ShoppingBag className="w-4 h-4 text-emerald-500" />;
      case 'purchase':
        return <Smartphone className="w-4 h-4 text-purple-500" />;
      case 'lead':
        return <UserCheck className="w-4 h-4 text-cyan-500" />;
      case 'staff_registration':
        return <Users className="w-4 h-4 text-indigo-500" />;
      case 'device_binding':
        return <Shield className="w-4 h-4 text-rose-500" />;
      case 'salary':
      case 'target':
        return <Wallet className="w-4 h-4 text-emerald-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="danger" size="xs">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning" size="xs">High</Badge>;
      case 'normal':
      default:
        return <Badge variant="neutral" size="xs">Standard</Badge>;
    }
  };

  const getStatusBadge = (item: AppNotification) => {
    if (isExpired(item)) {
      return <Badge variant="neutral" size="xs">Expired</Badge>;
    }
    switch (item.status) {
      case 'draft':
        return <Badge variant="neutral" size="xs">Draft</Badge>;
      case 'scheduled':
        return <Badge variant="info" size="xs">Scheduled</Badge>;
      case 'published':
      default:
        return <Badge variant="success" size="xs">Published</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <Card noPadding>
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight flex items-center gap-2">
              <span>Store Notifications & Announcements</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Publish team broadcasts, manage store announcements, and track real-time operational alerts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={openCreateModal}
            >
              New Announcement
            </Button>

            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                icon={CheckCheck}
                onClick={handleMarkAllAsRead}
              >
                Mark All Read ({unreadCount})
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={loadData}
              loading={loading}
              title="Refresh Notifications & Announcements"
              className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
            />
          </div>
        </div>

        {/* Primary Filter Tabs */}
        <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-slate-800/40 flex items-center space-x-2 overflow-x-auto text-xs border-b border-slate-100 dark:border-slate-800">
          {[
            { id: 'all', label: 'All Alerts', count: notifications.length },
            { id: 'unread', label: 'Unread Only', count: unreadCount },
            { id: 'announcement', label: 'Announcements', count: announcementCount },
            {
              id: 'follow_up',
              label: 'Lead Follow-ups',
              count: notifications.filter(n => n.type === 'follow_up').length,
            },
            {
              id: 'attendance',
              label: 'Attendance',
              count: notifications.filter(n => n.type === 'attendance').length,
            },
            {
              id: 'sale',
              label: 'Sales & Inventory',
              count: notifications.filter(n => n.type === 'sale').length,
            },
          ].map(tab => {
            const active = filterType === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setFilterType(tab.id);
                  setCurrentPage(1);
                }}
                className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all ${
                  active
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
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

        {/* Announcement Sub-Filters (When viewing Announcements) */}
        {(filterType === 'announcement' || filterType === 'all') && announcementCount > 0 && (
          <div className="px-5 py-2 bg-slate-50/30 dark:bg-slate-900/20 flex items-center gap-2 overflow-x-auto text-[11px] border-b border-slate-100/60 dark:border-slate-800/60">
            <span className="text-slate-400 dark:text-slate-500 font-semibold shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Status:
            </span>
            {[
              { id: 'all', label: 'All' },
              { id: 'published', label: 'Published & Active' },
              { id: 'draft', label: 'Drafts' },
              { id: 'scheduled', label: 'Scheduled' },
              { id: 'expired', label: 'Expired' },
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => {
                  setAnnouncementSubFilter(sub.id as any);
                  setCurrentPage(1);
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all ${
                  announcementSubFilter === sub.id
                    ? 'bg-brand-50 text-brand-600 dark:bg-brand-950/40 dark:text-brand-300 font-bold border border-brand-200 dark:border-brand-800'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Notifications / Announcements List */}
      <Card noPadding>
        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading notifications & announcements...</div>
        ) : filteredNotifications.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="All Caught Up"
              description="No notifications or announcements match your active filter."
              icon={Bell}
            />
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedNotifications.map(n => {
              const actionLabel = getNotificationActionLabel(n);
              const isAnnouncement = n.type === 'announcement';

              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleNotificationClick(n)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNotificationClick(n);
                    }
                  }}
                  className={`group p-4 sm:p-5 flex items-start justify-between space-x-4 transition-all cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-inset ${
                    n.read
                      ? 'bg-white dark:bg-[#0F192C] hover:bg-slate-50 dark:hover:bg-[#17243A] border-l-4 border-l-transparent'
                      : isAnnouncement
                      ? 'bg-amber-50/30 dark:bg-[#1b1c2e] hover:bg-amber-50/50 dark:hover:bg-[#212338] border-l-4 border-l-amber-500'
                      : 'bg-blue-50/40 dark:bg-[#122038] hover:bg-blue-50/70 dark:hover:bg-[#162948] border-l-4 border-l-brand-500'
                  }`}
                >
                  <div className="flex items-start space-x-3.5 min-w-0 flex-1">
                    <div className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-2xl shrink-0 mt-0.5 shadow-sm group-hover:scale-105 transition-transform">
                      {getTypeIcon(n.type, n.priority)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`text-xs font-extrabold truncate ${
                            n.read
                              ? 'text-slate-700 dark:text-slate-300'
                              : 'text-slate-900 dark:text-white'
                          }`}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                        )}
                        {isAnnouncement && getPriorityBadge(n.priority)}
                        {isAnnouncement && getStatusBadge(n)}
                        {isAnnouncement && (
                          <Badge variant="neutral" size="xs">
                            {n.targetAudience === 'specific_staff'
                              ? `Targeted (${n.targetStaffIds?.length || 1} staff)`
                              : 'All Staff'}
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed max-w-2xl line-clamp-2">
                        {n.body}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-[10px] text-slate-400 font-mono">
                        <span>
                          {n.timestamp ? new Date(n.timestamp).toLocaleString('en-IN') : 'Recent'}
                        </span>
                        {n.authorName && (
                          <span className="text-slate-500 font-sans">
                            By {n.authorName}
                          </span>
                        )}
                        {n.expiryDate && (
                          <span className={isExpired(n) ? 'text-rose-500 font-medium' : 'text-slate-500'}>
                            Expires: {n.expiryDate}
                          </span>
                        )}
                        {n.relatedId && (
                          <span className="text-slate-400 dark:text-[#71839D]">
                            Ref: {n.relatedId}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="flex items-center space-x-2 shrink-0 ml-3">
                    {isAnnouncement ? (
                      <div className="flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={e => openEditModal(n, e)}
                          title="Edit Announcement"
                          className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={e => handleToggleStatus(n, e)}
                          title={n.status === 'draft' ? 'Publish Announcement' : 'Move to Draft'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            n.status === 'draft'
                              ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                              : 'text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                          }`}
                        >
                          {n.status === 'draft' ? <Send className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                        </button>
                        <button
                          type="button"
                          onClick={e => openDeleteModal(n, e)}
                          title="Delete Announcement"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="hidden sm:inline-flex items-center text-[11px] font-semibold text-brand-600 dark:text-blue-400 group-hover:underline">
                          {actionLabel}
                        </span>
                        <Badge variant={n.read ? 'neutral' : 'primary'} size="xs" dot={!n.read}>
                          {n.read ? 'Read' : 'New'}
                        </Badge>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-brand-500 group-hover:translate-x-1 transition-all shrink-0" />
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {filteredNotifications.length > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredNotifications.length}
            pageSize={pageSize}
            onPageChange={page => setCurrentPage(page)}
            onPageSizeChange={size => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </Card>

      {/* Create / Edit Store Announcement Modal */}
      <Modal
        isOpen={announcementModalOpen}
        onClose={() => setAnnouncementModalOpen(false)}
        title={modalMode === 'create' ? 'Broadcast Store Announcement' : 'Edit Store Announcement'}
        subtitle={
          modalMode === 'create'
            ? 'Publish a notification to staff members on their mobile app'
            : 'Update announcement content, priority, target audience, or expiration'
        }
      >
        <form onSubmit={handleSaveAnnouncement} className="space-y-4">
          {announcementMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{announcementMsg}</span>
            </div>
          )}

          <Input
            label="Announcement Title *"
            required
            value={announcementTitle}
            onChange={e => setAnnouncementTitle(e.target.value)}
            placeholder="e.g. Diwali Sales Bonus Scheme / Store Stock Meeting"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Priority Level"
              value={announcementPriority}
              onChange={e => setAnnouncementPriority(e.target.value as any)}
            >
              <option value="normal">Normal (Standard broadcast feed)</option>
              <option value="high">High (Featured banner in app)</option>
              <option value="urgent">Urgent (Requires immediate attention)</option>
            </Select>

            <Select
              label="Publication Status"
              value={announcementStatus}
              onChange={e => setAnnouncementStatus(e.target.value as any)}
            >
              <option value="published">Publish Immediately</option>
              <option value="draft">Save as Draft (Visible only to Admin)</option>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Start Date"
              type="date"
              value={announcementStartDate}
              onChange={e => setAnnouncementStartDate(e.target.value)}
            />
            <Input
              label="Expiry Date (Optional)"
              type="date"
              value={announcementExpiryDate}
              onChange={e => setAnnouncementExpiryDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Target Audience
            </label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <button
                type="button"
                onClick={() => setAnnouncementAudience('all')}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                  announcementAudience === 'all'
                    ? 'border-brand-500 bg-brand-50/50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                All Store Staff
              </button>
              <button
                type="button"
                onClick={() => setAnnouncementAudience('specific_staff')}
                className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                  announcementAudience === 'specific_staff'
                    ? 'border-brand-500 bg-brand-50/50 text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
                    : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                Specific Staff Members
              </button>
            </div>

            {announcementAudience === 'specific_staff' && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto space-y-1.5 text-xs">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 block mb-1">
                  Select Recipient Staff:
                </span>
                {staffUsers.length === 0 ? (
                  <p className="text-slate-400 text-xs italic">No active staff members found in directory.</p>
                ) : (
                  staffUsers.map(user => {
                    const checked = announcementTargetStaff.includes(user.id);
                    return (
                      <label
                        key={user.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 p-1 rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={e => {
                            if (e.target.checked) {
                              setAnnouncementTargetStaff(prev => [...prev, user.id]);
                            } else {
                              setAnnouncementTargetStaff(prev => prev.filter(id => id !== user.id));
                            }
                          }}
                          className="rounded text-brand-600 focus:ring-brand-500 h-3.5 w-3.5"
                        />
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {user.name} ({user.designation || 'Staff'})
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Message Content *
            </label>
            <textarea
              required
              rows={4}
              value={announcementBody}
              onChange={e => setAnnouncementBody(e.target.value)}
              placeholder="Type your message for the team here..."
              className="w-full rounded-xl border border-slate-200 dark:border-[#24344D] bg-white dark:bg-[#0D1729] p-3 text-xs text-slate-900 dark:text-[#E8EEF8] placeholder-slate-400 dark:placeholder-[#71839D] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-[#194D9C]"
            />
          </div>

          <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-[#24344D]">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setAnnouncementModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              icon={Send}
              loading={announcementLoading}
            >
              {modalMode === 'create' ? 'Dispatch Announcement' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View Full Announcement Details Modal */}
      <Modal
        isOpen={Boolean(selectedAnnouncement)}
        onClose={() => setSelectedAnnouncement(null)}
        title="Store Announcement Details"
        subtitle={
          selectedAnnouncement && (
            <span>
              Published on{' '}
              {selectedAnnouncement.timestamp
                ? new Date(selectedAnnouncement.timestamp).toLocaleString('en-IN')
                : 'Recent'}
            </span>
          )
        }
      >
        {selectedAnnouncement && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-[#17243A] rounded-xl border border-slate-100 dark:border-[#24344D] space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                  Announcement Title
                </span>
                <div className="flex items-center gap-1.5">
                  {getPriorityBadge(selectedAnnouncement.priority)}
                  {getStatusBadge(selectedAnnouncement)}
                </div>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                {selectedAnnouncement.title}
              </h4>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px] p-3 bg-slate-50/50 dark:bg-slate-800/30 rounded-xl">
              <div>
                <span className="text-slate-400 block text-[10px]">TARGET AUDIENCE</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedAnnouncement.targetAudience === 'specific_staff'
                    ? `Specific Staff (${selectedAnnouncement.targetStaffIds?.length || 1} recipients)`
                    : 'All Store Staff'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">AUTHOR</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {selectedAnnouncement.authorName || 'Administrator'}
                </span>
              </div>
              {selectedAnnouncement.expiryDate && (
                <div>
                  <span className="text-slate-400 block text-[10px]">EXPIRATION</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {selectedAnnouncement.expiryDate} {isExpired(selectedAnnouncement) ? '(Expired)' : ''}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase text-slate-400 tracking-wider">
                Message Content
              </span>
              <div className="p-4 bg-white dark:bg-[#0D1729] rounded-xl border border-slate-200 dark:border-[#24344D] text-slate-800 dark:text-[#E8EEF8] leading-relaxed whitespace-pre-wrap font-sans">
                {selectedAnnouncement.body}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-[#24344D]">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={Edit2}
                  onClick={() => {
                    const toEdit = selectedAnnouncement;
                    setSelectedAnnouncement(null);
                    openEditModal(toEdit);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  icon={Trash2}
                  onClick={() => {
                    const toDelete = selectedAnnouncement;
                    setSelectedAnnouncement(null);
                    openDeleteModal(toDelete);
                  }}
                >
                  Delete
                </Button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedAnnouncement(null)}
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setAnnouncementToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete Announcement"
        message={
          announcementToDelete ? (
            <span>
              Are you sure you want to permanently delete{' '}
              <strong className="text-slate-900 dark:text-white">"{announcementToDelete.title}"</strong>? This announcement will be removed from all staff mobile devices.
            </span>
          ) : (
            'Are you sure you want to delete this announcement?'
          )
        }
        confirmText="Delete Announcement"
        isDestructive={true}
        loading={deleteLoading}
      />
    </div>
  );
};
