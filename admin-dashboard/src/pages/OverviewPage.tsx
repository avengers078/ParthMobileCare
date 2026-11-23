import React, { useEffect, useState } from 'react';
import {
  Users,
  CalendarCheck,
  UserCheck,
  TrendingUp,
  Smartphone,
  Wallet,
  ArrowUpRight,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { ApiService } from '../services/api';
import { StatCard, Badge, Button, Card } from '../components/common';
import { NavTab } from '../layouts/DashboardLayout';
import {
  User,
  AttendanceRecord,
  CustomerLead,
  SecondHandSale,
  SecondHandPurchase,
} from '../types';

interface OverviewPageProps {
  onNavigate: (tab: NavTab) => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({ onNavigate }) => {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [leads, setLeads] = useState<CustomerLead[]>([]);
  const [sales, setSales] = useState<SecondHandSale[]>([]);
  const [purchases, setPurchases] = useState<SecondHandPurchase[]>([]);
  const [period, setPeriod] = useState<'today' | 'month' | 'all'>('month');

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [u, a, l, s, p] = await Promise.all([
        ApiService.getUsers().catch(() => []),
        ApiService.getAttendanceRecords(100).catch(() => []),
        ApiService.getLeads().catch(() => []),
        ApiService.getSecondHandSales().catch(() => []),
        ApiService.getSecondHandPurchases().catch(() => []),
      ]);
      setUsers(u);
      setAttendance(a);
      setLeads(l);
      setSales(s);
      setPurchases(p);
    } catch (err) {
      console.warn('Overview load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const activeStaff = users.filter(u => u.isActive !== false && u.role === 'staff');
  const pendingStaffApprovals = users.filter(
    u => u.registrationStatus === 'pending' || u.deviceBindingStatus === 'pending_approval' || u.faceEnrollmentStatus === 'pending_approval'
  );
  const todayAttendance = attendance.filter(a => a.date === todayStr);
  const presentToday = todayAttendance.filter(a => a.status === 'present' || a.status === 'late');
  const lateToday = todayAttendance.filter(a => a.isLate);
  const absentTodayCount = Math.max(0, activeStaff.length - presentToday.length);

  // Period-filtered sales
  const filteredSales =
    period === 'today'
      ? sales.filter(s => s.saleDate === todayStr)
      : period === 'month'
      ? sales.filter(s => s.saleDate && s.saleDate.startsWith(currentMonthStr))
      : sales;

  const periodLabel = period === 'today' ? 'Today' : period === 'month' ? 'This Month' : 'All Time';
  const filteredSalesRevenue = filteredSales.reduce((acc, s) => acc + (s.sellingAmount || 0), 0);
  const filteredGrossProfit = filteredSales.reduce((acc, s) => acc + (s.profitAmount || 0), 0);

  const pendingFollowups = leads.filter(l => l.status === 'follow_up');
  const convertedLeads = leads.filter(l => l.status === 'purchased');
  const openLeads = leads.filter(l => l.status === 'new' || l.status === 'follow_up' || l.status === 'interested');
  const leadConversionRate = leads.length > 0 ? Math.round((convertedLeads.length / leads.length) * 100) : 0;

  const inStockPhones = purchases.filter(p => p.status === 'in_stock').length;

  return (
    <div className="space-y-6">
      {/* Sleek Modern SaaS Welcome Banner */}
      <div className="bg-white dark:bg-[#0F192C] rounded-2xl border border-slate-200/80 dark:border-[#24344D] p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-brand-500" />
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-brand-50 text-brand-700 dark:bg-[#142D50] dark:text-blue-300 border border-brand-200 dark:border-[#194D9C]/50">
              <Sparkles className="w-3 h-3 shrink-0 text-brand-500" />
              <span>Live Store Operations</span>
            </span>
            {pendingStaffApprovals.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                {pendingStaffApprovals.length} Approval{pendingStaffApprovals.length > 1 ? 's' : ''} Pending
              </span>
            )}
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-[#E8EEF8] mt-2 tracking-tight">
            Parth Mobile Care Operations
          </h2>
          <p className="text-xs text-slate-500 dark:text-[#94A3B8] max-w-xl mt-1 leading-relaxed">
            Real-time management dashboard synchronized with staff mobile application devices.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={() => onNavigate('staff')}
          >
            Staff Actions
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={UserCheck}
            onClick={() => onNavigate('leads')}
          >
            Leads
          </Button>
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={loadAllData}
            loading={loading}
            title="Refresh All Data"
          />
        </div>
      </div>

      {/* Scope Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-white dark:bg-[#0F192C] px-4 py-2.5 rounded-2xl border border-slate-200/80 dark:border-[#24344D] shadow-sm">
        <span className="text-xs font-bold text-slate-700 dark:text-[#E8EEF8]">
          Performance Window:
        </span>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-[#0D1729] p-1 rounded-xl border border-transparent dark:border-[#24344D] self-start sm:self-auto">
          {(['today', 'month', 'all'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                period === p
                  ? 'bg-white dark:bg-[#194D9C] text-brand-600 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-[#94A3B8] dark:hover:text-[#E8EEF8]'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'month' ? 'This Month' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Staff Members"
          value={activeStaff.length}
          subtitle={`${pendingStaffApprovals.length} pending • ${absentTodayCount} absent today`}
          icon={Users}
          color="blue"
          onClick={() => onNavigate('staff')}
        />
        <StatCard
          title="Today's Attendance"
          value={`${presentToday.length} / ${activeStaff.length || 1}`}
          subtitle={`${lateToday.length} late • ${absentTodayCount} absent`}
          icon={CalendarCheck}
          color="green"
          onClick={() => onNavigate('attendance')}
        />
        <StatCard
          title="Leads Pipeline"
          value={leads.length}
          subtitle={`${openLeads.length} active • ${pendingFollowups.length} follow-ups`}
          icon={UserCheck}
          color="amber"
          trend={{ value: `${leadConversionRate}% converted`, isPositive: true }}
          onClick={() => onNavigate('leads')}
        />
        <StatCard
          title="Gross Profit"
          value={`₹${filteredGrossProfit.toLocaleString('en-IN')}`}
          subtitle={`₹${filteredSalesRevenue.toLocaleString('en-IN')} revenue (${filteredSales.length} sales)`}
          icon={TrendingUp}
          color="purple"
          onClick={() => onNavigate('reports')}
        />
      </div>

      {/* Secondary Insight Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Funnel Breakdown */}
        <Card
          title="Lead Funnel Distribution"
          actions={
            <Button
              variant="ghost"
              size="xs"
              icon={ArrowUpRight}
              iconPosition="right"
              onClick={() => onNavigate('leads')}
              className="text-brand-600 dark:text-blue-400 font-semibold"
            >
              Manage
            </Button>
          }
        >
          <div className="space-y-3.5">
            {[
              { label: 'New Inquiries', count: leads.filter(l => l.status === 'new').length, color: 'bg-brand-500' },
              { label: 'Follow-ups Required', count: pendingFollowups.length, color: 'bg-amber-500' },
              { label: 'High Interest', count: leads.filter(l => l.status === 'interested').length, color: 'bg-purple-500' },
              { label: 'Purchased / Converted', count: convertedLeads.length, color: 'bg-emerald-500' },
              { label: 'Lost', count: leads.filter(l => l.status === 'lost').length, color: 'bg-slate-400' },
            ].map(item => {
              const pct = leads.length > 0 ? Math.round((item.count / leads.length) * 100) : 0;
              return (
                <div key={item.label} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-600 dark:text-slate-400">
                    <span>{item.label}</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full transition-all duration-300`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Second-Hand Inventory Status */}
        <Card
          title="Second-Hand Operations"
          actions={
            <Button
              variant="ghost"
              size="xs"
              icon={ArrowUpRight}
              iconPosition="right"
              onClick={() => onNavigate('secondhand')}
              className="text-brand-600 dark:text-blue-400 font-semibold"
            >
              Inventory
            </Button>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-slate-50 dark:bg-[#17243A] rounded-xl border border-slate-100 dark:border-[#24344D]">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8]">
                In Stock Units
              </span>
              <p className="text-2xl font-extrabold text-brand-500 dark:text-blue-400 mt-1">
                {inStockPhones}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-[#71839D]">Ready for resale</span>
            </div>
            <div className="p-3.5 bg-slate-50 dark:bg-[#17243A] rounded-xl border border-slate-100 dark:border-[#24344D]">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-[#94A3B8]">
                Completed Sales
              </span>
              <p className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                {sales.length}
              </p>
              <span className="text-[10px] text-slate-400 dark:text-[#71839D]">Units delivered</span>
            </div>
          </div>

          <div className="mt-4 p-3.5 bg-slate-50 dark:bg-[#17243A] rounded-xl border border-slate-200/80 dark:border-[#24344D] flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-[#E8EEF8]">
                Total Acquired Devices
              </span>
              <p className="text-xs text-slate-500 dark:text-[#94A3B8] font-medium mt-0.5">
                {purchases.length} devices purchased & verified
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 dark:bg-[#142D50] dark:text-blue-300 border border-brand-200/60 dark:border-[#194D9C]/60 flex items-center justify-center shrink-0 shadow-sm">
              <Smartphone className="w-5 h-5 shrink-0" />
            </div>
          </div>
        </Card>

        {/* Today's Punch Feed */}
        <Card
          title="Today's Attendance Events"
          actions={
            <Button
              variant="ghost"
              size="xs"
              icon={ArrowUpRight}
              iconPosition="right"
              onClick={() => onNavigate('attendance')}
              className="text-brand-600 dark:text-blue-400 font-semibold"
            >
              Full Log
            </Button>
          }
        >
          <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-64 overflow-y-auto pr-1">
            {todayAttendance.length === 0 ? (
              <p className="text-xs text-slate-400 py-8 text-center">
                No attendance punches recorded today yet.
              </p>
            ) : (
              todayAttendance.slice(0, 6).map(att => (
                <div key={att.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {att.userName}
                    </p>
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>In: {att.punchInTime || '—'}</span>
                      {att.punchOutTime && <span>• Out: {att.punchOutTime}</span>}
                    </p>
                  </div>
                  <Badge variant={att.isLate ? 'warning' : 'success'} size="xs" dot>
                    {att.isLate ? 'Late' : 'On Time'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
