import React, { useEffect, useState, useMemo } from 'react';
import {
  ShieldAlert,
  Search,
  Clock,
  User,
  Activity,
  FileText,
  Calendar,
  Filter,
  Eye,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { Modal } from '../components/common/Modal';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { ActionButton } from '../components/common/ActionButton';
import { Card } from '../components/common/Card';
import { Input } from '../components/common/Input';
import { Select } from '../components/common/Select';
import { EmptyState } from '../components/common/EmptyState';
import { ExportDropdown } from '../components/common/ExportDropdown';
import { TablePagination } from '../components/common/TablePagination';
import { AdminAuditEntry } from '../types';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AdminAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('all');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | '7days' | '30days'>('all');
  const [selectedLog, setSelectedLog] = useState<AdminAuditEntry | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await ApiService.getAdminAuditLogs(300);
      setLogs(data);
    } catch (err) {
      console.warn('Audit logs load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
    const thirtyDaysAgo = now.getTime() - 30 * 24 * 60 * 60 * 1000;

    return logs.filter(item => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        item.adminName?.toLowerCase().includes(q) ||
        item.actionType?.toLowerCase().includes(q) ||
        item.targetRecordTitle?.toLowerCase().includes(q) ||
        item.targetRecordId?.toLowerCase().includes(q) ||
        item.details?.toLowerCase().includes(q);

      const matchAction = selectedAction === 'all' || item.actionType === selectedAction;

      let matchDate = true;
      const itemTime = new Date(item.timestamp).getTime();
      if (dateFilter === 'today') {
        matchDate = itemTime >= todayStart;
      } else if (dateFilter === '7days') {
        matchDate = itemTime >= sevenDaysAgo;
      } else if (dateFilter === '30days') {
        matchDate = itemTime >= thirtyDaysAgo;
      }

      return matchSearch && matchAction && matchDate;
    });
  }, [logs, search, selectedAction, dateFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedAction, dateFilter, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const exportData = useMemo(() => {
    return filtered.map(l => ({
      Timestamp: new Date(l.timestamp).toLocaleString('en-IN'),
      Admin_Actor: l.adminName,
      Admin_ID: l.adminId,
      Action_Type: l.actionType,
      Target_ID: l.targetRecordId,
      Target_Title: l.targetRecordTitle || '—',
      Details: l.details || '',
    }));
  }, [filtered]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'staff_provisioned':
        return <Badge variant="success" size="sm">Staff Provisioned</Badge>;
      case 'staff_status_changed':
        return <Badge variant="warning" size="sm">Status Changed</Badge>;
      case 'attendance_corrected':
        return <Badge variant="primary" size="sm">Attendance Correction</Badge>;
      case 'payroll_generated':
        return <Badge variant="info" size="sm">Payroll Finalized</Badge>;
      case 'lead_deleted':
        return <Badge variant="danger" size="sm">Lead Deleted</Badge>;
      case 'lead_reassigned':
        return <Badge variant="warning" size="sm">Lead Reassigned</Badge>;
      case 'price_bulk_imported':
        return <Badge variant="success" size="sm">Bulk Prices Import</Badge>;
      case 'store_announcement':
        return <Badge variant="primary" size="sm">Store Announcement</Badge>;
      default:
        return <Badge variant="neutral" size="sm">{(action || 'ACTION').replace(/_/g, ' ').toUpperCase()}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Filter Controls */}
      <Card
        title="Security & Audit Trail"
        subtitle="Immutable administrative action records covering staff approvals, attendance corrections, payroll, and inventory"
        headerAction={
          <ExportDropdown
            data={exportData}
            filename="Admin_Security_Audit_Logs"
            disabled={filtered.length === 0}
          />
        }
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-2">
          {/* Search & Action Filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <div className="w-full sm:w-72">
              <Input
                placeholder="Search actor, action, target..."
                icon={Search}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onClear={() => setSearch('')}
              />
            </div>

            <div className="w-full sm:w-56">
              <Select
                value={selectedAction}
                onChange={e => setSelectedAction(e.target.value)}
                icon={Filter}
                options={[
                  { value: 'all', label: 'All Action Types' },
                  { value: 'staff_provisioned', label: 'Staff Provisioned' },
                  { value: 'staff_status_changed', label: 'Staff Status Change' },
                  { value: 'attendance_corrected', label: 'Attendance Correction' },
                  { value: 'payroll_generated', label: 'Payroll Generation' },
                  { value: 'lead_deleted', label: 'Lead Deletion' },
                  { value: 'lead_reassigned', label: 'Lead Reassigned' },
                  { value: 'price_bulk_imported', label: 'Bulk Price Import' },
                  { value: 'store_announcement', label: 'Store Announcement' },
                ]}
              />
            </div>
          </div>

          {/* Quick Date Filters */}
          <div className="inline-flex rounded-xl p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 self-start sm:self-auto shrink-0">
            {[
              { id: 'all' as const, label: 'All' },
              { id: 'today' as const, label: 'Today' },
              { id: '7days' as const, label: 'Last 7 Days' },
              { id: '30days' as const, label: 'Last 30 Days' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  dateFilter === tab.id
                    ? 'bg-white dark:bg-[#194D9C] text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-[#94A3B8] hover:text-slate-900 dark:hover:text-[#E8EEF8]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* Logs Table Card */}
      <Card noPadding>
        {loading ? (
          <div className="p-16 text-center">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-slate-500 font-medium">Loading administrative audit logs...</p>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No Audit Logs Found"
            description={
              search || selectedAction !== 'all' || dateFilter !== 'all'
                ? 'No administrative logs match your current filter criteria.'
                : 'All administrative actions across staff, leads, payroll, and price catalog are recorded here automatically.'
            }
            icon={ShieldAlert}
            action={
              (search || selectedAction !== 'all' || dateFilter !== 'all') ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch('');
                    setSelectedAction('all');
                    setDateFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div>
            <div className="overflow-x-auto min-w-0">
              <table className="w-full text-left text-xs min-w-[880px]">
                <thead className="bg-slate-50/80 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-100 dark:border-slate-800 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Timestamp</th>
                    <th className="py-3.5 px-4">Admin Actor</th>
                    <th className="py-3.5 px-4">Action</th>
                    <th className="py-3.5 px-4">Target Resource</th>
                    <th className="py-3.5 px-4">Summary Notes</th>
                    <th className="py-3.5 px-4 text-right sticky right-0 bg-slate-50/90 dark:bg-slate-800/95 z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {paginatedLogs.map(l => (
                    <tr
                      key={l.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono text-[11px] whitespace-nowrap">
                        {new Date(l.timestamp).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {l.adminName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {l.adminId ? `${l.adminId.slice(0, 10)}...` : '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {getActionBadge(l.actionType)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-semibold text-slate-800 dark:text-slate-200 block truncate max-w-xs">
                          {l.targetRecordTitle || 'Resource'}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">
                          {l.targetRecordId ? l.targetRecordId.slice(0, 16) : '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                        {l.details || '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                        <div className="inline-flex items-center justify-end">
                          <ActionButton
                            variant="ghost"
                            icon={Eye}
                            label="Inspect Audit Record"
                            onClick={() => setSelectedLog(l)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-800">
              <TablePagination
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={filtered.length}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          </div>
        )}
      </Card>

      {/* Log Detail Modal */}
      <Modal
        isOpen={!!selectedLog}
        onClose={() => setSelectedLog(null)}
        title="Security Audit Log Inspection"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Timestamp
                </span>
                <p className="font-mono font-bold text-slate-900 dark:text-white mt-1">
                  {new Date(selectedLog.timestamp).toLocaleString('en-IN', {
                    dateStyle: 'full',
                    timeStyle: 'medium',
                  })}
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Admin Actor
                </span>
                <p className="font-bold text-slate-900 dark:text-white mt-1">
                  {selectedLog.adminName}
                </p>
                <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                  UID: {selectedLog.adminId}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Action Classification
                </span>
                <div className="mt-1.5">{getActionBadge(selectedLog.actionType)}</div>
              </div>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Target Resource
                </span>
                <p className="font-semibold text-slate-900 dark:text-white mt-1">
                  {selectedLog.targetRecordTitle || 'Unspecified'}
                </p>
                <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                  ID: {selectedLog.targetRecordId || '—'}
                </p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-[#17243A] rounded-xl border border-slate-100 dark:border-[#24344D]">
              <span className="text-[10px] uppercase font-bold text-slate-400 dark:text-[#71839D] tracking-wider block mb-1.5">
                Audit Remarks & Details
              </span>
              <p className="text-slate-800 dark:text-[#E8EEF8] leading-relaxed font-mono text-[11px] bg-white dark:bg-[#0D1729] p-3 rounded-lg border border-slate-200 dark:border-[#24344D] whitespace-pre-wrap break-all">
                {selectedLog.details || 'No additional details logged.'}
              </p>
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="secondary" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
