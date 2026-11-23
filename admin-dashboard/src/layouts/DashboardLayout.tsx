import React, { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  UserCheck,
  Tag,
  Smartphone,
  Wallet,
  BarChart3,
  Bell,
  Settings,
  Shield,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  Laptop,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { ApiService } from '../services/api';

export type NavTab =
  | 'overview'
  | 'staff'
  | 'attendance'
  | 'leads'
  | 'prices'
  | 'secondhand'
  | 'payroll'
  | 'reports'
  | 'notifications'
  | 'audit'
  | 'settings'
  | 'profile';

interface DashboardLayoutProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  children: React.ReactNode;
}

interface NavGroup {
  name: string;
  items: {
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }[];
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  currentTab,
  onTabChange,
  children,
}) => {
  const { currentUser, logout } = useAuth();
  const { showToast } = useToast();
  const { mode, setMode } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  const handleLogoutClick = () => {
    setIsLogoutModalOpen(true);
  };

  const handleConfirmLogout = async () => {
    if (logoutLoading) return;
    setLogoutLoading(true);
    try {
      await logout();
      setIsLogoutModalOpen(false);
      showToast('success', 'Logged out successfully');
    } catch (err: any) {
      showToast('error', err?.message || 'Failed to logout. Please try again.');
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleCancelLogout = () => {
    if (logoutLoading) return;
    setIsLogoutModalOpen(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownOpen &&
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [profileDropdownOpen]);

  useEffect(() => {
    // Load unread notifications count
    ApiService.getNotifications()
      .then(notifs => {
        const unread = notifs.filter(n => !n.read).length;
        setUnreadNotifications(unread);
      })
      .catch(() => {});
  }, [currentTab]);

  const navGroups: NavGroup[] = [
    {
      name: 'OVERVIEW',
      items: [
        { id: 'overview', label: 'Dashboard Overview', icon: LayoutDashboard },
      ],
    },
    {
      name: 'OPERATIONS',
      items: [
        { id: 'staff', label: 'Staff Management', icon: Users },
        { id: 'attendance', label: 'Attendance Tracker', icon: CalendarCheck },
        { id: 'leads', label: 'Leads & Inquiries', icon: UserCheck },
        { id: 'secondhand', label: 'Second-Hand Devices', icon: Smartphone },
        { id: 'prices', label: 'Mobile Price Catalog', icon: Tag },
      ],
    },
    {
      name: 'FINANCE',
      items: [
        { id: 'payroll', label: 'Salary & Payroll', icon: Wallet },
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
      ],
    },
    {
      name: 'SYSTEM',
      items: [
        {
          id: 'notifications',
          label: 'Announcements & Alerts',
          icon: Bell,
          badge: unreadNotifications > 0 ? unreadNotifications : undefined,
        },
        { id: 'audit', label: 'Security & Audit Logs', icon: ShieldAlert },
        { id: 'settings', label: 'Shop Settings', icon: Settings },
      ],
    },
    {
      name: 'ACCOUNT',
      items: [
        { id: 'profile', label: 'Profile & Security', icon: Shield },
      ],
    },
  ];

  // Find active item and group
  let currentGroup = navGroups[0];
  let currentItem = navGroups[0].items[0];
  for (const group of navGroups) {
    const item = group.items.find(i => i.id === currentTab);
    if (item) {
      currentGroup = group;
      currentItem = item;
      break;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col md:flex-row font-sans text-slate-800 dark:text-slate-100 selection:bg-brand-500 selection:text-white">
      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-sm md:hidden transition-opacity duration-200"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Navigation Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white dark:bg-[#0D1729] border-r border-slate-200/80 dark:border-[#24344D] flex flex-col transition-all duration-200 ease-in-out md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${sidebarCollapsed ? 'md:w-20' : 'md:w-64'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-100 dark:border-[#24344D] shrink-0">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#121E32] border border-slate-200/80 dark:border-[#24344D] p-1 flex items-center justify-center shadow-sm shrink-0 overflow-hidden select-none">
              <img
                src="/logo.png"
                alt="Parth Mobile Care"
                className="w-full h-full object-contain"
              />
            </div>
            {!sidebarCollapsed && (
              <div className="truncate">
                <h1 className="text-xs font-bold text-slate-900 dark:text-[#E8EEF8] leading-tight truncate">
                  Parth Mobile Care
                </h1>
                <span className="text-[10px] font-bold tracking-wider uppercase text-brand-600 dark:text-blue-400">
                  Admin Web Portal
                </span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 shrink-0" />
          </button>
        </div>

        {/* Navigation Menu with Grouped Sections */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
          {navGroups.map(group => (
            <div key={group.name} className="space-y-1">
              {!sidebarCollapsed ? (
                <p className="px-3 py-1 text-[10px] font-extrabold tracking-wider text-slate-400 dark:text-[#71839D] uppercase select-none">
                  {group.name}
                </p>
              ) : (
                <div className="w-full h-px bg-slate-100 dark:bg-[#24344D] my-2" />
              )}
              {group.items.map(item => {
                const Icon = item.icon;
                const active = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setSidebarOpen(false);
                    }}
                    title={sidebarCollapsed ? item.label : undefined}
                    className={`w-full h-9 flex items-center ${
                      sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3'
                    } rounded-xl text-xs font-semibold transition-all select-none ${
                      active
                        ? 'bg-brand-500 text-white shadow-sm shadow-brand-500/25'
                        : 'text-slate-600 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#1C2A42] hover:text-slate-900 dark:hover:text-[#E8EEF8]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          active ? 'text-white' : 'text-slate-400 dark:text-[#71839D]'
                        }`}
                      />
                      {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!sidebarCollapsed && item.badge !== undefined && (
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full shrink-0 ${
                          active
                            ? 'bg-white text-brand-600'
                            : 'bg-brand-50 text-brand-600 dark:bg-[#142D50] dark:text-blue-300'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-slate-100 dark:border-[#24344D] space-y-2 shrink-0">
          {/* Desktop Collapse Rail Toggle */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:flex w-full h-8 items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#17243A] rounded-lg text-xs font-medium transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="w-4 h-4 shrink-0" />
            ) : (
              <div className="flex items-center gap-2 w-full px-2">
                <ChevronLeft className="w-4 h-4 shrink-0" />
                <span className="text-[11px] font-semibold">Collapse Rail</span>
              </div>
            )}
          </button>

          {/* User Profile Card */}
          <div
            className={`flex items-center ${
              sidebarCollapsed ? 'justify-center p-1.5' : 'justify-between px-2.5 py-2'
            } bg-slate-50 dark:bg-[#17243A] rounded-xl border border-slate-200/50 dark:border-[#24344D] gap-2`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-sm select-none">
                {currentUser?.name?.[0]?.toUpperCase() || 'P'}
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="text-xs font-bold text-slate-900 dark:text-[#E8EEF8] truncate leading-tight">
                    {currentUser?.name || 'Parth'}
                  </p>
                  <p
                    className="text-[10px] text-slate-500 dark:text-[#94A3B8] truncate leading-tight block max-w-[135px]"
                    title={currentUser?.email || ''}
                  >
                    {currentUser?.email || 'admin'}
                  </p>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <button
                onClick={handleLogoutClick}
                title="Sign Out"
                className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-white dark:hover:bg-[#1C2A42] transition-colors shrink-0 ml-0.5"
              >
                <LogOut className="w-3.5 h-3.5 shrink-0" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 w-full overflow-x-hidden transition-all duration-200 ${
          sidebarCollapsed ? 'md:pl-20' : 'md:pl-64'
        }`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-30 h-16 bg-white/90 dark:bg-[#0D1729]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-[#24344D] flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="md:hidden p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-[#17243A]"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5 shrink-0" />
            </button>
            <div className="truncate">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-[#71839D] truncate">
                <span>{currentGroup.name}</span>
                <span>/</span>
                <span className="text-brand-600 dark:text-blue-400 font-semibold truncate">
                  {currentItem.label}
                </span>
              </div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-[#E8EEF8] leading-tight truncate">
                {currentItem.label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            {/* Live Project Indicator */}
            <div className="hidden lg:inline-flex items-center gap-1.5 h-8 px-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 rounded-full text-[11px] font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>parthmobilecare-a474d</span>
            </div>

            {/* Theme Toggle */}
            <button
              onClick={() => setMode(mode === 'dark' ? 'light' : mode === 'light' ? 'system' : 'dark')}
              title={`Theme: ${mode} (Click to switch)`}
              className="w-9 h-9 inline-flex items-center justify-center text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#17243A] rounded-xl transition-colors"
            >
              {mode === 'dark' ? (
                <Moon className="w-4 h-4 text-blue-400 shrink-0" />
              ) : mode === 'light' ? (
                <Sun className="w-4 h-4 text-amber-500 shrink-0" />
              ) : (
                <Laptop className="w-4 h-4 shrink-0" />
              )}
            </button>

            {/* Notifications Button */}
            <button
              onClick={() => onTabChange('notifications')}
              className="relative w-9 h-9 inline-flex items-center justify-center text-slate-500 dark:text-[#94A3B8] hover:bg-slate-100 dark:hover:bg-[#17243A] rounded-xl transition-colors"
              title="Announcements & Alerts"
            >
              <Bell className="w-4 h-4 shrink-0" />
              {unreadNotifications > 0 && (
                <span className="absolute top-2 right-2 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
                </span>
              )}
            </button>

            {/* Profile Dropdown */}
            <div className="relative" ref={profileDropdownRef}>
              <button
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                aria-expanded={profileDropdownOpen}
                aria-haspopup="true"
                className="h-9 px-2 inline-flex items-center gap-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-brand-500 text-white flex items-center justify-center font-bold text-xs shadow-sm shrink-0 select-none">
                  {currentUser?.name?.[0]?.toUpperCase() || 'P'}
                </div>
                <span className="hidden sm:inline text-xs font-bold text-slate-800 dark:text-slate-200">
                  {currentUser?.name || 'Parth'}
                </span>
              </button>

              {profileDropdownOpen && (
                <div
                  className="absolute right-0 mt-2 w-52 bg-white dark:bg-[#17243A] rounded-2xl border border-slate-200 dark:border-[#24344D] shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
                  onClick={() => setProfileDropdownOpen(false)}
                >
                  <div className="px-4 py-2.5 border-b border-slate-100 dark:border-[#24344D]">
                    <p className="text-xs font-bold text-slate-900 dark:text-[#E8EEF8] truncate">
                      {currentUser?.name || 'Parth'}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-[#94A3B8] truncate">{currentUser?.email}</p>
                    <span className="inline-block mt-1 px-1.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-[#142D50] dark:text-blue-300 text-[10px] font-bold rounded-md">
                      Super Administrator
                    </span>
                  </div>
                  <button
                    onClick={() => onTabChange('profile')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-[#E8EEF8] hover:bg-slate-50 dark:hover:bg-[#1C2A42] flex items-center gap-2 transition-colors"
                  >
                    <Shield className="w-3.5 h-3.5 text-slate-400 dark:text-[#71839D] shrink-0" />
                    <span>Security & Profile</span>
                  </button>
                  <button
                    onClick={() => onTabChange('settings')}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-slate-700 dark:text-[#E8EEF8] hover:bg-slate-50 dark:hover:bg-[#1C2A42] flex items-center gap-2 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-slate-400 dark:text-[#71839D] shrink-0" />
                    <span>Shop Settings</span>
                  </button>
                  <div className="border-t border-slate-100 dark:border-[#24344D] my-1" />
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleLogoutClick();
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-2 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Page Container */}
        <main className="flex-1 p-3.5 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto min-w-0">{children}</main>
      </div>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isLogoutModalOpen}
        onClose={handleCancelLogout}
        onConfirm={handleConfirmLogout}
        title="Confirm Logout"
        message="Are you sure you want to logout from the Admin Dashboard?"
        confirmText="Logout"
        cancelText="Cancel"
        isDestructive={true}
        loading={logoutLoading}
      />
    </div>
  );
};
