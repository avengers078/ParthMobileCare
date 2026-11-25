import React, { useEffect, useState, useMemo } from 'react';
import { onSnapshot, query, collection, orderBy, limit } from 'firebase/firestore';
import { db, FIRESTORE_COLLECTIONS } from '../services/firebase';
import {
  CalendarCheck,
  Search,
  Filter,
  Clock,
  MapPin,
  ShieldCheck,
  AlertTriangle,
  Edit3,
  CheckCircle,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  Modal,
  Badge,
  EmptyState,
  StatCard,
  Button,
  ActionButton,
  Input,
  Select,
  Card,
  ExportDropdown,
  TablePagination,
} from '../components/common';
import { useAuth } from '../context/AuthContext';
import { AttendanceRecord, User, AttendanceStatus } from '../types';
import { NavigationParams } from '../utils/notificationRouter';

interface AttendancePageProps {
  initialParams?: NavigationParams | null;
  onClearParams?: () => void;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ initialParams, onClearParams }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const getLocalDateString = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Filters: Default to 'all' so all attendance records are immediately visible
  const [dateMode, setDateMode] = useState<'single' | 'range' | 'all'>('all');
  const [selectedDate, setSelectedDate] = useState<string>(getLocalDateString);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [search, setSearch] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Manual Correction Modal
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<AttendanceRecord | null>(null);
  const [correctionStatus, setCorrectionStatus] = useState<AttendanceStatus>('present');
  const [correctionPunchIn, setCorrectionPunchIn] = useState('');
  const [correctionPunchOut, setCorrectionPunchOut] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [correctionLoading, setCorrectionLoading] = useState(false);
  const [correctionError, setCorrectionError] = useState('');

  const loadData = async (forceRefresh = false) => {
    if (records.length === 0) {
      setLoading(true);
    }
    try {
      const [r, u] = await Promise.all([
        ApiService.getAttendanceRecords(300, forceRefresh),
        ApiService.getUsers(forceRefresh),
      ]);
      setRecords(r);
      setUsers(u);
    } catch (err) {
      console.warn('Attendance load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Real-time Firestore sync listener for instant mobile punch detection
    let unsubscribe: (() => void) | null = null;
    try {
      const q = query(
        collection(db, FIRESTORE_COLLECTIONS.ATTENDANCE),
        orderBy('date', 'desc'),
        limit(300)
      );
      unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const liveRecords = snap.docs.map(d => ({ ...d.data(), id: d.id } as AttendanceRecord));
            setRecords(liveRecords);
            setLoading(false);
          }
        },
        (err) => {
          console.warn('[AttendancePage] Real-time listener note:', err?.message);
        }
      );
    } catch (e) {
      console.warn('[AttendancePage] Real-time listener init error:', e);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!initialParams || loading) return;

    if (initialParams.staffId) {
      setSelectedStaffId(initialParams.staffId);
    }
    if (initialParams.date) {
      setDateMode('single');
      setSelectedDate(initialParams.date);
    }
    if (initialParams.recordId && records.length > 0) {
      const match = records.find(r => r.id === initialParams.recordId);
      if (match) {
        handleOpenCorrection(match);
      }
    }
    onClearParams?.();
  }, [initialParams, records, loading]);

  // Quick Date Shortcut Helpers
  const setQuickDate = (type: 'all' | 'today' | 'yesterday' | 'week' | 'month') => {
    const now = new Date();
    if (type === 'all') {
      setDateMode('all');
    } else if (type === 'today') {
      setDateMode('single');
      setSelectedDate(getLocalDateString());
    } else if (type === 'yesterday') {
      setDateMode('single');
      const y = new Date(now.getTime() - 86400000);
      const year = y.getFullYear();
      const month = String(y.getMonth() + 1).padStart(2, '0');
      const day = String(y.getDate()).padStart(2, '0');
      setSelectedDate(`${year}-${month}-${day}`);
    } else if (type === 'week') {
      setDateMode('range');
      const day = now.getDay();
      const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.setDate(diffToMonday));
      setStartDate(monday.toISOString().slice(0, 10));
      setEndDate(getLocalDateString());
    } else if (type === 'month') {
      setDateMode('range');
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(getLocalDateString());
    }
  };

  const handleOpenCorrection = (record: AttendanceRecord) => {
    setSelectedRecord(record);
    setCorrectionStatus(record.status);
    setCorrectionPunchIn(record.punchInTime || '');
    setCorrectionPunchOut(record.punchOutTime || '');
    setCorrectionReason('');
    setCorrectionError('');
    setCorrectionModalOpen(true);
  };

  const handleSaveCorrection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecord) return;
    if (!correctionReason.trim()) {
      setCorrectionError('A valid administrative reason is required for audit logs.');
      return;
    }

    setCorrectionLoading(true);
    try {
      await ApiService.correctAttendanceRecord(
        selectedRecord.id,
        {
          status: correctionStatus,
          punchInTime: correctionPunchIn || undefined,
          punchOutTime: correctionPunchOut || undefined,
          isLate: correctionStatus === 'late',
        },
        currentUser?.name || 'Administrator',
        correctionReason.trim()
      );
      showSuccess('Attendance correction saved successfully.');
      setCorrectionModalOpen(false);
      await loadData();
    } catch (err: any) {
      setCorrectionError(err?.message || 'Failed to submit attendance correction.');
      showError(err, 'Failed to submit attendance correction.');
    } finally {
      setCorrectionLoading(false);
    }
  };

  const filtered = useMemo(() => {
    return records.filter(r => {
      let matchDate = true;
      if (dateMode === 'single') {
        matchDate = !selectedDate || r.date === selectedDate;
      } else if (dateMode === 'range') {
        if (startDate && r.date < startDate) matchDate = false;
        if (endDate && r.date > endDate) matchDate = false;
      }
      const matchStaff = selectedStaffId === 'all' || r.userId === selectedStaffId;
      const matchStatus = selectedStatus === 'all' || r.status === selectedStatus;
      const matchSearch =
        !search.trim() ||
        r.userName.toLowerCase().includes(search.toLowerCase()) ||
        r.userId.toLowerCase().includes(search.toLowerCase()) ||
        r.date.includes(search);

      return matchDate && matchStaff && matchStatus && matchSearch;
    });
  }, [records, dateMode, selectedDate, startDate, endDate, selectedStaffId, selectedStatus, search]);

  const presentCount = filtered.filter(r => r.status === 'present').length;
  const lateCount = filtered.filter(r => r.status === 'late' || r.isLate).length;
  const halfDayCount = filtered.filter(r => r.status === 'half_day').length;
  const totalHoursSum = filtered.reduce((acc, r) => acc + (r.totalHours || 0), 0);

  // Paginated records
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // Export prepared data
  const exportData = useMemo(() => {
    return filtered.map(r => ({
      Staff_Name: r.userName,
      Staff_ID: r.userId,
      Date: r.date,
      Status: r.status.toUpperCase(),
      Punch_In: r.punchInTime || '—',
      Punch_In_Distance: r.punchInCoords ? `${r.punchInCoords.distanceMeters}m` : '—',
      Punch_Out: r.punchOutTime || '—',
      Punch_Out_Distance: r.punchOutCoords ? `${r.punchOutCoords.distanceMeters}m` : '—',
      Total_Hours: r.totalHours || 0,
      Verification_Method: r.verificationMethod || 'device_binding',
      Audited_Correction: r.isCorrected ? 'YES' : 'NO',
      Correction_Reason: r.correctionReason || '—',
    }));
  }, [filtered]);

  const dateLabel =
    dateMode === 'single'
      ? selectedDate || 'All'
      : `${startDate || 'Start'}_to_${endDate || 'End'}`;

  return (
    <div className="space-y-6">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Present Records"
          value={presentCount}
          subtitle={`Out of ${filtered.length} matching entries`}
          icon={CalendarCheck}
          color="green"
        />
        <StatCard
          title="Late Arrivals"
          value={lateCount}
          subtitle="Store grace period exceeded"
          icon={AlertTriangle}
          color="amber"
        />
        <StatCard
          title="Half Day Shifts"
          value={halfDayCount}
          subtitle="Partial shifts completed"
          icon={Clock}
          color="purple"
        />
        <StatCard
          title="Duty Hours Logged"
          value={`${totalHoursSum.toFixed(1)} hrs`}
          subtitle={`Average: ${filtered.length > 0 ? (totalHoursSum / filtered.length).toFixed(1) : 0} hrs/record`}
          icon={ShieldCheck}
          color="blue"
        />
      </div>

      {/* Filter and Control Card */}
      <Card noPadding>
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            {/* Search Input */}
            <div className="w-full lg:w-80">
              <Input
                placeholder="Search staff name or ID..."
                icon={Search}
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                onClear={() => setSearch('')}
              />
            </div>

            {/* Quick Date Presets and Export */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-[#0D1729] p-1 rounded-xl border border-transparent dark:border-[#24344D]">
                <button
                  type="button"
                  onClick={() => setQuickDate('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    dateMode === 'all'
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'hover:bg-white dark:hover:bg-[#1C2A42] text-slate-600 dark:text-[#94A3B8]'
                  }`}
                >
                  All Records
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate('today')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors ${
                    dateMode === 'single' && selectedDate === getLocalDateString()
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'hover:bg-white dark:hover:bg-[#1C2A42] text-slate-600 dark:text-[#94A3B8]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate('yesterday')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-white dark:hover:bg-[#1C2A42] text-slate-600 dark:text-[#94A3B8] transition-colors"
                >
                  Yesterday
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate('week')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-white dark:hover:bg-[#1C2A42] text-slate-600 dark:text-[#94A3B8] transition-colors"
                >
                  This Week
                </button>
                <button
                  type="button"
                  onClick={() => setQuickDate('month')}
                  className="px-2.5 py-1 text-xs font-semibold rounded-lg hover:bg-white dark:hover:bg-[#1C2A42] text-slate-600 dark:text-[#94A3B8] transition-colors"
                >
                  This Month
                </button>
              </div>

              <ExportDropdown
                data={exportData}
                filename={`Attendance_${dateLabel}`}
                sheetName="Attendance"
                disabled={filtered.length === 0}
              />

              <Button
                variant="outline"
                size="sm"
                icon={RotateCcw}
                onClick={() => loadData(true)}
                loading={loading}
                title="Reload Attendance Records"
                className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
              />
            </div>
          </div>

          {/* Detailed Filters Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 pt-2">
            {/* Mode & Date Picker */}
            <div className="sm:col-span-2 lg:col-span-5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Date Filter
              </label>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDateMode(dateMode === 'all' ? 'single' : dateMode === 'single' ? 'range' : 'all')}
                  className="h-10 px-3 text-[11px] font-bold rounded-xl border border-slate-200 dark:border-[#24344D] bg-slate-50 dark:bg-[#17243A] text-slate-600 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#1C2A42] shrink-0 transition-colors self-start sm:self-auto"
                >
                  {dateMode === 'all' ? 'All Dates' : dateMode === 'single' ? '1 Day' : 'Range'}
                </button>
                {dateMode === 'all' ? (
                  <div className="flex-1 w-full min-w-0 h-10 rounded-xl border border-dashed border-slate-300 dark:border-[#24344D] bg-slate-50/50 dark:bg-[#0D1729]/50 flex items-center px-3">
                    <span className="text-xs text-slate-500 dark:text-[#94A3B8]">Showing attendance records across all dates</span>
                  </div>
                ) : dateMode === 'single' ? (
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={e => {
                      setSelectedDate(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="flex-1 w-full min-w-0 h-10 rounded-xl border border-slate-200 dark:border-[#24344D] bg-white dark:bg-[#0D1729] text-xs px-3 text-slate-900 dark:text-[#E8EEF8] focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                  />
                ) : (
                  <div className="flex-1 w-full min-w-0 flex items-center gap-1.5">
                    <input
                      type="date"
                      value={startDate}
                      onChange={e => {
                        setStartDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-1/2 min-w-0 h-10 rounded-xl border border-slate-200 dark:border-[#24344D] bg-white dark:bg-[#0D1729] text-xs px-2 text-slate-900 dark:text-[#E8EEF8] focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                    <span className="text-slate-400 dark:text-[#71839D] text-xs shrink-0">–</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={e => {
                        setEndDate(e.target.value);
                        setCurrentPage(1);
                      }}
                      className="w-1/2 min-w-0 h-10 rounded-xl border border-slate-200 dark:border-[#24344D] bg-white dark:bg-[#0D1729] text-xs px-2 text-slate-900 dark:text-[#E8EEF8] focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Staff Filter */}
            <div className="sm:col-span-1 lg:col-span-3">
              <Select
                label="Staff Member"
                value={selectedStaffId}
                onChange={e => {
                  setSelectedStaffId(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Staff Members ({users.length})</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.designation || u.role})
                  </option>
                ))}
              </Select>
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-1 lg:col-span-2">
              <Select
                label="Attendance Status"
                value={selectedStatus}
                onChange={e => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late Arrival</option>
                <option value="half_day">Half Day</option>
                <option value="absent">Absent</option>
              </Select>
            </div>

            {/* Reset Filters */}
            <div className="sm:col-span-2 lg:col-span-2">
              <label className="hidden sm:block text-xs font-semibold text-transparent mb-1.5 select-none" aria-hidden="true">
                &nbsp;
              </label>
              <Button
                variant="outline"
                size="md"
                className="w-full h-10"
                onClick={() => {
                  setDateMode('single');
                  setSelectedDate(new Date().toISOString().slice(0, 10));
                  setStartDate('');
                  setEndDate('');
                  setSelectedStaffId('all');
                  setSelectedStatus('all');
                  setSearch('');
                  setCurrentPage(1);
                }}
              >
                Reset All Filters
              </Button>
            </div>
          </div>
        </div>

        {/* Data Table */}
        {loading && records.length === 0 ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Attendance Records Found"
              description="No attendance events match your active filters or date criteria."
              actionText="Reset Filters"
              onAction={() => {
                setSelectedDate(new Date().toISOString().slice(0, 10));
                setSelectedStaffId('all');
                setSelectedStatus('all');
                setSearch('');
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs min-w-[880px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800 select-none">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Punch In</th>
                  <th className="py-3 px-4">Punch Out</th>
                  <th className="py-3 px-4">Hours</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-800/95 z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedRecords.map(rec => (
                  <tr
                    key={rec.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900 dark:text-white leading-tight">
                        {rec.userName}
                      </p>
                      <span className="text-[10px] text-slate-400 font-mono">{rec.userId}</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                      {rec.date}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-800 dark:text-slate-200">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{rec.punchInTime || '—'}</span>
                      </div>
                      {rec.punchInCoords && (
                        <span className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span
                            className={
                              rec.punchInCoords.distanceMeters <= 50
                                ? 'text-emerald-600 font-medium'
                                : 'text-amber-600 font-medium'
                            }
                          >
                            {rec.punchInCoords.distanceMeters}m from shop
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                      <div className="flex items-center space-x-1.5 font-semibold text-slate-800 dark:text-slate-200">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{rec.punchOutTime || '—'}</span>
                      </div>
                      {rec.punchOutCoords && (
                        <span className="text-[10px] text-slate-400 flex items-center space-x-1 mt-0.5">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span
                            className={
                              rec.punchOutCoords.distanceMeters <= 50
                                ? 'text-emerald-600 font-medium'
                                : 'text-amber-600 font-medium'
                            }
                          >
                            {rec.punchOutCoords.distanceMeters}m from shop
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                      {rec.totalHours ? `${rec.totalHours} hrs` : '—'}
                    </td>
                    <td className="py-3.5 px-4">
                      {rec.verificationMethod === 'manual_override' ? (
                        <Badge variant="warning" size="xs">
                          Manual Correction
                        </Badge>
                      ) : rec.faceVerificationScore ? (
                        <Badge variant="info" size="xs">
                          Biometric Face Verified
                        </Badge>
                      ) : (
                        <Badge variant="neutral" size="xs">
                          Device Geofence
                        </Badge>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <Badge
                        variant={
                          rec.status === 'present'
                            ? 'success'
                            : rec.status === 'late'
                            ? 'warning'
                            : 'neutral'
                        }
                        size="xs"
                        dot
                      >
                        {rec.status.toUpperCase()}
                      </Badge>
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                      <div className="inline-flex items-center justify-end">
                        <ActionButton
                          icon={Edit3}
                          label="Manual Correction"
                          onClick={() => handleOpenCorrection(rec)}
                          variant="ghost"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Controls */}
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

      {/* Manual Correction Modal */}
      <Modal
        isOpen={correctionModalOpen}
        onClose={() => setCorrectionModalOpen(false)}
        title="Administrative Attendance Correction"
        subtitle={
          selectedRecord && (
            <span>
              Modifying shift record for <strong className="text-slate-800 dark:text-white">{selectedRecord.userName}</strong> on {selectedRecord.date}
            </span>
          )
        }
      >
        {selectedRecord && (
          <form onSubmit={handleSaveCorrection} className="space-y-4">
            {correctionError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
                {correctionError}
              </div>
            )}

            <Select
              label="Shift Status"
              value={correctionStatus}
              onChange={e => setCorrectionStatus(e.target.value as AttendanceStatus)}
            >
              <option value="present">Present (On-Time)</option>
              <option value="late">Late Arrival</option>
              <option value="half_day">Half Day Shift</option>
              <option value="absent">Mark Absent</option>
            </Select>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Punch In Time"
                value={correctionPunchIn}
                onChange={e => setCorrectionPunchIn(e.target.value)}
                placeholder="e.g. 10:00:00"
              />
              <Input
                label="Punch Out Time"
                value={correctionPunchOut}
                onChange={e => setCorrectionPunchOut(e.target.value)}
                placeholder="e.g. 20:30:00"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Audit Reason *
              </label>
              <textarea
                required
                rows={3}
                value={correctionReason}
                onChange={e => setCorrectionReason(e.target.value)}
                placeholder="Explain why this manual attendance override is being applied (required for security audit trail)..."
                className="w-full rounded-xl border border-slate-200 dark:border-[#24344D] bg-white dark:bg-[#0D1729] p-3 text-xs text-slate-900 dark:text-[#E8EEF8] placeholder-slate-400 dark:placeholder-[#71839D] focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-[#194D9C]"
              />
            </div>

            <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-[#24344D]">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setCorrectionModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={correctionLoading}
              >
                Apply Correction
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
