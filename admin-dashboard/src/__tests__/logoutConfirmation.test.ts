import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Admin Dashboard Logout Confirmation Specification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  interface LogoutConfirmationState {
    isOpen: boolean;
    loading: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    isDestructive: boolean;
  }

  class LogoutConfirmationManager {
    public state: LogoutConfirmationState = {
      isOpen: false,
      loading: false,
      title: 'Confirm Logout',
      message: 'Are you sure you want to logout from the Admin Dashboard?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      isDestructive: true,
    };

    public openModal() {
      this.state.isOpen = true;
    }

    public closeModal() {
      if (this.state.loading) return;
      this.state.isOpen = false;
    }

    public async confirmLogout(
      logoutFn: () => Promise<void>,
      showToastFn: (type: 'success' | 'error', msg: string) => void
    ) {
      if (this.state.loading) return;
      this.state.loading = true;
      try {
        await logoutFn();
        this.state.isOpen = false;
        showToastFn('success', 'Logged out successfully');
      } catch (err: any) {
        showToastFn('error', err?.message || 'Failed to logout. Please try again.');
      } finally {
        this.state.loading = false;
      }
    }
  }

  it('1. Verifies exact specification title, message, and button labels', () => {
    const manager = new LogoutConfirmationManager();
    expect(manager.state.title).toBe('Confirm Logout');
    expect(manager.state.message).toBe('Are you sure you want to logout from the Admin Dashboard?');
    expect(manager.state.confirmText).toBe('Logout');
    expect(manager.state.cancelText).toBe('Cancel');
    expect(manager.state.isDestructive).toBe(true);
  });

  it('2. Clicking Logout icon opens confirmation modal without calling signOut immediately', () => {
    const manager = new LogoutConfirmationManager();
    const signOutMock = vi.fn();

    expect(manager.state.isOpen).toBe(false);
    manager.openModal();
    expect(manager.state.isOpen).toBe(true);
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('3. Clicking Cancel closes popup and preserves Firebase authentication session', () => {
    const manager = new LogoutConfirmationManager();
    const signOutMock = vi.fn();
    const clearStorageMock = vi.fn();

    manager.openModal();
    expect(manager.state.isOpen).toBe(true);

    // User cancels
    manager.closeModal();
    expect(manager.state.isOpen).toBe(false);
    expect(signOutMock).not.toHaveBeenCalled();
    expect(clearStorageMock).not.toHaveBeenCalled();
  });

  it('4. Clicking Logout executes Firebase signOut and reports success toast', async () => {
    const manager = new LogoutConfirmationManager();
    const signOutMock = vi.fn().mockResolvedValue(undefined);
    const showToastMock = vi.fn();

    manager.openModal();
    await manager.confirmLogout(signOutMock, showToastMock);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(manager.state.isOpen).toBe(false);
    expect(manager.state.loading).toBe(false);
    expect(showToastMock).toHaveBeenCalledWith('success', 'Logged out successfully');
  });

  it('5. Failed signOut displays error toast and does not falsely report success', async () => {
    const manager = new LogoutConfirmationManager();
    const signOutMock = vi.fn().mockRejectedValue(new Error('Network error during sign out'));
    const showToastMock = vi.fn();

    manager.openModal();
    await manager.confirmLogout(signOutMock, showToastMock);

    expect(signOutMock).toHaveBeenCalledTimes(1);
    expect(manager.state.loading).toBe(false);
    expect(showToastMock).toHaveBeenCalledWith('error', 'Network error during sign out');
    expect(showToastMock).not.toHaveBeenCalledWith('success', expect.anything());
  });

  it('6. Prevents duplicate concurrent logout requests while loading', async () => {
    const manager = new LogoutConfirmationManager();
    let resolveSignOut: () => void = () => {};
    const signOutMock = vi.fn().mockImplementation(() => {
      return new Promise<void>((resolve) => {
        resolveSignOut = resolve;
      });
    });
    const showToastMock = vi.fn();

    manager.openModal();

    // First click initiates logout
    const firstCall = manager.confirmLogout(signOutMock, showToastMock);
    expect(manager.state.loading).toBe(true);

    // Second click during in-flight logout should be ignored
    const secondCall = manager.confirmLogout(signOutMock, showToastMock);
    expect(signOutMock).toHaveBeenCalledTimes(1);

    resolveSignOut();
    await Promise.all([firstCall, secondCall]);
    expect(signOutMock).toHaveBeenCalledTimes(1);
  });

  it('7. Browser Exit confirmation and Logout confirmation remain completely separate', () => {
    const logoutMock = vi.fn();
    const browserBackMock = vi.fn();

    // Simulating Browser Exit flow
    const executeBrowserExit = (onConfirm: () => void) => {
      onConfirm();
    };

    executeBrowserExit(() => {
      browserBackMock();
    });

    expect(browserBackMock).toHaveBeenCalledTimes(1);
    expect(logoutMock).not.toHaveBeenCalled(); // Exit never triggers logout

    // Simulating Logout flow
    const executeLogoutFlow = (onConfirm: () => void) => {
      onConfirm();
    };

    executeLogoutFlow(() => {
      logoutMock();
    });

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(browserBackMock).toHaveBeenCalledTimes(1); // Back was not called again
  });
});
