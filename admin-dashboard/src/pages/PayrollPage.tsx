import React, { useEffect, useState, useMemo } from 'react';
import {
  Wallet,
  Download,
  Calendar,
  DollarSign,
  User,
  CheckCircle2,
  Clock,
  FileText,
  Search,
  RotateCcw,
  CreditCard,
  Building,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { ApiService } from '../services/api';
import {
  Modal,
  Badge,
  EmptyState,
  Button,
  Input,
  Select,
  Card,
  ExportDropdown,
  TablePagination,
} from '../components/common';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { User as StaffUser, SalarySlip, SalesTarget } from '../types';
import { NavigationParams } from '../utils/notificationRouter';

interface PayrollPageProps {
  initialParams?: NavigationParams | null;
  onClearParams?: () => void;
}

export const PayrollPage: React.FC<PayrollPageProps> = ({ initialParams, onClearParams }) => {
  const { currentUser } = useAuth();
  const { showSuccess, showError } = useToast();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [slips, setSlips] = useState<SalarySlip[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // Month selector YYYY-MM
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState<'all' | 'paid' | 'pending' | 'unissued'>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Generate Slip Modal
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffUser | null>(null);
  const [bonus, setBonus] = useState(1500);
  const [deductions, setDeductions] = useState(0);
  const [workingDays, setWorkingDays] = useState(26);
  const [presentDays, setPresentDays] = useState(26);
  const [lateDays, setLateDays] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Payment Confirmation Modal
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedSlipForPayment, setSelectedSlipForPayment] = useState<SalarySlip | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'UPI' | 'Cash'>('Bank Transfer');
  const [transactionRef, setTransactionRef] = useState('');
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);

  const loadPayrollData = async (forceRefresh = false) => {
    if (users.length === 0) {
      setLoading(true);
    }
    try {
      const [u, s, t] = await Promise.all([
        ApiService.getUsers(forceRefresh),
        ApiService.getSalarySlips(selectedMonth, forceRefresh),
        ApiService.getSalesTargets(selectedMonth, forceRefresh),
      ]);
      setUsers(u.filter(user => user.isActive !== false && user.role === 'staff'));
      setSlips(s);
      setTargets(t);
    } catch (err) {
      console.warn('Payroll load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollData();
  }, [selectedMonth]);

  useEffect(() => {
    if (!initialParams || loading) return;

    if (initialParams.month) {
      setSelectedMonth(initialParams.month);
    }
    if (initialParams.staffId) {
      const staff = users.find(u => u.id === initialParams.staffId);
      if (staff) {
        setSelectedStaff(staff);
        handleOpenGenerate(staff);
      } else if (users.length > 0) {
        showError(new Error('Record unavailable'), 'This record is no longer available.');
      }
    }
    onClearParams?.();
  }, [initialParams, users, loading]);

  const handleOpenGenerate = async (staff: StaffUser) => {
    setSelectedStaff(staff);
    setAttendanceLoading(true);
    setGenerateModalOpen(true);
    setBonus(1500);
    setDeductions(0);
    setWorkingDays(26);

    try {
      const monthAttendance = await ApiService.getStaffAttendanceForMonth(staff.id, selectedMonth);
      const computedPresent = monthAttendance.filter(
        r => r.status === 'present' || r.status === 'late' || r.status === 'half_day'
      ).length;
      const computedLate = monthAttendance.filter(r => r.isLate).length;

      setPresentDays(computedPresent > 0 ? computedPresent : 26);
      setLateDays(computedLate);
    } catch (e) {
      console.warn('Could not compute attendance stats:', e);
      setPresentDays(26);
      setLateDays(0);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleCreateSalarySlip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaff) return;

    setSubmitting(true);
    try {
      const target = targets.find(t => t.staffId === selectedStaff.id);
      const salesIncentive = target?.calculatedIncentive || 0;
      const basic = selectedStaff.basicSalary || 20000;
      const net = basic + salesIncentive + Number(bonus) - Number(deductions);

      const monthNames = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
      ];
      const [year, monthNum] = selectedMonth.split('-');
      const monthLabel = `${monthNames[parseInt(monthNum, 10) - 1]} ${year}`;

      const newSlip: SalarySlip = {
        id: `slip_${selectedStaff.id}_${selectedMonth}`,
        staffId: selectedStaff.id,
        staffName: selectedStaff.name,
        designation: selectedStaff.designation || 'Sales Executive',
        month: monthLabel,
        monthKey: selectedMonth,
        basicSalary: basic,
        salesIncentive,
        attendanceBonus: Number(bonus),
        deductions: Number(deductions),
        netSalary: Math.max(0, net),
        totalWorkingDays: Number(workingDays),
        presentDays: Number(presentDays),
        lateDays: Number(lateDays),
        salesAchieved: target?.achievedAmount || 0,
        generatedDate: new Date().toISOString().slice(0, 10),
        isPaid: false,
      };

      await ApiService.saveSalarySlip(newSlip);
      showSuccess(`Salary slip generated for ${selectedStaff.name}.`);
      setGenerateModalOpen(false);
      await loadPayrollData();
    } catch (err: any) {
      showError(err, 'Failed to generate salary slip.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPaymentModal = (slip: SalarySlip) => {
    if (slip.isPaid) {
      handleToggleUnpaid(slip);
    } else {
      setSelectedSlipForPayment(slip);
      setPaymentMethod('Bank Transfer');
      setTransactionRef(`TXN-${Date.now().toString().slice(-6)}`);
      setPaidDate(new Date().toISOString().slice(0, 10));
      setPaymentModalOpen(true);
    }
  };

  const handleToggleUnpaid = async (slip: SalarySlip) => {
    try {
      await ApiService.saveSalarySlip({
        ...slip,
        isPaid: false,
        paidDate: undefined,
        paymentMethod: undefined,
        transactionRef: undefined,
      });
      showSuccess(`Reset salary slip for ${slip.staffName} to pending.`);
      await loadPayrollData();
    } catch (err) {
      showError(err, 'Could not reset paid status.');
    }
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlipForPayment) return;

    setPaymentSubmitting(true);
    try {
      await ApiService.saveSalarySlip({
        ...selectedSlipForPayment,
        isPaid: true,
        paidDate,
        paymentMethod,
        transactionRef: transactionRef.trim() || undefined,
      });
      showSuccess(`Disbursed payment recorded for ${selectedSlipForPayment.staffName}.`);
      setPaymentModalOpen(false);
      await loadPayrollData();
    } catch (err) {
      showError(err, 'Could not record payment.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const downloadSalarySlipPdf = (slip: SalarySlip) => {
    const doc = new jsPDF();

    // Brand Header
    doc.setFillColor(25, 77, 156); // #194D9C Primary brand blue
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('PARTH MOBILE CARE', 14, 18);
    doc.setFontSize(10);
    doc.text('Official Monthly Salary Pay Slip', 14, 26);
    doc.text(`Period: ${slip.month}`, 145, 26);

    // Employee Summary
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text('EMPLOYEE DETAILS', 14, 48);

    doc.setFontSize(10);
    doc.text(`Staff Name: ${slip.staffName}`, 14, 58);
    doc.text(`Designation: ${slip.designation}`, 14, 65);
    doc.text(`Staff ID: ${slip.staffId}`, 14, 72);
    doc.text(`Generated Date: ${slip.generatedDate}`, 130, 58);
    doc.text(`Payment Status: ${slip.isPaid ? 'PAID' : 'PENDING'}`, 130, 65);
    doc.text(`Attendance: ${slip.presentDays} / ${slip.totalWorkingDays} Days`, 130, 72);

    // Earnings Table
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 80, 196, 80);

    doc.setFontSize(11);
    doc.text('EARNINGS & BREAKDOWN', 14, 90);
    doc.text('AMOUNT (INR)', 150, 90);

    doc.setFontSize(10);
    doc.text('Basic Salary', 14, 102);
    doc.text(`INR ${slip.basicSalary.toLocaleString('en-IN')}`, 150, 102);

    doc.text('Monthly Sales Target Incentive', 14, 112);
    doc.text(`INR ${slip.salesIncentive.toLocaleString('en-IN')}`, 150, 112);

    doc.text('Attendance & Punctuality Bonus', 14, 122);
    doc.text(`INR ${slip.attendanceBonus.toLocaleString('en-IN')}`, 150, 122);

    doc.text('Deductions / Penalties', 14, 132);
    doc.text(`- INR ${slip.deductions.toLocaleString('en-IN')}`, 150, 132);

    doc.line(14, 140, 196, 140);

    // Net Salary
    doc.setFontSize(13);
    doc.setTextColor(25, 77, 156);
    doc.text('NET SALARY PAYABLE:', 14, 152);
    doc.text(`INR ${slip.netSalary.toLocaleString('en-IN')}`, 150, 152);

    // Signature Area
    doc.setTextColor(148, 163, 184);
    doc.setFontSize(9);
    doc.text('Authorized Signatory — Parth Mobile Care', 14, 210);
    doc.text('Employee Signature', 140, 210);

    doc.save(`SalarySlip_${slip.staffName.replace(/\s+/g, '_')}_${slip.monthKey}.pdf`);
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const q = search.toLowerCase().trim();
      const matchSearch =
        !q ||
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.designation?.toLowerCase().includes(q);

      const slip = slips.find(s => s.staffId === u.id);
      let matchPayment = true;
      if (filterPayment === 'paid') matchPayment = Boolean(slip?.isPaid);
      else if (filterPayment === 'pending') matchPayment = Boolean(slip && !slip.isPaid);
      else if (filterPayment === 'unissued') matchPayment = !slip;

      return matchSearch && matchPayment;
    });
  }, [users, search, filterPayment, slips]);

  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  // Export prepared data
  const exportData = useMemo(() => {
    return filteredUsers.map(staff => {
      const slip = slips.find(s => s.staffId === staff.id);
      const target = targets.find(t => t.staffId === staff.id);
      const incentive = target?.calculatedIncentive || 0;
      const net = slip ? slip.netSalary : (staff.basicSalary || 20000) + incentive;

      return {
        Staff_Name: staff.name,
        Designation: staff.designation || 'Sales Executive',
        Month: selectedMonth,
        Basic_Salary: staff.basicSalary || 20000,
        Sales_Incentive: incentive,
        Bonus: slip ? slip.attendanceBonus : 0,
        Deductions: slip ? slip.deductions : 0,
        Net_Payable: net,
        Slip_Issued: slip ? 'YES' : 'NO',
        Disbursement_Status: slip?.isPaid ? 'PAID' : 'PENDING',
        Payment_Method: slip?.paymentMethod || '—',
        Transaction_Ref: slip?.transactionRef || '—',
        Paid_Date: slip?.paidDate || '—',
      };
    });
  }, [filteredUsers, slips, targets, selectedMonth]);

  const totalMonthlyPayroll = useMemo(() => {
    return slips.reduce((acc, s) => acc + (s.netSalary || 0), 0);
  }, [slips]);

  const paidMonthlyPayroll = useMemo(() => {
    return slips.filter(s => s.isPaid).reduce((acc, s) => acc + (s.netSalary || 0), 0);
  }, [slips]);

  return (
    <div className="space-y-6">
      {/* Top Controls Card */}
      <Card noPadding>
        {/* Month & Summary Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Payroll Cycle
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={e => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-3.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-bold text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="w-64">
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                Search Staff
              </label>
              <Input
                placeholder="Search staff by name or title..."
                icon={Search}
                value={search}
                onChange={e => {
                  setSearch(e.target.value);
                  setCurrentPage(1);
                }}
                onClear={() => setSearch('')}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Disbursed / Total Payroll
              </span>
              <p className="text-base font-extrabold text-slate-900 dark:text-white">
                {loading && users.length === 0 ? (
                  <span className="inline-block h-5 w-28 bg-slate-200 dark:bg-slate-750 rounded animate-pulse" />
                ) : (
                  <>
                    <span className="text-emerald-600 dark:text-emerald-400">
                      ₹{paidMonthlyPayroll.toLocaleString('en-IN')}
                    </span>{' '}
                    /{' '}
                    <span className="text-brand-600 dark:text-blue-400">
                      ₹{totalMonthlyPayroll.toLocaleString('en-IN')}
                    </span>
                  </>
                )}
              </p>
            </div>

            <ExportDropdown
              data={exportData}
              filename={`Staff_Payroll_${selectedMonth}`}
              sheetName="Payroll"
              disabled={filteredUsers.length === 0}
            />

            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => loadPayrollData(true)}
              loading={loading}
              title="Refresh Payroll"
              className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2 overflow-x-auto text-xs">
          <span className="font-bold text-slate-400 text-[10px] uppercase mr-1">Status:</span>
          {[
            { id: 'all', label: 'All Staff' },
            { id: 'paid', label: 'Paid & Disbursed' },
            { id: 'pending', label: 'Slip Issued (Pending Payment)' },
            { id: 'unissued', label: 'Slip Not Issued' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => {
                setFilterPayment(f.id as any);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                filterPayment === f.id
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading && users.length === 0 ? (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800/60 rounded-xl w-full" />
            ))}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No Staff Found for Payroll"
              description="No active staff members match your search or payment filter criteria."
              icon={Wallet}
            />
          </div>
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-xs min-w-[880px]">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px] border-b border-slate-100 dark:border-slate-800 select-none">
                <tr>
                  <th className="py-3 px-4">Staff Member</th>
                  <th className="py-3 px-4">Basic Salary</th>
                  <th className="py-3 px-4">Sales Target & Incentive</th>
                  <th className="py-3 px-4">Slip Status</th>
                  <th className="py-3 px-4">Net Payable</th>
                  <th className="py-3 px-4">Disbursement</th>
                  <th className="py-3 px-4 text-right sticky right-0 bg-slate-50 dark:bg-slate-800/95 z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {paginatedUsers.map(staff => {
                  const slip = slips.find(s => s.staffId === staff.id);
                  const target = targets.find(t => t.staffId === staff.id);
                  const incentive = target?.calculatedIncentive || 0;
                  const estimatedNet = (staff.basicSalary || 20000) + incentive;

                  return (
                    <tr
                      key={staff.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900 dark:text-white leading-tight">
                          {staff.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {staff.designation || 'Sales Executive'}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 font-semibold text-slate-700 dark:text-slate-300">
                        ₹{(staff.basicSalary || 20000).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-emerald-600 dark:text-emerald-400 font-bold">
                          + ₹{incentive.toLocaleString('en-IN')}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          Achieved: ₹{(target?.achievedAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge variant={slip ? 'success' : 'neutral'} size="xs" dot>
                          {slip ? 'Slip Issued' : 'Not Issued'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4 font-extrabold text-brand-600 dark:text-blue-400 text-sm">
                        ₹{(slip?.netSalary || estimatedNet).toLocaleString('en-IN')}
                      </td>

                      <td className="py-3.5 px-4">
                        {slip ? (
                          <button
                            onClick={() => handleOpenPaymentModal(slip)}
                            className="cursor-pointer"
                            title={slip.isPaid ? 'Click to mark as unpaid' : 'Click to record payment'}
                          >
                            <Badge variant={slip.isPaid ? 'success' : 'warning'} size="xs" dot>
                              {slip.isPaid ? 'PAID' : 'PENDING'}
                            </Badge>
                          </button>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right space-x-1 whitespace-nowrap sticky right-0 bg-white dark:bg-[#0F192C] z-10 shadow-[-6px_0_10px_-4px_rgba(0,0,0,0.08)]">
                        {!slip ? (
                          <Button
                            variant="primary"
                            size="xs"
                            onClick={() => handleOpenGenerate(staff)}
                          >
                            Issue Slip
                          </Button>
                        ) : (
                          <div className="inline-flex items-center space-x-1">
                            <Button
                              variant="outline"
                              size="xs"
                              icon={Download}
                              onClick={() => downloadSalarySlipPdf(slip)}
                              title="Download Salary Slip PDF"
                            >
                              PDF
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => handleOpenGenerate(staff)}
                              title="Regenerate Slip"
                            >
                              Edit
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {filteredUsers.length > 0 && (
          <TablePagination
            currentPage={currentPage}
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={page => setCurrentPage(page)}
            onPageSizeChange={size => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
        )}
      </Card>

      {/* Generate Salary Slip Modal */}
      <Modal
        isOpen={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        title="Generate Monthly Salary Slip"
        subtitle={
          selectedStaff && (
            <span>
              Generating slip for <strong className="text-slate-900 dark:text-white">{selectedStaff.name}</strong> ({selectedMonth})
            </span>
          )
        }
      >
        {selectedStaff && (
          <form onSubmit={handleCreateSalarySlip} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Basic Salary (₹)"
                disabled
                value={`₹${(selectedStaff.basicSalary || 20000).toLocaleString('en-IN')}`}
              />
              <Input
                label="Sales Target Incentive (₹)"
                disabled
                value={`₹${(
                  targets.find(t => t.staffId === selectedStaff.id)?.calculatedIncentive || 0
                ).toLocaleString('en-IN')}`}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Attendance / Performance Bonus (₹)"
                type="number"
                value={bonus}
                onChange={e => setBonus(Number(e.target.value))}
              />
              <Input
                label="Deductions / Late Penalty (₹)"
                type="number"
                value={deductions}
                onChange={e => setDeductions(Number(e.target.value))}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Working Days"
                type="number"
                value={workingDays}
                onChange={e => setWorkingDays(Number(e.target.value))}
              />
              <Input
                label="Present Days"
                type="number"
                value={presentDays}
                onChange={e => setPresentDays(Number(e.target.value))}
              />
              <Input
                label="Late Arrivals"
                type="number"
                value={lateDays}
                onChange={e => setLateDays(Number(e.target.value))}
              />
            </div>

            {attendanceLoading && (
              <p className="text-[11px] text-brand-600 dark:text-blue-400 italic">
                Synchronizing attendance records from Firestore...
              </p>
            )}

            <div className="p-3.5 bg-blue-50/60 dark:bg-blue-950/40 rounded-xl border border-blue-100 dark:border-blue-900 flex justify-between items-center text-xs">
              <span className="font-semibold text-blue-900 dark:text-blue-200">
                Net Calculated Salary:
              </span>
              <span className="text-base font-extrabold text-brand-600 dark:text-blue-400">
                ₹
                {(
                  (selectedStaff.basicSalary || 20000) +
                  (targets.find(t => t.staffId === selectedStaff.id)?.calculatedIncentive || 0) +
                  Number(bonus) -
                  Number(deductions)
                ).toLocaleString('en-IN')}
              </span>
            </div>

            <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setGenerateModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                loading={submitting}
              >
                Save & Issue Slip
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Payment Confirmation Modal */}
      <Modal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        title="Record Salary Slip Payout"
        subtitle={
          selectedSlipForPayment && (
            <span>
              {selectedSlipForPayment.staffName} • {selectedSlipForPayment.month}
            </span>
          )
        }
      >
        {selectedSlipForPayment && (
          <form onSubmit={handleConfirmPayment} className="space-y-4">
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
              <div>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {selectedSlipForPayment.staffName}
                </p>
                <p className="text-slate-400 text-[11px]">Staff ID: {selectedSlipForPayment.staffId}</p>
              </div>
              <p className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                ₹{selectedSlipForPayment.netSalary.toLocaleString('en-IN')}
              </p>
            </div>

            <Select
              label="Disbursement Mode"
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as any)}
            >
              <option value="Bank Transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="UPI">UPI Direct</option>
              <option value="Cash">Cash in Hand</option>
            </Select>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Payment Date"
                type="date"
                required
                value={paidDate}
                onChange={e => setPaidDate(e.target.value)}
              />
              <Input
                label="Transaction Ref / UTR #"
                value={transactionRef}
                onChange={e => setTransactionRef(e.target.value)}
                placeholder="e.g. UTR12345678"
              />
            </div>

            <div className="flex justify-end space-x-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => setPaymentModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                size="sm"
                type="submit"
                loading={paymentSubmitting}
              >
                Confirm Paid Payout
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
