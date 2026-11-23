import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false,
  loading = false,
}) => {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="sm">
      <div className="flex items-center gap-3.5">
        <div
          className={`p-2.5 rounded-2xl shrink-0 ${
            isDestructive
              ? 'bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400'
          }`}
        >
          {isDestructive ? <AlertTriangle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
        </div>
        <div className="text-xs sm:text-sm font-medium text-slate-700 dark:text-[#E8EEF8] leading-normal flex-1 min-w-0">
          {message}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-[#24344D]">
        <Button
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={loading}
        >
          {cancelText}
        </Button>
        <Button
          variant={isDestructive ? 'danger' : 'primary'}
          size="sm"
          onClick={onConfirm}
          loading={loading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
};
