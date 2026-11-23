import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from './AuthContext';

export interface ExitPromptOptions {
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => Promise<void> | void;
}

export interface ExitConfirmationContextType {
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  registerUnsavedChanges: (id: string, isDirty: boolean) => void;
  clearUnsavedChanges: () => void;
  requestExit: (options?: ExitPromptOptions) => void;
  guardedNavigate: (navigateAction: () => void) => void;
}

export const DEFAULT_EXIT_TITLE = 'Exit Dashboard';
export const DEFAULT_EXIT_MESSAGE = 'Are you sure you want to exit?';
export const DEFAULT_EXIT_CONFIRM_TEXT = 'Exit';
export const DEFAULT_EXIT_CANCEL_TEXT = 'Cancel';

const ExitConfirmationContext = createContext<ExitConfirmationContextType | undefined>(undefined);

export const ExitConfirmationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [dirtyRegistry, setDirtyRegistry] = useState<Record<string, boolean>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalOptions, setModalOptions] = useState<ExitPromptOptions>({});

  // Prevent duplicate dialog calls concurrently
  const isModalOpenRef = useRef(false);
  isModalOpenRef.current = isModalOpen;

  // Track if user has confirmed exiting so we don't trap them in loops
  const isExitingRef = useRef(false);

  // Track if the exit modal was triggered by browser Back navigation
  const isBackNavigationRef = useRef(false);

  const confirmCallbackRef = useRef<(() => Promise<void> | void) | null>(null);

  // Compute aggregate unsaved changes across all registered forms
  const hasUnsavedChanges = Object.values(dirtyRegistry).some(Boolean);
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  hasUnsavedChangesRef.current = hasUnsavedChanges;

  const setHasUnsavedChanges = useCallback((hasChanges: boolean) => {
    setDirtyRegistry({ manual: hasChanges });
  }, []);

  const registerUnsavedChanges = useCallback((id: string, isDirty: boolean) => {
    setDirtyRegistry((prev) => {
      if (prev[id] === isDirty) return prev;
      return { ...prev, [id]: isDirty };
    });
  }, []);

  const clearUnsavedChanges = useCallback(() => {
    setDirtyRegistry({});
  }, []);

  const requestExit = useCallback((options?: ExitPromptOptions) => {
    // Prevent duplicate confirmation dialogs
    if (isModalOpenRef.current) return;
    isModalOpenRef.current = true;

    confirmCallbackRef.current = options?.onConfirm || null;
    setModalOptions(options || {});
    setIsModalOpen(true);
  }, []);

  const guardedNavigate = useCallback(
    (navigateAction: () => void) => {
      // If there are no unsaved changes, navigate normally without unwanted popup
      if (!hasUnsavedChangesRef.current) {
        navigateAction();
        return;
      }

      // If form contains unsaved changes, warn user before leaving
      requestExit({
        title: DEFAULT_EXIT_TITLE,
        message: 'You have unsaved changes in this module. Are you sure you want to leave?',
        confirmText: DEFAULT_EXIT_CONFIRM_TEXT,
        cancelText: DEFAULT_EXIT_CANCEL_TEXT,
        onConfirm: () => {
          clearUnsavedChanges();
          navigateAction();
        },
      });
    },
    [requestExit, clearUnsavedChanges]
  );

  // 1. Browser tab close, window close, and refresh/reload protection
  useEffect(() => {
    if (!currentUser) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExitingRef.current) return;
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentUser]);

  // 2. Browser back navigation protection: prompts user and exits site without logging out
  useEffect(() => {
    if (!currentUser) return;

    // Push initial history guard entry if not already present
    try {
      if (!window.history.state?.pmcGuard) {
        window.history.pushState({ pmcGuard: true }, '', window.location.href);
      }
    } catch {}

    const handlePopState = () => {
      if (isExitingRef.current) return;
      if (isModalOpenRef.current) return;

      isBackNavigationRef.current = true;

      // Open simple exit confirmation modal
      requestExit({
        title: DEFAULT_EXIT_TITLE,
        message: DEFAULT_EXIT_MESSAGE,
        confirmText: DEFAULT_EXIT_CONFIRM_TEXT,
        cancelText: DEFAULT_EXIT_CANCEL_TEXT,
        onConfirm: () => {
          isExitingRef.current = true;
          clearUnsavedChanges();

          // Detach popstate immediately so subsequent back events are not trapped
          window.removeEventListener('popstate', handlePopState);

          // 1. Try closing window (works if script-opened)
          try {
            window.close();
          } catch {}

          // 2. Perform actual pending browser Back navigation
          try {
            window.history.back();
          } catch {}

          // 3. Fallback: if browser has nowhere to go back (fresh tab opened directly)
          // or browser blocks history navigation, navigate away so dashboard does not remain open.
          setTimeout(() => {
            try {
              if (document.referrer && !document.referrer.includes(window.location.host)) {
                window.location.replace(document.referrer);
              } else {
                window.location.replace('about:blank');
              }
            } catch {
              window.location.replace('about:blank');
            }
          }, 120);
        },
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [currentUser, requestExit, clearUnsavedChanges]);

  // 3. Navigation to an external website via links
  useEffect(() => {
    if (!currentUser) return;

    const handleLinkClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target || !target.href) return;

      try {
        const url = new URL(target.href, window.location.href);
        const isExternal = url.origin !== window.location.origin;

        // If navigating away in same tab to external site
        if (isExternal && target.target !== '_blank') {
          e.preventDefault();
          const targetHref = target.href;
          requestExit({
            title: DEFAULT_EXIT_TITLE,
            message: DEFAULT_EXIT_MESSAGE,
            confirmText: DEFAULT_EXIT_CONFIRM_TEXT,
            cancelText: DEFAULT_EXIT_CANCEL_TEXT,
            onConfirm: () => {
              isExitingRef.current = true;
              clearUnsavedChanges();
              window.location.href = targetHref;
            },
          });
        }
      } catch {
        // Ignore invalid URL parse
      }
    };

    document.addEventListener('click', handleLinkClick, true);
    return () => {
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [currentUser, requestExit, clearUnsavedChanges]);

  const handleModalConfirm = async () => {
    setModalLoading(true);
    try {
      if (confirmCallbackRef.current) {
        await confirmCallbackRef.current();
      }
    } finally {
      setModalLoading(false);
      setIsModalOpen(false);
      isModalOpenRef.current = false;
      confirmCallbackRef.current = null;
      isBackNavigationRef.current = false;
    }
  };

  const handleModalClose = () => {
    if (modalLoading) return;
    setIsModalOpen(false);
    isModalOpenRef.current = false;
    confirmCallbackRef.current = null;

    // If this was a browser back interception and user canceled/stayed:
    // Re-push the guard state so future Back clicks will still be guarded
    if (isBackNavigationRef.current && !isExitingRef.current) {
      isBackNavigationRef.current = false;
      try {
        if (!window.history.state?.pmcGuard) {
          window.history.pushState({ pmcGuard: true }, '', window.location.href);
        }
      } catch {}
    }
  };

  return (
    <ExitConfirmationContext.Provider
      value={{
        hasUnsavedChanges,
        setHasUnsavedChanges,
        registerUnsavedChanges,
        clearUnsavedChanges,
        requestExit,
        guardedNavigate,
      }}
    >
      {children}

      <ConfirmDialog
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onConfirm={handleModalConfirm}
        title={modalOptions.title || DEFAULT_EXIT_TITLE}
        message={modalOptions.message || DEFAULT_EXIT_MESSAGE}
        confirmText={modalOptions.confirmText || DEFAULT_EXIT_CONFIRM_TEXT}
        cancelText={modalOptions.cancelText || DEFAULT_EXIT_CANCEL_TEXT}
        isDestructive={true}
        loading={modalLoading}
      />
    </ExitConfirmationContext.Provider>
  );
};

export const useExitConfirmation = (): ExitConfirmationContextType => {
  const context = useContext(ExitConfirmationContext);
  if (!context) {
    throw new Error('useExitConfirmation must be used within an ExitConfirmationProvider');
  }
  return context;
};
