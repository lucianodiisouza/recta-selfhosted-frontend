import { X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface AccountModalHeaderProps {
  isEditing: boolean;
  onClose: () => void;
}

export const AccountModalHeader = ({ isEditing, onClose }: AccountModalHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between mb-6 pb-6 border-b border-line-subtle">
      <h3 className="card-title">
        {isEditing ? t.editAccount : t.newAccount}
      </h3>
      <button onClick={onClose} className="text-content-tertiary hover:opacity-70 transition-opacity p-1">
        <X className="h-6 w-6" />
      </button>
    </div>
  );
};
