import React, { useEffect, useState, useMemo } from 'react';
import {
  BarChart3,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  UserCheck,
  Clock,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  Award,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { ApiService } from '../services/api';
import {
  Card,
  Button,
  Badge,
  StatCard,
  Select,
  ExportDropdown,
} from '../components/common';
import {
  SecondHandSale,
  SecondHandPurchase,
  CustomerLead,
  AttendanceRecord,
  User,
  SalesTarget,
} from '../types';

export const ReportsPage: React.FC = () => {
  const [sales, setSales] = useState<SecondHandSale[]>([]);
  const [purchases, setPurchases] = useState<SecondHandPurchase[]>([]);
  const [leads, setLeads] = useState<CustomerLead[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [targets, setTargets] = useState<SalesTarget[]>([]);
  const [loading, setLoading] = useState(true);

  // Active Report Category Tab
  const [activeTab, setActiveTab] = useState<'sales' | 'leads' | 'attendance' | 'performance'>('sales');

  // Date Scope Filters
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [scope, setScope] = useState<'month' | 'all'>('month');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);

  const loadData = async () => {
    setLoading(true);
    try {
      const [s, p, l, a, u, t] = await Promise.all([
        ApiService.getSecondHandSales(),
        ApiService.getSecondHandPurchases(),
        ApiService.getLeads(),
        ApiService.getAttendanceRecords(300),
        ApiService.getUsers(),
        ApiService.getSalesTargets(),
      ]);
      setSales(s);
      setPurchases(p);
      setLeads(l);
      setAttendance(a);
      setUsers(u.filter(user => user.isActive !== false && user.role === 'staff'));
      setTargets(t);
    } catch (err) {
      console.warn('Reports load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Scoped Data
  const scopedSales = useMemo(() => {
    return scope === 'month'
      ? sales.filter(s => (s.saleDate || '').startsWith(selectedMonth))
      : sales;
  }, [sales, scope, selectedMonth]);

  const scopedLeads = useMemo(() => {
    return scope === 'month'
      ? leads.filter(l => (l.createdAt || '').startsWith(selectedMonth))
      : leads;
  }, [leads, scope, selectedMonth]);

  const scopedAttendance = useMemo(() => {
    return scope === 'month'
      ? attendance.filter(a => (a.date || '').startsWith(selectedMonth))
      : attendance;
  }, [attendance, scope, selectedMonth]);

  // Aggregated Computations
  const totalRevenue = scopedSales.reduce((acc, s) => acc + (s.sellingAmount || 0), 0);
  const totalCost = scopedSales.reduce((acc, s) => acc + (s.purchaseAmount || 0), 0);
  const grossProfit = totalRevenue - totalCost;
  const avgMargin = totalCost > 0 ? Math.round((grossProfit / totalCost) * 100) : 0;

  const totalLeads = scopedLeads.length;
  const convertedLeads = scopedLeads.filter(l => l.status === 'purchased').length;
  const conversionRate = totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 100) : 0;

  const totalPunches = scopedAttendance.length;
  const presentPunches = scopedAttendance.filter(a => a.status === 'present' || a.status === 'late').length;
  const latePunches = scopedAttendance.filter(a => a.isLate).length;
  const totalHoursWorked = Math.round(scopedAttendance.reduce((acc, a) => acc + (a.totalHours || 0), 0));

  // Export prepared data
  const exportData = useMemo(() => {
    if (activeTab === 'sales') {
      return scopedSales.map(s => ({
        Invoice_Number: s.invoiceNumber,
        Buyer_Name: s.buyerName,
        Device_Brand: s.brand,
        Device_Model: s.model,
        Device_IMEI: s.imei,
        Purchase_Cost: s.purchaseAmount,
        Selling_Price: s.sellingAmount,
        Gross_Profit: s.profitAmount,
        Margin_Percent: `${s.marginPercent}%`,
        Sale_Date: s.saleDate,
        Sold_By_Staff: s.soldByStaffName || 'Staff',
      }));
    } else if (activeTab === 'leads') {
      return scopedLeads.map(l => ({
        Customer_Name: l.name,
        Phone: l.phone,
        Interested_Model: `${l.interestedBrand} ${l.interestedModel}`,
        Budget: l.budget,
        Status: l.status.toUpperCase(),
        Follow_Up_Date: l.followUpDate || '—',
        Created_At: l.createdAt,
      }));
    } else if (activeTab === 'attendance') {
      return scopedAttendance.map(a => ({
        Staff_Name: a.userName,
        Date: a.date,
        Punch_In: a.punchInTime || '—',
        Punch_Out: a.punchOutTime || '—',
        Status: a.status.toUpperCase(),
        Late_Arrival: a.isLate ? 'YES' : 'NO',
        Total_Hours: a.totalHours || 0,
      }));
    } else {
      return users.map(u => {
        const target = targets.find(t => t.staffId === u.id);
        const userSales = scopedSales.filter(s => s.soldByStaffId === u.id);
        const totalAttributed = userSales.reduce((acc, s) => acc + (s.sellingAmount || 0), 0);
        const tgtAmount = target?.targetAmount || u.monthlyTarget || 200000;
        const pct = tgtAmount > 0 ? Math.min(100, Math.round((totalAttributed / tgtAmount) * 100)) : 0;

        return {
          Staff_Name: u.name,
          Designation: u.designation || u.role,
          Sales_Revenue_Attributed: totalAttributed,
          Units_Sold: userSales.length,
          Monthly_Target: tgtAmount,
          Target_Achievement_Percent: `${pct}%`,
          Calculated_Incentive: target?.calculatedIncentive || 0,
        };
      });
    }
  }, [activeTab, scopedSales, scopedLeads, scopedAttendance, users, targets]);

  // Export to PDF
  const exportToPdf = () => {
    const doc = new jsPDF();
    doc.setFillColor(25, 77, 156);
    doc.rect(0, 0, 210, 36, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18);
    doc.text('PARTH MOBILE CARE', 14, 18);
    doc.setFontSize(10);
    const scopeLabel = scope === 'month' ? `Monthly Report: ${selectedMonth}` : 'Cumulative All-Time Report';
    doc.text(`Comprehensive Store Operations & Analytics — ${scopeLabel}`, 14, 26);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-IN')}`, 145, 26);

    doc.setTextColor(30, 41, 59);
    doc.setFontSize(12);
    doc.text('1. FINANCIAL & SALES SUMMARY', 14, 48);

    doc.setFontSize(10);
    doc.text(`Total Sales Revenue: INR ${totalRevenue.toLocaleString('en-IN')}`, 14, 58);
    doc.text(`Total Cost of Goods Sold: INR ${totalCost.toLocaleString('en-IN')}`, 14, 65);
    doc.text(`Total Gross Profit: INR ${grossProfit.toLocaleString('en-IN')}`, 14, 72);
    doc.text(`Average Margin: ${avgMargin}%`, 14, 79);
    doc.text(`Total Units Sold: ${scopedSales.length}`, 14, 86);

    doc.setFontSize(12);
    doc.text('2. LEAD PIPELINE METRICS', 14, 102);
    doc.setFontSize(10);
    doc.text(`Total Inquiries Logged: ${totalLeads}`, 14, 112);
    doc.text(`Converted Purchases: ${convertedLeads}`, 14, 119);
    doc.text(`Overall Conversion Rate: ${conversionRate}%`, 14, 126);

    doc.setFontSize(12);
    doc.text('3. ATTENDANCE & SHIFT METRICS', 14, 142);
    doc.setFontSize(10);
    doc.text(`Total Shifts Recorded: ${totalPunches}`, 14, 152);
    doc.text(`Late Arrivals: ${latePunches}`, 14, 159);
    doc.text(`Total Working Hours: ${totalHoursWorked} hrs`, 14, 166);

    const fileSuffix = scope === 'month' ? selectedMonth : 'AllTime';
    doc.save(`ParthMobileCare_StoreReport_${fileSuffix}.pdf`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner with Scope & Dual Export */}
      <Card noPadding>
        <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
              Store Analytics & Executive Reports
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Multi-dimensional business analytics across revenue, attendance, leads, and staff targets.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <ExportDropdown
              data={exportData}
              filename={`ParthMobileCare_${activeTab}_Report_${scope === 'month' ? selectedMonth : 'AllTime'}`}
              sheetName={activeTab.toUpperCase()}
              disabled={exportData.length === 0}
            />

            <Button
              variant="primary"
              size="sm"
              icon={FileText}
              onClick={exportToPdf}
            >
              Export PDF
            </Button>

            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={loadData}
              loading={loading}
              title="Refresh Analytics"
              className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
            />
          </div>
        </div>

        {/* Scope Selector Row */}
        <div className="px-5 py-2.5 bg-slate-50/50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-brand-500 shrink-0" />
            <span className="font-bold text-slate-700 dark:text-slate-300">Reporting Horizon:</span>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setScope('month')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  scope === 'month'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Specific Month
              </button>
              <button
                onClick={() => setScope('all')}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  scope === 'all'
                    ? 'bg-white dark:bg-slate-700 text-brand-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Time
              </button>
            </div>

            {scope === 'month' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={e => setSelectedMonth(e.target.value)}
                className="px-3 py-1 text-xs bg-white dark:bg-[#0D1729] border border-slate-200 dark:border-[#24344D] rounded-xl font-bold text-slate-800 dark:text-[#E8EEF8]"
              />
            )}
          </div>
        </div>
      </Card>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Sales Revenue"
          value={`₹${totalRevenue.toLocaleString('en-IN')}`}
          subtitle={`${scopedSales.length} total units delivered`}
          icon={DollarSign}
          color="blue"
        />
        <StatCard
          title="Gross Margin"
          value={`₹${grossProfit.toLocaleString('en-IN')}`}
          subtitle={`${avgMargin}% average profit margin`}
          icon={TrendingUp}
          color="green"
        />
        <StatCard
          title="Lead Conversion"
          value={`${conversionRate}%`}
          subtitle={`${convertedLeads} purchased out of ${totalLeads} leads`}
          icon={UserCheck}
          color="amber"
        />
        <StatCard
          title="Duty Hours Worked"
          value={`${totalHoursWorked} hrs`}
          subtitle={`${latePunches} late arrivals recorded`}
          icon={Clock}
          color="purple"
        />
      </div>

      {/* Category Tabs */}
      <Card noPadding>
        <div className="px-5 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center space-x-2 overflow-x-auto">
          {[
            { id: 'sales' as const, label: 'Sales & Profit Analysis' },
            { id: 'leads' as const, label: 'Lead Conversion Funnel' },
            { id: 'attendance' as const, label: 'Attendance & Punctuality' },
            { id: 'performance' as const, label: 'Staff Sales Leaderboard' },
          ].map(t => {
            const active = activeTab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                  active
                    ? 'bg-brand-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div className="p-5">
          {activeTab === 'sales' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Sales & Profit Margin Records ({scopedSales.length})
              </h4>
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left text-xs min-w-[780px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-3">Invoice</th>
                      <th className="py-3 px-3">Device Model</th>
                      <th className="py-3 px-3">Cost Price</th>
                      <th className="py-3 px-3">Selling Price</th>
                      <th className="py-3 px-3">Profit</th>
                      <th className="py-3 px-3">Margin</th>
                      <th className="py-3 px-3">Sold By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {scopedSales.map(s => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-3 font-mono font-bold text-brand-600 dark:text-blue-400">
                          {s.invoiceNumber || s.id.slice(-6)}
                        </td>
                        <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                          {s.brand} {s.model}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          ₹{s.purchaseAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-900 dark:text-white">
                          ₹{s.sellingAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-600">
                          +₹{s.profitAmount.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 px-3 font-bold text-emerald-700">
                          {s.marginPercent}%
                        </td>
                        <td className="py-3 px-3 text-slate-500">
                          {s.soldByStaffName || 'Staff Member'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Staff Target Progress & Incentive Achievement
              </h4>
              <div className="overflow-x-auto min-w-0">
                <table className="w-full text-left text-xs min-w-[780px]">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] font-bold border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-3">Staff Member</th>
                      <th className="py-3 px-3">Designation</th>
                      <th className="py-3 px-3">Attributed Sales</th>
                      <th className="py-3 px-3">Monthly Target</th>
                      <th className="py-3 px-3">Target Progress</th>
                      <th className="py-3 px-3">Calculated Incentive</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map(u => {
                      const target = targets.find(t => t.staffId === u.id);
                      const userSales = scopedSales.filter(s => s.soldByStaffId === u.id);
                      const totalAttributed = userSales.reduce(
                        (acc, s) => acc + (s.sellingAmount || 0),
                        0
                      );
                      const tgtAmount = target?.targetAmount || u.monthlyTarget || 200000;
                      const pct =
                        tgtAmount > 0
                          ? Math.min(100, Math.round((totalAttributed / tgtAmount) * 100))
                          : 0;

                      return (
                        <tr
                          key={u.id}
                          className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                            {u.name}
                          </td>
                          <td className="py-3 px-3 text-slate-500">{u.designation || u.role}</td>
                          <td className="py-3 px-3 font-extrabold text-brand-600 dark:text-blue-400">
                            ₹{totalAttributed.toLocaleString('en-IN')}{' '}
                            <span className="text-[10px] text-slate-400 font-normal">
                              ({userSales.length} units)
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                            ₹{tgtAmount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-2">
                              <div className="w-28 h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-500 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="font-bold text-xs">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-bold text-emerald-600">
                            ₹{(target?.calculatedIncentive || 0).toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'leads' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Lead Conversion Metrics ({totalLeads} Total)
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400">Total Inquiries</span>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {totalLeads}
                  </p>
                </div>
                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/40 rounded-2xl border border-amber-100 dark:border-amber-900">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    Follow-ups Pending
                  </span>
                  <p className="text-2xl font-extrabold text-amber-800 dark:text-amber-200 mt-1">
                    {scopedLeads.filter(l => l.status === 'follow_up').length}
                  </p>
                </div>
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-2xl border border-emerald-100 dark:border-emerald-900">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Purchased / Converted
                  </span>
                  <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-200 mt-1">
                    {convertedLeads}
                  </p>
                </div>
                <div className="p-4 bg-rose-50/60 dark:bg-rose-950/40 rounded-2xl border border-rose-100 dark:border-rose-900">
                  <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-400">
                    Lost Opportunities
                  </span>
                  <p className="text-2xl font-extrabold text-rose-800 dark:text-rose-200 mt-1">
                    {scopedLeads.filter(l => l.status === 'lost').length}
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'attendance' && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Attendance Compliance & Shift Reliability
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-semibold text-slate-400">
                    Total Shifts Logged
                  </span>
                  <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-1">
                    {totalPunches}
                  </p>
                </div>
                <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/40 rounded-2xl border border-emerald-100 dark:border-emerald-900">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    On-Time Shifts
                  </span>
                  <p className="text-2xl font-extrabold text-emerald-800 dark:text-emerald-200 mt-1">
                    {presentPunches - latePunches}
                  </p>
                </div>
                <div className="p-4 bg-amber-50/60 dark:bg-amber-950/40 rounded-2xl border border-amber-100 dark:border-amber-900">
                  <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    Late Arrivals
                  </span>
                  <p className="text-2xl font-extrabold text-amber-800 dark:text-amber-200 mt-1">
                    {latePunches}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
