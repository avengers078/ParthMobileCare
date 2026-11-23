import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider, useToast } from './context/ToastContext';
import { ExitConfirmationProvider, useExitConfirmation } from './context/ExitConfirmationContext';
import { DashboardLayout, NavTab } from './layouts/DashboardLayout';
import { NavigationParams } from './utils/notificationRouter';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { StaffPage } from './pages/StaffPage';
import { AttendancePage } from './pages/AttendancePage';
import { LeadsPage } from './pages/LeadsPage';
import { PriceListPage } from './pages/PriceListPage';
import { SecondHandPage } from './pages/SecondHandPage';
import { PayrollPage } from './pages/PayrollPage';
import { ReportsPage } from './pages/ReportsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';

const DashboardContent: React.FC = () => {
  const { currentUser, isLoading } = useAuth();
  const { clearAllToasts } = useToast();
  const { guardedNavigate } = useExitConfirmation();
  const [currentTab, setCurrentTab] = useState<NavTab>('overview');
  const [navigationParams, setNavigationParams] = useState<NavigationParams | null>(null);

  const handleTabChange = (tab: NavTab) => {
    guardedNavigate(() => {
      clearAllToasts();
      setNavigationParams(null);
      setCurrentTab(tab);
    });
  };

  const handleNavigateWithParams = (tab: NavTab, params?: NavigationParams) => {
    guardedNavigate(() => {
      clearAllToasts();
      setNavigationParams(params || null);
      setCurrentTab(tab);
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-[#090F1C] transition-colors selection:bg-brand-500 selection:text-white px-4">
        {/* Animated Brand Preloader with True Circular Spinner Ring & Logo */}
        <div className="relative flex items-center justify-center mb-6">
          {/* True Circular Spinner Ring */}
          <div className="w-24 h-24 rounded-full border-[3px] border-slate-200 dark:border-slate-800 border-t-brand-600 dark:border-t-blue-400 animate-spin" />
          
          {/* Centered Circular Logo Container */}
          <div className="absolute inset-0 m-auto w-16 h-16 rounded-full bg-white dark:bg-[#0F192C] shadow-md border border-slate-200/90 dark:border-[#24344D] p-2 flex items-center justify-center overflow-hidden">
            <img
              src="/logo.png"
              alt="Parth Mobile Care Logo"
              className="w-full h-full object-contain select-none"
            />
          </div>
        </div>

        {/* Brand Title */}
        <div className="text-center space-y-1">
          <h2 className="text-base font-extrabold text-slate-900 dark:text-[#E8EEF8] tracking-tight">
            Parth Mobile Care
          </h2>
          <p className="text-[10px] font-extrabold tracking-widest uppercase text-brand-600 dark:text-blue-400">
            Admin Web Portal
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <DashboardLayout currentTab={currentTab} onTabChange={handleTabChange}>
      {currentTab === 'overview' && <OverviewPage onNavigate={handleTabChange} />}
      {currentTab === 'staff' && (
        <StaffPage
          initialParams={navigationParams}
          onClearParams={() => setNavigationParams(null)}
        />
      )}
      {currentTab === 'attendance' && (
        <AttendancePage
          initialParams={navigationParams}
          onClearParams={() => setNavigationParams(null)}
        />
      )}
      {currentTab === 'leads' && (
        <LeadsPage
          initialParams={navigationParams}
          onClearParams={() => setNavigationParams(null)}
        />
      )}
      {currentTab === 'prices' && <PriceListPage />}
      {currentTab === 'secondhand' && (
        <SecondHandPage
          initialParams={navigationParams}
          onClearParams={() => setNavigationParams(null)}
        />
      )}
      {currentTab === 'payroll' && (
        <PayrollPage
          initialParams={navigationParams}
          onClearParams={() => setNavigationParams(null)}
        />
      )}
      {currentTab === 'reports' && <ReportsPage />}
      {currentTab === 'notifications' && (
        <NotificationsPage onNavigate={handleNavigateWithParams} />
      )}
      {currentTab === 'audit' && <AuditLogsPage />}
      {currentTab === 'settings' && <SettingsPage />}
      {currentTab === 'profile' && <ProfilePage />}
    </DashboardLayout>
  );
};

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ExitConfirmationProvider>
          <ToastProvider>
            <DashboardContent />
          </ToastProvider>
        </ExitConfirmationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

