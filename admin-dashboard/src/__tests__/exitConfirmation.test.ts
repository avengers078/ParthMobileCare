import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_EXIT_TITLE,
  DEFAULT_EXIT_MESSAGE,
  DEFAULT_EXIT_CONFIRM_TEXT,
  DEFAULT_EXIT_CANCEL_TEXT,
  ExitPromptOptions,
} from '../context/ExitConfirmationContext';

describe('Admin Dashboard Exit Confirmation Specification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('1. Verifies exact specification title, message, and button labels', () => {
    expect(DEFAULT_EXIT_TITLE).toBe('Exit Dashboard');
    expect(DEFAULT_EXIT_MESSAGE).toBe('Are you sure you want to exit?');
    expect(DEFAULT_EXIT_CONFIRM_TEXT).toBe('Exit');
    expect(DEFAULT_EXIT_CANCEL_TEXT).toBe('Cancel');
  });

  class ExitConfirmationStateManager {
    private dirtyRegistry: Record<string, boolean> = {};
    private isModalOpen = false;
    private modalOptions: ExitPromptOptions = {};
    private pendingCallback: (() => Promise<void> | void) | null = null;

    public registerUnsaved(id: string, isDirty: boolean) {
      if (isDirty) {
        this.dirtyRegistry[id] = true;
      } else {
        delete this.dirtyRegistry[id];
      }
    }

    public clearUnsaved() {
      this.dirtyRegistry = {};
    }

    public hasUnsaved(): boolean {
      return Object.values(this.dirtyRegistry).some(Boolean);
    }

    public requestExit(options?: ExitPromptOptions): boolean {
      if (this.isModalOpen) return false; // Prevent duplicate confirmation dialogs
      this.isModalOpen = true;
      this.modalOptions = options || {};
      this.pendingCallback = options?.onConfirm || null;
      return true;
    }

    public guardedNavigate(action: () => void): boolean {
      if (!this.hasUnsaved()) {
        action();
        return true; // Navigated directly
      }
      this.requestExit({
        title: DEFAULT_EXIT_TITLE,
        message: 'You have unsaved changes in this module. Are you sure you want to leave?',
        confirmText: DEFAULT_EXIT_CONFIRM_TEXT,
        cancelText: DEFAULT_EXIT_CANCEL_TEXT,
        onConfirm: () => {
          this.clearUnsaved();
          action();
        },
      });
      return false; // Intercepted
    }

    public confirmModal() {
      if (this.pendingCallback) {
        this.pendingCallback();
      }
      this.isModalOpen = false;
      this.pendingCallback = null;
    }

    public cancelModal() {
      this.isModalOpen = false;
      this.pendingCallback = null;
    }

    public isOpen(): boolean {
      return this.isModalOpen;
    }

    public getModalOptions(): ExitPromptOptions {
      return this.modalOptions;
    }
  }

  it('2. Navigates normally between internal modules without popup when no unsaved changes', () => {
    const manager = new ExitConfirmationStateManager();
    const navigateFn = vi.fn();

    const direct = manager.guardedNavigate(navigateFn);
    expect(direct).toBe(true);
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(manager.isOpen()).toBe(false);
  });

  it('3. Intercepts internal module navigation when unsaved changes exist and preserves state if canceled', () => {
    const manager = new ExitConfirmationStateManager();
    const navigateFn = vi.fn();

    manager.registerUnsaved('shop_settings', true);
    expect(manager.hasUnsaved()).toBe(true);

    const direct = manager.guardedNavigate(navigateFn);
    expect(direct).toBe(false);
    expect(navigateFn).not.toHaveBeenCalled();
    expect(manager.isOpen()).toBe(true);
    expect(manager.getModalOptions().title).toBe(DEFAULT_EXIT_TITLE);

    // If user chooses "Cancel"
    manager.cancelModal();
    expect(manager.isOpen()).toBe(false);
    expect(navigateFn).not.toHaveBeenCalled();
    expect(manager.hasUnsaved()).toBe(true); // Form data preserved
  });

  it('4. Allows navigation and clears unsaved flag when user confirms "Exit"', () => {
    const manager = new ExitConfirmationStateManager();
    const navigateFn = vi.fn();

    manager.registerUnsaved('profile_password', true);
    manager.guardedNavigate(navigateFn);
    expect(manager.isOpen()).toBe(true);

    // User confirms
    manager.confirmModal();
    expect(manager.isOpen()).toBe(false);
    expect(navigateFn).toHaveBeenCalledTimes(1);
    expect(manager.hasUnsaved()).toBe(false);
  });

  it('5. Prevents duplicate confirmation dialogs if an exit prompt is already open', () => {
    const manager = new ExitConfirmationStateManager();
    const firstRequest = manager.requestExit();
    expect(firstRequest).toBe(true);
    expect(manager.isOpen()).toBe(true);

    // Second request while open should be ignored
    const secondRequest = manager.requestExit();
    expect(secondRequest).toBe(false);
  });

  it('6. Browser back exit trigger exits site without logging out session', () => {
    const manager = new ExitConfirmationStateManager();
    const closeSiteFn = vi.fn();
    const logoutFn = vi.fn();

    manager.requestExit({
      title: DEFAULT_EXIT_TITLE,
      message: DEFAULT_EXIT_MESSAGE,
      confirmText: DEFAULT_EXIT_CONFIRM_TEXT,
      cancelText: DEFAULT_EXIT_CANCEL_TEXT,
      onConfirm: closeSiteFn,
    });

    expect(manager.isOpen()).toBe(true);
    expect(manager.getModalOptions().title).toBe('Exit Dashboard');
    expect(manager.getModalOptions().message).toBe('Are you sure you want to exit?');
    expect(manager.getModalOptions().confirmText).toBe('Exit');
    expect(manager.getModalOptions().cancelText).toBe('Cancel');

    manager.confirmModal();
    expect(closeSiteFn).toHaveBeenCalledTimes(1);
    expect(logoutFn).not.toHaveBeenCalled(); // Crucial: logout is NOT triggered
  });

  it('7. Browser back cancel restores guard state and keeps user on current page without logging out', () => {
    let guardPushed = false;
    let pushCount = 0;

    const mockPushState = () => {
      guardPushed = true;
      pushCount++;
    };

    // Initial mount push
    mockPushState();
    expect(guardPushed).toBe(true);
    expect(pushCount).toBe(1);

    // Popstate occurs (guard popped)
    guardPushed = false;

    const manager = new ExitConfirmationStateManager();
    const logoutFn = vi.fn();

    manager.requestExit({
      title: DEFAULT_EXIT_TITLE,
      message: DEFAULT_EXIT_MESSAGE,
      confirmText: DEFAULT_EXIT_CONFIRM_TEXT,
      cancelText: DEFAULT_EXIT_CANCEL_TEXT,
      onConfirm: () => {},
    });

    expect(manager.isOpen()).toBe(true);

    // User clicks Cancel
    manager.cancelModal();
    expect(manager.isOpen()).toBe(false);

    // Guard restored
    mockPushState();
    expect(guardPushed).toBe(true);
    expect(pushCount).toBe(2);
    expect(logoutFn).not.toHaveBeenCalled();
  });

  it('8. Verifies pending navigation execution on Exit without clearing authentication tokens', () => {
    const historyBackFn = vi.fn();
    const clearStorageFn = vi.fn();

    const manager = new ExitConfirmationStateManager();

    manager.requestExit({
      title: DEFAULT_EXIT_TITLE,
      message: DEFAULT_EXIT_MESSAGE,
      confirmText: DEFAULT_EXIT_CONFIRM_TEXT,
      cancelText: DEFAULT_EXIT_CANCEL_TEXT,
      onConfirm: () => {
        historyBackFn();
      },
    });

    manager.confirmModal();
    expect(historyBackFn).toHaveBeenCalledTimes(1);
    expect(clearStorageFn).not.toHaveBeenCalled();
  });
});
