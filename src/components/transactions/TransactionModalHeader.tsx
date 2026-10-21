import { X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface TransactionModalHeaderProps {
  title: string;
  onClose: () => void;
  readOnly?: boolean;
}

export const TransactionModalHeader = ({ title, onClose, readOnly: _readOnly }: TransactionModalHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between mb-5">
      <h3 className="font-rounded text-xl font-semibold text-content">
        {title}
      </h3>
      <button
        onClick={onClose}
        aria-label={t.close}
        className="-me-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-surface-sunken text-content-secondary hover:text-content transition-colors"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
};
