import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Mail,
  Lock,
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  X,
  Info,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Modal } from '../components/common/Modal';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { AUTHORIZED_ADMIN_EMAILS } from '../services/firebase';

interface LoginAlert {
  id: string;
  type: 'error' | 'success' | 'info';
  message: string;
}

export const LoginPage: React.FC = () => {
  const { login, sendPasswordReset } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<LoginAlert | null>(null);

  // Forgot Password modal state
  const [forgotModalOpen, setForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  // Auto-dismiss transient login alerts with cleanup
  useEffect(() => {
    if (!alert) return;

    // Timing specification:
    // Success: 4 seconds
    // Error: 5 seconds
    // Informational: 4 seconds
    const duration = alert.type === 'error' ? 5000 : 4000;
    const currentAlertId = alert.id;

    const timerId = setTimeout(() => {
      setAlert((current) => (current?.id === currentAlertId ? null : current));
    }, duration);

    return () => {
      clearTimeout(timerId);
    };
  }, [alert]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setAlert({
        id: `alert-${Date.now()}`,
        type: 'error',
        message: 'Please enter your administrator email and password.',
      });
      return;
    }

    setLoading(true);
    try {
      const res = await login(cleanEmail, password);
      if (!res.success) {
        setAlert({
          id: `alert-${Date.now()}`,
          type: 'error',
          message: res.message,
        });
      }
    } catch (err: any) {
      setAlert({
        id: `alert-${Date.now()}`,
        type: 'error',
        message: err?.message || 'Login failed. Please check credentials.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetLoading) return; // Prevent repeated rapid requests

    setResetError('');
    const cleanEmail = resetEmail.trim().toLowerCase();

    if (!cleanEmail) {
      setResetError('Please enter your administrator email address.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setResetError('Please enter a valid email address.');
      return;
    }

    if (!AUTHORIZED_ADMIN_EMAILS.includes(cleanEmail)) {
      setResetError('Access Denied: This email address is not registered as an administrator.');
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordReset(cleanEmail);
      // Security-safe confirmation that replaces any prior alert
      setAlert({
        id: `alert-${Date.now()}`,
        type: 'success',
        message:
          'Password reset instructions have been dispatched to your administrator email address. Please check your inbox.',
      });
      setForgotModalOpen(false);
    } catch (err: any) {
      setResetError(err?.message || 'Could not send password reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col justify-between bg-slate-100/70 dark:bg-[#0A101D] text-slate-900 dark:text-slate-100 selection:bg-brand-500 selection:text-white transition-colors duration-200">
      {/* Top Navigation - Minimal Theme Toggle */}
      <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-4 flex justify-end">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="p-2 rounded-xl bg-white dark:bg-[#121B2B] border border-slate-200 dark:border-[#223147] text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-blue-400 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-500/20"
        >
          {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
        </button>
      </div>

      {/* Main Container - Single Unified Beautiful Card */}
      <main className="flex-1 flex items-center justify-center px-4 sm:px-6 py-6">
        <div className="w-full max-w-md bg-white dark:bg-[#121B2B] rounded-2xl border border-slate-200/90 dark:border-[#223147] shadow-xl shadow-slate-200/50 dark:shadow-none p-6 sm:p-9 transition-all">
          
          {/* Card Header: Logo + Title + Subtitle (All Inside The Card) */}
          <div className="text-center pb-6 border-b border-slate-100 dark:border-slate-800/80">
            <div className="inline-flex w-16 h-16 rounded-2xl bg-slate-50 dark:bg-[#192538] border border-slate-200/80 dark:border-[#2A3B54] p-2 items-center justify-center shadow-sm select-none mx-auto mb-3">
              <img
                src="/logo.png"
                alt="Parth Mobile Care Logo"
                className="w-full h-full object-contain select-none"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              Parth Mobile Care
            </h1>
            <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
              Admin Web Portal Sign In
            </p>
          </div>

          {/* Form Content */}
          <div className="pt-6">
            {/* Transient Alert Banner with Accessibility and Manual Close */}
            {alert && (
              <div
                role="alert"
                aria-live="polite"
                className={`mb-5 p-3 rounded-xl border flex items-start justify-between gap-2.5 text-xs animate-in fade-in duration-150 ${
                  alert.type === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/70 text-rose-700 dark:text-rose-300'
                    : alert.type === 'success'
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/70 text-emerald-700 dark:text-emerald-300'
                    : 'bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800/70 text-blue-700 dark:text-blue-300'
                }`}
              >
                <div className="flex items-start gap-2 flex-1">
                  {alert.type === 'error' && (
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                  )}
                  {alert.type === 'success' && (
                    <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
                  )}
                  {alert.type === 'info' && (
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  )}
                  <span className="font-medium leading-relaxed">{alert.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setAlert(null)}
                  aria-label="Dismiss alert"
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4" noValidate={false}>
              <Input
                id="admin-email"
                name="email"
                label="Admin Email Address"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@parthmobilecare.com"
                icon={Mail}
              />

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300" htmlFor="admin-password">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail('');
                      setResetError('');
                      setForgotModalOpen(true);
                    }}
                    className="text-[11px] font-semibold text-brand-600 dark:text-blue-400 hover:underline focus:outline-none"
                  >
                    Forgot Password?
                  </button>
                </div>
                <Input
                  id="admin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  icon={Lock}
                  showPasswordToggle
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  loading={loading}
                  className="w-full justify-center gap-2 py-2.5 font-medium rounded-xl shadow-sm hover:shadow"
                >
                  <span>{loading ? 'Signing In...' : 'Sign In as Administrator'}</span>
                  {!loading && <ArrowRight className="w-4 h-4 shrink-0" />}
                </Button>
              </div>
            </form>

            {/* In-Card Security Notice */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>Role Restricted: Active administrator credentials required</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md mx-auto pb-6 px-4 text-center">
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          © {new Date().getFullYear()} Parth Mobile Care. All rights reserved.
        </p>
      </footer>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={forgotModalOpen}
        onClose={() => setForgotModalOpen(false)}
        title="Reset Administrator Password"
        size="sm"
      >
        <form onSubmit={handleForgotPassword} className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Enter your registered administrator email address. We will dispatch a secure password reset link via Firebase Authentication.
          </p>

          {resetError && (
            <div
              role="alert"
              className="p-3 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start justify-between gap-2 text-rose-700 dark:text-rose-300 animate-in fade-in duration-150"
            >
              <div className="flex items-start gap-2 flex-1">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{resetError}</span>
              </div>
              <button
                type="button"
                onClick={() => setResetError('')}
                aria-label="Dismiss error"
                className="p-0.5 text-rose-500 hover:text-rose-700 dark:hover:text-rose-200 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <Input
            id="reset-admin-email"
            name="resetEmail"
            label="Administrator Email"
            type="email"
            autoComplete="email"
            required
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            placeholder="admin@parthmobilecare.com"
            icon={Mail}
          />

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setForgotModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={resetLoading}
              disabled={resetLoading}
            >
              {resetLoading ? 'Sending Link...' : 'Send Reset Link'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
