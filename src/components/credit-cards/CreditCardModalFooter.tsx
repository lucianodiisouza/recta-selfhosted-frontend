import { useI18n } from '../../context/I18nContext';

interface CreditCardModalFooterProps {
  isEditing: boolean;
  isLoading: boolean;
  onCancel: () => void;
}

export const CreditCardModalFooter = ({ isEditing, isLoading, onCancel }: CreditCardModalFooterProps) => {
  const { t } = useI18n();

  return (
    <div className="flex gap-3 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="flex-1 px-4 py-2 border border-line rounded-md text-sm font-medium text-content-secondary hover:bg-surface-sunken transition-colors"
      >
        {t.cancel}
      </button>
      <button
        type="submit"
        disabled={isLoading}
        className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-md text-sm font-bold shadow-lg shadow-primary-500/20 transition-colors flex items-center justify-center gap-2"
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
