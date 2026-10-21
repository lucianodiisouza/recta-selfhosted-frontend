import { useI18n } from '../../context/I18nContext';

interface TransactionModalFooterProps {
  readOnly?: boolean;
  onClose: () => void;
  isSubmitting: boolean;
  hasErrors: boolean;
  isUpdate?: boolean;
  onSaveAndCreateNew?: () => void;
}

export const TransactionModalFooter = ({ 
  readOnly, 
  onClose, 
  isSubmitting, 
  hasErrors,
  isUpdate = false,
  onSaveAndCreateNew
}: TransactionModalFooterProps) => {
  const { t } = useI18n();

  return (
    <div className="sticky bottom-0 z-10 -mx-6 -mb-6 flex flex-col-reverse gap-2 border-t border-line-subtle bg-surface-elevated/95 px-6 pb-6 pt-4 backdrop-blur sm:flex-row sm:justify-end">
      {readOnly ? (
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
        >
          {t.close}
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-surface-elevated text-content border border-line hover:bg-surface-sunken"
          >
            {t.cancel}
          </button>
          {!isUpdate && onSaveAndCreateNew && (
            <button
              type="button"
              onClick={onSaveAndCreateNew}
              disabled={isSubmitting || hasErrors}
              className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-soft text-brand-on-soft hover:bg-brand/15"
            >
              {isSubmitting ? t.loading : t.saveAndCreateNew}
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting || hasErrors}
            className="inline-flex items-center justify-center gap-2 h-11 px-5 text-[15px] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-brand-fill text-white hover:bg-brand-fill-hover"
          >
            {isSubmitting ? t.loading : isUpdate ? t.update : t.create}
          </button>
        </>
      )}
    </div>
  );
};
