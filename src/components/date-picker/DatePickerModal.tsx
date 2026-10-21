import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface DatePickerModalProps {
  placeholder?: string;
  onCancel: () => void;
  onConfirm: () => void;
  children: React.ReactNode;
}

export const DatePickerModal = ({
  placeholder,
  onCancel,
  onConfirm,
  children,
}: DatePickerModalProps) => {
  const { t } = useI18n();

  return createPortal(
    <div className="fixed inset-0 z-[80] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-[2px] animate-modal-backdrop" 
        onClick={onCancel}
        aria-hidden="true"
      />
      
      {/* Scrollable Container */}
      <div className="flex min-h-full items-end sm:items-center justify-center sm:p-4">
        {/* Modal Card */}
        <div 
          className="relative w-full max-w-md p-6 bg-surface-elevated rounded-t-[28px] sm:rounded-2xl shadow-floating ring-1 ring-line-subtle animate-modal-panel"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-content">
              {placeholder || t.selectDate}
            </h3>
            <button
              onClick={onCancel}
              aria-label={t.closeModal}
              className="text-gray-400 hover:text-gray-500 dark:text-gray-500 dark:hover:text-gray-400"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="mb-4">
            {children}
          </div>

          {/* Footer com botões de ação */}
          <div className="flex gap-3 justify-end pt-4 border-t border-line">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
            >
              {t.cancel}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-fill text-white hover:bg-brand-fill-hover"
            >
              {t.confirm}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
