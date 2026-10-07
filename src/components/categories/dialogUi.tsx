import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

// Styles and the dialog frame shared by the category dialogs (the same tokens as the other dialogs of the app).

const FIELD_CLS = 'border border-gray-200 dark:border-gray-800 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50';
export const INPUT_CLS = `w-full px-3 py-2.5 text-sm ${FIELD_CLS}`;
const BTN_BASE = 'inline-flex items-center justify-center font-light tracking-tight rounded-md transition-opacity disabled:opacity-50 disabled:cursor-not-allowed';
export const BTN_SECONDARY = `${BTN_BASE} px-4 py-2.5 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:opacity-70`;
export const BTN_SECONDARY_SM = `${BTN_BASE} px-3 py-1.5 text-xs text-gray-900 dark:text-white bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:opacity-70`;
export const BTN_PRIMARY = `${BTN_BASE} px-4 py-2.5 text-sm text-white bg-primary-600 dark:bg-primary-500 border border-primary-600 dark:border-primary-500 hover:opacity-80`;
export const BTN_DANGER = `${BTN_BASE} px-4 py-2.5 text-sm text-white bg-red-500 border border-red-500 hover:opacity-80`;
export const LABEL_CLS = 'block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1';
export const MUTED_CLS = 'text-gray-600 dark:text-gray-400';
export const ERROR_CLS = 'text-xs text-red-600 dark:text-red-400';
export const NOTICE_BOX_CLS = 'rounded-md border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-4 py-3 text-sm text-orange-900 dark:text-orange-200 space-y-1';

interface DialogShellProps {
  open: boolean;
  onClose: () => void;
  /** False while a request that must not be abandoned is in flight: ESC, the backdrop and the X do nothing. */
  canClose: boolean;
  titleId: string;
  title: string;
  icon?: ReactNode;
  /** Tailwind max-width class of the panel. */
  widthClass?: string;
  children: ReactNode;
}

/** Portal, backdrop, scroll lock, ESC, and the close guard. */
export const DialogShell = ({ open, onClose, canClose, titleId, title, icon, widthClass = 'max-w-lg', children }: DialogShellProps) => {
  const { t } = useI18n();
  const canCloseRef = useRef(canClose);
  canCloseRef.current = canClose;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previousOverflow = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && canCloseRef.current) onCloseRef.current();
    };
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [open]);

  if (!open) return null;
  const requestClose = () => {
    if (canClose) onClose();
  };
  return createPortal(
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="fixed inset-0 bg-black/40 transition-opacity" onClick={requestClose} aria-hidden="true" />
      <div className="flex min-h-full items-center justify-center p-4">
        <div role="dialog" aria-modal="true" aria-labelledby={titleId}
          className={`relative w-full ${widthClass} p-6 border rounded-lg bg-white dark:bg-gray-900 border-gray-100 dark:border-gray-800 max-h-[90vh] overflow-y-auto min-w-0`}>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center min-w-0">
              {icon}
              <h3 id={titleId} className="text-lg font-light tracking-tight text-gray-900 dark:text-white truncate">{title}</h3>
            </div>
            <button type="button" onClick={requestClose} disabled={!canClose} aria-label={t.close}
              className="text-gray-400 dark:text-gray-500 hover:opacity-70 transition-opacity p-1 disabled:opacity-40 disabled:cursor-not-allowed">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};
