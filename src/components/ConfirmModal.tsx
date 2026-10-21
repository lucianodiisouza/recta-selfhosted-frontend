import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../context/I18nContext';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
  cancelText,
  variant = 'danger',
  isLoading = false,
}: ConfirmModalProps) => {
  const { t } = useI18n();

  // Handler para fechar com ESC e prevenir scroll do body
  useEffect(() => {
    if (!isOpen) return;
    
    // Prevenir scroll do body quando modal estiver aberto
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    await Promise.resolve(onConfirm());
    onClose();
  };

  const variantStyles = {
    danger: {
      icon: 'text-negative',
      button: 'bg-red-500 dark:bg-red-500 text-white border-red-500 dark:border-red-500',
    },
    warning: {
      icon: 'text-yellow-500',
      button: 'bg-yellow-500 dark:bg-yellow-500 text-white border-yellow-500 dark:border-yellow-500',
    },
    info: {
      icon: 'text-info',
      button: 'bg-blue-500 dark:bg-blue-500 text-white border-blue-500 dark:border-blue-500',
    },
  };

  const styles = variantStyles[variant];

  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Scrollable Container */}
      <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
        {/* Modal Card */}
        <div className="relative w-full sm:w-96 max-w-md p-6 bg-surface-elevated rounded-t-[28px] sm:rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <AlertTriangle className={`h-5 w-5 ${styles.icon} mr-3`} />
              <h3 className="font-rounded text-lg font-semibold text-content">
                {title}
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar modal"
              className="text-content-tertiary hover:opacity-70 transition-opacity p-1"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mb-8">
            <p className="text-sm font-light text-content-secondary leading-relaxed">
              {message}
            </p>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
            >
              {cancelText || t.cancel}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={isLoading}
              className={`px-4 py-2.5 text-sm font-light tracking-tight rounded-md border transition-opacity hover:opacity-80 ${styles.button} ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? t.loading : (confirmText || t.delete)}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ConfirmModal;
