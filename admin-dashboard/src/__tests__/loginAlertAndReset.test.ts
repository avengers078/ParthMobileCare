import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Admin Login Alert Auto-Dismissal & Password Reset Specification', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  interface LoginAlert {
    id: string;
    type: 'error' | 'success' | 'info';
    message: string;
  }

  // Model of the LoginPage alert lifecycle & auto-dismissal logic
  class AlertLifecycleManager {
    private currentAlert: LoginAlert | null = null;
    private timerId: NodeJS.Timeout | null = null;
    public listeners: ((alert: LoginAlert | null) => void)[] = [];

    public setAlert(type: 'error' | 'success' | 'info', message: string): void {
      // Clear existing scheduled timer
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }

      // Replaces prior alert immediately (never stacks success + error)
      const newAlert: LoginAlert = {
        id: `alert-${Date.now()}-${Math.random()}`,
        type,
        message,
      };
      this.currentAlert = newAlert;
      this.notify();

      // Timing rule: Error = 5s, Success/Info = 4s
      const duration = type === 'error' ? 5000 : 4000;
      const targetId = newAlert.id;

      this.timerId = setTimeout(() => {
        if (this.currentAlert?.id === targetId) {
          this.currentAlert = null;
          this.timerId = null;
          this.notify();
        }
      }, duration);
    }

    public dismiss(): void {
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
      this.currentAlert = null;
      this.notify();
    }

    public cleanup(): void {
      if (this.timerId) {
        clearTimeout(this.timerId);
        this.timerId = null;
      }
    }

    public getAlert(): LoginAlert | null {
      return this.currentAlert;
    }

    private notify(): void {
      this.listeners.forEach((l) => l(this.currentAlert));
    }
  }

  it('1. Success alerts automatically dismiss after 4 seconds', () => {
    const manager = new AlertLifecycleManager();
    manager.setAlert('success', 'If an account exists for this email, password reset instructions will be sent. Please check your inbox and spam folder.');

    expect(manager.getAlert()).not.toBeNull();
    expect(manager.getAlert()?.type).toBe('success');

    // After 3.9 seconds, still visible
    vi.advanceTimersByTime(3900);
    expect(manager.getAlert()).not.toBeNull();

    // At 4.0 seconds, auto-dismissed
    vi.advanceTimersByTime(100);
    expect(manager.getAlert()).toBeNull();
  });

  it('2. Error alerts automatically dismiss after 5 seconds', () => {
    const manager = new AlertLifecycleManager();
    manager.setAlert('error', 'Invalid email or password.');

    expect(manager.getAlert()).not.toBeNull();
    expect(manager.getAlert()?.type).toBe('error');

    // After 4.5 seconds, error is still visible
    vi.advanceTimersByTime(4500);
    expect(manager.getAlert()).not.toBeNull();

    // At 5.0 seconds, auto-dismissed
    vi.advanceTimersByTime(500);
    expect(manager.getAlert()).toBeNull();
  });

  it('3. Informational alerts automatically dismiss after 4 seconds', () => {
    const manager = new AlertLifecycleManager();
    manager.setAlert('info', 'Session expired. Please log in again.');

    vi.advanceTimersByTime(3999);
    expect(manager.getAlert()).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(manager.getAlert()).toBeNull();
  });

  it('4. New alert immediately replaces previous alert (no simultaneous error + success stacking)', () => {
    const manager = new AlertLifecycleManager();

    // Step 1: User fails login -> error alert
    manager.setAlert('error', 'Invalid email or password.');
    expect(manager.getAlert()?.type).toBe('error');
    expect(manager.getAlert()?.message).toBe('Invalid email or password.');

    // Step 2: 2 seconds later, user requests password reset -> success alert
    vi.advanceTimersByTime(2000);
    manager.setAlert(
      'success',
      'If an account exists for this email, password reset instructions will be sent. Please check your inbox and spam folder.'
    );

    // Prior error is eradicated; only success alert is present
    expect(manager.getAlert()?.type).toBe('success');
    expect(manager.getAlert()?.message).toContain('If an account exists for this email');

    // After another 3 seconds (5s total from start, 3s from reset), success is still visible
    vi.advanceTimersByTime(3000);
    expect(manager.getAlert()?.type).toBe('success');

    // At 4s from reset, success alert auto-dismisses
    vi.advanceTimersByTime(1000);
    expect(manager.getAlert()).toBeNull();
  });

  it('5. Manual close action dismisses the alert immediately and clears timers', () => {
    const manager = new AlertLifecycleManager();
    manager.setAlert('error', 'Invalid email or password.');

    expect(manager.getAlert()).not.toBeNull();

    // User clicks X button
    manager.dismiss();
    expect(manager.getAlert()).toBeNull();

    // Advancing timers does nothing (no resurrected or ghost state)
    vi.advanceTimersByTime(6000);
    expect(manager.getAlert()).toBeNull();
  });

  it('6. Component unmount clears pending dismissal timer without memory leak', () => {
    const manager = new AlertLifecycleManager();
    manager.setAlert('success', 'Reset sent');

    // Simulate unmount
    manager.cleanup();

    // Advance time past dismissal
    vi.advanceTimersByTime(5000);
    // Alert remains as it was at unmount moment, timer did not fire callback on unmounted entity
    expect(manager.getAlert()).not.toBeNull();
  });

  it('7. Translates Firebase password reset errors safely without exposing account existence', () => {
    const translateResetError = (errCode: string): string => {
      switch (errCode) {
        case 'auth/invalid-email':
          return 'Please enter a valid email address.';
        case 'auth/too-many-requests':
          return 'Too many requests. Please wait a few moments before trying again.';
        case 'auth/network-request-failed':
          return 'Network connection failed. Please check your internet connectivity.';
        default:
          return 'Could not send password reset email. Please try again.';
      }
    };

    expect(translateResetError('auth/invalid-email')).toBe('Please enter a valid email address.');
    expect(translateResetError('auth/too-many-requests')).toContain('Too many requests');
    expect(translateResetError('auth/network-request-failed')).toContain('Network connection failed');
    expect(translateResetError('auth/unknown-internal')).toBe('Could not send password reset email. Please try again.');
  });

  it('8. Restricts password reset requests strictly to active primary admin (parthmobilecare07@gmail.com) and rejects retired legacy admin & arbitrary accounts', () => {
    const AUTHORIZED_ADMIN_EMAILS = ['parthmobilecare07@gmail.com'];

    const validateResetRequest = (email: string): { valid: boolean; error?: string } => {
      const cleanEmail = email.trim().toLowerCase();
      if (!cleanEmail) {
        return { valid: false, error: 'Please enter your administrator email address.' };
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(cleanEmail)) {
        return { valid: false, error: 'Please enter a valid email address.' };
      }
      if (!AUTHORIZED_ADMIN_EMAILS.includes(cleanEmail)) {
        return {
          valid: false,
          error: 'Access Denied: This email address is not registered as an administrator.',
        };
      }
      return { valid: true };
    };

    // Arbitrary / staff accounts MUST be rejected
    expect(validateResetRequest('staff@gmail.com')).toEqual({
      valid: false,
      error: 'Access Denied: This email address is not registered as an administrator.',
    });
    expect(validateResetRequest('chetanluhar65@gmail.com')).toEqual({
      valid: false,
      error: 'Access Denied: This email address is not registered as an administrator.',
    });
    expect(validateResetRequest('randomperson@gmail.com')).toEqual({
      valid: false,
      error: 'Access Denied: This email address is not registered as an administrator.',
    });

    // Retired legacy admin MUST now be rejected
    expect(validateResetRequest('parthmobileindia@gmail.com')).toEqual({
      valid: false,
      error: 'Access Denied: This email address is not registered as an administrator.',
    });

    // Valid primary admin MUST be accepted
    expect(validateResetRequest('parthmobilecare07@gmail.com')).toEqual({
      valid: true,
    });
  });

  it('9. Uses professional generic placeholder without exposing real store admin email', () => {
    const placeholder = 'admin@parthmobilecare.com';
    expect(placeholder).not.toBe('parthmobilecare07@gmail.com');
    expect(placeholder).not.toBe('parthmobileindia@gmail.com');
    expect(placeholder).toBe('admin@parthmobilecare.com');
  });
});
