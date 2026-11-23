import React, { useState } from 'react';
import {
  Shield,
  KeyRound,
  Sun,
  Moon,
  Laptop,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Mail,
  Lock,
  Check,
  Camera,
} from 'lucide-react';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { useExitConfirmation } from '../context/ExitConfirmationContext';
import { auth } from '../services/firebase';
import { ApiService } from '../services/api';
import { CloudinaryService } from '../services/cloudinaryService';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';
import { Badge } from '../components/common/Badge';

export const ProfilePage: React.FC = () => {
  const { currentUser, logout } = useAuth();
  const { showSuccess, showError } = useToast();
  const { mode, setMode } = useTheme();
  const { registerUnsavedChanges, clearUnsavedChanges } = useExitConfirmation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState({ current: false, new: false, confirm: false });

  // Track unsaved password changes
  React.useEffect(() => {
    const isDirty = Boolean(currentPassword || newPassword || confirmPassword);
    registerUnsavedChanges('admin_password_change', isDirty);
    return () => {
      registerUnsavedChanges('admin_password_change', false);
    };
  }, [currentPassword, newPassword, confirmPassword, registerUnsavedChanges]);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    const check = CloudinaryService.validateImageMeta(file.type, file.size);
    if (!check.valid) {
      showError(null, check.error || 'Please select an image under 5 MB.');
      return;
    }

    if (!CloudinaryService.isConfigured()) {
      showError(null, 'Cloud image storage is currently disconnected. Avatar upload is paused until a new storage provider is connected.');
      return;
    }

    setUploadingAvatar(true);
    try {
      const res = await CloudinaryService.uploadImage(file, {
        folder: 'avatars',
        tags: ['admin_avatar', currentUser.id],
      });
      if (res.success && res.secureUrl) {
        await ApiService.updateUserAvatar(currentUser.id, res.secureUrl);
        showSuccess('Profile avatar updated successfully.');
      } else {
        showError(null, res.error || 'Avatar upload failed.');
      }
    } catch (err: any) {
      showError(err, 'Failed to upload avatar.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const isCurrentValid = currentPassword.trim().length > 0;
  const isNewValid = newPassword.length >= 6;
  const isConfirmValid = confirmPassword.length > 0 && confirmPassword === newPassword;
  const isFormValid = isCurrentValid && isNewValid && isConfirmValid;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ current: true, new: true, confirm: true });
    setErrorMsg('');
    setSuccessMsg('');

    if (!isCurrentValid) {
      setErrorMsg('Please enter your current administrator password.');
      return;
    }

    if (!isNewValid) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    if (!isConfirmValid) {
      setErrorMsg('New password confirmation does not match.');
      return;
    }

    const fUser = auth.currentUser;
    if (!fUser || !fUser.email) {
      setErrorMsg('User authentication session not found.');
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(fUser.email, currentPassword);
      await reauthenticateWithCredential(fUser, credential);
      await updatePassword(fUser, newPassword);

      showSuccess('Your administrator password has been updated successfully.');
      setSuccessMsg('Your administrator password has been updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTouched({ current: false, new: false, confirm: false });
      clearUnsavedChanges();
      setTimeout(() => setSuccessMsg(''), 6000);
    } catch (err: any) {
      let msg = err?.message || 'Password change failed. Verify your current password.';
      if (err?.code === 'auth/wrong-password' || err?.code === 'auth/invalid-credential') {
        msg = 'Incorrect current password. Please re-enter your current password.';
      }
      setErrorMsg(msg);
      showError(err, msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      {/* Profile Header Card */}
      <Card noPadding>
        <div className="p-6 sm:p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex items-center space-x-4">
            {/* Consistent Brand Avatar with Cloudinary Upload */}
            <div className="relative group w-14 h-14 rounded-2xl bg-brand-500 text-white flex items-center justify-center font-bold text-xl shadow-sm shadow-brand-500/25 shrink-0 overflow-hidden select-none">
              {currentUser?.avatarUrl ? (
                <img
                  src={CloudinaryService.getDeviceThumbnailUrl(currentUser.avatarUrl)}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                currentUser?.name?.[0]?.toUpperCase() || 'P'
              )}
              <label
                htmlFor="admin-avatar-upload"
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer text-[10px] text-white font-medium"
                title="Change Avatar"
              >
                {uploadingAvatar ? '...' : <Camera className="w-4 h-4" />}
              </label>
              <input
                id="admin-avatar-upload"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={uploadingAvatar}
                onChange={handleAvatarFileChange}
              />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-tight">
                  {currentUser?.name || 'Parth'}
                </h3>
                <Badge variant="primary" size="xs">
                  ADMINISTRATOR
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{currentUser?.email}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/60 dark:border-slate-700/60">
                  UID: {currentUser?.id}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Full Admin Access</span>
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={LogOut}
            onClick={logout}
            className="text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-950/40 shrink-0 self-start sm:self-auto"
          >
            Sign Out
          </Button>
        </div>
      </Card>

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-2xl text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2.5 animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 rounded-2xl text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2.5 animate-in fade-in duration-200">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span className="font-medium">{errorMsg}</span>
        </div>
      )}

      {/* Theme Selection */}
      <Card
        title="Appearance & Theme"
        subtitle="Select your preferred color scheme across all dashboard management pages"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          {[
            {
              id: 'light' as const,
              label: 'Light Mode',
              desc: 'Clean white surfaces with high contrast text',
              icon: Sun,
            },
            {
              id: 'dark' as const,
              label: 'Dark Mode',
              desc: 'Deep slate background with reduced glare',
              icon: Moon,
            },
            {
              id: 'system' as const,
              label: 'System Sync',
              desc: 'Automatically matches your OS preference',
              icon: Laptop,
            },
          ].map(t => {
            const Icon = t.icon;
            const active = mode === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setMode(t.id)}
                className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all select-none ${
                  active
                    ? 'border-[#194D9C] bg-brand-50/70 dark:bg-[#17243A] text-slate-900 dark:text-[#E8EEF8] ring-2 ring-[#194D9C]/30 shadow-sm'
                    : 'border-slate-200 dark:border-[#24344D] bg-white dark:bg-[#0F192C] text-slate-700 dark:text-[#94A3B8] hover:bg-slate-50 dark:hover:bg-[#17243A] hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                      active
                        ? 'bg-[#194D9C] text-white shadow-md shadow-[#194D9C]/30'
                        : 'bg-slate-100 dark:bg-[#17243A] text-slate-500 dark:text-[#94A3B8]'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                  </div>
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all ${
                      active
                        ? 'border-[#194D9C] bg-white dark:bg-[#0D1729]'
                        : 'border-slate-300 dark:border-[#24344D]'
                    }`}
                  >
                    {active && <span className="w-2 h-2 rounded-full bg-[#194D9C]" />}
                  </div>
                </div>
                <div className="mt-3">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-[#E8EEF8]">{t.label}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-[#94A3B8] mt-0.5 leading-snug">
                    {t.desc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Security & Password Change */}
      <Card
        title="Change Administrator Password"
        subtitle="Update your administrator login credentials securely. Requires confirmation of your current password."
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-1">
          {/* Form Fields */}
          <div className="lg:col-span-7">
            <form onSubmit={handleChangePassword} className="space-y-4.5">
              <Input
                label="Current Password"
                type="password"
                required
                value={currentPassword}
                onChange={e => {
                  setCurrentPassword(e.target.value);
                  setTouched(prev => ({ ...prev, current: true }));
                }}
                onBlur={() => setTouched(prev => ({ ...prev, current: true }))}
                placeholder="••••••••"
                icon={Lock}
                showPasswordToggle
                error={touched.current && !isCurrentValid ? 'Current password is required to verify your identity.' : undefined}
              />

              <Input
                label="New Password"
                type="password"
                required
                value={newPassword}
                onChange={e => {
                  setNewPassword(e.target.value);
                  setTouched(prev => ({ ...prev, new: true }));
                }}
                onBlur={() => setTouched(prev => ({ ...prev, new: true }))}
                placeholder="At least 6 characters"
                icon={KeyRound}
                showPasswordToggle
                error={
                  touched.new && newPassword.length > 0 && newPassword.length < 6
                    ? `Password must be at least 6 characters long (currently ${newPassword.length}).`
                    : undefined
                }
                helper={
                  newPassword.length >= 6
                    ? '✓ Meets 6-character length requirement'
                    : undefined
                }
              />

              <Input
                label="Confirm New Password"
                type="password"
                required
                value={confirmPassword}
                onChange={e => {
                  setConfirmPassword(e.target.value);
                  setTouched(prev => ({ ...prev, confirm: true }));
                }}
                onBlur={() => setTouched(prev => ({ ...prev, confirm: true }))}
                placeholder="Re-enter new password"
                icon={KeyRound}
                showPasswordToggle
                error={
                  touched.confirm && confirmPassword.length > 0 && confirmPassword !== newPassword
                    ? 'Passwords do not match. Please re-enter the identical password.'
                    : undefined
                }
                helper={
                  confirmPassword.length > 0 && confirmPassword === newPassword
                    ? '✓ Passwords match successfully'
                    : undefined
                }
              />

              {/* Action Area */}
              <div className="pt-3 border-t border-slate-100 dark:border-[#24344D] flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-[11px] text-slate-500 dark:text-[#94A3B8] text-center sm:text-left">
                  {!isFormValid && (currentPassword || newPassword || confirmPassword) ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium">
                      {!isCurrentValid
                        ? '• Enter your current password'
                        : !isNewValid
                        ? '• Password must have 6+ characters'
                        : '• Confirm password must match'}
                    </span>
                  ) : (
                    <span>All fields required to update password.</span>
                  )}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  icon={KeyRound}
                  loading={loading}
                  disabled={!isFormValid || loading}
                  className="w-full sm:w-auto h-11 px-7 text-sm font-bold shadow-md shadow-[#194D9C]/20 disabled:opacity-100 disabled:bg-slate-100 dark:disabled:bg-[#17243A] disabled:text-slate-400 dark:disabled:text-[#71839D] disabled:border disabled:border-slate-200 dark:disabled:border-[#24344D] disabled:shadow-none"
                >
                  {loading ? 'Updating Credentials...' : 'Update Password'}
                </Button>
              </div>
            </form>
          </div>

          {/* Security Guidelines */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div className="p-4 bg-slate-50 dark:bg-[#17243A] rounded-xl border border-slate-200/70 dark:border-[#24344D] space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 dark:bg-[#142D50] dark:text-blue-300 flex items-center justify-center">
                  <Shield className="w-4 h-4 shrink-0" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-[#E8EEF8]">
                  Security Guidelines
                </h4>
              </div>

              <ul className="space-y-2 text-[11px] text-slate-600 dark:text-[#94A3B8]">
                <li className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span>Must be at least 6 characters long</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span>Confirmation password must match exactly</span>
                </li>
                <li className="flex items-start gap-2">
                  <div className="w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="w-2.5 h-2.5" />
                  </div>
                  <span>Stored securely via Firebase Authentication</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};
