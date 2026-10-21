import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../context/I18nContext';
import { AlertTriangle, X, Trash2, Layers } from 'lucide-react';

interface InstallmentDeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeleteOnly: () => void;
  onDeleteAll: () => void;
}

const InstallmentDeleteModal = ({
  isOpen,
  onClose,
  onDeleteOnly,
  onDeleteAll,
}: InstallmentDeleteModalProps) => {
  const { t } = useI18n();

  // Handler para fechar com ESC e prevenir scroll do body
  useEffect(() => {
    if (!isOpen) return;
    
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    
    return () => {
      document.body.style.overflow = originalStyle;
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
        <div className="relative w-full sm:w-[450px] max-w-lg p-6 bg-surface-elevated rounded-t-[28px] sm:rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-negative-soft rounded-full p-2 mr-3">
                <AlertTriangle className="h-6 w-6 text-negative" />
              </div>
              <h3 className="text-xl font-bold text-content">
                {t.installmentDeleteTitle}
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar modal"
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="mb-8">
            <p className="text-gray-600 dark:text-gray-300">
              {t.installmentDeleteMessage}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => {
                onDeleteAll();
                onClose();
              }}
              className="w-full flex items-center justify-between p-4 border-2 border-red-100 dark:border-red-900/20 bg-red-50/50 dark:bg-red-900/10 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-negative-soft text-negative-on-soft group-hover:scale-110 transition-transform">
                  <Layers className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-content">{t.deleteAllSubsequentInstallments}</div>
                  <div className="text-xs text-content-tertiary">{t.deleteAllSubsequentHint}</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                onDeleteOnly();
                onClose();
              }}
              className="w-full flex items-center justify-between p-4 border border-line hover:bg-surface-sunken rounded-xl transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-surface-sunken text-content-secondary group-hover:scale-110 transition-transform">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <div className="font-bold text-content">{t.deleteOnlyThisInstallment}</div>
                  <div className="text-xs text-content-tertiary">{t.deleteOnlyThisHint}</div>
                </div>
              </div>
            </button>

            <button
              onClick={onClose}
              className="w-full py-3 text-sm font-medium text-content-tertiary hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
            >
              {t.cancel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default InstallmentDeleteModal;

