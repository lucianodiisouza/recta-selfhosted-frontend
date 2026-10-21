import { X } from 'lucide-react';
import { useI18n } from '../../context/I18nContext';

interface CreditCardModalHeaderProps {
  isEditing: boolean;
  onClose: () => void;
}

export const CreditCardModalHeader = ({ isEditing, onClose }: CreditCardModalHeaderProps) => {
  const { t } = useI18n();

  return (
    <div className="flex items-center justify-between border-b border-line px-6 py-4">
      <h2 className="text-xl font-bold text-content">
        {isEditing ? (t.editCreditCard || 'Editar Cartão de Crédito') : (t.newCreditCard || 'Novo Cartão de Crédito')}
      </h2>
      <button
        onClick={onClose}
        className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300 transition-colors"
      >
        <X className="h-6 w-6" />
      </button>
    </div>
  );
};
