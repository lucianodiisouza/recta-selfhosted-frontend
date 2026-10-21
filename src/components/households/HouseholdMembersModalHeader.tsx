import { X, UserPlus } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface HouseholdMembersModalHeaderProps {
  isSharedHousehold: boolean;
  onClose: () => void;
}

export const HouseholdMembersModalHeader = ({ isSharedHousehold, onClose }: HouseholdMembersModalHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between mb-6 pb-6 border-b border-line-subtle">
      <div className="flex items-center space-x-3">
        <UserPlus className="h-5 w-5 text-brand" />
        <div>
          <h3 className="card-title">
            Gerenciar Membros
          </h3>
          <p className="text-xs font-light text-content-tertiary mt-0.5">
            {isSharedHousehold 
              ? 'Membros, convites e seleção de contas compartilhadas'
              : 'Membros e convites desta household'}
          </p>
        </div>
      </div>
      <button
        onClick={onClose}
        aria-label={t.close}
        className="text-content-tertiary hover:opacity-70 transition-opacity p-1"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
};
