import { useI18n } from '../../context/I18nContext';

interface AccountModalFooterProps {
  isEditing: boolean;
  isLoading: boolean;
  onCancel: () => void;
}

export const AccountModalFooter = ({ isEditing, isLoading, onCancel }: AccountModalFooterProps) => {
  const { t } = useI18n();

  return (
    <div className="flex gap-3 pt-6 border-t border-line-subtle">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 px-4 py-2.5 border border-line-subtle rounded-md text-sm font-light tracking-tight text-content bg-surface-elevated hover:opacity-70 transition-opacity"
      >
        {t.cancel}
      </button>
      <button
        type="submit"
        disabled={isLoading}
        className="flex-1 px-4 py-2.5 border border-brand rounded-md text-sm font-light tracking-tight text-white bg-brand-fill hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            {t.loading || 'Salvando...'}
          </>
        ) : (
          isEditing ? (t.update || 'Atualizar') : (t.create || 'Criar')
        )}
      </button>
    </div>
  );
};
