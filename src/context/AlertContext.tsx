import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import { AppAlert, AppAlertOptions, AlertType } from '../components/common/AppAlert';
import { getFriendlyErrorMessage } from '../utils/errorHandler';

export interface AlertContextType {
  showAlert: (options: AppAlertOptions) => void;
  showSuccess: (title: string, message: string, onConfirm?: () => void) => void;
  showError: (title: string, errorOrMessage: any, onConfirm?: () => void) => void;
  showWarning: (title: string, message: string, onConfirm?: () => void) => void;
  showInfo: (title: string, message: string, onConfirm?: () => void) => void;
  showConfirm: (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

// Static dispatcher allowing imperatively showing alerts outside React lifecycle if needed
type AlertListener = (options: AppAlertOptions | null) => void;
let globalAlertListener: AlertListener | null = null;

export const AppAlertService = {
  show: (options: AppAlertOptions) => {
    if (globalAlertListener) {
      globalAlertListener(options);
    }
  },
  showSuccess: (title: string, message: string, onConfirm?: () => void) => {
    AppAlertService.show({ type: 'success', title, message, onConfirm });
  },
  showError: (title: string, errorOrMessage: any, onConfirm?: () => void) => {
    const cleanMessage =
      typeof errorOrMessage === 'string'
        ? getFriendlyErrorMessage(errorOrMessage)
        : getFriendlyErrorMessage(errorOrMessage, 'Something went wrong while processing your request. Please try again.');
    AppAlertService.show({ type: 'error', title, message: cleanMessage, onConfirm });
  },
  showConfirm: (options: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }) => {
    AppAlertService.show({ type: 'confirm', ...options });
  },
  hide: () => {
    if (globalAlertListener) {
      globalAlertListener(null);
    }
  },
};

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alertOptions, setAlertOptions] = useState<AppAlertOptions | null>(null);

  // Register global listener
  React.useEffect(() => {
    globalAlertListener = (options) => {
      setAlertOptions(options);
    };
    return () => {
      globalAlertListener = null;
    };
  }, []);

  const hideAlert = useCallback(() => {
    setAlertOptions(null);
  }, []);

  const showAlert = useCallback((options: AppAlertOptions) => {
    setAlertOptions(options);
  }, []);

  const showSuccess = useCallback((title: string, message: string, onConfirm?: () => void) => {
    showAlert({
      type: 'success',
      title,
      message,
      onConfirm,
    });
  }, [showAlert]);

  const showError = useCallback((title: string, errorOrMessage: any, onConfirm?: () => void) => {
    const cleanMessage =
      typeof errorOrMessage === 'string'
        ? getFriendlyErrorMessage(errorOrMessage)
        : getFriendlyErrorMessage(errorOrMessage, 'Something went wrong while processing your request. Please try again.');

    showAlert({
      type: 'error',
      title,
      message: cleanMessage,
      onConfirm,
    });
  }, [showAlert]);

  const showWarning = useCallback((title: string, message: string, onConfirm?: () => void) => {
    showAlert({
      type: 'warning',
      title,
      message,
      onConfirm,
    });
  }, [showAlert]);

  const showInfo = useCallback((title: string, message: string, onConfirm?: () => void) => {
    showAlert({
      type: 'info',
      title,
      message,
      onConfirm,
    });
  }, [showAlert]);

  const showConfirm = useCallback(
    (options: {
      title: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
      onConfirm: () => void;
      onCancel?: () => void;
    }) => {
      showAlert({
        type: 'confirm',
        ...options,
      });
    },
    [showAlert]
  );

  const value = useMemo(
    () => ({
      showAlert,
      showSuccess,
      showError,
      showWarning,
      showInfo,
      showConfirm,
      hideAlert,
    }),
    [showAlert, showSuccess, showError, showWarning, showInfo, showConfirm, hideAlert]
  );

  return (
    <AlertContext.Provider value={value}>
      {children}
      <AppAlert
        visible={alertOptions !== null}
        options={alertOptions}
        onDismiss={hideAlert}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    // Provide a safe fallback delegating to AppAlertService if called outside provider
    return {
      showAlert: AppAlertService.show,
      showSuccess: AppAlertService.showSuccess,
      showError: AppAlertService.showError,
      showWarning: (title, message, onConfirm) => AppAlertService.show({ type: 'warning', title, message, onConfirm }),
      showInfo: (title, message, onConfirm) => AppAlertService.show({ type: 'info', title, message, onConfirm }),
      showConfirm: AppAlertService.showConfirm,
      hideAlert: AppAlertService.hide,
    };
  }
  return context;
};

